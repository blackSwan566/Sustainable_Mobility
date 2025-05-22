import React from "react";

export const SimulationFeatures = ({ activeButton, setActiveButton }) => {
  return (
    <div className="map-overlay">
      <h2 className="headline2">Simulation Features</h2>
      <div className="tab-group vertical">
        <button
          className={`tab ${activeButton === "barrier" ? "active" : ""}`}
          onClick={() => setActiveButton("barrier")}
        >
          🚧 SET BARRIER
        </button>

        <button
          className={`tab ${activeButton === "delete" ? "active" : ""}`}
          onClick={() => setActiveButton("delete")}
        >
          ❌ DELETE BARRIER
        </button>
      </div>
    </div>
  );
};

export const EmissionsOverlay = () => {
  return (
    <div className="map-overlay-emissions">
      <h2 className="headline2">Reductions & Savings</h2>

      <div className="impact-box">
        <div className="impact-content">
          <p className="impact-label">🌱 CO₂ Emissions</p>
          <div className="progress-bar">
            <div className="progress-fill co2" style={{ width: "65%" }}></div>
          </div>
          <p className="impact-value">−65%</p>
        </div>
      </div>

      <div className="impact-box">
        <div className="impact-content">
          <p className="impact-label">🔉 Noise Reduction</p>
          <div className="progress-bar">
            <div className="progress-fill noise" style={{ width: "50%" }}></div>
          </div>
          <p className="impact-value">−50%</p>
        </div>
      </div>

      <div className="impact-box">
        <div className="impact-content">
          <p className="impact-label">🚗⏳ Traffic Delay</p>
          <div className="progress-bar">
            <div
              className="progress-fill traffic"
              style={{ width: "70%" }}
            ></div>
          </div>
          <p className="impact-value">−70%</p>
        </div>
      </div>
    </div>
  );
};

export const MapTitle = () => {
  return (
    <div className="map-title">
      <h1>Kempten City Traffic</h1>
      <p>Team kemptAInability</p>
    </div>
  );
};

export const LayerControls = ({ activeLayer, setActiveLayer }) => {
  return (
    <div className="map-overlay-layers">
      <h2 className="headline2">Map Layers</h2>
      <div className="layer-toggles">
        <button
          className={`tab ${activeLayer === "traffic" ? "active" : ""}`}
          onClick={() => setActiveLayer("traffic")}
        >
          🚗 Traffic Flow
        </button>
        <button
          className={`tab ${activeLayer === "jam" ? "active" : ""}`}
          onClick={() => setActiveLayer("jam")}
        >
          ⏱️ Traffic Jams
        </button>
        <button
          className={`tab ${activeLayer === "co2" ? "active" : ""}`}
          onClick={() => setActiveLayer("co2")}
        >
          🌱 CO₂ Emissions
        </button>
        <button
          className={`tab ${activeLayer === "noise" ? "active" : ""}`}
          onClick={() => setActiveLayer("noise")}
        >
          🔊 Noise Levels
        </button>
      </div>
    </div>
  );
};
