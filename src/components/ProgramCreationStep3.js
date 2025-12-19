import React, { useState } from 'react';
import '../styles/ProgramCreationStep3.css';

export default function ProgramCreationStep3({ programName, side, onStepComplete, onCancel, onPrevious }) {
  const [jogMode, setJogMode] = useState(true);
  const [idExpandValue, setIdExpandValue] = useState(0);
  const [idRetractValue, setIdRetractValue] = useState(0);
  const [odExpandValue, setOdExpandValue] = useState(0);
  const [odRetractValue, setOdRetractValue] = useState(0);
  
  const [idExpandRecorded, setIdExpandRecorded] = useState(false);
  const [idRetractRecorded, setIdRetractRecorded] = useState(false);
  const [odExpandRecorded, setOdExpandRecorded] = useState(false);
  const [odRetractRecorded, setOdRetractRecorded] = useState(false);
  
  const [stepMessage, setStepMessage] = useState('');
  const [patternCode, setPatternCode] = useState(8); // Default to All off

  const sideLabel = side === 'right' ? 'Right Side' : 'Left Side';
  const axis1Name = side === 'right' ? 'Axis 1 (ID)' : 'Axis 3 (ID)';
  const axis2Name = side === 'right' ? 'Axis 2 (OD)' : 'Axis 4 (OD)';

  const handleJog = (axis, direction) => {
    const increment = direction === 'up' ? 1 : -1;
    if (axis === 'idExpand') setIdExpandValue(prev => prev + increment);
    if (axis === 'idRetract') setIdRetractValue(prev => prev + increment);
    if (axis === 'odExpand') setOdExpandValue(prev => prev + increment);
    if (axis === 'odRetract') setOdRetractValue(prev => prev + increment);
  };

  const handleRecord = (type) => {
    const messageMap = {
      idExpand: () => {
        setIdExpandRecorded(true);
        setStepMessage(`✓ ${axis1Name} Expand position recorded: ${idExpandValue.toFixed(2)} mm`);
      },
      idRetract: () => {
        setIdRetractRecorded(true);
        setStepMessage(`✓ ${axis1Name} Retract position recorded: ${idRetractValue.toFixed(2)} mm`);
      },
      odExpand: () => {
        setOdExpandRecorded(true);
        setStepMessage(`✓ ${axis2Name} Expand position recorded: ${odExpandValue.toFixed(2)} mm`);
      },
      odRetract: () => {
        setOdRetractRecorded(true);
        setStepMessage(`✓ ${axis2Name} Retract position recorded: ${odRetractValue.toFixed(2)} mm`);
      }
    };
    
    messageMap[type]?.();
    setTimeout(() => setStepMessage(''), 3000);
  };

  const handleComplete = () => {
    if (!idExpandRecorded || !idRetractRecorded || !odExpandRecorded || !odRetractRecorded) {
      alert('Please record all four positions (ID Expand, ID Retract, OD Expand, OD Retract) before continuing');
      return;
    }

    onStepComplete({
      step: 3,
      stepName: 'Expand/Retract Positions',
      positions: {
        [axis1Name]: {
          expand: idExpandValue,
          retract: idRetractValue
        },
        [axis2Name]: {
          expand: odExpandValue,
          retract: odRetractValue
        }
      },
      pattern: patternCode,
      timestamp: new Date().toISOString()
    });
  };

  const canComplete = idExpandRecorded && idRetractRecorded && odExpandRecorded && odRetractRecorded;

  const PositionCard = ({ title, axis, expandValue, expandRecorded, retractValue, retractRecorded }) => (
    <div className="position-card">
      <h3 className="card-title">{title}</h3>
      
      <div className="expand-section">
        <div className="expand-header">
          <span className="expand-label">Expand Position</span>
          {expandRecorded && <span className="recorded-badge">✓ Recorded</span>}
        </div>

        <div className="axis-display">
          <div className="position-value">{expandValue.toFixed(2)} mm</div>
        </div>

        <div className="jog-controls">
          <button
            className="jog-btn up"
            onClick={() => handleJog(axis, 'up')}
            disabled={!jogMode}
          >
            ▲
          </button>
          <button
            className="jog-btn down"
            onClick={() => handleJog(axis, 'down')}
            disabled={!jogMode}
          >
            ▼
          </button>
        </div>

        <div className="slider-container">
          <input
            type="range"
            min="-1000"
            max="1000"
            step="0.1"
            value={expandValue}
            onChange={(e) => {
              if (axis === 'idExpand') setIdExpandValue(parseFloat(e.target.value));
              if (axis === 'odExpand') setOdExpandValue(parseFloat(e.target.value));
            }}
            disabled={!jogMode}
            className="slider"
          />
        </div>

        <input
          type="number"
          value={expandValue}
          onChange={(e) => {
            if (axis === 'idExpand') setIdExpandValue(parseFloat(e.target.value));
            if (axis === 'odExpand') setOdExpandValue(parseFloat(e.target.value));
          }}
          disabled={!jogMode}
          className="direct-input"
        />

        <button
          className={`record-btn ${expandRecorded ? 'recorded' : ''}`}
          onClick={() => handleRecord(axis)}
          disabled={!jogMode}
        >
          {expandRecorded ? '✓ Recorded' : '📍 Record'}
        </button>
      </div>

      <div className="retract-section">
        <div className="retract-header">
          <span className="retract-label">Retract Position</span>
          {retractRecorded && <span className="recorded-badge">✓ Recorded</span>}
        </div>

        <div className="axis-display">
          <div className="position-value">{retractValue.toFixed(2)} mm</div>
        </div>

        <div className="jog-controls">
          <button
            className="jog-btn up"
            onClick={() => handleJog(`${axis}Retract`.replace('ExpandRetract', 'Retract'), 'up')}
            disabled={!jogMode}
          >
            ▲
          </button>
          <button
            className="jog-btn down"
            onClick={() => handleJog(`${axis}Retract`.replace('ExpandRetract', 'Retract'), 'down')}
            disabled={!jogMode}
          >
            ▼
          </button>
        </div>

        <div className="slider-container">
          <input
            type="range"
            min="-1000"
            max="1000"
            step="0.1"
            value={retractValue}
            onChange={(e) => {
              if (axis === 'idExpand') setIdRetractValue(parseFloat(e.target.value));
              if (axis === 'odExpand') setOdRetractValue(parseFloat(e.target.value));
            }}
            disabled={!jogMode}
            className="slider"
          />
        </div>

        <input
          type="number"
          value={retractValue}
          onChange={(e) => {
            if (axis === 'idExpand') setIdRetractValue(parseFloat(e.target.value));
            if (axis === 'odExpand') setOdRetractValue(parseFloat(e.target.value));
          }}
          disabled={!jogMode}
          className="direct-input"
        />

        <button
          className={`record-btn ${retractRecorded ? 'recorded' : ''}`}
          onClick={() => handleRecord(`${axis}Retract`)}
          disabled={!jogMode}
        >
          {retractRecorded ? '✓ Recorded' : '📍 Record'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="program-creation-step3">
      <div className="step-header">
        <div className="step-info">
          <h2>Program: {programName}</h2>
          <p className="step-subtitle">{sideLabel} - Step 3: Expand/Retract Positions</p>
          <p className="step-description">Record expand and retract positions for both ID and OD</p>
        </div>
        <button className="close-btn" onClick={onCancel}>✕</button>
      </div>

      <div className="step-content">
        <div className="mode-indicator">
          {jogMode && <div className="jog-active">🎮 JOG MODE ACTIVE</div>}
        </div>

        <div className="position-cards-grid">
          <PositionCard
            title={`${axis1Name} (ID)`}
            axis="idExpand"
            expandValue={idExpandValue}
            expandRecorded={idExpandRecorded}
            retractValue={idRetractValue}
            retractRecorded={idRetractRecorded}
          />
          <PositionCard
            title={`${axis2Name} (OD)`}
            axis="odExpand"
            expandValue={odExpandValue}
            expandRecorded={odExpandRecorded}
            retractValue={odRetractValue}
            retractRecorded={odRetractRecorded}
          />
        </div>

        <div className="pattern-selector">
          <label htmlFor="pattern-step3">Step Pattern</label>
          <select
            id="pattern-step3"
            value={patternCode}
            onChange={(e) => setPatternCode(parseInt(e.target.value, 10))}
          >
            <option value={0}>0 - Red Ext</option>
            <option value={1}>1 - Red Ret</option>
            <option value={2}>2 - Exp Ext</option>
            <option value={3}>3 - Exp Ret</option>
            <option value={4}>4 - RedRet + ExpRet</option>
            <option value={5}>5 - Repeat</option>
            <option value={6}>6 - RedExt + ExpExt</option>
            <option value={8}>8 - All off</option>
          </select>
        </div>
      </div>

      {stepMessage && (
        <div className="step-message">
          {stepMessage}
        </div>
      )}

      <div className="step-footer">
        <div className="step-progress">
          <span className="progress-item">
            <strong>Step 3:</strong> Expand/Retract
          </span>
          <div className="progress-status">
            {canComplete && (
              <span className="status-complete">✓ Complete</span>
            )}
            {!canComplete && (
              <span className="status-pending">Pending ({idExpandRecorded ? 1 : 0 + idRetractRecorded ? 1 : 0 + odExpandRecorded ? 1 : 0 + odRetractRecorded ? 1 : 0}/4)</span>
            )}
          </div>
        </div>

        <div className="step-actions">
          <button className="previous-btn" onClick={onPrevious}>
            ← Previous Step
          </button>
          <button
            className="complete-btn"
            onClick={handleComplete}
            disabled={!canComplete}
          >
            ✓ Next Step
          </button>
          <button className="cancel-btn" onClick={onCancel}>
            Cancel Program
          </button>
        </div>
      </div>
    </div>
  );
}
