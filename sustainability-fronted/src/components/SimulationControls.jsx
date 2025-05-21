import React from "react";
import "./SimulationControls.css";

export const SimulationControls = ({
  vehicleCount,
  speedFactor,
  onVehicleCountChange,
  onSpeedFactorChange,
}) => {
  const handleVehicleCountChange = (e) => {
    const count = parseInt(e.target.value);
    onVehicleCountChange(count);
  };

  const handleSpeedFactorChange = (e) => {
    const factor = parseFloat(e.target.value);
    onSpeedFactorChange(factor);
  };

  return (
    <div className="simulation-controls">
      <label>
        Vehicles:
        <input
          type="range"
          value={vehicleCount}
          min="10"
          max="500"
          step="10"
          onChange={handleVehicleCountChange}
        />
      </label>
      <span id="vehicle-display">{vehicleCount}</span>
      <br />
      <label>
        Speed:
        <input
          type="range"
          value={speedFactor}
          min="0.5"
          max="5"
          step="0.5"
          onChange={handleSpeedFactorChange}
        />
      </label>
      <span id="speed-display">{speedFactor}x</span>
    </div>
  );
};
