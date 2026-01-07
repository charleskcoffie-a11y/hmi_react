import React, { useState, useEffect } from 'react';
import { getIoMap, pulseButton, writeBoolean, readIndices, filterIoMap } from '../services/ioService';
import '../styles/IOButtons.css';

export default function IOButtons({ side = 'left' }) {
  const [ioMap, setIoMap] = useState([]);
  const [outputStates, setOutputStates] = useState({});
  const [loading, setLoading] = useState(false);

  // Load IO map on mount
  useEffect(() => {
    async function loadMap() {
      const map = await getIoMap();
      setIoMap(map);
    }
    loadMap();
  }, []);

  // Refresh outputs periodically (every 500ms)
  useEffect(() => {
    if (ioMap.length === 0) return;

    const outputs = filterIoMap(ioMap, { direction: 'output', side });
    const outputIndexes = outputs.map(o => o.index);

    async function refresh() {
      try {
        const results = await readIndices(outputIndexes);
        setOutputStates(results);
      } catch (err) {
        console.error('Failed to refresh outputs:', err);
      }
    }

    refresh(); // Initial load
    const interval = setInterval(refresh, 500);
    return () => clearInterval(interval);
  }, [ioMap, side]);

  // Handle button click (pulse)
  async function handlePulse(index, label) {
    setLoading(true);
    try {
      await pulseButton(index, 150);
      console.log(`Pulsed: ${label} (index ${index})`);
    } catch (err) {
      console.error(`Failed to pulse ${label}:`, err);
    } finally {
      setLoading(false);
    }
  }

  // Handle toggle switch (write)
  async function handleToggle(index, label, currentValue) {
    setLoading(true);
    try {
      await writeBoolean(index, !currentValue);
      console.log(`Toggled: ${label} (index ${index})`);
    } catch (err) {
      console.error(`Failed to toggle ${label}:`, err);
    } finally {
      setLoading(false);
    }
  }

  const inputs = filterIoMap(ioMap, { direction: 'input', side });
  const outputs = filterIoMap(ioMap, { direction: 'output', side });

  return (
    <div className="io-buttons-container">
      <h3>{side === 'left' ? 'Left Head' : 'Right Head'} Controls</h3>

      <div className="io-section">
        <h4>Input Buttons (Push Buttons)</h4>
        <div className="io-button-grid">
          {inputs.map(btn => (
            <button
              key={btn.index}
              className="io-button input-button"
              onClick={() => handlePulse(btn.index, btn.label)}
              disabled={loading}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="io-section">
        <h4>Output Status (Indicators)</h4>
        <div className="io-status-grid">
          {outputs.map(out => {
            const state = outputStates[out.index];
            const isActive = state?.value === true;
            return (
              <div key={out.index} className="io-status-item">
                <div className={`io-indicator ${isActive ? 'active' : 'inactive'}`} />
                <span className="io-label">{out.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
