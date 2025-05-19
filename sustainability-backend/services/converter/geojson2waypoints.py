import geojson
from shapely.geometry import LineString
from shapely.ops import linemerge
import numpy as np
import csv

# Load GeoJSON file
with open('temp/geojson/map.geojson', 'r') as f:
    data = geojson.load(f)

# Collect all coordinates into a single LineString
lines = [LineString(f['geometry']['coordinates']) for f in data['features']]
merged_line = linemerge(lines)

# Get total length of the path
total_length = merged_line.length

# Calculate number of points to sample (23 intermediate points + start + end = 25 total)
num_points = 23

# Generate evenly spaced points along the line
distances = np.linspace(0, total_length, num_points + 2)  # +2 for start/end points
waypoints = [merged_line.interpolate(distance) for distance in distances]

# Extract coordinates from points
waypoints_coords = [(point.x, point.y) for point in waypoints]

# Write to CSV
with open('temp/csv/route_waypoints.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['lat', 'lon'])
    for lon, lat in waypoints_coords:
        writer.writerow([lat, lon])

# Optional: Print waypoints for verification
for idx, (lon, lat) in enumerate(waypoints_coords):
    print(f"Waypoint {idx+1}: lat={lat}, lon={lon}")