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
        <p className="team-name">Team kemptAInability</p>
      </div>

      <div className="map-section">
        <div className="map-overlay">
          <h2 className="headline2">Simulation Features</h2>
          <div className="tab-group vertical">
      
            <button
              onClick={() => handleClick('route')}
              className={activeButton === 'route' ? 'tab active' : 'tab'}
            >
             🚗 ROUTE
            </button>
            <button
              onClick={() => handleClick('baum')}
              className={activeButton === 'baum' ? 'tab active' : 'tab'}
            >
              🚧  BARRIOR
            </button>
            <button
              onClick={() => handleClick('delete')}
              className={activeButton === 'delete' ? 'tab active' : 'tab'}
            >
              ❌ DELETE 
            </button>
          </div>
        </div>
        
        <div className="map-overlay-emissions">
          <h2 className="headline2">Reductions & Savings</h2>
          
          <div className="impact-box">
            
            <div className="impact-content">
              <p className="impact-label">🌱CO₂ Emissions</p>
              <div className="progress-bar">
                <div className="progress-fill co2" style={{ width: '65%' }}></div>
              </div>
              <p className="impact-value">−65%</p>
            </div>
          </div>

          <div className="impact-box">
            
            <div className="impact-content">
              <p className="impact-label"> 🔉Noise Reduction</p>
              <div className="progress-bar">
                <div className="progress-fill noise" style={{ width: '50%' }}></div>
            </div>
              <p className="impact-value">−50%</p>
            
            </div>
          </div>

          <div className="impact-box">
            
            <div className="impact-content">
              <p className="impact-label">🚗⏳ Traffic Delay</p>
              <div className="progress-bar">
                <div className="progress-fill traffic" style={{ width: '70%' }}></div>
              </div>
              <p className="impact-value">−70%</p>
            </div>
          </div>
        </div>

        <MapComponent activeButton={activeButton} />
      </div>

      <div className="about-section">
        <h2>About Us</h2>
        <p> The seminar <strong>sustAInability</strong> is a collaboration between the University of Applied Sciences Munich (HM) and the Technical University of Munich (TUM).  <br /><br /> <strong>kemptAInability</strong> aims to create a traffic simulation for the city of Kempten, focusing on <em>Sustainability</em>, <em>Urban Planning</em>  and <em>Smart Mobility</em>. The project is part of an initiative to promote green spaces and improve the quality of life in the city center of Kempten.<br /><br /> 
        <strong>Contributors:</strong> Fiona Lau (M.Sc. Human-Computer-Interaction), Leonie Münster (M.Sc. Media Informatics), Anton Rockenstein(M.Sc. Media Informatics) and Peter Trenkle (M.Sc. Media Informatics) at Ludwig-Maximilians-University (LMU) Munich. 
        </p>
        <div className="logo-row">
          <img src="src/images/tum.webp" alt="LMU Logo" className="about-logo" />
          <img src="src/images/hm.webp" alt="Kempten Logo" className="about-logo" />
          <img src="src/images/lmu_logo.png" alt="LMU Logo" className="about-logo" />
          <img src="src/images/bidt.webp" alt="Ziele Logo" className="about-logo" />
          <img src="src/images/kempten_logo.png" alt="Kempten Logo" className="about-logo" />
          <img src="src/images/ziele_logo.jpg" alt="Ziele Logo" className="about-logo" />
          <img src="src/images/ministry.webp" alt="Ziele Logo" className="about-logo" />
         
          
        </div>
      </div>
    </div>
  );
}

export default App;
