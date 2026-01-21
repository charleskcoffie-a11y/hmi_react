import React, { useState, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import NumericKeypad from './NumericKeypad';
import { pulseBoolTag } from '../services/plcApiService';
import '../styles/ProgramCreationStep1.css';

export default function ProgramCreationStep1({ programName, side, onPositionRecorded, onCancel }) {
  const [dwell, setDwell] = useState('');
  const [jogMode, setJogMode] = useState(true);
  const [axis1Value, setAxis1Value] = useState(0);
  const [axis2Value, setAxis2Value] = useState(0);
  const [axis1Recorded, setAxis1Recorded] = useState(false);
  const [axis2Recorded, setAxis2Recorded] = useState(false);
  const [recordedPositions, setRecordedPositions] = useState({});
  const [stepMessage, setStepMessage] = useState('');
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState(null);
  const [keypadVal, setKeypadVal] = useState(0);
  const [axesEnabled, setAxesEnabled] = useState(false); // MUST BE FALSE - requires manual enable
  const [enablingAxes, setEnablingAxes] = useState(false);

  const isLeftSide = side === 'left';
  const idTag = isLeftSide ? 'GLEFTHEAD.bHmiLeftExpPb' : 'GRIGHTHEAD.bHmiRightExpPb';
  const odTag = isLeftSide ? 'GLEFTHEAD.bHmiLeftRedPb' : 'GRIGHTHEAD.bHmiRightRedPb';

  useEffect(() => {
    setJogMode(true);
    // IMPORTANT: Do NOT set axesEnabled = true. User must click yellow button to enable.
    console.log('[Step1] Component mounted. axesEnabled:', false);
  }, []);

  const handleEnableAxes = async () => {
    setEnablingAxes(true);
    try {
      await pulseBoolTag(idTag, 200);
      await pulseBoolTag(odTag, 200);
      setAxesEnabled(true);
      setStepMessage('✓ ID and OD axes enabled');
      setTimeout(() => setStepMessage(''), 3000);
      console.log('[Step1] ID and OD manually enabled');
    } catch (error) {
      console.error('[Step1] Error enabling axes:', error);
      setStepMessage('✗ Failed to enable axes');
      setTimeout(() => setStepMessage(''), 3000);
    } finally {
      setEnablingAxes(false);
    }
  };

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
    if (!axesEnabled) {
      setDialog({ open: true, title: 'Axes Not Enabled', message: 'Please enable ID and OD axes before continuing.' });
      return;
    }
    if (!axis1Recorded || !axis2Recorded) {
      setDialog({ open: true, title: 'Positions Required', message: 'Please record positions for both axes before continuing.' });
      return;
    }

    onPositionRecorded({
      programName,
      side,
      step: 1,
      stepName: 'Position Recording',
      positions: recordedPositions,
      timestamp: new Date().toISOString()
    });
  };

  const canComplete = axesEnabled && axis1Recorded && axis2Recorded;

  // Debug logging
  console.log('[Step1] Rendering - axesEnabled:', axesEnabled, 'axis1Recorded:', axis1Recorded, 'axis2Recorded:', axis2Recorded);

  return (
    <div className="program-creation-step1">
      <div className="step1-header">
        <div className="step-info">
          <h2>Program: {programName}</h2>
          <p className="step-subtitle">{sideLabel} - Step 1: Position Recording</p>
        </div>
        <button className="close-btn" onClick={onCancel}>✕</button>
      </div>

      <div className="step1-content">
        <div className="mode-indicator">
          {jogMode && <div className="jog-active">🎮 JOG MODE ACTIVE</div>}
        </div>

        {/* Axes Enable Status - SHOW YELLOW BUTTON WHEN axesEnabled=false */}
        <div className="axes-enable-status">
          {axesEnabled === true ? (
            // GREEN CHECKMARK - User has enabled axes
            <div className="axes-enabled">✓ ID and OD Axes Enabled</div>
          ) : (
            // YELLOW BUTTON - Default state, awaiting user click
            <button
              className="enable-axes-btn"
              onClick={handleEnableAxes}
              disabled={enablingAxes}
            >
              {enablingAxes ? 'Enabling...' : '⚙️ Enable ID/OD Axes'}
            </button>
          )}
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
                onFocus={() => { setKeypadTarget({ field: 'axis1' }); setKeypadVal(axis1Value); setKeypadOpen(true); }}
                readOnly
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
                onFocus={() => { setKeypadTarget({ field: 'axis2' }); setKeypadVal(axis2Value); setKeypadOpen(true); }}
                readOnly
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
      </div>

      {stepMessage && (
        <div className="step-message">
          {stepMessage}
        </div>
      )}

      <div className="dwell-input-row">
        <label>Dwell (ms, optional for this step):</label>
        <input
          type="number"
          min="0"
          value={dwell}
          onFocus={() => { setKeypadTarget({ field: 'dwell' }); setKeypadVal(parseFloat(dwell || '0')); setKeypadOpen(true); }}
          readOnly
          placeholder="Enter dwell for this step"
        />
      </div>
      <div className="step1-footer">
        <div className="step-progress">
          <span className="progress-item">
            <strong>Step 1:</strong> Position Recording
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

        <div className="step-actions">
          <button
            className="complete-btn"
            onClick={handleComplete}
            disabled={!canComplete}
          >
            ✓ Continue to Next Step
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

      <NumericKeypad
        isOpen={keypadOpen}
        title={keypadTarget?.field === 'dwell' ? 'Enter Dwell (ms)' : 'Enter Position (mm)'}
        unit={keypadTarget?.field === 'dwell' ? 'ms' : 'mm'}
        initialValue={keypadVal}
        decimals={keypadTarget?.field === 'dwell' ? 0 : 2}
        allowNegative={false}
        onSubmit={(num) => {
          if (keypadTarget?.field === 'axis1') setAxis1Value(num);
          else if (keypadTarget?.field === 'axis2') setAxis2Value(num);
          else if (keypadTarget?.field === 'dwell') setDwell(String(num));
          setKeypadOpen(false);
          setKeypadTarget(null);
        }}
        onCancel={() => { setKeypadOpen(false); setKeypadTarget(null); }}
      />
    </div>
  );
}
