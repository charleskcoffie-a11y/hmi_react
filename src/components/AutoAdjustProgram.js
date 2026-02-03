import React, { useState } from 'react';
import ModernDialog from './ModernDialog';
import NumericKeypad from './NumericKeypad';
import '../styles/AutoAdjustProgram.css';

export default function AutoAdjustProgram({ isOpen, onClose, side = 'right', stepCount = 10, stroke, program, onProgramUpdate }) {
  const [currentSize, setCurrentSize] = useState('');
  const [desiredSize, setDesiredSize] = useState('');
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  if (!isOpen) return null;

  const handleAdjust = () => {
    if (!program || !currentSize || !desiredSize || parseFloat(currentSize) <= 0 || parseFloat(desiredSize) <= 0) {
      alert('Please enter valid current and desired size values');
      return;
    }

    const currentSizeValue = parseFloat(currentSize);
    const desiredSizeValue = parseFloat(desiredSize);
    const ratio = desiredSizeValue / currentSizeValue;

    console.log('[AutoAdjust] Adjusting program. Current size:', currentSizeValue, 'Desired size:', desiredSizeValue, 'Ratio:', ratio);

    const updatedSteps = { ...program.steps };

    // Adjust steps 2-10 (skip step 1)
    for (let stepNum = 2; stepNum <= 10; stepNum++) {
      const step = updatedSteps[stepNum];
      if (!step) continue;

      // Skip repeat steps (pattern 5)
      if (step.pattern === 5) {
        console.log(`[AutoAdjust] Skipping step ${stepNum} (repeat step)`);
        continue;
      }

      const positions = step.positions || {};

      // For right side: axis1 is ID (expand), axis2 is OD (retract)
      // For left side: axis3 is ID (expand), axis4 is OD (retract)
      // Only adjust expand positions (ID axis)

      if (side === 'right') {
        // Adjust axis1 (ID/expand) only
        if (positions.axis1Cmd != null) {
          const oldValue = positions.axis1Cmd;
          const newValue = oldValue * ratio;
          updatedSteps[stepNum].positions.axis1Cmd = newValue;
          console.log(`[AutoAdjust] Step ${stepNum} Axis1 (ID): ${oldValue.toFixed(2)} → ${newValue.toFixed(2)}`);
        }
        // Leave axis2 (OD/retract) unchanged
      } else {
        // Adjust axis3 (ID/expand) only
        if (positions.axis3Cmd != null) {
          const oldValue = positions.axis3Cmd;
          const newValue = oldValue * ratio;
          updatedSteps[stepNum].positions.axis3Cmd = newValue;
          console.log(`[AutoAdjust] Step ${stepNum} Axis3 (ID): ${oldValue.toFixed(2)} → ${newValue.toFixed(2)}`);
        }
        // Leave axis4 (OD/retract) unchanged
      }

      // For step 3: separate expand/retract positions
      if (stepNum === 3) {
        if (side === 'right') {
          if (positions.axis1ExpandPos != null) {
            const oldValue = positions.axis1ExpandPos;
            const newValue = oldValue * ratio;
            updatedSteps[3].positions.axis1ExpandPos = newValue;
            console.log(`[AutoAdjust] Step 3 Axis1 Expand: ${oldValue.toFixed(2)} → ${newValue.toFixed(2)}`);
          }
          // Leave axis1RetractPos unchanged
        } else {
          if (positions.axis3ExpandPos != null) {
            const oldValue = positions.axis3ExpandPos;
            const newValue = oldValue * ratio;
            updatedSteps[3].positions.axis3ExpandPos = newValue;
            console.log(`[AutoAdjust] Step 3 Axis3 Expand: ${oldValue.toFixed(2)} → ${newValue.toFixed(2)}`);
          }
          // Leave axis3RetractPos unchanged
        }
      }
    }

    const updatedProgram = {
      ...program,
      steps: updatedSteps
    };

    console.log('[AutoAdjust] Program adjusted successfully');
    if (onProgramUpdate) {
      onProgramUpdate(updatedProgram);
    }
    onClose();
  };

  return (
    <>
      <ModernDialog
        isOpen={isOpen}
        title="Auto Adjust Program"
        onClose={onClose}
      >
        <div className="auto-adjust-dialog">
          <div className="auto-adjust-meta">
            <p>Side: <strong>{side === 'right' ? 'Right' : 'Left'}</strong></p>
            <p>Steps: <strong>{stepCount}</strong></p>
          </div>

          <div className="auto-adjust-field">
            <label className="auto-adjust-label">
              Current Size (mm):
            </label>
            <input
              type="text"
              readOnly
              value={currentSize}
              onClick={() => { setKeypadTarget('current'); setKeypadOpen(true); }}
              placeholder="Tap to enter current size"
              className="auto-adjust-input"
            />
          </div>

          <div className="auto-adjust-field">
            <label className="auto-adjust-label">
              Desired Size (mm):
            </label>
            <input
              type="text"
              readOnly
              value={desiredSize}
              onClick={() => { setKeypadTarget('desired'); setKeypadOpen(true); }}
              placeholder="Tap to enter desired size"
              className="auto-adjust-input"
            />
          </div>

          <div className="auto-adjust-note">
            <strong>Note:</strong> This will adjust only expand (ID) positions in steps 2-10. 
            Step 1 and retract (OD) positions will not be changed. Repeat steps (pattern 5) will be skipped.
          </div>

          <div className="auto-adjust-actions">
            <button 
              onClick={onClose} 
              className="modern-dialog-cancel"
              disabled={adjusting}
            >
              Cancel
            </button>
            <button 
              onClick={handleAdjust}
              className="modern-dialog-ok"
              disabled={!currentSize || !desiredSize || parseFloat(currentSize) <= 0 || parseFloat(desiredSize) <= 0 || adjusting}
            >
              {adjusting ? 'Adjusting...' : 'Apply Adjustment'}
            </button>
          </div>
        </div>
      </ModernDialog>

      <NumericKeypad
        isOpen={keypadOpen}
        initialValue={keypadTarget === 'current' ? currentSize : desiredSize}
        label={keypadTarget === 'current' ? 'Current Size (mm)' : 'Desired Size (mm)'}
        onSubmit={(val) => {
          if (keypadTarget === 'current') {
            setCurrentSize(String(val));
          } else {
            setDesiredSize(String(val));
          }
          setKeypadOpen(false);
        }}
        onCancel={() => setKeypadOpen(false)}
      />
    </>
  );
}
