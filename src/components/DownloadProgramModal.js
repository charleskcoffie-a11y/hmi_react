import React from 'react';
import '../styles/DownloadProgramModal.css';

export default function DownloadProgramModal({ isOpen, program, onConfirm, onCancel }) {
  if (!isOpen || !program) return null;

  return (
    <div className="download-overlay" onClick={onCancel}>
      <div className="download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="download-header">
          <h2>⬇ Download Program to PLC</h2>
        </div>
        <div className="download-body">
          <div className="program-summary">
            <div className="program-name">{program.name}</div>
            <div className={`side-badge ${program.side}`}>{program.side === 'right' ? 'Right Side' : 'Left Side'}</div>
          </div>
          <p className="download-message">Do you want to download this program to the PLC?</p>
        </div>
        <div className="download-footer">
          <button className="download-btn" onClick={onConfirm}>Download</button>
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
