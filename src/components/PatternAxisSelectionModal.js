import React, { useState, useRef, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import '../styles/AxisSelectionModal.css';

export default function PatternAxisSelectionModal({
  isOpen,
  onClose,
  onSelectAxis,
  side,
  patternCode,
  stepNumber,
  lastFeedback = [],
}) {
  const [selectedAxis, setSelectedAxis] = useState(null);
  const [enabling, setEnabling] = useState(false);
  const pollTimeoutRef = useRef(null);

  const patternCode_num = Number(patternCode);
  
  // Determine which axes are available for this pattern
  const axes = (() => {
    switch (patternCode_num) {
      case 0:
      case 1:
        return 'od'; // Red Ext / Red Ret - use OD axis
      case 2:
      case 3:
        return 'id'; // Exp Ext / Exp Ret - use ID axis
      case 4:
      case 6:
        return 'both'; // RedRet + ExpRet / RedExt + ExpExt - both
      default:
        return 'both';
    }
  })();

  const showID = axes === 'id' || axes === 'both';
  const showOD = axes === 'od' || axes === 'both';

  const handleConfirm = () => {
    if (selectedAxis) {
      onSelectAxis(selectedAxis);
      setSelectedAxis(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedAxis(null);
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
    console.log('[PatternAxisSelectionModal] Axis button clicked, triggering PLC write for axis:', axis);
    setEnabling(true);
    
    try {
      // Trigger PLC write and wait for feedback
      if (onSelectAxis) {
        await onSelectAxis(axis, true); // Pass true to indicate we want to trigger PLC
      }
      setSelectedAxis(axis);
      console.log('[PatternAxisSelectionModal] Axis enable completed for:', axis);
    } catch (err) {
      console.error('[PatternAxisSelectionModal] Error enabling axis:', err);
    } finally {
      setEnabling(false);
    }
  };

  return (
    <ModernDialog
      isOpen={isOpen}
      title={`Select Axis for Step ${stepNumber ?? ''} - Pattern ${patternCode_num}`}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmText="Confirm"
      cancelText="Cancel"
      confirmDisabled={!selectedAxis}
    >
      <div className="axis-selection-modal-content">
        <div className="axis-buttons-container">
          {showID && (
            <button
              className={`axis-button id-button ${selectedAxis === 'id' ? 'active' : ''}`}
              onClick={() => handleAxisClick('id')}
              disabled={enabling}
              title="Enable and test ID axis"
            >
              <div className="axis-label">
                {enabling && selectedAxis === 'id' ? '⏳ Enabling...' : selectedAxis === 'id' ? '✓ ID' : '📍 ID'}
              </div>
            </button>
          )}
          {showOD && (
            <button
              className={`axis-button od-button ${selectedAxis === 'od' ? 'active' : ''}`}
              onClick={() => handleAxisClick('od')}
              disabled={enabling}
              title="Enable and test OD axis"
            >
              <div className="axis-label">
                {enabling && selectedAxis === 'od' ? '⏳ Enabling...' : selectedAxis === 'od' ? '✓ OD' : '📍 OD'}
              </div>
            </button>
          )}
        </div>
        <div className="axis-condition-label">
          {selectedAxis ? `Selected Axis: ${selectedAxis.toUpperCase()}` : 'Select an axis to enable for this pattern'}
        </div>
        <div className="axis-instructions">Click to enable axis, wait for PLC feedback, then click Confirm</div>
        {renderFeedbackStatus()}
      </div>
    </ModernDialog>
  );
}
