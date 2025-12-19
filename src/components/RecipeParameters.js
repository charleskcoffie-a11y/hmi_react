import React, { useState, useEffect } from 'react';
import '../styles/RecipeParameters.css';
import TubeViewer from './TubeViewer';
import NumericKeypad from './NumericKeypad';

export default function RecipeParameters({ isOpen, onClose, side, parameters, onSave }) {
  const [tubeID, setTubeID] = useState('');
  const [tubeOD, setTubeOD] = useState('');
  const [finalSize, setFinalSize] = useState('');
  const [sizeType, setSizeType] = useState('OD'); // OD or ID
  const [tubeLength, setTubeLength] = useState('');
  const [idFingerRadius, setIdFingerRadius] = useState('');
  const [depth, setDepth] = useState('');
  const [recipeSpeed, setRecipeSpeed] = useState('100');
  const [stepDelay, setStepDelay] = useState('');

  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadTarget, setKeypadTarget] = useState(null);
  const [keypadInitial, setKeypadInitial] = useState('');

  useEffect(() => {
    if (parameters) {
      setTubeID(parameters.tubeID || '');
      setTubeOD(parameters.tubeOD || '');
      setFinalSize(parameters.finalSize || '');
      setSizeType(parameters.sizeType || 'OD');
      setTubeLength(parameters.tubeLength || '');
      setIdFingerRadius(parameters.idFingerRadius || '');
      setDepth(parameters.depth || '');
      setRecipeSpeed(parameters.recipeSpeed || '100');
      setStepDelay(parameters.stepDelay || '');
    }
  }, [parameters]);

  const handleSave = () => {
    const params = {
      tubeID: parseFloat(tubeID) || 0,
      tubeOD: parseFloat(tubeOD) || 0,
      finalSize: parseFloat(finalSize) || 0,
      sizeType,
      tubeLength: parseFloat(tubeLength) || 0,
      idFingerRadius: parseFloat(idFingerRadius) || 0,
      depth: parseFloat(depth) || 0,
      recipeSpeed: parseFloat(recipeSpeed) || 100,
      stepDelay: parseFloat(stepDelay) || 0
    };
    onSave(params);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const openKeypad = (target, currentValue, label) => {
    setKeypadTarget({ field: target, label });
    setKeypadInitial(currentValue ?? '');
    setKeypadOpen(true);
  };

  const handleKeypadSubmit = (val) => {
    if (!keypadTarget) return;
    const v = String(val);
    switch (keypadTarget.field) {
      case 'tubeID': setTubeID(v); break;
      case 'tubeOD': setTubeOD(v); break;
      case 'finalSize': setFinalSize(v); break;
      case 'tubeLength': setTubeLength(v); break;
      case 'idFingerRadius': setIdFingerRadius(v); break;
      case 'depth': setDepth(v); break;
      case 'recipeSpeed': setRecipeSpeed(v); break;
      case 'stepDelay': setStepDelay(v); break;
      default: break;
    }
    setKeypadOpen(false);
    setKeypadTarget(null);
  };

  const handleKeypadCancel = () => {
    setKeypadOpen(false);
    setKeypadTarget(null);
  };

  if (!isOpen) return null;

  return (
    <div className="parameters-modal-overlay" onClick={onClose}>
      <div className="parameters-modal" onClick={(e) => e.stopPropagation()}>
        <div className="parameters-header">
          <div className="parameters-title">
            <h2>Recipe Parameters</h2>
            {side && <span className="parameters-side-pill">{side === 'right' ? 'Right Side' : 'Left Side'}</span>}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="parameters-content">
          <div className="parameters-form">
            
            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Tube Inner Diameter (ID)</span>
                <span className="label-unit">mm</span>
              </label>
              <input
                type="text"
                readOnly
                value={tubeID}
                onClick={() => openKeypad('tubeID', tubeID, 'Tube Inner Diameter (ID)')}
                placeholder="Tap to enter ID"
                className="param-input keypad-input"
              />
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Tube Outer Diameter (OD)</span>
                <span className="label-unit">mm</span>
              </label>
              <input
                type="text"
                readOnly
                value={tubeOD}
                onClick={() => openKeypad('tubeOD', tubeOD, 'Tube Outer Diameter (OD)')}
                placeholder="Tap to enter OD"
                className="param-input keypad-input"
              />
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Final Size Type</span>
              </label>
              <div className="size-type-selector">
                <button
                  className={`size-type-btn ${sizeType === 'OD' ? 'active' : ''}`}
                  onClick={() => setSizeType('OD')}
                >
                  Outer Diameter (OD)
                </button>
                <button
                  className={`size-type-btn ${sizeType === 'ID' ? 'active' : ''}`}
                  onClick={() => setSizeType('ID')}
                >
                  Inner Diameter (ID)
                </button>
              </div>
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Final {sizeType} Size</span>
                <span className="label-unit">mm</span>
              </label>
              <input
                type="text"
                readOnly
                value={finalSize}
                onClick={() => openKeypad('finalSize', finalSize, `Final ${sizeType}`)}
                placeholder={`Tap to enter Final ${sizeType}`}
                className="param-input keypad-input"
              />
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Tube Length</span>
                <span className="label-unit">mm</span>
              </label>
              <input
                type="text"
                readOnly
                value={tubeLength}
                onClick={() => openKeypad('tubeLength', tubeLength, 'Tube Length')}
                placeholder="Tap to enter Length"
                className="param-input keypad-input"
              />
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">ID Finger Radius</span>
                <span className="label-unit">mm</span>
              </label>
              <input
                type="text"
                readOnly
                value={idFingerRadius}
                onClick={() => openKeypad('idFingerRadius', idFingerRadius, 'ID Finger Radius')}
                placeholder="Tap to enter Radius"
                className="param-input keypad-input"
              />
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Depth</span>
                <span className="label-unit">mm</span>
              </label>
              <input
                type="text"
                readOnly
                value={depth}
                onClick={() => openKeypad('depth', depth, 'Depth')}
                placeholder="Tap to enter Depth"
                className="param-input keypad-input"
              />
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Recipe Speed</span>
                <span className="label-unit">%</span>
              </label>
              <input
                type="text"
                readOnly
                value={recipeSpeed}
                onClick={() => openKeypad('recipeSpeed', recipeSpeed, 'Recipe Speed')}
                placeholder="Tap to enter Speed"
                className="param-input keypad-input"
              />
            </div>

            <div className="param-group">
              <label className="param-label">
                <span className="label-text">Step Delay</span>
                <span className="label-unit">ms</span>
              </label>
              <input
                type="text"
                readOnly
                value={stepDelay}
                onClick={() => openKeypad('stepDelay', stepDelay, 'Step Delay')}
                placeholder="Tap to enter Delay"
                className="param-input keypad-input"
              />
            </div>

            <div className="param-summary">
              <h3>Summary</h3>
              <div className="summary-row">
                <span className="summary-label">Tube ID:</span>
                <span className="summary-value">{tubeID || '--'} mm</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Tube OD:</span>
                <span className="summary-value">{tubeOD || '--'} mm</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Final {sizeType}:</span>
                <span className="summary-value">{finalSize || '--'} mm</span>
              </div>
              {tubeOD && tubeID && (
                <div className="summary-row">
                  <span className="summary-label">Wall Thickness:</span>
                  <span className="summary-value">{((parseFloat(tubeOD) - parseFloat(tubeID)) / 2).toFixed(2)} mm</span>
                </div>
              )}
              <div className="summary-row">
                <span className="summary-label">Recipe Speed:</span>
                <span className="summary-value">{recipeSpeed || '--'} %</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Step Delay:</span>
                <span className="summary-value">{stepDelay || '--'} ms</span>
              </div>
            </div>

            <TubeViewer parameters={{
              tubeID: parseFloat(tubeID) || 0,
              tubeOD: parseFloat(tubeOD) || 0,
              idFingerRadius: parseFloat(idFingerRadius) || 0,
              tubeLength: parseFloat(tubeLength) || 0
            }} />

          </div>
        </div>

        <div className="parameters-footer">
          <button className="save-param-btn" onClick={handleSave}>Save Parameters</button>
          <button className="cancel-param-btn" onClick={handleCancel}>Cancel</button>
        </div>

        <NumericKeypad
          isOpen={keypadOpen}
          title={keypadTarget?.label || 'Enter Value'}
          unit={keypadTarget?.field === 'recipeSpeed' ? '%' : keypadTarget?.field === 'stepDelay' ? 'ms' : 'mm'}
          initialValue={keypadInitial}
          decimals={keypadTarget?.field === 'recipeSpeed' ? 0 : 2}
          allowNegative={false}
          allowAddSub={true}
          onSubmit={handleKeypadSubmit}
          onCancel={handleKeypadCancel}
        />
      </div>
    </div>
  );
}
