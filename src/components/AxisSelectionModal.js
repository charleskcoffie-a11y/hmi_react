import React, { useMemo, useState } from 'react';
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
}) {
  const [enabledAxis, setEnabledAxis] = useState(null); // 'id' or 'od'
  const [enabling, setEnabling] = useState(false); // Track if currently enabling

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

  const showID = axes === 'id' || axes === 'both';
  const showOD = axes === 'od' || axes === 'both';

  const handleConfirm = () => {
    console.log('[AxisSelectionModal] handleConfirm called with enabledAxis:', enabledAxis);
    if (enabledAxis) {
      console.log('[AxisSelectionModal] Calling onSelectAxis with:', enabledAxis);
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
    console.log('[AxisSelectionModal] Axis button clicked, calling onAxisClick:', axis);
    setEnabling(true);
    try {
      // Call parent to pulse and enable the axis (same as Step 1 Enable button)
      if (onAxisClick) {
        await onAxisClick(axis);
      }
      setEnabledAxis(axis);
      console.log('[AxisSelectionModal] Axis enable completed for:', axis);
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
                console.log('[AxisSelectionModal] ID button clicked');
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
                console.log('[AxisSelectionModal] OD button clicked');
                handleAxisClick('od');
              }}
              disabled={enabling}
            >
              <div className="axis-label">{enabling && enabledAxis === 'od' ? '⏳ Enabling...' : enabledAxis === 'od' ? '✓ OD' : '📍 OD'}</div>
            </button>
          )}
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
