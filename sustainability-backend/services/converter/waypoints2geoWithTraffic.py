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
    for lat, lon in zip(df['lat'].iloc[1:-1], df['lon'].iloc[1:-1])  # Exclude first and last points
]

# Use first and last points as origin/destination
origin1 = {"location": {"latLng": {"latitude": df['lat'].iloc[0], "longitude": df['lon'].iloc[0]}}}
destination1 = {"location": {"latLng": {"latitude": df['lat'].iloc[-1], "longitude": df['lon'].iloc[-1]}}}

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
# Function to make the Directions API request and process the response
# -------------------
def get_traffic_geojson(origin, destination, waypoints=None):
    url = 'https://routes.googleapis.com/directions/v2:computeRoutes'
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.travelAdvisory'
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

    try:
        response = requests.post(url, headers=headers, json=body)
        response.raise_for_status()  # Raise an exception for bad status codes
        data = response.json()
        
        if 'routes' not in data or not data['routes']:
            print("No routes found in response")
            print("API Response:", json.dumps(data, indent=2))
            return None

        route = data['routes'][0]
        encoded_poly = route['polyline']['encodedPolyline']
        coords = polyline.decode(encoded_poly)

        # Create a single feature for the entire route
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[lng, lat] for lat, lng in coords]
            },
            "properties": {
                "speed": "NORMAL",  # Default speed
                "color": speed_colors["NORMAL"]  # Default color
            }
        }

        # If traffic advisory information is available, use it
        if 'travelAdvisory' in route:
            traffic_info = route['travelAdvisory']
            if 'speedReadingIntervals' in traffic_info:
                # Update the feature's properties based on the predominant traffic condition
                speeds = [interval.get('speed', 'UNKNOWN_SPEED') 
                         for interval in traffic_info['speedReadingIntervals']]
                predominant_speed = max(set(speeds), key=speeds.count)
                feature['properties']['speed'] = predominant_speed
                feature['properties']['color'] = speed_colors.get(predominant_speed, speed_colors['UNKNOWN_SPEED'])

        geojson = {
            "type": "FeatureCollection",
            "features": [feature]
        }
        
        return geojson

    except requests.exceptions.RequestException as e:
        print(f"Error making request: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print("API Error Response:", e.response.text)
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

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
else:
    print("❌ Failed to generate GeoJSON")