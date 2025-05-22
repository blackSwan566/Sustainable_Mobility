import React from "react";

const StreetInfoPanel = ({ streetInfo }) => {
  if (!streetInfo) return null;

  const { name, type, maxSpeed, length } = streetInfo;

  return (
    <div className="street-info-panel">
      <h3>{name || "Unnamed Street"}</h3>

      <div className="street-info-content">
        <div className="street-info-row">
          <span className="info-label">Type:</span>
          <span className="info-value">{type || "Unknown"}</span>
        </div>

        <div className="street-info-row">
          <span className="info-label">Length:</span>
          <span className="info-value">{length}m</span>
        </div>

        {maxSpeed && (
          <div className="street-info-row">
            <span className="info-label">Max Speed:</span>
            <div className="speed-sign">
              <div className="speed-sign-inner">{maxSpeed}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreetInfoPanel;
