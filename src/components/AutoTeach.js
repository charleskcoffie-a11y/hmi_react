import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModernDialog from './ModernDialog';
import NumericKeypad from './NumericKeypad';
import PatternSelectionModal from './PatternSelectionModal';
import AxisSelectionModal from './AxisSelectionModal';
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
  const safeActualPositions = actualPositions ?? { axis1: 0, axis2: 0 };

  const patternOptions = useMemo(
    () => [
      { code: 2, name: 'ID Ext' },
      { code: 3, name: 'ID Ret' },
      { code: 0, name: 'OD Ext' },
      { code: 1, name: 'OD Ret' },
      { code: 4, name: 'OD Ret + ID Ret' },
      { code: 5, name: 'Repeat' },
      { code: 6, name: 'OD Ext + ID Ext' },
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
  const [enabledAxis, setEnabledAxis] = useState(null); // 'id' or 'od' - tracks which axis is enabled

  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [editStepName, setEditStepName] = useState('');
  const [editStepPattern, setEditStepPattern] = useState(0);

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // New modal states for refactored workflow
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [showAxisModal, setShowAxisModal] = useState(false);
  const [pendingPattern, setPendingPattern] = useState(null);

  const [repeatConfigOpen, setRepeatConfigOpen] = useState(false);
  const [repeatTargetStep, setRepeatTargetStep] = useState(null);
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatKeypadOpen, setRepeatKeypadOpen] = useState(false);
  const [plcStatus, setPlcStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [jogModeEnabled, setJogModeEnabled] = useState(false);
  const [axesEnabled, setAxesEnabled] = useState(false); // ID/OD axes must be manually enabled
  const [enablingAxes, setEnablingAxes] = useState(false);
  const [lastAxisFeedback, setLastAxisFeedback] = useState([]); // Track last feedback read values for ID/OD
  const [jogSpeed, setJogSpeed] = useState(100); // Jog speed percentage (10-100), default 100%
  const activeCardRef = useRef(null);

  const activeStepNumber = Math.min(recordedSteps.length + 1, 20);
  const [currentPage, setCurrentPage] = useState(1); // Page 1 = steps 1-10, Page 2 = steps 11-20

  // Calculate display steps for pagination (must be before all useMemo calls)
  const displaySteps = useMemo(() => {
    // Page 1: steps 1-10, Page 2: steps 11-20
    const start = (currentPage - 1) * 10 + 1;
    const end = Math.min(currentPage * 10, 20);
    return recordedSteps.filter(s => s.step >= start && s.step <= end);
  }, [recordedSteps, currentPage]);

  const eligibleRepeatTargets = useMemo(() => {
    // Allow repeating any previously-recorded step (2-19)
    // Can repeat any step that was successfully recorded before the current step
    const recorded = recordedSteps
      .map((s) => s.step)
      .filter((n) => typeof n === 'number');
    
    // Filter to only include steps 2-19 (not step 1, not step 20)
    // These are the only valid targets for a repeat pattern
    const validTargets = recorded.filter((n) => n >= 2 && n <= 19);
    
    // Get unique, sorted list
    const result = Array.from(new Set(validTargets)).sort((a, b) => a - b);
    console.log('[AutoTeach] eligibleRepeatTargets:', result, 'recordedSteps count:', recordedSteps.length, 'activeStepNumber:', activeStepNumber);
    return result;
  }, [recordedSteps, activeStepNumber]);

  const repeatAllowedForActiveStep =
    activeStepNumber >= 3 &&
    activeStepNumber <= 20 &&
    eligibleRepeatTargets.length > 0;

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
      setEnabledAxis(null); // Reset axis selection on open
      setAxesEnabled(false);
      setLastAxisFeedback([]);
    }
    previousIsOpenRef.current = isOpen;
  }, [isOpen]); // Only depend on isOpen, not programName or side

  // Poll jog mode status and axis feedback
  useEffect(() => {
    if (!isOpen) return;

    const pollJogMode = async () => {
      try {
        const jogModeVar = side === 'right' ? 'GRIGHTHEAD.bHmiRightJogMode' : 'GLEFTHEAD.bHmiLeftJogMode';
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

    const interval = setInterval(pollJogMode, 500);
    
    pollJogMode(); // Initial read
    
    return () => clearInterval(interval);
  }, [isOpen, side]);
  useEffect(() => {
    const enableJogMode = async () => {
      try {
        const jogModeVar = side === 'right' ? 'GRIGHTHEAD.bHmiRightJogMode' : 'GLEFTHEAD.bHmiLeftJogMode';
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
        const jogModeVar = side === 'right' ? 'GRIGHTHEAD.bHmiRightJogMode' : 'GLEFTHEAD.bHmiLeftJogMode';
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

  // Handle enabling ID/OD axes - MUST be called manually by user
  const handleEnableAxes = async (axis = 'both') => {
    console.log('[AutoTeach] handleEnableAxes called for STEP 1 - axis:', axis, 'side:', side);
    setEnablingAxes(true);
    try {
      const idTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpPb' : 'GRIGHTHEAD.bHmiRightExpPb';
      const odTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedPb' : 'GRIGHTHEAD.bHmiRightRedPb';
      const idReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpEna' : 'GRIGHTHEAD.bHmiRightExpEna';
      const odReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedEna' : 'GRIGHTHEAD.bHmiRightRedEna';

      const tagsToPulse = [];
      if (axis === 'id' || axis === 'both') tagsToPulse.push(idTag);
      if (axis === 'od' || axis === 'both') tagsToPulse.push(odTag);

      console.log('[AutoTeach] STEP 1 - Pulsing tags:', tagsToPulse);

      for (const tag of tagsToPulse) {
        console.log('[AutoTeach] STEP 1 PULSE REQUEST: tag=', tag, 'durationMs=200');
        
        const response = await fetch('http://localhost:3001/pulse-bool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag, durationMs: 200 })
        });
        
        console.log('[AutoTeach] STEP 1 PULSE HTTP RESPONSE: status=', response.status, 'statusText=', response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[AutoTeach] STEP 1 PULSE HTTP ERROR:', errorText);
          throw new Error(`HTTP error: ${response.status} ${response.statusText} for tag ${tag}`);
        }
        
        const result = await response.json();
        console.log('[AutoTeach] STEP 1 PULSE RESULT JSON:', result);
        
        if (!result.success) {
          console.error('[AutoTeach] STEP 1 PULSE FAILED - PLC returned success=false:', result);
          throw new Error(result.error || result.message || `PLC pulse failed for ${tag}`);
        }
        
        console.log('[AutoTeach] STEP 1 PULSE SUCCESS for tag:', tag);
      }

      // After pulsing, wait for PLC feedback that axis is enabled/ready
      const readyTags = [];
      if (axis === 'id' || axis === 'both') readyTags.push(idReadyTag);
      if (axis === 'od' || axis === 'both') readyTags.push(odReadyTag);

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
            console.log('[AutoTeach] STEP 1 Feedback poll:', reads, 'allTrue:', allTrue);
            if (allTrue) return true;
          } catch (e) {
            console.warn('[AutoTeach] STEP 1 Feedback poll error:', e?.message);
          }
          await new Promise((res) => setTimeout(res, intervalMs));
        }
        return false;
      };

      const feedbackOk = await waitForFeedback(readyTags);
      if (!feedbackOk) {
        throw new Error(`Axis not ready. Feedback: ${readyTags.join(', ')}`);
      }

      setAxesEnabled(true);
      setEnabledAxis(axis === 'both' ? null : axis);
      console.log('[AutoTeach] STEP 1 - Axes enabled and READY for', side, 'axis:', axis);
    } catch (error) {
      console.error('[AutoTeach] STEP 1 - Error enabling axes:', error);
      setAxesEnabled(false);
      setDialog({
        open: true,
        title: 'Axis Enable Failed',
        message: `Failed to enable ${axis.toUpperCase()} axis: ${error.message}. Check PLC connection and try again.`,
        confirm: closeDialog,
        cancel: null,
      });
    } finally {
      setEnablingAxes(false);
    }
  };

  const patternAxisMeta = useMemo(
    () => ({
      0: { axes: 'od' }, // Red Ext -> OD
      1: { axes: 'od' }, // Red Ret -> OD
      2: { axes: 'id' }, // Exp Ext -> ID
      3: { axes: 'id' }, // Exp Ret -> ID
      4: { axes: 'both' }, // RedRet + ExpRet -> both
      5: { axes: 'repeat' }, // Repeat (show note only)
      6: { axes: 'both' }, // RedExt + ExpExt -> both
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

  // Write jog speed to PLC when it changes
  useEffect(() => {
    const writeJogSpeed = async () => {
      try {
        const speedTag = side === 'left' ? 'GLEFTHEAD.lHmileftJogSpd' : 'GRIGHTHEAD.lHmiRightJogSpd';
        await fetch('http://localhost:3001/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: speedTag, value: jogSpeed })
        });
        console.log(`[AutoTeach] Wrote jog speed ${jogSpeed}% to ${speedTag}`);
      } catch (err) {
        console.warn('[AutoTeach] Failed to write jog speed to PLC:', err.message);
      }
    };
    if (isOpen) writeJogSpeed();
  }, [jogSpeed, side, isOpen]);

  // Keep view aligned to active teaching step card
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeStepNumber]);

  if (!isOpen) return null;

  const axis1Label = 'ID';
  const axis2Label = 'OD';

  const closeDialog = () => setDialog({ open: false, title: '', message: '', confirm: null, cancel: null });

  const renderFeedbackStatus = () => {
    if (!lastAxisFeedback?.length) return null;
    return (
      <div className="axis-feedback-status">
        {lastAxisFeedback.map((f) => (
          <span key={f.tag} className={f.value ? 'ok' : 'bad'}>
            {f.tag.split('.').slice(-1)[0]}: {f.value ? 'ON' : 'OFF'}
          </span>
        ))}
      </div>
    );
  };

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

  const handleRecordPosition = async () => {
    if (isRecording) return;
    if (recordedSteps.length >= 20) {
      setDialog({
        open: true,
        title: 'Max Steps Reached',
        message: 'You can record up to 20 steps.',
        confirm: closeDialog,
        cancel: null,
      });
      return;
    }

    setIsRecording(true);

    // Disable jog head so the next step starts fresh
    try {
      const disableTag = side === 'left'
        ? 'GLEFTHEAD.bLeftJogHeadEnabledOff'
        : 'GRIGHTHEAD.bRightJogHeadEnabledOff';
      const response = await fetch('http://localhost:3001/pulse-bool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: disableTag, durationMs: 150 })
      });
      if (!response.ok) throw new Error(`Failed to pulse ${disableTag}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || `PLC pulse failed for ${disableTag}`);
      setAxesEnabled(false);
      setEnabledAxis(null);
      console.log('[AutoTeach] Jog head disable pulse sent:', disableTag);
    } catch (err) {
      console.error('[AutoTeach] Failed to disable jog head before record:', err);
    }

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

      if (!repeatTargetStep || repeatTargetStep === 1 || repeatTargetStep === 20) {
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

    // Just record directly
    recordStepWithAxis(stepNumberToRecord, patternToRecord);
  };

  const recordStepWithAxis = (stepNumberToRecord, patternToRecord) => {
    const getPageDisplay = (step) => step <= 10 ? '' : ` (Page 2)`;
    const defaultStepName = stepNumberToRecord === 1 ? 'Start Position' : `Step ${stepNumberToRecord}${getPageDisplay(stepNumberToRecord)}`;
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
      enabledAxis: enabledAxis, // Track which axis was enabled
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
    setIsRecording(false);
  };

  // Handle "Add Step" button click - open pattern selection modal
  const handleAddStep = () => {
    setShowPatternModal(true);
  };

  // Handle pattern selection from PatternSelectionModal
  const handlePatternSelected = async (patternCode) => {
    setPendingPattern(patternCode);
    setPattern(patternCode);

    const meta = patternAxisMeta[patternCode] || { axes: 'both' };

    // Check if this is pattern 5 (Repeat)
    if (patternCode === 5) {
      // Show repeat configuration dialog
      setShowPatternModal(false);
      setRepeatConfigOpen(true);
      return;
    }

    // Check if this is a return pattern (1=Red Ret, 3=Exp Ret, 4=RedRet+ExpRet)
    const returnPatterns = [1, 3, 4];
    if (returnPatterns.includes(patternCode) && recordedSteps.length > 0) {
      // Always return to Step 1 (start position)
      const step1 = recordedSteps.find((s) => s.step === 1) || recordedSteps[0];
      if (!step1) {
        setDialog({
          open: true,
          title: 'Start Position Missing',
          message: 'Cannot create a return step because Step 1 (start position) is missing.',
          confirm: closeDialog,
          cancel: null,
        });
        setShowPatternModal(false);
        setPendingPattern(null);
        setPattern(0);
        return;
      }

      const stepNumberToRecord = Math.min(recordedSteps.length + 1, 20);
      const getPageDisplay = (step) => step <= 10 ? '' : ` (Page 2)`;
      const defaultStepName = stepNumberToRecord === 1 ? 'Start Position' : `Step ${stepNumberToRecord}${getPageDisplay(stepNumberToRecord)}`;

      const newStep = {
        step: stepNumberToRecord,
        stepName: defaultStepName,
        pattern: patternCode,
        needsReteach: false,
        positions: {
          axis1Cmd: step1.positions.axis1Cmd,
          axis2Cmd: step1.positions.axis2Cmd,
        },
        dwell: 0,
        enabledAxis: null, // Auto-copy doesn't need axis selection
      };

      setRecordedSteps((prev) => {
        const next = [...prev, newStep];
        pushProgramToPLC(next);
        return next;
      });

      setShowPatternModal(false);
      setPendingPattern(null);
      setPattern(0);
      return;
    } else {
      // Non-return pattern or first step
      if (meta.axes === 'none') {
        const stepNumberToRecord = Math.min(recordedSteps.length + 1, 20);
        const getPageDisplay = (step) => step <= 10 ? '' : ` (Page 2)`;
        const defaultStepName = stepNumberToRecord === 1 ? 'Start Position' : `Step ${stepNumberToRecord}${getPageDisplay(stepNumberToRecord)}`;
        const newStep = {
          step: stepNumberToRecord,
          stepName: defaultStepName,
          pattern: patternCode,
          needsReteach: false,
          positions: {
            axis1Cmd: Number(safeActualPositions.axis1) || 0,
            axis2Cmd: Number(safeActualPositions.axis2) || 0,
          },
          dwell: 0,
          enabledAxis: null,
        };

        setRecordedSteps((prev) => {
          const next = [...prev, newStep];
          pushProgramToPLC(next);
          return next;
        });

        setShowPatternModal(false);
        setPendingPattern(null);
        setPattern(0);
        return;
      }

      // Otherwise show axis selection modal (single or dual axis will be filtered there)
      setShowPatternModal(false);
      setShowAxisModal(true);
    }
  };

  // Enable axis for STEP 2+ (called when user clicks ID/OD button in modal)
  const handleEnableAxisStep2Plus = async (axis, speed = 100) => {
    // console.log('[AutoTeach] handleEnableAxisStep2Plus called - axis:', axis, 'speed:', speed, 'side:', side);
    
    try {
      setEnablingAxes(true);
      const idTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpPb' : 'GRIGHTHEAD.bHmiRightExpPb';
      const odTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedPb' : 'GRIGHTHEAD.bHmiRightRedPb';
      const idReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftExpEna' : 'GRIGHTHEAD.bHmiRightExpEna';
      const odReadyTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftRedEna' : 'GRIGHTHEAD.bHmiRightRedEna';

      const tagsToPulse = axis === 'id' ? [idTag] : axis === 'od' ? [odTag] : [idTag, odTag];
      
      // Calculate pulse duration from speed percentage
      const pulseDuration = 50 + (150 * speed / 100);
      
      // console.log('[AutoTeach] Pulsing tags for axis:', axis, 'tags:', tagsToPulse, 'duration:', pulseDuration);
      
      // Pulse each tag and wait for success
      for (const tag of tagsToPulse) {
        // console.log('[AutoTeach] PULSE REQUEST: tag=', tag, 'durationMs=', pulseDuration);
        
        const response = await fetch('http://localhost:3001/pulse-bool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag, durationMs: pulseDuration })
        });
        
        // console.log('[AutoTeach] PULSE HTTP RESPONSE: status=', response.status, 'statusText=', response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[AutoTeach] PULSE HTTP ERROR:', errorText);
          throw new Error(`HTTP error: ${response.status} ${response.statusText} for tag ${tag}`);
        }
        
        const result = await response.json();
        // console.log('[AutoTeach] PULSE RESULT JSON:', result);
        
        if (!result.success) {
          console.error('[AutoTeach] PULSE FAILED - PLC returned success=false:', result);
          throw new Error(result.error || result.message || `PLC pulse failed for ${tag}`);
        }
        
        // console.log('[AutoTeach] PULSE SUCCESS for tag:', tag);
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
            // console.log('[AutoTeach] STEP 2+ Enable Feedback poll:', reads, 'allTrue:', allTrue);
            if (allTrue) return true;
          } catch (e) {
            // console.warn('[AutoTeach] STEP 2+ Enable Feedback poll error:', e?.message);
          }
          await new Promise((res) => setTimeout(res, intervalMs));
        }
        return false;
      };

      const feedbackOk = await waitForFeedback(readyTags);
      if (!feedbackOk) {
        throw new Error(`Axis not ready. Feedback: ${readyTags.join(', ')}`);
      }
      
      // console.log('[AutoTeach] Successfully enabled axis for STEP 2+:', axis);
      setEnablingAxes(false);
      
    } catch (err) {
      console.error('[AutoTeach] Error enabling axis for STEP 2+:', err?.message);
      setEnablingAxes(false);
      setDialog({
        open: true,
        title: 'Axis Enable Failed',
        message: `Failed to enable ${axis.toUpperCase()} axis: ${err?.message}. Check PLC connection and try again.`,
        confirm: closeDialog,
        cancel: null,
      });
      throw err; // Re-throw so modal button can catch it
    }
  };

  // Handle axis record button click from AxisSelectionModal
  const handleAxisSelected = async (axis) => {
    console.log('[AutoTeach] handleAxisSelected called for STEP 2+ - axis:', axis, 'side:', side, 'activeStepNumber:', activeStepNumber);
    
    // Small delay to ensure PLC has processed the enable pulse
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Now create and record the step
    const stepNumberToRecord = Math.min(recordedSteps.length + 1, 20);
    const getPageDisplay = (step) => step <= 10 ? '' : ` (Page 2)`;
    const defaultStepName = stepNumberToRecord === 1 ? 'Start Position' : `Step ${stepNumberToRecord}${getPageDisplay(stepNumberToRecord)}`;

    const newStep = {
      step: stepNumberToRecord,
      stepName: defaultStepName,
      pattern: pendingPattern ?? pattern,
      needsReteach: false,
      positions: {
        axis1Cmd: Number(safeActualPositions.axis1) || 0,
        axis2Cmd: Number(safeActualPositions.axis2) || 0,
      },
      dwell: 0,
      enabledAxis: axis,
    };

    setRecordedSteps((prev) => {
      const next = [...prev, newStep];
      pushProgramToPLC(next);
      return next;
    });

    setShowAxisModal(false);
    setPendingPattern(null);
    setPattern(0);
    setEnabledAxis(null);
    setLastAxisFeedback([]);

    // Pulse JogHeadEnabledOff for a fresh start on next step
    try {
      const offTag = side === 'left' ? 'GLEFTHEAD.bLeftJogHeadEnabledOff' : 'GRIGHTHEAD.bRightJogHeadEnabledOff';
      console.log('[AutoTeach] Pulsing JogHeadEnabledOff tag:', offTag);
      const resp = await fetch('http://localhost:3001/pulse-bool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: offTag, durationMs: 200 })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.warn('[AutoTeach] JogHeadEnabledOff pulse HTTP error:', resp.status, resp.statusText, txt);
      } else {
        const json = await resp.json();
        if (!json.success) {
          console.warn('[AutoTeach] JogHeadEnabledOff pulse PLC returned success=false:', json);
        } else {
          console.log('[AutoTeach] JogHeadEnabledOff pulse success');
        }
      }
    } catch (e) {
      console.warn('[AutoTeach] Failed to pulse JogHeadEnabledOff:', e?.message);
    }
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
        original.step === 2 ? [1, 3, 4, 5, 8] : original.step === 20 ? [0, 2, 6] : []
      );
      if (forbidden.has(editStepPattern)) {
        setDialog({
          open: true,
          title: 'Pattern Not Allowed',
          message:
            original.step === 2
              ? 'Selected pattern is not allowed for Step 2.'
              : 'Selected pattern is not allowed for Step 20.',
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
                <div className="progress-bar-fill" style={{ width: `${(recordedSteps.length / 20) * 100}%` }}></div>
              </div>
              <div className="progress-text">{recordedSteps.length}/20</div>
            </div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="auto-teach-content">
            {/* Current Step Controls */}
            <div className="current-step-controls">
              <div className="step-indicator">
                <span className="step-badge">Step {activeStepNumber}/20</span>
                <span className="position-compact">
                  {axis1Label}: {Number(safeActualPositions.axis1).toFixed(3)} | {axis2Label}: {Number(safeActualPositions.axis2).toFixed(3)}
                </span>
              </div>
              <div className="teach-controls-row">
                <input
                  type="text"
                  value={stepName}
                  onChange={(e) => setStepName(e.target.value)}
                  placeholder={activeStepNumber === 1 ? 'Start Position' : `Step ${activeStepNumber}${currentPage === 2 ? ' (Page 2)' : ''}`}
                  className="step-name-input-compact"
                />
                {activeStepNumber === 1 ? (
                  <>
                    <div className="step1-axis-toggle">
                      <button
                        className={`enable-axes-btn ${enabledAxis === 'id' ? 'selected' : ''}`}
                        onClick={() => handleEnableAxes('id')}
                        disabled={enablingAxes}
                        title="Enable ID axis (Exp Ext)"
                      >
                        {enablingAxes && enabledAxis === 'id' ? 'Enabling...' : 'ID (Exp Ext)'}
                      </button>
                      <button
                        className={`enable-axes-btn ${enabledAxis === 'od' ? 'selected' : ''}`}
                        onClick={() => handleEnableAxes('od')}
                        disabled={enablingAxes}
                        title="Enable OD axis (Red Ext)"
                      >
                        {enablingAxes && enabledAxis === 'od' ? 'Enabling...' : 'OD (Red Ext)'}
                      </button>
                    </div>
                    <button
                      className={`record-btn-compact ${isRecording ? 'recording' : ''}`}
                      onClick={handleRecordPosition}
                      disabled={!axesEnabled || isRecording || recordedSteps.length >= 20}
                      title={!axesEnabled ? 'Enable ID or OD first' : 'Record start position'}
                    >
                      {recordedSteps.length >= 20 ? 'Complete' : isRecording ? '⏺' : '⏺ Record'}
                    </button>
                  </>
                ) : (
                  // Steps 2+ show "Add Step" button
                  <button
                    className="add-step-btn"
                    onClick={handleAddStep}
                    disabled={recordedSteps.length >= 20}
                  >
                    ➕ Add Step
                  </button>
                )}
              </div>

              {renderFeedbackStatus()}

              {/* Jog Mode Controls - Quick Teach + Disable */}
              <div className="jog-controls-row">
                <button
                  className="jog-teach-quick-btn"
                  onClick={() => {
                    // Quick teach: save current position without keypad
                    recordStepWithAxis(
                      Math.min(recordedSteps.length + 1, 20),
                      recordedSteps.length === 0 ? 6 : pattern
                    );
                  }}
                  disabled={isRecording || recordedSteps.length >= 20}
                  title="Save current jog position immediately (quick teach)"
                >
                  📍 Quick Teach
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
              </div>

              {/* Jog Speed Slider */}
              <div className="jog-speed-slider-container">
                <label htmlFor="autoteach-speed-slider" className="jog-speed-label">
                  Jog Speed: {jogSpeed}%
                </label>
                <input
                  id="autoteach-speed-slider"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={jogSpeed}
                  onChange={(e) => setJogSpeed(Number(e.target.value))}
                  className="jog-speed-slider"
                  title="Adjust default jog speed for this teaching session"
                />
                <div className="speed-slider-legend">
                  <span className="legend-slow">Slow</span>
                  <span className="legend-fast">Fast</span>
                </div>
              </div>
            </div>

            {/* Page Navigation for Steps */}
            {recordedSteps.length > 10 && (
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

            {/* Recorded Steps Grid - Only Show Steps for Current Page */}
            <div className="steps-grid">
              {displaySteps.map((recordedStep, index) => {
                const stepNum = recordedStep.step;
                return (
                  <div 
                    key={stepNum} 
                    className="step-grid-card recorded"
                    ref={stepNum === activeStepNumber ? activeCardRef : null}
                  >
                    <div className="card-header">
                      <span className="card-step-num">
                        ✓ Step {stepNum} - {patternOptions.find((p) => p.code === recordedStep.pattern)?.name || `Pattern ${recordedStep.pattern}`}
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
                console.log('[AutoTeach] Repeat confirmation - repeatTargetStep:', repeatTargetStep, 'eligibleRepeatTargets:', eligibleRepeatTargets, 'count:', count);
                if (!repeatTargetStep || repeatTargetStep === 1 || repeatTargetStep === 20) {
                  console.log('[AutoTeach] Failed first validation check');
                  setDialog({
                    open: true,
                    title: 'Invalid Repeat Step',
                    message: 'You cannot repeat Step 1 or Step 20. Choose a step between 2 and 19.',
                    confirm: closeDialog,
                    cancel: null,
                  });
                  return;
                }

                if (!eligibleRepeatTargets.includes(repeatTargetStep)) {
                  console.log('[AutoTeach] Failed second validation check - Step', repeatTargetStep, 'not in eligible:', eligibleRepeatTargets);
                  setDialog({
                    open: true,
                    title: 'Invalid Repeat Step',
                    message: 'Choose a previously recorded step between 2 and 19 to repeat.',
                    confirm: closeDialog,
                    cancel: null,
                  });
                  return;
                }

                // Create the repeat step and add it to recordedSteps
                const stepNumberToRecord = Math.min(recordedSteps.length + 1, 20);
                const defaultStepName = `Repeat Step ${repeatTargetStep}`;

                const newStep = {
                  step: stepNumberToRecord,
                  stepName: defaultStepName,
                  pattern: 5, // Pattern 5 = Repeat
                  needsReteach: false,
                  positions: {
                    axis1Cmd: 0,
                    axis2Cmd: 0,
                  },
                  dwell: 0,
                  enabledAxis: null,
                  repeatTargetStep: repeatTargetStep,
                  repeatCount: count,
                };

                setRecordedSteps((prev) => {
                  const next = [...prev, newStep];
                  pushProgramToPLC(next);
                  return next;
                });

                setRepeatCount(1);
                setRepeatTargetStep(null);
                setRepeatConfigOpen(false);
                setPendingPattern(null);
                setPattern(0);
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
                    <span>Select Step to Repeat</span>
                  </div>
                  <select
                    className="repeat-config-select"
                    value={repeatTargetStep ?? ''}
                    onChange={(e) => setRepeatTargetStep(parseInt(e.target.value, 10))}
                  >
                    <option value="" disabled>
                      {eligibleRepeatTargets.length === 0 
                        ? 'No eligible steps (2-9) recorded yet' 
                        : 'Choose a step...'}
                    </option>
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
                    <span>How Many Times?</span>
                  </div>
                  <button
                    type="button"
                    className="repeat-config-input keypad-button"
                    onClick={() => setRepeatKeypadOpen(true)}
                    title="Tap to open numeric keypad"
                  >
                    {repeatCount} times
                  </button>
                  <div className="repeat-config-hint">Tap the field above to enter repeat count</div>
                </div>

                <div className="repeat-info-box">
                  <div className="info-icon">ℹ️</div>
                  <div className="info-text">
                    Repeat can be added on steps 3–20. Select a previously recorded target step (2–19). 
                    Step 1 (Start) and Step 20 (End) cannot be repeated.
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

            {/* Pattern Selection Modal */}
            <PatternSelectionModal
              isOpen={showPatternModal}
              onClose={() => {
                setShowPatternModal(false);
                setPendingPattern(null);
              }}
              onSelectPattern={handlePatternSelected}
              stepNumber={activeStepNumber}
            />

            {/* Axis Selection Modal */}
            <AxisSelectionModal
              isOpen={showAxisModal}
              onClose={() => {
                setShowAxisModal(false);
                setEnabledAxis(null);
                setPendingPattern(null);
              }}
              onSelectAxis={handleAxisSelected}
              onAxisClick={handleEnableAxisStep2Plus}
              side={side}
              patternCode={pendingPattern ?? pattern}
              stepNumber={Math.min(recordedSteps.length + 1, 20)}
              lastFeedback={lastAxisFeedback}
              jogSpeed={jogSpeed}
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
                            : stepNum === 20
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
