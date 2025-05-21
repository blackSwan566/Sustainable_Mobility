import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import './App.css';

const barrierIcon = L.icon({
  iconUrl: 'https://symbl-cdn.com/i/webp/dd/8b7f393a72b7705da89b5b87a1d340.webp',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

let clickPoint = [0, 0];

const TrafficNetwork = () => {
  const mapRef = useRef(null);
  const vehicleCountRef = useRef(100);
  const speedFactorRef = useRef(1);
  const barrier = useRef([]);
  const [vehicleCount, setVehicleCount] = useState(100);
  const [speedFactor, setSpeedFactor] = useState(1);
  const [activeButton, setActiveButton] = useState(null);
  const networkGraphRef = useRef(null);
  const networkDataRef = useRef(null);
  const vehicleMarkersRef = useRef([]);
  const vehiclesRef = useRef([]);
  const animationRef = useRef(null);
  const pathLayerRef = useRef(null);
  const heatLayersRef = useRef({});
useEffect(() => {
  const map = mapRef.current?._leaflet_map;
  if (!map) return;

  // Direkt löschen, wenn Button geklickt wurde
  if (activeButton === 'delete') {
    barrier.current.forEach(({ marker }) => {
      if (marker) {
        map.removeLayer(marker);
      }
    });
    barrier.current = [];
    setActiveButton(null); // Nur einmal löschen
    return; // Wichtig: Kein Event-Handler registrieren!
  }

  // Event-Handler für "barrier"
  const handleClick = (e) => {
    if (activeButton === 'barrier') {
      const marker = L.marker(e.latlng, { icon: barrierIcon }).addTo(map);
      barrier.current.push({ marker, trail: null });
      clickPoint = [e.latlng.lng, e.latlng.lat];
      console.log(clickPoint);
      setActiveButton(null); // Nur eine Barrier setzen
    }
  };

  map.on('click', handleClick);

  return () => {
    map.off('click', handleClick);
  };
}, [activeButton]);


  useEffect(() => {
    if (mapRef.current && mapRef.current._leaflet_map) return;

    const map = L.map(mapRef.current).setView([48.13, 11.56], 13);
    mapRef.current._leaflet_map = map;

    

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: "&copy; OSM & CARTO",
    }).addTo(map);

    fetch("/map4.geojson")
      .then(res => res.json())
      .then(data => {
        networkDataRef.current = data;

        const edgeTypeColors = {
          "highway.primary": "#ff4444",
          "highway.secondary": "#44ff44",
          "highway.tertiary": "#4444ff",
          "highway.residential": "#ffaa44",
          "highway.service": "#44ffff",
          default: "#aaaaaa",
        };

        const getColor = f => edgeTypeColors[f.properties.edge_type] || edgeTypeColors.default;

        const networkLayer = L.geoJSON(data, {
          style: f => ({ color: getColor(f), weight: 4, opacity: 0.7 })
        }).addTo(map);

        map.fitBounds(networkLayer.getBounds(), { padding: [50, 50] });

        buildNetworkGraph(data);
        createPathVisualizationLayer(map);
        initVehicles(map, vehicleCount);

        heatLayersRef.current = {
          jam: L.heatLayer([], {
            radius: 20, maxZoom: 19,
            gradient: { 0.4: "#00f", 0.7: "#ff0", 1: "#f00" },
          }).addTo(map),
          co2: L.heatLayer([], {
            radius: 20, maxZoom: 19,
            gradient: { 0.4: "#0f0", 0.7: "#ff0", 1: "#f00" },
          }),
          noise: L.heatLayer([], {
            radius: 20, maxZoom: 19,
            gradient: { 0.4: "#0ff", 0.7: "#ff0", 1: "#f0f" },
          })
        };

        L.control.layers(null, {
          "Traffic Network": networkLayer,
          "Path Visualization": pathLayerRef.current,
          "Traffic jam": heatLayersRef.current.jam,
          "CO₂": heatLayersRef.current.co2,
          "Noise [dB]": heatLayersRef.current.noise,
        }).addTo(map);

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

  const stopAnimation = () => cancelAnimationFrame(animationRef.current);

  return (
    <div className="app-scroll-container">
      <div className="map-section">
        <div className="map-title">
          <h1>Kempten City Traffic</h1>
          <p>Team kemptAInability</p>
        </div>
        <div className="map-overlay">
          <h2 className="headline2">Simulation Features</h2>
          <div className="tab-group vertical">
            <button
              className={`tab ${activeButton === 'barrier' ? 'active' : ''}`}
              onClick={() => setActiveButton('barrier')}
            >🚧 SET BARRIER</button>

            <button
              className={`tab ${activeButton === 'delete' ? 'active' : ''}`}
              onClick={() => setActiveButton('delete')}
            >❌ DELETE BARRIER</button>
          </div>
        </div>

        <div className="map-overlay-emissions">
          <h2 className="headline2">Reductions & Savings</h2>

          <div className="impact-box">
            <div className="impact-content">
              <p className="impact-label">🌱 CO₂ Emissions</p>
              <div className="progress-bar">
                <div className="progress-fill co2" style={{ width: '65%' }}></div>
              </div>
              <p className="impact-value">−65%</p>
            </div>
          </div>

          <div className="impact-box">
            <div className="impact-content">
              <p className="impact-label">🔉 Noise Reduction</p>
              <div className="progress-bar">
                <div className="progress-fill noise" style={{ width: '50%' }}></div>
              </div>
              <p className="impact-value">−50%</p>
            </div>
          </div>

          <div className="impact-box">
            <div className="impact-content">
              <p className="impact-label">🚗⏳ Traffic Delay</p>
              <div className="progress-bar">
                <div className="progress-fill traffic" style={{ width: '70%' }}></div>
              </div>
              <p className="impact-value">−70%</p>
            </div>
          </div>
        </div>

        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
        

        <div className="controls">
          <label>
            Vehicles:
            <input
              type="range" min="10" max="500" value={vehicleCount} step="10"
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
              type="range" min="0.5" max="5" step="0.5" value={speedFactor}
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

      <div className="about-section">
        <h2>About Us</h2>
        <p>
          The seminar <strong>sustAInability</strong> is a collaboration between the University of Applied Sciences Munich (HM) and the Technical University of Munich (TUM).<br /><br />
          <strong>kemptAInability</strong> aims to create a traffic simulation for the city of Kempten, focusing on <em>Sustainability</em>, <em>Urban Planning</em> and <em>Smart Mobility</em>. The project is part of an initiative to promote green spaces and improve the quality of life in the city center of Kempten.<br /><br />
          <strong>Contributors:</strong> Fiona Lau, Leonie Münster, Anton Rockenstein, Peter Trenkle at LMU Munich.
        </p>
        <div className="logo-row">
          <img src="src/images/tum.webp" alt="TUM Logo" className="about-logo" />
          <img src="src/images/hm.webp" alt="HM Logo" className="about-logo" />
          <img src="src/images/lmu_logo.png" alt="LMU Logo" className="about-logo" />
          <img src="src/images/bidt.webp" alt="BIDT Logo" className="about-logo" />
          <img src="src/images/kempten_logo.png" alt="Kempten Logo" className="about-logo" />
          <img src="src/images/ziele_logo.jpg" alt="Ziele Logo" className="about-logo" />
          <img src="src/images/ministry.webp" alt="Ministry Logo" className="about-logo" />
        </div>
      </div>
    </div>
  );
};

export default TrafficNetwork;
