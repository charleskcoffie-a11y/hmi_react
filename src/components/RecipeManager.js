import React, { useState, useRef, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import VirtualKeyboard from './VirtualKeyboard';
import '../styles/RecipeManager.css';
import '../styles/RecipeManagerSide.css';
import '../styles/RecipeTextarea.css';

export default function RecipeManager({ isOpen, onClose, recipes, side, onLoadRecipe, onCreateRecipe, onEditRecipe, onDeleteRecipe, onCopyToOtherSide, onTeachRecipe, userRole, editLockEnabled }) {
  const isOperator = userRole === 'operator';
  const isAdmin = userRole === 'admin';
  const isEditLocked = !editLockEnabled && !isAdmin; // Admin bypasses edit lock
  
  // State declarations first
  const [selectedRecipe, setSelectedRecipe] = useState(recipes && recipes.length > 5 ? recipes[5] : recipes?.[0] || null);
  const [selectedRecipes, setSelectedRecipes] = useState([]); // For multi-export
  const [searchInput, setSearchInput] = useState('');
  const [searchKeypadOpen, setSearchKeypadOpen] = useState(false);
  const [editorKeypadOpen, setEditorKeypadOpen] = useState(false);
  const [keypadField, setKeypadField] = useState(null); // 'name' or 'description'
  const [action, setAction] = useState(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');
  const [dialog, setDialog] = useState({ open: false, title: '', message: '', mode: 'info' });
  const [pendingDelete, setPendingDelete] = useState(null);

  // Ref for file input (import)
  const fileInputRef = useRef(null);
  const modalRef = useRef();
  
  // Log when recipes prop changes
  useEffect(() => {
    console.log('[RecipeManager] Recipes prop updated:', recipes?.length, 'recipes');
    console.log('[RecipeManager] Recipe names:', recipes?.map(r => r.name || r));
  }, [recipes]);
  
  // Effects after state declarations
  // Auto-close modal if isOpen becomes false (e.g., navigation)
  useEffect(() => {
    if (!isOpen) {
      setAction(null);
      setSelectedRecipe(null);
      setPendingDelete(null);
      setDialog({ open: false, title: '', message: '', mode: 'info' });
      setSearchKeypadOpen(false);
      setEditorKeypadOpen(false);
      setKeypadField(null);
    }
  }, [isOpen]);

  // Log dialog state changes
  useEffect(() => {
    console.log('[RecipeManager] Dialog state changed:', dialog);
  }, [dialog]);

  // Auto-close modal if user clicks outside the modal
  useEffect(() => {
    function handleClickOutside(event) {
      if (dialog.open) return;
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
  }, [isOpen, onClose, dialog.open]);

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

  // Validate selectedRecipe still exists after recipes update
  useEffect(() => {
    if (selectedRecipe && recipes && recipes.length > 0) {
      const selectedName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe?.name;
      const stillExists = recipes.some(r => {
        const name = typeof r === 'string' ? r : r?.name;
        return name === selectedName;
      });
      if (!stillExists) {
        // Recipe was deleted, select a new one
        setSelectedRecipe(recipes[0] || null);
      }
    }
  }, [recipes, selectedRecipe]);

  const handleLoad = () => {
    if (selectedRecipe) {
      if (isOperator || isEditLocked) return;
      console.log('Loading recipe:', selectedRecipe);
      onLoadRecipe && onLoadRecipe(selectedRecipe, side);
    }
  };

  const handleEdit = () => {
    if (selectedRecipe) {
      if (isOperator || isEditLocked) return;
      const recipeName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe.name;
      const recipeDesc = typeof selectedRecipe === 'object' ? selectedRecipe.description : '';
      setNewRecipeName(recipeName);
      setNewRecipeDescription(recipeDesc);
      setAction('edit');
    }
  };

  const handleCopy = () => {
    if (selectedRecipe) {
      if (isOperator || isEditLocked) return;
      const recipeName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe.name;
      const recipeDesc = typeof selectedRecipe === 'object' ? selectedRecipe.description : '';
      setNewRecipeName(`${recipeName} - Copy`);
      setNewRecipeDescription(recipeDesc);
      setAction('copy');
    }
  };

  const handleSave = () => {
    if (isOperator) return;
    if (newRecipeName.trim()) {
      if (action === 'create' || action === 'copy') {
        onCreateRecipe && onCreateRecipe(newRecipeName.trim(), newRecipeDescription.trim(), side, null, { autoLoad: false });
      } else if (action === 'edit') {
        onEditRecipe && onEditRecipe(selectedRecipe, newRecipeName.trim(), newRecipeDescription.trim(), side);
      }
      setAction(null);
      setNewRecipeName('');
      setNewRecipeDescription('');
      setEditorKeypadOpen(false);
      setKeypadField(null);
    }
  };

  const handleDelete = () => {
    if (selectedRecipe) {
      if (isOperator || isEditLocked) {
        return;
      }
      
      // Extract recipe name from selectedRecipe (could be string or object)
      const recipeName = typeof selectedRecipe === 'string' 
        ? selectedRecipe 
        : selectedRecipe?.name;
      setPendingDelete(recipeName);
      setDialog({
        open: true,
        title: 'Delete Recipe?',
        message: `Are you sure you want to delete "${recipeName}"?\n\nThis cannot be undone.`,
        mode: 'confirm'
      });
    }
  };

  const handleCreate = () => {
    if (isOperator) return;
    setAction('create');
    setNewRecipeName('');
    setNewRecipeDescription('');
    setKeypadField('name');
    setEditorKeypadOpen(true);
    setSearchKeypadOpen(false);
  };

  // Export selected recipe as JSON file
  const handleExport = () => {
    if (!selectedRecipe) return;
    if (!isAdmin) return;
    const recipeObj = typeof selectedRecipe === 'object' ? selectedRecipe : recipes.find(r => r.name === selectedRecipe);
    if (!recipeObj) return;
    const directSteps = recipeObj.steps;
    const programSteps = recipeObj.program?.steps;
    const hasDirectSteps = Array.isArray(directSteps)
      ? directSteps.length > 0
      : directSteps && Object.keys(directSteps).length > 0;
    const hasProgramSteps = Array.isArray(programSteps)
      ? programSteps.length > 0
      : programSteps && Object.keys(programSteps).length > 0;

    const exportRecipe = {
      ...recipeObj,
      steps: hasProgramSteps ? programSteps : hasDirectSteps ? directSteps : recipeObj.steps
    };

    const dataStr = JSON.stringify(exportRecipe, null, 2);
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

  // Export multiple selected recipes as JSON files
  const handleExportSelected = () => {
    if (selectedRecipes.length === 0 || !isAdmin) return;
    
    selectedRecipes.forEach((recipeName) => {
      const recipeObj = recipes.find(r => {
        const name = typeof r === 'string' ? r : r.name;
        return name === recipeName;
      });
      
      if (!recipeObj) return;
      
      const recipe = typeof recipeObj === 'object' ? recipeObj : { name: recipeObj };
      const directSteps = recipe.steps;
      const programSteps = recipe.program?.steps;
      const hasDirectSteps = Array.isArray(directSteps)
        ? directSteps.length > 0
        : directSteps && Object.keys(directSteps).length > 0;
      const hasProgramSteps = Array.isArray(programSteps)
        ? programSteps.length > 0
        : programSteps && Object.keys(programSteps).length > 0;

      const exportRecipe = {
        ...recipe,
        steps: hasProgramSteps ? programSteps : hasDirectSteps ? directSteps : recipe.steps
      };

      const dataStr = JSON.stringify(exportRecipe, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recipe.name || 'recipe'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Small delay between downloads to avoid browser blocking
      if (selectedRecipes.length > 1) {
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        delay(100);
      }
    });
    
    setDialog({ 
      open: true, 
      title: 'Export Successful', 
      message: `Exported ${selectedRecipes.length} recipe${selectedRecipes.length > 1 ? 's' : ''} successfully.`, 
      mode: 'info' 
    });
  };

  // Toggle recipe selection for multi-export
  const toggleRecipeSelection = (recipeName) => {
    setSelectedRecipes(prev => {
      if (prev.includes(recipeName)) {
        return prev.filter(name => name !== recipeName);
      } else {
        return [...prev, recipeName];
      }
    });
  };

  // Trigger file input for import
  const handleImportClick = () => {
    if (!isAdmin) return;
    if (fileInputRef.current) fileInputRef.current.value = null;
    fileInputRef.current?.click();
  };

  // Import multiple recipes from JSON files
  const handleImport = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const processFile = (file, index) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
      try {
        const importedRecipe = JSON.parse(event.target.result);
        
        // Validate basic structure
        if (!importedRecipe.name) {
          setDialog({ open: true, title: 'Invalid Recipe', message: 'Recipe file is missing a name.', mode: 'info' });
          return;
        }
        
        const directSteps = importedRecipe.steps;
        const programSteps = importedRecipe.program?.steps;
        const hasDirectSteps = Array.isArray(directSteps)
          ? directSteps.length > 0
          : directSteps && Object.keys(directSteps).length > 0;
        const hasProgramSteps = Array.isArray(programSteps)
          ? programSteps.length > 0
          : programSteps && Object.keys(programSteps).length > 0;

        const steps = hasProgramSteps
          ? programSteps
          : hasDirectSteps
            ? directSteps
            : {};

        const program = importedRecipe.program
          ? { ...importedRecipe.program, steps }
          : undefined;

        // Create complete recipe object with all properties
        const completeRecipe = {
          name: importedRecipe.name,
          description: importedRecipe.description || '',
          side: side, // Use current side
          parameters: importedRecipe.parameters || {
            tubeID: 0,
            tubeOD: 0,
            finalSize: 0,
            sizeType: 'OD',
            tubeLength: 0,
            idFingerRadius: 0,
            depth: 0,
            recipeSpeed: 100,
            stepDelay: 500
          },
          steps,
          program,
          speed: importedRecipe.speed,
          dwell: importedRecipe.dwell,
          createdAt: importedRecipe.createdAt || new Date().toISOString()
        };
        
        // Call onCreateRecipe with the complete recipe object
        // This will require the parent to handle full recipe import
        if (onCreateRecipe) {
          // Pass complete recipe as 4th parameter for import
          onCreateRecipe(completeRecipe.name, completeRecipe.description, side, completeRecipe);
        }
        
          setSelectedRecipe(completeRecipe);
          setAction(null);
          successCount++;
          resolve({ success: true, name: completeRecipe.name });
        } catch (err) {
          errorCount++;
          errors.push({ file: file.name, error: err.message });
          resolve({ success: false, file: file.name });
        }
      };
      reader.onerror = () => {
        errorCount++;
        errors.push({ file: file.name, error: 'Failed to read file' });
        resolve({ success: false, file: file.name });
      };
      reader.readAsText(file);
      });
    };
    
    // Process all files
    Promise.all(files.map((file, index) => processFile(file, index)))
      .then((results) => {
        // Show summary dialog
        if (successCount > 0 && errorCount === 0) {
          setDialog({ 
            open: true, 
            title: 'Import Successful', 
            message: `Successfully imported ${successCount} recipe${successCount > 1 ? 's' : ''}.`, 
            mode: 'info' 
          });
        } else if (successCount > 0 && errorCount > 0) {
          setDialog({ 
            open: true, 
            title: 'Partial Import', 
            message: `Imported ${successCount} recipe${successCount > 1 ? 's' : ''}.\n${errorCount} file${errorCount > 1 ? 's' : ''} failed.`, 
            mode: 'info' 
          });
        } else {
          setDialog({ 
            open: true, 
            title: 'Import Failed', 
            message: `Failed to import ${errorCount} file${errorCount > 1 ? 's' : ''}. Please check the file format.`, 
            mode: 'info' 
          });
        }
      });
  };

  const handleKeypadInput = (value) => {
    if (keypadField === 'name') {
      if (value.length <= 32) {
        setNewRecipeName(value);
      }
    } else if (keypadField === 'description') {
      setNewRecipeDescription(value);
    }
  };

  const handleKeypadBackspace = (value) => {
    if (keypadField === 'name') {
      setNewRecipeName(value);
    } else if (keypadField === 'description') {
      setNewRecipeDescription(value);
    }
  };

  const handleKeypadEnter = () => {
    if (keypadField === 'name' && newRecipeName.trim().length >= 3) {
      setKeypadField('description');
      // Keep keypad open for description input
    } else if (keypadField === 'description') {
      setEditorKeypadOpen(false);
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
                onFocus={() => {
                  setSearchKeypadOpen(true);
                  setEditorKeypadOpen(false);
                }}
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
            
            {searchKeypadOpen && (
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
            
            {selectedRecipes.length > 0 && (
              <div className="recipe-select-controls">
                <span className="selection-count">
                  {selectedRecipes.length} recipe{selectedRecipes.length > 1 ? 's' : ''} selected
                </span>
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
                  const selectedName = typeof selectedRecipe === 'string' ? selectedRecipe : selectedRecipe?.name;
                  const isSelected = recipeName === selectedName;
                  const isChecked = selectedRecipes.includes(recipeName);
                  return (
                    <div
                      key={recipeName || index}
                      className={`recipe-item ${isSelected ? 'selected' : ''} ${isChecked ? 'checked' : ''}`}
                    >
                      <div 
                        className="recipe-item-header"
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setSearchKeypadOpen(false);
                        }}
                      >
                        <input
                          type="checkbox"
                          className="recipe-checkbox"
                          checked={isChecked}
                          disabled={!isAdmin}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRecipeSelection(recipeName);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
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
                disabled={!selectedRecipe || isOperator || isEditLocked}
                title={
                  isEditLocked 
                    ? 'Enable edit lock switch to modify programs' 
                    : isOperator 
                      ? 'Operators cannot change recipes' 
                      : 'Load selected recipe'
                }
              >
                ↓ Load
              </button>
              <button 
                className="recipe-action-btn edit-btn"
                onClick={handleEdit}
                disabled={!selectedRecipe || isOperator || isEditLocked}
                title={
                  isEditLocked 
                    ? 'Enable edit lock switch to modify programs' 
                    : isOperator 
                      ? 'Operators cannot edit recipes' 
                      : 'Edit recipe name/description'
                }
              >
                ✎ Edit
              </button>
              <button 
                className="recipe-action-btn copy-btn"
                onClick={handleCopy}
                disabled={!selectedRecipe || isOperator || isEditLocked}
                title={
                  isEditLocked 
                    ? 'Enable edit lock switch to modify programs' 
                    : isOperator 
                      ? 'Operators cannot copy recipes' 
                      : 'Copy recipe'
                }
              >
                ⧉ Copy
              </button>
              <button 
                className="recipe-action-btn delete-btn"
                onClick={handleDelete}
                disabled={!selectedRecipe || isOperator || isEditLocked}
                title={
                  isEditLocked 
                    ? 'Enable edit lock switch to modify programs' 
                    : isOperator 
                      ? 'Operators cannot delete recipes' 
                      : 'Delete recipe'
                }
              >
                🗑 Delete
              </button>
              <button 
                className="recipe-action-btn cross-copy-btn"
                onClick={() => {
                  if (selectedRecipe && onCopyToOtherSide) {
                    const otherSide = side === 'right' ? 'left' : 'right';
                    onCopyToOtherSide(selectedRecipe, side);
                  }
                }}
                disabled={!selectedRecipe || isOperator || isEditLocked}
                title={
                  isEditLocked 
                    ? 'Enable edit lock switch to modify programs' 
                    : isOperator 
                      ? 'Operators cannot copy recipes' 
                      : `Copy to ${side === 'right' ? 'Left' : 'Right'} side`
                }
              >
                {side === 'right' ? '← Copy to Left' : 'Copy to Right →'}
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
                disabled={!selectedRecipe || !isAdmin}
                title={!isAdmin ? 'Only Admin can export recipes' : 'Export recipe'}
              >
                ⬇ Export
              </button>
              <button
                className="recipe-action-btn import-btn"
                onClick={handleImportClick}
                disabled={!isAdmin}
                title={!isAdmin ? 'Only Admin can import recipes' : 'Import recipe'}
              >
                ⬆ Import
              </button>
              <button
                className="recipe-action-btn export-selected-btn"
                onClick={handleExportSelected}
                disabled={selectedRecipes.length === 0 || !isAdmin}
                title={!isAdmin ? 'Only Admin can export recipes' : selectedRecipes.length === 0 ? 'Select recipes to export' : `Export ${selectedRecipes.length} selected recipe${selectedRecipes.length > 1 ? 's' : ''}`}
              >
                ⬇ Export {selectedRecipes.length > 0 ? `(${selectedRecipes.length})` : 'Selected'}
              </button>
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImport}
                multiple
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
              onClick={() => {
                setKeypadField('name');
                setEditorKeypadOpen(true);
                setSearchKeypadOpen(false);
              }}
              onFocus={() => {
                setKeypadField('name');
                setEditorKeypadOpen(true);
                setSearchKeypadOpen(false);
              }}
              placeholder="Recipe name"
              className="recipe-input"
            />
            <textarea
              value={newRecipeDescription}
              onChange={(e) => setNewRecipeDescription(e.target.value)}
              onClick={() => {
                setKeypadField('description');
                setEditorKeypadOpen(true);
                setSearchKeypadOpen(false);
              }}
              onFocus={() => {
                setKeypadField('description');
                setEditorKeypadOpen(true);
                setSearchKeypadOpen(false);
              }}
              placeholder="Recipe description / notes"
              className="recipe-textarea"
              rows="3"
            />
            {editorKeypadOpen && (
              <VirtualKeyboard
                value={keypadField === 'name' ? newRecipeName : newRecipeDescription}
                onInput={handleKeypadInput}
                onBackspace={handleKeypadBackspace}
                onEnter={handleKeypadEnter}
              />
            )}
            <div className="editor-buttons">
              <button className="save-btn" onClick={handleSave}>Save</button>
              <button className="cancel-btn" onClick={() => {
                setAction(null);
                setEditorKeypadOpen(false);
                setKeypadField(null);
              }}>Cancel</button>
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
          setPendingDelete(null);
          setDialog({ open: false, title: '', message: '', mode: 'info' });
        }}
        width="450px"
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {dialog.mode === 'confirm' && (
            <>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px',
                color: '#ff6b35'
              }}>
                🗑
              </div>
              <p style={{
                fontSize: '16px',
                color: '#333',
                marginBottom: '24px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5'
              }}>
                {dialog.message}
              </p>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => {
                    setPendingDelete(null);
                    setDialog({ open: false, title: '', message: '', mode: 'info' });
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    backgroundColor: '#e0e0e0',
                    color: '#333',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#d0d0d0'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#e0e0e0'}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (pendingDelete) {
                        if (onDeleteRecipe) {
                          await onDeleteRecipe(pendingDelete, side);
                        } else {
                          console.error('[RecipeManager] onDeleteRecipe is not a function!');
                        }
                        setSelectedRecipe((prev) => {
                          const prevName = typeof prev === 'string' ? prev : prev?.name;
                          return prevName === pendingDelete ? null : prev;
                        });
                        setPendingDelete(null);
                      } else {
                        console.warn('[RecipeManager] pendingDelete is null/empty!');
                      }
                      setDialog({ open: false, title: '', message: '', mode: 'info' });
                    } catch (err) {
                      console.error('[RecipeManager] ERROR in delete button onClick:', err);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    backgroundColor: '#ff6b35',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#e55a1f'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#ff6b35'}
                >
                  Delete
                </button>
              </div>
            </>
          )}
          {dialog.mode !== 'confirm' && (
            <p style={{ fontSize: '16px', color: '#333' }}>{dialog.message}</p>
          )}
        </div>
      </ModernDialog>
    </div>
  );
}
