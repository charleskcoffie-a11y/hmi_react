import React, { useState, useEffect } from 'react';
import '../styles/AutoTeach.css';

export default function AutoTeach({ isOpen, onClose, programName, side, actualPositions, parameters, onSaveProgram }) {
  const [recordedSteps, setRecordedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepName, setStepName] = useState('');
  const [pattern, setPattern] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [editStepName, setEditStepName] = useState('');
  const [editStepPattern, setEditStepPattern] = useState(0);

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

  useEffect(() => {
    if (isOpen) {
      setRecordedSteps([]);
      setCurrentStep(1);
      setStepName(`Step ${1}`);
      setPattern(5); // Default to pattern 5 for step 1
      setIsRecording(false);
    }
  }, [isOpen]);

  const handleRecordPosition = () => {
    if (!stepName.trim()) {
      alert('Please enter a step name');
      return;
    }

    if (currentStep > 10) {
      alert('Maximum 10 steps allowed');
      return;
    }

    // Record current actual positions as command positions for this step
    const newStep = {
      step: currentStep,
      stepName: stepName,
      positions: {
        axis1Cmd: actualPositions.axis1,  // Command position for axis 1
        axis2Cmd: actualPositions.axis2   // Command position for axis 2
      },
      pattern: pattern,
      timestamp: new Date().toISOString()
    };

    setRecordedSteps([...recordedSteps, newStep]);
    setIsRecording(true);

    // Auto-increment for next step
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setStepName(`Step ${nextStep}`);
    setPattern(0); // Reset to 0 for subsequent steps

    setTimeout(() => setIsRecording(false), 500);
  };

  const handleDeleteStep = (index) => {
    const updated = recordedSteps.filter((_, i) => i !== index);
    setRecordedSteps(updated);
    
    // Renumber steps
    const renumbered = updated.map((step, i) => ({
      ...step,
      step: i + 1
    }));
    setRecordedSteps(renumbered);
    setCurrentStep(renumbered.length + 1);
    setStepName(`Step ${renumbered.length + 1}`);
  };

  const handleEditStep = (index) => {
    const step = recordedSteps[index];
    setEditingStepIndex(index);
    setEditStepName(step.stepName);
    setEditStepPattern(step.pattern);
  };

  const handleSaveEditStep = () => {
    if (!editStepName.trim()) {
      alert('Please enter a step name');
      return;
    }

    const updated = [...recordedSteps];
    updated[editingStepIndex] = {
      ...updated[editingStepIndex],
      stepName: editStepName,
      pattern: editStepPattern
    };
    setRecordedSteps(updated);
    setEditingStepIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingStepIndex(null);
  };

  const handleSaveProgram = () => {
    if (recordedSteps.length === 0) {
      alert('Please record at least one position');
      return;
    }

    const programData = {
      name: programName,
      side: side,
      steps: recordedSteps.reduce((acc, step) => {
        acc[step.step] = step;
        return acc;
      }, {}),
      createdAt: new Date().toISOString(),
      method: 'auto-teach'
    };

    onSaveProgram(programData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="auto-teach-overlay" onClick={onClose}>
      <div className="auto-teach-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auto-teach-header">
          <div className="auto-teach-title">
            <h2>🎯 Auto Teach Mode</h2>
            <div className="program-info">
              <span className="program-name">{programName}</span>
              <span className={`side-badge ${side}`}>{side === 'right' ? 'Right Side' : 'Left Side'}</span>
              <span className="jog-mode-indicator">🕹️ JOG MODE ACTIVE</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="auto-teach-content">
          <div className="teach-instructions">
            <h3>📝 Instructions</h3>
            <ol>
              <li>Use Jog Mode to move axes to desired position</li>
              <li>Enter step name and select pattern (if needed)</li>
              <li>Click "Record Position" to save current position</li>
              <li>Repeat for all positions (max 10 steps)</li>
              <li>Click "Save Program" when complete</li>
            </ol>
          </div>

          {parameters && (
            <div className="recipe-params-display">
              <h3>🔧 Recipe Parameters</h3>
              <div className="params-grid">
                <div className="param-item">
                  <span className="param-label">Tube ID:</span>
                  <span className="param-value">{parameters.tubeID} mm</span>
                </div>
                <div className="param-item">
                  <span className="param-label">Tube OD:</span>
                  <span className="param-value">{parameters.tubeOD} mm</span>
                </div>
                <div className="param-item">
                  <span className="param-label">Final {parameters.sizeType}:</span>
                  <span className="param-value">{parameters.finalSize} mm</span>
                </div>
                {parameters.tubeOD && parameters.tubeID && (
                  <div className="param-item">
                    <span className="param-label">Wall Thickness:</span>
                    <span className="param-value">{((parameters.tubeOD - parameters.tubeID) / 2).toFixed(2)} mm</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="current-position-display">
            <h3>📍 Current Position (To Be Recorded as Command)</h3>
            <div className="position-values">
              <div className="position-item">
                <span className="position-label">{side === 'right' ? 'Axis 1 (ID)' : 'Axis 3 (ID)'}:</span>
                <span className="position-value">{actualPositions.axis1.toFixed(3)} mm</span>
              </div>
              <div className="position-item">
                <span className="position-label">{side === 'right' ? 'Axis 2 (OD)' : 'Axis 4 (OD)'}:</span>
                <span className="position-value">{actualPositions.axis2.toFixed(3)} mm</span>
              </div>
            </div>
          </div>

          <div className="record-section">
            <h3>⏺ Record New Position</h3>
            <div className="record-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Step Number</label>
                  <input
                    type="number"
                    value={currentStep}
                    readOnly
                    className="step-number-input"
                  />
                </div>
                <div className="form-group flex-grow">
                  <label>Step Name</label>
                  <input
                    type="text"
                    value={stepName}
                    onChange={(e) => setStepName(e.target.value)}
                    placeholder="Enter step name"
                    className="step-name-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Pattern Selection</label>
                <select
                  value={pattern}
                  onChange={(e) => setPattern(parseInt(e.target.value))}
                  className="pattern-select"
                >
                  {patternOptions.map(opt => (
                    <option key={opt.code} value={opt.code}>
                      {opt.code} - {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onClick={handleRecordPosition}
                disabled={currentStep > 10}
              >
                {isRecording ? '✓ Recorded!' : '⏺ Record Position'}
              </button>
            </div>
          </div>

          <div className="recorded-steps-section">
            <h3>📋 Recorded Steps ({recordedSteps.length}/10)</h3>
            <div className="steps-list">
              {recordedSteps.length === 0 ? (
                <div className="no-steps">No positions recorded yet</div>
              ) : (
                recordedSteps.map((step, index) => (
                  editingStepIndex === index ? (
                    <div key={index} className="step-card editing">
                      <h4>Edit Step {step.step}</h4>
                      <div className="edit-form">
                        <div className="form-group">
                          <label>Step Name</label>
                          <input
                            type="text"
                            value={editStepName}
                            onChange={(e) => setEditStepName(e.target.value)}
                            className="step-name-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Pattern</label>
                          <select
                            value={editStepPattern}
                            onChange={(e) => setEditStepPattern(parseInt(e.target.value))}
                            className="pattern-select"
                          >
                            {patternOptions.map(opt => (
                              <option key={opt.code} value={opt.code}>
                                {opt.code} - {opt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="edit-buttons">
                          <button className="save-edit-btn" onClick={handleSaveEditStep}>Save</button>
                          <button className="cancel-edit-btn" onClick={handleCancelEdit}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={index} className="step-card">
                      <div className="step-header">
                        <span className="step-number">Step {step.step}</span>
                        <span className="step-name">{step.stepName}</span>
                        <button
                          className="edit-step-btn"
                          onClick={() => handleEditStep(index)}
                        >
                          ✎
                        </button>
                        <button
                          className="delete-step-btn"
                          onClick={() => handleDeleteStep(index)}
                        >
                          🗑
                        </button>
                      </div>
                      <div className="step-details">
                        <div className="step-positions">
                          <span>Axis1 Cmd: {step.positions.axis1Cmd.toFixed(3)} mm</span>
                          <span>Axis2 Cmd: {step.positions.axis2Cmd.toFixed(3)} mm</span>
                        </div>
                        <div className="step-pattern">
                          Pattern: {patternOptions.find(p => p.code === step.pattern)?.name}
                        </div>
                      </div>
                    </div>
                  )
                ))
              )}
            </div>
          </div>
        </div>

        <div className="auto-teach-footer">
          <div className="footer-info">
            <span className="step-counter">{recordedSteps.length} steps recorded</span>
          </div>
          <div className="footer-buttons">
            <button className="cancel-teach-btn" onClick={onClose}>Cancel</button>
            <button
              className="save-program-btn"
              onClick={handleSaveProgram}
              disabled={recordedSteps.length === 0}
            >
              💾 Save Program
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
