import React, { useRef, useState } from "react";
import Map from "./components/Map";
import ControlPanel from "./components/ControlPanel";
import StreetInfoPanel from "./components/StreetInfoPanel";
import "./App.css";

const TrafficNetwork = () => {
  const vehicleCountRef = useRef(100);
  const speedFactorRef = useRef(1);
  const barrier = useRef([]);
  const [vehicleCount, setVehicleCount] = useState(100);
  const [speedFactor, setSpeedFactor] = useState(1);
  const [activeButton, setActiveButton] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedStreetInfo, setSelectedStreetInfo] = useState(null);
  const mapRef = useRef(null);

  React.useEffect(() => {
    speedFactorRef.current = speedFactor;
  }, [speedFactor]);

  // Debug selectedStreetInfo changes
  React.useEffect(() => {
    console.log("Selected street info updated:", selectedStreetInfo);
  }, [selectedStreetInfo]);

  return (
    <div className="app-container">
      <Map
        vehicleCount={vehicleCount}
        speedFactor={speedFactor}
        activeButton={activeButton}
        setActiveButton={setActiveButton}
        vehicleCountRef={vehicleCountRef}
        speedFactorRef={speedFactorRef}
        barrier={barrier}
        isPlaying={isPlaying}
        setSelectedStreetInfo={setSelectedStreetInfo}
        ref={mapRef}
      />
      <ControlPanel
        vehicleCount={vehicleCount}
        setVehicleCount={setVehicleCount}
        speedFactor={speedFactor}
        setSpeedFactor={setSpeedFactor}
        activeButton={activeButton}
        setActiveButton={setActiveButton}
        vehicleCountRef={vehicleCountRef}
        speedFactorRef={speedFactorRef}
        mapRef={mapRef}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
      />
      {selectedStreetInfo && (
        <StreetInfoPanel streetInfo={selectedStreetInfo} />
      )}

      {activeButton === "barrier" && (
        <div className="mode-indicator">
          <div className="mode-indicator-icon">🚧</div>
          <div className="mode-indicator-text">Barrier Placement Mode</div>
          <div className="mode-indicator-help">
            Click on streets to place barriers
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficNetwork;
