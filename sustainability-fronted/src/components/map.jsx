import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

const barrierIcon = L.icon({
  iconUrl:
    "https://symbl-cdn.com/i/webp/dd/8b7f393a72b7705da89b5b87a1d340.webp",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const Map = forwardRef(
  (
    {
      vehicleCount,
      activeButton,
      setActiveButton,
      speedFactorRef,
      barrier,
      isPlaying,
      setSelectedStreetInfo,
    },
    ref
  ) => {
    const mapRef = useRef(null);
    const networkGraphRef = useRef(null);
    const networkDataRef = useRef(null);
    const vehicleMarkersRef = useRef([]);
    const vehiclesRef = useRef([]);
    const animationRef = useRef(null);
    const pathLayerRef = useRef(null);
    const heatLayersRef = useRef({});
    const streetLayersRef = useRef({});
    const highlightedLayerRef = useRef(null);
    const [hoveredFeature, setHoveredFeature] = useState(null);

    // Expose functions to parent component via ref
    useImperativeHandle(ref, () => ({
      _leaflet_map: mapRef.current?._leaflet_map,
      initVehicles: (map, count) => initVehicles(map, count),
    }));

    // Handle street hover
    const handleStreetHover = (feature) => {
      const map = mapRef.current?._leaflet_map;
      if (!map) return;

      // Remove previous highlight if it exists
      if (highlightedLayerRef.current) {
        map.removeLayer(highlightedLayerRef.current);
        highlightedLayerRef.current = null;
      }

      if (!feature) {
        // Clear selected street info if no feature is hovered
        if (setSelectedStreetInfo) {
          setSelectedStreetInfo(null);
        }
        return;
      }

      // Highlight the hovered feature
      highlightedLayerRef.current = L.geoJSON(feature, {
        style: {
          color: "#FFCC00", // Brighter yellow
          weight: 8, // Increased thickness
          opacity: 0.9, // More opaque
          lineJoin: "round",
          dashArray: "5, 10", // Dashed line for better visibility
        },
      }).addTo(map);

      console.log(
        "Highlighting street:",
        feature.properties.road_name || "Unnamed"
      );

      // Set the selected street info for display
      if (setSelectedStreetInfo) {
        setSelectedStreetInfo({
          name: feature.properties.name || "Unnamed Street",
          type: feature.properties.edge_type || "Unknown",
          maxSpeed: feature.properties.max_speed,
          length: calculatePathLength(feature.geometry.coordinates).toFixed(0),
        });
      }
    };

    // Process GeoJSON data to group by street names
    const processStreetData = (geojson) => {
      if (!geojson || !geojson.features) return {};

      const streetsByName = {};

      geojson.features.forEach((feature, idx) => {
        if (feature.geometry.type !== "LineString") return;

        // Make sure properties exist
        if (!feature.properties) {
          feature.properties = {};
        }

        const name = feature.properties.name || `Street ${idx}`;

        if (!streetsByName[name]) {
          streetsByName[name] = [];
        }

        streetsByName[name].push({
          ...feature,
          id: idx,
        });
      });

      console.log(
        "Processed streets by name:",
        Object.keys(streetsByName).length
      );
      return streetsByName;
    };

    useEffect(() => {
      const map = mapRef.current?._leaflet_map;
      if (!map) return;

      // Handle barrier deletion
      if (activeButton === "delete") {
        barrier.current.forEach(({ marker }) => {
          if (marker) {
            map.removeLayer(marker);
          }
        });
        barrier.current = [];
        setActiveButton(null);
        return;
      }

      // Event-Handler for barrier placement or street info
      const handleClick = (e) => {
        if (activeButton === "barrier") {
          // Try to place barrier on street if hovering over one
          console.log(
            "Barrier placement clicked. Hovered feature:",
            hoveredFeature
              ? `${hoveredFeature.properties.name || "Unnamed Street"} (id: ${
                  hoveredFeature.id
                })`
              : "none"
          );

          if (hoveredFeature) {
            const coords = hoveredFeature.geometry.coordinates;
            console.log("Street coordinates:", coords.length, "points");

            // Find closest point on the street to the click
            let minDist = Infinity;
            let closestPoint = null;

            // Calculate closest point on line segments (more accurate than just points)
            for (let i = 0; i < coords.length - 1; i++) {
              const v = L.latLng(coords[i][1], coords[i][0]);
              const w = L.latLng(coords[i + 1][1], coords[i + 1][0]);

              // Project point onto line segment
              const l2 =
                Math.pow(v.lat - w.lat, 2) + Math.pow(v.lng - w.lng, 2);
              if (l2 === 0) {
                // If segment is a point, just check distance to that point
                const dist = map.distance(e.latlng, v);
                if (dist < minDist) {
                  minDist = dist;
                  closestPoint = v;
                }
                continue;
              }

              let t =
                ((e.latlng.lat - v.lat) * (w.lat - v.lat) +
                  (e.latlng.lng - v.lng) * (w.lng - v.lng)) /
                l2;
              t = Math.max(0, Math.min(1, t));

              const projection = L.latLng(
                v.lat + t * (w.lat - v.lat),
                v.lng + t * (w.lng - v.lng)
              );

              const dist = map.distance(e.latlng, projection);
              console.log(`Segment ${i}: distance=${dist.toFixed(2)}m`);

              if (dist < minDist) {
                minDist = dist;
                closestPoint = projection;
                console.log(
                  `New closest point: ${projection.lat.toFixed(
                    5
                  )}, ${projection.lng.toFixed(5)} (${dist.toFixed(2)}m)`
                );
              }
            }

            if (closestPoint) {
              const marker = L.marker(closestPoint, {
                icon: barrierIcon,
              }).addTo(map);
              const streetName =
                hoveredFeature.properties.name || "Unnamed Street";

              barrier.current.push({
                marker,
                trail: null,
                streetId: hoveredFeature.id,
                streetName: streetName,
              });

              console.log(
                `Barrier placed on ${streetName} at coordinates: ${closestPoint.lat.toFixed(
                  5
                )}, ${closestPoint.lng.toFixed(5)}`
              );
              alert(`Barrier placed on ${streetName}`);
            }
          } else {
            // If not hovering over a street, place barrier at click location
            const marker = L.marker(e.latlng, { icon: barrierIcon }).addTo(map);
            barrier.current.push({
              marker,
              trail: null,
            });
            console.log(
              `Barrier placed at coordinates: ${e.latlng.lat.toFixed(
                5
              )}, ${e.latlng.lng.toFixed(5)}`
            );
          }
        }
      };

      // Mouse move handler for street highlighting
      const handleMouseMove = (e) => {
        if (
          !streetLayersRef.current ||
          Object.keys(streetLayersRef.current).length === 0
        ) {
          console.log("No street layers available for hovering");
          return;
        }

        let closestFeature = null;
        let minDistance = 15; // Lower minimum pixel distance for detection
        let closestDistance = Infinity;
        let detectedStreets = 0;

        // Function to calculate distance from point to line segment
        const distToSegment = (p, v, w) => {
          // Calculate distance from point p to line segment vw
          const l2 = Math.pow(v.lat - w.lat, 2) + Math.pow(v.lng - w.lng, 2);
          if (l2 === 0) return map.distance(p, v);

          let t =
            ((p.lat - v.lat) * (w.lat - v.lat) +
              (p.lng - v.lng) * (w.lng - v.lng)) /
            l2;
          t = Math.max(0, Math.min(1, t));

          const projection = L.latLng(
            v.lat + t * (w.lat - v.lat),
            v.lng + t * (w.lng - v.lng)
          );

          return map.distance(p, projection);
        };

        // Find the closest street to the cursor
        Object.values(streetLayersRef.current)
          .flat()
          .forEach((street) => {
            if (!street || !street.feature) return;

            const coords = street.feature.geometry.coordinates;
            if (!coords || coords.length < 2) return;

            // Check distance to each line segment
            for (let i = 0; i < coords.length - 1; i++) {
              const v = L.latLng(coords[i][1], coords[i][0]);
              const w = L.latLng(coords[i + 1][1], coords[i + 1][0]);
              const dist = distToSegment(e.latlng, v, w);

              if (dist < minDistance) {
                detectedStreets++;
                if (dist < closestDistance) {
                  closestDistance = dist;
                  closestFeature = street.feature;
                }
              }
            }
          });

        if (detectedStreets > 0) {
          console.log(
            `Found ${detectedStreets} street segments within hover range. Closest: ${
              closestFeature?.properties?.name || "unnamed"
            } (${closestDistance.toFixed(2)}m)`
          );
        }

        if (closestFeature !== hoveredFeature) {
          setHoveredFeature(closestFeature);
          handleStreetHover(closestFeature);
        }
      };

      map.on("click", handleClick);
      map.on("mousemove", handleMouseMove);

      return () => {
        map.off("click", handleClick);
        map.off("mousemove", handleMouseMove);
      };
    }, [
      activeButton,
      barrier,
      setActiveButton,
      hoveredFeature,
      setSelectedStreetInfo,
    ]);

    // Effect for controlling animation based on isPlaying state
    useEffect(() => {
      const map = mapRef.current?._leaflet_map;
      if (!map || !networkGraphRef.current) return;

      if (isPlaying) {
        startAnimation();
      } else if (animationRef.current) {
        stopAnimation();
      }

      return () => {
        if (animationRef.current) {
          stopAnimation();
        }
      };
    }, [isPlaying]);

    // Separate effect for initial map setup
    useEffect(() => {
      if (mapRef.current && mapRef.current._leaflet_map) return;

      // Create full-screen map
      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView([48.13, 11.56], 13);

      mapRef.current._leaflet_map = map;

      // Add zoom control to bottom right
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: "&copy; OSM & CARTO",
        }
      ).addTo(map);

      fetch("/network_full.geojson")
        .then((res) => res.json())
        .then((data) => {
          networkDataRef.current = data;

          // Group streets by name
          const streetsByName = processStreetData(data);
          console.log("Street groups:", Object.keys(streetsByName));

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

          // Create separate layers for each street name
          streetLayersRef.current = {};

          Object.entries(streetsByName).forEach(([name, features]) => {
            console.log(
              `Creating layers for street "${name}" with ${features.length} segments`
            );

            streetLayersRef.current[name] = features.map((feature) => {
              // Store the feature for easier access
              const layer = L.geoJSON(feature, {
                style: (f) => ({
                  color: getColor(f),
                  weight: 4,
                  opacity: 0.7,
                }),
              });

              // Attach feature to layer for reference
              layer.feature = feature;
              layer.addTo(map);
              return layer;
            });
          });

          // Log the total number of street layers
          const totalLayers = Object.values(streetLayersRef.current).flat()
            .length;
          console.log(`Created ${totalLayers} street layers in total`);

          const allGeoJSON = L.geoJSON(data, {
            style: (f) => ({ color: getColor(f), weight: 4, opacity: 0.7 }),
          });

          map.fitBounds(allGeoJSON.getBounds(), { padding: [50, 50] });

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

          // Move layer controls to bottom right
          L.control
            .layers(
              null,
              {
                "Traffic jam": heatLayersRef.current.jam,
                "CO₂": heatLayersRef.current.co2,
                "Noise [dB]": heatLayersRef.current.noise,
              },
              { position: "bottomright" }
            )
            .addTo(map);
        });

      return () => {
        if (animationRef.current) {
          stopAnimation();
        }
      };
    }, [vehicleCount]);

    const buildNetworkGraph = (data) => {
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
            latlng: [
              coords[coords.length - 1][1],
              coords[coords.length - 1][0],
            ],
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
    };

    const calculatePathLength = (coordinates) => {
      let length = 0;
      for (let i = 1; i < coordinates.length; i++) {
        const p1 = L.latLng(coordinates[i - 1][1], coordinates[i - 1][0]);
        const p2 = L.latLng(coordinates[i][1], coordinates[i][0]);
        length += p1.distanceTo(p2);
      }
      return Math.max(length, 1);
    };

    const createPathVisualizationLayer = (map) => {
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
    };

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
      if (!graph || !graph.edges || !graph.edges.length) return;

      vehicleMarkersRef.current.forEach((v) => {
        if (v.marker) map.removeLayer(v.marker);
        if (v.trail) map.removeLayer(v.trail);
      });

      vehicleMarkersRef.current = [];
      vehiclesRef.current = [];

      for (let i = 0; i < count; i++) {
        const edgeIdx = Math.floor(Math.random() * graph.edges.length);
        const edge = graph.edges[edgeIdx];
        if (
          !edge ||
          !edge.feature ||
          !edge.feature.geometry ||
          !edge.feature.geometry.coordinates
        )
          continue;

        const coords = edge.feature.geometry.coordinates;
        if (coords.length < 2) continue;

        const progress = Math.random();
        const segment = Math.floor(progress * (coords.length - 1));
        const sub = progress * (coords.length - 1) - segment;

        if (segment < 0 || segment + 1 >= coords.length) continue;

        const start = coords[segment];
        const end = coords[segment + 1];

        if (!start || !end) continue;

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
      if (!graph || !graph.edges || !vehiclesRef.current) return;

      vehiclesRef.current.forEach((v, idx) => {
        if (!v || !graph.edges[v.currentEdge]) {
          // Reset vehicle if it's in an invalid state
          const newEdgeIdx = Math.floor(Math.random() * graph.edges.length);
          const edge = graph.edges[newEdgeIdx];
          const coords = edge.feature.geometry.coordinates;

          if (!coords || coords.length < 2) return;

          v = {
            id: idx,
            lng: coords[0][0],
            lat: coords[0][1],
            currentEdge: newEdgeIdx,
            progress: 0,
            speed: 10 + Math.random() * 10,
            color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
            trail: [],
          };
          vehiclesRef.current[idx] = v;
        }

        const edge = graph.edges[v.currentEdge];
        const coords = edge.feature.geometry.coordinates;

        if (!coords || coords.length < 2) return;

        v.progress +=
          (v.speed * speedFactorRef.current * delta) / 1000 / edge.length;

        if (v.progress >= 1) {
          v.trail.push({ lat: v.lat, lng: v.lng });
          if (v.trail.length > 5) v.trail.shift();

          const end = edge.end;
          const connections = graph.nodes[end]?.connections || [];

          if (!connections.length) {
            v.currentEdge = Math.floor(Math.random() * graph.edges.length);
          } else {
            const next =
              connections[Math.floor(Math.random() * connections.length)];
            const nextIdx = graph.edges.findIndex(
              (e) => e.start === end && e.end === next
            );
            v.currentEdge =
              nextIdx !== -1
                ? nextIdx
                : Math.floor(Math.random() * graph.edges.length);
          }

          v.progress = 0;
        }

        const seg = Math.min(
          Math.floor(v.progress * (coords.length - 1)),
          coords.length - 2
        );
        const sub = v.progress * (coords.length - 1) - seg;

        if (seg < 0 || seg + 1 >= coords.length) return;

        const start = coords[seg];
        const end = coords[seg + 1];

        if (!start || !end) return;

        v.lng = start[0] + (end[0] - start[0]) * sub;
        v.lat = start[1] + (end[1] - start[1]) * sub;

        const marker = vehicleMarkersRef.current[idx]?.marker;
        if (marker) {
          marker.setLatLng([v.lat, v.lng]);
        }
      });
    };

    const startAnimation = () => {
      // Clear any existing animation first
      if (animationRef.current) {
        stopAnimation();
      }

      let lastTime = performance.now();

      const animate = (time) => {
        if (!isPlaying || !networkGraphRef.current) return;

        const delta = time - lastTime;
        lastTime = time;
        updateVehicles(delta);
        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    const stopAnimation = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    return (
      <div
        ref={mapRef}
        className={activeButton === "barrier" ? "barrier-mode" : ""}
        style={{ height: "100%", width: "100%" }}
      />
    );
  }
);

export default Map;
