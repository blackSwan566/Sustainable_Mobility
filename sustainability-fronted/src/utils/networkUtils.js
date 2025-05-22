import L from "leaflet";

export const calculatePathLength = (coordinates) => {
  let length = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const p1 = L.latLng(coordinates[i - 1][1], coordinates[i - 1][0]);
    const p2 = L.latLng(coordinates[i][1], coordinates[i][0]);
    length += p1.distanceTo(p2);
  }
  return Math.max(length, 1);
};

export const buildNetworkGraph = (data) => {
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

  return graph;
};

export const generateRandomPath = (graph, length) => {
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
