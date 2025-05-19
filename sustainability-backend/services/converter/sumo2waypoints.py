import sumolib
import pandas as pd
from pathlib import Path

# Define paths relative to project structure
NET_XML = Path("temp/xml/map.net.xml")
CSV_OUT = Path("temp/csv/route_sections.csv")

def main():
    try:
        net = sumolib.net.readNet(str(NET_XML))
        segments = []

        for edge in net.getEdges():
            shape = edge.getShape()
            if len(shape) < 2:
                continue  # skip degenerate edges

            # Get edge ID as identifier
            edge_id = edge.getID()

            # Get first and last points of the edge
            x1, y1 = shape[0]  # First point
            x2, y2 = shape[-1]  # Last point
            
            # Convert to lat/lon
            start_lat, start_lon = net.convertXY2LonLat(x1, y1)
            end_lat, end_lon = net.convertXY2LonLat(x2, y2)

            segments.append({
                "edge_id": edge_id,
                "start_lat": start_lat,
                "start_lon": start_lon,
                "end_lat": end_lat,
                "end_lon": end_lon
            })

        # Convert to DataFrame
        df = pd.DataFrame(segments)

        # Save to CSV
        CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(CSV_OUT, index=False)

        print(f"✔️ Extracted {len(df)} street sections from: {NET_XML}")
        print(f"✔️ Saved to: {CSV_OUT}")

    except Exception as e:
        print(f"❌ Error processing SUMO network: {e}")

if __name__ == "__main__":
    main()