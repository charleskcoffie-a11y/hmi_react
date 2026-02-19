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
  confirmDisabled = false,
  children,
  zIndex,
  variant,
  onClose,
}) {
  const resolvedOpen = typeof open === 'boolean' ? open : !!isOpen;
  
  if (resolvedOpen) {
    console.log('[ModernDialog] Rendering dialog - title:', title, 'has children:', !!children);
  }
  
  if (!resolvedOpen) return null;
  const overlayStyle = zIndex ? { zIndex } : undefined;
  
  const dialogClass = variant ? `modern-dialog ${variant}` : 'modern-dialog';
  
  const getIcon = () => {
    if (variant === 'message-dialog') {
      if (title.includes('✓') || title.includes('Success')) return '✓';
      if (title.includes('✗') || title.includes('Failed') || title.includes('Error')) return '✗';
      if (title.includes('⚠') || title.includes('Warning')) return '⚠';
      return 'ℹ';
    }
    return null;
  };
  
  const icon = getIcon();
  const handleClick = onConfirm || onClose || (() => {});

  return (
    <div className="modern-dialog-overlay" style={overlayStyle}>
      <div className={dialogClass}>
        <h3 className="modern-dialog-title">
          {icon && <span className="message-icon">{icon}</span>}
          {title}
        </h3>
        <div className="modern-dialog-message">{children ?? message}</div>
        <div className="modern-dialog-actions">
          {onCancel && (
            <button className="modern-dialog-cancel" onClick={onCancel}>{cancelText}</button>
          )}
          {onConfirm && (
            <button 
              className="modern-dialog-confirm" 
              onClick={() => {
                console.log('[ModernDialog] Confirm button clicked, disabled=', confirmDisabled);
                if (!confirmDisabled && onConfirm) {
                  console.log('[ModernDialog] Calling onConfirm');
                  onConfirm();
                }
              }} 
              disabled={confirmDisabled}
            >
              {confirmText}
            </button>
          )}
          {!onConfirm && !onCancel && (
            <button className="message-dialog-btn" onClick={handleClick}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
