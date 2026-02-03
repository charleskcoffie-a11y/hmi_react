import React, { useMemo, useState } from 'react';
import ModernDialog from './ModernDialog';
import PatternAxisSelectionModal from './PatternAxisSelectionModal';
import '../styles/PatternSelectionModal.css';

export default function PatternSelectionModal({
  isOpen,
  onClose,
  onSelectPattern,
  stepNumber,
  side,
  onTriggerAxisPLC,
  lastFeedback = [],
}) {
  const [showAxisSelector, setShowAxisSelector] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState(null);
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

  const availablePatterns = useMemo(() => {
    // Step 1 is locked to pattern 6
    if (stepNumber === 1) {
      return patternOptions.filter((p) => p.code === 6);
    }
    // Step 2 forbids patterns 1, 3, 4, 5
    if (stepNumber === 2) {
      return patternOptions.filter((p) => ![1, 3, 4, 5].includes(p.code));
    }
    // Step 10 forbids patterns 0, 2, 6 (Repeat allowed to target earlier steps)
    if (stepNumber === 10) {
      return patternOptions.filter((p) => ![0, 2, 6].includes(p.code));
    }
    // All other steps allow all patterns
    return patternOptions;
  }, [patternOptions, stepNumber]);

  // Determine if this pattern needs axis selection
  const patternRequiresAxisSelection = (code) => {
    // Patterns that only work with specific axes need selection
    return [0, 1, 2, 3].includes(code); // Red Ext/Ret and Exp Ext/Ret
  };

  const handlePatternSelect = (patternCode) => {
    if (patternRequiresAxisSelection(patternCode)) {
      // Show axis selector for this pattern
      setSelectedPattern(patternCode);
      setShowAxisSelector(true);
    } else {
      // Patterns 4, 5, 6 don't need axis selection
      onSelectPattern(patternCode, null);
      onClose();
    }
  };

  const handleAxisSelected = (axis) => {
    // User selected an axis - proceed with pattern and axis
    if (selectedPattern !== null) {
      onSelectPattern(selectedPattern, axis);
      setSelectedPattern(null);
      setShowAxisSelector(false);
      onClose();
    }
  };

  const handleAxisTriggerPLC = async (axis, triggerWrite = false) => {
    // Call parent's PLC trigger function if provided
    if (onTriggerAxisPLC && triggerWrite) {
      await onTriggerAxisPLC(axis);
    }
  };

  return (
    <ModernDialog
      isOpen={isOpen}
      title={`Select Pattern for Step ${stepNumber}`}
      onClose={onClose}
      showConfirmButton={false}
      showCancelButton={false}
    >
      <div className="pattern-selection-modal-content">
        <div className="pattern-buttons-grid">
          {availablePatterns.map((pattern) => (
            <button
              key={pattern.code}
              className="pattern-button"
              onClick={() => handlePatternSelect(pattern.code)}
            >
              <div className="pattern-code">{pattern.code}</div>
              <div className="pattern-name">{pattern.name}</div>
            </button>
          ))}
        </div>
      </div>
      
      <PatternAxisSelectionModal
        isOpen={showAxisSelector}
        onClose={() => {
          setShowAxisSelector(false);
          setSelectedPattern(null);
        }}
        onSelectAxis={handleAxisSelected}
        onTriggerPLC={handleAxisTriggerPLC}
        side={side}
        patternCode={selectedPattern}
        stepNumber={stepNumber}
        lastFeedback={lastFeedback}
      />
    </ModernDialog>
  );
}
