import React, { useEffect, useState } from 'react';
import { getIoMap, readIndices, writeBoolean, pulseButton, filterIoMap } from '../services/ioService';
import '../styles/MachineParameters.css';

export default function DigitalIOPage({ isOpen, onClose }) {
  const [ioMap, setIoMap] = useState([]);
  const [inputs, setInputs] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [states, setStates] = useState({});
  const [busy, setBusy] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      try {
        const map = await getIoMap();
        console.log('[DigitalIOPage] Loaded IO map:', map);
        setIoMap(map);
        const inp = filterIoMap(map, { direction: 'input', minIndex: 100, maxIndex: 149 });
        const out = filterIoMap(map, { direction: 'output', minIndex: 150, maxIndex: 199 });
        console.log('[DigitalIOPage] Filtered inputs (100-149):', inp);
        console.log('[DigitalIOPage] Filtered outputs (150-199):', out);
        setInputs(inp);
        setOutputs(out);
      } catch (err) {
        console.error('[DigitalIOPage] Failed to load IO map:', err);
      }
    }
    load();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const indexes = [
      ...inputs.map(i => i.index),
      ...outputs.map(o => o.index)
    ];
    if (indexes.length === 0) return;

    async function poll() {
      try {
        const results = await readIndices(indexes);
        setStates(results);
      } catch (err) {
        console.error('[DigitalIOPage] Read indices failed:', err);
      }
    }

    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [isOpen, inputs, outputs]);

  if (!isOpen) return null;

  const handleWrite = async (index, value) => {
    try {
      setBusy(prev => ({ ...prev, [index]: true }));
      await writeBoolean(index, value);
    } catch (err) {
      console.error('[DigitalIOPage] Write failed:', err);
    } finally {
      setBusy(prev => ({ ...prev, [index]: false }));
    }
  };

  const handlePulse = async (index) => {
    try {
      setBusy(prev => ({ ...prev, [index]: true }));
      await pulseButton(index, 150);
    } catch (err) {
      console.error('[DigitalIOPage] Pulse failed:', err);
    } finally {
      setBusy(prev => ({ ...prev, [index]: false }));
    }
  };

  return (
    <div className="machine-params-overlay" onClick={onClose}>
      <div className="machine-params-modal" onClick={(e) => e.stopPropagation()}>
        <div className="params-header">
          <h2>Digital I/O</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="params-content">
          {inputs.length === 0 && outputs.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#f0a' }}>
              <p>No Digital IO entries loaded. Check browser console (F12) for errors.</p>
            </div>
          )}
          <div className="dio-status">
            <h3 className="dio-title">Inputs (100+) — {inputs.length} total</h3>
            <div className="dio-grid">
              {inputs.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '10px', color: '#888' }}>No inputs found</div>
              ) : inputs.map(input => (
                <div key={input.index} className="dio-item">
                  <div className="dio-label">{input.label}</div>
                  <div className={`dio-led ${states[input.index]?.value ? 'on' : 'off'}`}>
                    {states[input.index]?.value ? '●' : '○'}
                  </div>
                  <div className="dio-index">#{input.index}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="dio-status" style={{ marginTop: 18 }}>
            <h3 className="dio-title">Outputs (150+) — {outputs.length} total</h3>
            <div className="dio-grid">
              {outputs.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '10px', color: '#888' }}>No outputs found</div>
              ) : outputs.map(output => (
                <div key={output.index} className="dio-item">
                  <div className="dio-label">{output.label}</div>
                  <div className={`dio-led ${states[output.index]?.value ? 'on' : 'off'}`}>
                    {states[output.index]?.value ? '●' : '○'}
                  </div>
                  <div className="dio-index">#{output.index}</div>
                  <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1', marginTop: 8 }}>
                    <button
                      className="passwords-open-btn"
                      disabled={busy[output.index]}
                      onClick={() => handlePulse(output.index)}
                      title="Pulse"
                    >Pulse</button>
                    <button
                      className="passwords-open-btn"
                      disabled={busy[output.index]}
                      onClick={() => handleWrite(output.index, true)}
                      title="Turn On"
                    >On</button>
                    <button
                      className="passwords-open-btn"
                      disabled={busy[output.index]}
                      onClick={() => handleWrite(output.index, false)}
                      title="Turn Off"
                    >Off</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
