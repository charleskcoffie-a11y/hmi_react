import React from 'react';
import ModernDialog from './ModernDialog';

// Minimal placeholder for auto adjust flow
export default function AutoAdjustProgram({ isOpen, onClose, side = 'right', stepCount = 10, stroke }) {
  if (!isOpen) return null;

  const strokeLabel = stroke != null ? stroke : 'N/A';

  return (
    <ModernDialog
      isOpen={isOpen}
      title="Auto Adjust Program"
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
        <p style={{ margin: 0 }}>Side: <strong>{side || 'right'}</strong></p>
        <p style={{ margin: 0 }}>Steps detected: <strong>{stepCount}</strong></p>
        <p style={{ margin: 0 }}>Stroke: <strong>{strokeLabel}</strong></p>
        <p style={{ margin: 0, color: '#555' }}>
          Auto adjust logic is not yet implemented. Use manual edit or close this dialog.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <button onClick={onClose} className="modern-dialog-cancel">Close</button>
        </div>
      </div>
    </ModernDialog>
  );
}
