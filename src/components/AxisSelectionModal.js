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
}) {
  const [enabledAxis, setEnabledAxis] = useState(null); // 'id' or 'od'

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

  const handleAxisEnable = (axis) => {
    console.log('[AxisSelectionModal] handleAxisEnable called with axis:', axis);
    setEnabledAxis(axis);
    console.log('[AxisSelectionModal] enabledAxis updated to:', axis);
  };

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
                handleAxisEnable('id');
              }}
            >
              <div className="axis-label">{enabledAxis === 'id' ? '✓ ID' : '📍 ID'}</div>
            </button>
          )}
          {showOD && (
            <button
              className={`axis-button od-button ${enabledAxis === 'od' ? 'active' : ''}`}
              onClick={() => {
                console.log('[AxisSelectionModal] OD button clicked');
                handleAxisEnable('od');
              }}
            >
              <div className="axis-label">{enabledAxis === 'od' ? '✓ OD' : '📍 OD'}</div>
            </button>
          )}
        </div>
        <div className="axis-instructions">Move axis using jog controls, then click Confirm</div>
      </div>
    </ModernDialog>
  );
}
