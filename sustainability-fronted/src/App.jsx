import React from 'react';
import './App.css';
import MapComponent from './components/map';
import 'leaflet/dist/leaflet.css';

function App() {
  const handleBaumPflanzen = () => {
    console.log("Baum gepflanzt!");
  };

  const handleSpurBlockieren = () => {
    console.log("Spur blockiert!");
  };

  const handleAmpelUmschalten = () => {
    console.log("Ampel umgeschaltet!");
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '85vw',        // Kein Leerzeichen zwischen Zahl und Einheit
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <div>
        <MapComponent />
      </div>

      <div className="app-container">
        <h1 className="headline">KemptAInability</h1>
        <div className="button-group">
          <button onClick={handleBaumPflanzen}>Baum pflanzen</button>
          <button onClick={handleSpurBlockieren}>Eine Spur blockieren</button>
          <button onClick={handleAmpelUmschalten}>Ampel umschalten</button>
        </div>
      </div>
    </div>
  );
}

export default App;
