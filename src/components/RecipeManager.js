import React, { useState, useRef } from 'react';
import '../styles/RecipeManager.css';
import '../styles/RecipeManagerSide.css';
import '../styles/RecipeTextarea.css';

export default function RecipeManager({ isOpen, onClose, recipes, side, onLoadRecipe, onCreateRecipe, onEditRecipe, onDeleteRecipe }) {
  const [selectedRecipe, setSelectedRecipe] = useState(recipes && recipes.length > 5 ? recipes[5] : recipes?.[0] || null);
  const [action, setAction] = useState(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');

  // Ref for file input (import)
  const fileInputRef = useRef(null);

  const handleLoad = () => {
    if (selectedRecipe) {
      console.log('Loading recipe:', selectedRecipe);
      onLoadRecipe && onLoadRecipe(selectedRecipe, side);
    }
  };

  const handleEdit = () => {
    if (selectedRecipe) {
      const recipeName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe.name;
      const recipeDesc = typeof selectedRecipe === 'object' ? selectedRecipe.description : '';
      setNewRecipeName(recipeName);
      setNewRecipeDescription(recipeDesc);
      setAction('edit');
    }
  };

  const handleCopy = () => {
    if (selectedRecipe) {
      const recipeName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe.name;
      const recipeDesc = typeof selectedRecipe === 'object' ? selectedRecipe.description : '';
      setNewRecipeName(`${recipeName} - Copy`);
      setNewRecipeDescription(recipeDesc);
      setAction('copy');
    }
  };

  const handleDelete = () => {
    if (selectedRecipe) {
      if (window.confirm(`Are you sure you want to delete this recipe?`)) {
        onDeleteRecipe && onDeleteRecipe(selectedRecipe, side);
        setSelectedRecipe(null);
      }
    }
  };

  const handleCreate = () => {
    setAction('create');
    setNewRecipeName('');
    setNewRecipeDescription('');
  };

  // Export selected recipe as JSON file
  const handleExport = () => {
    if (!selectedRecipe) return;
    const recipeObj = typeof selectedRecipe === 'object' ? selectedRecipe : recipes.find(r => r.name === selectedRecipe);
    if (!recipeObj) return;
    const dataStr = JSON.stringify(recipeObj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recipeObj.name || 'recipe'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Trigger file input for import
  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = null;
    fileInputRef.current?.click();
  };

  // Import recipe from JSON file
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedRecipe = JSON.parse(event.target.result);
        // Optionally validate structure here
        onCreateRecipe && onCreateRecipe(importedRecipe.name, importedRecipe.description, side, importedRecipe.parameters);
        setSelectedRecipe(importedRecipe);
        setAction(null);
      } catch (err) {
        alert('Invalid recipe file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    if (newRecipeName.trim()) {
      if (action === 'create' || action === 'copy') {
        onCreateRecipe && onCreateRecipe(newRecipeName.trim(), newRecipeDescription.trim(), side);
      } else if (action === 'edit') {
        onEditRecipe && onEditRecipe(selectedRecipe, newRecipeName.trim(), newRecipeDescription.trim(), side);
      }
      setAction(null);
      setNewRecipeName('');
      setNewRecipeDescription('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="recipe-modal-overlay" onClick={onClose}>
      <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="recipe-header">
          <div className="recipe-title">
            <h2>Recipe Manager</h2>
            {side && <span className="recipe-side-pill">{side === 'right' ? 'Right Side' : 'Left Side'}</span>}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="recipe-content">
          <div className="recipe-list-section">
            <h3>Available Recipes</h3>
            <div className="recipe-listbox">
              {recipes && recipes.length > 0 ? (
                recipes.map((recipe, index) => {
                  const recipeName = typeof recipe === 'string' ? recipe : recipe.name;
                  const recipeDesc = typeof recipe === 'object' ? recipe.description : '';
                  return (
                    <div
                      key={index}
                      className={`recipe-item ${selectedRecipe === recipe ? 'selected' : ''}`}
                      onClick={() => setSelectedRecipe(recipe)}
                    >
                      <div className="recipe-item-header">
                        <span className="recipe-icon">📄</span>
                        <span className="recipe-name">{recipeName}</span>
                      </div>
                      {recipeDesc && <div className="recipe-description">{recipeDesc}</div>}
                    </div>
                  );
                })
              ) : (
                <div className="empty-list">No recipes available</div>
              )}
            </div>
          </div>

          <div className="recipe-actions">
            <h3>Actions</h3>
            <div className="action-buttons">
              <button 
                className="recipe-action-btn load-btn"
                onClick={handleLoad}
                disabled={!selectedRecipe}
              >
                ↓ Load
              </button>
              <button 
                className="recipe-action-btn edit-btn"
                onClick={handleEdit}
                disabled={!selectedRecipe}
              >
                ✎ Edit
              </button>
              <button 
                className="recipe-action-btn copy-btn"
                onClick={handleCopy}
                disabled={!selectedRecipe}
              >
                ⧉ Copy
              </button>
              <button 
                className="recipe-action-btn delete-btn"
                onClick={handleDelete}
                disabled={!selectedRecipe}
              >
                🗑 Delete
              </button>
              <button 
                className="recipe-action-btn create-btn"
                onClick={handleCreate}
              >
                + Create
              </button>
              <button
                className="recipe-action-btn export-btn"
                onClick={handleExport}
                disabled={!selectedRecipe}
              >
                ⬇ Export
              </button>
              <button
                className="recipe-action-btn import-btn"
                onClick={handleImportClick}
              >
                ⬆ Import
              </button>
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImport}
              />
            </div>
          </div>
        </div>

        {action === 'create' || action === 'copy' || action === 'edit' ? (
          <div className="recipe-editor">
            <h3>{action === 'create' ? 'Create New Recipe' : action === 'copy' ? 'Copy Recipe' : 'Edit Recipe'}</h3>
            <input
              type="text"
              value={newRecipeName}
              onChange={(e) => setNewRecipeName(e.target.value)}
              placeholder="Recipe name"
              className="recipe-input"
            />
            <textarea
              value={newRecipeDescription}
              onChange={(e) => setNewRecipeDescription(e.target.value)}
              placeholder="Recipe description / notes"
              className="recipe-textarea"
              rows="3"
            />
            <div className="editor-buttons">
              <button className="save-btn" onClick={handleSave}>Save</button>
              <button className="cancel-btn" onClick={() => setAction(null)}>Cancel</button>
            </div>
          </div>
        ) : null}

        <div className="recipe-footer">
          <button className="close-recipe-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
