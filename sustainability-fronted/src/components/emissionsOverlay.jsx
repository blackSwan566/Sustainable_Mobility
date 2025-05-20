import { useEffect, useState } from 'react';
import { Flame, Volume2, TrafficCone } from 'lucide-react';
import './EmissionsOverlay.css';

function EmissionsOverlay({ visible, distanceSaved = 1.2 }) {
  const [co2Saved, setCo2Saved] = useState(0);
  const [noiseReduction, setNoiseReduction] = useState(0);
  const [trafficReduced, setTrafficReduced] = useState(0);

  useEffect(() => {
    if (visible) {
      // Simple animation: numbers count up
      let steps = 30;
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setCo2Saved(Math.round((distanceSaved * 140 * i) / steps)); // 140g/km CO2
        setNoiseReduction(Math.round((distanceSaved * 20 * i) / steps)); // dB reduction
        setTrafficReduced(Math.round((distanceSaved * 35 * i) / steps)); // Cars per hour
        if (i >= steps) clearInterval(interval);
      }, 20);
    }
  }, [visible, distanceSaved]);

  if (!visible) return null;

  return (
    <div className="emissions-overlay">
      <h2>🌿 Deine Einsparungen</h2>
      <div className="metric">
        <Flame className="icon" />
        <span><strong>{co2Saved}</strong> g CO₂ eingespart</span>
      </div>
      <div className="metric">
        <Volume2 className="icon" />
        <span><strong>{noiseReduction}</strong> dB weniger Lärm</span>
      </div>
      <div className="metric">
        <TrafficCone className="icon" />
        <span><strong>{trafficReduced}</strong> Autos weniger</span>
      </div>
    </div>
  );
}

export default EmissionsOverlay;
