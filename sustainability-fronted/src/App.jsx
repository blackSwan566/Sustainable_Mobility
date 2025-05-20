import React, { useState } from 'react';
import './App.css';
import MapComponent from './components/map';
import 'leaflet/dist/leaflet.css';

function App() {
  const [activeButton, setActiveButton] = useState(null);

  const handleClick = (action) => {
    console.log(`Action: ${action}`);
    setActiveButton(action);
  };



  return (
    <div className="app-container">
      <div className="topbar">
        <div className="header-container">
          <h1 className="headline">KemptAInability</h1>

        </div>
        <div className="tab-group">
          <button
            onClick={() => handleClick('baum')}
            className={activeButton === 'baum' ? 'tab active' : 'tab'}
          >
            🌳 Baum pflanzen
          </button>
          <button
            onClick={() => handleClick('delete')}
            className={activeButton === 'delete' ? 'tab active' : 'tab'}
          >
            ❌ Sperrung aufheben
          </button>
          <button
            onClick={() => handleClick('about')}
            className={activeButton === 'about' ? 'tab active' : 'tab'}
          >
            ℹ️ About Us
          </button>
        </div>
      </div>

      <div className="map-wrapper">
        <MapComponent activeButton={activeButton} />
      </div>
    </div>
  );
}

export default App;
