import React, { useMemo } from 'react';
import ModernDialog from './ModernDialog';
import '../styles/PatternSelectionModal.css';

export default function PatternSelectionModal({
  isOpen,
  onClose,
  onSelectPattern,
  stepNumber,
}) {
  const patternOptions = useMemo(
    () => [
      { code: 0, name: 'Red Ext' },
      { code: 1, name: 'Red Ret' },
      { code: 2, name: 'Exp Ext' },
      { code: 3, name: 'Exp Ret' },
      { code: 4, name: 'RedRet + ExpRet' },
      { code: 5, name: 'Repeat' },
      { code: 6, name: 'RedExt + ExpExt' },
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
    // Step 10 forbids patterns 0, 2, 6, 5
    if (stepNumber === 10) {
      return patternOptions.filter((p) => ![0, 2, 6, 5].includes(p.code));
    }
    // All other steps allow all patterns
    return patternOptions;
  }, [patternOptions, stepNumber]);

  const handlePatternSelect = (pattern) => {
    onSelectPattern(pattern);
    onClose();
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
    </ModernDialog>
  );
}
