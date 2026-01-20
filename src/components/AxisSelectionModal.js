import React, { useState } from 'react';
import ModernDialog from './ModernDialog';
import { pulseBoolTag } from '../services/plcApiService';
import '../styles/AxisSelectionModal.css';

export default function AxisSelectionModal({
  isOpen,
  onClose,
  onSelectAxis,
  side,
  patternCode,
}) {
  const [enabledAxis, setEnabledAxis] = useState(null); // 'id' or 'od'

  const isLeftSide = side === 'left';
  const idTag = isLeftSide ? 'GLEFTHEAD.bHmiLeftExpPb' : 'GRIGHTHEAD.bHmiRightExpPb';
  const odTag = isLeftSide ? 'GLEFTHEAD.bHmiLeftRedPb' : 'GRIGHTHEAD.bHmiRightRedPb';

  const handleAxisEnable = async (axis) => {
    const axisTag = axis === 'id' ? idTag : odTag;
    try {
      await pulseBoolTag(axisTag, 200);
      setEnabledAxis(axis);
    } catch (error) {
      console.error(`[AxisSelectionModal] Error enabling ${axis}:`, error);
    }
  };

  const handleConfirm = () => {
    if (enabledAxis) {
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
      title={`Select Axis for Step ${patternCode}`}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      confirmDisabled={!enabledAxis}
    >
      <div className="axis-selection-modal-content">
        <div className="axis-buttons-container">
          <button
            className={`axis-button id-button ${enabledAxis === 'id' ? 'active' : ''}`}
            onClick={() => handleAxisEnable('id')}
          >
            <div className="axis-label">{enabledAxis === 'id' ? '✓ ID' : '📍 ID'}</div>
          </button>
          <button
            className={`axis-button od-button ${enabledAxis === 'od' ? 'active' : ''}`}
            onClick={() => handleAxisEnable('od')}
          >
            <div className="axis-label">{enabledAxis === 'od' ? '✓ OD' : '📍 OD'}</div>
          </button>
        </div>
        <div className="axis-instructions">Move axis using jog controls, then click Confirm</div>
      </div>
    </ModernDialog>
  );
}
