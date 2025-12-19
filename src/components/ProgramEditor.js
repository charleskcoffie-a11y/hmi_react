import React, { useState, useEffect } from 'react';
import { writePLCVar } from '../services/plcApiService';
import '../styles/ProgramEditor.css';
import NumericKeypad from './NumericKeypad';

export default function ProgramEditor({ isOpen, onClose, program, onSaveProgram }) {
  const [editedSteps, setEditedSteps] = useState([]);
  const [editingStepId, setEditingStepId] = useState(null);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState(null);
  const [keypadValue, setKeypadValue] = useState('');
  const [programSpeed, setProgramSpeed] = useState(100);
  const [programDwell, setProgramDwell] = useState(500);

  useEffect(() => {
    if (program && program.steps) {
      // Convert steps object to array
      const stepsArray = Object.keys(program.steps).map(key => ({
        ...program.steps[key],
        stepNumber: parseInt(key),
        speed: program.speed || 100,
        dwell: program.dwell || 500
      }));
      setEditedSteps(stepsArray);
      setProgramSpeed(program.speed || 100);
      setProgramDwell(program.dwell || 500);
    }
  }, [program]);

  const handleEditPosition = (stepNumber, axis) => {
    const step = editedSteps.find(s => s.stepNumber === stepNumber);
    if (step) {
      setKeypadTarget({ stepNumber, axis, type: 'position' });
      setKeypadValue(axis === 'axis1' ? step.positions.axis1Cmd : step.positions.axis2Cmd);
      setKeypadOpen(true);
    }
  };

  const handleEditSpeed = (stepNumber) => {
    const step = editedSteps.find(s => s.stepNumber === stepNumber);
    if (step) {
      setKeypadTarget({ stepNumber, type: 'speed' });
      setKeypadValue(step.speed || programSpeed);
      setKeypadOpen(true);
    }
  };

  const handleEditDwell = (stepNumber) => {
    const step = editedSteps.find(s => s.stepNumber === stepNumber);
    if (step) {
      setKeypadTarget({ stepNumber, type: 'dwell' });
      setKeypadValue(step.dwell || programDwell);
      setKeypadOpen(true);
    }
  };

  const handleKeypadSubmit = (value) => {
    if (!keypadTarget) return;

    const updatedSteps = editedSteps.map(step => {
      if (step.stepNumber === keypadTarget.stepNumber) {
        if (keypadTarget.type === 'position') {
          return {
            ...step,
            positions: {
              ...step.positions,
              [keypadTarget.axis === 'axis1' ? 'axis1Cmd' : 'axis2Cmd']: parseFloat(value)
            }
          };
        } else if (keypadTarget.type === 'speed') {
          return { ...step, speed: parseFloat(value) };
        } else if (keypadTarget.type === 'dwell') {
          return { ...step, dwell: parseFloat(value) };
        }
      }
      return step;
    });

    setEditedSteps(updatedSteps);
    setKeypadOpen(false);
    setKeypadTarget(null);
  };

  const handleEditPattern = (stepNumber, newPattern) => {
    const updatedSteps = editedSteps.map(step => {
      if (step.stepNumber === stepNumber) {
        return { ...step, pattern: newPattern };
      }
      return step;
    });
    setEditedSteps(updatedSteps);
  };

  const handleSave = () => {
    // Convert array back to object keyed by step number
    const stepsObject = {};
    editedSteps.forEach(step => {
      stepsObject[step.stepNumber] = {
        step: step.stepNumber,
        stepName: step.stepName,
        positions: step.positions,
        pattern: step.pattern,
        timestamp: step.timestamp
      };
    });

    const updatedProgram = {
      ...program,
      steps: stepsObject,
      speed: programSpeed,
      dwell: programDwell
    };

    onSaveProgram(updatedProgram);
    onClose();
  };

  const patternOptions = [
    { code: 0, name: 'No Pattern' },
    { code: 1, name: 'Red Ext' },
    { code: 2, name: 'Red Ret' },
    { code: 3, name: 'Exp Ext' },
    { code: 4, name: 'Exp Ret' },
    { code: 5, name: 'Red Ext + Exp Ext' },
    { code: 6, name: 'Red Ext + Exp Ret' },
    { code: 7, name: 'Red Ret + Exp Ext' },
    { code: 8, name: 'Red Ret + Exp Ret' }
  ];

  if (!isOpen || !program) return null;

  return (
    <div className="program-editor-overlay" onClick={onClose}>
      <div className="program-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="program-editor-header">
          <div className="program-editor-title">
            <h2>✎ Edit Program</h2>
            <div className="program-info">
              <span className="program-name">{program.name}</span>
              <span className={`side-badge ${program.side}`}>
                {program.side === 'right' ? 'Right Side' : 'Left Side'}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="program-editor-content">
          <div className="global-settings">
            <h3>🔧 Global Settings</h3>
            <div className="global-settings-row">
              <div className="global-setting-item">
                <label>Program Speed:</label>
                <div className="setting-display" onClick={() => {
                  setKeypadTarget({ type: 'globalSpeed' });
                  setKeypadValue(programSpeed);
                  setKeypadOpen(true);
                }}>
                  {programSpeed}%
                </div>
              </div>
              <div className="global-setting-item">
                <label>Program Dwell:</label>
                <div className="setting-display" onClick={() => {
                  setKeypadTarget({ type: 'globalDwell' });
                  setKeypadValue(programDwell);
                  setKeypadOpen(true);
                }}>
                  {programDwell} ms
                </div>
              </div>
            </div>
          </div>

          <div className="steps-container">
            <h3>📋 Program Steps ({editedSteps.length})</h3>
            {editedSteps.length === 0 ? (
              <div className="no-steps">No steps in this program</div>
            ) : (
              <div className="steps-grid">
                {editedSteps.map((step) => (
                  <div key={step.stepNumber} className="step-editor-card">
                    <div className="step-card-header">
                      <span className="step-number">Step {step.stepNumber}</span>
                      <span className="step-name">{step.stepName}</span>
                    </div>

                    <div className="step-card-body">
                      <div className="position-section">
                        <h4>📍 Positions</h4>
                        <div className="position-row">
                          <label>Axis 1 Cmd:</label>
                          <div 
                            className="position-value editable"
                            onClick={() => handleEditPosition(step.stepNumber, 'axis1')}
                          >
                            {step.positions.axis1Cmd?.toFixed(3)} mm
                          </div>
                        </div>
                        <div className="position-row">
                          <label>Axis 2 Cmd:</label>
                          <div 
                            className="position-value editable"
                            onClick={() => handleEditPosition(step.stepNumber, 'axis2')}
                          >
                            {step.positions.axis2Cmd?.toFixed(3)} mm
                          </div>
                        </div>
                      </div>

                      <div className="settings-section">
                        <h4>⚙️ Settings</h4>
                        <div className="settings-row">
                          <label>Speed:</label>
                          <div 
                            className="setting-value editable"
                            onClick={() => handleEditSpeed(step.stepNumber)}
                          >
                            {step.speed || programSpeed}%
                          </div>
                        </div>
                        <div className="settings-row">
                          <label>Dwell:</label>
                          <div 
                            className="setting-value editable"
                            onClick={() => handleEditDwell(step.stepNumber)}
                          >
                            {step.dwell || programDwell} ms
                          </div>
                        </div>
                      </div>

                      <div className="pattern-section">
                        <h4>🎯 Pattern</h4>
                        <select
                          value={step.pattern}
                          onChange={(e) => handleEditPattern(step.stepNumber, parseInt(e.target.value))}
                          className="pattern-select"
                        >
                          {patternOptions.map(opt => (
                            <option key={opt.code} value={opt.code}>
                              {opt.code} - {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="program-editor-footer">
          <button className="save-program-btn" onClick={handleSave}>
            💾 Save Changes
          </button>
          <button className="cancel-program-btn" onClick={onClose}>
            Cancel
          </button>
            <button className="download-program-btn" onClick={async () => {
              if (!program) return;
              const updatedProgram = {
                ...program,
                steps: Object.fromEntries(editedSteps.map(step => [step.stepNumber, {
                  step: step.stepNumber,
                  stepName: step.stepName,
                  positions: step.positions,
                  pattern: step.pattern,
                  timestamp: step.timestamp
                }])),
                speed: programSpeed,
                dwell: programDwell
              };
              try {
                await writePLCVar(updatedProgram);
                alert(`Program "${updatedProgram.name}" downloaded to PLC (${updatedProgram.side} side)`);
              } catch (e) {
                alert(`Failed to download program "${updatedProgram.name}" to PLC`);
              }
            }}>
              ⬇ Download to PLC
            </button>
        </div>

        <NumericKeypad
          isOpen={keypadOpen}
          title={
            keypadTarget?.type === 'position' 
              ? `Edit ${keypadTarget.axis === 'axis1' ? 'Axis 1' : 'Axis 2'} Position`
              : keypadTarget?.type === 'speed'
              ? 'Edit Step Speed'
              : keypadTarget?.type === 'dwell'
              ? 'Edit Step Dwell'
              : keypadTarget?.type === 'globalSpeed'
              ? 'Edit Program Speed'
              : 'Edit Program Dwell'
          }
          unit={
            keypadTarget?.type === 'position' ? 'mm' :
            keypadTarget?.type === 'speed' || keypadTarget?.type === 'globalSpeed' ? '%' :
            'ms'
          }
          initialValue={keypadValue}
          decimals={keypadTarget?.type === 'position' ? 3 : 0}
          allowNegative={false}
          allowAddSub={true}
          onSubmit={(val) => {
            if (keypadTarget?.type === 'globalSpeed') {
              setProgramSpeed(parseFloat(val));
              setKeypadOpen(false);
              setKeypadTarget(null);
            } else if (keypadTarget?.type === 'globalDwell') {
              setProgramDwell(parseFloat(val));
              setKeypadOpen(false);
              setKeypadTarget(null);
            } else {
              handleKeypadSubmit(val);
            }
          }}
          onCancel={() => {
            setKeypadOpen(false);
            setKeypadTarget(null);
          }}
        />
      </div>
    </div>
  );
}
