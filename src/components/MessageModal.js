import React from 'react';
import '../styles/MessageModal.css';

export default function MessageModal({ isOpen, title, message, onClose, type = 'info' }) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  return (
    <div className="message-modal-overlay" onClick={onClose}>
      <div className={`message-modal ${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="message-header">
          <div className="message-icon">{getIcon()}</div>
          <h3>{title}</h3>
        </div>
        <div className="message-body">
          <p>{message}</p>
        </div>
        <div className="message-footer">
          <button className="message-ok-btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
