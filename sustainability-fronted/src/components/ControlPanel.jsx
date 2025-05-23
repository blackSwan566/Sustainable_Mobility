import React from "react";

const ControlPanel = ({
  vehicleCount,
  setVehicleCount,
  speedFactor,
  setSpeedFactor,
  activeButton,
  setActiveButton,
  vehicleCountRef,
  speedFactorRef,
  mapRef,
  isPlaying,
  setIsPlaying,
  activeLayer,
  setActiveLayer,
}) => {
  // Function to cycle through speed multipliers
  const cycleSpeedMultiplier = () => {
    const speedValues = [1, 2, 3, 5, 10];
    const currentIndex = speedValues.indexOf(speedFactor);
    const nextIndex = (currentIndex + 1) % speedValues.length;
    setSpeedFactor(speedValues[nextIndex]);
    speedFactorRef.current = speedValues[nextIndex];
  };

  return (
    <div className="control-panel">
      <div className="control-panel-content">
        <div className="control-section">
          <h2>Kempten City Traffic</h2>
          <p className="subtitle">Team kemptAInability</p>
        </div>

        <div className="control-section">
          <h3>Simulation Controls</h3>

          <div className="playback-controls">
            <button
              className={`control-button control-button-play ${
                isPlaying ? "active" : ""
              }`}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? "⏸ Pause" : "▶️ Play"}
            </button>

            <button
              className="control-button control-button-speed"
              onClick={cycleSpeedMultiplier}
            >
              {speedFactor}x
            </button>
          </div>

          <div className="slider-control">
            <label htmlFor="vehicle-slider">Vehicles:</label>
            <div className="slider-bar">
              <input
                id="vehicle-slider"
                type="range"
                min="10"
                max="1000"
                value={vehicleCount}
                step="10"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setVehicleCount(val);
                  vehicleCountRef.current = val;
                  if (mapRef.current && mapRef.current._leaflet_map) {
                    const map = mapRef.current._leaflet_map;
                    const initVehicles = mapRef.current.initVehicles;
                    if (typeof initVehicles === "function") {
                      initVehicles(map, val);
                    }
                  }
                }}
              />
              <span className="control-value">{vehicleCount}</span>
            </div>
          </div>
        </div>

        <div className="control-section">
          <h3>Map Layers</h3>
          <div className="button-group">
            <button
              className={`control-button ${
                activeLayer === "traffic" ? "active" : ""
              }`}
              onClick={() => setActiveLayer("traffic")}
            >
              🚗 Traffic Flow
            </button>
            <button
              className={`control-button ${
                activeLayer === "jam" ? "active" : ""
              }`}
              onClick={() => setActiveLayer("jam")}
            >
              ⏱️ Traffic Jams
            </button>
            <button
              className={`control-button ${
                activeLayer === "co2" ? "active" : ""
              }`}
              onClick={() => setActiveLayer("co2")}
            >
              🌱 CO₂ Emissions
            </button>
            <button
              className={`control-button ${
                activeLayer === "noise" ? "active" : ""
              }`}
              onClick={() => setActiveLayer("noise")}
            >
              🔊 Noise Levels
            </button>
          </div>
        </div>

        <div className="control-section">
          <h3>Simulation Features</h3>
          <div className="button-group">
            {activeButton === "barrier" ? (
              <button
                className="control-button control-button-done"
                onClick={() => setActiveButton(null)}
              >
                ✓ Done Placing Barriers
              </button>
            ) : (
              <button
                className={`control-button ${
                  activeButton === "barrier" ? "active" : ""
                }`}
                onClick={() => setActiveButton("barrier")}
              >
                🚧 Set Barrier
              </button>
            )}

            <button
              className={`control-button ${
                activeButton === "delete" ? "active" : ""
              }`}
              onClick={() => setActiveButton("delete")}
            >
              ❌ Delete Barriers
            </button>
          </div>
        </div>

        <div className="control-section about-info">
          <h3>About</h3>
          <p>
            The seminar <strong>sustAInability</strong> is a collaboration
            between the University of Applied Sciences Munich (HM) and the
            Technical University of Munich (TUM).
            <br />
            <br />
            <strong>kemptAInability</strong> aims to create a traffic simulation
            for the city of Kempten, focusing on <em>Sustainability</em>,{" "}
            <em>Urban Planning</em> and <em>Smart Mobility</em>. The project is
            part of an initiative to promote green spaces and improve the
            quality of life in the city center of Kempten.
            <br />
            <br />
            <strong>Contributors:</strong> Fiona Lau, Leonie Münster, Anton
            Rockenstein, Peter Trenkle at LMU Munich.
          </p>
          <div className="logo-row">
            <img
              src="src/images/tum.webp"
              alt="TUM Logo"
              className="about-logo"
            />
            <img
              src="src/images/hm.webp"
              alt="HM Logo"
              className="about-logo"
            />
            <img
              src="src/images/lmu_logo.png"
              alt="LMU Logo"
              className="about-logo"
            />
            <img
              src="src/images/bidt.webp"
              alt="BIDT Logo"
              className="about-logo"
            />
            <img
              src="src/images/kempten_logo.png"
              alt="Kempten Logo"
              className="about-logo"
            />
            <img
              src="src/images/ziele_logo.jpg"
              alt="Ziele Logo"
              className="about-logo"
            />
            <img
              src="src/images/ministry.webp"
              alt="Ministry Logo"
              className="about-logo"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
