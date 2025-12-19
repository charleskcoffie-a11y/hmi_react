import React, { useState, useEffect, useCallback } from 'react';
import '../styles/NumericKeypad.css';

export default function NumericKeypad({
  isOpen,
  title = 'Enter Value',
  initialValue = '',
  decimals = 2,
  allowNegative = false,
  min = null,
  max = null,
  unit = '',
  onSubmit,
  onCancel,
  allowAddSub = false,
}) {
  const [value, setValue] = useState('');
  const [operation, setOperation] = useState('SET'); // 'SET', 'ADD', or 'SUB'

  useEffect(() => {
    if (isOpen) {
      setValue(
        initialValue === null || initialValue === undefined
          ? ''
          : String(initialValue)
      );
    }
  }, [isOpen, initialValue]);

  const addChar = useCallback(
    (ch) => {
      if (ch === '.') {
        if (decimals === 0) return;
        if (value.includes('.')) return;
        setValue((v) => (v ? v + '.' : '0.'));
        return;
      }
      if (ch === '+/-') {
        if (!allowNegative) return;
        if (!value) return;
        setValue((v) => (v.startsWith('-') ? v.slice(1) : '-' + v));
        return;
      }
      if (/^\d$/.test(ch)) {
        // Avoid multiple leading zeros like 000
        if (value === '0') {
          setValue(ch);
        } else if (value === '-0') {
          setValue('-' + ch);
        } else {
          setValue(value + ch);
        }
      }
    },
    [value, decimals, allowNegative]
  );

  const backspace = () => {
    setValue((v) => v.slice(0, -1));
  };

  const clearAll = () => setValue('');

  const clampAndSubmit = () => {
    let num = parseFloat(value);
    if (isNaN(num)) num = 0;
    if (decimals >= 0) {
      num = parseFloat(num.toFixed(decimals));
    }
    if (min !== null && num < min) num = min;
    if (max !== null && num > max) num = max;
    onSubmit && onSubmit(num);
  };

  if (!isOpen) return null;

  return (
    <div className="nk-overlay" onClick={onCancel}>
      <div className="nk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nk-header">
          <h3 className="nk-title">{title}{unit ? ` (${unit})` : ''}</h3>
          <button className="nk-close" onClick={onCancel}>✕</button>
        </div>
        <div className="nk-display">{value || '0'}</div>
        <div className="nk-grid">
          <button className="nk-key" onClick={() => addChar('7')}>7</button>
          <button className="nk-key" onClick={() => addChar('8')}>8</button>
          <button className="nk-key" onClick={() => addChar('9')}>9</button>
          <button className="nk-key nk-func" onClick={backspace}>⌫</button>

          <button className="nk-key" onClick={() => addChar('4')}>4</button>
          <button className="nk-key" onClick={() => addChar('5')}>5</button>
          <button className="nk-key" onClick={() => addChar('6')}>6</button>
          <button className="nk-key nk-func" onClick={clearAll}>CLR</button>

          <button className="nk-key" onClick={() => addChar('1')}>1</button>
          <button className="nk-key" onClick={() => addChar('2')}>2</button>
          <button className="nk-key" onClick={() => addChar('3')}>3</button>
          <button className={`nk-key nk-func ${allowNegative ? '' : 'nk-disabled'}`} onClick={() => addChar('+/-')}>±</button>

          <button className="nk-key nk-wide" onClick={() => addChar('0')}>0</button>
          <button className={`nk-key ${decimals === 0 ? 'nk-disabled' : ''}`} onClick={() => addChar('.')}>.</button>
          <button className="nk-key nk-enter" onClick={clampAndSubmit}>ENTER</button>
        </div>
      </div>
    </div>
  );
}
