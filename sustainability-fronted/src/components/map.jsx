import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapComponent({ activeButton }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const activeButtonRef = useRef(activeButton);

  useEffect(() => {
    activeButtonRef.current = activeButton;
    if (activeButton === 'delete') {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
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

    fetch('/map.geojson')
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

    let currentSegment = 0; 
    let progress = 0; 

    const marker = L.circleMarker([fixedCoords[0][1], fixedCoords[0][0]], {
      radius: 3,
      color: 'green',
      fillColor: 'green',
      fillOpacity: 1,
    }).addTo(map);

    markersRef.current.push(marker);

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

    
      console.log('Marker bewegt sich zu:', interpLat, interpLng);

      marker.setLatLng([interpLat, interpLng]);

      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  return <div id="map" style={{ height: '100vh', width: '100%' }} />;
}

export default MapComponent;
