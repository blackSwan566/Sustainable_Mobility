import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { coordDistanceMeters, calculatePathLength } from "../utils/mapUtils.js";

export const TrafficMap = ({
  vehicleCount,
  speedFactor,
  simulationActive,
  log,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const lastTimestampRef = useRef(null);

  // Refs to store simulation state
  const networkDataRef = useRef(null);
  const networkGraphRef = useRef({
    nodes: {},
    edges: [],
  });
  const vehiclesRef = useRef([]);
  const vehicleMarkersRef = useRef([]);
  const layersRef = useRef({
    networkLayer: null,
    pathVisualizationLayer: null,
    heatJam: null,
    heatCO2: null,
    heatNoise: null,
  });

  // Constants for coordinate matching
  const CONNECTION_THRESHOLD = 5; // 5 meters distance threshold for connecting nodes

  // Initialize map on component mount
  useEffect(() => {
    // Create map instance
    const map = L.map(mapRef.current).setView([48.13, 11.56], 13);
    mapInstanceRef.current = map;

    // Add base tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OSM & CARTO",
      }
    ).addTo(map);

    // Load GeoJSON data
    fetchNetworkData();

    // Cleanup function
    return () => {
      stopAnimation();
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Handle changes to vehicle count
  useEffect(() => {
    if (networkGraphRef.current.edges.length > 0) {
      initVehicles(vehicleCount);
    }
  }, [vehicleCount]);

  // Fetch network data
  const fetchNetworkData = async () => {
    try {
      const response = await fetch("/map4.geojson");
      const data = await response.json();
      log("GeoJSON loaded successfully");
      networkDataRef.current = data;

      // Create the network layer with road segments
      const networkLayer = L.geoJSON(data, {
        style: (f) => ({ color: getColor(f), weight: 4, opacity: 0.7 }),
      }).addTo(mapInstanceRef.current);

      layersRef.current.networkLayer = networkLayer;

      // Fit map bounds to the network layer
      mapInstanceRef.current.fitBounds(networkLayer.getBounds(), {
        padding: [50, 50],
      });

      // Build the graph representation
      buildNetworkGraph();

      // Create path visualization layer
      createPathVisualizationLayer();

      // Initialize vehicles
      initVehicles(vehicleCount);

      // Start animation
      startAnimation();

      // Set up layer controls
      setupLayerControls();
    } catch (err) {
      log("Error loading GeoJSON: " + err.message);
      console.error("Error loading GeoJSON:", err);
    }
  };

  // Build network graph for routing
  const buildNetworkGraph = () => {
    const networkGraph = {
      nodes: {},
      edges: [],
    };

    log("Building network graph...");

    try {
      // First pass: Create all nodes
      networkDataRef.current.features.forEach((feature, idx) => {
        if (feature.geometry.type !== "LineString") return;

        const coords = feature.geometry.coordinates;
        if (!coords || coords.length < 2) return;

        // Create nodes for the start and end of each segment
        const startCoord = coords[0].join(",");
        const endCoord = coords[coords.length - 1].join(",");

        // Add start node if it doesn't exist
        if (!networkGraph.nodes[startCoord]) {
          networkGraph.nodes[startCoord] = {
            connections: [],
            latlng: [coords[0][1], coords[0][0]],
            coordArray: coords[0],
          };
        }

        // Add end node if it doesn't exist
        if (!networkGraph.nodes[endCoord]) {
          networkGraph.nodes[endCoord] = {
            connections: [],
            latlng: [
              coords[coords.length - 1][1],
              coords[coords.length - 1][0],
            ],
            coordArray: coords[coords.length - 1],
          };
        }

        // Add edge
        networkGraph.edges.push({
          id: idx,
          start: startCoord,
          end: endCoord,
          feature: feature,
          length: calculatePathLength(coords),
          startCoordArray: coords[0],
          endCoordArray: coords[coords.length - 1],
        });
      });

      // Second pass: Connect nodes that are close to each other
      const nodeKeys = Object.keys(networkGraph.nodes);
      for (let i = 0; i < nodeKeys.length; i++) {
        const nodeKey1 = nodeKeys[i];
        const node1 = networkGraph.nodes[nodeKey1];

        for (let j = i + 1; j < nodeKeys.length; j++) {
          const nodeKey2 = nodeKeys[j];
          const node2 = networkGraph.nodes[nodeKey2];

          // Calculate distance between nodes
          const distance = coordDistanceMeters(
            node1.coordArray,
            node2.coordArray
          );

          // If nodes are very close, they're effectively the same node
          if (distance < CONNECTION_THRESHOLD) {
            // Add bidirectional connections
            if (!node1.connections.includes(nodeKey2)) {
              node1.connections.push(nodeKey2);
            }

            if (!node2.connections.includes(nodeKey1)) {
              node2.connections.push(nodeKey1);
            }
          }
        }
      }

      // Third pass: Add actual connections based on edges
      networkGraph.edges.forEach((edge) => {
        // Connect start node to end node
        const startNode = networkGraph.nodes[edge.start];
        if (startNode && !startNode.connections.includes(edge.end)) {
          startNode.connections.push(edge.end);
        }
      });

      log(
        `Graph built: ${networkGraph.edges.length} edges, ${Object.keys(networkGraph.nodes).length
        } nodes`
      );

      networkGraphRef.current = networkGraph;
    } catch (err) {
      log("Error building graph: " + err.message);
      console.error("Error building graph:", err);
    }
  };

  // Get color for network features
  const getColor = (f) => {
    const edgeTypeColors = {
      "highway.primary": "#ff4444",
      "highway.secondary": "#44ff44",
      "highway.tertiary": "#4444ff",
      "highway.residential": "#ffaa44",
      "highway.service": "#44ffff",
      default: "#aaaaaa",
    };
    return edgeTypeColors[f.properties.edge_type] || edgeTypeColors.default;
  };

  // Create path visualization layer
  const createPathVisualizationLayer = () => {
    try {
      const pathVisualizationLayer = L.layerGroup();

      // Initialize with random paths for selected vehicles
      if (networkGraphRef.current && networkGraphRef.current.edges.length > 0) {
        // Visualize random paths
        for (let i = 0; i < 5; i++) {
          const randomPath = generateRandomPath(
            5 + Math.floor(Math.random() * 5)
          );
          if (randomPath.length > 0) {
            const pathCoordinates = randomPath.flatMap((edgeIdx) => {
              const edge = networkGraphRef.current.edges[edgeIdx];
              return edge.feature.geometry.coordinates.map((coord) => [
                coord[1],
                coord[0],
              ]);
            });

            L.polyline(pathCoordinates, {
              color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 50%)`,
              weight: 6,
              opacity: 0.7,
            }).addTo(pathVisualizationLayer);
          }
        }
      }

      layersRef.current.pathVisualizationLayer = pathVisualizationLayer;
    } catch (err) {
      log("Error creating path visualization: " + err.message);
      console.error("Error creating path visualization:", err);
    }
  };

  // Set up layer controls
  const setupLayerControls = () => {
    // Create heat map layers
    layersRef.current.heatJam = L.heatLayer([], {
      radius: 20,
      maxZoom: 19,
      gradient: { 0.4: "#00f", 0.7: "#ff0", 1: "#f00" },
    }).addTo(mapInstanceRef.current);

    layersRef.current.heatCO2 = L.heatLayer([], {
      radius: 20,
      maxZoom: 19,
      gradient: { 0.4: "#0f0", 0.7: "#ff0", 1: "#f00" },
    });

    layersRef.current.heatNoise = L.heatLayer([], {
      radius: 20,
      maxZoom: 19,
      gradient: { 0.4: "#0ff", 0.7: "#ff0", 1: "#f0f" },
    });

    // Set up layer control
    const overlayMaps = {
      "Traffic Network": layersRef.current.networkLayer,
      "Path Visualization": layersRef.current.pathVisualizationLayer,
      "Traffic jam": layersRef.current.heatJam,
      "CO₂": layersRef.current.heatCO2,
      "Noise [dB]": layersRef.current.heatNoise,
    };

    L.control.layers(null, overlayMaps).addTo(mapInstanceRef.current);
  };

  // Generate a random path through the network
  const generateRandomPath = (length) => {
    if (!networkGraphRef.current || networkGraphRef.current.edges.length === 0)
      return [];

    try {
      const path = [];
      let currentEdgeIdx = Math.floor(
        Math.random() * networkGraphRef.current.edges.length
      );

      for (let i = 0; i < length; i++) {
        path.push(currentEdgeIdx);

        const edge = networkGraphRef.current.edges[currentEdgeIdx];
        if (!edge) break;

        const endNode = edge.end;
        const possibleEdges = [];

        // Find edges that start from our current end node
        networkGraphRef.current.edges.forEach((e, idx) => {
          if (e.start === endNode && idx !== currentEdgeIdx) {
            possibleEdges.push(idx);
          }
        });

        // If no forward connections, try to find nearby edges
        if (possibleEdges.length === 0) {
          const endCoord = edge.endCoordArray;

          networkGraphRef.current.edges.forEach((e, idx) => {
            if (idx !== currentEdgeIdx) {
              const dist = coordDistanceMeters(endCoord, e.startCoordArray);
              if (dist < CONNECTION_THRESHOLD) {
                possibleEdges.push(idx);
              }
            }
          });
        }

        // If still no options, end the path
        if (possibleEdges.length === 0) break;

        // Select a random connected edge
        currentEdgeIdx =
          possibleEdges[Math.floor(Math.random() * possibleEdges.length)];
      }

      return path;
    } catch (err) {
      console.error("Error generating path:", err);
      return [];
    }
  };

  // Initialize vehicles
  const initVehicles = (count) => {
    log(`Initializing ${count} vehicles...`);

    try {
      // Clear existing vehicles
      clearVehicles();

      const vehicles = [];
      const vehicleMarkers = [];

      // Get random edge indices
      const edges = networkGraphRef.current.edges;

      if (!edges || edges.length === 0) {
        log("No edges available to place vehicles");
        return;
      }

      for (let i = 0; i < count; i++) {
        try {
          // Pick a random edge to start on
          const randomEdgeIdx = Math.floor(Math.random() * edges.length);
          const edge = edges[randomEdgeIdx];
          if (
            !edge ||
            !edge.feature ||
            !edge.feature.geometry ||
            !edge.feature.geometry.coordinates
          ) {
            console.error("Invalid edge at index:", randomEdgeIdx);
            continue;
          }

          const path = edge.feature.geometry.coordinates;
          if (path.length < 2) {
            continue;
          }

          // Random position along the path
          const progress = Math.random();
          const segmentIndex = Math.floor(progress * (path.length - 1));
          const segmentProgress = progress * (path.length - 1) - segmentIndex;

          const start = path[segmentIndex];
          const end = path[segmentIndex + 1];

          // Interpolate position
          const lng = start[0] + (end[0] - start[0]) * segmentProgress;
          const lat = start[1] + (end[1] - start[1]) * segmentProgress;

          // Base speed in meters per second (5-20 m/s = ~18-72 km/h)
          const baseSpeed = 5 + Math.random() * 15;

          // Create vehicle object
          const vehicle = {
            id: i,
            lng: lng,
            lat: lat,
            currentEdge: randomEdgeIdx,
            progress: progress,
            pathIndex: segmentIndex,
            pathProgress: segmentProgress,
            // Speed in meters per second
            speed: baseSpeed,
            // Distance already traveled in current segment in meters
            distanceTraveled: 0,
            currentSegmentLength: 0,
            color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
            trail: [], // Store recent positions for trail effect
            // Store the planned route (sequence of edge IDs)
            plannedRoute: [randomEdgeIdx],
            routeIndex: 0,
            lastUpdateTime: 0,
          };

          vehicles.push(vehicle);

          // Create marker for vehicle
          const marker = L.circleMarker([lat, lng], {
            radius: 4,
            fillColor: vehicle.color,
            color: vehicle.color,
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
          }).addTo(mapInstanceRef.current);

          // Store marker reference
          vehicleMarkers.push({
            marker: marker,
            trail: null,
          });
        } catch (err) {
          console.error("Error creating vehicle:", err);
        }
      }

      vehiclesRef.current = vehicles;
      vehicleMarkersRef.current = vehicleMarkers;
      log(`${vehicles.length} vehicles initialized`);
    } catch (err) {
      log("Error initializing vehicles: " + err.message);
      console.error("Error initializing vehicles:", err);
    }
  };

  // Plan a route for a vehicle
  const planRoute = (vehicle, steps = 5) => {
    try {
      const route = [vehicle.currentEdge];
      let currentEdgeIdx = vehicle.currentEdge;

      for (let i = 0; i < steps; i++) {
        const edge = networkGraphRef.current.edges[currentEdgeIdx];
        if (!edge) break;

        const endNode = edge.end;
        const possibleEdges = [];

        // Find edges that connect to our current end node
        networkGraphRef.current.edges.forEach((e, idx) => {
          // Don't go back to the edge we just came from
          if (idx !== currentEdgeIdx && route.indexOf(idx) === -1) {
            if (e.start === endNode) {
              possibleEdges.push(idx);
            }
          }
        });

        // If no direct connections, find close edges
        if (possibleEdges.length === 0) {
          networkGraphRef.current.edges.forEach((e, idx) => {
            // Don't go back to the edge we just came from
            if (idx !== currentEdgeIdx && route.indexOf(idx) === -1) {
              const dist = coordDistanceMeters(
                edge.endCoordArray,
                e.startCoordArray
              );
              if (dist < CONNECTION_THRESHOLD) {
                possibleEdges.push(idx);
              }
            }
          });
        }

        // If still no valid edges, break
        if (possibleEdges.length === 0) break;

        // Pick a random edge to continue on
        currentEdgeIdx =
          possibleEdges[Math.floor(Math.random() * possibleEdges.length)];
        route.push(currentEdgeIdx);
      }

      return route;
    } catch (err) {
      console.error("Error planning route:", err);
      return [vehicle.currentEdge]; // Return current edge as fallback
    }
  };

  // Clear all vehicles from the map
  const clearVehicles = () => {
    vehicleMarkersRef.current.forEach((v) => {
      if (v.marker) mapInstanceRef.current.removeLayer(v.marker);
      if (v.trail) mapInstanceRef.current.removeLayer(v.trail);
    });
    vehicleMarkersRef.current = [];
    vehiclesRef.current = [];
  };

  // Animation loop
  const updateVehicles = (timestamp) => {
    if (!vehiclesRef.current.length || !simulationActive) return;

    vehiclesRef.current.forEach((vehicle, idx) => {
      try {
        // Calculate time delta (in seconds)
        const deltaTime = vehicle.lastUpdateTime
          ? (timestamp - vehicle.lastUpdateTime) / 1000
          : 0.016;

        // Update last timestamp
        vehicle.lastUpdateTime = timestamp;

        // Prevent very large time jumps
        if (deltaTime > 0.1) {
          // Calculate distance to move in meters
          const distanceToMove =
            vehicle.speed * speedFactor * Math.min(deltaTime, 0.1);
          updateVehiclePosition(vehicle, distanceToMove, idx);
        } else {
          // Calculate distance to move in meters
          const distanceToMove = vehicle.speed * speedFactor * deltaTime;
          updateVehiclePosition(vehicle, distanceToMove, idx);
        }
      } catch (err) {
        console.error("Error updating vehicle:", err, vehicle);
      }
    });
  };

  // Update vehicle position based on distance to move
  const updateVehiclePosition = (vehicle, distanceToMove, idx) => {
    try {
      // Get the current edge
      const edge = networkGraphRef.current.edges[vehicle.currentEdge];
      if (!edge || !edge.feature || !edge.feature.geometry) {
        console.error("Invalid edge:", vehicle.currentEdge);
        return;
      }

      // Get the path coordinates
      const path = edge.feature.geometry.coordinates;
      if (!path || path.length < 2) {
        console.error("Invalid path:", path);
        return;
      }

      // Add the distance to travel to the current segment
      vehicle.distanceTraveled += distanceToMove;

      // Calculate the current segment length if needed
      if (vehicle.currentSegmentLength <= 0) {
        if (vehicle.pathIndex >= path.length - 1) {
          // We've reached the end of this edge
          moveVehicleToNextEdge(vehicle, idx);
          return; // Exit function as we've moved to a new edge
        }

        const p1 = L.latLng(
          path[vehicle.pathIndex][1],
          path[vehicle.pathIndex][0]
        );
        const p2 = L.latLng(
          path[vehicle.pathIndex + 1][1],
          path[vehicle.pathIndex + 1][0]
        );
        vehicle.currentSegmentLength = p1.distanceTo(p2) || 1;
      }

      // If we've moved beyond the current segment, advance to next segment
      while (vehicle.distanceTraveled >= vehicle.currentSegmentLength) {
        // Move to next path segment
        vehicle.distanceTraveled -= vehicle.currentSegmentLength;
        vehicle.pathIndex++;

        // If we've reached the end of the current path
        if (vehicle.pathIndex >= path.length - 1) {
          // We've reached the end of this edge
          moveVehicleToNextEdge(vehicle, idx);
          return; // Exit function as we've moved to a new edge
        }

        // Calculate length of new segment
        const p1 = L.latLng(
          path[vehicle.pathIndex][1],
          path[vehicle.pathIndex][0]
        );
        const p2 = L.latLng(
          path[vehicle.pathIndex + 1][1],
          path[vehicle.pathIndex + 1][0]
        );
        vehicle.currentSegmentLength = p1.distanceTo(p2) || 1;
      }

      // Calculate progress within current segment
      const segmentProgress =
        vehicle.currentSegmentLength > 0
          ? vehicle.distanceTraveled / vehicle.currentSegmentLength
          : 0;

      // Interpolate position
      const start = path[vehicle.pathIndex];
      const end = path[vehicle.pathIndex + 1];

      vehicle.lng = start[0] + (end[0] - start[0]) * segmentProgress;
      vehicle.lat = start[1] + (end[1] - start[1]) * segmentProgress;

      // Update marker position
      if (
        vehicleMarkersRef.current[idx] &&
        vehicleMarkersRef.current[idx].marker
      ) {
        vehicleMarkersRef.current[idx].marker.setLatLng([
          vehicle.lat,
          vehicle.lng,
        ]);

        // Update trail if necessary
        updateVehicleTrail(vehicle, idx);
      }
    } catch (err) {
      console.error("Error updating vehicle position:", err);
    }
  };

  // Update the vehicle's trail visualization
  const updateVehicleTrail = (vehicle, idx) => {
    try {
      // Only add a new trail point occasionally to avoid too many points
      if (Math.random() < 0.1) {
        vehicle.trail.push({ lat: vehicle.lat, lng: vehicle.lng });
        if (vehicle.trail.length > 5) vehicle.trail.shift();

        // If we have enough points for a trail
        if (vehicle.trail.length > 1) {
          // Remove old trail
          if (vehicleMarkersRef.current[idx].trail) {
            mapInstanceRef.current.removeLayer(
              vehicleMarkersRef.current[idx].trail
            );
          }

          // Create new trail
          const trailPoints = vehicle.trail.map((p) => [p.lat, p.lng]);
          trailPoints.push([vehicle.lat, vehicle.lng]);

          vehicleMarkersRef.current[idx].trail = L.polyline(trailPoints, {
            color: vehicle.color,
            weight: 2,
            opacity: 0.4,
          }).addTo(mapInstanceRef.current);
        }
      }
    } catch (err) {
      console.error("Error updating trail:", err);
    }
  };

  // Move vehicle to the next edge in its route
  const moveVehicleToNextEdge = (vehicle, idx) => {
    try {
      // If vehicle has a planned route, follow it
      if (vehicle.plannedRoute && vehicle.plannedRoute.length > 0) {
        // Increment route index
        vehicle.routeIndex++;

        // If we've reached the end of the planned route, plan a new route
        if (vehicle.routeIndex >= vehicle.plannedRoute.length) {
          vehicle.plannedRoute = planRoute(vehicle, 5);
          vehicle.routeIndex = 0;
        }

        // Get the next edge from the route
        if (vehicle.routeIndex < vehicle.plannedRoute.length) {
          const nextEdgeIdx = vehicle.plannedRoute[vehicle.routeIndex];
          const nextEdge = networkGraphRef.current.edges[nextEdgeIdx];

          if (
            nextEdge &&
            nextEdge.feature &&
            nextEdge.feature.geometry &&
            nextEdge.feature.geometry.coordinates &&
            nextEdge.feature.geometry.coordinates.length >= 2
          ) {
            // Add current position to trail
            vehicle.trail.push({ lat: vehicle.lat, lng: vehicle.lng });
            if (vehicle.trail.length > 5) vehicle.trail.shift();

            // Switch to next edge
            vehicle.currentEdge = nextEdgeIdx;
            vehicle.pathIndex = 0;
            vehicle.distanceTraveled = 0;
            vehicle.currentSegmentLength = 0;

            // Set position to start of new edge
            const path = nextEdge.feature.geometry.coordinates;
            vehicle.lng = path[0][0];
            vehicle.lat = path[0][1];

            return;
          }
        }
      }

      // If we get here, something went wrong with the route plan
      // Choose a random edge
      vehicle.currentEdge = Math.floor(
        Math.random() * networkGraphRef.current.edges.length
      );
      vehicle.pathIndex = 0;
      vehicle.distanceTraveled = 0;
      vehicle.currentSegmentLength = 0;
      vehicle.plannedRoute = [vehicle.currentEdge];
      vehicle.routeIndex = 0;

      const randomEdge = networkGraphRef.current.edges[vehicle.currentEdge];
      if (
        randomEdge &&
        randomEdge.feature &&
        randomEdge.feature.geometry &&
        randomEdge.feature.geometry.coordinates &&
        randomEdge.feature.geometry.coordinates.length >= 2
      ) {
        // Set position to start of new edge
        const path = randomEdge.feature.geometry.coordinates;
        vehicle.lng = path[0][0];
        vehicle.lat = path[0][1];
      }
    } catch (err) {
      console.error("Error moving vehicle to next edge:", err);

      // Fallback: reset vehicle to a random position
      try {
        if (
          networkGraphRef.current &&
          networkGraphRef.current.edges.length > 0
        ) {
          const randomEdgeIdx = Math.floor(
            Math.random() * networkGraphRef.current.edges.length
          );
          const randomEdge = networkGraphRef.current.edges[randomEdgeIdx];
          if (
            randomEdge &&
            randomEdge.feature &&
            randomEdge.feature.geometry.coordinates
          ) {
            const path = randomEdge.feature.geometry.coordinates;
            if (path && path.length >= 2) {
              vehicle.currentEdge = randomEdgeIdx;
              vehicle.pathIndex = 0;
              vehicle.distanceTraveled = 0;
              vehicle.currentSegmentLength = 0;
              vehicle.lng = path[0][0];
              vehicle.lat = path[0][1];
            }
          }
        }
      } catch (innerErr) {
        console.error("Fallback error:", innerErr);
      }
    }
  };

  // Start animation loop
  const startAnimation = () => {
    log("Starting animation...");
    lastTimestampRef.current = performance.now();

    const animate = (timestamp) => {
      try {
        updateVehicles(timestamp);
        animationFrameIdRef.current = requestAnimationFrame(animate);
      } catch (err) {
        log("Animation error: " + err.message);
        console.error("Animation error:", err);
        // Don't stop animation on error, try to continue
        animationFrameIdRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
  };

  // Stop animation loop
  const stopAnimation = () => {
    log("Stopping animation...");
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  // React to changes in simulationActive
  useEffect(() => {
    if (simulationActive && !animationFrameIdRef.current) {
      startAnimation();
    } else if (!simulationActive && animationFrameIdRef.current) {
      stopAnimation();
    }
  }, [simulationActive]);

  // React to changes in speedFactor
  useEffect(() => {
    // No need to do anything special, the animation loop uses the current speedFactor
  }, [speedFactor]);

  return (
    <div
      ref={mapRef}
      className="traffic-map"
      style={{ height: "100vh", width: "100%" }}
    />
  );
};
