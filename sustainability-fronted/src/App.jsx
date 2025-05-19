import React from 'react';
import './App.css';

function App() {
  const handleBaumPflanzen = () => {
    console.log("Baum gepflanzt!");
  };

  const handleSpurBlockieren = () => {
    console.log("Spur blockiert!");
  };

  const handleAmpelUmschalten = () => {
    console.log("Ampel umgeschaltet!");
  };

  return (
    <div className="app-container">
      <h1 className="headline">KemptAInability</h1>
      <div className="button-group">
        <button onClick={handleBaumPflanzen}>Baum pflanzen</button>
        <button onClick={handleSpurBlockieren}>Eine Spur blockieren</button>
        <button onClick={handleAmpelUmschalten}>Ampel umschalten</button>
      </div>
    </div>
  );
}

export default App;
