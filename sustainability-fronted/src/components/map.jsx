import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const treeIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/427/427735.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function MapComponent({ activeButton }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);

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

    L.marker([51.505, -0.09]).addTo(map)
      .bindPopup('A sample marker!')
      .openPopup();

    // Click handler zum Baum pflanzen
    function onMapClick(e) {
      if (activeButton === 'baum') {
        const marker = L.marker(e.latlng, { icon: treeIcon }).addTo(map);
        markersRef.current.push(marker);
      }
    }

    map.on('click', onMapClick);

    return () => {
      map.off('click', onMapClick);
      markersRef.current.forEach(marker => map.removeLayer(marker));
      markersRef.current = [];
      map.remove();
    };
  }, [activeButton]); // Neu initialisieren, wenn sich activeButton ändert

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#ffffff', // white background for the page
      }}
    >
      <div
        id="map"
        style={{
          height: '500px',
          width: '700px',
          boxShadow: '0 0 15px rgba(0,0,0,0.1)',
          borderRadius: '9px',
        }}
      />
    </div>
  );
}

export default MapComponent;

