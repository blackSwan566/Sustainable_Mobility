import React from "react";
import ReactDOM from "react-dom/client";
import TrafficSimulation from "./TrafficSimulation";

// Create root element
const rootElement =
  document.getElementById("root") || document.createElement("div");
if (!rootElement.id) {
  rootElement.id = "root";
  document.body.appendChild(rootElement);
}

// Add some basic styling to the page
document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.overflow = "hidden";

// Set up React root and render app
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <TrafficSimulation />
  </React.StrictMode>
);
