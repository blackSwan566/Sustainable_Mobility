"""
Create <= 25 'smart' way-points from a GeoJSON route so that Google-Maps
reconstructs (almost) the same drive.

• critical nodes  = vertices kept by RDP simplification
• helper nodes    = midpoint of every edge between two critical nodes
"""
import geojson
from shapely.geometry import LineString, MultiLineString
from shapely.ops import linemerge
import numpy as np
import csv
from pathlib import Path

MAX_POINTS = 25                   # Google limit (start + end included)
TARGET_KNOTS = MAX_POINTS // 2    # ≈ ½ knots, ½ mid-points

GEOJSON_IN  = Path("temp/geojson/map.geojson")
CSV_OUT     = Path("temp/csv/route_waypoints.csv")


def rdp_simplify(line: LineString, target_pts: int) -> LineString:
    """
    Grow the tolerance until the simplified line has <= target_pts vertices.
    """
    tol = 1e-6                         # start very precise
    simplified = line
    while len(simplified.coords) > target_pts:
        tol *= 2                       # exponential search
        simplified = line.simplify(tol, preserve_topology=False)
    return simplified


def insert_midpoints(coords):
    """
    For every consecutive coordinate pair insert the midpoint.
    Returns [p0, m01, p1, m12, p2, …, pn]
    """
    out = []
    for i in range(len(coords) - 1):
        p1 = coords[i]
        p2 = coords[i + 1]
        out.append(p1)
        mid = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)
        out.append(mid)
    out.append(coords[-1])
    return out


def trim_to_max(points, max_points):
    """
    If we are above the hard limit drop the midpoints of the *shortest*
    segments first (their removal hurts the geometry least).
    """
    if len(points) <= max_points:
        return points

    # indices of all mid-points are odd: p0, m01, p1, m12, p2, …
    mid_idx = [i for i in range(1, len(points) - 1, 2)]
    # compute segment length between the surrounding knots
    seg_lengths = {
        idx: LineString([points[idx - 1], points[idx + 1]]).length
        for idx in mid_idx
    }
    # sort by increasing length  → remove shortest first
    for idx in sorted(seg_lengths, key=seg_lengths.get):
        points.pop(idx)
        if len(points) <= max_points:
            break
    return points


def main():
    # 1. read and merge
    with GEOJSON_IN.open("r") as f:
        fc = geojson.load(f)

    merged = linemerge([LineString(f["geometry"]["coordinates"])
                        for f in fc["features"]])

    # ──────────────────────────────────────────────────────────
    # linemerge can return a MultiLineString when the pieces
    # cannot be merged into one continuous line.  Turn the result
    # into a single LineString before we continue.
    # ──────────────────────────────────────────────────────────
    if isinstance(merged, MultiLineString):
        # Attempt to concatenate all parts head→tail
        try:
            all_coords = []
            for part in merged.geoms:
                if not all_coords:
                    all_coords.extend(part.coords)
                else:
                    # If the next part starts where the current ends,
                    # just continue; otherwise append regardless.
                    if all_coords[-1] == part.coords[0]:
                        all_coords.extend(part.coords[1:])
                    elif all_coords[-1] == part.coords[-1]:
                        all_coords.extend(reversed(part.coords[:-1]))
                    else:                # fallback – just glue them
                        all_coords.extend(part.coords)
            merged = LineString(all_coords)
        except Exception as e:           # still not possible? pick longest
            merged = max(merged.geoms, key=lambda ls: ls.length)

    # 2. pick the important knots
    knots = list(rdp_simplify(merged, TARGET_KNOTS).coords)

    # 3. add midpoints
    way_pts = insert_midpoints(knots)

    # 4. enforce hard limit of 25
    way_pts = trim_to_max(way_pts, MAX_POINTS)

    # 5. write CSV  (Google expects lat,lon in that order!)
    CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
    with CSV_OUT.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lat", "lon"])
        for lon, lat in way_pts:           # shapely is (x,y) == (lon,lat)
            w.writerow([lat, lon])

    # Optional console output
    for i, (lon, lat) in enumerate(way_pts, 1):
        print(f"{i:02}: lat={lat:.6f}, lon={lon:.6f}")


if __name__ == "__main__":
    main()