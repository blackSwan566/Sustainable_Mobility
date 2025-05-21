import L from "leaflet";

/**
 * Calculate distance between two coordinates in meters
 * @param {Array} coord1 - First coordinate [lng, lat]
 * @param {Array} coord2 - Second coordinate [lng, lat]
 * @returns {number} - Distance in meters
 */
export const coordDistanceMeters = (coord1, coord2) => {
  try {
    const latlng1 = L.latLng(coord1[1], coord1[0]);
    const latlng2 = L.latLng(coord2[1], coord2[0]);
    return latlng1.distanceTo(latlng2);
  } catch (err) {
    console.error("Error calculating distance:", err, coord1, coord2);
    return Infinity;
  }
};

/**
 * Calculate the length of a path in meters
 * @param {Array} coordinates - Array of coordinate pairs [lng, lat]
 * @returns {number} - Path length in meters
 */
export const calculatePathLength = (coordinates) => {
  try {
    let length = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const p1 = L.latLng(coordinates[i - 1][1], coordinates[i - 1][0]);
      const p2 = L.latLng(coordinates[i][1], coordinates[i][0]);
      length += p1.distanceTo(p2);
    }
    return Math.max(length, 1); // Ensure no zero lengths
  } catch (err) {
    console.error("Error calculating path length:", err);
    return 1; // Default to 1 meter to avoid division by zero
  }
};

/**
 * Find the closest node to a coordinate within a given distance
 * @param {Object} networkGraph - The network graph containing nodes
 * @param {Array} coord - Coordinate [lng, lat] to find closest node to
 * @param {number} maxDistance - Maximum distance in meters to consider
 * @returns {string|null} - Key of closest node or null if none found
 */
export const findClosestNode = (networkGraph, coord, maxDistance) => {
  let closest = null;
  let minDistance = maxDistance || Infinity;

  Object.keys(networkGraph.nodes).forEach((nodeKey) => {
    const node = networkGraph.nodes[nodeKey];
    const distance = coordDistanceMeters(
      [coord[0], coord[1]],
      [node.latlng[1], node.latlng[0]]
    );

    if (distance < minDistance) {
      minDistance = distance;
      closest = nodeKey;
    }
  });

  return closest;
};

/**
 * Generate a color based on road type
 * @param {Object} feature - GeoJSON feature with properties
 * @returns {string} - CSS color value
 */
export const getRoadColor = (feature) => {
  const edgeTypeColors = {
    "highway.primary": "#ff4444",
    "highway.secondary": "#44ff44",
    "highway.tertiary": "#4444ff",
    "highway.residential": "#ffaa44",
    "highway.service": "#44ffff",
    default: "#aaaaaa",
  };

  return feature && feature.properties && feature.properties.edge_type
    ? edgeTypeColors[feature.properties.edge_type] || edgeTypeColors.default
    : edgeTypeColors.default;
};
