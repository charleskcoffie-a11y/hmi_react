import React, { useState, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import ConnectionStatus from './ConnectionStatus';
import NetIDSettings from './NetIDSettings';
import PasswordKeypad from './PasswordKeypad';
import '../styles/MachineParameters.css';

export default function MachineParameters({ isOpen, onClose, plcStatus = 'unknown', unitSystem = 'mm', onUnitChange, userRole = 'operator', userPasswords = { admin: '5771', operator: 'op123', setup: 'setup123', engineering: 'eng123' }, onUpdatePasswords, onOpenDebug = () => {}, homingTimeout = 60, onHomingTimeoutChange = () => {}, onOpenLubePage = () => {}, onOpenNetIdSettings = () => {}, onCloseNetIdSettings = () => {} }) {
  const [parameters, setParameters] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('machineParameters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved machine parameters');
      }
    }
    // Default values (stored in inches)
    return {
      maxTravel: 2,
      minPosition: 0,
      maxPosition: 100,
      jogSpeed: 50,
      speedLimit: 100,
      accelRampTime: 500,
      rightIdStroke: 3.5,   // inches
      rightOdStroke: 4.65,  // inches
      leftIdStroke: 3.5,    // inches
      leftOdStroke: 4.65    // inches
    };
  });

  const [passwordEdits, setPasswordEdits] = useState(userPasswords || {});
  useEffect(() => {
    setPasswordEdits(userPasswords || {});
  }, [userPasswords]);

  // Save parameters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('machineParameters', JSON.stringify(parameters));
  }, [parameters]);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordKeypadOpen, setPasswordKeypadOpen] = useState(false);
  const [editingPasswordRole, setEditingPasswordRole] = useState(null);
  const [connectionStatusOpen, setConnectionStatusOpen] = useState(false);
  const [netIDSettingsOpen, setNetIDSettingsOpen] = useState(false);
  const [actualConnectionStatus, setActualConnectionStatus] = useState('unknown');
  const [heartbeatValue, setHeartbeatValue] = useState(null);
  const [heartbeatTag, setHeartbeatTag] = useState(null);

  const [editingParam, setEditingParam] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editingHomingTimeout, setEditingHomingTimeout] = useState(false);
  const [homingTimeoutEdit, setHomingTimeoutEdit] = useState((homingTimeout ?? 60).toString());

  // Fetch actual backend connection status
  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/status');
        if (res.ok) {
          const data = await res.json();
          setActualConnectionStatus(data.connected ? 'good' : 'bad');
          setHeartbeatValue(data.heartbeat ?? null);
          setHeartbeatTag(data.heartbeatTag || null);
        } else {
          setActualConnectionStatus('bad');
          setHeartbeatValue(null);
          setHeartbeatTag(null);
        }
      } catch (err) {
        setActualConnectionStatus('bad');
        setHeartbeatValue(null);
        setHeartbeatTag(null);
      }
    };

    // Check immediately and then every 2 seconds
    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const MM_TO_INCH = 0.0393701;
  const INCH_TO_MM = 25.4;
  const isAdmin = userRole === 'admin';
  const canChangePasswords = isAdmin; // Only admin can change passwords
  const passwordRoles = [
    { id: 'admin', label: 'Admin' },
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

  const openPasswordKeypad = (role) => {
    if (!canChangePasswords) return;
    setEditingPasswordRole(role);
    setPasswordKeypadOpen(true);
  };

  const handlePasswordKeypadEnter = () => {
    setPasswordKeypadOpen(false);
    if (editingPasswordRole) {
      handlePasswordSave(editingPasswordRole);
      setEditingPasswordRole(null);
    }
  };

  const handlePasswordSave = (role) => {
    if (!onUpdatePasswords) return;
    const updated = { ...(userPasswords || {}), [role]: passwordEdits[role] || '' };
    console.log('[MachineParameters] handlePasswordSave called for role:', role);
    console.log('[MachineParameters] Old passwords:', userPasswords);
    console.log('[MachineParameters] New password value:', passwordEdits[role]);
    console.log('[MachineParameters] Updated object:', updated);
    onUpdatePasswords(updated);
    console.log('[MachineParameters] onUpdatePasswords callback invoked');
  };

  if (!isOpen) return null;

  const parameterConfigs = [
    { key: 'maxTravel', label: 'Max Travel', unit: true },
    { key: 'minPosition', label: 'Min Position', unit: true },
    { key: 'maxPosition', label: 'Max Position', unit: true },
    { key: 'jogSpeed', label: 'Jog Speed (%)', unit: false },
    { key: 'speedLimit', label: 'Speed Limit (%)', unit: false },
    { key: 'accelRampTime', label: 'Accel Ramp Time (ms)', unit: false },
    { key: 'rightIdStroke', label: 'Right Head ID Stroke', unit: true },
    { key: 'rightOdStroke', label: 'Right Head OD Stroke', unit: true },
    { key: 'leftIdStroke', label: 'Left Head ID Stroke', unit: true },
    { key: 'leftOdStroke', label: 'Left Head OD Stroke', unit: true }
  ];

  return (
    <>
      <div className="machine-params-overlay" onClick={onClose}>
        <div className="machine-params-modal" onClick={(e) => e.stopPropagation()}>
        <div className="params-header">
            <div>
              <h2>Machine Parameters</h2>
              <div className="plc-connection-line">
                <span className={`status-dot ${actualConnectionStatus}`}></span>
                <span className="plc-connection-text">
                  PLC Connection: {actualConnectionStatus === 'good' ? 'Good' : actualConnectionStatus === 'bad' ? 'Bad' : 'Unknown'}
                </span>
                <span className={`hb-pill ${heartbeatValue !== null && actualConnectionStatus === 'good' ? 'ok' : 'warn'}`}>
                  <span className="hb-dot" />
                  <span className="hb-label">HB</span>
                  <span className="hb-value">{heartbeatValue !== null ? heartbeatValue : 'N/A'}</span>
                  {heartbeatTag && <span className="hb-tag">{heartbeatTag}</span>}
                </span>
              </div>
            </div>
            <div className="params-actions">
              <button
                className="connection-btn"
                onClick={() => setConnectionStatusOpen(true)}
                aria-label="Open Connection Diagnostics"
              >
                <span className="btn-icon">🔌</span>
                <span className="btn-label">Connection</span>
                <span className={`status-dot ${actualConnectionStatus}`}></span>
              </button>
              <button
                className="debug-btn"
                onClick={() => onOpenDebug && onOpenDebug()}
                aria-label="Open Debug Panel"
              >
                <span className="btn-icon">🩺</span>
                <span className="btn-label">Debug</span>
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

          <div className="params-two-column">
            {/* Left Column */}
            <div className="params-column">
              <div className="parameters-list">
                {parameterConfigs.slice(0, 5).map(config => (
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

              {/* Homing Timeout Parameter */}
              <div className="parameters-list">
                <div className="parameter-row">
                  <div className="param-label-section">
                    <span className="param-label">Homing Timeout</span>
                    <span className="param-unit">seconds</span>
                  </div>

                  {editingHomingTimeout ? (
                    <div className="param-edit">
                      <input
                        type="number"
                        value={homingTimeoutEdit}
                        onChange={(e) => setHomingTimeoutEdit(e.target.value)}
                        className="param-input"
                        autoFocus
                        min="5"
                        max="300"
                        step="1"
                      />
                      <button 
                        className="save-btn"
                        onClick={() => {
                          const newTimeout = parseInt(homingTimeoutEdit, 10);
                          if (newTimeout && newTimeout > 0) {
                            onHomingTimeoutChange(newTimeout);
                            setEditingHomingTimeout(false);
                          }
                        }}
                      >
                        ✓
                      </button>
                      <button 
                        className="cancel-btn"
                        onClick={() => {
                          setEditingHomingTimeout(false);
                          setHomingTimeoutEdit(homingTimeout.toString());
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="param-value-section"
                      onClick={() => {
                        setEditingHomingTimeout(true);
                        setHomingTimeoutEdit(homingTimeout.toString());
                      }}
                    >
                      <span className="param-value">{homingTimeout}</span>
                      <span className="param-desc">(5-300 seconds)</span>
                      <span className="edit-hint">✎</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="passwords-trigger">
                <div>
                  <h3 className="passwords-title">User Passwords</h3>
                  <p className="passwords-note">{isAdmin ? 'Admin can view and change all passwords.' : 'Only Admin can view or change passwords.'}</p>
                </div>
                <button
                  className="passwords-open-btn"
                  onClick={() => isAdmin && setShowPasswordModal(true)}
                  disabled={!isAdmin}
                  title={isAdmin ? 'Open password manager' : 'Only Admin can access'}
                >
                  Manage Passwords
                </button>
              </div>
            </div>

            {/* Right Column */}
            <div className="params-column">
              <div className="parameters-list">
                {parameterConfigs.slice(5).map(config => (
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

              <div className="netid-trigger">
                <div>
                  <h3 className="netid-title">🌐 Network Configuration</h3>
                  <p className="netid-note">Configure PLC Net ID and SuperUser settings (requires SuperUser authentication).</p>
                </div>
                <button
                  className="netid-open-btn"
                  onClick={() => {
                    setNetIDSettingsOpen(true);
                    onOpenNetIdSettings();
                  }}
                  title="Open network configuration settings"
                >
                  ⚙️ Network Settings
                </button>
              </div>

              <div className="lube-trigger">
                <div>
                  <h3 className="lube-title">💧 Lubrication Control</h3>
                  <p className="lube-note">Configure lubrication settings for left and right heads, including shot count, pulse delay, and cycle thresholds.</p>
                </div>
                <button
                  className="lube-open-btn"
                  onClick={() => onOpenLubePage && onOpenLubePage()}
                  title="Open lubrication settings"
                >
                  🔧 Lube Settings
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
                disabled={!canChangePasswords}
              />
              Show passwords
            </label>
          </div>
          <div className="passwords-list">
            {passwordRoles.map((role) => (
              <div key={role.id} className="password-row">
                <div className="password-label">{role.label}</div>
                <div
                  className={`password-display ${!canChangePasswords ? 'disabled' : ''}`}
                  onClick={() => openPasswordKeypad(role.id)}
                  style={{ cursor: canChangePasswords ? 'pointer' : 'not-allowed' }}
                >
                  {showPasswords ? (passwordEdits[role.id] || '') : (passwordEdits[role.id] || '').replace(/./g, '•')}
                </div>
                <button 
                  className="password-save-btn" 
                  onClick={() => handlePasswordSave(role.id)}
                  disabled={!canChangePasswords}
                >
                  Save
                </button>
              </div>
            ))}
          </div>
          {!canChangePasswords && <p style={{color: '#ff6b6b', marginTop: '10px', fontSize: '0.9rem'}}>Only Admin can change passwords</p>}
        </div>
      </ModernDialog>

      <ModernDialog
        isOpen={passwordKeypadOpen}
        title={`Edit ${editingPasswordRole ? passwordRoles.find(r => r.id === editingPasswordRole)?.label : ''} Password`}
        onCancel={() => {
          setPasswordKeypadOpen(false);
          setEditingPasswordRole(null);
        }}
        onConfirm={handlePasswordKeypadEnter}
        confirmText="Save"
        cancelText="Cancel"
      >
        <div className="password-keypad-container">
          <div className="password-display-value">
            {showPasswords 
              ? (passwordEdits[editingPasswordRole] || '')
              : (passwordEdits[editingPasswordRole] || '').replace(/./g, '•')}
          </div>
          <PasswordKeypad
            value={passwordEdits[editingPasswordRole] || ''}
            onValueChange={(val) => handlePasswordChange(editingPasswordRole, val)}
            onEnter={handlePasswordKeypadEnter}
            maxLength={20}
          />
        </div>
      </ModernDialog>

        <ConnectionStatus
          isOpen={connectionStatusOpen}
          onClose={() => setConnectionStatusOpen(false)}
        />

        <NetIDSettings
          isOpen={netIDSettingsOpen}
          onClose={() => {
            setNetIDSettingsOpen(false);
            onCloseNetIdSettings();
          }}
        />
    </>
  );
}
