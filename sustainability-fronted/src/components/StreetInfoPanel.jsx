import React from "react";
import "./StreetInfoPanel.css";

const getStreetTypeName = (type) => {
  const typeMap = {
    "highway.primary": "Ring",
    "highway.secondary": "Hauptstraße",
    "highway.tertiary": "Innerstädtische Straße",
    "highway.residential": "Wohnstraße",
    "highway.service": "Zufahrtsweg",
  };
  return typeMap[type] || "Straße";
};

const getVehicleTypeIcon = (type) => {
  const icons = {
    bicycle: "🚲",
    bus: "🚌",
    emergency: "🚑",
    passenger: "🚗",
    truck: "🚛",
    pedestrian: "🚶",
    motorcycle: "🏍️",
    taxi: "🚕",
  };
  return icons[type] || "🚗";
};

const StreetInfoPanel = ({ streetInfo }) => {
  if (!streetInfo) return null;

  const {
    name,
    type,
    maxSpeed,
    length,
    allowed,
    laneWidth,
    priority,
    isBarriered,
  } = streetInfo;

  // Convert maxSpeed from m/s to km/h if it exists
  const speedKmh = maxSpeed ? Math.round(maxSpeed) : null;

  // Filter relevant vehicle types to show
  const relevantVehicles = [
    "passenger",
    "bicycle",
    "bus",
    "truck",
    "emergency",
    "pedestrian",
    "motorcycle",
    "taxi",
  ].filter((v) => allowed.includes(v));

  return (
    <div className="street-info-panel">
      <h3>{name || "Unnamed Street"}</h3>

      <div className="street-info-content">
        <div className="street-info-row">
          <span className="info-label">Straßentyp:</span>
          <span className="info-value">{getStreetTypeName(type)}</span>
        </div>

        <div className="street-info-row">
          <span className="info-label">Länge:</span>
          <span className="info-value">{length}m</span>
        </div>

        {speedKmh && (
          <div className="street-info-row speed-limit-container">
            <span className="info-label">Tempolimit:</span>
            <div className="speed-sign">
              <div className="speed-sign-circle">
                <span className="speed-value">{speedKmh}</span>
              </div>
            </div>
          </div>
        )}

        {laneWidth && (
          <div className="street-info-row">
            <span className="info-label">Fahrbahnbreite:</span>
            <span className="info-value">{laneWidth}m</span>
          </div>
        )}

        {priority !== undefined && (
          <div className="street-info-row">
            <span className="info-label">Priorität:</span>
            <span className="info-value priority-value">
              {"⭐".repeat(Math.min(5, Math.max(1, Math.round(priority / 2))))}
            </span>
          </div>
        )}

        {relevantVehicles.length > 0 && (
          <div className="street-info-row vehicle-types">
            <span className="info-label">Erlaubte Fahrzeuge:</span>
            <div className="vehicle-icons">
              {relevantVehicles.map((vehicle, index) => (
                <span key={index} className="vehicle-icon" title={vehicle}>
                  {getVehicleTypeIcon(vehicle)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="street-info-row">
          <span className="info-label">Status:</span>
          <span className="info-value status-indicator">
            <span
              className="status-dot"
              style={{
                backgroundColor: isBarriered ? "#ff4444" : "#4CAF50",
              }}
            ></span>
            {isBarriered ? "Gesperrt" : "Offen für Verkehr"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StreetInfoPanel;
