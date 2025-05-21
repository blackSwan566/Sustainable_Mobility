import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

const TrafficNetwork = () => {
  const mapRef = useRef(null);
  const vehicleCountRef = useRef(100);
  const speedFactorRef = useRef(1);

  const [vehicleCount, setVehicleCount] = useState(100);
  const [speedFactor, setSpeedFactor] = useState(1);

  // External references
  const networkGraphRef = useRef(null);
  const networkDataRef = useRef(null);
  const vehicleMarkersRef = useRef([]);
  const vehiclesRef = useRef([]);
  const animationRef = useRef(null);
  const pathLayerRef = useRef(null);
  const heatLayersRef = useRef({});

  useEffect(() => {
    if (mapRef.current && mapRef.current._leaflet_map) {
      return; // Verhindert die erneute Initialisierung der Karte
    }

    const map = L.map(mapRef.current).setView([48.13, 11.56], 13);
    mapRef.current._leaflet_map = map; // Speichert die Leaflet-Karteninstanz

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OSM & CARTO",
      }
    ).addTo(map);

    fetch("/map4.geojson")
      .then((res) => res.json())
      .then((data) => {
        networkDataRef.current = data;

        const edgeTypeColors = {
          "highway.primary": "#ff4444",
          "highway.secondary": "#44ff44",
          "highway.tertiary": "#4444ff",
          "highway.residential": "#ffaa44",
          "highway.service": "#44ffff",
          default: "#aaaaaa",
        };
        const getColor = (f) =>
          edgeTypeColors[f.properties.edge_type] || edgeTypeColors.default;

        const networkLayer = L.geoJSON(data, {
          style: (f) => ({ color: getColor(f), weight: 4, opacity: 0.7 }),
        }).addTo(map);

        map.fitBounds(networkLayer.getBounds(), { padding: [50, 50] });

        buildNetworkGraph(data);
        createPathVisualizationLayer(map);
        initVehicles(map, vehicleCount);

        heatLayersRef.current = {
          jam: L.heatLayer([], {
            radius: 20,
            maxZoom: 19,
            gradient: { 0.4: "#00f", 0.7: "#ff0", 1: "#f00" },
          }).addTo(map),
          co2: L.heatLayer([], {
            radius: 20,
            maxZoom: 19,
            gradient: { 0.4: "#0f0", 0.7: "#ff0", 1: "#f00" },
          }),
          noise: L.heatLayer([], {
            radius: 20,
            maxZoom: 19,
            gradient: { 0.4: "#0ff", 0.7: "#ff0", 1: "#f0f" },
          }),
        };

        L.control
          .layers(null, {
            "Traffic Network": networkLayer,
            "Path Visualization": pathLayerRef.current,
            "Traffic jam": heatLayersRef.current.jam,
            "CO₂": heatLayersRef.current.co2,
            "Noise [dB]": heatLayersRef.current.noise,
          })
          .addTo(map);

        startAnimation();
      });

    return () => stopAnimation();
  }, []);

  const buildNetworkGraph = useCallback((data) => {
    const graph = { nodes: {}, edges: [] };
    data.features.forEach((feature, idx) => {
      if (feature.geometry.type !== "LineString") return;
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      const startCoord = coords[0].join(",");
      const endCoord = coords[coords.length - 1].join(",");

      if (!graph.nodes[startCoord]) {
        graph.nodes[startCoord] = {
          connections: [],
          latlng: [coords[0][1], coords[0][0]],
        };
      }

      if (!graph.nodes[endCoord]) {
        graph.nodes[endCoord] = {
          connections: [],
          latlng: [coords[coords.length - 1][1], coords[coords.length - 1][0]],
        };
      }

      graph.edges.push({
        id: idx,
        start: startCoord,
        end: endCoord,
        feature: feature,
        length: calculatePathLength(coords),
      });

      graph.nodes[startCoord].connections.push(endCoord);
    });

    networkGraphRef.current = graph;
  }, []);

  const calculatePathLength = (coordinates) => {
    let length = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const p1 = L.latLng(coordinates[i - 1][1], coordinates[i - 1][0]);
      const p2 = L.latLng(coordinates[i][1], coordinates[i][0]);
      length += p1.distanceTo(p2);
    }
    return Math.max(length, 1);
  };

  const createPathVisualizationLayer = useCallback((map) => {
    const layer = L.layerGroup();
    const graph = networkGraphRef.current;

    for (let i = 0; i < 5; i++) {
      const path = generateRandomPath(5 + Math.floor(Math.random() * 5));
      const coords = path.flatMap((idx) =>
        graph.edges[idx].feature.geometry.coordinates.map((c) => [c[1], c[0]])
      );

      L.polyline(coords, {
        color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 50%)`,
        weight: 6,
        opacity: 0.7,
      }).addTo(layer);
    }

    layer.addTo(map);
    pathLayerRef.current = layer;
  }, []);

  const generateRandomPath = (length) => {
    const graph = networkGraphRef.current;
    const path = [];
    let currentIdx = Math.floor(Math.random() * graph.edges.length);

    for (let i = 0; i < length; i++) {
      path.push(currentIdx);
      const edge = graph.edges[currentIdx];
      const next = graph.nodes[edge.end]?.connections || [];
      if (!next.length) break;

      const nextNode = next[Math.floor(Math.random() * next.length)];
      const nextEdge = graph.edges.findIndex(
        (e) => e.start === edge.end && e.end === nextNode
      );

      if (nextEdge === -1) break;
      currentIdx = nextEdge;
    }
    return path;
  };

  const initVehicles = (map, count) => {
    const graph = networkGraphRef.current;
    vehicleMarkersRef.current.forEach((v) => {
      if (v.marker) map.removeLayer(v.marker);
      if (v.trail) map.removeLayer(v.trail);
    });

    vehicleMarkersRef.current = [];
    vehiclesRef.current = [];

    for (let i = 0; i < count; i++) {
      const edgeIdx = Math.floor(Math.random() * graph.edges.length);
      const edge = graph.edges[edgeIdx];
      const coords = edge.feature.geometry.coordinates;

      const progress = Math.random();
      const segment = Math.floor(progress * (coords.length - 1));
      const sub = progress * (coords.length - 1) - segment;
      const start = coords[segment];
      const end = coords[segment + 1];

      const lng = start[0] + (end[0] - start[0]) * sub;
      const lat = start[1] + (end[1] - start[1]) * sub;

      const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;

      const vehicle = {
        id: i,
        lng,
        lat,
        currentEdge: edgeIdx,
        progress,
        speed: 10 + Math.random() * 10,
        color,
        trail: [],
      };

      const marker = L.circleMarker([lat, lng], {
        radius: 4,
        fillColor: color,
        color: color,
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);

      vehicleMarkersRef.current.push({ marker, trail: null });
      vehiclesRef.current.push(vehicle);
    }
  };

  const updateVehicles = (delta) => {
    const graph = networkGraphRef.current;
    vehiclesRef.current.forEach((v, idx) => {
      const edge = graph.edges[v.currentEdge];
      const coords = edge.feature.geometry.coordinates;
      v.progress += (v.speed * speedFactorRef.current * delta) / 1000 / edge.length;

      if (v.progress >= 1) {
        v.trail.push({ lat: v.lat, lng: v.lng });
        if (v.trail.length > 5) v.trail.shift();

        const end = edge.end;
        const connections = graph.nodes[end]?.connections || [];
        if (!connections.length) {
          v.currentEdge = Math.floor(Math.random() * graph.edges.length);
        } else {
          const next = connections[Math.floor(Math.random() * connections.length)];
          const nextIdx = graph.edges.findIndex(
            (e) => e.start === end && e.end === next
          );
          v.currentEdge = nextIdx !== -1 ? nextIdx : Math.floor(Math.random() * graph.edges.length);
        }

        v.progress = 0;
      }

      const seg = Math.min(Math.floor(v.progress * (coords.length - 1)), coords.length - 2);
      const sub = v.progress * (coords.length - 1) - seg;
      const start = coords[seg];
      const end = coords[seg + 1];

      v.lng = start[0] + (end[0] - start[0]) * sub;
      v.lat = start[1] + (end[1] - start[1]) * sub;

      const marker = vehicleMarkersRef.current[idx].marker;
      marker.setLatLng([v.lat, v.lng]);
    });
  };

  const startAnimation = useCallback(() => {
    let lastTime = performance.now();

    const animate = (time) => {
      const delta = time - lastTime;
      lastTime = time;
      updateVehicles(delta);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  const stopAnimation = () => {
    cancelAnimationFrame(animationRef.current);
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
      <div
        className="controls"
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          zIndex: 1000,
          background: "white",
          padding: "10px",
          borderRadius: "4px",
          boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        }}
      >
        <label>
          Vehicles:
          <input
            type="range"
            min="10"
            max="500"
            value={vehicleCount}
            step="10"
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setVehicleCount(val);
              vehicleCountRef.current = val;
              initVehicles(mapRef.current._leaflet_map, val);
            }}
          />
        </label>
        <span> {vehicleCount}</span>
        <br />
        <label>
          Speed:
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={speedFactor}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setSpeedFactor(val);
              speedFactorRef.current = val;
            }}
          />
        </label>
        <span> {speedFactor}x</span>
      </div>
    </div>
  );
};

export default TrafficNetwork;