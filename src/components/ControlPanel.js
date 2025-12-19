import React from 'react';
import '../styles/ControlPanel.css';

export default function ControlPanel({ onEditProgram, onParameters, onAutoTeach, onMachineParameters, onStartPosition, userRole }) {
  // Role-based access control
  const canAutoTeach = userRole !== 'operator';
  const canEditProgram = userRole !== 'operator';
  const canMachineParams = userRole === 'engineering';
  const canStartPosition = true; // All can start position
  const canPartParameters = true; // All can access part parameters

  return (
    <>
      <div className="control-panel">
        <div className="control-section center-section">
          <button 
            className="control-btn start-position-btn start-left-btn"
            onClick={() => onStartPosition && onStartPosition('left')}
            disabled={!canStartPosition}
            title={canStartPosition ? 'Set start position for left side' : 'Not available for your role'}
          >
            <span className="btn-icon">↓</span>
            Start Left
          </button>
          <button 
            className="control-btn start-position-btn start-right-btn"
            onClick={() => onStartPosition && onStartPosition('right')}
            disabled={!canStartPosition}
            title={canStartPosition ? 'Set start position for right side' : 'Not available for your role'}
          >
            <span className="btn-icon">↓</span>
            Start Right
          </button>
          <button 
            className="control-btn auto-teach-btn"
            onClick={onAutoTeach}
            disabled={!canAutoTeach}
            title={canAutoTeach ? 'Create auto-teach program' : 'Operators cannot access Auto Teach'}
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
