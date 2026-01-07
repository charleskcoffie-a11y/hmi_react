import React, { useState, useRef, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import '../styles/RecipeManager.css';
import '../styles/RecipeManagerSide.css';
import '../styles/RecipeTextarea.css';

export default function RecipeManager({ isOpen, onClose, recipes, side, onLoadRecipe, onCreateRecipe, onEditRecipe, onDeleteRecipe, userRole }) {
  const isOperator = userRole === 'operator';
    // Auto-close modal if isOpen becomes false (e.g., navigation)
    useEffect(() => {
      if (!isOpen) {
        setAction(null);
        setSelectedRecipe(null);
      }
    }, [isOpen]);

    // Auto-close modal if user clicks outside the modal
    const modalRef = useRef();
    useEffect(() => {
      function handleClickOutside(event) {
        if (modalRef.current && !modalRef.current.contains(event.target)) {
          onClose();
        }
      }
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen, onClose]);

    // Close modal with ESC key
    useEffect(() => {
      function handleEscKey(event) {
        if (event.key === 'Escape' && isOpen) {
          onClose();
        }
      }
      if (isOpen) {
        document.addEventListener('keydown', handleEscKey);
      }
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }, [isOpen, onClose]);

  const [selectedRecipe, setSelectedRecipe] = useState(recipes && recipes.length > 5 ? recipes[5] : recipes?.[0] || null);
  const [searchInput, setSearchInput] = useState('');
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');
  const [dialog, setDialog] = useState({ open: false, title: '', message: '', mode: 'info' });
  const [pendingDelete, setPendingDelete] = useState(null);

  // Ref for file input (import)
  const fileInputRef = useRef(null);

  const handleLoad = () => {
    if (selectedRecipe) {
      if (isOperator) return;
      console.log('Loading recipe:', selectedRecipe);
      onLoadRecipe && onLoadRecipe(selectedRecipe, side);
    }
  };

  const handleEdit = () => {
    if (selectedRecipe) {
      if (isOperator) return;
      const recipeName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe.name;
      const recipeDesc = typeof selectedRecipe === 'object' ? selectedRecipe.description : '';
      setNewRecipeName(recipeName);
      setNewRecipeDescription(recipeDesc);
      setAction('edit');
    }
  };

  const handleCopy = () => {
    if (selectedRecipe) {
      if (isOperator) return;
      const recipeName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe.name;
      const recipeDesc = typeof selectedRecipe === 'object' ? selectedRecipe.description : '';
      setNewRecipeName(`${recipeName} - Copy`);
      setNewRecipeDescription(recipeDesc);
      setAction('copy');
    }
  };

  const handleDelete = () => {
    if (selectedRecipe) {
      if (isOperator) return;
      setPendingDelete(selectedRecipe);
      setDialog({
        open: true,
        title: 'Delete Recipe?',
        message: `Are you sure you want to delete "${selectedRecipe}"? This cannot be undone.`,
        mode: 'confirm'
      });
    }
  };

  const handleCreate = () => {
    if (isOperator) return;
    setAction('create');
    setNewRecipeName('');
    setNewRecipeDescription('');
  };

  // Export selected recipe as JSON file
  const handleExport = () => {
    if (!selectedRecipe) return;
    if (isOperator) return;
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
    if (isOperator) return;
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
        setDialog({ open: true, title: 'Invalid Recipe', message: 'The selected file is not a valid recipe file.', mode: 'info' });
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    if (isOperator) return;
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
    <div className="recipe-modal-overlay">
      <div className="recipe-modal" ref={modalRef}>
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
            <div className="recipe-search-row">
              <input
                type="text"
                className="recipe-search-input"
                placeholder="Search recipes by name..."
                value={searchInput}
                onFocus={() => setKeypadOpen(true)}
                readOnly
              />
              <button 
                className="search-clear-btn"
                onClick={() => setSearchInput('')}
                style={{ display: searchInput ? 'block' : 'none' }}
              >
                ✕
              </button>
            </div>
            
            {keypadOpen && (
              <div className="recipe-keypad-container">
                <div className="recipe-simple-keypad">
                  <div className="recipe-keypad-row">
                    {['1','2','3','4','5','6','7','8','9','0'].map((ch) => (
                      <button key={ch} className="recipe-key" onClick={() => setSearchInput(searchInput + ch)}>{ch}</button>
                    ))}
                  </div>
                  <div className="recipe-keypad-row">
                    {['Q','W','E','R','T','Y','U','I','O','P'].map((ch) => (
                      <button key={ch} className="recipe-key" onClick={() => setSearchInput(searchInput + ch)}>{ch}</button>
                    ))}
                  </div>
                  <div className="recipe-keypad-row">
                    {['A','S','D','F','G','H','J','K','L'].map((ch) => (
                      <button key={ch} className="recipe-key" onClick={() => setSearchInput(searchInput + ch)}>{ch}</button>
                    ))}
                    <button
                      className="recipe-key recipe-backspace"
                      onClick={() => setSearchInput(searchInput.slice(0, -1))}
                    >
                      ← Back
                    </button>
                  </div>
                  <div className="recipe-keypad-row">
                    {['Z','X','C','V','B','N','M'].map((ch) => (
                      <button key={ch} className="recipe-key" onClick={() => setSearchInput(searchInput + ch)}>{ch}</button>
                    ))}
                    {['-','_',' '].map((ch) => (
                      <button key={ch === ' ' ? 'space' : ch} className="recipe-key" onClick={() => setSearchInput(searchInput + ch)}>
                        {ch === ' ' ? 'Space' : ch}
                      </button>
                    ))}
                    <button
                      className="recipe-key recipe-clear"
                      onClick={() => setSearchInput('')}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="recipe-listbox">
              {recipes && recipes.length > 0 ? (
                (recipes.filter((r) => {
                  const name = typeof r === 'string' ? r : r.name;
                  return !searchInput || (name && name.toLowerCase().includes(searchInput.toLowerCase()));
                })).map((recipe, index) => {
                  const recipeName = typeof recipe === 'string' ? recipe : recipe.name;
                  const recipeDesc = typeof recipe === 'object' ? recipe.description : '';
                  return (
                    <div
                      key={index}
                      className={`recipe-item ${selectedRecipe === recipe ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedRecipe(recipe);
                        setKeypadOpen(false);
                      }}
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
                disabled={!selectedRecipe || isOperator}
                title={isOperator ? 'Operators cannot change recipes' : 'Load selected recipe'}
              >
                ↓ Load
              </button>
              <button 
                className="recipe-action-btn edit-btn"
                onClick={handleEdit}
                disabled={!selectedRecipe || isOperator}
                title={isOperator ? 'Operators cannot edit recipes' : 'Edit recipe name/description'}
              >
                ✎ Edit
              </button>
              <button 
                className="recipe-action-btn copy-btn"
                onClick={handleCopy}
                disabled={!selectedRecipe || isOperator}
                title={isOperator ? 'Operators cannot copy recipes' : 'Copy recipe'}
              >
                ⧉ Copy
              </button>
              <button 
                className="recipe-action-btn delete-btn"
                onClick={handleDelete}
                disabled={!selectedRecipe || isOperator}
                title={isOperator ? 'Operators cannot delete recipes' : 'Delete recipe'}
              >
                🗑 Delete
              </button>
              <button 
                className="recipe-action-btn create-btn"
                onClick={handleCreate}
                disabled={isOperator}
                title={isOperator ? 'Operators cannot create recipes' : 'Create recipe'}
              >
                + Create
              </button>
              <button
                className="recipe-action-btn export-btn"
                onClick={handleExport}
                disabled={!selectedRecipe || isOperator}
                title={isOperator ? 'Operators cannot export recipes' : 'Export recipe'}
              >
                ⬇ Export
              </button>
              <button
                className="recipe-action-btn import-btn"
                onClick={handleImportClick}
                disabled={isOperator}
                title={isOperator ? 'Operators cannot import recipes' : 'Import recipe'}
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

      <ModernDialog
        isOpen={dialog.open}
        title={dialog.title}
        onClose={() => {
          // Don't delete on close - only delete when user clicks Delete button
          setPendingDelete(null);
          setDialog({ open: false, title: '', message: '', mode: 'info' });
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span>{dialog.message}</span>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {dialog.mode === 'confirm' && (
              <button
                onClick={() => {
                  if (pendingDelete) {
                    onDeleteRecipe && onDeleteRecipe(pendingDelete, side);
                    setSelectedRecipe((prev) => (prev === pendingDelete ? null : prev));
                    setPendingDelete(null);
                  }
                  setDialog({ open: false, title: '', message: '', mode: 'info' });
                }}
              >
                Delete
              </button>
            )}
            <button onClick={() => setDialog({ open: false, title: '', message: '', mode: 'info' })}>
              {dialog.mode === 'confirm' ? 'Cancel' : 'Close'}
            </button>
          </div>
        </div>
      </ModernDialog>
    </div>
  );
}
