import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';

let clickPoint = [0, 0];

const treeIcon = L.icon({
  iconUrl: 'https://symbl-cdn.com/i/webp/dd/8b7f393a72b7705da89b5b87a1d340.webp',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const startIcon = L.icon({
  iconUrl: 'https://em-content.zobj.net/source/apple/76/round-pushpin_1f4cd.png',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

const endIcon = L.icon({
  iconUrl: 'https://em-content.zobj.net/source/apple/76/chequered-flag_1f3c1.png',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

function MapComponent({ activeButton }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const activeButtonRef = useRef(activeButton);
  const streetBufferRef = useRef(null);
  const greenRoutesRef = useRef([]);
  const startPointRef = useRef(null);
  const endPointRef = useRef(null);
  const routeLayerRef = useRef(null);

  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);

  useEffect(() => {
    activeButtonRef.current = activeButton;
    if (activeButton === 'delete') {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      setStartPoint(null);
      setEndPoint(null);
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
    }
  }, [activeButton]);

  useEffect(() => {
    const map = L.map('map', {
      center: [47.72884553654769, 10.315794113938306],
      zoom: 19,
      scrollWheelZoom: true,
    });

    mapRef.current = map;

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
        maxZoom: 19,
      }
    ).addTo(map);

    fetch('/map4.geojson')
      .then(res => res.json())
      .then((geojson) => {
        geojson.features.forEach((feature) => {
          if (feature.geometry.type === 'LineString') {
            animateAlongCoordinates(feature.geometry.coordinates, parseFloat(feature.properties.speed));
          }
        });
      })
      .catch(err => console.error('GeoJSON loading error:', err));

    return () => {
      map.remove();
    };
  }, []);

  const distanceMeters = ([lng1, lat1], [lng2, lat2]) => {
    return mapRef.current
      ? mapRef.current.distance([lat1, lng1], [lat2, lng2])
      : 0;
  };

  function animateAlongCoordinates(coords, speed) {
    if (!coords || coords.length < 2) return;

    function isLatLng(coord) {
      return coord[0] > 45 && coord[0] < 50 && coord[1] > 9 && coord[1] < 13;
    }

    let fixedCoords = coords;
    if (isLatLng(coords[0])) {
      fixedCoords = coords.map(([lat, lng]) => [lng, lat]);
    }

    const map = mapRef.current;
    let marker = L.circleMarker([fixedCoords[0][1], fixedCoords[0][0]], {
      radius: 5,
      color: 'red',
      fillColor: 'red',
      fillOpacity: 1,
    }).addTo(map);

    let currentSegment = 0;
    let progress = 0;
    let lastTimestamp = null;

    function step(timestamp) {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const start = fixedCoords[currentSegment];
      const end = fixedCoords[currentSegment + 1];
      const segmentLength = distanceMeters(start, end);
      const distanceToMove = speed * delta;
      const segmentProgressMeters = progress * segmentLength + distanceToMove;

      if (segmentProgressMeters >= segmentLength) {
        currentSegment++;
        if (currentSegment >= fixedCoords.length - 1) {
          currentSegment = 0;
        }
        progress = 0;
      } else {
        progress = segmentProgressMeters / segmentLength;
      }

      const interpLng = start[0] + (end[0] - start[0]) * progress;
      const interpLat = start[1] + (end[1] - start[1]) * progress;

      marker.setLatLng([interpLat, interpLng]);
      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

    map.on('click', (e) => {
      if (activeButtonRef.current === 'baum') {
        const newMarker = L.marker(e.latlng, { icon: treeIcon }).addTo(map);
        markersRef.current.push(newMarker);
        clickPoint = turf.point([e.latlng.lng, e.latlng.lat]);
      }

      if (activeButtonRef.current === 'route') {
        const icon = !startPoint ? startIcon : endIcon;
        const newMarker = L.marker(e.latlng, { icon }).addTo(map);
        markersRef.current.push(newMarker);

        if (!startPoint) {
          setStartPoint([e.latlng.lng, e.latlng.lat]);
        } else if (!endPoint) {
          setEndPoint([e.latlng.lng, e.latlng.lat]);
        }
      }
    });
  }

  useEffect(() => {
    if (startPoint && endPoint && greenRoutesRef.current.length > 0 && mapRef.current) {
      const lineStrings = greenRoutesRef.current.map(f => f.geometry).flatMap(geom => {
        if (geom.type === 'LineString') return [turf.lineString(geom.coordinates)];
        if (geom.type === 'MultiLineString') return geom.coordinates.map(coords => turf.lineString(coords));
        return [];
      });

      const combined = turf.featureCollection(lineStrings);
      const route = turf.shortestPath(
        turf.point(startPoint),
        turf.point(endPoint),
        combined,
        { units: 'meters' }
      );

      if (route?.geometry?.coordinates?.length > 1) {
        if (routeLayerRef.current) {
          routeLayerRef.current.remove();
        }

        routeLayerRef.current = L.geoJSON(route, {
          style: { color: 'blue', weight: 5, opacity: 0.8 },
        }).addTo(mapRef.current);
      }
    }
  }, [startPoint, endPoint]);

  return <div id="map" style={{ height: '100vh', width: '100%' }} />;
}

export default MapComponent;
