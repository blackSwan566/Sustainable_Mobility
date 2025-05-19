import requests
import polyline
import json
import os
import dotenv

dotenv.load_dotenv()

# -------------------
# CONFIG
# -------------------
API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
if not API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY not found in environment. Please set it in your .env file.")

# Define coordinates as separate lat/lng pairs
origin1 = {"location": {"latLng": {"latitude": 47.734050, "longitude": 10.324509}}}
destination1 = {"location": {"latLng": {"latitude": 47.734050, "longitude": 10.324509}}}

# New routes
origin2 = {"location": {"latLng": {"latitude": 47.723868, "longitude": 10.311128}}}
destination2 = {"location": {"latLng": {"latitude": 47.735134, "longitude": 10.309653}}}

origin3 = {"location": {"latLng": {"latitude": 47.717655, "longitude": 10.299065}}}
destination3 = {"location": {"latLng": {"latitude": 47.733896, "longitude": 10.324935}}}

waypoints = [
    {"location": {"latLng": {"latitude": 47.722866, "longitude": 10.333782}}},
    {"location": {"latLng": {"latitude": 47.717717, "longitude": 10.298916}}}, 
    {"location": {"latLng": {"latitude": 47.729799, "longitude": 10.304660}}},
]

waypoints_route3 = [
    {"location": {"latLng": {"latitude": 47.724745, "longitude": 10.322192}}}
]

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
geojson_route2 = get_traffic_geojson(origin2, destination2)
geojson_route3 = get_traffic_geojson(origin3, destination3, waypoints_route3)

# -------------------
# EXPORT GEOJSON DATA
# -------------------
if geojson_forward:
    with open('traffic_route_forward_with_stops.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson_forward, f, ensure_ascii=False, indent=2)
    print("✔️ GeoJSON (forward with stops) exportiert: traffic_route_1.geojson")

if geojson_route2:
    with open('traffic_route_2.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson_route2, f, ensure_ascii=False, indent=2)
    print("✔️ GeoJSON (route 2) exportiert: traffic_route_2.geojson")

if geojson_route3:
    with open('traffic_route_3.geojson', 'w', encoding='utf-8') as f:
        json.dump(geojson_route3, f, ensure_ascii=False, indent=2)
    print("✔️ GeoJSON (route 3) exportiert: traffic_route_3.geojson")