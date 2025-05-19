// src/components/MapComponent.jsx
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';

function MapComponent() {
    useEffect(() => {
        const map = L.map('map', {
            center: [51.505, -0.09],
            zoom: 13,
            scrollWheelZoom: true,
        });

        // Light mode 
        L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            {
                attribution:
                    '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
                maxZoom: 19,
            }
        ).addTo(map);


        fetch('/map.geojson')
            .then((response) => response.json())
            .then((geojson) => {
                const geoJsonLayer = L.geoJSON(geojson, {
                    style: {
                        color: 'blue',
                        weight: 4,
                        opacity: 0.7,
                    },
                }).addTo(map);

                map.fitBounds(geoJsonLayer.getBounds());
            })
            .catch((err) => {
                console.error('Failed to load GeoJSON:', err);
            });

        return () => map.remove();
    }, []);

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                width: '100vw',
                backgroundColor: '#ffffff',
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
