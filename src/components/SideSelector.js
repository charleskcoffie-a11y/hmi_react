import React, { useState } from 'react';
import '../styles/SideSelector.css';

export default function SideSelector({ onSelectSide, onCancel, title, showBothOption = true }) {
  const [hoveredSide, setHoveredSide] = useState(null);

  return (
    <div className="side-selector-overlay" onClick={onCancel}>
      <div className="side-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="selector-header">
          <h2>{title || 'Select Machine Side'}</h2>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="selector-content">
          <p className="selector-instruction">Choose which side of the machine:</p>

          <div className={`sides-grid ${showBothOption ? 'with-both' : ''}`}>
            <div
              className={`side-card right-side ${hoveredSide === 'right' ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredSide('right')}
              onMouseLeave={() => setHoveredSide(null)}
              onClick={() => onSelectSide('right')}
            >
              <div className="side-icon">🔴</div>
              <h3>Right Side</h3>
              <div className="side-axes">
                <div className="axis-item">Axis 1 (ID)</div>
                <div className="axis-item">Axis 2 (OD)</div>
              </div>
              <button className="select-btn">Select Right</button>
            </div>

            <div
              className={`side-card left-side ${hoveredSide === 'left' ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredSide('left')}
              onMouseLeave={() => setHoveredSide(null)}
              onClick={() => onSelectSide('left')}
            >
              <div className="side-icon">🔵</div>
              <h3>Left Side</h3>
              <div className="side-axes">
                <div className="axis-item">Axis 3 (ID)</div>
                <div className="axis-item">Axis 4 (OD)</div>
              </div>
              <button className="select-btn">Select Left</button>
            </div>

            {showBothOption && (
              <div
                className={`side-card both-sides ${hoveredSide === 'both' ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredSide('both')}
                onMouseLeave={() => setHoveredSide(null)}
                onClick={() => onSelectSide('both')}
              >
                <div className="side-icon">⚙️</div>
                <h3>Both Sides</h3>
                <div className="side-axes">
                  <div className="axis-item">All Axes</div>
                </div>
                <button className="select-btn">Select Both</button>
              </div>
            )}
          </div>
        </div>

        <div className="selector-footer">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
