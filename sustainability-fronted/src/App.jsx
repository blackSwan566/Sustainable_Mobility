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
    <div className="app-scroll-container">
      <div className="topbar">
        <h1 className="headline">Kempten Traffic Simulator</h1>
      </div>

      <div className="map-section">
        <div className="map-overlay">
          <h2 className="headline2">kemptAInability</h2>
          <div className="tab-group vertical">
            <button
              onClick={() => handleClick('baum')}
              className={activeButton === 'baum' ? 'tab active' : 'tab'}
            >
              🚧  BARRIOR
            </button>
            <button
              onClick={() => handleClick('route')}
              className={activeButton === 'route' ? 'tab active' : 'tab'}
            >
             🚗 ROUTE
            </button>
            <button
              onClick={() => handleClick('delete')}
              className={activeButton === 'delete' ? 'tab active' : 'tab'}
            >
              ❌ DELETE 
            </button>
          </div>
        </div>
        <MapComponent activeButton={activeButton} />
      </div>

      <div className="about-section">
        <h2>About Us</h2>
        <p>
        The project kemptAInability is a collaboration between the University of Applied Sciences Munich (HM) and the Technical University of Munich (TUM).  It aims to create a traffic simulation for the city of Kempten, focusing on sustainability, urban planning and smart mobility. The project is part of a larger initiative to promote green spaces and improve the quality of life in urban areas of the bavarian city.
        Contributors: Fiona Lau (M.Sc. Human-Computer-Interaction), Leonie Münster (M.Sc. Media Informatics), Anton Rockenstein(M.Sc. Media Informatics) and Peter Trenkle (M.Sc. Media Informatics) from Ludwig-Maximilians-University (LMU) Munich. 
        </p>
        <div className="logo-row">
          <img src="src/images/tum.webp" alt="LMU Logo" className="about-logo" />
          <img src="src/images/hm.webp" alt="Kempten Logo" className="about-logo" />
          <img src="src/images/bidt.webp" alt="Ziele Logo" className="about-logo" />
          <img src="src/images/ministry.webp" alt="Ziele Logo" className="about-logo" />
          <img src="src/images/lmu_logo.png" alt="LMU Logo" className="about-logo" />
          <img src="src/images/kempten_logo.png" alt="Kempten Logo" className="about-logo" />
          <img src="src/images/ziele_logo.jpg" alt="Ziele Logo" className="about-logo" />
        </div>
      </div>
    </div>
  );
}

export default App;
