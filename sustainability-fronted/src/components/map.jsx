import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf'; // Für Geometrie-Prüfung


const treeIcon = L.icon({
  iconUrl: 'https://symbl-cdn.com/i/webp/58/20ee459c4c89d508400f762cf79392.webp',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function MapComponent({ activeButton }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const activeButtonRef = useRef(activeButton); // <- Ref für aktuellen Button

  // Speichere den aktuellen Button-Wert immer aktuell ab
  useEffect(() => {
    activeButtonRef.current = activeButton;

    if (activeButton === 'delete') {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    }
  }, [activeButton]);

  useEffect(() => {
    const map = L.map('map', {
      center: [51.505, -0.09],
      zoom: 13,
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

    L.marker([51.505, -0.09])
      .addTo(map)
      .bindPopup('A sample marker!')
      .openPopup();

    // Verwende die Ref in der Click-Funktion
    function onMapClick(e) {
      if (activeButtonRef.current === 'baum') {
        const marker = L.marker(e.latlng, { icon: treeIcon }).addTo(map);
        markersRef.current.push(marker);
      }
    }

    map.on('click', onMapClick);

    return () => {
      map.off('click', onMapClick);
      map.remove();
    };
  }, []);

  return <div id="map" />;
}

export default MapComponent;
