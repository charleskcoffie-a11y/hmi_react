import React, { useState } from 'react';
import { pulseBoolTag, writePLCVar } from '../services/plcApiService';
import '../styles/JogModeDialog.css';

function JogModeDialog({
  side = 'left', // 'left' or 'right'
  isActive = false,
  readyStatus = { id: false, od: false },
  actualPositions = { axis1: 0, axis2: 0 },
  strokes = { id: 0, od: 0 },
  modeFeedback = { runMode: false, jogMode: false }, // Add PLC feedback status
  onClose = () => {},
  onSwitchSide = () => {}
}) {
  const [selectedMode, setSelectedMode] = useState(null); // 'id', 'od', or null

  // PLC tag mappings
  const tagMappings = {
    left: {
      idPb: 'GLEFTHEAD.bHmiLeftExpPb',    // Extend (ID)
      odPb: 'GLEFTHEAD.bHmiLeftRedPb',    // Retract (OD)
      idReady: 'GLEFTHEAD.bHmiLeftExpEna',
      odReady: 'GLEFTHEAD.bHmiLeftRedEna'
    },
    right: {
      idPb: 'GRIGHTHEAD.bHmiRightExpPb',
      odPb: 'GRIGHTHEAD.bHmiRightRedPb',
      idReady: 'GRIGHTHEAD.bHmiRightExpEna',
      odReady: 'GRIGHTHEAD.bHmiRightRedEna'
    }
  };

  const handleSelectMode = async (mode) => {
    setSelectedMode(mode);
    
    // Pulse the PLC to enable the selected axis for jogging (momentary button)
    try {
      let index;
      if (mode === 'id') {
        // ID = Expand button: left=7, right=46
        index = side === 'left' ? 7 : 46;
      } else if (mode === 'od') {
        // OD = Reduction button: left=9, right=48
        index = side === 'left' ? 9 : 48;
      }
      
      if (index !== undefined) {
        console.log(`[JogModeDialog] Pulsing ${mode.toUpperCase()} enable index ${index}`);
        await fetch('http://localhost:3001/io/pulse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, durationMs: 500 })
        });
      }
    } catch (err) {
      console.error(`[JogModeDialog] Failed to enable ${mode}:`, err);
    }
  };



  const handleClose = async () => {
    try {
      // Pulse global jog-off tag so PLC exits jog mode
      console.log('[JogModeDialog] Pulsing GAXIS.bJogOff to exit jog mode');
      await pulseBoolTag('GAXIS.bJogOff', 500);
    } catch (err) {
      console.error('[JogModeDialog] Failed to clear jog mode:', err);
    } finally {
      onClose();
    }
  };

  const handleSwitchSide = async () => {
    const newSide = side === 'left' ? 'right' : 'left';
    try {
      // Step 1: Disable the current head to avoid both heads jogging together
      console.log(`[JogModeDialog] Disabling ${side} head...`);
      if (side === 'left') {
        // Disable left head
        await pulseBoolTag('GLEFTHEAD.bHmiLeftJogHeadEnabledOff', 500);
      } else {
        // Disable right head
        await pulseBoolTag('GRIGHTHEAD.bHmiRightJogHeadEnabledOff', 500);
      }
      
      // Brief delay to ensure head is disabled before enabling new one
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 2: Enable the new side
      console.log(`[JogModeDialog] Enabling ${newSide} head...`);
      await writePLCVar({ command: 'enableJog', side: newSide });
      
      // Step 3: Update the UI immediately - clear the selected mode for smooth transition
      setSelectedMode(null);
      
      console.log(`[JogModeDialog] Successfully switched to ${newSide} side`);
      onSwitchSide(newSide);
    } catch (err) {
      console.error('[JogModeDialog] Switch side failed:', err);
    }
  };

  const headLabel = side === 'left' ? 'LEFT' : 'RIGHT';

  if (!isActive) {
    return null;
  }

  const isIdReady = readyStatus.id;
  const isOdReady = readyStatus.od;
  const axisDisplay1 = actualPositions.axis1 ? actualPositions.axis1.toFixed(3) : '0.000';
  const axisDisplay2 = actualPositions.axis2 ? actualPositions.axis2.toFixed(3) : '0.000';

  const idStrokeMax = strokes?.id || 0;
  const odStrokeMax = strokes?.od || 0;
  const axis1Pct = idStrokeMax > 0 ? Math.max(0, Math.min(100, (actualPositions.axis1 / idStrokeMax) * 100)) : 0;
  const axis2Pct = odStrokeMax > 0 ? Math.max(0, Math.min(100, (actualPositions.axis2 / odStrokeMax) * 100)) : 0;

  return (
    <div className="jog-mode-overlay">
      <div className="jog-mode-dialog">
        {/* Header Banner */}
        <div className="jog-header-banner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <h2>{headLabel} SIDE JOG ACTIVE</h2>
            <div className={`head-jog-status ${modeFeedback?.jogMode ? 'confirmed' : 'waiting'}`}
              title={modeFeedback?.jogMode ? 'Head confirmed in jog mode on PLC' : 'Waiting for PLC to confirm jog mode'}
            >
              <span className="status-dot" />
              <span className="status-text">
                {modeFeedback?.jogMode ? 'HEAD JOG ON' : 'HEAD JOG PENDING'}
              </span>
            </div>
          </div>
        </div>

        {/* Side Selector Button */}
        <button
          className="jog-switch-side-btn"
          onClick={handleSwitchSide}
          title="Switch to the other side's jog mode"
        >
          Switch to {side === 'left' ? 'RIGHT' : 'LEFT'} Side
        </button>

        {/* ID/OD Selection Section */}
        <div className="jog-mode-selector">
          <h3>Select Jog Mode:</h3>
          <div className="mode-buttons">
            <button
              className={`mode-btn id-btn ${selectedMode === 'id' ? 'active' : ''}`}
              onClick={() => handleSelectMode('id')}
              title="ID (Expand) Mode - Pulse to enable"
            >
              ID {isIdReady ? '✓' : '◯'}
            </button>
            <button
              className={`mode-btn od-btn ${selectedMode === 'od' ? 'active' : ''}`}
              onClick={() => handleSelectMode('od')}
              title="OD (Reduction) Mode - Pulse to enable"
            >
              OD {isOdReady ? '✓' : '◯'}
            </button>
          </div>
        </div>

        {/* Ready Status Messages */}
        <div className="jog-status-section">
          {!selectedMode && (
            <div className="status-message waiting">
              <p>⚠️ Select either ID or OD above to begin jogging</p>
            </div>
          )}
          {selectedMode && !isIdReady && !isOdReady && (
            <div className="status-message waiting">
              <p>⏳ Waiting for {selectedMode.toUpperCase()} to be ready...</p>
            </div>
          )}
          {selectedMode === 'id' && isIdReady && (
            <div className="status-message ready">
              <p>✓ ID is ready to jog</p>
              <p className="instruction">Use physical buttons on machine to jog</p>
            </div>
          )}
          {selectedMode === 'od' && isOdReady && (
            <div className="status-message ready">
              <p>✓ OD is ready to jog</p>
              <p className="instruction">Use physical buttons on machine to jog</p>
            </div>
          )}
        </div>

        {/* Axis Position Display */}
        <div className="axis-position-display">
          <div className="axis-info">
            <span className="axis-label">Axis 1 Pos:</span>
            <span className="axis-value">{axisDisplay1}</span>
          </div>
          <div className="axis-info">
            <span className="axis-label">Axis 2 Pos:</span>
            <span className="axis-value">{axisDisplay2}</span>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="progress-section">
          <div className={`progress-item ${selectedMode === 'id' ? 'active' : ''}`}>
            <div className="progress-label">
              <span>Axis 1 Progress</span>
              <span>{idStrokeMax > 0 ? `${axisDisplay1} / ${idStrokeMax.toFixed(3)}` : `${axisDisplay1} / --`}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill id" style={{ width: `${axis1Pct}%` }} />
            </div>
          </div>
          <div className={`progress-item ${selectedMode === 'od' ? 'active' : ''}`}>
            <div className="progress-label">
              <span>Axis 2 Progress</span>
              <span>{odStrokeMax > 0 ? `${axisDisplay2} / ${odStrokeMax.toFixed(3)}` : `${axisDisplay2} / --`}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill od" style={{ width: `${axis2Pct}%` }} />
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          className="jog-close-btn"
          onClick={handleClose}
          title="Close jog mode and exit on PLC"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}

export default React.memo(JogModeDialog, (prevProps, nextProps) => {
  // Custom equality check - only re-render if these specific props change
  return (
    prevProps.side === nextProps.side &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.actualPositions.axis1 === nextProps.actualPositions.axis1 &&
    prevProps.actualPositions.axis2 === nextProps.actualPositions.axis2 &&
    prevProps.readyStatus.id === nextProps.readyStatus.id &&
    prevProps.readyStatus.od === nextProps.readyStatus.od &&
    prevProps.modeFeedback.jogMode === nextProps.modeFeedback.jogMode &&
    prevProps.strokes.id === nextProps.strokes.id &&
    prevProps.strokes.od === nextProps.strokes.od
  );
});
