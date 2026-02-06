import React, { useEffect, useMemo, useState } from 'react';
import ModernDialog from './ModernDialog';
import '../styles/AxisSelectionModal.css';

export default function AxisSelectionModal({
  isOpen,
  onClose,
  onSelectAxis,
  side,
  patternCode,
  stepNumber,
  lastFeedback = [], // Receive feedback from parent
  onAxisClick = null, // Callback when axis button clicked (for immediate pulse)
  jogSpeed = 100, // Speed percentage (10-100), default 100%
}) {
  const [enabledAxis, setEnabledAxis] = useState(null); // 'id' or 'od'
  const [enabling, setEnabling] = useState(false); // Track if currently enabling
  const [localSpeed, setLocalSpeed] = useState(jogSpeed); // Local speed override

  const axes = useMemo(() => {
    const code = Number(patternCode);
    switch (code) {
      case 0:
      case 1:
        return 'od';
      case 2:
      case 3:
        return 'id';
      case 4:
      case 6:
        return 'both';
      default:
        return 'both';
    }
  }, [patternCode]);

  // Sync local speed with prop when jogSpeed changes
  useEffect(() => {
    setLocalSpeed(jogSpeed);
  }, [jogSpeed, isOpen]);

  // Write local speed to PLC when it changes
  useEffect(() => {
    const writeSpeed = async () => {
      if (!isOpen || !side) return;
      try {
        const speedTag = side === 'left' ? 'GLEFTHEAD.lHmileftJogSpd' : 'GRIGHTHEAD.lHmiRightJogSpd';
        await fetch('http://localhost:3001/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: speedTag, value: localSpeed })
        });
        console.log(`[AxisSelectionModal] Wrote jog speed ${localSpeed}% to ${speedTag}`);
      } catch (err) {
        console.warn('[AxisSelectionModal] Failed to write jog speed to PLC:', err.message);
      }
    };
    writeSpeed();
  }, [localSpeed, side, isOpen]);

  const showID = axes === 'id' || axes === 'both';
  const showOD = axes === 'od' || axes === 'both';

  const handleConfirm = () => {
    // console.log('[AxisSelectionModal] handleConfirm called with enabledAxis:', enabledAxis);
    if (enabledAxis) {
      // console.log('[AxisSelectionModal] Calling onSelectAxis with:', enabledAxis);
      onSelectAxis(enabledAxis);
      setEnabledAxis(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setEnabledAxis(null);
    onClose();
  };

  const renderFeedbackStatus = () => {
    if (!lastFeedback?.length) return null;
    return (
      <div className="axis-feedback-status">
        <div className="feedback-label">PLC Status:</div>
        {lastFeedback.map((f) => (
          <span key={f.tag} className={f.value ? 'ok' : 'bad'}>
            {f.tag.split('.').slice(-1)[0]}: {f.value ? '✓ ON' : '◯ OFF'}
          </span>
        ))}
      </div>
    );
  };

  const handleAxisClick = async (axis) => {
    // console.log('[AxisSelectionModal] Axis button clicked, calling onAxisClick:', axis);
    setEnabling(true);
    try {
      // Call parent to pulse and enable the axis (same as Step 1 Enable button)
      if (onAxisClick) {
        await onAxisClick(axis, localSpeed);
      }
      setEnabledAxis(axis);
      // console.log('[AxisSelectionModal] Axis enable completed for:', axis);
    } catch (err) {
      console.error('[AxisSelectionModal] Error enabling axis:', err);
    } finally {
      setEnabling(false);
    }
  };

  return (
    <ModernDialog
      isOpen={isOpen}
      title={`Select Axis for Step ${stepNumber ?? ''}`}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmText="Record"
      cancelText="Cancel"
      confirmDisabled={!enabledAxis}
    >
      <div className="axis-selection-modal-content">
        <div className="axis-buttons-container">
          {showID && (
            <button
              className={`axis-button id-button ${enabledAxis === 'id' ? 'active' : ''}`}
              onClick={() => {
                // console.log('[AxisSelectionModal] ID button clicked');
                handleAxisClick('id');
              }}
              disabled={enabling}
            >
              <div className="axis-label">{enabling && enabledAxis === 'id' ? '⏳ Enabling...' : enabledAxis === 'id' ? '✓ ID' : '📍 ID'}</div>
            </button>
          )}
          {showOD && (
            <button
              className={`axis-button od-button ${enabledAxis === 'od' ? 'active' : ''}`}
              onClick={() => {
                // console.log('[AxisSelectionModal] OD button clicked');
                handleAxisClick('od');
              }}
              disabled={enabling}
            >
              <div className="axis-label">{enabling && enabledAxis === 'od' ? '⏳ Enabling...' : enabledAxis === 'od' ? '✓ OD' : '📍 OD'}</div>
            </button>
          )}
        </div>
        {/* Jog Speed Slider */}
        <div className="axis-speed-slider-container">
          <label htmlFor="axis-speed-slider" className="speed-slider-label">
            Jog Speed: {localSpeed}%
          </label>
          <input
            id="axis-speed-slider"
            type="range"
            min="10"
            max="100"
            step="5"
            value={localSpeed}
            onChange={(e) => setLocalSpeed(Number(e.target.value))}
            className="axis-speed-slider"
            title="Adjust jog speed for this movement (10% = slow, 100% = fast)"
          />
          <div className="speed-slider-legend">
            <span className="legend-slow">Slow</span>
            <span className="legend-fast">Fast</span>
          </div>
        </div>
        {/* Clear axis condition label to mirror right/left head behavior */}
        <div className="axis-condition-label">
          {enabledAxis ? `Selected Axis: ${enabledAxis.toUpperCase()}` : 'Select an axis to enable'}
        </div>
        <div className="axis-instructions">Move axis using jog controls, then click Confirm</div>
        {renderFeedbackStatus()}
      </div>
    </ModernDialog>
  );
}
