import React, { useState } from 'react';
import '../styles/VirtualKeyboard.css';

export default function VirtualKeyboard({ onInput, onEnter, onBackspace, value }) {
  const keys = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '_'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-', '.', '/'],
  ];

  const handleKeyClick = (key) => {
    onInput(value + key);
  };

  const handleSpace = () => {
    onInput(value + ' ');
  };

  const handleBackspace = () => {
    onBackspace(value.slice(0, -1));
  };

  return (
    <div className="virtual-keyboard">
      <div className="keyboard-display">
        <input
          type="text"
          value={value}
          readOnly
          className="keyboard-input"
          placeholder="Enter program name"
        />
      </div>

      <div className="keyboard-keys">
        {keys.map((row, rowIndex) => (
          <div key={rowIndex} className="keyboard-row">
            {row.map((key) => (
              <button
                key={key}
                className="keyboard-key"
                onClick={() => handleKeyClick(key)}
              >
                {key}
              </button>
            ))}
          </div>
        ))}

        <div className="keyboard-row keyboard-row-special">
          <button
            className="keyboard-key spacebar"
            onClick={handleSpace}
          >
            Space
          </button>
          <button
            className="keyboard-key backspace-key"
            onClick={handleBackspace}
          >
            ← Backspace
          </button>
        </div>

        <div className="keyboard-row keyboard-row-action">
          <button
            className="keyboard-key enter-key"
            onClick={() => onEnter(value)}
          >
            ✓ Enter
          </button>
        </div>
      </div>

      <div className="keyboard-info">
        <p>Length: {value.length}/32</p>
      </div>
    </div>
  );
}
