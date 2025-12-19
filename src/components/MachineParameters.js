import React, { useState } from 'react';
import '../styles/MachineParameters.css';

export default function MachineParameters({ isOpen, onClose }) {
  const [unitSystem, setUnitSystem] = useState('mm'); // 'mm' or 'inch'
  const [parameters, setParameters] = useState({
    maxTravel: 2, // stored in inches, displayed based on unitSystem
    minPosition: 0,
    maxPosition: 100,
    jogSpeed: 50,
    speedLimit: 100,
    accelRampTime: 500
  });

  const [editingParam, setEditingParam] = useState(null);
  const [editValue, setEditValue] = useState('');

  const MM_TO_INCH = 0.0393701;
  const INCH_TO_MM = 25.4;

  const convertValue = (value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'inch' && toUnit === 'mm') return value * INCH_TO_MM;
    if (fromUnit === 'mm' && toUnit === 'inch') return value * MM_TO_INCH;
    return value;
  };

  const getDisplayValue = (storedValue) => {
    if (unitSystem === 'mm') {
      return (storedValue * INCH_TO_MM).toFixed(2);
    }
    return storedValue.toFixed(2);
  };

  const startEdit = (paramKey, currentValue) => {
    setEditingParam(paramKey);
    setEditValue(getDisplayValue(currentValue));
  };

  const saveEdit = (paramKey) => {
    if (editValue && !isNaN(editValue)) {
      let inchValue = parseFloat(editValue);
      // If displaying in MM, convert to inches for storage
      if (unitSystem === 'mm') {
        inchValue = inchValue * MM_TO_INCH;
      }
      setParameters(prev => ({
        ...prev,
        [paramKey]: inchValue
      }));
    }
    setEditingParam(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingParam(null);
    setEditValue('');
  };

  if (!isOpen) return null;

  const parameterConfigs = [
    { key: 'maxTravel', label: 'Max Travel', unit: true },
    { key: 'minPosition', label: 'Min Position', unit: true },
    { key: 'maxPosition', label: 'Max Position', unit: true },
    { key: 'jogSpeed', label: 'Jog Speed (%)', unit: false },
    { key: 'speedLimit', label: 'Speed Limit (%)', unit: false },
    { key: 'accelRampTime', label: 'Accel Ramp Time (ms)', unit: false }
  ];

  return (
    <div className="machine-params-overlay" onClick={onClose}>
      <div className="machine-params-modal" onClick={(e) => e.stopPropagation()}>
        <div className="params-header">
          <h2>Machine Parameters</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="params-content">
          <div className="unit-selector">
            <span className="unit-label">Display Unit:</span>
            <div className="unit-buttons">
              <button 
                className={`unit-btn ${unitSystem === 'mm' ? 'active' : ''}`}
                onClick={() => setUnitSystem('mm')}
              >
                Millimeters (MM)
              </button>
              <button 
                className={`unit-btn ${unitSystem === 'inch' ? 'active' : ''}`}
                onClick={() => setUnitSystem('inch')}
              >
                Inches
              </button>
            </div>
            <div className="unit-info">
              <span className="info-badge">PLC: Always uses Inches</span>
              <span className="info-text">MM is display-only. Changes in MM are auto-converted to inches for PLC.</span>
            </div>
          </div>

          <div className="parameters-list">
            {parameterConfigs.map(config => (
              <div key={config.key} className="parameter-row">
                <div className="param-label-section">
                  <span className="param-label">{config.label}</span>
                  {config.unit && (
                    <span className="param-unit">
                      {unitSystem === 'mm' ? 'mm' : 'in'}
                    </span>
                  )}
                </div>

                {editingParam === config.key ? (
                  <div className="param-edit">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="param-input"
                      autoFocus
                      step="0.01"
                    />
                    <button 
                      className="save-btn"
                      onClick={() => saveEdit(config.key)}
                    >
                      ✓
                    </button>
                    <button 
                      className="cancel-btn"
                      onClick={cancelEdit}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div 
                    className="param-value-section"
                    onClick={() => startEdit(config.key, parameters[config.key])}
                  >
                    <span className="param-value">
                      {getDisplayValue(parameters[config.key])}
                    </span>
                    <span className="plc-value">(PLC: {parameters[config.key].toFixed(2)} in)</span>
                    <span className="edit-hint">✎</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="params-info">
            <div className="info-box">
              <h3>Unit Conversion Info</h3>
              <p>1 inch = 25.4 mm</p>
              <p>All position and travel parameters use the selected unit for display and input.</p>
              <p>The PLC always receives values in inches, regardless of your display preference.</p>
            </div>
          </div>
        </div>

        <div className="params-footer">
          <button className="close-footer-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
