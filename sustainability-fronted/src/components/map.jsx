import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';

let clickPoint  = [0, 0];
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

  useEffect(() => {
    activeButtonRef.current = activeButton;

    if (activeButton === 'delete') {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      //setStartPoint(null);
      //setEndPoint(null);
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
    }
    
  }, [activeButton]);

  useEffect(() => {
    async function initMap() {
      const map = L.map('map', {
        center: [47.726, 10.312],
        zoom: 14,
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

      try {
        const response = await fetch('/map.geojson');
        const geojson = await response.json();

        greenRoutesRef.current = geojson.features;

        const geoJsonLayer = L.geoJSON(geojson, {
          style: {
            color: 'green',
            weight: 4,
            opacity: 0.7,
          },
        }).addTo(map);

        map.fitBounds(geoJsonLayer.getBounds());

        const buffers = geojson.features.map((feature) => {
          const geom = feature.geometry;
          if (geom.type === 'LineString') {
            return turf.buffer(turf.lineString(geom.coordinates), 20, { units: 'meters' });
          } else if (geom.type === 'MultiLineString') {
            const lineBuffers = geom.coordinates.map(coords => turf.buffer(turf.lineString(coords), 20, { units: 'meters' }));
            return lineBuffers.reduce((acc, buf) => (acc ? turf.union(acc, buf) : buf), null);
          }
          return null;
        }).filter(Boolean);

        streetBufferRef.current = buffers.reduce((acc, buf) => (acc ? turf.union(acc, buf) : buf), null);

      } catch (err) {
        console.error('Failed to load GeoJSON:', err);
      }

      L.marker([47.726, 10.312])
        .addTo(map)
        .bindPopup('Kempten City Center')
        .openPopup();

      function onMapClick(e) {
        const map = mapRef.current;

        if (activeButtonRef.current === 'baum') {
            const marker = L.marker(e.latlng, { icon: treeIcon }).addTo(map);
            markersRef.current.push(marker);
            clickPoint = [e.latlng.lng, e.latlng.lat];
            console.log('Start point set:'+  clickPoint);
            
          
        
          
        }

        if (activeButtonRef.current === 'route') {
            // Nur reagieren, wenn Start- oder Endpunkt noch nicht gesetzt
            if (!startPointRef.current || !endPointRef.current) {
              const isStart = !startPointRef.current;
              const marker = L.marker(e.latlng, {
                icon: isStart ? startIcon : endIcon,
              }).addTo(map);
          
              if (isStart) {
                startPointRef.current = [e.latlng.lng, e.latlng.lat];
                console.log('Start point set:'+ startPointRef.current);
              } else {
                endPointRef.current = [e.latlng.lng, e.latlng.lat];
                console.log('End point set:'+ endPointRef.current);
              }
          
              markersRef.current.push(marker);
            }
          }
          
      }

      map.on('click', onMapClick);

      return () => {
        map.off('click', onMapClick);
        map.remove();
      };
    }

    initMap();
  }, []);

  useEffect(() => {
    if (
      startPointRef.current &&
      endPointRef.current &&
      greenRoutesRef.current.length > 0 &&
      mapRef.current
    ) {
      const lineStrings = greenRoutesRef.current.map(f => f.geometry).flatMap(geom => {
        if (geom.type === 'LineString') return [turf.lineString(geom.coordinates)];
        if (geom.type === 'MultiLineString') return geom.coordinates.map(coords => turf.lineString(coords));
        return [];
      });
  
      const combined = turf.featureCollection(lineStrings);
      const options = { units: 'meters' };
  
      const route = turf.shortestPath(
        turf.point(startPointRef.current),
        turf.point(endPointRef.current),
        combined,
        options
      );
  
      if (route && route.geometry && route.geometry.coordinates.length > 1) {
        if (routeLayerRef.current) {
          routeLayerRef.current.remove();
        }
        routeLayerRef.current = L.geoJSON(route, {
          style: {
            color: 'blue',
            weight: 5,
            opacity: 0.8,
          },
        }).addTo(mapRef.current);
      }
    }
  }, [greenRoutesRef.current]);
  

  return <div id="map" style={{ height: '100%', width: '100%' }} />;
}

export default MapComponent;
