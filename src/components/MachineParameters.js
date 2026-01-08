import React, { useState, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import ConnectionStatus from './ConnectionStatus';
import NetIDSettings from './NetIDSettings';
import '../styles/MachineParameters.css';
import { getIoMap, readIndices, filterIoMap } from '../services/ioService';
import DigitalIOPage from './DigitalIOPage';

export default function MachineParameters({ isOpen, onClose, plcStatus = 'unknown', unitSystem = 'mm', onUnitChange, userRole = 'operator', userPasswords = { operator: 'op123', setup: 'setup123', engineering: 'eng123' }, onUpdatePasswords }) {
  const [parameters, setParameters] = useState({
    maxTravel: 2, // stored in inches, displayed based on unitSystem
    minPosition: 0,
    maxPosition: 100,
    jogSpeed: 50,
    speedLimit: 100,
    accelRampTime: 500,
    strokeRight: 2, // inches
    strokeLeft: 2  // inches
  });

  const [passwordEdits, setPasswordEdits] = useState(userPasswords || {});
  useEffect(() => {
    setPasswordEdits(userPasswords || {});
  }, [userPasswords]);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [connectionStatusOpen, setConnectionStatusOpen] = useState(false);
  const [netIDSettingsOpen, setNetIDSettingsOpen] = useState(false);

  const [editingParam, setEditingParam] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [ioMap, setIoMap] = useState([]);
  const [dioInputs, setDioInputs] = useState([]);
  const [dioOutputs, setDioOutputs] = useState([]);
  const [dioStates, setDioStates] = useState({});
  const [digitalIOOpen, setDigitalIOOpen] = useState(false);

  // Load IO map and prepare Digital IO indices
  useEffect(() => {
    async function loadIo() {
      try {
        const map = await getIoMap();
        setIoMap(map);
        const inputs = filterIoMap(map, { direction: 'input', minIndex: 100, maxIndex: 149 });
        const outputs = filterIoMap(map, { direction: 'output', minIndex: 150, maxIndex: 199 });
        setDioInputs(inputs);
        setDioOutputs(outputs);
      } catch (err) {
        console.error('[MachineParameters] Failed to load IO map:', err);
      }
    }
    loadIo();
  }, []);

  // Poll Digital IO states (inputs 100+, outputs 150+) every 500ms
  useEffect(() => {
    if (dioInputs.length === 0 && dioOutputs.length === 0) return;
    const indexes = [...dioInputs.map(i => i.index), ...dioOutputs.map(o => o.index)];

    async function poll() {
      try {
        const results = await readIndices(indexes);
        setDioStates(results);
      } catch (err) {
        console.error('[MachineParameters] Failed to read IO states:', err);
      }
    }

    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [dioInputs, dioOutputs]);

  const MM_TO_INCH = 0.0393701;
  const INCH_TO_MM = 25.4;
  const passwordRoles = [
    { id: 'operator', label: 'Operator' },
    { id: 'setup', label: 'Setup' },
    { id: 'engineering', label: 'Engineering' }
  ];

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

  const handlePasswordChange = (role, value) => {
    setPasswordEdits(prev => ({ ...prev, [role]: value }));
  };

  const handlePasswordSave = (role) => {
    if (!onUpdatePasswords) return;
    const updated = { ...(userPasswords || {}), [role]: passwordEdits[role] || '' };
    onUpdatePasswords(updated);
  };

  if (!isOpen) return null;

  const parameterConfigs = [
    { key: 'maxTravel', label: 'Max Travel', unit: true },
    { key: 'minPosition', label: 'Min Position', unit: true },
    { key: 'maxPosition', label: 'Max Position', unit: true },
    { key: 'jogSpeed', label: 'Jog Speed (%)', unit: false },
    { key: 'speedLimit', label: 'Speed Limit (%)', unit: false },
    { key: 'accelRampTime', label: 'Accel Ramp Time (ms)', unit: false },
    { key: 'strokeRight', label: 'Stroke (Right Head)', unit: true },
    { key: 'strokeLeft', label: 'Stroke (Left Head)', unit: true }
  ];

  return (
    <>
      <div className="machine-params-overlay" onClick={onClose}>
        <div className="machine-params-modal" onClick={(e) => e.stopPropagation()}>
        <div className="params-header">
            <div>
              <h2>Machine Parameters</h2>
              <div style={{ fontSize: '1em', color: plcStatus === 'good' ? 'green' : plcStatus === 'bad' ? 'red' : 'gray', marginTop: 4 }}>
                PLC Connection: {plcStatus === 'good' ? 'Good' : plcStatus === 'bad' ? 'Bad' : 'Unknown'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                className="connection-btn"
                onClick={() => setConnectionStatusOpen(true)}
                aria-label="Open Connection Diagnostics"
              >
                <span className="btn-icon">🔌</span>
                <span className="btn-label">Connection</span>
                <span className={`status-dot ${plcStatus}`}></span>
              </button>
              <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="params-content">
          <div className="unit-selector">
            <span className="unit-label">Display Unit:</span>
            <div className="unit-buttons">
              <button 
                className={`unit-btn ${unitSystem === 'mm' ? 'active' : ''}`}
                onClick={() => onUnitChange && onUnitChange('mm')}
              >
                Millimeters (MM)
              </button>
              <button 
                className={`unit-btn ${unitSystem === 'inch' ? 'active' : ''}`}
                onClick={() => onUnitChange && onUnitChange('inch')}
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

          <div className="dio-status">
            <h3 className="dio-title">Digital IO Status</h3>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                className="passwords-open-btn"
                onClick={() => setDigitalIOOpen(true)}
                title="Open Digital IO page"
              >Open Digital IO</button>
            </div>
            <div className="dio-section">
              <h4 className="dio-subtitle">Inputs (100+)</h4>
              <div className="dio-grid">
                {dioInputs.map(input => (
                  <div key={input.index} className="dio-item">
                    <div className="dio-label">{input.label}</div>
                    <div className={`dio-led ${dioStates[input.index]?.value ? 'on' : 'off'}`}>
                      {dioStates[input.index]?.value ? '●' : '○'}
                    </div>
                    <div className="dio-index">#{input.index}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dio-section">
              <h4 className="dio-subtitle">Outputs (150+)</h4>
              <div className="dio-grid">
                {dioOutputs.map(output => (
                  <div key={output.index} className="dio-item">
                    <div className="dio-label">{output.label}</div>
                    <div className={`dio-led ${dioStates[output.index]?.value ? 'on' : 'off'}`}>
                      {dioStates[output.index]?.value ? '●' : '○'}
                    </div>
                    <div className="dio-index">#{output.index}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="passwords-trigger">
            <div>
              <h3 className="passwords-title">User Passwords</h3>
              <p className="passwords-note">Only Engineering can view or change passwords.</p>
            </div>
            <button
              className="passwords-open-btn"
              onClick={() => userRole === 'engineering' && setShowPasswordModal(true)}
              disabled={userRole !== 'engineering'}
              title={userRole === 'engineering' ? 'Open password manager' : 'Only Engineering can access'}
            >
              Manage Passwords
            </button>
          </div>

          <div className="netid-trigger">
            <div>
              <h3 className="netid-title">🌐 Network Configuration</h3>
              <p className="netid-note">Configure PLC Net ID and SuperUser settings (requires SuperUser authentication).</p>
            </div>
            <button
              className="netid-open-btn"
              onClick={() => setNetIDSettingsOpen(true)}
              title="Open network configuration settings"
            >
              ⚙️ Network Settings
            </button>
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

      <ModernDialog
        isOpen={showPasswordModal}
        title="Update Passwords"
        onCancel={() => setShowPasswordModal(false)}
        onConfirm={() => setShowPasswordModal(false)}
        confirmText="Done"
        cancelText="Cancel"
      >
        <div className="password-modal-body">
          <div className="password-visibility">
            <label>
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={() => setShowPasswords((prev) => !prev)}
              />
              Show passwords
            </label>
          </div>
          <div className="passwords-list">
            {passwordRoles.map((role) => (
              <div key={role.id} className="password-row">
                <div className="password-label">{role.label}</div>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="password-input"
                  value={passwordEdits[role.id] || ''}
                  onChange={(e) => handlePasswordChange(role.id, e.target.value)}
                />
                <button className="password-save-btn" onClick={() => handlePasswordSave(role.id)}>
                  Save
                </button>
              </div>
            ))}
          </div>
        </div>
      </ModernDialog>

        <ConnectionStatus
          isOpen={connectionStatusOpen}
          onClose={() => setConnectionStatusOpen(false)}
        />

        <DigitalIOPage
          isOpen={digitalIOOpen}
          onClose={() => setDigitalIOOpen(false)}
        />

        <NetIDSettings
          isOpen={netIDSettingsOpen}
          onClose={() => setNetIDSettingsOpen(false)}
        />
    </>
  );
}
