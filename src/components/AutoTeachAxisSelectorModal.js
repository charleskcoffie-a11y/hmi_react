import React, { useEffect, useState } from 'react';
import { pulseBoolTag } from '../services/plcApiService';
import '../styles/AutoTeachAxisSelectorModal.css';

function AutoTeachAxisSelectorModal({
  isOpen,
  onClose,
  patternName,
  side,
  jogReadyStatus
}) {
  const [selectedAxis, setSelectedAxis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ id: false, od: false });

  // Map side to correct PLC tags
  const getAxisTags = () => {
    const tagMap = {
      left: {
        idPb: 'GLEFTHEAD.bHmiLeftExpPb',
        odPb: 'GLEFTHEAD.bHmiLeftRedPb',
        idEna: 'GLEFTHEAD.bHmiLeftExpEna',
        odEna: 'GLEFTHEAD.bHmiLeftRedEna'
      },
      right: {
        idPb: 'GRIGHTHEAD.bHmiRightExpPb',
        odPb: 'GRIGHTHEAD.bHmiRightRedPb',
        idEna: 'GRIGHTHEAD.bHmiRightExpEna',
        odEna: 'GRIGHTHEAD.bHmiRightRedEna'
      }
    };
    return tagMap[side] || tagMap.right;
  };

  const tags = getAxisTags();

  // Update feedback from jogReadyStatus
  useEffect(() => {
    if (jogReadyStatus) {
      setFeedback({
        id: jogReadyStatus.id || false,
        od: jogReadyStatus.od || false
      });
    }
  }, [jogReadyStatus]);

  const handleSelectAxis = async (axis) => {
    setLoading(true);
    try {
      const tagToPulse = axis === 'id' ? tags.idPb : tags.odPb;
      console.log(`[AutoTeachAxisSelector] Enabling ${axis.toUpperCase()} for ${side} side, pulsing ${tagToPulse}`);
      await pulseBoolTag(tagToPulse, 200);
      setSelectedAxis(axis);
      console.log(`[AutoTeachAxisSelector] ${axis.toUpperCase()} pulse sent successfully`);
    } catch (err) {
      console.error(`[AutoTeachAxisSelector] Failed to enable ${axis}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedAxis) {
      onClose(selectedAxis);
    }
  };

  if (!isOpen) return null;

  const headLabel = side === 'left' ? 'LEFT' : 'RIGHT';
  const activeAxis = feedback.id ? 'id' : feedback.od ? 'od' : null;

  return (
    <div className="axis-selector-modal-overlay">
      <div className="axis-selector-modal">
        <div className="axis-selector-header">
          <h2>Select Axis to Teach</h2>
          <p className="pattern-info">Pattern: <strong>{patternName}</strong></p>
          <p className="side-info">{headLabel} Side</p>
        </div>

        <div className="axis-selector-content">
          <p className="instructions">Choose which axis to teach first using the physical Extend/Retract buttons</p>
          
          <div className="axis-buttons-group">
            <button
              className={`axis-btn id-btn ${selectedAxis === 'id' ? 'selected' : ''} ${loading ? 'loading' : ''}`}
              onClick={() => handleSelectAxis('id')}
              disabled={loading}
              title="Enable ID (Extend) axis"
            >
              <span className="axis-icon">📐</span>
              <span className="axis-name">ID (Extend)</span>
              <span className="axis-feedback">
                {feedback.id ? '✓ Active' : 'Inactive'}
              </span>
            </button>

            <div className="divider">OR</div>

            <button
              className={`axis-btn od-btn ${selectedAxis === 'od' ? 'selected' : ''} ${loading ? 'loading' : ''}`}
              onClick={() => handleSelectAxis('od')}
              disabled={loading}
              title="Enable OD (Retract) axis"
            >
              <span className="axis-icon">↩️</span>
              <span className="axis-name">OD (Retract)</span>
              <span className="axis-feedback">
                {feedback.od ? '✓ Active' : 'Inactive'}
              </span>
            </button>
          </div>

          {activeAxis && (
            <div className="status-message success">
              ✓ {activeAxis.toUpperCase()} is now enabled for jogging
            </div>
          )}

          <div className="modal-actions">
            <button
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn-confirm"
              onClick={handleConfirm}
              disabled={!selectedAxis || loading}
            >
              Start Teaching {selectedAxis?.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutoTeachAxisSelectorModal;
