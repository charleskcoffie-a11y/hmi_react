import React, { useState, useEffect, useRef } from 'react';
import ModernDialog from './ModernDialog';
import AxisSelectionModal from './AxisSelectionModal';
import '../styles/ProgramEditor.css';
import NumericKeypad from './NumericKeypad';
import { readAxisPositions, writePLCVar } from '../services/plcApiService';

export default function ProgramEditor({ isOpen, onClose, program, onSaveProgram, onWriteToPLC, unitSystem, jogSpeed = 100, onJogSpeedChange = () => {} }) {
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [editedSteps, setEditedSteps] = useState([]);
  const [currentPage, setCurrentPage] = useState(1); // Page 1 = steps 1-10, Page 2 = steps 11-20
  // Removed unused editingStepId and setEditingStepId
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState(null);
  const [keypadValue, setKeypadValue] = useState('');
  const [programSpeed, setProgramSpeed] = useState(100);
  const [programDwell, setProgramDwell] = useState(500);
  const [stepDialog, setStepDialog] = useState({ open: false, mode: 'add', stepNumber: '', pattern: 0, repeatTargetStep: 1, repeatCount: 1 });
  const [repeatDialog, setRepeatDialog] = useState({ open: false, stepNumber: null, repeatTargetStep: 1, repeatCount: 1 });
  const [autoEditDialog, setAutoEditDialog] = useState({ open: false, currentDiameter: '', desiredDiameter: '' });
  const [dwellDialog, setDwellDialog] = useState({ open: false });
  const [patternDialog, setPatternDialog] = useState({ open: false, selectedStep: null });
  const [reteachDialog, setReteachDialog] = useState({ open: false, stepNumber: '' });
  const [reteachPatternDialog, setReteachPatternDialog] = useState({ open: false, stepNumber: null, pattern: 0 });
  const [teachDialog, setTeachDialog] = useState({ open: false, stepNumber: null, jogMode: false });
  const [currentTeachPositions, setCurrentTeachPositions] = useState({ axis1Cmd: 0, axis2Cmd: 0 });
  const [jogHint, setJogHint] = useState(false);
  const [downloadDialog, setDownloadDialog] = useState({ open: false });
  const [loading, setLoading] = useState(false);
  const [plcStatus, setPlcStatus] = useState('unknown');
  const [showAxisModal, setShowAxisModal] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [pendingStep, setPendingStep] = useState(null); // Store step data while waiting for axis selection
  const [reteachTarget, setReteachTarget] = useState(null); // Store step data while reteaching
  const [jogMode, setJogMode] = useState(false); // Jog mode local UI state
  const [jogModeActive, setJogModeActive] = useState(false); // PLC feedback for jog mode
  const [selectedJogAxis, setSelectedJogAxis] = useState(null); // Selected axis for jog
  const [jogPollInterval, setJogPollInterval] = useState(null); // Polling interval for jog feedback
  const jogFeedbackDebounceRef = useRef({ candidate: null, since: 0 });
  const [lastAxisFeedback, setLastAxisFeedback] = useState([]); // Track PLC feedback for axis selection
  const [enablingAxis, setEnablingAxis] = useState(false); // Track if currently enabling axis

  const INCH_TO_MM = 25.4;
  const MM_TO_INCH = 0.0393701;
  const toDisplayUnits = (val) => (unitSystem === 'mm' ? val * INCH_TO_MM : val);
  const toStorageUnits = (val) => (unitSystem === 'mm' ? val * MM_TO_INCH : val);

  const getPatternAxes = (patternCode) => {
    const code = Number(patternCode ?? 0);
    const axis1Only = new Set([2, 3]); // Exp Ext / Exp Ret
    const axis2Only = new Set([0, 1]); // Red Ext / Red Ret
    const both = new Set([4, 6]); // RedRet+ExpRet, RedExt+ExpExt
    if (both.has(code)) return ['axis1', 'axis2'];
    if (axis1Only.has(code)) return ['axis1'];
    if (axis2Only.has(code)) return ['axis2'];
    return [];
  };

  // Handle axis enable button click with PLC pulsing and feedback polling
  const handleEnableAxis = async (axis, speed = 100) => {
    // console.log('[ProgramEditor] handleEnableAxis called - axis:', axis, 'speed:', speed, 'side:', program.side);
    
    try {
      setEnablingAxis(true);
      const side = program.side || 'right';
      const idTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpPb' : 'GRIGHTHEAD.bHmiRightExpPb';
      const odTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedPb' : 'GRIGHTHEAD.bHmiRightRedPb';
      const idReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpEna' : 'GRIGHTHEAD.bHmiRightExpEna';
      const odReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedEna' : 'GRIGHTHEAD.bHmiRightRedEna';

      const tagsToPulse = axis === 'id' ? [idTag] : axis === 'od' ? [odTag] : [idTag, odTag];
      
      // Calculate pulse duration from speed percentage
      const pulseDuration = 50 + (150 * speed / 100);
      
      // console.log('[ProgramEditor] Pulsing tags for axis:', axis, 'tags:', tagsToPulse, 'duration:', pulseDuration);
      
      // Pulse each tag
      for (const tag of tagsToPulse) {
        // console.log('[ProgramEditor] PULSE REQUEST: tag=', tag, 'durationMs=', pulseDuration);
        
        const response = await fetch('http://localhost:3001/pulse-bool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag, durationMs: pulseDuration })
        });
        
        // console.log('[ProgramEditor] PULSE HTTP RESPONSE: status=', response.status, 'statusText=', response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ProgramEditor] PULSE HTTP ERROR:', errorText);
          throw new Error(`HTTP error: ${response.status} ${response.statusText} for tag ${tag}`);
        }
        
        const result = await response.json();
        // console.log('[ProgramEditor] PULSE RESULT JSON:', result);
        
        if (!result.success) {
          console.error('[ProgramEditor] PULSE FAILED - PLC returned success=false:', result);
          throw new Error(result.error || result.message || `PLC pulse failed for ${tag}`);
        }
        
        // console.log('[ProgramEditor] PULSE SUCCESS for tag:', tag);
      }

      // Poll PLC ready feedback for selected axis(es)
      const readyTags = axis === 'id' ? [idReadyTag] : axis === 'od' ? [odReadyTag] : [idReadyTag, odReadyTag];
      const waitForFeedback = async (tags, timeoutMs = 3000, intervalMs = 150) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          try {
            const reads = await Promise.all(
              tags.map(async (t) => {
                const resp = await fetch(`http://localhost:3001/read?tag=${encodeURIComponent(t)}`);
                if (!resp.ok) return { tag: t, ok: false };
                const json = await resp.json();
                const raw = json?.value;
                const value = raw === true || raw === 1 || raw === 'true' || raw === 'TRUE';
                return { tag: t, ok: true, value };
              })
            );
            const allTrue = reads.every((r) => r.ok && r.value === true);
            setLastAxisFeedback(reads);
            // console.log('[ProgramEditor] Enable Feedback poll:', reads, 'allTrue:', allTrue);
            if (allTrue) return true;
          } catch (e) {
            // console.warn('[ProgramEditor] Enable Feedback poll error:', e?.message);
          }
          await new Promise((res) => setTimeout(res, intervalMs));
        }
        return false;
      };

      const feedbackOk = await waitForFeedback(readyTags);
      if (!feedbackOk) {
        throw new Error(`Axis not ready. Feedback: ${readyTags.join(', ')}`);
      }
      
      // console.log('[ProgramEditor] Successfully enabled axis:', axis);
      setEnablingAxis(false);
      
    } catch (err) {
      console.error('[ProgramEditor] Error enabling axis:', err?.message);
      setEnablingAxis(false);
      setDialog({
        open: true,
        title: 'Axis Enable Failed',
        message: `Failed to enable ${axis.toUpperCase()} axis: ${err?.message}. Check PLC connection and try again.`,
        confirm: () => setDialog({ open: false, title: '', message: '' }),
        cancel: null,
      });
      throw err; // Re-throw so modal button can catch it
    }
  };

  useEffect(() => {
    if (program && program.steps) {
      // Convert steps object to array and filter only enabled steps
      const stepsArray = Object.keys(program.steps)
        .map(key => {
          const step = program.steps[key];
          const pattern = step?.pattern;
          // Default dwell is 0 for all axes
          const defaultDwell = step?.dwell ?? 0;
          return {
            ...step,
            stepNumber: parseInt(key),
            speed: step?.speed ?? program.speed ?? 100,
            dwell: defaultDwell
          };
        })
        .filter(step => step.enabled !== false); // Only show enabled steps (default true)
      
      console.log('[ProgramEditor] Loaded program steps:', stepsArray.length, 'steps');
      console.log('[ProgramEditor] Steps data:', stepsArray.map(s => `${s.stepNumber}:${s.stepName} (enabled=${s.enabled})`));
      
      setEditedSteps(stepsArray);
      setProgramSpeed(program.speed || 100);
      setProgramDwell(program.dwell || 500);
    }
  }, [program?.name, program?.side]); // Only reload when program name/side changes, not the steps object itself

  // Reset page to 1 when dialog opens or program/side changes
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      console.log('[ProgramEditor] Reset to page 1 (dialog opened or program changed)');
    }
  }, [isOpen, program?.name, program?.side]);

  // Auto-enable jog mode when axis modal is shown for teaching
  useEffect(() => {
    const enableJogForTeaching = async () => {
      if (showAxisModal && !jogMode && program?.side) {
        console.log(`[ProgramEditor] Auto-enabling jog mode for ${program.side} side (teaching step)`);
        try {
          await writePLCVar({ command: 'enableJog', side: program.side });
          setJogMode(true);
        } catch (err) {
          console.error('[ProgramEditor] Failed to auto-enable jog mode:', err.message);
        }
      }
    };
    enableJogForTeaching();
  }, [showAxisModal, jogMode, program?.side]);

  // Poll jog mode feedback from PLC
  useEffect(() => {
    if (!jogMode || !program?.side) return;

    const pollJogFeedback = async () => {
      try {
        const res = await fetch('http://localhost:3001/read');
        if (!res.ok) return;
        const data = await res.json();
        
        // Determine which jog mode variable to read based on side
        const jogModeVarName = program.side === 'left' 
          ? 'GLEFTHEAD.bHmiLeftJogMode' 
          : 'GRIGHTHEAD.bHmiRightJogMode';
        
        // Find the variable in the response
        const jogModeValue = !!(data.variables?.[jogModeVarName]?.value ?? false);
        const now = Date.now();
        const candidate = jogFeedbackDebounceRef.current.candidate;
        const sameCandidate = candidate === jogModeValue;

        if (!sameCandidate) {
          jogFeedbackDebounceRef.current.candidate = jogModeValue;
          jogFeedbackDebounceRef.current.since = now;
          return;
        }

        if (now - jogFeedbackDebounceRef.current.since >= 300) {
          setJogModeActive(jogModeValue);
        }
        console.log(`[ProgramEditor] Jog feedback (${program.side}):`, jogModeValue);
      } catch (err) {
        console.error('[ProgramEditor] Failed to poll jog feedback:', err.message);
      }
    };

    // Poll every 150ms while in jog mode for faster feedback
    const interval = setInterval(pollJogFeedback, 150);
    setJogPollInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jogMode, program?.side]);

  // Write jog speed to PLC when it changes
  useEffect(() => {
    const writeJogSpeed = async () => {
      try {
        const speedTag = program?.side === 'left' ? 'GLEFTHEAD.lHmileftJogSpd' : 'GRIGHTHEAD.lHmiRightJogSpd';
        await fetch('http://localhost:3001/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: speedTag, value: jogSpeed })
        });
        console.log(`[ProgramEditor] Wrote jog speed ${jogSpeed}% to ${speedTag}`);
      } catch (err) {
        console.warn('[ProgramEditor] Failed to write jog speed to PLC:', err.message);
      }
    };
    if (isOpen && program?.side) writeJogSpeed();
  }, [jogSpeed, program?.side, isOpen]);

  // Handle jog mode enable/disable
  const handleJogModeToggle = async () => {
    if (!program?.side) {
      console.error('[ProgramEditor] No program side defined');
      return;
    }

    try {
      if (!jogMode) {
        // Enable jog mode - send pulse to PLC
        console.log(`[ProgramEditor] Enabling jog mode for ${program.side}`);
        await writePLCVar({ command: 'enableJog', side: program.side });
        setJogMode(true);
      } else {
        // Disable jog mode locally - PLC handles its own disable logic
        // Do not send disable command; PLC manages jog state
        console.log(`[ProgramEditor] Disabling jog mode for ${program.side}`);
        setJogMode(false);
        setJogModeActive(false);
      }
    } catch (err) {
      console.error('[ProgramEditor] Jog mode toggle failed:', err.message);
      setDialog({ 
        open: true, 
        title: 'Jog Mode Error', 
        message: `Failed to toggle jog mode: ${err.message}` 
      });
    }
  };

  const confirmDownload = async () => {
    setDownloadDialog({ open: false });
    if (!program) return;
    
    // Prepare program with all step data
    const stepsObject = {};
    editedSteps.forEach(step => {
      stepsObject[step.stepNumber] = {
        stepNumber: step.stepNumber,
        stepName: step.stepName,
        positions: step.positions,
        pattern: step.pattern,
        speed: step.speed || programSpeed,
        dwell: step.dwell || programDwell,
        repeatTarget: step.repeatTarget,
        repeatCount: step.repeatCount,
        enabled: step.enabled !== false
      };
    });

    const programData = {
      side: program.side,
      program: {
        name: program.name,
        steps: stepsObject,
        speed: programSpeed,
        dwell: programDwell
      }
    };

    try {
      setLoading(true);
      
      // Call write-program endpoint
      const response = await fetch('http://localhost:3001/write-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(programData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error writing program to PLC');
      }

      setPlcStatus('good');
      onWriteToPLC?.(programData.program);
      setDialog({
        open: true,
        title: '✓ Download Success',
        message: `Program "${program.name}" successfully downloaded to ${program.side} side PLC`
      });
    } catch (e) {
      setPlcStatus('bad');
      setDialog({
        open: true,
        title: '✗ Download Failed',
        message: `Failed to download program "${program.name}" to PLC: ${e.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPosition = (stepNumber, field) => {
    const step = editedSteps.find(s => s.stepNumber === stepNumber);
    if (step) {
      setKeypadTarget({ stepNumber, field, type: 'position' });
      const rawValue = step.positions?.[field] ?? 0;
      setKeypadValue(toDisplayUnits(rawValue));
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

    if (keypadTarget.type === 'deleteStep') {
      setStepDialog((prev) => ({ ...prev, stepNumber: value }));
      setKeypadOpen(false);
      setKeypadTarget(null);
      return;
    }

    if (keypadTarget.type === 'repeatTargetStep') {
      const parsed = parseInt(value, 10);
      const stepNumber = repeatDialog.stepNumber;
      const safeTarget = isNaN(parsed) ? 1 : Math.max(1, Math.min(parsed, stepNumber - 1));
      
      // Update editedSteps with the new repeat target
      const updatedSteps = editedSteps.map(step => {
        if (step.stepNumber === stepNumber) {
          return { ...step, repeatTargetStep: safeTarget };
        }
        return step;
      });
      setEditedSteps(updatedSteps);
      
      setRepeatDialog((prev) => ({ ...prev, repeatTargetStep: safeTarget }));
      setKeypadOpen(false);
      setKeypadTarget(null);
      return;
    }

    if (keypadTarget.type === 'repeatCount') {
      const parsed = parseInt(value, 10);
      const stepNumber = repeatDialog.stepNumber;
      const safeCount = isNaN(parsed) ? 1 : Math.max(1, Math.min(parsed, 999));
      
      // Update editedSteps with the new repeat count
      const updatedSteps = editedSteps.map(step => {
        if (step.stepNumber === stepNumber) {
          return { ...step, repeatCount: safeCount };
        }
        return step;
      });
      setEditedSteps(updatedSteps);
      
      setRepeatDialog((prev) => ({ ...prev, repeatCount: safeCount }));
      setKeypadOpen(false);
      setKeypadTarget(null);
      return;
    }

    if (keypadTarget.type === 'reteachStep') {
      const parsed = parseInt(value, 10);
      setReteachDialog((prev) => ({ ...prev, stepNumber: isNaN(parsed) ? '' : parsed }));
      setKeypadOpen(false);
      setKeypadTarget(null);
      return;
    }

    if (keypadTarget.type === 'autoCurrentDiameter') {
      const parsed = parseFloat(value);
      setAutoEditDialog((prev) => ({ ...prev, currentDiameter: isNaN(parsed) ? '' : parsed }));
      setKeypadOpen(false);
      setKeypadTarget(null);
      return;
    }

    if (keypadTarget.type === 'autoDesiredDiameter') {
      const parsed = parseFloat(value);
      setAutoEditDialog((prev) => ({ ...prev, desiredDiameter: isNaN(parsed) ? '' : parsed }));
      setKeypadOpen(false);
      setKeypadTarget(null);
      return;
    }

    const updatedSteps = editedSteps.map(step => {
      if (step.stepNumber === keypadTarget.stepNumber) {
        if (keypadTarget.type === 'position' && keypadTarget.field) {
          const parsedValue = parseFloat(value);
          const storageValue = toStorageUnits(parsedValue);
          return {
            ...step,
            positions: {
              ...step.positions,
              [keypadTarget.field]: storageValue
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

  const getForbiddenPatterns = (stepNumber) => new Set(
    stepNumber === 2 ? [1, 3, 4, 5, 8] : stepNumber === 10 ? [0, 2, 6] : []
  );

  const returnPatterns = new Set([1, 3, 4, 7]); // Red Ret, Exp Ret, Both Ret, RedExt+ExpRet

  const handleEditPattern = (stepNumber, newPattern) => {
    // Enforce pattern restrictions: Step 2 disallow 1,3,4,5,8; Step 10 disallow 0,2,6
    const forbidden = getForbiddenPatterns(stepNumber);
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
    if (Number(newPattern) === 5) {
      const step = editedSteps.find(s => s.stepNumber === stepNumber);
      const fallbackTarget = Math.max(1, (step?.stepNumber || 2) - 1);
      setRepeatDialog({
        open: true,
        stepNumber,
        repeatTargetStep: step?.repeatTargetStep || fallbackTarget,
        repeatCount: step?.repeatCount || 1
      });
      return;
    }

    const updatedSteps = editedSteps.map(step => {
      if (step.stepNumber === stepNumber) {
        const cleaned = { ...step, pattern: newPattern };
        if (Number(newPattern) !== 5) {
          delete cleaned.repeatTargetStep;
          delete cleaned.repeatCount;
        }
        return cleaned;
      }
      return step;
    });
    setEditedSteps(updatedSteps);
  };

  const applyReturnCopy = (stepNumber, patternOverride = null) => {
    const step1 = editedSteps.find((s) => s.stepNumber === 1);
    if (!step1) {
      setDialog({ open: true, title: 'Missing Step 1', message: 'Cannot auto-copy return positions without Step 1.' });
      return;
    }
    const idPos = program.side === 'left'
      ? Number(step1.positions?.axis3Cmd ?? step1.positions?.axis1Cmd ?? 0)
      : Number(step1.positions?.axis1Cmd ?? step1.positions?.axis3Cmd ?? 0);
    const odPos = program.side === 'left'
      ? Number(step1.positions?.axis4Cmd ?? step1.positions?.axis2Cmd ?? 0)
      : Number(step1.positions?.axis2Cmd ?? step1.positions?.axis4Cmd ?? 0);

    const updated = editedSteps.map((step) => {
      if (step.stepNumber !== stepNumber) return step;
      const nextPositions = program.side === 'left'
        ? {
            ...step.positions,
            axis3Cmd: idPos,
            axis4Cmd: odPos
          }
        : {
            ...step.positions,
            axis1Cmd: idPos,
            axis2Cmd: odPos
          };
      return {
        ...step,
        pattern: patternOverride ?? step.pattern,
        positions: nextPositions
      };
    });
    setEditedSteps(updated);
  };

  const handleReteachStart = (stepNumber, patternOverride = null) => {
    const targetStep = editedSteps.find((s) => s.stepNumber === stepNumber);
    if (!targetStep) {
      setDialog({ open: true, title: 'Step Not Found', message: `Step ${stepNumber} does not exist.` });
      return;
    }

    const nextPattern = patternOverride ?? targetStep.pattern;
    const forbidden = getForbiddenPatterns(stepNumber);
    if (forbidden.has(Number(nextPattern))) {
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

    if (Number(nextPattern) === 5) {
      // Open repeat configuration dialog for repeat pattern steps
      const eligibleTargets = editedSteps
        .filter(s => s.stepNumber < stepNumber && s.stepNumber >= 1)
        .map(s => s.stepNumber);
      const fallbackTarget = eligibleTargets.length > 0 ? Math.max(...eligibleTargets) : 1;
      
      setRepeatDialog({
        open: true,
        stepNumber: stepNumber,
        repeatTargetStep: targetStep.repeatTargetStep || fallbackTarget,
        repeatCount: targetStep.repeatCount || 1
      });
      return;
    }

    if (returnPatterns.has(Number(nextPattern))) {
      applyReturnCopy(stepNumber, nextPattern);
      return;
    }

    setReteachTarget({
      stepNumber,
      pattern: nextPattern,
      axesPattern: stepNumber === 1 ? 6 : nextPattern
    });
    setShowAxisModal(true);
    setJogHint(true);
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
        speed: step.speed ?? program.speed ?? 100,
        enabled: step.enabled !== false, // Preserve enabled state
        ...(step.pattern === 5 ? { // Include repeat fields for pattern 5
          repeatTargetStep: step.repeatTargetStep || 1,
          repeatCount: step.repeatCount || 1
        } : {})
      };
    });

    console.log('[ProgramEditor] Saving program with', Object.keys(stepsObject).length, 'steps');
    console.log('[ProgramEditor] Steps being saved:', Object.keys(stepsObject).map(k => `${k}:${stepsObject[k].stepName} (enabled=${stepsObject[k].enabled})`));

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
    { code: 2, name: 'ID Ext' },
    { code: 3, name: 'ID Ret' },
    { code: 0, name: 'OD Ext' },
    { code: 1, name: 'OD Ret' },
    { code: 4, name: 'OD Ret + ID Ret' },
    { code: 5, name: 'Repeat' },
    { code: 6, name: 'OD Ext + ID Ext' },
    { code: 8, name: 'All off' }
  ];

  const closeDialog = () => setDialog({ open: false, title: '', message: '' });

  const displaySteps = editedSteps.filter(s => {
    const start = (currentPage - 1) * 10 + 1;
    const end = Math.min(currentPage * 10, 20);
    return s.stepNumber >= start && s.stepNumber <= end;
  });

  const getAxisLabelForKeypad = () => {
    const map = {
      axis1Cmd: 'ID (Right)',
      axis2Cmd: 'OD (Right)',
      axis3Cmd: 'ID (Left)',
      axis4Cmd: 'OD (Left)'
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
              <span className={`plc-status-inline ${plcStatus}`}>
                {loading ? 'Writing...' : plcStatus === 'good' ? 'PLC live' : plcStatus === 'bad' ? 'PLC offline' : 'PLC unknown'}
              </span>
            </div>
          </div>
          <div className="program-header-actions">
            <div className="step-actions-group">
              <button
                className="step-action-btn add"
                onClick={() => {
                  if (editedSteps.length >= 20) {
                    setDialog({ open: true, title: 'Step Limit', message: 'Maximum of 20 steps allowed.' });
                    return;
                  }
                  setStepDialog({ open: true, mode: 'add', stepNumber: editedSteps.length + 1, pattern: 0, repeatTargetStep: 1, repeatCount: 1 });
                }}
                disabled={editedSteps.length >= 20}
              >
                + Add Step
              </button>
              <button 
                className={`step-action-btn jog ${jogModeActive ? 'active' : ''}`}
                onClick={handleJogModeToggle}
                title={jogModeActive ? 'Jog Mode: ACTIVE on PLC' : 'Jog Mode: Inactive (Click to enable)'}
              >
                {jogModeActive ? '✓ In Jog Mode' : 'Enable Jog'}
              </button>
              <button className="step-action-btn delete" onClick={() => setStepDialog({ open: true, mode: 'delete', stepNumber: '', pattern: 0, repeatTargetStep: 1, repeatCount: 1 })}>
                🗑 Delete Step
              </button>
              <button
                className="step-action-btn reteach"
                onClick={() => setReteachDialog({ open: true, stepNumber: '' })}
              >
                ↺ Reteach
              </button>
            </div>
            <div className="program-actions-group">
              <button className="auto-edit-btn" onClick={() => setAutoEditDialog({ open: true, currentDiameter: '', desiredDiameter: '' })}>
                ⚡ Auto Edit
              </button>
              <button className="edit-all-dwell-btn" onClick={() => setDwellDialog({ open: true })}>
                ⏱ Edit Dwell
              </button>
              <button className="edit-all-pattern-btn" onClick={() => setPatternDialog({ open: true, selectedStep: null })}>
                ≋ Edit Pattern
              </button>
              <button className="save-program-btn" onClick={handleSave}>
                💾 Save Changes
              </button>
              <button className="cancel-program-btn" onClick={onClose}>
                ✕ Cancel
              </button>
            </div>

            {/* Jog Speed Button - Opens Modal */}
            <button
              className="program-jog-speed-btn"
              onClick={() => setShowSpeedModal(true)}
              title="Adjust jog speed for this editing session"
            >
              ⚡ Speed: {jogSpeed}%
            </button>

            {jogHint && (
              <div className="jog-mode-banner">
                <span className="jog-icon">⇄</span>
                <span className="jog-text">JOG MODE ACTIVE</span>
                <span className="jog-desc">Move axes to teach positions</span>
              </div>
            )}
          </div>
        </div>

        <div className="program-editor-content no-scroll">

          <div className="steps-container">
            {editedSteps.length === 0 ? (
              <div className="no-steps">No steps in this program</div>
            ) : (
              <>
                {editedSteps.length > 10 && (
                  <div className="pagination-controls">
                    <button 
                      className="page-nav-btn prev"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      ◀ Page 1 (Steps 1-10)
                    </button>
                    <span className="page-indicator">Page {currentPage}</span>
                    <button 
                      className="page-nav-btn next"
                      onClick={() => setCurrentPage(2)}
                      disabled={currentPage === 2}
                    >
                      Page 2 (Steps 11-20) ▶
                    </button>
                  </div>
                )}
                <div className="steps-grid">
                  {displaySteps.map((step) => {
                  const patternName = patternOptions.find((p) => p.code === step.pattern)?.name || `Pattern ${step.pattern}`;
                  const canReteachHeader = true; // All steps can be clicked - repeat opens config dialog
                  const headerTitle = step.pattern === 5 
                    ? 'Click to edit repeat settings' 
                    : 'Click to reteach this step';
                  return (
                  <div key={step.stepNumber} className="step-editor-card">
                    <div
                      className={`step-card-header ${canReteachHeader ? 'reteach-enabled' : 'reteach-disabled'}`}
                      onClick={() => {
                        if (canReteachHeader) handleReteachStart(step.stepNumber);
                      }}
                      onKeyDown={(e) => {
                        if (!canReteachHeader) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleReteachStart(step.stepNumber);
                        }
                      }}
                      role="button"
                      tabIndex={canReteachHeader ? 0 : -1}
                      title={headerTitle}
                    >
                      <span className="step-number">Step {step.stepNumber} - {patternName}</span>
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
                                axis1: { label: 'ID Cmd:', value: step.positions.axis1Cmd, field: 'axis1Cmd' },
                                axis2: { label: 'OD Cmd:', value: step.positions.axis2Cmd, field: 'axis2Cmd' }
                              }
                            : {
                                axis1: { label: 'ID Cmd:', value: step.positions.axis3Cmd ?? step.positions.axis1Cmd, field: 'axis3Cmd' },
                                axis2: { label: 'OD Cmd:', value: step.positions.axis4Cmd ?? step.positions.axis2Cmd, field: 'axis4Cmd' }
                              };

                          return axes.map((axis) => {
                            const cfg = axisMap[axis];
                            const valuePresent = cfg.value !== undefined && cfg.value !== null;
                            const unitLabel = unitSystem === 'inch' ? 'in' : 'mm';
                            const convertedValue = valuePresent ? toDisplayUnits(parseFloat(cfg.value)) : null;
                            const displayValue = valuePresent ? `${convertedValue.toFixed(3)} ${unitLabel}` : '--';
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
                        <h4>⚙ Settings</h4>
                        <div className="settings-row">
                          <label>Speed:</label>
                          <div 
                            className="setting-value editable"
                            onClick={() => handleEditSpeed(step.stepNumber)}
                          >
                            {step.speed || programSpeed}%
                          </div>
                        </div>
                        {step.pattern === 5 && (
                          <>
                            <div className="settings-row">
                              <label>Repeat Step:</label>
                              <div 
                                className="setting-value editable"
                                onClick={() => {
                                  setKeypadTarget({ type: 'repeatTargetStep' });
                                  setKeypadValue(String(step.repeatTargetStep || 1));
                                  setRepeatDialog({
                                    open: false,
                                    stepNumber: step.stepNumber,
                                    repeatTargetStep: step.repeatTargetStep || 1,
                                    repeatCount: step.repeatCount || 1
                                  });
                                  setKeypadOpen(true);
                                }}
                              >
                                {step.repeatTargetStep || 1}
                              </div>
                            </div>
                            <div className="settings-row">
                              <label>Repeat Count:</label>
                              <div 
                                className="setting-value editable"
                                onClick={() => {
                                  setKeypadTarget({ type: 'repeatCount' });
                                  setKeypadValue(String(step.repeatCount || 1));
                                  setRepeatDialog({
                                    open: false,
                                    stepNumber: step.stepNumber,
                                    repeatTargetStep: step.repeatTargetStep || 1,
                                    repeatCount: step.repeatCount || 1
                                  });
                                  setKeypadOpen(true);
                                }}
                              >
                                {step.repeatCount || 1}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        </div>

        <NumericKeypad
          isOpen={keypadOpen}
          title={
            keypadTarget?.type === 'deleteStep'
              ? 'Delete Step Number'
              : keypadTarget?.type === 'reteachStep'
              ? 'Reteach Step Number'
              : keypadTarget?.type === 'repeatTargetStep'
              ? 'Repeat: Target Step'
              : keypadTarget?.type === 'repeatCount'
              ? 'Repeat: Times'
              : keypadTarget?.type === 'autoCurrentDiameter'
              ? 'Current Diameter'
              : keypadTarget?.type === 'autoDesiredDiameter'
              ? 'Desired Diameter'
              : keypadTarget?.type === 'position' 
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
            keypadTarget?.type === 'deleteStep' ? '' :
            keypadTarget?.type === 'reteachStep' ? '' :
            keypadTarget?.type === 'repeatTargetStep' ? '' :
            keypadTarget?.type === 'repeatCount' ? '' :
            keypadTarget?.type === 'autoCurrentDiameter' ? (unitSystem === 'inch' ? 'in' : 'mm') :
            keypadTarget?.type === 'autoDesiredDiameter' ? (unitSystem === 'inch' ? 'in' : 'mm') :
            keypadTarget?.type === 'position' ? (unitSystem === 'inch' ? 'in' : 'mm') :
            keypadTarget?.type === 'speed' || keypadTarget?.type === 'globalSpeed' ? '%' :
            'ms'
          }
          initialValue={keypadValue}
          decimals={keypadTarget?.type === 'position' || keypadTarget?.type === 'autoCurrentDiameter' || keypadTarget?.type === 'autoDesiredDiameter' ? 3 : 0}
          allowNegative={false}
          allowAddSub={!(keypadTarget?.type === 'deleteStep' || keypadTarget?.type === 'reteachStep' || keypadTarget?.type === 'repeatTargetStep' || keypadTarget?.type === 'repeatCount')}
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
          title="⬇ Download Program to PLC"
          onConfirm={confirmDownload}
          onCancel={() => setDownloadDialog({ open: false })}
          confirmText="Download"
          cancelText="Cancel"
        >
          <div className="download-confirm-content">
            <div className="download-icon-large">📥</div>
            <p className="download-program-name">{program?.recipeName || program?.name}</p>
            <p className="download-side-info">{program?.side === 'right' ? 'Right Side' : 'Left Side'} • {editedSteps.length} Steps</p>
            <div className="download-warning">
              <span className="warning-icon">⚠</span>
              <span>This will overwrite the current program on the PLC</span>
            </div>
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={dialog.open}
          title={dialog.title || 'Notice'}
          message={dialog.message}
          onClose={() => setDialog({ open: false, title: '', message: '' })}
          zIndex={12000}
          variant="message-dialog"
        />

        <ModernDialog
          isOpen={stepDialog.open}
          title={stepDialog.mode === 'delete' ? 'Delete Step' : 'Add Step'}
          onCancel={() => setStepDialog({ open: false, mode: 'add', stepNumber: '', pattern: 0, repeatTargetStep: 1, repeatCount: 1 })}
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
              // Show success message and close dialog
              setDialog({ open: true, title: 'Step Deleted', message: `Step ${target} has been deleted successfully.` });
              setStepDialog({ open: false, mode: 'add', stepNumber: '', pattern: 0, repeatTargetStep: 1, repeatCount: 1 });
            } else {
              if (editedSteps.length >= 20) {
                setDialog({ open: true, title: 'Step Limit Reached', message: 'Cannot add more than 20 steps.' });
                setStepDialog({ open: false, mode: 'add', stepNumber: '', pattern: 0, repeatTargetStep: 1, repeatCount: 1 });
                return;
              }
              const insertAtRaw = isNaN(target) ? editedSteps.length + 1 : target;
              const insertAt = Math.min(Math.max(insertAtRaw, 1), editedSteps.length + 1);
              
              // Store pending step and show axis selection modal instead of directly adding
              const newStep = {
                stepNumber: insertAt,
                stepName: `Step ${insertAt}`,
                positions: program.side === 'left'
                  ? { axis3Cmd: 0, axis4Cmd: 0 }
                  : { axis1Cmd: 0, axis2Cmd: 0 },
                pattern: stepDialog.pattern ?? 0,
                dwell: [1, 3, 4].includes(Number(stepDialog.pattern)) ? 0 : programDwell,
                speed: programSpeed,
                enabled: true,
                timestamp: new Date().toISOString(),
                ...(stepDialog.pattern === 5 ? {
                  repeatTargetStep: stepDialog.repeatTargetStep || 1,
                  repeatCount: stepDialog.repeatCount || 1
                } : {})
              };
              
              const pattern = Number(stepDialog.pattern ?? 0);
              
              setPendingStep(newStep);
              setStepDialog({ open: false, mode: 'add', stepNumber: '', pattern: 0, repeatTargetStep: 1, repeatCount: 1 });
              
              // Pattern 5 (Repeat) or Return patterns - auto-copy Step 1 positions
              if (pattern === 5 || returnPatterns.has(pattern)) {
                // For return patterns, copy Step 1 positions based on side
                if (returnPatterns.has(pattern)) {
                  const step1 = editedSteps.find(s => s.stepNumber === 1);
                  if (step1) {
                    // Right side: axis1 (ID), axis2 (OD)
                    // Left side: axis3 (ID), axis4 (OD)
                    newStep.positions = program.side === 'left'
                      ? {
                          axis3Cmd: Number(step1.positions?.axis3Cmd) || 0,
                          axis4Cmd: Number(step1.positions?.axis4Cmd) || 0
                        }
                      : {
                          axis1Cmd: Number(step1.positions?.axis1Cmd) || 0,
                          axis2Cmd: Number(step1.positions?.axis2Cmd) || 0
                        };
                  }
                }
                const merged = [...editedSteps];
                merged.splice(newStep.stepNumber - 1, 0, newStep);
                const renumbered = merged.slice(0, 20).map((s, idx) => ({
                  ...s,
                  stepNumber: idx + 1,
                  stepName: s.stepName?.replace(/Step\s+\d+/, `Step ${idx + 1}`) || `Step ${idx + 1}`
                }));
                setEditedSteps(renumbered);
                setPendingStep(null);
                console.log(`[ProgramEditor] Auto-added ${pattern === 5 ? 'Repeat' : 'Return'} step at ${insertAt} with Step 1 positions`);
              } else {
                // Show axis modal for other patterns (similar to AutoTeach)
                setShowAxisModal(true);
              }
            }
          }}
          confirmText="Confirm"
        >
          <div className="step-dialog-modern">
            <div className="dialog-header-row">
              <div className="dialog-icon">{stepDialog.mode === 'delete' ? '🗑' : '+'}</div>
              <div className="dialog-heading">
                <div className="dialog-title-text">{stepDialog.mode === 'delete' ? 'Remove a step' : 'Insert a new step'}</div>
                <div className="dialog-subtitle">Maximum 20 steps allowed per program.</div>
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
                  onClick={() => {
                    setKeypadTarget({ type: 'deleteStep' });
                    setKeypadValue(stepDialog.stepNumber || '');
                    setKeypadOpen(true);
                  }}
                  readOnly
                  className="step-dialog-input modern"
                  style={{ cursor: 'pointer' }}
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
                {stepDialog.pattern === 5 && (
                  <div className="step-dialog-section two-col">
                    <div>
                      <label className="dialog-label">Repeat Step (Target)</label>
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, editedSteps.length)}
                        value={stepDialog.repeatTargetStep}
                        onChange={(e) => setStepDialog((prev) => ({ ...prev, repeatTargetStep: parseInt(e.target.value, 10) || 1 }))}
                        className="step-dialog-input modern"
                      />
                      <div className="dialog-hint">Which step to repeat</div>
                    </div>
                    <div>
                      <label className="dialog-label">Repeat Count</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={stepDialog.repeatCount}
                        onChange={(e) => setStepDialog((prev) => ({ ...prev, repeatCount: parseInt(e.target.value, 10) || 1 }))}
                        className="step-dialog-input modern"
                      />
                      <div className="dialog-hint">Number of repetitions</div>
                    </div>
                  </div>
                )}
                <div className="dialog-hint accent">After adding, jog mode will be active to teach the new step.</div>
              </>
            )}
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={reteachDialog.open}
          title="↺ Reteach Step"
          onCancel={() => setReteachDialog({ open: false, stepNumber: '' })}
          onConfirm={() => {
            const target = parseInt(reteachDialog.stepNumber, 10);
            if (isNaN(target) || target < 1 || target > editedSteps.length) {
              setDialog({ open: true, title: 'Invalid Step', message: 'Please enter a valid step number to reteach.' });
              return;
            }
            handleReteachStart(target);
            setReteachDialog({ open: false, stepNumber: '' });
          }}
          confirmText="Reteach"
          cancelText="Cancel"
        >
          <div className="step-dialog-modern reteach-dialog">
            <div className="dialog-header-row">
              <div className="dialog-icon">↺</div>
              <div className="dialog-heading">
                <div className="dialog-title-text">Reteach a step</div>
                <div className="dialog-subtitle">Select a step to reteach positions</div>
              </div>
              <div className="dialog-pill">{editedSteps.length}/20 steps</div>
            </div>

            <div className="step-dialog-section two-col">
              <div>
                <label className="dialog-label">Step to reteach</label>
                <input
                  type="number"
                  min="1"
                  max={editedSteps.length}
                  value={reteachDialog.stepNumber}
                  onChange={(e) => setReteachDialog((prev) => ({ ...prev, stepNumber: e.target.value }))}
                  onClick={() => {
                    setKeypadTarget({ type: 'reteachStep' });
                    setKeypadValue(reteachDialog.stepNumber || '');
                    setKeypadOpen(true);
                  }}
                  readOnly
                  className="step-dialog-input modern"
                  style={{ cursor: 'pointer' }}
                />
                <div className="dialog-hint">Range 1 - {editedSteps.length}</div>
              </div>
              <div>
                <label className="dialog-label">Pattern</label>
                <div className="dialog-value-chip">
                  {(() => {
                    const target = parseInt(reteachDialog.stepNumber, 10);
                    const step = editedSteps.find((s) => s.stepNumber === target);
                    const label = patternOptions.find((p) => p.code === step?.pattern)?.name;
                    return label || (step ? `Pattern ${step.pattern}` : 'Select a step');
                  })()}
                </div>
                <button
                  className="reteach-change-pattern-btn"
                  onClick={() => {
                    const target = parseInt(reteachDialog.stepNumber, 10);
                    if (isNaN(target)) {
                      setDialog({ open: true, title: 'Select Step', message: 'Choose a step before changing the pattern.' });
                      return;
                    }
                    const step = editedSteps.find((s) => s.stepNumber === target);
                    if (!step) return;
                    setReteachPatternDialog({ open: true, stepNumber: target, pattern: step.pattern ?? 0 });
                  }}
                >
                  Change Pattern
                </button>
              </div>
            </div>
            <div className="dialog-hint accent">Return patterns auto-copy Step 1 positions. Repeat steps cannot be re-taught.</div>
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={reteachPatternDialog.open}
          title={`Change Pattern${reteachPatternDialog.stepNumber ? ` (Step ${reteachPatternDialog.stepNumber})` : ''}`}
          onCancel={() => setReteachPatternDialog({ open: false, stepNumber: null, pattern: 0 })}
          onConfirm={() => {
            if (!reteachPatternDialog.stepNumber) {
              setReteachPatternDialog({ open: false, stepNumber: null, pattern: 0 });
              return;
            }
            handleReteachStart(reteachPatternDialog.stepNumber, reteachPatternDialog.pattern);
            setReteachPatternDialog({ open: false, stepNumber: null, pattern: 0 });
            setReteachDialog({ open: false, stepNumber: '' });
          }}
          confirmText="Reteach"
          cancelText="Cancel"
        >
          <div className="step-dialog-modern reteach-pattern-dialog">
            <div className="step-dialog-section">
              <label className="dialog-label">Select new pattern</label>
              <select
                className="step-dialog-select modern"
                value={reteachPatternDialog.pattern}
                onChange={(e) => setReteachPatternDialog((prev) => ({ ...prev, pattern: parseInt(e.target.value, 10) }))}
              >
                {patternOptions.map((opt) => {
                  const forbidden = getForbiddenPatterns(reteachPatternDialog.stepNumber);
                  const disableRepeat = opt.code === 5;
                  return (
                    <option key={opt.code} value={opt.code} disabled={forbidden.has(opt.code) || disableRepeat}>
                      {opt.code} - {opt.name}{disableRepeat ? ' (not allowed)' : ''}
                    </option>
                  );
                })}
              </select>
              <div className="dialog-hint">After confirming, the reteach dialog will open for positions.</div>
            </div>
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={repeatDialog.open}
          title="Repeat Settings"
          onCancel={() => setRepeatDialog({ open: false, stepNumber: null, repeatTargetStep: 1, repeatCount: 1 })}
          onConfirm={() => {
            if (!repeatDialog.stepNumber) {
              setRepeatDialog({ open: false, stepNumber: null, repeatTargetStep: 1, repeatCount: 1 });
              return;
            }
            const target = parseInt(repeatDialog.repeatTargetStep, 10);
            const count = parseInt(repeatDialog.repeatCount, 10);
            const safeTarget = (() => {
              if (isNaN(target)) return 1;
              const step = editedSteps.find(s => s.stepNumber === repeatDialog.stepNumber);
              const maxTarget = Math.max(1, (step?.stepNumber || 2) - 1);
              return Math.min(Math.max(1, target), maxTarget);
            })();
            const safeCount = isNaN(count) ? 1 : Math.min(Math.max(1, count), 999);

            const updatedSteps = editedSteps.map(step => {
              if (step.stepNumber === repeatDialog.stepNumber) {
                return {
                  ...step,
                  pattern: 5,
                  repeatTargetStep: safeTarget,
                  repeatCount: safeCount
                };
              }
              return step;
            });
            setEditedSteps(updatedSteps);
            setRepeatDialog({ open: false, stepNumber: null, repeatTargetStep: 1, repeatCount: 1 });
          }}
          confirmText="Save"
          cancelText="Cancel"
        >
          <div className="repeat-dialog-container">
            <div className="repeat-header">
              <div className="repeat-title">≋ Configure Repeat</div>
              <p className="repeat-description">Make this step repeat back to a previous step</p>
            </div>

            <div className="repeat-inputs">
              <div className="repeat-field">
                <label className="repeat-label">Repeat Back To Step</label>
                <div
                  className="repeat-input"
                  onClick={() => {
                    setKeypadTarget({ type: 'repeatTargetStep', stepNumber: repeatDialog.stepNumber });
                    setKeypadValue(repeatDialog.repeatTargetStep || '');
                    setKeypadOpen(true);
                  }}
                >
                  {repeatDialog.repeatTargetStep || '−'}
                </div>
                <div className="repeat-hint">Target must be between 2 and {Math.max(2, repeatDialog.stepNumber - 1)}</div>
              </div>

              <div className="repeat-field">
                <label className="repeat-label">Repeat Count</label>
                <div
                  className="repeat-input"
                  onClick={() => {
                    setKeypadTarget({ type: 'repeatCount', stepNumber: repeatDialog.stepNumber });
                    setKeypadValue(repeatDialog.repeatCount || '');
                    setKeypadOpen(true);
                  }}
                >
                  {repeatDialog.repeatCount || '−'}
                </div>
                <div className="repeat-hint">1 to 999 times to repeat</div>
              </div>
            </div>

            <div className="repeat-notes">
              <div className="repeat-note-title">ℹ️ How Repeat Works:</div>
              <ul className="repeat-note-list">
                <li><strong>Repeats selected steps</strong> - Goes back to target step and repeats</li>
                <li><strong>Pattern 5</strong> - Marks this step as the repeat end point</li>
                <li><strong>Count</strong> - Number of times to repeat (max 999)</li>
                <li><strong>Useful for</strong> - Multi-pass operations and complex patterns</li>
              </ul>
            </div>
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={autoEditDialog.open}
          title="Auto Edit"
          onCancel={() => setAutoEditDialog({ open: false, currentDiameter: '', desiredDiameter: '' })}
          onConfirm={() => {
            const cur = parseFloat(autoEditDialog.currentDiameter);
            const des = parseFloat(autoEditDialog.desiredDiameter);
            if (isNaN(cur) || isNaN(des)) {
              setDialog({ open: true, title: 'Invalid Input', message: 'Enter both current and desired diameters.' });
              return;
            }
            const curStorage = toStorageUnits(cur);
            const desStorage = toStorageUnits(des);
            const diameterDelta = desStorage - curStorage;
            const radiusDelta = diameterDelta / 2; // Convert diameter change to radius change
            const isRightSide = program.side === 'right';
            const extendPatterns = new Set([0, 2, 6]); // Red Ext, Exp Ext, RedExt+ExpExt
            const updated = editedSteps.map((s) => {
              if (s.stepNumber === 1) return s; // skip step 1
              if (s.pattern === 5) return s; // skip repeat steps
              if (!extendPatterns.has(Number(s.pattern))) return s; // skip retract/off patterns
              const axes = getPatternAxes(s.pattern);
              const next = { ...s, positions: { ...s.positions } };
              axes.forEach((ax) => {
                const field = isRightSide
                  ? (ax === 'axis1' ? 'axis1Cmd' : 'axis2Cmd')
                  : (ax === 'axis1' ? 'axis3Cmd' : 'axis4Cmd');
                const val = parseFloat(next.positions[field]);
                if (!isNaN(val)) {
                  next.positions[field] = parseFloat((val + radiusDelta).toFixed(3));
                }
              });
              return next;
            });
            setEditedSteps(updated);
            setAutoEditDialog({ open: false, currentDiameter: '', desiredDiameter: '' });
          }}
          confirmText="Apply"
          cancelText="Cancel"
        >
          <div className="auto-edit-dialog-container">
            <div className="auto-edit-header">
              <div className="auto-edit-title">⚡ Auto Edit by Diameter</div>
              <p className="auto-edit-description">Automatically adjust all extend positions based on diameter change</p>
            </div>

            <div className="auto-edit-inputs">
              <div className="auto-edit-field">
                <label className="auto-edit-label">Current Diameter</label>
                <div
                  className="auto-edit-input"
                  onClick={() => {
                    setKeypadTarget({ type: 'autoCurrentDiameter' });
                    setKeypadValue(autoEditDialog.currentDiameter || '');
                    setKeypadOpen(true);
                  }}
                >
                  {autoEditDialog.currentDiameter || '−'}
                </div>
                <div className="auto-edit-hint">What is the measured diameter now? ({unitSystem === 'inch' ? 'inches' : 'mm'})</div>
              </div>

              <div className="auto-edit-field">
                <label className="auto-edit-label">Desired Diameter</label>
                <div
                  className="auto-edit-input"
                  onClick={() => {
                    setKeypadTarget({ type: 'autoDesiredDiameter' });
                    setKeypadValue(autoEditDialog.desiredDiameter || '');
                    setKeypadOpen(true);
                  }}
                >
                  {autoEditDialog.desiredDiameter || '−'}
                </div>
                <div className="auto-edit-hint">What diameter do you want? ({unitSystem === 'inch' ? 'inches' : 'mm'})</div>
              </div>
            </div>

            <div className="auto-edit-notes">
              <div className="auto-edit-note-title">ℹ️ How It Works:</div>
              <ul className="auto-edit-note-list">
                <li><strong>Calculates the difference</strong> between current and desired diameter</li>
                <li><strong>Adjusts all extend steps</strong> (Step 2+) by this amount</li>
                <li><strong>Skips Step 1</strong> (always safe reference position)</li>
                <li><strong>Ignores retract patterns</strong> (keeps centering unchanged)</li>
                <li><strong>Skips repeat steps</strong> automatically</li>
              </ul>
            </div>
          </div>
        </ModernDialog>

        {/* Dwell Editor Dialog */}
        <ModernDialog
          open={dwellDialog.open}
          title="⏱ Edit Step Dwell Times"
          onClose={() => setDwellDialog({ open: false })}
          confirmText="Close"
          onConfirm={() => setDwellDialog({ open: false })}
        >
          <div className="dwell-editor-container">
            <div className="dwell-editor-hint">Click on any step to edit its dwell time</div>
            <div className="dwell-steps-grid">
              {editedSteps.map((step) => (
                <div 
                  key={step.stepNumber} 
                  className="dwell-step-card"
                  onClick={() => handleEditDwell(step.stepNumber)}
                >
                  <div className="dwell-step-header">
                    <span className="dwell-step-num">Step {step.stepNumber}</span>
                    <span className="dwell-step-name">{step.stepName}</span>
                  </div>
                  <div className="dwell-step-value">
                    {step.dwell || 0} ms
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ModernDialog>

        {/* Pattern Editor Dialog */}
        <ModernDialog
          open={patternDialog.open}
          title="≋ Edit Step Patterns"
          onClose={() => setPatternDialog({ open: false, selectedStep: null })}
          confirmText="Close"
          onConfirm={() => setPatternDialog({ open: false, selectedStep: null })}
        >
          <div className="pattern-editor-container">
            <div className="pattern-editor-hint">Click on a step to select it, then choose a pattern below</div>
            <div className="pattern-steps-grid">
              {editedSteps.map((step) => {
                const patternInfo = patternOptions.find(p => p.code === step.pattern);
                return (
                  <div 
                    key={step.stepNumber} 
                    className={`pattern-step-card ${patternDialog.selectedStep === step.stepNumber ? 'selected' : ''}`}
                    onClick={() => setPatternDialog({ open: true, selectedStep: step.stepNumber })}
                  >
                    <div className="pattern-step-header">
                      <span className="pattern-step-num">Step {step.stepNumber}</span>
                      <span className="pattern-step-name">{step.stepName}</span>
                    </div>
                    <div className="pattern-step-current">
                      {patternInfo ? patternInfo.name : `Pattern ${step.pattern}`}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {patternDialog.selectedStep !== null && (
              <div className="pattern-selector-section">
                <div className="pattern-selector-label">
                  Select pattern for Step {patternDialog.selectedStep}:
                </div>
                <select
                  value={editedSteps.find(s => s.stepNumber === patternDialog.selectedStep)?.pattern || 0}
                  onChange={(e) => handleEditPattern(patternDialog.selectedStep, parseInt(e.target.value))}
                  className="pattern-select-dialog"
                >
                  {patternOptions.map(opt => {
                    const forbidden = getForbiddenPatterns(patternDialog.selectedStep);
                    return (
                      <option key={opt.code} value={opt.code} disabled={forbidden.has(opt.code)}>
                        {opt.code} - {opt.name}
                      </option>
                    );
                  })}
                </select>
                <button
                  className="teach-btn"
                  onClick={() => {
                    const selectedStepObj = editedSteps.find(s => s.stepNumber === patternDialog.selectedStep);
                    setTeachDialog({
                      open: true,
                      stepNumber: patternDialog.selectedStep,
                      jogMode: false
                    });
                    setCurrentTeachPositions({
                      axis1Cmd: selectedStepObj?.positions?.axis1Cmd || 0,
                      axis2Cmd: selectedStepObj?.positions?.axis2Cmd || 0
                    });
                  }}
                >
                  🎯 Teach
                </button>
              </div>
            )}
          </div>
        </ModernDialog>

        <ModernDialog
          isOpen={teachDialog.open}
          title={`📍 Teach Step ${teachDialog.stepNumber}`}
          onCancel={() => setTeachDialog({ open: false, stepNumber: null, jogMode: false })}
          onConfirm={() => {
            if (teachDialog.stepNumber) {
              const updatedSteps = editedSteps.map(step => {
                if (step.stepNumber === teachDialog.stepNumber) {
                  return {
                    ...step,
                    positions: {
                      axis1Cmd: currentTeachPositions.axis1Cmd,
                      axis2Cmd: currentTeachPositions.axis2Cmd,
                      axis3Cmd: step.positions?.axis3Cmd || 0,
                      axis4Cmd: step.positions?.axis4Cmd || 0
                    }
                  };
                }
                return step;
              });
              setEditedSteps(updatedSteps);
            }
            setTeachDialog({ open: false, stepNumber: null, jogMode: false });
          }}
          confirmText="Confirm Teach"
          cancelText="Cancel"
        >
          <div className="teach-dialog-container">
            <div className="teach-header">
              <div className="teach-info">
                <div className="teach-step-label">Step {teachDialog.stepNumber}</div>
                {(() => {
                  const step = editedSteps.find(s => s.stepNumber === teachDialog.stepNumber);
                  const pattern = step?.pattern || 0;
                  const patternInfo = patternOptions.find(opt => opt.code === pattern);
                  return (
                    <div className="teach-pattern-label">
                      Pattern: {patternInfo?.name || `Pattern ${pattern}`}
                    </div>
                  );
                })()}
              </div>
              <button
                className={`teach-jog-toggle ${teachDialog.jogMode ? 'active' : ''}`}
                onClick={() => setTeachDialog(prev => ({ ...prev, jogMode: !prev.jogMode }))}
              >
                🕹️ JOG {teachDialog.jogMode ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="teach-instruction">
              {teachDialog.jogMode ? (
                <div className="jog-active">
                  <div className="instruction-text">🎯 Move axes to desired position and confirm</div>
                  <div className="keyboard-hint">Use arrow keys or keyboard to jog</div>
                </div>
              ) : (
                <div className="instruction-text">🕹️ Click the JOG button above to enable jog mode</div>
              )}
            </div>

            <div className="teach-positions">
              <div className="positions-header">Current Positions:</div>
              <div className="positions-grid">
                <div className="position-item">
                  <label className="position-label">ID</label>
                  <div className="position-value">{currentTeachPositions.axis1Cmd.toFixed(2)}</div>
                  <input
                    type="number"
                    step="0.01"
                    value={currentTeachPositions.axis1Cmd}
                    onChange={(e) => setCurrentTeachPositions(prev => ({ ...prev, axis1Cmd: parseFloat(e.target.value) || 0 }))}
                    className="position-input"
                  />
                </div>
                <div className="position-item">
                  <label className="position-label">OD</label>
                  <div className="position-value">{currentTeachPositions.axis2Cmd.toFixed(2)}</div>
                  <input
                    type="number"
                    step="0.01"
                    value={currentTeachPositions.axis2Cmd}
                    onChange={(e) => setCurrentTeachPositions(prev => ({ ...prev, axis2Cmd: parseFloat(e.target.value) || 0 }))}
                    className="position-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </ModernDialog>

        <AxisSelectionModal
          isOpen={showAxisModal}
          onClose={() => {
            setShowAxisModal(false);
            setPendingStep(null);
            setReteachTarget(null);
            setLastAxisFeedback([]);
          }}
          onSelectAxis={async (axis) => {
            if (reteachTarget) {
              try {
                const posData = await readAxisPositions();
                const sidePositions = program.side === 'right' ? posData.actualPositions.right : posData.actualPositions.left;
                const positions = program.side === 'left'
                  ? {
                      axis3Cmd: Number(sidePositions?.axis1) || 0,
                      axis4Cmd: Number(sidePositions?.axis2) || 0
                    }
                  : {
                      axis1Cmd: Number(sidePositions?.axis1) || 0,
                      axis2Cmd: Number(sidePositions?.axis2) || 0
                    };

                const updated = editedSteps.map((step) => {
                  if (step.stepNumber !== reteachTarget.stepNumber) return step;
                  return {
                    ...step,
                    pattern: reteachTarget.pattern,
                    positions: { ...step.positions, ...positions }
                  };
                });
                setEditedSteps(updated);
                setReteachTarget(null);
                setShowAxisModal(false);
                setLastAxisFeedback([]);
              } catch (err) {
                console.error('[ProgramEditor] Error reading positions for reteach:', err.message);
                setDialog({
                  open: true,
                  title: 'Position Read Failed',
                  message: `Failed to read current axis positions: ${err.message}`
                });
              }
              return;
            }

            if (pendingStep) {
              try {
                // Read current PLC positions and populate the step
                const posData = await readAxisPositions();
                const sidePositions = program.side === 'right' ? posData.actualPositions.right : posData.actualPositions.left;
                
                const updatedStep = {
                  ...pendingStep,
                  positions: program.side === 'left'
                    ? {
                        axis3Cmd: Number(sidePositions?.axis1) || 0,
                        axis4Cmd: Number(sidePositions?.axis2) || 0
                      }
                    : {
                        axis1Cmd: Number(sidePositions?.axis1) || 0,
                        axis2Cmd: Number(sidePositions?.axis2) || 0
                      }
                };
                
                const merged = [...editedSteps];
                merged.splice(updatedStep.stepNumber - 1, 0, updatedStep);
                const renumbered = merged.slice(0, 20).map((s, idx) => ({
                  ...s,
                  stepNumber: idx + 1,
                  stepName: s.stepName?.replace(/Step\s+\d+/, `Step ${idx + 1}`) || `Step ${idx + 1}`
                }));
                setEditedSteps(renumbered);
                setJogHint(true);
                setPendingStep(null);
                setShowAxisModal(false);
                setLastAxisFeedback([]);
              } catch (err) {
                console.error('[ProgramEditor] Error reading positions for new step:', err.message);
                setDialog({
                  open: true,
                  title: 'Position Read Failed',
                  message: `Failed to read current axis positions: ${err.message}`
                });
              }
            }
          }}
          onAxisClick={handleEnableAxis}
          side={program.side}
          patternCode={reteachTarget?.axesPattern ?? pendingStep?.pattern ?? 0}
          stepNumber={reteachTarget?.stepNumber ?? pendingStep?.stepNumber ?? 0}
          lastFeedback={lastAxisFeedback}
          jogSpeed={jogSpeed}
        />

        {/* Jog Speed Modal */}
        <ModernDialog
          isOpen={showSpeedModal}
          title="Adjust Jog Speed"
          onConfirm={() => setShowSpeedModal(false)}
          confirmText="Close"
        >
          <div className="jog-speed-modal-content">
            <div className="speed-value-display">{jogSpeed}%</div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={jogSpeed}
              onChange={(e) => onJogSpeedChange(Number(e.target.value))}
              className="speed-modal-slider"
              title="Adjust jog speed (10% = slow, 100% = fast)"
            />
            <div className="speed-modal-legend">
              <span className="legend-slow">10% Slow</span>
              <span className="legend-fast">100% Fast</span>
            </div>
          </div>
        </ModernDialog>
      </div>
    </div>
  );
}
