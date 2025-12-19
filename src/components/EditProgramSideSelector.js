import React from 'react';
import '../styles/EditProgramSideSelector.css';

export default function EditProgramSideSelector({ isOpen, onClose, onSelectSide }) {
  const handleSelectLeft = () => {
    onSelectSide('left');
    onClose();
  };

  const handleSelectRight = () => {
    onSelectSide('right');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="side-selector-overlay" onClick={onClose}>
      <div className="side-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="side-selector-header">
          <h2>Select Side to Edit</h2>
        </div>

        <div className="side-selector-content">
          <p className="side-selector-description">Choose which side's program you want to edit:</p>
          
          <div className="side-selector-buttons">
            <button 
              className="side-selector-btn left-side-btn"
              onClick={handleSelectLeft}
            >
              <div className="side-btn-icon">◀</div>
              <div className="side-btn-text">Edit Left Side</div>
              <div className="side-btn-subtext">Left side program</div>
            </button>

            <button 
              className="side-selector-btn right-side-btn"
              onClick={handleSelectRight}
            >
              <div className="side-btn-icon">▶</div>
              <div className="side-btn-text">Edit Right Side</div>
              <div className="side-btn-subtext">Right side program</div>
            </button>
          </div>
        </div>

        <div className="side-selector-footer">
          <button className="cancel-side-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
