import React from 'react';
import { pulseButton } from '../services/ioService';
import '../styles/ControlPanel.css';

export default function ControlPanel({ onEditProgram, onParameters, onAutoTeach, onMachineParameters, onStartPosition, userRole, pumpEnabled }) {
  // Role-based access control
  const isAdmin = userRole === 'admin';
  const canAutoTeach = isAdmin || ((userRole !== 'operator') && pumpEnabled); // Admin always can access, others need pump enabled
  const canEditProgram = userRole !== 'operator' || isAdmin;
  const canMachineParams = userRole === 'engineering' || isAdmin;
  const canStartPosition = pumpEnabled; // Only enabled when pump is running
  const canPartParameters = true; // All can access part parameters

  return (
    <>
      <div className="control-panel">
        <div className="control-section center-section">
          <button 
            className="control-btn start-position-btn start-left-btn"
            onClick={async () => {
              try {
                await pulseButton(11, 150); // Index 11: bHmiLeftStartPosPb
                onStartPosition && onStartPosition('left');
              } catch (err) {
                console.error('Failed to pulse Start Left:', err);
              }
            }}
            disabled={!canStartPosition}
            title={canStartPosition ? 'Set start position for left side' : 'Pump must be running to enable start position'}
          >
            <span className="btn-icon">↓</span>
            Start Left
          </button>
          <button 
            className="control-btn start-position-btn start-right-btn"
            onClick={async () => {
              try {
                await pulseButton(50, 150); // Index 50: bHmiRightStartPosPb
                onStartPosition && onStartPosition('right');
              } catch (err) {
                console.error('Failed to pulse Start Right:', err);
              }
            }}
            disabled={!canStartPosition}
            title={canStartPosition ? 'Set start position for right side' : 'Pump must be running to enable start position'}
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
