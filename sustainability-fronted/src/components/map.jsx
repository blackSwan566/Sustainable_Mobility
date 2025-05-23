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

const getTrafficColor = () => "#3388ff";

const getJamColor = (density) => {
  if (density > 5) return "#b30000"; // heavy jam – dark red
  if (density > 2) return "#e34a33"; // moderate jam – mid red
  if (density > 0) return "#fc8d59"; // light congestion – light red / peach
  return "#ffb69e"; // free flow – very light
};

const getCo2Color = (intensity) => {
  // green (good) → yellow → orange (bad)
  if (intensity > 0.7) return "#ffa000"; // orange – worst
  if (intensity > 0.4) return "#ffd54f"; // yellow – medium
  return "#00c853"; // green – good
};

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
      activeLayer,
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
    const activeLayerRef = useRef(activeLayer);

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
          color: "#0000ff", // Brighter yellow
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
          name:
            feature.properties.road_name ||
            feature.properties.name ||
            "Unnamed Street",
          type: feature.properties.edge_type || "Unknown",
          maxSpeed: feature.properties.speed_kmh
            ? parseFloat(feature.properties.speed_kmh)
            : undefined,
          length: calculatePathLength(feature.geometry.coordinates).toFixed(0),
          allowed: feature.properties.allowed
            ? feature.properties.allowed.split(",")
            : [],
          disallowed: feature.properties.disallowed
            ? feature.properties.disallowed.split(",")
            : [],
          laneWidth: feature.properties.lane_width,
          priority: feature.properties.priority,
          isBarriered: barrier.current.some((b) => b.streetId === feature.id),
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
            let closestSegmentIndex = 0;

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
                  closestSegmentIndex = i;
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
                closestSegmentIndex = i;
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

              // Get edge ID from the feature to block this specific segment in the network graph
              const edgeId = hoveredFeature.id;

              // Ensure this edge exists in the network graph
              if (networkGraphRef.current && networkGraphRef.current.edges) {
                // Find all edges that match this feature
                const edgesToBlock = [];

                // grab the node-IDs of the clicked edge once
                const clickedStart =
                  hoveredFeature.geometry.coordinates[0].join(",");
                const clickedEnd = hoveredFeature.geometry.coordinates
                  .at(-1)
                  .join(",");

                networkGraphRef.current.edges.forEach((edge, idx) => {
                  // block A→B OR B→A that matches the same geometry
                  const sameSegment =
                    (edge.start === clickedStart && edge.end === clickedEnd) ||
                    (edge.start === clickedEnd && edge.end === clickedStart);

                  if (sameSegment) {
                    edge.isBlocked = true;
                    edgesToBlock.push(idx);
                  }
                });

                console.log(
                  `Found ${edgesToBlock.length} edges to block with ID ${edgeId}`
                );

                // Block all matching edges
                edgesToBlock.forEach((idx) => {
                  networkGraphRef.current.edges[idx].isBlocked = true;
                  console.log(`Blocked edge ${idx} for street ${streetName}`);
                });
              }

              // Also update the visual appearance of the blocked segment
              const streetLayers = streetLayersRef.current[streetName] || [];
              const blockedLayer = streetLayers.find(
                (layer) => layer.feature?.id === edgeId
              );

              if (blockedLayer) {
                blockedLayer.setStyle({
                  color: "#ff0000",
                  weight: 5,
                  opacity: 1,
                });
              }

              barrier.current.push({
                marker,
                trail: null,
                streetId: edgeId,
                streetName: streetName,
                segmentIndex: closestSegmentIndex,
              });

              console.log(
                `Barrier placed on ${streetName} at coordinates: ${closestPoint.lat.toFixed(
                  5
                )}, ${closestPoint.lng.toFixed(5)}`
              );

              // Stop all existing vehicles
              if (animationRef.current) {
                stopAnimation();
              }

              // Find a layer group for vehicles
              const vehiclesLayer = Object.values(map._layers).find(
                (layer) => layer.vehicleCount !== undefined
              );

              // Reinitialize all vehicles to ensure they respect the new barriers
              const currentVehicleCount = vehiclesRef.current.length;
              console.log(
                `Reinitializing ${currentVehicleCount} vehicles after barrier placement`
              );

              // Clear all current vehicles
              vehicleMarkersRef.current.forEach((v) => {
                if (v.marker) map.removeLayer(v.marker);
                if (v.trail) map.removeLayer(v.trail);
              });

              // Initialize new vehicles that respect barriers
              initVehicles(map, currentVehicleCount, vehiclesLayer);

              // Restart animation if it was running
              if (isPlaying) {
                startAnimation();
              }

              // Update street info if this is the currently hovered street
              if (hoveredFeature === hoveredFeature) {
                handleStreetHover(hoveredFeature);
              }
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

      // Use a more subtle map tile style
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: "&copy; OSM & CARTO",
        }
      ).addTo(map);

      // Add map labels as a separate layer for better readability
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
          pane: "shadowPane", // Place labels above other layers
        }
      ).addTo(map);

      // Handler for layer control changes
      const handleLayerToggle = (e) => {
        const layerName = e.name;
        const isChecked = e.type === "overlayadd";

        console.log(`Layer ${layerName} ${isChecked ? "added" : "removed"}`);

        // Special handling for the vehicles layer
        if (layerName === "Vehicles") {
          if (isChecked && vehicleMarkersRef.current.length === 0) {
            console.log("Reinitializing vehicles");
            // Get the layer from map's layers
            const vehiclesLayer = Object.values(map._layers).find(
              (layer) => layer.vehicleCount !== undefined
            );

            if (vehiclesLayer) {
              initVehicles(map, vehiclesLayer.vehicleCount, vehiclesLayer);
            }
          }
        }
      };

      // Listen for layer control events
      map.on("overlayadd", handleLayerToggle);
      map.on("overlayremove", handleLayerToggle);

      fetch("/network_full.geojson")
        .then((res) => res.json())
        .then((data) => {
          networkDataRef.current = data;

          // Group streets by name
          const streetsByName = processStreetData(data);
          console.log("Street groups:", Object.keys(streetsByName).length);

          // Update the edge type colors to use shades of gray
          const edgeTypeColors = {
            "highway.primary": "#55555570",
            "highway.secondary": "#66666670",
            "highway.tertiary": "#77777770",
            "highway.residential": "#88888870",
            "highway.service": "#99999970",
            default: "#aaaaaa70",
          };

          const getColor = (f) =>
            edgeTypeColors[f.properties.edge_type] || edgeTypeColors.default;

          // Create a single layer group for all streets for better performance
          const streetsLayer = L.layerGroup().addTo(map);

          // Create separate layers for each street name but add them to the streets layer group
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
                  opacity: 0.6,
                }),
              });

              // Attach feature to layer for reference
              layer.feature = feature;
              layer.addTo(streetsLayer);
              return layer;
            });
          });

          // Log the total number of street layers
          const totalLayers = Object.values(streetLayersRef.current).flat()
            .length;
          console.log(`Created ${totalLayers} street layers in total`);

          const allGeoJSON = L.geoJSON(data, {
            style: (f) => ({ color: getColor(f), weight: 4, opacity: 0.6 }),
          });

          map.fitBounds(allGeoJSON.getBounds(), { padding: [50, 50] });

          buildNetworkGraph(data);
          createPathVisualizationLayer(map);

          // Create a layer group for vehicles
          const vehiclesLayer = L.layerGroup().addTo(map);
          vehiclesLayer.vehicleCount = vehicleCount; // Store count for reinit

          // Initialize vehicles with the vehicle layer
          initVehicles(map, vehicleCount, vehiclesLayer);

          // Create the layers but don't add the effect here
          const layers = {
            traffic: vehiclesLayer,
            jam: L.heatLayer([], {
              radius: 20,
              maxZoom: 19,
              gradient: { 0.4: "#00f", 0.7: "#ff0", 1: "#f00" },
            }),
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

          heatLayersRef.current = layers;
        });

      return () => {
        if (animationRef.current) {
          stopAnimation();
        }
        map.off("overlayadd", handleLayerToggle);
        map.off("overlayremove", handleLayerToggle);
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

        // Get speed in km/h from the feature properties
        const speedKmh = feature.properties.speed_kmh
          ? parseFloat(feature.properties.speed_kmh)
          : 50; // Default to 50 km/h if not specified

        graph.edges.push({
          id: idx,
          start: startCoord,
          end: endCoord,
          feature: feature,
          length: calculatePathLength(coords),
          isBlocked: false, // Initially, no segment is blocked
          speedKmh: speedKmh, // Store speed in km/h
        });

        graph.nodes[startCoord].connections.push(endCoord);
      });

      // Build adjacency list for path finding
      buildAdjacency(graph);

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

    // ---------- Path-finding helpers ----------
    const buildAdjacency = (graph) => {
      graph.adj = {};
      graph.edges.forEach((edge, idx) => {
        if (!graph.adj[edge.start]) graph.adj[edge.start] = [];
        graph.adj[edge.start].push({ idx, to: edge.end, weight: edge.length });
      });
    };

    const dijkstra = (graph, startNode, endNode) => {
      if (startNode === endNode) return [];
      const dist = {};
      const prevEdge = {};
      const pq = [[0, startNode]]; // [distance, node]

      while (pq.length) {
        pq.sort((a, b) => a[0] - b[0]); // naïve priority-queue
        const [d, u] = pq.shift();
        if (dist[u] !== undefined) continue;
        dist[u] = d;
        if (u === endNode) break;

        (graph.adj[u] || []).forEach(({ idx, to, weight }) => {
          if (graph.edges[idx].isBlocked) return; // skip blocked links
          if (dist[to] === undefined) {
            pq.push([d + weight, to]);
            if (prevEdge[to] === undefined) prevEdge[to] = idx;
          }
        });
      }

      if (dist[endNode] === undefined) return []; // no path

      // Re-construct edge-index path
      const path = [];
      let node = endNode;
      while (node !== startNode) {
        const edgeIdx = prevEdge[node];
        if (edgeIdx === undefined) return [];
        path.unshift(edgeIdx);
        node = graph.edges[edgeIdx].start;
      }
      return path;
    };

    const getRandomRoute = (graph) => {
      const nodes = Object.keys(graph.nodes);
      if (nodes.length < 2) return [];
      for (let tries = 0; tries < 30; tries++) {
        const start = nodes[Math.floor(Math.random() * nodes.length)];
        let end = nodes[Math.floor(Math.random() * nodes.length)];
        if (end === start) continue;
        const route = dijkstra(graph, start, end);
        if (route.length) return route;
      }
      return [];
    };
    // ---------- end helpers ----------

    const createPathVisualizationLayer = (map) => {
      const layer = L.layerGroup();
      const graph = networkGraphRef.current;

      for (let i = 0; i < 5; i++) {
        const path = generateRandomPath(5 + Math.floor(Math.random() * 5));
        const coords = path.flatMap((idx) =>
          graph.edges[idx].feature.geometry.coordinates.map((c) => [c[1], c[0]])
        );

        // Use grayscale colors with different opacity
        const opacity = 0.4 + i * 0.1;
        L.polyline(coords, {
          color: `rgba(100, 100, 100, ${opacity})`,
          weight: 6,
          opacity: opacity,
          dashArray: "5, 10", // Add dashed lines for path visualization
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

    const initVehicles = (map, count, layerGroup = null) => {
      const graph = networkGraphRef.current;
      if (!graph || !graph.edges || !graph.edges.length) return;

      // Clear existing vehicles
      vehicleMarkersRef.current.forEach((v) => {
        if (v.marker) map.removeLayer(v.marker);
        if (v.trail) map.removeLayer(v.trail);
      });

      vehicleMarkersRef.current = [];
      vehiclesRef.current = [];

      // Use a consistent color for all vehicles
      const vehicleColor = "#3388ff"; // Standard blue color

      for (let i = 0; i < count; i++) {
        const route = getRandomRoute(graph);
        if (!route.length) continue; // couldn't find a path

        const edgeIdx = route[0];
        const edge = graph.edges[edgeIdx];
        const coords = edge.feature.geometry.coordinates;
        if (!coords || coords.length < 2) continue;

        const progress = Math.random() * 0.5; // appear somewhere in first half
        const segment = Math.floor(progress * (coords.length - 1));
        const sub = progress * (coords.length - 1) - segment;

        const start = coords[segment];
        const end = coords[segment + 1];
        const lng = start[0] + (end[0] - start[0]) * sub;
        const lat = start[1] + (end[1] - start[1]) * sub;

        const vehicle = {
          id: i,
          lng,
          lat,
          currentEdge: edgeIdx,
          progress,
          speed: 10 + Math.random() * 10,
          color: vehicleColor,
          trail: [],
          route, // ← new
          routePos: 0, // ← new
        };

        const marker = L.circleMarker([lat, lng], {
          radius: 4,
          fillColor: vehicleColor,
          color: vehicleColor,
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
        });

        (layerGroup || map).addLayer(marker);

        vehicleMarkersRef.current.push({ marker, trail: null });
        vehiclesRef.current.push(vehicle);
      }

      console.log(
        `Successfully initialized ${vehiclesRef.current.length} vehicles`
      );
    };

    const updateVehicles = (delta) => {
      const graph = networkGraphRef.current;
      if (!graph || !graph.edges || !vehiclesRef.current) return;

      // Track vehicle positions for density calculation
      const vehiclePositions = [];

      vehiclesRef.current.forEach((v, idx) => {
        // Skip updating if the vehicle is on a blocked edge
        if (!v) return;

        // If vehicle is on a blocked edge, relocate it
        if (
          !graph.edges[v.currentEdge] ||
          graph.edges[v.currentEdge].isBlocked
        ) {
          console.log(
            `Vehicle ${idx} on blocked edge ${v.currentEdge}, relocating`
          );
          const newEdgeIdx = findRandomUnblockedEdge();
          const edge = graph.edges[newEdgeIdx];
          const coords = edge.feature.geometry.coordinates;

          if (coords && coords.length >= 2) {
            v.currentEdge = newEdgeIdx;
            v.progress = 0;
            v.lng = coords[0][0];
            v.lat = coords[0][1];

            const marker = vehicleMarkersRef.current[idx]?.marker;
            if (marker) {
              marker.setLatLng([v.lat, v.lng]);
            }
          }
          return; // Skip the rest of the update for this vehicle
        }

        const edge = graph.edges[v.currentEdge];
        const coords = edge.feature.geometry.coordinates;

        if (!coords || coords.length < 2) return;

        // Use the speedKmh from the edge, converted to m/s for internal calculations
        const speedMs = (edge.speedKmh || 50) / 3.6; // Convert km/h to m/s

        v.progress +=
          (speedMs * speedFactorRef.current * delta) / 1000 / edge.length;

        if (v.progress >= 1) {
          v.trail.push({ lat: v.lat, lng: v.lng });
          if (v.trail.length > 5) v.trail.shift();

          // -------- route following ----------
          v.routePos++;
          if (!v.route || v.routePos >= v.route.length) {
            // destination reached -> choose a new one
            v.route = getRandomRoute(graph);
            v.routePos = 0;
          }
          if (!v.route.length) {
            v.currentEdge = findRandomUnblockedEdge();
          } else {
            // skip freshly-blocked edges
            while (
              v.routePos < v.route.length &&
              graph.edges[v.route[v.routePos]].isBlocked
            ) {
              v.routePos++;
            }
            if (v.routePos >= v.route.length) {
              v.route = getRandomRoute(graph);
              v.routePos = 0;
            }
            v.currentEdge = v.route[v.routePos];
          }
          v.progress = 0;
          // -------- end route following -------
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

        // Add vehicle position to tracking array
        vehiclePositions.push([v.lat, v.lng, v]);
      });

      // Calculate traffic density and update vehicle colors and heatmaps
      updateTrafficVisualization(vehiclePositions);
    };

    // New comprehensive function to handle all visualizations
    const updateTrafficVisualization = (vehiclePositions) => {
      const map = mapRef.current?._leaflet_map;
      if (!map) return;

      const noiseData = [];

      vehiclePositions.forEach(([lat, lng, vehicle], idx) => {
        const marker = vehicleMarkersRef.current[idx]?.marker;
        if (!marker) return;

        let nearbyCount = 0;
        vehiclePositions.forEach(([otherLat, otherLng], jdx) => {
          if (idx === jdx) return;
          const dist = map.distance([lat, lng], [otherLat, otherLng]);
          if (dist < 50) nearbyCount++;
        });
        vehicle.trafficDensity = nearbyCount;

        const currentLayer = activeLayerRef.current;
        let colour = "#3388ff";

        switch (currentLayer) {
          case "traffic":
            colour = getTrafficColor();
            break;
          case "jam":
            colour = getJamColor(nearbyCount);
            break;
          case "co2": {
            const intensity = Math.min(1.0, nearbyCount * 0.15 + 0.1);
            colour = getCo2Color(intensity);
            break;
          }
          case "noise":
            marker.setStyle({
              fillOpacity: 0,
              opacity: 0,
            });
            const edge = networkGraphRef.current?.edges[vehicle.currentEdge];
            const speed = edge?.speedKmh || 50;
            const noiseIntensity = speed > 80 ? 1 : speed > 50 ? 0.7 : 0.4;
            noiseData.push([lat, lng, noiseIntensity]);
            return;
          default:
            colour = getTrafficColor();
        }

        marker.setStyle({
          fillColor: colour,
          color: colour,
          fillOpacity: 1,
          opacity: 1,
        });
      });

      const noiseLayer = heatLayersRef.current.noise;
      const mapHasLayer = noiseLayer && map.hasLayer(noiseLayer);
      if (activeLayerRef.current === "noise") {
        if (!mapHasLayer && noiseLayer) map.addLayer(noiseLayer);
        if (noiseLayer && noiseData.length) noiseLayer.setLatLngs(noiseData);
      } else if (mapHasLayer) {
        map.removeLayer(noiseLayer);
      }
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

    // Add a helper function to find a random unblocked edge
    const findRandomUnblockedEdge = () => {
      const graph = networkGraphRef.current;
      if (!graph || !graph.edges) return 0;

      let attempts = 0;
      const maxAttempts = 50;
      let edgeIdx;

      do {
        edgeIdx = Math.floor(Math.random() * graph.edges.length);
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn("Could not find unblocked edge after max attempts");
          return edgeIdx; // Return any edge as fallback
        }
      } while (graph.edges[edgeIdx].isBlocked);

      return edgeIdx;
    };

    // Move the layer change effect outside the fetch callback
    useEffect(() => {
      const map = mapRef.current?._leaflet_map;
      if (!map) return;

      // Remove all visualization layers
      Object.values(heatLayersRef.current).forEach((layer) => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });

      // Update vehicle colors based on active layer
      vehiclesRef.current?.forEach((vehicle, idx) => {
        const marker = vehicleMarkersRef.current[idx]?.marker;
        if (!marker) return;

        let color;
        let nearbyCount, edge, speed;

        switch (activeLayer) {
          case "traffic":
            color = "#3388ff";
            break;

          case "jam":
            nearbyCount = vehicle.trafficDensity || 0;
            if (nearbyCount > 5) {
              color = "#ff0000";
            } else if (nearbyCount > 2) {
              color = "#ffaa00";
            } else {
              color = "#3388ff";
            }
            break;

          case "co2":
            edge = networkGraphRef.current?.edges[vehicle.currentEdge];
            speed = edge?.speedKmh || 50;
            if (speed < 30) {
              color = "#ff6600";
            } else if (speed < 50) {
              color = "#ffcc00";
            } else {
              color = "#66cc00";
            }
            break;

          case "noise":
            marker.setStyle({
              fillOpacity: 0,
              opacity: 0,
            });
            return;

          default:
            color = "#3388ff";
        }

        marker.setStyle({
          fillColor: color,
          color: color,
          fillOpacity: 1,
          opacity: 1,
        });
      });

      if (activeLayer === "noise" && heatLayersRef.current.noise) {
        map.addLayer(heatLayersRef.current.noise);
      }
    }, [activeLayer]);

    // Add noise update interval effect
    useEffect(() => {
      let interval;

      if (activeLayer === "noise") {
        interval = setInterval(() => {
          const noiseData =
            vehiclesRef.current
              ?.map((vehicle) => {
                const edge =
                  networkGraphRef.current?.edges[vehicle.currentEdge];
                const speed = edge?.speedKmh || 50;
                // Calculate intensity based on speed
                const intensity = speed > 80 ? 1.0 : speed > 50 ? 0.7 : 0.4;
                return [vehicle.lat, vehicle.lng, intensity];
              })
              .filter(Boolean) || [];

          if (heatLayersRef.current.noise) {
            heatLayersRef.current.noise.setLatLngs(noiseData);
          }
        }, 5000);
      }

      return () => {
        if (interval) clearInterval(interval);
      };
    }, [activeLayer]);

    // Delete barrier effect
    useEffect(() => {
      const map = mapRef.current?._leaflet_map;
      if (!map) return;

      if (activeButton === "delete") {
        handleDeleteBarrier();
      }
    }, [activeButton]);

    // Define the handleDeleteBarrier function inside the component
    const handleDeleteBarrier = () => {
      const map = mapRef.current?._leaflet_map;
      if (!map) return;

      // Remove all barrier markers
      barrier.current.forEach(({ marker }) => {
        if (marker) {
          map.removeLayer(marker);
        }
      });

      // Reopen all blocked streets
      if (networkGraphRef.current && networkGraphRef.current.edges) {
        networkGraphRef.current.edges.forEach((edge) => {
          edge.isBlocked = false;
        });
      }

      // Clear the barrier array
      barrier.current = [];

      // Update street layers to show reopened streets
      if (streetLayersRef.current && streetLayersRef.current.streets) {
        streetLayersRef.current.streets.setStyle((feature) => {
          return {
            color: "#3388ff",
            weight: 3,
            opacity: 0.7,
          };
        });
      }

      console.log("All barriers removed and streets reopened");
    };

    useEffect(() => {
      activeLayerRef.current = activeLayer;
    }, [activeLayer]);

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
