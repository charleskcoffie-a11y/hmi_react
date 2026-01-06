import React from 'react';
import './ModernDialog.css';

export default function ModernDialog({
  open,
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  children,
}) {
  const resolvedOpen = typeof open === 'boolean' ? open : !!isOpen;
  if (!resolvedOpen) return null;
  return (
    <div className="modern-dialog-overlay">
      <div className="modern-dialog">
        <h3 className="modern-dialog-title">{title}</h3>
        <div className="modern-dialog-message">{children ?? message}</div>
        <div className="modern-dialog-actions">
          {onCancel && (
            <button className="modern-dialog-cancel" onClick={onCancel}>{cancelText}</button>
          )}
          <button className="modern-dialog-confirm" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
