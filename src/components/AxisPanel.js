import React from 'react';
import '../styles/AxisPanel.css';

function AxisPanel({ side, axis1Name, axis2Name, onAxisChange, axis1State, axis2State, actualPositions, step, stepDescription, recipe, recipes, onRecipeChange, onOpenRecipeSelector, unitSystem = 'mm', userRole, runMode = false, jogMode = false, sequenceActive = false, headCount = 0, onResetHeadCount = () => {} }) {
  const canChangeRecipe = userRole !== 'operator';
  
  const selectedRecipe = recipes?.find(r => r.name === recipe);
  const recipeDescription = selectedRecipe?.description || 'No recipe selected';

  const displayAxis1 = actualPositions?.axis1 ?? 0;
  const displayAxis2 = actualPositions?.axis2 ?? 0;
  const unitLabel = unitSystem === 'inch' ? 'in' : 'mm';

  return (
    <div className={`axis-panel axis-panel-${side.toLowerCase()}`}>
      <div className="panel-header">
        <div className="panel-header-row">
          <h2>{side} Side</h2>
          <div className="head-count">
            <span className="head-count-label">Count</span>
            <span className="head-count-value">{headCount}</span>
            <button
              className="head-count-reset"
              onClick={onResetHeadCount}
              title="Reset head count"
            >
              Reset
            </button>
          </div>
        </div>
        {(runMode || jogMode || sequenceActive) && (
          <div className="mode-status">
            {runMode && <span className="mode-badge run-badge">RUN</span>}
            {jogMode && <span className="mode-badge jog-badge">JOG</span>}
            {sequenceActive && <span className="mode-badge seq-badge">SEQUENCE ACTIVE</span>}
          </div>
        )}
      </div>

      <div className="recipe-selector-section">
        <label className="recipe-label">Recipe:</label>
        {recipe ? (
          <div className="selected-recipe-display">
            <div className="selected-recipe-name">{recipe}</div>
            <button 
              className="change-recipe-btn"
              onClick={() => onOpenRecipeSelector && onOpenRecipeSelector(side.toLowerCase())}
              disabled={!canChangeRecipe}
              title={canChangeRecipe ? 'Change recipe' : 'Operators cannot change recipes'}
            >
              Change
            </button>
          </div>
        ) : (
          <button 
            className="select-recipe-btn"
            onClick={() => onOpenRecipeSelector && onOpenRecipeSelector(side.toLowerCase())}
            disabled={!canChangeRecipe}
            title={canChangeRecipe ? 'Select recipe' : 'Operators cannot change recipes'}
          >
            Select Recipe
          </button>
        )}
        <div className="recipe-description">{recipeDescription}</div>
      </div>

      <div className="positions-row">
        <div className="pos-item">
          <div className="pos-name">{axis1Name}</div>
          <div className="pos-reading">
            <div className="pos-value">{displayAxis1.toFixed(3)}</div>
            <div className="pos-unit">{unitLabel}</div>
          </div>
        </div>
        <div className="pos-item">
          <div className="pos-name">{axis2Name}</div>
          <div className="pos-reading">
            <div className="pos-value">{displayAxis2.toFixed(3)}</div>
            <div className="pos-unit">{unitLabel}</div>
          </div>
        </div>
      </div>

      <div className={`step-info-row ${runMode ? 'step-running' : ''}`}>
        <div className="step-desc">{stepDescription}</div>
      </div>
    </div>
  );
}

export default React.memo(AxisPanel);
