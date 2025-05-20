#!/usr/bin/env python3

import os
import sys
import json
import argparse
import xml.etree.ElementTree as ET
from typing import Dict, List, Any
from collections import defaultdict
from pyproj import Transformer

def parse_traffic_signals(root):
    """Extract traffic signals from XML data."""
    signals = []
    
    # Find all traffic signals (could be junctions with type="traffic_light" or nodes with specific tags)
    for junction in root.findall(".//junction[@type='traffic_light']"):
        junction_id = junction.get('id')
        x = float(junction.get('x', 0))
        y = float(junction.get('y', 0))
        
        # Get coordinates (might need conversion depending on projection)
        signals.append({
            'id': junction_id,
            'type': 'traffic_light',
            'coordinates': [x, y],
            'properties': {
                'id': junction_id,
                'type': 'traffic_light'
            }
        })
    
    # Also look for nodes that might be traffic signals
    for node in root.findall(".//node"):
        is_signal = False
        signal_props = {'id': node.get('id')}
        
        for tag in node.findall("tag"):
            k = tag.get('k')
            v = tag.get('v')
            
            if (k == 'highway' and v == 'traffic_signals') or (k == 'traffic_signals'):
                is_signal = True
            
            if k.startswith('traffic_signals:'):
                signal_props[k] = v
        
        if is_signal:
            x = float(node.get('x', 0))
            y = float(node.get('y', 0))
            signals.append({
                'id': node.get('id'),
                'type': 'traffic_signal',
                'coordinates': [x, y],
                'properties': signal_props
            })
    
    return signals

def parse_edge_metadata(root):
    """Extract metadata for edges/roads."""
    edge_metadata = {}
    
    for edge in root.findall(".//edge"):
        edge_id = edge.get('id')
        if edge_id is None or edge.get('function') == 'internal':
            continue
        
        # Get basic metadata
        edge_data = {
            'id': edge_id,
            'from': edge.get('from'),
            'to': edge.get('to'),
            'name': edge.get('name', ''),
            'priority': edge.get('priority'),
            'type': edge.get('type'),
            'lanes': []
        }
        
        # Add all attributes
        for attr in edge.attrib:
            edge_data[attr] = edge.get(attr)
        
        # Get lane information
        for lane in edge.findall('lane'):
            lane_data = {
                'id': lane.get('id'),
                'index': lane.get('index'),
                'speed': lane.get('speed'),
                'length': lane.get('length'),
                'shape': lane.get('shape')
            }
            
            # Add all lane attributes
            for attr in lane.attrib:
                lane_data[attr] = lane.get(attr)
            
            edge_data['lanes'].append(lane_data)
        
        edge_metadata[edge_id] = edge_data
    
    return edge_metadata

def parse_shapes(shape_str):
    """Parse SUMO shape strings into coordinate arrays."""
    if not shape_str:
        return []
    
    coords = []
    for point in shape_str.split():
        x, y = point.split(',')
        coords.append([float(x), float(y)])
    
    return coords

def convert_to_geo_coords(coords, net_offset, proj_params=None):
    """Convert from network coordinates to geo coordinates if needed."""
    if not coords:
        return coords
    
    if not proj_params:
        print("Warning: No projection parameters provided, coordinates may be inaccurate", file=sys.stderr)
        return coords
    
    try:
        # Create transformer from the provided projection to WGS84
        transformer = Transformer.from_proj(proj_params, "+proj=longlat +datum=WGS84", always_xy=True)
        
        transformed_coords = []
        for x, y in coords:
            # First apply the network offset
            if net_offset:
                x = x + net_offset[0]
                y = y + net_offset[1]
            
            # Transform from UTM to geographic coordinates
            lon, lat = transformer.transform(x, y)
            transformed_coords.append([lon, lat])
            
            # Debug output for first coordinate
            if len(transformed_coords) == 1:
                print(f"Debug: Original coords with offset: {[x, y]}")
                print(f"Debug: After transformation: ({lon}, {lat})")
        
        return transformed_coords
    except Exception as e:
        print(f"Warning: Coordinate transformation failed: {str(e)}", file=sys.stderr)
        return coords

