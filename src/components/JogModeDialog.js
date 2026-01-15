import React, { useState, useEffect } from 'react';
import { pulseBoolTag, writeBoolTag, writePLCVar } from '../services/plcApiService';
import '../styles/JogModeDialog.css';

export default function JogModeDialog({
  side = 'left', // 'left' or 'right'
  isActive = false,
  readyStatus = { id: false, od: false },
  actualPositions = { axis1: 0, axis2: 0 },
  onClose = () => {},
  onSwitchSide = () => {}
}) {
  const [selectedMode, setSelectedMode] = useState(null); // 'id', 'od', or null
  const [extending, setExtending] = useState(false);
  const [retracting, setRetracting] = useState(false);

  // Determine PLC tag prefixes
  const headPrefix = side === 'left' ? 'GLEFTHEAD' : 'GRIGHTHEAD';
  const headLabel = side === 'left' ? 'LEFT' : 'RIGHT';
  
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

  const tags = tagMappings[side];

  const handleSelectMode = (mode) => {
    setSelectedMode(mode);
  };

  const handleExtend = async () => {
    if (extending || !selectedMode) return;
    setExtending(true);
    try {
      // For ID (expand): pulse Extend button
      // For OD (red/reduction): pulse Extend button as well (to extend the red head)
      const tagToUse = selectedMode === 'id' ? tags.idPb : tags.idPb;
      await pulseBoolTag(tagToUse, 150);
    } catch (err) {
      console.error('[JogModeDialog] Extend failed:', err);
    } finally {
      setExtending(false);
    }
  };

  const handleRetract = async () => {
    if (retracting || !selectedMode) return;
    setRetracting(true);
    try {
      // For ID: use retract button
      // For OD: use OD retract button
      const tagToUse = selectedMode === 'id' ? tags.odPb : tags.odPb;
      await pulseBoolTag(tagToUse, 150);
    } catch (err) {
      console.error('[JogModeDialog] Retract failed:', err);
    } finally {
      setRetracting(false);
    }
  };

  const handleSwitchSide = async () => {
    const newSide = side === 'left' ? 'right' : 'left';
    try {
      // Enable jog for the new side
      await writePLCVar({ command: 'enableJog', side: newSide });
      onSwitchSide(newSide);
    } catch (err) {
      console.error('[JogModeDialog] Switch side failed:', err);
    }
  };

  if (!isActive) {
    return null;
  }

  const isIdReady = readyStatus.id;
  const isOdReady = readyStatus.od;
  const axisDisplay1 = actualPositions.axis1 ? actualPositions.axis1.toFixed(3) : '0.000';
  const axisDisplay2 = actualPositions.axis2 ? actualPositions.axis2.toFixed(3) : '0.000';

  return (
    <div className="jog-mode-overlay">
      <div className="jog-mode-dialog">
        {/* Header Banner */}
        <div className="jog-header-banner">
          <h2>{headLabel} SIDE JOG ACTIVE</h2>
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
              className={`mode-btn id-btn ${selectedMode === 'id' ? 'active' : ''} ${!isIdReady ? 'disabled' : ''}`}
              onClick={() => handleSelectMode('id')}
              disabled={!isIdReady}
              title={isIdReady ? 'ID (Expand) Mode' : 'ID not ready'}
            >
              ID {isIdReady ? '✓' : '✗'}
            </button>
            <button
              className={`mode-btn od-btn ${selectedMode === 'od' ? 'active' : ''} ${!isOdReady ? 'disabled' : ''}`}
              onClick={() => handleSelectMode('od')}
              disabled={!isOdReady}
              title={isOdReady ? 'OD (Reduction) Mode' : 'OD not ready'}
            >
              OD {isOdReady ? '✓' : '✗'}
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
              <p className="instruction">Push <strong>Extend Button</strong> to extend ID</p>
              <p className="instruction">Push <strong>Retract Button</strong> to retract ID</p>
            </div>
          )}
          {selectedMode === 'od' && isOdReady && (
            <div className="status-message ready">
              <p>✓ OD is ready to jog</p>
              <p className="instruction">Push <strong>Extend Button</strong> to extend OD</p>
              <p className="instruction">Push <strong>Retract Button</strong> to retract OD</p>
            </div>
          )}
        </div>

        {/* Jog Control Buttons */}
        {selectedMode && (
          <div className="jog-controls">
            <button
              className="jog-extend-btn"
              onClick={handleExtend}
              disabled={extending || !isIdReady && !isOdReady}
            >
              {extending ? '⏳ EXTENDING...' : '⬆️ EXTEND'}
            </button>
            <button
              className="jog-retract-btn"
              onClick={handleRetract}
              disabled={retracting || !isIdReady && !isOdReady}
            >
              {retracting ? '⏳ RETRACTING...' : '⬇️ RETRACT'}
            </button>
          </div>
        )}

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

        {/* Close Button */}
        <button
          className="jog-close-btn"
          onClick={onClose}
          title="Close jog mode dialog"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
