import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModernDialog from './ModernDialog';
import NumericKeypad from './NumericKeypad';
import AutoTeachAxisSelectorModal from './AutoTeachAxisSelectorModal';
import { writePLCVar } from '../services/plcApiService';
import '../styles/AutoTeach.css';

export default function AutoTeach({
  isOpen,
  onClose,
  programName,
  side,
  actualPositions,
  parameters,
  onSaveProgram,
  onWriteToPLC,
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
  const [plcStatus, setPlcStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [jogModeEnabled, setJogModeEnabled] = useState(false);
  const [showAxisSelector, setShowAxisSelector] = useState(false);
  const [jogReadyStatus, setJogReadyStatus] = useState({ id: false, od: false });
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

  // Reset the sequence ONLY when component first opens (not when props change)
  const previousIsOpenRef = useRef(false);
  useEffect(() => {
    // Only reset if transitioning from closed (false) to open (true)
    if (isOpen && !previousIsOpenRef.current) {
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
    previousIsOpenRef.current = isOpen;
  }, [isOpen]); // Only depend on isOpen, not programName or side

  // Poll jog mode status and axis feedback
  useEffect(() => {
    if (!isOpen) return;

    const pollJogMode = async () => {
      try {
        const jogModeVar = side === 'right' ? 'GRIGHTHEAD.HmiRightJogMode' : 'GLEFTHEAD.HmiLeftJogMode';
        const response = await fetch(`http://localhost:3001/read?tag=${jogModeVar}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const jogEnabled = Boolean(data.value);
            setJogModeEnabled(jogEnabled);
            setPlcStatus('good');
          } else {
            setPlcStatus('bad');
          }
        } else {
          setPlcStatus('bad');
        }
      } catch (err) {
        console.warn('[AutoTeach] Jog mode poll error:', err.message);
        setPlcStatus('bad');
      }
    };

    // Poll axis feedback
    const pollAxisFeedback = async () => {
      try {
        const idFeedbackTag = side === 'right' ? 'GRIGHTHEAD.bHmiRightExpEna' : 'GLEFTHEAD.bHmiLeftExpEna';
        const odFeedbackTag = side === 'right' ? 'GRIGHTHEAD.bHmiRightRedEna' : 'GLEFTHEAD.bHmiLeftRedEna';

        const [idRes, odRes] = await Promise.all([
          fetch(`http://localhost:3001/read?tag=${idFeedbackTag}`),
          fetch(`http://localhost:3001/read?tag=${odFeedbackTag}`)
        ]);

        if (idRes.ok && odRes.ok) {
          const idData = await idRes.json();
          const odData = await odRes.json();
          setJogReadyStatus({
            id: Boolean(idData.value),
            od: Boolean(odData.value)
          });
        }
      } catch (err) {
        console.warn('[AutoTeach] Axis feedback poll error:', err.message);
      }
    };

    const interval = setInterval(() => {
      pollJogMode();
      pollAxisFeedback();
    }, 500);
    
    pollJogMode(); // Initial read
    pollAxisFeedback();
    
    return () => clearInterval(interval);
  }, [isOpen, side]);
  useEffect(() => {
    const enableJogMode = async () => {
      try {
        const jogModeVar = side === 'right' ? 'GRIGHTHEAD.HmiRightJogMode' : 'GLEFTHEAD.HmiLeftJogMode';
        const response = await fetch('http://localhost:3001/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: jogModeVar, value: true })
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setJogModeEnabled(true);
            console.log(`[AutoTeach] Jog mode enabled for ${side} side`);
          }
        }
      } catch (err) {
        console.warn('[AutoTeach] Error enabling jog mode:', err.message);
      }
    };

    const disableJogMode = async () => {
      try {
        const jogModeVar = side === 'right' ? 'GRIGHTHEAD.HmiRightJogMode' : 'GLEFTHEAD.HmiLeftJogMode';
        const response = await fetch('http://localhost:3001/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: jogModeVar, value: false })
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setJogModeEnabled(false);
            console.log(`[AutoTeach] Jog mode disabled for ${side} side`);
          }
        }
      } catch (err) {
        console.warn('[AutoTeach] Error disabling jog mode:', err.message);
      }
    };

    if (isOpen) {
      enableJogMode();
    } else {
      disableJogMode();
    }

    // Cleanup: disable jog mode when component unmounts
    return () => {
      if (isOpen) {
        disableJogMode();
      }
    };
  }, [isOpen, side]);

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

  const buildProgramPayload = (stepsArray) => {
    const steps = {};
    (stepsArray || []).forEach((s) => {
      if (s?.step == null) return;
      steps[s.step] = {
        step: s.step,
        stepName: s.stepName,
        pattern: s.pattern,
        positions: s.positions,
        dwell: s.dwell,
        repeatTargetStep: s.repeatTargetStep,
        repeatCount: s.repeatCount,
        timestamp: s.timestamp || new Date().toISOString(),
      };
    });

    return {
      name: programName || 'AutoTeach Program',
      recipeName: programName || 'AutoTeach Program',
      side,
      speed: parameters?.recipeSpeed ?? 100,
      dwell: parameters?.stepDelay ?? 500,
      steps,
    };
  };

  const pushProgramToPLC = async (stepsArray) => {
    if (!side || !Array.isArray(stepsArray) || stepsArray.length === 0) return;
    const payload = buildProgramPayload(stepsArray);
    try {
      setLoading(true);
      // Use downloadProgram command to write to PLC
      await writePLCVar({
        command: 'downloadProgram',
        program: payload,
        parameters: parameters
      });
      setPlcStatus('good');
      onWriteToPLC?.(payload);
    } catch (e) {
      console.error('[AutoTeach] PLC write error:', e.message);
      setPlcStatus('bad');
      setDialog({
        open: true,
        title: 'PLC Write Failed',
        message: 'Unable to write Auto Teach steps to PLC. Check connection and try again.',
        confirm: closeDialog,
        cancel: null,
      });
    } finally {
      setLoading(false);
    }
  };

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

    // For Step 2+ with patterns that require axis selection, show the axis selector modal
    const requiresAxisSelection = stepNumberToRecord > 1 && 
      (patternToRecord === 0 || patternToRecord === 1 || patternToRecord === 2 || patternToRecord === 3);
    
    if (requiresAxisSelection) {
      setShowAxisSelector(true);
      setIsRecording(false);
      return;
    }

    // Otherwise, proceed with normal recording
    recordStepWithAxis(stepNumberToRecord, patternToRecord, null);
  };

  const handleAxisSelected = (selectedAxis) => {
    setShowAxisSelector(false);
    // If user cancelled (null), don't record anything
    if (selectedAxis === null) {
      return;
    }
    const stepNumberToRecord = Math.min(recordedSteps.length + 1, 10);
    const patternToRecord = stepNumberToRecord === 1 ? 6 : pattern;
    recordStepWithAxis(stepNumberToRecord, patternToRecord, selectedAxis);
  };

  const recordStepWithAxis = (stepNumberToRecord, patternToRecord, selectedAxis) => {
    const defaultStepName = stepNumberToRecord === 1 ? 'Start Position' : `Step ${stepNumberToRecord}`;
    const defaultDwell = 0;
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

    setRecordedSteps((prev) => {
      const next = [...prev, newStep];
      pushProgramToPLC(next);
      return next;
    });
    setStepName('');
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
    setRecordedSteps((prev) => {
      const next = prev.map((s, i) =>
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
      );
      pushProgramToPLC(next);
      return next;
    });

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
      pushProgramToPLC(next);
      return next;
    });
    if (editingStepIndex === index) handleCancelEdit();
  };

  // Quick pattern changes are disabled; use Edit Step to modify the pattern.


  const handleSaveProgram = async () => {
    try {
      if (recordedSteps.length > 0) {
        await pushProgramToPLC(recordedSteps);
      }
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

      <AutoTeachAxisSelectorModal
        isOpen={showAxisSelector}
        onClose={handleAxisSelected}
        patternName={patternOptions.find(p => p.code === pattern)?.name || `Pattern ${pattern}`}
        side={side}
        jogReadyStatus={jogReadyStatus}
      />

      <div className="auto-teach-overlay" onClick={onClose}>
        <div className="auto-teach-modal" onClick={(e) => e.stopPropagation()}>
          <div className="auto-teach-header">
            <h2 className="auto-teach-title-h2">🎯 Auto Mode</h2>
            <span className="program-name">{programName}</span>
            <span className={`side-badge ${side}`}>{side === 'right' ? 'R' : 'L'}</span>
            <span className="jog-mode-indicator">🕹️ {jogModeEnabled ? 'JOG ON' : 'JOG OFF'}</span>
            <span className={`plc-status-pill ${plcStatus}`}>
              {loading ? 'Writing…' : plcStatus === 'good' ? '🟢 Live' : plcStatus === 'bad' ? '🔴 Offline' : '🟡 Unknown'}
            </span>
            <div className="progress-section">
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${(recordedSteps.length / 10) * 100}%` }}></div>
              </div>
              <div className="progress-text">{recordedSteps.length}/10</div>
            </div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="auto-teach-content">
            {/* Current Step Controls */}
            <div className="current-step-controls">
              <div className="step-indicator">
                <span className="step-badge">Step {activeStepNumber}/10</span>
                <span className="position-compact">
                  {axis1Label}: {Number(safeActualPositions.axis1).toFixed(3)} | {axis2Label}: {Number(safeActualPositions.axis2).toFixed(3)}
                </span>
              </div>
              <div className="teach-controls-row">
                <input
                  type="text"
                  value={stepName}
                  onChange={(e) => setStepName(e.target.value)}
                  placeholder={activeStepNumber === 1 ? 'Start Position' : `Step ${activeStepNumber}`}
                  className="step-name-input-compact"
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
                        message: 'Selected pattern is not allowed for this step.',
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
                          message: 'Record a step between 2 and 9 first.',
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
                  className="pattern-select-compact"
                  disabled={activeStepNumber === 1}
                >
                  {availablePatternOptions.map((opt) => (
                    <option key={opt.code} value={opt.code} disabled={!!opt.disabled}>
                      {opt.code} - {opt.name}
                    </option>
                  ))}
                </select>
                <button
                  className={`record-btn-compact ${isRecording ? 'recording' : ''}`}
                  onClick={handleRecordPosition}
                  disabled={isRecording || recordedSteps.length >= 10}
                >
                  {recordedSteps.length >= 10 ? 'Complete' : isRecording ? '⏺' : '⏺ Record'}
                </button>
              </div>

              {/* Jog Mode Controls */}
              <div className="jog-controls-row">
                {jogModeEnabled && (
                  <>
                    <button
                      className="id-enable-btn"
                      onClick={async () => {
                        try {
                          console.log(`[AutoTeach] Enabling ID head for ${side} side`);
                          const index = side === 'left' ? 7 : 46;
                          await fetch('http://localhost:3001/io/pulse', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ index, durationMs: 500 })
                          });
                          console.log('[AutoTeach] ID enable pulse sent');
                        } catch (err) {
                          console.error('[AutoTeach] Failed to enable ID:', err);
                        }
                      }}
                      title="Enable ID head for teaching"
                    >
                      📍 ID
                    </button>

                    <button
                      className="od-enable-btn"
                      onClick={async () => {
                        try {
                          console.log(`[AutoTeach] Enabling OD head for ${side} side`);
                          const index = side === 'left' ? 9 : 48;
                          await fetch('http://localhost:3001/io/pulse', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ index, durationMs: 500 })
                          });
                          console.log('[AutoTeach] OD enable pulse sent');
                        } catch (err) {
                          console.error('[AutoTeach] Failed to enable OD:', err);
                        }
                      }}
                      title="Enable OD head for teaching"
                    >
                      📍 OD
                    </button>

                    <button
                      className="jog-disable-btn"
                      onClick={async () => {
                        try {
                          console.log(`[AutoTeach] Disabling jog for ${side} side`);
                          const tag = side === 'left' 
                            ? 'GLEFTHEAD.bLeftJogHeadEnabledOff' 
                            : 'GRIGHTHEAD.bRightJogHeadEnabledOff';
                          await fetch('http://localhost:3001/pulse-bool', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tag, durationMs: 100 })
                          });
                          console.log('[AutoTeach] Jog disable pulse sent');
                        } catch (err) {
                          console.error('[AutoTeach] Failed to disable jog:', err);
                        }
                      }}
                      title="Disable jog mode and exit teaching"
                    >
                      ⏹ Disable Jog
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Recorded Steps Grid - Only Show Recorded Steps */}
            <div className="steps-grid">
              {recordedSteps.map((recordedStep, index) => {
                const stepNum = recordedStep.step;
                return (
                  <div 
                    key={stepNum} 
                    className="step-grid-card recorded"
                    ref={stepNum === activeStepNumber ? activeCardRef : null}
                  >
                    <div className="card-header">
                      <span className="card-step-num">
                        ✓ Step {stepNum}
                      </span>
                      <div className="card-actions">
                        <button 
                          className="card-edit-btn" 
                          onClick={() => handleEditStep(index)}
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button 
                          className="card-delete-btn" 
                          onClick={() => handleDeleteStep(index)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    <div className="card-content">
                      <div className="card-name">{recordedStep.stepName}</div>
                      <div className="card-pattern">
                        {patternOptions.find((p) => p.code === recordedStep.pattern)?.name || `Pattern ${recordedStep.pattern}`}
                      </div>
                      {recordedStep.pattern === 5 && recordedStep.repeatTargetStep ? (
                        <div className="card-repeat">
                          ↻ Repeat Step {recordedStep.repeatTargetStep} × {recordedStep.repeatCount || 1}
                        </div>
                      ) : (
                        <div className="card-positions">
                          {(() => {
                            const meta = patternAxisMeta[recordedStep.pattern] || { axes: 'both' };
                            const showAxis1 = meta.axes === 'both' || meta.axes === 'id';
                            const showAxis2 = meta.axes === 'both' || meta.axes === 'od';
                            return (
                              <>
                                {showAxis1 && recordedStep.positions.axis1Cmd !== undefined && (
                                  <div>{axis1Label}: {Number(recordedStep.positions.axis1Cmd).toFixed(2)}</div>
                                )}
                                {showAxis2 && recordedStep.positions.axis2Cmd !== undefined && (
                                  <div>{axis2Label}: {Number(recordedStep.positions.axis2Cmd).toFixed(2)}</div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save Program Button at Bottom */}
            <div className="save-program-section">
              <button
                className="save-program-btn"
                onClick={handleSaveProgram}
                disabled={recordedSteps.length === 0}
              >
                💾 Save Program ({recordedSteps.length} steps)
              </button>
              <button className="cancel-teach-btn" onClick={onClose}>
                Cancel
              </button>
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
              onConfirm={async () => {
                await handleSaveProgram();
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

            {/* Edit Step Modal */}
            <ModernDialog
              open={editingStepIndex !== null}
              title={`Edit Step ${editingStepIndex !== null ? recordedSteps[editingStepIndex]?.step : ''}`}
              confirmText="Save"
              cancelText="Cancel"
              onConfirm={handleSaveEditStep}
              onCancel={handleCancelEdit}
            >
              {editingStepIndex !== null && (
                <div className="edit-step-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px' }}>
                  <div className="form-group">
                    <label style={{ color: '#88c0ff', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Step Name</label>
                    <input
                      type="text"
                      value={editStepName}
                      onChange={(e) => setEditStepName(e.target.value)}
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid #2a4a7f',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: 'white',
                        fontSize: '1rem',
                        width: '100%'
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#88c0ff', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Pattern</label>
                    <select
                      value={editStepPattern}
                      onChange={(e) => setEditStepPattern(parseInt(e.target.value, 10))}
                      disabled={recordedSteps[editingStepIndex]?.step === 1}
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid #2a4a7f',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        color: 'white',
                        fontSize: '1rem',
                        width: '100%',
                        cursor: 'pointer'
                      }}
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
                </div>
              )}
            </ModernDialog>
        </div>
      </div>
    </>
  );
}
