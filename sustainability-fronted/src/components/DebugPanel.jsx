import React from "react";
import "./DebugPanel.css";

export const DebugPanel = ({ messages }) => {
  return (
    <div className="debug-panel">
      {messages.map((message, index) => (
        <div key={index} className="debug-message">
          {message}
        </div>
      ))}
    </div>
  );
};
