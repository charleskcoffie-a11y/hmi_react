import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModernDialog from './ModernDialog';
import NumericKeypad from './NumericKeypad';
import '../styles/AutoTeach.css';

export default function AutoTeach({
  isOpen,
  onClose,
  programName,
  side,
  actualPositions,
  parameters,
  onSaveProgram,
}) {
  const safeParameters = parameters ?? {};
  const safeActualPositions = actualPositions ?? { axis1: 0, axis2: 0 };

  const patternOptions = useMemo(
    () => [
      { code: 0, name: 'Red Ext' },
      { code: 1, name: 'Red Ret' },
      { code: 2, name: 'Exp Ext' },
      { code: 3, name: 'Exp Ret' },
      { code: 4, name: 'RedRet + ExpRet' },
      { code: 5, name: 'Repeat' },
      { code: 6, name: 'RedExt + ExpExt' },
      { code: 8, name: 'All off' },
    ],
    []
  );

  const [dialog, setDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirm: null,
    cancel: null,
  });

  const [recordedSteps, setRecordedSteps] = useState([]);
  const [stepName, setStepName] = useState('');
  const [pattern, setPattern] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [editStepName, setEditStepName] = useState('');
  const [editStepPattern, setEditStepPattern] = useState(0);

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const [repeatConfigOpen, setRepeatConfigOpen] = useState(false);
  const [repeatTargetStep, setRepeatTargetStep] = useState(null);
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatKeypadOpen, setRepeatKeypadOpen] = useState(false);
  const activeCardRef = useRef(null);

  const activeStepNumber = Math.min(recordedSteps.length + 1, 10);

  const eligibleRepeatTargets = useMemo(() => {
    // Only allow repeating previously-recorded steps; never allow repeating step 1 or step 10.
    const targets = recordedSteps
      .map((s) => s.step)
      .filter((n) => typeof n === 'number' && n >= 2 && n <= 9);
    // Unique + sorted.
    return Array.from(new Set(targets)).sort((a, b) => a - b);
  }, [recordedSteps]);

  const repeatAllowedForActiveStep =
    activeStepNumber >= 2 &&
    activeStepNumber <= 9 &&
    eligibleRepeatTargets.length > 0;

  const availablePatternOptions = useMemo(() => {
    const forbidden = new Set(
      activeStepNumber === 2
        ? [1, 3, 4, 5, 8]
        : activeStepNumber === 10
          ? [0, 2, 6, 5]
          : []
    );
    return patternOptions.map((opt) => {
      if (forbidden.has(opt.code)) return { ...opt, disabled: true };
      if (opt.code !== 5) return { ...opt, disabled: false };
      const disabled = !repeatAllowedForActiveStep;
      return { ...opt, disabled };
    });
  }, [patternOptions, repeatAllowedForActiveStep, activeStepNumber]);

  // Step 1 is fixed to PLC pattern code 6 (RedExt + ExpExt) and must not be editable.
  useEffect(() => {
    if (activeStepNumber === 1) {
      setPattern(6);
    }
  }, [activeStepNumber]);

  // Step 1 name should default to "Start Position".
  useEffect(() => {
    if (activeStepNumber === 1 && (!stepName || !stepName.trim())) {
      setStepName('Start Position');
    }
  }, [activeStepNumber, stepName]);

  // Reset the sequence when starting a new program
  useEffect(() => {
    if (isOpen) {
      setRecordedSteps([]);
      setStepName('');
      setPattern(0);
      setEditingStepIndex(null);
      setEditStepName('');
      setEditStepPattern(0);
      setRepeatConfigOpen(false);
      setRepeatTargetStep(null);
      setRepeatCount(1);
      setRepeatKeypadOpen(false);
    }
  }, [isOpen, programName, side]); // Reset when opening or when program name/side changes

  const patternAxisMeta = useMemo(
    () => ({
      0: { axes: 'od' }, // Red Ext -> OD
      1: { axes: 'od' }, // Red Ret -> OD
      2: { axes: 'id' }, // Exp Ext -> ID
      3: { axes: 'id' }, // Exp Ret -> ID
      4: { axes: 'both' }, // RedRet + ExpRet -> both
      5: { axes: 'repeat' }, // Repeat (show note only)
      6: { axes: 'both' }, // RedExt + ExpExt -> both
      8: { axes: 'none' }, // All off -> none
    }),
    []
  );

  // If user navigates away from Repeat, clear the config so it doesn't leak into other patterns.
  useEffect(() => {
    if (pattern !== 5) {
      setRepeatTargetStep(null);
      setRepeatCount(1);
      setRepeatConfigOpen(false);
      setRepeatKeypadOpen(false);
    }
  }, [pattern]);

  // Keep view aligned to active teaching step card
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeStepNumber]);

  if (!isOpen) return null;

  const axis1Label = side === 'right' ? 'Axis 1 (ID)' : 'Axis 3 (ID)';
  const axis2Label = side === 'right' ? 'Axis 2 (OD)' : 'Axis 4 (OD)';

  const closeDialog = () => setDialog({ open: false, title: '', message: '', confirm: null, cancel: null });

  const handleRecordPosition = () => {
    if (isRecording) return;
    if (recordedSteps.length >= 10) {
      setDialog({
        open: true,
        title: 'Max Steps Reached',
        message: 'You can record up to 10 steps.',
        confirm: closeDialog,
        cancel: null,
      });
      return;
    }

    setIsRecording(true);

    const stepNumberToRecord = Math.min(recordedSteps.length + 1, 10);
    const patternToRecord = stepNumberToRecord === 1 ? 6 : pattern;

    if (patternToRecord === 5) {
      // Repeat validation: cannot repeat step 1 or step 10; also require a prior eligible step.
      if (!repeatAllowedForActiveStep) {
        setDialog({
          open: true,
          title: 'Repeat Not Allowed',
          message: 'Repeat is not available yet. Record at least one step between 2 and 9 first.',
          confirm: closeDialog,
          cancel: null,
        });
        setIsRecording(false);
        return;
      }

      if (!repeatTargetStep || repeatTargetStep === 1 || repeatTargetStep === 10) {
        setRepeatConfigOpen(true);
        setIsRecording(false);
        return;
      }

      if (!Number.isFinite(repeatCount) || repeatCount < 1) {
        setRepeatConfigOpen(true);
        setIsRecording(false);
        return;
      }
    }
    const defaultStepName = stepNumberToRecord === 1 ? 'Start Position' : `Step ${stepNumberToRecord}`;
    const defaultDwell = [1, 3, 4].includes(patternToRecord) ? 0 : 500;
    const newStep = {
      step: stepNumberToRecord,
      stepName: stepName?.trim() ? stepName.trim() : defaultStepName,
      pattern: patternToRecord,
      needsReteach: false,
      positions: {
        axis1Cmd: Number(safeActualPositions.axis1) || 0,
        axis2Cmd: Number(safeActualPositions.axis2) || 0,
      },
      dwell: defaultDwell,
      ...(patternToRecord === 5
        ? {
            repeatTargetStep,
            repeatCount: Math.max(1, Math.floor(Number(repeatCount) || 1)),
          }
        : {}),
    };

    setRecordedSteps((prev) => [...prev, newStep]);
    setStepName('');
    setIsRecording(false);
  };

  const handleEditStep = (index) => {
    const step = recordedSteps[index];
    if (!step) return;
    setEditingStepIndex(index);
    setEditStepName(step.stepName ?? '');
    setEditStepPattern(step.step === 1 ? 6 : (step.pattern ?? 0));
  };

  const handleCancelEdit = () => {
    setEditingStepIndex(null);
    setEditStepName('');
    setEditStepPattern(0);
  };

  const handleSaveEditStep = () => {
    if (editingStepIndex === null) return;
    const original = recordedSteps[editingStepIndex];
    if (original) {
      const forbidden = new Set(
        original.step === 2 ? [1, 3, 4, 5, 8] : original.step === 10 ? [0, 2, 6, 5] : []
      );
      if (forbidden.has(editStepPattern)) {
        setDialog({
          open: true,
          title: 'Pattern Not Allowed',
          message:
            original.step === 2
              ? 'Selected pattern is not allowed for Step 2.'
              : 'Selected pattern is not allowed for Step 10.',
          confirm: closeDialog,
          cancel: null,
        });
        return;
      }
    }
    setRecordedSteps((prev) =>
      prev.map((s, i) =>
        i === editingStepIndex
          ? {
              ...s,
              stepName: editStepName?.trim() ? editStepName.trim() : s.stepName,
              pattern: s.step === 1 ? 6 : editStepPattern,
              needsReteach:
                s.step === 1
                  ? s.needsReteach
                  : original && original.pattern !== editStepPattern
                    ? true
                    : s.needsReteach,
            }
          : s
      )
    );

    if (original && original.step !== 1 && original.pattern !== editStepPattern) {
      setDialog({
        open: true,
        title: 'Pattern Changed',
        message: `Step ${original.step} pattern changed. Please re-teach this step to confirm positions.`,
        confirm: closeDialog,
        cancel: null,
      });
    }
    handleCancelEdit();
  };

  const handleDeleteStep = (index) => {
    setRecordedSteps((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
    if (editingStepIndex === index) handleCancelEdit();
  };

  // Quick pattern changes are disabled; use Edit Step to modify the pattern.


  const handleSaveProgram = () => {
    try {
      onSaveProgram?.(recordedSteps);
      setDialog({
        open: true,
        title: 'Saved',
        message: 'Program saved successfully.',
        confirm: closeDialog,
        cancel: null,
      });
    } catch (e) {
      setDialog({
        open: true,
        title: 'Save Failed',
        message: e?.message ? String(e.message) : 'Failed to save program.',
        confirm: closeDialog,
        cancel: null,
      });
    }
  };

  return (
    <>
      <ModernDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        confirmText="OK"
        cancelText={dialog.cancel ? 'Cancel' : undefined}
        onConfirm={dialog.confirm}
        onCancel={dialog.cancel}
      />

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
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
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

              <div className="param-item">
                <span className="param-label">Tube OD:</span>
                <span className="param-value">
                  {safeParameters.tubeOD ?? '--'} mm
                </span>
              </div>
              <div className="param-item">
                <span className="param-label">Final {safeParameters.sizeType ?? ''}:</span>
                <span className="param-value">
                  {safeParameters.finalSize ?? '--'} mm
                </span>
              </div>
              {safeParameters.tubeOD && safeParameters.tubeID && (
                <div className="param-item">
                  <span className="param-label">Wall Thickness:</span>
                  <span className="param-value">
                    {((safeParameters.tubeOD - safeParameters.tubeID) / 2).toFixed(2)} mm
                  </span>
                </div>
              )}
            </div>

            <div className="current-position-display">
              <h3>Current Teaching Step: {activeStepNumber}/10</h3>
              <div style={{ marginBottom: 8 }}>📍 Current Position (to be recorded for this step)</div>
              <div className="position-values">
                <div className="position-item">
                  <span className="position-label">{axis1Label}:</span>
                  <span className="position-value">{Number(safeActualPositions.axis1).toFixed(3)} mm</span>
                </div>
                <div className="position-item">
                  <span className="position-label">{axis2Label}:</span>
                  <span className="position-value">{Number(safeActualPositions.axis2).toFixed(3)} mm</span>
                </div>
              </div>
            </div>

            <div className="record-controls">
              <div className="form-group">
                <label>Step Name</label>
                <input
                  type="text"
                  value={stepName}
                  onChange={(e) => setStepName(e.target.value)}
                  className="step-name-input"
                />
              </div>

              <div className="form-group">
                <label>Active Step Number</label>
                <input type="number" value={activeStepNumber} readOnly className="step-number-input" />
              </div>

              <div className="form-group">
                <label>Pattern Selection</label>
                <select
                  value={activeStepNumber === 1 ? 6 : pattern}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10);

                    // Step 1 is locked; step 10 cannot be Repeat; and Repeat requires eligible targets.
                    if (activeStepNumber === 1) return;

                    const forbidden = new Set(
                      activeStepNumber === 2
                        ? [1, 3, 4, 5, 8]
                        : activeStepNumber === 10
                          ? [0, 2, 6, 5]
                          : []
                    );
                    if (forbidden.has(next)) {
                      setDialog({
                        open: true,
                        title: 'Pattern Not Allowed',
                        message:
                          activeStepNumber === 2
                            ? 'Selected pattern is not allowed for Step 2.'
                            : 'Selected pattern is not allowed for Step 10.',
                        confirm: closeDialog,
                        cancel: null,
                      });
                      return;
                    }

                    if (next === 5) {
                      if (!repeatAllowedForActiveStep) {
                        setDialog({
                          open: true,
                          title: 'Repeat Not Available',
                          message: 'You cannot select Repeat yet. Record a step between 2 and 9 first (step 1 and step 10 cannot be repeated).',
                          confirm: closeDialog,
                          cancel: null,
                        });
                        return;
                      }
                      setPattern(5);
                      // Default the selection to the first eligible step.
                      setRepeatTargetStep((prev) => prev ?? eligibleRepeatTargets[0] ?? null);
                      setRepeatCount((prev) => (Number.isFinite(prev) && prev >= 1 ? prev : 1));
                      setRepeatConfigOpen(true);
                      return;
                    }

                    setPattern(next);
                  }}
                  className="pattern-select"
                  disabled={activeStepNumber === 1}
                >
                  {availablePatternOptions.map((opt) => (
                    <option key={opt.code} value={opt.code} disabled={!!opt.disabled}>
                      {opt.code} - {opt.name}
                    </option>
                  ))}
                </select>
                {activeStepNumber === 2 ? (
                  <div className="pattern-hint">Step 2 not allowed: 1, 3, 4, 5, 8</div>
                ) : activeStepNumber === 10 ? (
                  <div className="pattern-hint">Step 10 not allowed: 0, 2, 6</div>
                ) : null}
              </div>

              <button
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onClick={handleRecordPosition}
                disabled={isRecording || recordedSteps.length >= 10}
              >
                {recordedSteps.length >= 10 ? 'All 10 Steps Recorded' : isRecording ? 'Recording...' : 'Record Position'}
              </button>
            </div>

            {/* Recorded steps directly under the active teaching step */}
            <div className="recorded-steps-section">
              <h3>📋 Recorded Steps ({recordedSteps.length}/10)</h3>
              <div className="active-step-card" ref={activeCardRef}>
                <div className="active-step-row">
                  <span className="active-step-label">Active Step {activeStepNumber}</span>
                  <input
                    type="text"
                    value={stepName}
                    onChange={(e) => setStepName(e.target.value)}
                    className="step-name-input inline"
                    placeholder={activeStepNumber === 1 ? 'Start Position' : `Step ${activeStepNumber}`}
                  />
                  <select
                    value={activeStepNumber === 1 ? 6 : pattern}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10);
                      if (activeStepNumber === 1) return;
                      const forbidden = new Set(
                        activeStepNumber === 2
                          ? [1, 3, 4, 5, 8]
                          : activeStepNumber === 10
                            ? [0, 2, 6, 5]
                            : []
                      );
                      if (forbidden.has(next)) {
                        setDialog({
                          open: true,
                          title: 'Pattern Not Allowed',
                          message:
                            activeStepNumber === 2
                              ? 'Selected pattern is not allowed for Step 2.'
                              : 'Selected pattern is not allowed for Step 10.',
                          confirm: closeDialog,
                          cancel: null,
                        });
                        return;
                      }
                      if (next === 5) {
                        if (!repeatAllowedForActiveStep) {
                          setDialog({
                            open: true,
                            title: 'Repeat Not Available',
                            message: 'You cannot select Repeat yet. Record a step between 2 and 9 first (step 1 and step 10 cannot be repeated).',
                            confirm: closeDialog,
                            cancel: null,
                          });
                          return;
                        }
                        setPattern(5);
                        setRepeatTargetStep((prev) => prev ?? eligibleRepeatTargets[0] ?? null);
                        setRepeatCount((prev) => (Number.isFinite(prev) && prev >= 1 ? prev : 1));
                        setRepeatConfigOpen(true);
                        return;
                      }
                      setPattern(next);
                    }}
                    className="pattern-select inline"
                    disabled={activeStepNumber === 1}
                  >
                    {availablePatternOptions.map((opt) => (
                      <option key={opt.code} value={opt.code} disabled={!!opt.disabled}>
                        {opt.code} - {opt.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`record-btn inline ${isRecording ? 'recording' : ''}`}
                    onClick={handleRecordPosition}
                    disabled={isRecording || recordedSteps.length >= 10}
                  >
                    {recordedSteps.length >= 10 ? 'All 10 Steps Recorded' : isRecording ? 'Recording...' : 'Record Position'}
                  </button>
                </div>
              </div>
              <div className="steps-list">
                {recordedSteps.length === 0 ? (
                  <div className="no-steps">No positions recorded yet</div>
                ) : (
                  recordedSteps.map((step, index) =>
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
                              onChange={(e) => setEditStepPattern(parseInt(e.target.value, 10))}
                              className="pattern-select"
                              disabled={step.step === 1}
                            >
                                {patternOptions.map((opt) => {
                                  const stepNum = recordedSteps[editingStepIndex]?.step;
                                  const forbidden = new Set(
                                    stepNum === 2
                                      ? [1, 3, 4, 5, 8]
                                      : stepNum === 10
                                        ? [0, 2, 6, 5]
                                        : []
                                  );
                                  return (
                                    <option key={opt.code} value={opt.code} disabled={forbidden.has(opt.code)}>
                                      {opt.code} - {opt.name}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>
                          <div className="edit-buttons">
                            <button className="save-edit-btn" onClick={handleSaveEditStep}>
                              Save
                            </button>
                            <button className="cancel-edit-btn" onClick={handleCancelEdit}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={index} className="step-card">
                        <div className="step-header">
                          <span className="step-number">Step {step.step}</span>
                          <span className="step-name">
                            {step.step === 1
                              ? step.stepName
                              : (patternOptions.find((p) => p.code === step.pattern)?.name || step.stepName)}
                          </span>
                          {step.needsReteach ? <span className="reteach-pill">Re-teach</span> : null}
                          <div className="pattern-display mini">
                            {step.step === 1
                              ? (patternOptions.find((p) => p.code === 6)?.name)
                              : (patternOptions.find((p) => p.code === step.pattern)?.name)}
                          </div>
                          <button className="edit-step-btn" onClick={() => handleEditStep(index)}>
                            ✎
                          </button>
                          <button className="delete-step-btn" onClick={() => handleDeleteStep(index)}>
                            🗑
                          </button>
                        </div>
                        <div className="step-details">
                          {(() => {
                            const patternCode = Number(step.pattern);
                            const meta = patternAxisMeta[patternCode];
                            
                            if (!meta) {
                              // Fallback if pattern not found
                              return (
                                <div className="step-positions">
                                  <span>{axis1Label} Cmd: {Number(step.positions.axis1Cmd).toFixed(3)} mm</span>
                                  <span>{axis2Label} Cmd: {Number(step.positions.axis2Cmd).toFixed(3)} mm</span>
                                </div>
                              );
                            }
                            
                            if (meta.axes === 'none') return null;
                            if (meta.axes === 'repeat') return null;
                            
                            if (meta.axes === 'id') {
                              return (
                                <div className="step-positions">
                                  <span>{axis1Label} Cmd: {Number(step.positions.axis1Cmd).toFixed(3)} mm</span>
                                </div>
                              );
                            }
                            
                            if (meta.axes === 'od') {
                              return (
                                <div className="step-positions">
                                  <span>{axis2Label} Cmd: {Number(step.positions.axis2Cmd).toFixed(3)} mm</span>
                                </div>
                              );
                            }
                            
                            // Both axes
                            return (
                              <div className="step-positions">
                                <span>{axis1Label} Cmd: {Number(step.positions.axis1Cmd).toFixed(3)} mm</span>
                                <span>{axis2Label} Cmd: {Number(step.positions.axis2Cmd).toFixed(3)} mm</span>
                              </div>
                            );
                          })()}
                          <div className="step-pattern">
                            Pattern: {patternOptions.find((p) => p.code === step.pattern)?.name}
                            {step.pattern === 5 && step.repeatTargetStep && step.repeatCount ? (
                              <div>
                                Repeat Step {step.repeatTargetStep} × {step.repeatCount}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            <ModernDialog
              open={repeatConfigOpen}
              title="🔄 Repeat Configuration"
              confirmText="Apply"
              cancelText="Cancel"
              onConfirm={() => {
                const count = Math.max(1, Math.floor(Number(repeatCount) || 1));
                if (!repeatTargetStep || repeatTargetStep === 1 || repeatTargetStep === 10) {
                  setDialog({
                    open: true,
                    title: 'Invalid Repeat Step',
                    message: 'You cannot repeat Step 1 or Step 10. Choose a step between 2 and 9.',
                    confirm: closeDialog,
                    cancel: null,
                  });
                  return;
                }

                if (!eligibleRepeatTargets.includes(repeatTargetStep)) {
                  setDialog({
                    open: true,
                    title: 'Invalid Repeat Step',
                    message: 'Choose a previously recorded step between 2 and 9 to repeat.',
                    confirm: closeDialog,
                    cancel: null,
                  });
                  return;
                }

                setRepeatCount(count);
                setRepeatConfigOpen(false);
              }}
              onCancel={() => {
                setRepeatConfigOpen(false);
                // Revert away from Repeat if user cancels the config.
                setPattern(0);
                setRepeatKeypadOpen(false);
              }}
            >
              <div className="repeat-config-content">
                <div className="repeat-config-section">
                  <div className="config-label">
                    <span className="config-icon">📍</span>
                    <span>Step to Repeat</span>
                  </div>
                  <select
                    className="repeat-config-select"
                    value={repeatTargetStep ?? ''}
                    onChange={(e) => setRepeatTargetStep(parseInt(e.target.value, 10))}
                  >
                    {eligibleRepeatTargets.length === 0 ? (
                      <option value="" disabled>
                        No eligible steps (2-9) recorded yet
                      </option>
                    ) : null}
                    {eligibleRepeatTargets.map((n) => (
                      <option key={n} value={n}>
                        Step {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="repeat-config-section">
                  <div className="config-label">
                    <span className="config-icon">🔢</span>
                    <span>Repeat Count</span>
                  </div>
                  <button
                    type="button"
                    className="repeat-config-input keypad-button"
                    onClick={() => setRepeatKeypadOpen(true)}
                  >
                    {repeatCount} ×
                  </button>
                  <div className="repeat-config-hint">Tap to set repeat count with keypad</div>
                </div>

                <div className="repeat-info-box">
                  <div className="info-icon">ℹ️</div>
                  <div className="info-text">
                    Step 1 (Start Position) and Step 10 (End Position) cannot be repeated.
                    Only steps 2-9 are eligible.
                  </div>
                </div>
              </div>
            </ModernDialog>

            <NumericKeypad
              isOpen={repeatKeypadOpen}
              title="Repeat Count"
              decimals={0}
              min={1}
              allowNegative={false}
              onSubmit={(num) => {
                setRepeatCount(Math.max(1, Math.floor(Number(num) || 1)));
                setRepeatKeypadOpen(false);
              }}
              onCancel={() => setRepeatKeypadOpen(false)}
            />

            <ModernDialog
              isOpen={showSaveConfirm}
              title="Save Program"
              confirmText="Save & Exit"
              cancelText="Cancel"
              onConfirm={() => {
                handleSaveProgram();
                setShowSaveConfirm(false);
                onClose?.();
              }}
              onCancel={() => setShowSaveConfirm(false)}
            >
              <div className={`save-confirm-body side-${side}`}>
                <div className="save-confirm-header">💾 Ready to Save</div>
                <div className="save-confirm-tagline">End Auto Teach and store this program?</div>
                <div className="save-confirm-stats">
                  <div className="save-pill">{recordedSteps.length} steps</div>
                  <div className="save-pill">Side: {side === 'right' ? 'Right' : 'Left'}</div>
                  <div className="save-pill">Program: {programName || 'Untitled'}</div>
                </div>
                <div className="save-confirm-note">You can continue teaching by pressing Cancel.</div>
              </div>
            </ModernDialog>
          </div>

          <div className="auto-teach-footer">
            <div className="footer-info">
              <span className="step-counter">{recordedSteps.length} steps recorded</span>
            </div>
            <div className="footer-buttons">
              <button className="cancel-teach-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="save-program-btn"
                onClick={() => setShowSaveConfirm(true)}
                disabled={recordedSteps.length === 0}
              >
                💾 Save Program
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
