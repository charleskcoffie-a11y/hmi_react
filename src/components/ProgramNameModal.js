import React, { useState } from 'react';
import VirtualKeyboard from './VirtualKeyboard';
import '../styles/ProgramNameModal.css';

export default function ProgramNameModal({ isOpen, side, onConfirm, onCancel }) {
  const [programName, setProgramName] = useState('');
  const [error, setError] = useState('');

  const handleInput = (value) => {
    if (value.length <= 32) {
      setProgramName(value);
      setError('');
    } else {
      setError('Name too long (max 32 characters)');
    }
  };

  const handleBackspace = (value) => {
    setProgramName(value);
    setError('');
  };

  const handleEnter = (name) => {
    if (!name.trim()) {
      setError('Program name cannot be empty');
      return;
    }
    if (name.trim().length < 3) {
      setError('Program name must be at least 3 characters');
      return;
    }
    onConfirm(name.trim());
  };

  if (!isOpen) return null;

  const sideLabel = side === 'right' ? 'Right Side' : 'Left Side';
  const sideAxes = side === 'right' 
    ? ['Axis 1 (ID)', 'Axis 2 (OD)']
    : ['Axis 3 (ID)', 'Axis 4 (OD)'];

  return (
    <div className="program-name-overlay" onClick={onCancel}>
      <div className="program-name-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Program</h2>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-content">
          <div className="program-info">
            <div className="info-item">
              <span className="info-label">Machine Side:</span>
              <span className={`info-value ${side}`}>{sideLabel}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Axes:</span>
              <div className="axes-list">
                {sideAxes.map((axis, idx) => (
                  <span key={idx} className="axis-badge">{axis}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="keyboard-container">
            <VirtualKeyboard
              value={programName}
              onInput={handleInput}
              onEnter={handleEnter}
              onBackspace={handleBackspace}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button
              className="confirm-btn"
              onClick={() => handleEnter(programName)}
              disabled={!programName.trim()}
            >
              Confirm & Start Program
            </button>
            <button className="cancel-btn" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
