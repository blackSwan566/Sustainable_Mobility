import requests
import polyline
import json
import os
import dotenv
import pandas as pd

dotenv.load_dotenv()

# -------------------
# CONFIG
# -------------------
API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
if not API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY not found in environment. Please set it in your .env file.")

# Replace the hardcoded waypoints with CSV data
df = pd.read_csv('./temp/csv/route_waypoints.csv')
waypoints = [
    {"location": {"latLng": {"latitude": lat, "longitude": lon}}} 
    for lat, lon in zip(df['lat'], df['lon'])
]

# Use first and last points as origin/destination
origin1 = {"location": {"latLng": {"latitude": df['lat'].iloc[0], "longitude": df['lon'].iloc[0]}}}
destination1 = {"location": {"latLng": {"latitude": df['lat'].iloc[-1], "longitude": df['lon'].iloc[-1]}}}

# -------------------
# Function to make the Directions API request and process the response
# -------------------
def get_traffic_geojson(origin, destination, waypoints=None):
    url = 'https://routes.googleapis.com/directions/v2:computeRoutes'
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals'
    }

    body = {
        "origin": origin,
        "destination": destination,
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "extraComputations": ["TRAFFIC_ON_POLYLINE"],
        "languageCode": "de-DE",
        "units": "METRIC"
    }

    if waypoints:
        body["intermediates"] = waypoints

    response = requests.post(url, headers=headers, json=body)
    data = response.json()
    print(f"API Response:", json.dumps(data, indent=2))  # Debug print

    if 'routes' in data and data['routes']:
        route = data['routes'][0]
        poly = route['polyline']['encodedPolyline']
        coords = polyline.decode(poly)
        intervals = route['travelAdvisory'].get('speedReadingIntervals', [])

        features = []
        for interval in intervals:
            start = interval['startPolylinePointIndex']
            end = interval['endPolylinePointIndex']
            segment_coords = coords[start:end + 1]

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[lng, lat] for lat, lng in segment_coords]
                },
                "properties": {
                    "speed": interval['speed'],
                    "color": speed_colors.get(interval['speed'], "#808080")  # Default to grey if speed is unknown
                }
            }
            features.append(feature)

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        return geojson
    else:
        print(f"Error: No routes found")
        return None

# -------------------
# TRAFFIC COLORS
# -------------------
speed_colors = {
    "TRAFFIC_JAM": "#FF0000",
    "SLOW": "#FFA500",
    "NORMAL": "#00FF00",
    "UNKNOWN_SPEED": "#808080"
}

# -------------------
# GET TRAFFIC DATA FOR ALL ROUTES
# -------------------
geojson_forward = get_traffic_geojson(origin1, destination1, waypoints)

# -------------------
# EXPORT GEOJSON DATA
# -------------------
if geojson_forward:
    with open('temp/geojson/traffic_route.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson_forward, f, ensure_ascii=False, indent=2)
    print("✔️ GeoJSON exported: traffic_route.geojson")