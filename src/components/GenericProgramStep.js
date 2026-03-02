import React, { useState } from 'react';
import ModernDialog from './ModernDialog';
import { validatePosition, getMachineParameters } from '../services/positionValidationService';
import '../styles/GenericProgramStep.css';

export default function GenericProgramStep({ 
  programName, 
  side, 
  stepNumber, 
  stepName,
  description,
  onStepComplete, 
  onCancel, 
  onPrevious 
}) {
  const [jogMode] = useState(true);
  const [axis1Value, setAxis1Value] = useState(0);
  const [axis2Value, setAxis2Value] = useState(0);
  const [axis1Recorded, setAxis1Recorded] = useState(false);
  const [axis2Recorded, setAxis2Recorded] = useState(false);
  const [recordedPositions, setRecordedPositions] = useState({});
  const [stepMessage, setStepMessage] = useState('');
  const [patternCode, setPatternCode] = useState(8); // Default to All off
  const [dwell, setDwell] = useState('');
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [enablingAxis, setEnablingAxis] = useState(false);
  const [axisFeedback, setAxisFeedback] = useState([]);
  const [axis1Warning, setAxis1Warning] = useState('');
  const [axis2Warning, setAxis2Warning] = useState('');
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const sideLabel = side === 'right' ? 'Right Side' : 'Left Side';
  const axis1Name = 'ID';
  const axis2Name = 'OD';

  const handleAxis1Enable = async () => {
    console.log('[GenericProgramStep] ===== handleAxis1Enable CLICKED =====');
    console.log('[GenericProgramStep] Side:', side, 'jogMode:', jogMode, 'enablingAxis:', enablingAxis);
    await enableAxisWithFeedback('id');
  };

  const handleAxis2Enable = async () => {
    console.log('[GenericProgramStep] ===== handleAxis2Enable CLICKED =====');
    console.log('[GenericProgramStep] Side:', side, 'jogMode:', jogMode, 'enablingAxis:', enablingAxis);
    await enableAxisWithFeedback('od');
  };

  const enableAxisWithFeedback = async (axis) => {
    console.log('[GenericProgramStep] ===== ENABLE AXIS WITH FEEDBACK START =====');
    console.log('[GenericProgramStep] Enabling axis:', axis, 'side:', side);
    setEnablingAxis(true);
    setAxisFeedback([]); // Clear previous feedback
    
    try {
      // Check backend connection first
      console.log('[GenericProgramStep] Checking backend connection to http://localhost:3001/status');
      try {
        const statusResp = await fetch('http://localhost:3001/status');
        const statusData = await statusResp.json();
        console.log('[GenericProgramStep] Backend status:', statusData);
        if (!statusData.connected) {
          throw new Error('PLC backend not connected');
        }
      } catch (connErr) {
        console.error('[GenericProgramStep] Backend connection check FAILED:', connErr.message);
        throw new Error(`Cannot connect to PLC backend at http://localhost:3001: ${connErr.message}`);
      }
      
      const idTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpPb' : 'GRIGHTHEAD.bHmiRightExpPb';
      const odTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedPb' : 'GRIGHTHEAD.bHmiRightRedPb';
      const idReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpEna' : 'GRIGHTHEAD.bHmiRightExpEna';
      const odReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedEna' : 'GRIGHTHEAD.bHmiRightRedEna';

      const tagToPulse = axis === 'id' ? idTag : odTag;
      const readyTag = axis === 'id' ? idReadyTag : odReadyTag;
      
      console.log('[GenericProgramStep] Pulsing tag:', tagToPulse);
      
      // Pulse the PLC tag
      const response = await fetch('http://localhost:3001/pulse-bool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagToPulse, durationMs: 200 })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GenericProgramStep] Pulse HTTP error:', errorText);
        throw new Error(`HTTP error: ${response.status} for tag ${tagToPulse}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || `PLC pulse failed for ${tagToPulse}`);
      }
      
      console.log('[GenericProgramStep] Pulse success, polling feedback tag:', readyTag);

      // Poll for feedback with 3-second timeout, 150ms interval
      const deadline = Date.now() + 3000;
      let feedbackOk = false;
      
      while (Date.now() < deadline) {
        try {
          const resp = await fetch(`http://localhost:3001/read?tag=${encodeURIComponent(readyTag)}`);
          if (resp.ok) {
            const json = await resp.json();
            const raw = json?.value;
            const value = raw === true || raw === 1 || raw === 'true' || raw === 'TRUE';
            
            console.log('[GenericProgramStep] Feedback poll:', readyTag, 'raw:', raw, 'value:', value);
            
            // Update feedback for UI display
            setAxisFeedback([{ tag: readyTag, ok: true, value }]);
            
            if (value === true) {
              console.log('[GenericProgramStep] ✓ Axis', axis, 'enabled successfully - feedback confirmed TRUE');
              feedbackOk = true;
              setEnablingAxis(false);
              return true;
            }
          }
        } catch (e) {
          console.warn('[GenericProgramStep] Feedback poll error:', e?.message);
        }
        await new Promise((res) => setTimeout(res, 150));
      }
      
      // Timeout reached without getting TRUE feedback
      setAxisFeedback([{ tag: readyTag, ok: true, value: false }]);
      throw new Error(`Timeout waiting for ${axis.toUpperCase()} feedback (${readyTag}). PLC not responding or axis not enabled.`);
      
    } catch (err) {
      console.error('[GenericProgramStep] Error enabling axis:', err?.message);
      setStepMessage(`❌ ${err.message}`);
      setTimeout(() => setStepMessage(''), 5000);
      setEnablingAxis(false);
      return false;
    }
  };

  const handleAxis1Record = () => {
    const validation = validatePosition(axis1Value, axis1Name);
    
    if (!validation.isValid) {
      const params = getMachineParameters();
      const min = params.minPosition ?? 0;
      const max = params.maxPosition ?? 100;
      setValidationMessage(
        `${axis1Name} position ${axis1Value.toFixed(2)} is invalid.\nValid range: ${min.toFixed(2)} to ${max.toFixed(2)}`
      );
      setValidationDialogOpen(true);
      setAxis1Warning(validation.message);
      return;
    }
    
    setAxis1Recorded(true);
    setAxis1Warning('');
    setRecordedPositions(prev => ({
      ...prev,
      [axis1Name]: axis1Value
    }));
    setStepMessage(`✓ ${axis1Name} position recorded: ${axis1Value.toFixed(2)} mm`);
    setTimeout(() => setStepMessage(''), 3000);
  };

  const handleAxis2Record = () => {
    const validation = validatePosition(axis2Value, axis2Name);
    
    if (!validation.isValid) {
      const params = getMachineParameters();
      const min = params.minPosition ?? 0;
      const max = params.maxPosition ?? 100;
      setValidationMessage(
        `${axis2Name} position ${axis2Value.toFixed(2)} is invalid.\nValid range: ${min.toFixed(2)} to ${max.toFixed(2)}`
      );
      setValidationDialogOpen(true);
      setAxis2Warning(validation.message);
      return;
    }
    
    setAxis2Recorded(true);
    setAxis2Warning('');
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
    
    const val1 = validatePosition(axis1Value, axis1Name);
    const val2 = validatePosition(axis2Value, axis2Name);
    
    if (!val1.isValid || !val2.isValid) {
      const messages = [val1.isValid ? '' : val1.message, val2.isValid ? '' : val2.message].filter(Boolean).join('\n');
      setValidationMessage(`Cannot proceed:\n${messages}`);
      setValidationDialogOpen(true);
      return;
    }

    const dwellMs = Number.isFinite(parseFloat(dwell))
      ? parseFloat(dwell)
      : ([1, 3, 4].includes(patternCode) ? 0 : 500);

    onStepComplete({
      step: stepNumber,
      stepName: stepName,
      positions: recordedPositions,
      pattern: patternCode,
      dwell: dwellMs,
      timestamp: new Date().toISOString()
    });
  };

  const canComplete = axis1Recorded && axis2Recorded;
  const isLastStep = stepNumber === 10;

  return (
    <div className="generic-program-step">
      <div className="step-header">
        <div className="step-info">
          <h2>Program: {programName}</h2>
          <p className="step-subtitle">{sideLabel} - Step {stepNumber}: {stepName}</p>
          <p className="step-description">{description}</p>
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
              {enablingAxis && <span className="enabling-badge">⏳ Enabling...</span>}
            </div>

            <div className="axis-display">
              <div className="position-label">Current Position</div>
              <div className="position-value">{axis1Value.toFixed(2)} mm</div>
              {axis1Warning && (
                <div style={{
                  color: '#ff6b6b',
                  fontSize: '12px',
                  marginTop: '8px',
                  padding: '6px',
                  backgroundColor: 'rgba(255, 107, 107, 0.15)',
                  borderRadius: '4px',
                  fontWeight: '600'
                }}>
                  {axis1Warning}
                </div>
              )}
            </div>

            {axisFeedback.length > 0 && (
              <div className="feedback-status">
                {axisFeedback.map((f, i) => (
                  <div key={i} className={`feedback-item ${f.value ? 'success' : 'pending'}`}>
                    {f.value ? '✓ Enabled' : '⏳ Waiting...'}
                  </div>
                ))}
              </div>
            )}

            <div className="jog-controls-large">
              <button
                className="jog-btn-large enable"
                onClick={() => handleAxis1Enable()}
                disabled={!jogMode || enablingAxis}
                title="Enable ID axis - use physical Extend button to move"
              >
                📡 ID (Exp Ext)
              </button>
            </div>

            <div className="step-input-container">
              <input
                type="number"
                value={axis1Value}
                onChange={(e) => setAxis1Value(parseFloat(e.target.value))}
                placeholder="Manual entry"
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
              {enablingAxis && <span className="enabling-badge">⏳ Enabling...</span>}
            </div>

            <div className="axis-display">
              <div className="position-label">Current Position</div>
              <div className="position-value">{axis2Value.toFixed(2)} mm</div>
              {axis2Warning && (
                <div style={{
                  color: '#ff6b6b',
                  fontSize: '12px',
                  marginTop: '8px',
                  padding: '6px',
                  backgroundColor: 'rgba(255, 107, 107, 0.15)',
                  borderRadius: '4px',
                  fontWeight: '600'
                }}>
                  {axis2Warning}
                </div>
              )}
            </div>

            {axisFeedback.length > 0 && (
              <div className="feedback-status">
                {axisFeedback.map((f, i) => (
                  <div key={i} className={`feedback-item ${f.value ? 'success' : 'pending'}`}>
                    {f.value ? '✓ Enabled' : '⏳ Waiting...'}
                  </div>
                ))}
              </div>
            )}

            <div className="jog-controls-large">
              <button
                className="jog-btn-large enable"
                onClick={() => handleAxis2Enable()}
                disabled={!jogMode || enablingAxis}
                title="Enable OD axis - use physical Retract button to move"
              >
                📡 OD (Red Ext)
              </button>
            </div>

            <div className="step-input-container">
              <input
                type="number"
                value={axis2Value}
                onChange={(e) => setAxis2Value(parseFloat(e.target.value))}
                placeholder="Manual entry"
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
          <label htmlFor={`pattern-step-${stepNumber}`}>Step Pattern</label>
          <select
            id={`pattern-step-${stepNumber}`}
            value={patternCode}
            onChange={(e) => setPatternCode(parseInt(e.target.value, 10))}
          >
            <option value={0}>0 - OD Ext</option>
            <option value={1}>1 - OD Ret</option>
            <option value={2}>2 - ID Ext</option>
            <option value={3}>3 - ID Ret</option>
            <option value={4}>4 - OD Ret + ID Ret</option>
            <option value={5}>5 - Repeat</option>
            <option value={6}>6 - OD Ext + ID Ext</option>
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
            <strong>Step {stepNumber}:</strong> {stepName}
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
            {isLastStep ? '✓ Complete Program' : '✓ Next Step'}
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
      
      <ModernDialog
        isOpen={validationDialogOpen}
        title="Position Out of Range"
        onClose={() => setValidationDialogOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ whiteSpace: 'pre-line', color: '#ff6b6b', fontWeight: '600' }}>{validationMessage}</span>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setValidationDialogOpen(false)}>Close</button>
          </div>
        </div>
      </ModernDialog>
    </div>
  );
}
