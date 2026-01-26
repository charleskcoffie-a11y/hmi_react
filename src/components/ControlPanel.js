import React from 'react';
import '../styles/ControlPanel.css';

export default function ControlPanel({ onEditProgram, onParameters, onAutoTeach, onMachineParameters, onStartPosition, userRole, pumpEnabled, startPosReadyStatus, startPosFeedback, homedSides, atStartPos }) {
  // Role-based access control
  const isAdmin = userRole === 'admin';
  const canAutoTeach = isAdmin || ((userRole !== 'operator') && pumpEnabled); // Admin always can access, others need pump enabled
  const canEditProgram = userRole !== 'operator' || isAdmin;
  const canMachineParams = userRole === 'engineering' || isAdmin;
  // Start position enable condition: pump running AND axis homed AND axis NOT at start position
  const leftStartReady = pumpEnabled && homedSides?.left && !atStartPos?.left;
  const rightStartReady = pumpEnabled && homedSides?.right && !atStartPos?.right;
  const leftStartActive = Boolean(startPosFeedback?.left);
  const rightStartActive = Boolean(startPosFeedback?.right);
  const canPartParameters = true; // All can access part parameters

  return (
    <>
      <div className="control-panel">
        <div className="control-section center-section">
          <button 
            className={`control-btn start-position-btn start-left-btn ${leftStartReady ? 'enabled' : ''} ${leftStartActive ? 'active' : ''}`}
            onClick={() => {
              console.log('[ControlPanel] Start Left clicked');
              onStartPosition && onStartPosition('left');
            }}
            disabled={!leftStartReady}
            title={!pumpEnabled ? 'Pump must be running' : !homedSides?.left ? 'Axis must be homed first' : atStartPos?.left ? 'Axis is already at start position' : 'Move to start position for left side'}
          >
            <span className="btn-icon">↓</span>
            Start Left
          </button>
          <button 
            className={`control-btn start-position-btn start-right-btn ${rightStartReady ? 'enabled' : ''} ${rightStartActive ? 'active' : ''}`}
            onClick={() => {
              console.log('[ControlPanel] Start Right clicked');
              onStartPosition && onStartPosition('right');
            }}
            disabled={!rightStartReady}
            title={!pumpEnabled ? 'Pump must be running' : !homedSides?.right ? 'Axis must be homed first' : atStartPos?.right ? 'Axis is already at start position' : 'Move to start position for right side'}
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
