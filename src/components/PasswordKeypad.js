import React from 'react';
import '../styles/PasswordKeypad.css';

export default function PasswordKeypad({ value, onValueChange, onEnter, maxLength = 6 }) {
  const addDigit = (d) => {
    if (value.length < maxLength) onValueChange(value + d);
  };

  const backspace = () => onValueChange(value.slice(0, -1));
  const clearAll = () => onValueChange('');

  return (
    <div className="pwk-container">
      <div className="pwk-row">
        <button className="pwk-btn" onClick={() => addDigit('1')}>1</button>
        <button className="pwk-btn" onClick={() => addDigit('2')}>2</button>
        <button className="pwk-btn" onClick={() => addDigit('3')}>3</button>
      </div>
      <div className="pwk-row">
        <button className="pwk-btn" onClick={() => addDigit('4')}>4</button>
        <button className="pwk-btn" onClick={() => addDigit('5')}>5</button>
        <button className="pwk-btn" onClick={() => addDigit('6')}>6</button>
      </div>
      <div className="pwk-row">
        <button className="pwk-btn" onClick={() => addDigit('7')}>7</button>
        <button className="pwk-btn" onClick={() => addDigit('8')}>8</button>
        <button className="pwk-btn" onClick={() => addDigit('9')}>9</button>
      </div>
      <div className="pwk-row">
        <button className="pwk-btn pwk-clear" onClick={clearAll}>Clear</button>
        <button className="pwk-btn" onClick={() => addDigit('0')}>0</button>
        <button className="pwk-btn pwk-back" onClick={backspace}>←</button>
      </div>
      <div className="pwk-row">
        <button className="pwk-btn pwk-enter" onClick={onEnter}>Enter</button>
      </div>
    </div>
  );
}
