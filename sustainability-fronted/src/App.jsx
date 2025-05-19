import React, { useState } from 'react';
import './App.css';
import MapComponent from './components/map';
import 'leaflet/dist/leaflet.css';

function App() {
  const [activeButton, setActiveButton] = useState(null);

  const handleBaumPflanzen = () => {
    console.log("Spielewiese statt Straße 🛝");
    setActiveButton('baum');
  };

  const handleSpurBlockieren = () => {
    console.log("Baum pflanzen (und eine Spur blockieren) 🌳 ");
    setActiveButton('spur');
  };

  const handleAmpelUmschalten = () => {
    console.log("Ampel-Schaltung 🚦");
    setActiveButton('ampel');
  };

  return (
    <div className="app-container">
      <div className="map-wrapper">
        <h1 className="headline">KemptAInability</h1>

        <div className="button-group">
          <button onClick={handleBaumPflanzen}>Baum pflanzen 🌳</button>
          <button onClick={handleSpurBlockieren}>Einspurig belegen 🛝</button>
          <button onClick={handleAmpelUmschalten}>Ampel anpassen 🚦</button>
        </div>

        <MapComponent activeButton={activeButton} />

      </div>
    </div>
  );
}

export default App;
