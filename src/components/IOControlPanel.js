import React, { useState, useEffect } from 'react';
import { getIoMap, pulseButton, readIndices, filterIoMap } from '../services/ioService';
import '../styles/IOControlPanel.css';

export default function IOControlPanel({ side = 'left' }) {
  const [ioMap, setIoMap] = useState([]);
  const [outputStates, setOutputStates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIoMap()
      .then(map => {
        setIoMap(map);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load IO map:', err);
        setLoading(false);
      });
  }, []);

  // Poll outputs every 500ms
  useEffect(() => {
    if (ioMap.length === 0) return;

    const outputs = filterIoMap(ioMap, { direction: 'output', side });
    const indexes = outputs.map(o => o.index);

    const pollOutputs = async () => {
      try {
        const results = await readIndices(indexes);
        setOutputStates(results);
      } catch (err) {
        console.error('Failed to read outputs:', err);
      }
    };

    pollOutputs(); // Initial read
    const interval = setInterval(pollOutputs, 500);
    return () => clearInterval(interval);
  }, [ioMap, side]);

  const handlePress = async (index, label) => {
    try {
      await pulseButton(index, 150);
      console.log(`${label} (index ${index}) pressed`);
    } catch (err) {
      console.error(`Failed to pulse ${label}:`, err);
      alert(`Failed to activate ${label}`);
    }
  };

  // Find specific buttons by index
  const getButton = (index) => ioMap.find(io => io.index === index);

  if (loading) {
    return <div className="io-control-panel loading">Loading controls...</div>;
  }

  const sidePrefix = side === 'left' ? 'Left' : 'Right';
  const baseIndex = side === 'left' ? 1 : 40;

  // Map indices (adjust these to match your io-map.json)
  const homeBtn = getButton(baseIndex);      // 1 or 40: Home PB
  const jogBtn = getButton(baseIndex + 2);   // 3 or 42: Jog PB
  const runBtn = getButton(baseIndex + 4);   // 5 or 44: Run PB
  const expBtn = getButton(baseIndex + 6);   // 7 or 46: Exp PB
  const redBtn = getButton(baseIndex + 8);   // 9 or 48: Red PB
  const startPosBtn = getButton(baseIndex + 10); // 11 or 50: StartPos PB

  // Output status indices
  const homeEna = getButton(baseIndex + 1);  // 2 or 41: Home Ena
  const jogMode = getButton(baseIndex + 3);  // 4 or 43: Jog Mode
  const runMode = getButton(baseIndex + 5);  // 6 or 45: Run Mode
  const expEna = getButton(baseIndex + 7);   // 8 or 47: Exp Ena
  const redEna = getButton(baseIndex + 9);   // 10 or 49: Red Ena
  const startPosEna = getButton(baseIndex + 11); // 12 or 51: StartPos Ena

  const getOutputValue = (button) => {
    if (!button) return false;
    return outputStates[button.index]?.value || false;
  };

  return (
    <div className="io-control-panel">
      <h3 className="panel-title">{sidePrefix} Head Controls</h3>
      
      <div className="control-grid">
        {homeBtn && (
          <div className="control-item">
            <button 
              className="io-button home-btn"
              onClick={() => handlePress(homeBtn.index, homeBtn.label)}
            >
              {homeBtn.label}
            </button>
            {homeEna && (
              <div className={`status-led ${getOutputValue(homeEna) ? 'active' : ''}`}>
                {getOutputValue(homeEna) ? '●' : '○'}
              </div>
            )}
          </div>
        )}

        {jogBtn && (
          <div className="control-item">
            <button 
              className="io-button jog-btn"
              onClick={() => handlePress(jogBtn.index, jogBtn.label)}
            >
              {jogBtn.label}
            </button>
            {jogMode && (
              <div className={`status-led ${getOutputValue(jogMode) ? 'active' : ''}`}>
                {getOutputValue(jogMode) ? '●' : '○'}
              </div>
            )}
          </div>
        )}

        {runBtn && (
          <div className="control-item">
            <button 
              className="io-button run-btn"
              onClick={() => handlePress(runBtn.index, runBtn.label)}
            >
              {runBtn.label}
            </button>
            {runMode && (
              <div className={`status-led ${getOutputValue(runMode) ? 'active' : ''}`}>
                {getOutputValue(runMode) ? '●' : '○'}
              </div>
            )}
          </div>
        )}

        {expBtn && (
          <div className="control-item">
            <button 
              className="io-button exp-btn"
              onClick={() => handlePress(expBtn.index, expBtn.label)}
            >
              {expBtn.label}
            </button>
            {expEna && (
              <div className={`status-led ${getOutputValue(expEna) ? 'active' : ''}`}>
                {getOutputValue(expEna) ? '●' : '○'}
              </div>
            )}
          </div>
        )}

        {redBtn && (
          <div className="control-item">
            <button 
              className="io-button red-btn"
              onClick={() => handlePress(redBtn.index, redBtn.label)}
            >
              {redBtn.label}
            </button>
            {redEna && (
              <div className={`status-led ${getOutputValue(redEna) ? 'active' : ''}`}>
                {getOutputValue(redEna) ? '●' : '○'}
              </div>
            )}
          </div>
        )}

        {startPosBtn && (
          <div className="control-item">
            <button 
              className="io-button start-pos-btn"
              onClick={() => handlePress(startPosBtn.index, startPosBtn.label)}
            >
              {startPosBtn.label}
            </button>
            {startPosEna && (
              <div className={`status-led ${getOutputValue(startPosEna) ? 'active' : ''}`}>
                {getOutputValue(startPosEna) ? '●' : '○'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
