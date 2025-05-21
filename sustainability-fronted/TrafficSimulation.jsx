import React, { useState, useEffect } from "react";
import { TrafficMap } from "./components/TrafficMap";
import { SimulationControls } from "./components/SimulationControls";
import { DebugPanel } from "./components/DebugPanel";
import "./TrafficSimulation.css";

const TrafficSimulation = () => {
  const [vehicleCount, setVehicleCount] = useState(100);
  const [speedFactor, setSpeedFactor] = useState(1);
  const [debugMessages, setDebugMessages] = useState([]);
  const [simulationActive, setSimulationActive] = useState(true);

  // Logging function to be passed to child components
  const log = (message) => {
    setDebugMessages((prev) => {
      const newMessages = [...prev, message];
      // Keep only last 5 messages
      return newMessages.length > 5 ? newMessages.slice(-5) : newMessages;
    });
    console.log(message);
  };

  // Handle vehicle count change
  const handleVehicleCountChange = (count) => {
    setVehicleCount(count);
  }; // Geschweifte Klammer hinzugefügt

  // Handle speed factor change
  const handleSpeedFactorChange = (factor) => {
    setSpeedFactor(factor);
  };

  return (
    <div className="traffic-simulation">
      <TrafficMap
        vehicleCount={vehicleCount}
        speedFactor={speedFactor}
        simulationActive={simulationActive}
        log={log}
      />
      <SimulationControls
        vehicleCount={vehicleCount}
        speedFactor={speedFactor}
        onVehicleCountChange={handleVehicleCountChange}
        onSpeedFactorChange={handleSpeedFactorChange}
      />
      <DebugPanel messages={debugMessages} />
    </div>
  );
};

export default TrafficSimulation;
