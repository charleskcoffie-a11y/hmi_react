import React, { useState } from 'react';
import ModernDialog from './ModernDialog';
import '../styles/ProgramCreationStep2.css';

export default function ProgramCreationStep2({ programName, side, onStepComplete, onCancel, onPrevious }) {
  const [dwell, setDwell] = useState('');
  const [jogMode] = useState(true);
  const [axis1Value, setAxis1Value] = useState(0);
  const [axis2Value, setAxis2Value] = useState(0);
  const [axis1Recorded, setAxis1Recorded] = useState(false);
  const [axis2Recorded, setAxis2Recorded] = useState(false);
  const [recordedPositions, setRecordedPositions] = useState({});
  const [stepMessage, setStepMessage] = useState('');
  const [patternCode, setPatternCode] = useState(8); // Default to All off
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });

  const sideLabel = side === 'right' ? 'Right Side' : 'Left Side';
  const axis1Name = side === 'right' ? 'Axis 1 (ID)' : 'Axis 3 (ID)';
  const axis2Name = side === 'right' ? 'Axis 2 (OD)' : 'Axis 4 (OD)';

  const handleAxis1Jog = (direction) => {
    const increment = direction === 'up' ? 1 : -1;
    setAxis1Value(prev => prev + increment);
  };

  const handleAxis2Jog = (direction) => {
    const increment = direction === 'up' ? 1 : -1;
    setAxis2Value(prev => prev + increment);
  };

  const handleAxis1Record = () => {
    setAxis1Recorded(true);
    setRecordedPositions(prev => ({
      ...prev,
      [axis1Name]: axis1Value
    }));
    setStepMessage(`✓ ${axis1Name} position recorded: ${axis1Value.toFixed(2)} mm`);
    setTimeout(() => setStepMessage(''), 3000);
  };

  const handleAxis2Record = () => {
    setAxis2Recorded(true);
    setRecordedPositions(prev => ({
      ...prev,
      [axis2Name]: axis2Value
    }));
    setStepMessage(`✓ ${axis2Name} position recorded: ${axis2Value.toFixed(2)} mm`);
    setTimeout(() => setStepMessage(''), 3000);
  };

  const handleComplete = () => {
    if (!axis1Recorded || !axis2Recorded) {
      setDialog({ open: true, title: 'Positions Required', message: 'Please record positions for both axes before continuing.' });
      return;
    }

    const dwellMs = Number.isFinite(parseFloat(dwell))
      ? parseFloat(dwell)
      : ([1, 3, 4].includes(patternCode) ? 0 : 500);

    onStepComplete({
      step: 2,
      stepName: 'Work Position',
      positions: recordedPositions,
      pattern: patternCode,
      dwell: dwellMs,
      timestamp: new Date().toISOString()
    });
  };

  const canComplete = axis1Recorded && axis2Recorded;

  return (
    <div className="program-creation-step2">
      <div className="step-header">
        <div className="step-info">
          <h2>Program: {programName}</h2>
          <p className="step-subtitle">{sideLabel} - Step 2: Work Position</p>
          <p className="step-description">Position both axes at the desired work location</p>
        </div>
        <button className="close-btn" onClick={onCancel}>✕</button>
      </div>

      <div className="step-content">
        <div className="mode-indicator">
          {jogMode && <div className="jog-active">🎮 JOG MODE ACTIVE</div>}
        </div>

        <div className="axes-container">
          <div className="axis-jog-card">
            <div className="axis-card-header">
              <h3>{axis1Name}</h3>
              {axis1Recorded && <span className="recorded-badge">✓ Recorded</span>}
            </div>

            <div className="axis-display">
              <div className="position-label">Current Position</div>
              <div className="position-value">{axis1Value.toFixed(2)} mm</div>
            </div>

            <div className="jog-controls-large">
              <button
                className="jog-btn-large up"
                onClick={() => handleAxis1Jog('up')}
                disabled={!jogMode}
              >
                ▲ Up (+)
              </button>
              <button
                className="jog-btn-large down"
                onClick={() => handleAxis1Jog('down')}
                disabled={!jogMode}
              >
                ▼ Down (-)
              </button>
            </div>

            <div className="slider-container">
              <input
                type="range"
                min="-1000"
                max="1000"
                step="0.1"
                value={axis1Value}
                onChange={(e) => setAxis1Value(parseFloat(e.target.value))}
                disabled={!jogMode}
                className="slider-large"
              />
            </div>

            <div className="step-input-container">
              <input
                type="number"
                value={axis1Value}
                onChange={(e) => setAxis1Value(parseFloat(e.target.value))}
                disabled={!jogMode}
                placeholder="Direct value"
                className="direct-input"
              />
            </div>

            <button
              className={`record-btn ${axis1Recorded ? 'recorded' : ''}`}
              onClick={handleAxis1Record}
              disabled={!jogMode}
            >
              {axis1Recorded ? '✓ Position Recorded' : '📍 Record Position'}
            </button>
          </div>

          <div className="axis-jog-card">
            <div className="axis-card-header">
              <h3>{axis2Name}</h3>
              {axis2Recorded && <span className="recorded-badge">✓ Recorded</span>}
            </div>

            <div className="axis-display">
              <div className="position-label">Current Position</div>
              <div className="position-value">{axis2Value.toFixed(2)} mm</div>
            </div>

            <div className="jog-controls-large">
              <button
                className="jog-btn-large up"
                onClick={() => handleAxis2Jog('up')}
                disabled={!jogMode}
              >
                ▲ Up (+)
              </button>
              <button
                className="jog-btn-large down"
                onClick={() => handleAxis2Jog('down')}
                disabled={!jogMode}
              >
                ▼ Down (-)
              </button>
            </div>

            <div className="slider-container">
              <input
                type="range"
                min="-1000"
                max="1000"
                step="0.1"
                value={axis2Value}
                onChange={(e) => setAxis2Value(parseFloat(e.target.value))}
                disabled={!jogMode}
                className="slider-large"
              />
            </div>

            <div className="step-input-container">
              <input
                type="number"
                value={axis2Value}
                onChange={(e) => setAxis2Value(parseFloat(e.target.value))}
                disabled={!jogMode}
                placeholder="Direct value"
                className="direct-input"
              />
            </div>

            <button
              className={`record-btn ${axis2Recorded ? 'recorded' : ''}`}
              onClick={handleAxis2Record}
              disabled={!jogMode}
            >
              {axis2Recorded ? '✓ Position Recorded' : '📍 Record Position'}
            </button>
          </div>
        </div>

        <div className="pattern-selector">
          <label htmlFor="pattern-step2">Step Pattern</label>
          <select
            id="pattern-step2"
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
            <strong>Step 2:</strong> Work Position
          </span>
          <div className="progress-status">
            {axis1Recorded && axis2Recorded && (
              <span className="status-complete">✓ Complete</span>
            )}
            {(!axis1Recorded || !axis2Recorded) && (
              <span className="status-pending">Pending</span>
            )}
          </div>
        </div>

        <div className="dwell-input-row">
          <label>Dwell (ms, optional for this step):</label>
          <input
            type="number"
            min="0"
            value={dwell}
            onChange={e => setDwell(e.target.value)}
            placeholder="Enter dwell for this step"
          />
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

      <ModernDialog
        isOpen={dialog.open}
        title={dialog.title || 'Notice'}
        onClose={() => setDialog({ open: false, title: '', message: '' })}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span>{dialog.message}</span>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setDialog({ open: false, title: '', message: '' })}>Close</button>
          </div>
        </div>
      </ModernDialog>
    </div>
  );
}
