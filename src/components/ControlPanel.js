import React from 'react';
import '../styles/ControlPanel.css';

export default function ControlPanel({ onEditProgram, onParameters, onAutoTeach, onMachineParameters, onStartPosition, userRole, pumpEnabled, startPosReadyStatus }) {
  // Role-based access control
  const isAdmin = userRole === 'admin';
  const canAutoTeach = isAdmin || ((userRole !== 'operator') && pumpEnabled); // Admin always can access, others need pump enabled
  const canEditProgram = userRole !== 'operator' || isAdmin;
  const canMachineParams = userRole === 'engineering' || isAdmin;
  const canStartPosition = pumpEnabled && startPosReadyStatus.left && startPosReadyStatus.right; // Both start position enables must be true
  const canPartParameters = true; // All can access part parameters

  return (
    <>
      <div className="control-panel">
        <div className="control-section center-section">
          <button 
            className="control-btn start-position-btn start-left-btn"
            onClick={() => {
              console.log('[ControlPanel] Start Left clicked');
              onStartPosition && onStartPosition('left');
            }}
            disabled={!canStartPosition}
            title={!pumpEnabled ? 'Pump must be running to enable start position' : !startPosReadyStatus.left || !startPosReadyStatus.right ? 'Machine is not ready to move to start position' : 'Set start position for left side'}
          >
            <span className="btn-icon">↓</span>
            Start Left
          </button>
          <button 
            className="control-btn start-position-btn start-right-btn"
            onClick={() => {
              console.log('[ControlPanel] Start Right clicked');
              onStartPosition && onStartPosition('right');
            }}
            disabled={!canStartPosition}
            title={!pumpEnabled ? 'Pump must be running to enable start position' : !startPosReadyStatus.left || !startPosReadyStatus.right ? 'Machine is not ready to move to start position' : 'Set start position for right side'}
          >
            <span className="btn-icon">↓</span>
            Start Right
          </button>
          <button 
            className="control-btn auto-teach-btn"
            onClick={onAutoTeach}
            disabled={!canAutoTeach}
            title={!pumpEnabled ? 'Pump must be running for Auto Teach' : canAutoTeach ? 'Create auto-teach program' : 'Operators cannot access Auto Teach'}
          >
            <span className="btn-icon">🎯</span>
            Auto Teach
          </button>
          <button 
            className="control-btn edit-btn"
            onClick={onEditProgram}
            disabled={!canEditProgram}
            title={canEditProgram ? 'Edit program' : 'Operators cannot edit programs'}
          >
            <span className="btn-icon">✎</span>
            Edit Program
          </button>
          <button 
            className="control-btn param-btn"
            onClick={onParameters}
            disabled={!canPartParameters}
            title={canPartParameters ? 'Set part parameters' : 'Not available'}
          >
            <span className="btn-icon">⚙</span>
            Part Parameters
          </button>
          <button 
            className="control-btn machine-params-btn"
            onClick={onMachineParameters}
            disabled={!canMachineParams}
            title={canMachineParams ? 'Configure machine parameters' : 'Only Engineering can access'}
          >
            <span className="btn-icon">⚙️</span>
            Machine Parameters
          </button>
        </div>
      </div>
    </>
  );
}
