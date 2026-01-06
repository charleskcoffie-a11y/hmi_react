import React, { useState, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import { writePLCVar } from '../services/plcApiService';
import '../styles/ProgramEditor.css';
import NumericKeypad from './NumericKeypad';

export default function ProgramEditor({ isOpen, onClose, program, onSaveProgram }) {
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [editedSteps, setEditedSteps] = useState([]);
  // Removed unused editingStepId and setEditingStepId
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState(null);
  const [keypadValue, setKeypadValue] = useState('');
  const [programSpeed, setProgramSpeed] = useState(100);
  const [programDwell, setProgramDwell] = useState(500);
  const [stepDialog, setStepDialog] = useState({ open: false, mode: 'add', stepNumber: '', pattern: 0 });
  const [jogHint, setJogHint] = useState(false);
  const [downloadDialog, setDownloadDialog] = useState({ open: false });

  const getPatternAxes = (patternCode) => {
    const code = Number(patternCode ?? 0);
    const axis1Only = new Set([0, 1]); // Red Ext / Red Ret
    const axis2Only = new Set([2, 3]); // Exp Ext / Exp Ret
    const both = new Set([4, 6]); // RedRet+ExpRet, RedExt+ExpExt
    if (both.has(code)) return ['axis1', 'axis2'];
    if (axis1Only.has(code)) return ['axis1'];
    if (axis2Only.has(code)) return ['axis2'];
    return [];
  };

  useEffect(() => {
    if (program && program.steps) {
      // Convert steps object to array and filter only enabled steps
      const stepsArray = Object.keys(program.steps)
        .map(key => {
          const step = program.steps[key];
          const pattern = step?.pattern;
          const defaultDwell = [1, 3, 4].includes(Number(pattern)) ? 0 : (program.dwell || 500);
          return {
            ...step,
            stepNumber: parseInt(key),
            speed: step?.speed ?? program.speed ?? 100,
            dwell: step?.dwell ?? defaultDwell
          };
        })
        .filter(step => step.enabled !== false); // Only show enabled steps (default true)
      setEditedSteps(stepsArray);
      setProgramSpeed(program.speed || 100);
      setProgramDwell(program.dwell || 500);
    }
  }, [program]);

  const handleDownload = () => {
    if (!program) return;
    setDownloadDialog({ open: true });
  };

  const confirmDownload = async () => {
    setDownloadDialog({ open: false });
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
      setDialog({
        open: true,
        title: '✓ Download Success',
        message: `Program "${updatedProgram.name}" successfully downloaded to ${updatedProgram.side} side PLC`
      });
    } catch (e) {
      setDialog({
        open: true,
        title: '✗ Download Failed',
        message: `Failed to download program "${updatedProgram.name}" to PLC. Please check connection.`
      });
    }
  };

  const handleEditPosition = (stepNumber, field) => {
    const step = editedSteps.find(s => s.stepNumber === stepNumber);
    if (step) {
      setKeypadTarget({ stepNumber, field, type: 'position' });
      setKeypadValue(step.positions?.[field] ?? 0);
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
        if (keypadTarget.type === 'position' && keypadTarget.field) {
          return {
            ...step,
            positions: {
              ...step.positions,
              [keypadTarget.field]: parseFloat(value)
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
    // Enforce pattern restrictions: Step 2 disallow 1,3,4,5,8; Step 10 disallow 0,2,6
    const forbidden = new Set(
      stepNumber === 2 ? [1, 3, 4, 5, 8] : stepNumber === 10 ? [0, 2, 6] : []
    );
    if (forbidden.has(Number(newPattern))) {
      setDialog({
        open: true,
        title: 'Pattern Not Allowed',
        message:
          stepNumber === 2
            ? 'Selected pattern is not allowed for Step 2.'
            : 'Selected pattern is not allowed for Step 10.'
      });
      return;
    }
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
        timestamp: step.timestamp,
        dwell: step.dwell ?? (program.dwell || 500),
        speed: step.speed ?? program.speed ?? 100
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
    { code: 0, name: 'Red Ext' },
    { code: 1, name: 'Red Ret' },
    { code: 2, name: 'Exp Ext' },
    { code: 3, name: 'Exp Ret' },
    { code: 4, name: 'RedRet + ExpRet' },
    { code: 5, name: 'Repeat' },
    { code: 6, name: 'RedExt + ExpExt' },
    { code: 8, name: 'All off' }
  ];

  const getAxisLabelForKeypad = () => {
    const map = {
      axis1Cmd: 'Axis 1',
      axis2Cmd: 'Axis 2',
      axis3Cmd: 'Axis 3',
      axis4Cmd: 'Axis 4'
    };
    return map[keypadTarget?.field] || 'Axis';
  };

  if (!isOpen || !program) return null;

  return (
    <div className="program-editor-overlay no-scroll" onClick={onClose}>
      <div className="program-editor-modal no-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="program-editor-header">
          <div className="program-header-left">
            <h2>✎ Edit Program</h2>
            <div className="program-info">
              <span className="program-name">{program.recipeName || program.name}</span>
              <span className={`side-badge ${program.side}`}>
                {program.side === 'right' ? 'Right Side' : 'Left Side'}
              </span>
              <span className="program-steps-label">Steps {editedSteps.length}</span>
            </div>
          </div>
          <div className="program-header-actions">
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="program-editor-content no-scroll">
          <div className="program-actions-panel">
            <div className="actions-row">
              <button
                className="step-action-btn add"
                onClick={() => {
                  if (editedSteps.length >= 10) {
                    setDialog({ open: true, title: 'Step Limit', message: 'Maximum of 10 steps allowed.' });
                    return;
                  }
                  setStepDialog({ open: true, mode: 'add', stepNumber: editedSteps.length + 1, pattern: 0 });
                }}
                disabled={editedSteps.length >= 10}
              >
                + Add Step
              </button>
              <button className="step-action-btn delete" onClick={() => setStepDialog({ open: true, mode: 'delete', stepNumber: '', pattern: 0 })}>
                Delete Step
              </button>
              <button className="save-program-btn" onClick={handleSave}>
                💾 Save Changes
              </button>
              <button className="cancel-program-btn" onClick={onClose}>
                Cancel
              </button>
              <button className="modern-download" onClick={handleDownload}>
                <span className="download-icon">⬇</span>
                <span className="download-label">Download to PLC</span>
              </button>
            </div>
          </div>

          <div className="steps-container">
            {jogHint && (
              <div className="jog-hint-banner">Jog mode activated—move axes to teach the new step.</div>
            )}
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
                        {(() => {
                          const axes = getPatternAxes(step.pattern);
                          const isRightSide = program.side === 'right';
                          const axisMap = isRightSide
                            ? {
                                axis1: { label: 'Axis 1 Cmd:', value: step.positions.axis1Cmd, field: 'axis1Cmd' },
                                axis2: { label: 'Axis 2 Cmd:', value: step.positions.axis2Cmd, field: 'axis2Cmd' }
                              }
                            : {
                                axis1: { label: 'Axis 3 Cmd:', value: step.positions.axis3Cmd ?? step.positions.axis1Cmd, field: 'axis3Cmd' },
                                axis2: { label: 'Axis 4 Cmd:', value: step.positions.axis4Cmd ?? step.positions.axis2Cmd, field: 'axis4Cmd' }
                              };

                          return axes.map((axis) => {
                            const cfg = axisMap[axis];
                            const valuePresent = cfg.value !== undefined && cfg.value !== null;
                            const displayValue = valuePresent ? `${parseFloat(cfg.value).toFixed(3)} mm` : '--';
                            const className = 'position-value editable';
                            const onClick = () => handleEditPosition(step.stepNumber, cfg.field);
                            return (
                              <div className="position-row" key={cfg.label}>
                                <label>{cfg.label}</label>
                                <div className={className} onClick={onClick}>
                                  {displayValue}
                                </div>
                              </div>
                            );
                          });
                        })()}
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
                          {patternOptions.map(opt => {
                            const forbidden = new Set(
                              step.stepNumber === 2 ? [1, 3, 4, 5, 8] : step.stepNumber === 10 ? [0, 2, 6] : []
                            );
                            return (
                              <option key={opt.code} value={opt.code} disabled={forbidden.has(opt.code)}>
                                {opt.code} - {opt.name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <NumericKeypad
          isOpen={keypadOpen}
          title={
            keypadTarget?.type === 'position' 
              ? `Edit ${getAxisLabelForKeypad()} Position`
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
            handleKeypadSubmit(val);
          }}
          onCancel={() => {
            setKeypadOpen(false);
            setKeypadTarget(null);
          }}
        />

        <ModernDialog
          isOpen={downloadDialog.open}
          title="📥 Download Program to PLC"
          onConfirm={confirmDownload}
          onCancel={() => setDownloadDialog({ open: false })}
          confirmText="Download"
          cancelText="Cancel"
        >
          <div className="download-confirm-content">
            <div className="download-icon-large">⬇</div>
            <p className="download-program-name">{program?.recipeName || program?.name}</p>
            <p className="download-side-info">{program?.side === 'right' ? 'Right Side' : 'Left Side'} • {editedSteps.length} Steps</p>
            <div className="download-warning">
              <span className="warning-icon">⚠️</span>
              <span>This will overwrite the current program on the PLC</span>
            </div>
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={dialog.open}
          title={dialog.title || 'Notice'}
          onClose={() => setDialog({ open: false, title: '', message: '' })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span>{dialog.message}</span>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDialog({ open: false, title: '', message: '' })}>Close</button>
            </div>
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={stepDialog.open}
          title={stepDialog.mode === 'delete' ? 'Delete Step' : 'Add Step'}
          onCancel={() => setStepDialog({ open: false, mode: 'add', stepNumber: '', pattern: 0 })}
          onConfirm={() => {
            const target = parseInt(stepDialog.stepNumber, 10);
            if (stepDialog.mode === 'delete') {
              if (isNaN(target) || target < 1 || target > editedSteps.length) {
                setDialog({ open: true, title: 'Invalid Step', message: 'Please enter a valid step number to delete.' });
                return;
              }
              if (target === 1) {
                setDialog({ open: true, title: 'Protected Step', message: 'Step 1 cannot be deleted.' });
                return;
              }
              const filtered = editedSteps
                .filter((s) => s.stepNumber !== target)
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map((s, idx) => ({
                  ...s,
                  stepNumber: idx + 1,
                  stepName: s.stepName?.replace(/Step\s+\d+/, `Step ${idx + 1}`) || `Step ${idx + 1}`
                }));
              setEditedSteps(filtered);
              setJogHint(false);
            } else {
              if (editedSteps.length >= 10) {
                setDialog({ open: true, title: 'Step Limit Reached', message: 'Cannot add more than 10 steps.' });
                setStepDialog({ open: false, mode: 'add', stepNumber: '', pattern: 0 });
                return;
              }
              const insertAtRaw = isNaN(target) ? editedSteps.length + 1 : target;
              const insertAt = Math.min(Math.max(insertAtRaw, 1), editedSteps.length + 1);
              const newStep = {
                stepNumber: insertAt,
                stepName: `Step ${insertAt}`,
                positions: { axis1Cmd: 0, axis2Cmd: 0 },
                pattern: stepDialog.pattern ?? 0,
                dwell: [1, 3, 4].includes(Number(stepDialog.pattern)) ? 0 : programDwell,
                speed: programSpeed,
                timestamp: new Date().toISOString()
              };
              const merged = [...editedSteps];
              merged.splice(insertAt - 1, 0, newStep);
              const renumbered = merged.slice(0, 10).map((s, idx) => ({
                ...s,
                stepNumber: idx + 1,
                stepName: s.stepName?.replace(/Step\s+\d+/, `Step ${idx + 1}`) || `Step ${idx + 1}`
              }));
              setEditedSteps(renumbered);
              setJogHint(true);
            }
            setStepDialog({ open: false, mode: 'add', stepNumber: '', pattern: 0 });
          }}
          confirmText="Confirm"
        >
          <div className="step-dialog-modern">
            <div className="dialog-header-row">
              <div className="dialog-icon">{stepDialog.mode === 'delete' ? '🗑' : '➕'}</div>
              <div className="dialog-heading">
                <div className="dialog-title-text">{stepDialog.mode === 'delete' ? 'Remove a step' : 'Insert a new step'}</div>
                <div className="dialog-subtitle">Maximum 10 steps allowed per program.</div>
              </div>
              <div className="dialog-pill">{editedSteps.length}/10 steps</div>
            </div>

            {stepDialog.mode === 'delete' ? (
              <div className="step-dialog-section">
                <label className="dialog-label">Step to delete</label>
                <input
                  type="number"
                  min="1"
                  max={editedSteps.length}
                  value={stepDialog.stepNumber}
                  onChange={(e) => setStepDialog((prev) => ({ ...prev, stepNumber: e.target.value }))}
                  className="step-dialog-input modern"
                />
                <div className="dialog-hint warning">Step 1 is protected. Steps will be renumbered after deletion.</div>
              </div>
            ) : (
              <>
                <div className="step-dialog-section two-col">
                  <div>
                    <label className="dialog-label">Insert at position</label>
                    <input
                      type="number"
                      min="1"
                      max={editedSteps.length + 1}
                      value={stepDialog.stepNumber}
                      onChange={(e) => setStepDialog((prev) => ({ ...prev, stepNumber: e.target.value }))}
                      className="step-dialog-input modern"
                    />
                    <div className="dialog-hint">Range 1 - {editedSteps.length + 1}</div>
                  </div>
                  <div>
                    <label className="dialog-label">Pattern</label>
                    <select
                      className="step-dialog-select modern"
                      value={stepDialog.pattern}
                      onChange={(e) => setStepDialog((prev) => ({ ...prev, pattern: parseInt(e.target.value, 10) }))}
                    >
                      {patternOptions.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.code} - {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="dialog-hint accent">After adding, jog mode will be active to teach the new step.</div>
              </>
            )}
          </div>
        </ModernDialog>
      </div>
    </div>
  );
}
