import React, { useState } from 'react';
import '../styles/AxisPanel.css';

export default function AxisPanel({ side, axis1Name, axis2Name, onAxisChange, axis1State, axis2State, actualPositions, step, stepDescription, recipe, recipes, onRecipeChange }) {
  const [axis1Mode, setAxis1Mode] = useState('manual');
  const [axis2Mode, setAxis2Mode] = useState('manual');
  const [axis1Value, setAxis1Value] = useState(0);
  const [axis2Value, setAxis2Value] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const selectedRecipe = recipes?.find(r => r.name === recipe);
  const recipeDescription = selectedRecipe?.description || 'No recipe selected';
  
  const filteredRecipes = recipes?.filter(r => 
    r.name.toLowerCase().includes(searchFilter.toLowerCase())
  ) || [];

  const handleAxis1Change = (newValue) => {
    setAxis1Value(newValue);
    onAxisChange && onAxisChange(axis1Name, newValue, axis1Mode);
  };

  const handleAxis2Change = (newValue) => {
    setAxis2Value(newValue);
    onAxisChange && onAxisChange(axis2Name, newValue, axis2Mode);
  };

  const handleJog = (axisName, direction) => {
    const increment = direction === 'up' ? 1 : -1;
    if (axisName === axis1Name) {
      handleAxis1Change(axis1Value + increment);
    } else {
      handleAxis2Change(axis2Value + increment);
    }
  };

  const displayAxis1 = actualPositions?.axis1 ?? axis1Value;
  const displayAxis2 = actualPositions?.axis2 ?? axis2Value;

  return (
    <div className={`axis-panel axis-panel-${side.toLowerCase()}`}>
      <div className="panel-header">
        <h2>{side} Side</h2>
      </div>

      <div className="recipe-selector-section">
        <label className="recipe-label">Recipe:</label>
        {recipe ? (
          <div className="selected-recipe-display">
            <div className="selected-recipe-name">{recipe}</div>
            <button 
              className="change-recipe-btn"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              Change
            </button>
          </div>
        ) : (
          <button 
            className="select-recipe-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            Select Recipe
          </button>
        )}
        {showDropdown && (
          <div className="recipe-dropdown-list">
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="recipe-search-input"
              autoFocus
            />
            <div className="recipe-items-container">
              <div 
                className="recipe-dropdown-item"
                onClick={() => {
                  onRecipeChange('');
                  setSearchFilter('');
                  setShowDropdown(false);
                }}
              >
                -- Clear Selection --
              </div>
              {filteredRecipes.map(r => (
                <div
                  key={r.name}
                  className={`recipe-dropdown-item ${recipe === r.name ? 'selected' : ''}`}
                  onClick={() => {
                    onRecipeChange(r.name);
                    setSearchFilter('');
                    setShowDropdown(false);
                  }}
                >
                  {r.name}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="recipe-description">{recipeDescription}</div>
      </div>

      <div className="positions-row">
        <div className="pos-item">
          <div className="pos-name">{axis1Name}</div>
          <div className="pos-value">{displayAxis1.toFixed(3)} mm</div>
        </div>
        <div className="pos-item">
          <div className="pos-name">{axis2Name}</div>
          <div className="pos-value">{displayAxis2.toFixed(3)} mm</div>
        </div>
      </div>

      <div className="step-info-row">
        <div className="step-num">Step {step}</div>
        <div className="step-desc">{stepDescription}</div>
      </div>
    </div>
  );
}