def xml_to_geojson(xml_file, output_file, include_signals=True):
    """Convert XML file to GeoJSON with all metadata preserved."""
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
    except Exception as e:
        print(f"Error parsing XML: {str(e)}", file=sys.stderr)
        return False
    
    # Extract projection info if available
    net_offset = None
    projection = None
    orig_bounds = None
    
    location = root.find('location')
    if location is not None:
        if 'netOffset' in location.attrib:
            offset = location.get('netOffset').split(',')
            net_offset = (float(offset[0]), float(offset[1]))
        
        if 'projParameter' in location.attrib:
            projection = location.get('projParameter')
            
        if 'origBoundary' in location.attrib:
            bounds = location.get('origBoundary').split(',')
            if len(bounds) == 4:
                orig_bounds = {
                    'min_lon': float(bounds[0]),
                    'min_lat': float(bounds[1]),
                    'max_lon': float(bounds[2]),
                    'max_lat': float(bounds[3])
                }
    
    # Get edge metadata
    edge_metadata = parse_edge_metadata(root)
    
    # Get traffic signals if requested
    signals = []
    if include_signals:
        signals = parse_traffic_signals(root)
    
    # Create GeoJSON feature collection
    geojson = {
        "type": "FeatureCollection",
        "features": [],
        "metadata": {
            "projection": projection,
            "original_bounds": orig_bounds
        }
    }
    
    # Add edges as LineString features
    for edge_id, edge_data in edge_metadata.items():
        for lane in edge_data.get('lanes', []):
            shape_str = lane.get('shape')
            
            if shape_str:
                coords = parse_shapes(shape_str)
                if net_offset:
                    coords = convert_to_geo_coords(coords, net_offset, projection)
                
                if not coords or len(coords) < 2:
                    continue
                
                # Create feature for this lane
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coords
                    },
                    "properties": {
                        "id": lane.get('id'),
                        "edge_id": edge_id,
                        "lane_index": lane.get('index'),
                        "speed": lane.get('speed'),
                        "length": lane.get('length'),
                        "road_name": edge_data.get('name', ''),
                        "from_node": edge_data.get('from'),
                        "to_node": edge_data.get('to'),
                        "road_type": edge_data.get('type'),
                        "priority": edge_data.get('priority'),
                        "allowed": lane.get('allow'),
                        "disallowed": lane.get('disallow'),
                        "direction": get_direction(coords)
                    }
                }
                
                # Add all edge metadata
                for key, value in edge_data.items():
                    if key not in ['lanes', 'id', 'from', 'to', 'name', 'type', 'priority']:
                        feature["properties"][f"edge_{key}"] = value
                
                # Add all lane metadata
                for key, value in lane.items():
                    if key not in ['id', 'index', 'speed', 'length', 'shape', 'allow', 'disallow']:
                        feature["properties"][f"lane_{key}"] = value
                
                geojson["features"].append(feature)
    
    # Add traffic signals as Point features
    for signal in signals:
        coords = signal['coordinates']
        
        if net_offset:
            coords = convert_to_geo_coords([coords], net_offset, projection)[0]
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": coords
            },
            "properties": signal['properties']
        }
        feature["properties"]["signal_type"] = signal['type']
        
        geojson["features"].append(feature)
    
    # Write to output file
    try:
        with open(output_file, 'w') as f:
            json.dump(geojson, f, indent=2)
        return True
    except Exception as e:
        print(f"Error writing GeoJSON: {str(e)}", file=sys.stderr)
        return False

def get_direction(coords):
    """Calculate the overall direction of a line."""
    if len(coords) < 2:
        return "unknown"
    
    start = coords[0]
    end = coords[-1]
    
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    
    # Simple 8-point compass
    if abs(dx) > abs(dy) * 2:
        return "east" if dx > 0 else "west"
    elif abs(dy) > abs(dx) * 2:
        return "north" if dy > 0 else "south"
    else:
        if dx > 0 and dy > 0:
            return "northeast"
        elif dx > 0 and dy < 0:
            return "southeast"
        elif dx < 0 and dy > 0:
            return "northwest"
        elif dx < 0 and dy < 0:
            return "southwest"
        else:
            return "unknown"

def parse_args():
    parser = argparse.ArgumentParser(description='Convert XML file to GeoJSON with metadata')
    parser.add_argument('--input', '-i', required=True, help='Input XML file')
    parser.add_argument('--output', '-o', required=True, help='Output GeoJSON file')
    parser.add_argument('--signals', '-s', action='store_true', help='Include traffic signals')
    return parser.parse_args()

def main():
    args = parse_args()
    
    if not os.path.isfile(args.input):
        print(f"Error: Input file {args.input} does not exist", file=sys.stderr)
        return 1
    
    # Temporarily disable signals until coordinate issues are fixed
    include_signals = False
    
    success = xml_to_geojson(args.input, args.output, include_signals)
    if success:
        print(f"Successfully converted {args.input} to {args.output}")
        return 0
    else:
        print(f"Failed to convert {args.input}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
