import React, { useState, useEffect } from 'react';
import AxisPanel from './components/AxisPanel';
import ControlPanel from './components/ControlPanel';
import RecipeManager from './components/RecipeManager';
import RecipeParameters from './components/RecipeParameters';
import MachineParameters from './components/MachineParameters';
import SideSelector from './components/SideSelector';
import ProgramNameModal from './components/ProgramNameModal';
import ProgramCreationStep1 from './components/ProgramCreationStep1';
import ProgramCreationStep2 from './components/ProgramCreationStep2';
import ProgramCreationStep3 from './components/ProgramCreationStep3';
import GenericProgramStep from './components/GenericProgramStep';
import MessageModal from './components/MessageModal';
import AutoTeach from './components/AutoTeach';
import LoginModal from './components/LoginModal';
import EditProgramSideSelector from './components/EditProgramSideSelector';
import ProgramEditor from './components/ProgramEditor';
import DownloadProgramModal from './components/DownloadProgramModal';
import './styles/MainHMI.css';
import { readPLCVar, writePLCVar } from './services/plcApiService';

// Define step configurations
const STEP_CONFIG = {
  1: { name: 'Position Recording', description: 'Record starting position for both axes' },
  2: { name: 'Work Position', description: 'Position both axes at the desired work location' },
  3: { name: 'Expand/Retract Positions', description: 'Record expand and retract positions for both ID and OD' },
  4: { name: 'Step 4 Position', description: 'Record axis positions for step 4' },
  5: { name: 'Step 5 Position', description: 'Record axis positions for step 5' },
  6: { name: 'Step 6 Position', description: 'Record axis positions for step 6' },
  7: { name: 'Step 7 Position', description: 'Record axis positions for step 7' },
  8: { name: 'Step 8 Position', description: 'Record axis positions for step 8' },
  9: { name: 'Step 9 Position', description: 'Record axis positions for step 9' },
  10: { name: 'Final Position', description: 'Record final position for step 10' }
};

export default function MainHMI() {
  const [currentUser, setCurrentUser] = useState('operator');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeSideSelectorOpen, setRecipeSideSelectorOpen] = useState(false);
  const [recipeSide, setRecipeSide] = useState(null);
  const [axis1State, setAxis1State] = useState({ status: 'idle' });
  const [axis2State, setAxis2State] = useState({ status: 'idle' });
  const [axis3State, setAxis3State] = useState({ status: 'idle' });
  const [axis4State, setAxis4State] = useState({ status: 'idle' });
  const [jogMode, setJogMode] = useState(false);
  const [runMode, setRunMode] = useState(null);
  const [homedSides, setHomedSides] = useState({ right: false, left: false });
  const [showRunSideSelector, setShowRunSideSelector] = useState(false);
  const [showHomingSideSelector, setShowHomingSideSelector] = useState(false);
  const [machineCount, setMachineCount] = useState(0);
  const [actualPositions, setActualPositions] = useState({
    right: { axis1: 0, axis2: 0 }, // PLC tags: lAxis1ActPos, lAxis2ActPos
    left: { axis1: 0, axis2: 0 }   // PLC tags: lAxis3ActPos, lAxis4ActPos
  });
  const [sideStates, setSideStates] = useState({
    right: { state: 0, desc: 'Idle' },
    left: { state: 0, desc: 'Idle' }
  });

  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        // Replace with backend API calls
        const plcData = await readPLCVar();
        setActualPositions(plcData.actualPositions || { right: { axis1: 0, axis2: 0 }, left: { axis1: 0, axis2: 0 } });
        setSideStates(plcData.sideStates || { right: { state: 0, desc: 'Idle' }, left: { state: 0, desc: 'Idle' } });
      } catch (err) {
        console.warn('Actual position read failed:', err.message || err);
      }
    };
    poll();
    timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, []);

  // Program creation states
  const [showSideSelector, setShowSideSelector] = useState(false);
  const [selectedSide, setSelectedSide] = useState(null);
  const [showProgramNameModal, setShowProgramNameModal] = useState(false);
  const [currentProgram, setCurrentProgram] = useState(null);
  const [createdPrograms, setCreatedPrograms] = useState([]);
  const [programSteps, setProgramSteps] = useState({});

  const [recipesRight, setRecipesRight] = useState([
    { 
      name: 'Right_Recipe_A', 
      description: 'Recipe for part A on right side',
      parameters: { tubeID: 25.4, tubeOD: 31.75, finalSize: 30.0, sizeType: 'OD', tubeLength: 100, idFingerRadius: 2.5, depth: 50, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Right_Recipe_B', 
      description: 'Recipe for part B on right side',
      parameters: { tubeID: 20.0, tubeOD: 25.0, finalSize: 24.5, sizeType: 'OD', tubeLength: 150, idFingerRadius: 2.0, depth: 45, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Right_Assembly', 
      description: 'Assembly process for right side',
      parameters: { tubeID: 30.0, tubeOD: 38.0, finalSize: 29.5, sizeType: 'ID', tubeLength: 200, idFingerRadius: 3.0, depth: 60, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Right_Recipe_C', 
      description: 'Recipe for part C on right side',
      parameters: { tubeID: 22.0, tubeOD: 28.0, finalSize: 27.0, sizeType: 'OD', tubeLength: 120, idFingerRadius: 2.2, depth: 48, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Right_Recipe_D', 
      description: 'Recipe for part D on right side',
      parameters: { tubeID: 28.0, tubeOD: 35.0, finalSize: 34.0, sizeType: 'OD', tubeLength: 180, idFingerRadius: 2.8, depth: 55, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Right_Recipe_E', 
      description: 'Default recipe for right side (INDEX 5)',
      parameters: { tubeID: 25.0, tubeOD: 32.0, finalSize: 31.0, sizeType: 'OD', tubeLength: 110, idFingerRadius: 2.4, depth: 52, recipeSpeed: 100, stepDelay: 500 }
    }
  ]);

  const [recipesLeft, setRecipesLeft] = useState([
    { 
      name: 'Left_Recipe_A', 
      description: 'Recipe for part A on left side',
      parameters: { tubeID: 25.4, tubeOD: 31.75, finalSize: 30.0, sizeType: 'OD', tubeLength: 100, idFingerRadius: 2.5, depth: 50, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Left_Recipe_B', 
      description: 'Recipe for part B on left side',
      parameters: { tubeID: 20.0, tubeOD: 25.0, finalSize: 24.5, sizeType: 'OD', tubeLength: 150, idFingerRadius: 2.0, depth: 45, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Left_Assembly', 
      description: 'Assembly process for left side',
      parameters: { tubeID: 30.0, tubeOD: 38.0, finalSize: 29.5, sizeType: 'ID', tubeLength: 200, idFingerRadius: 3.0, depth: 60, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Left_Recipe_C', 
      description: 'Recipe for part C on left side',
      parameters: { tubeID: 22.0, tubeOD: 28.0, finalSize: 27.0, sizeType: 'OD', tubeLength: 120, idFingerRadius: 2.2, depth: 48, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Left_Recipe_D', 
      description: 'Recipe for part D on left side',
      parameters: { tubeID: 28.0, tubeOD: 35.0, finalSize: 34.0, sizeType: 'OD', tubeLength: 180, idFingerRadius: 2.8, depth: 55, recipeSpeed: 100, stepDelay: 500 }
    },
    { 
      name: 'Left_Recipe_E', 
      description: 'Default recipe for left side (INDEX 5)',
      parameters: { tubeID: 25.0, tubeOD: 32.0, finalSize: 31.0, sizeType: 'OD', tubeLength: 110, idFingerRadius: 2.4, depth: 52, recipeSpeed: 100, stepDelay: 500 }
    }
  ]);

  const [currentRecipe, setCurrentRecipe] = useState({
    right: 'Right_Recipe_E',
    left: 'Left_Recipe_E'
  });

  const [messageModal, setMessageModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const [parametersOpen, setParametersOpen] = useState(false);
  const [parametersSide, setParametersSide] = useState(null);
  const [currentParameters, setCurrentParameters] = useState(null);
  const [showParameterSideSelector, setShowParameterSideSelector] = useState(false);

  const [machineParametersOpen, setMachineParametersOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState({ step: 1, description: 'Ready to start' });

  const [showEnableSideSelector, setShowEnableSideSelector] = useState(false);
  const [enableActionSide, setEnableActionSide] = useState(null);
  const [enableJogMode, setEnableJogMode] = useState(false);

  const [showStartPosSideSelector, setShowStartPosSideSelector] = useState(false);

  const [autoTeachOpen, setAutoTeachOpen] = useState(false);
  const [autoTeachSide, setAutoTeachSide] = useState(null);
  const [autoTeachProgramName, setAutoTeachProgramName] = useState('');
  const [showAutoTeachSelector, setShowAutoTeachSelector] = useState(false);
  const [showAutoTeachNameModal, setShowAutoTeachNameModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);

  const [showEditProgramSideSelector, setShowEditProgramSideSelector] = useState(false);
  const [showProgramEditor, setShowProgramEditor] = useState(false);
  const [programToEdit, setProgramToEdit] = useState(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [programToDownload, setProgramToDownload] = useState(null);

  const handleAxisChange = (axisName, value, mode) => {
    console.log(`${axisName} changed to ${value} (${mode})`);
  };

  const handleAddProgram = () => {
    setShowSideSelector(true);
  };

  const handleUserLogin = (role) => {
    if (role) {
      setCurrentUser(role);
      setShowLoginModal(false);
      showMessage('Login Successful', `Logged in as ${role === 'operator' ? 'Operator' : role === 'setup' ? 'Setup' : 'Engineering'}`, 'success');
    }
  };

  const handleAutoTeach = () => {
    // Check role-based access
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators can only Home and Run the machine', 'warning');
      return;
    }
    setShowAutoTeachSelector(true);
  };

  const handleAutoTeachSelectSide = (side) => {
    setAutoTeachSide(side);
    setShowAutoTeachSelector(false);
    setShowAutoTeachNameModal(true);
  };

  const handleAutoTeachProgramNameConfirm = (programName) => {
    if (programName && programName.trim()) {
      setAutoTeachProgramName(programName.trim());
      setShowAutoTeachNameModal(false);
      // Open parameters first - Reset to default recipe at index 5
      setParametersSide(autoTeachSide);
      const recipes = autoTeachSide === 'right' ? recipesRight : recipesLeft;
      setCurrentParameters(recipes[5]?.parameters || { tubeID: 0, tubeOD: 0, finalSize: 0, sizeType: 'OD', tubeLength: 0, idFingerRadius: 0, depth: 0, recipeSpeed: 100, stepDelay: 500 });
      setParametersOpen(true);
    }
  };

  const handleSaveAutoTeachProgram = (programData) => {
    setCreatedPrograms([...createdPrograms, programData]);
    showMessage('Program Saved', `Auto-teach program "${programData.name}" saved successfully!`, 'success');
    setAutoTeachOpen(false);
    setAutoTeachSide(null);
    setAutoTeachProgramName('');
  };

  const handleOpenRecipe = () => {
    setRecipeSideSelectorOpen(true);
  };

  const handleSelectRecipeSide = (side) => {
    setRecipeSide(side);
    setRecipeSideSelectorOpen(false);
    setRecipeOpen(true);
  };

  const handleLoadRecipe = (recipe, side) => {
    const recipeName = typeof recipe === 'string' ? recipe : recipe.name;
    setCurrentRecipe(prev => ({
      ...prev,
      [side]: recipeName
    }));
    showMessage('Recipe Loaded', `Recipe "${recipeName}" loaded on ${side === 'right' ? 'Right' : 'Left'} side`, 'success');
    setRecipeOpen(false);
    setRecipeSide(null);
  };

  const handleCreateRecipe = (recipeName, recipeDescription, side) => {
    const newRecipe = {
      name: recipeName,
      description: recipeDescription,
      parameters: {
        tubeID: 0,
        tubeOD: 0,
        finalSize: 0,
        sizeType: 'OD',
        tubeLength: 0,
        idFingerRadius: 0,
        depth: 0,
        recipeSpeed: 100,
        stepDelay: 500
      }
    };
    
    if (side === 'right') {
      setRecipesRight([...recipesRight, newRecipe]);
    } else {
      setRecipesLeft([...recipesLeft, newRecipe]);
    }
    
    showMessage('Recipe Created', `Recipe "${recipeName}" created successfully`, 'success');
  };

  const handleEditRecipe = (oldRecipe, newName, newDescription, side) => {
    const updateRecipes = side === 'right' ? setRecipesRight : setRecipesLeft;
    const recipes = side === 'right' ? recipesRight : recipesLeft;
    
    const updatedRecipes = recipes.map(r => 
      r === oldRecipe ? { ...r, name: newName, description: newDescription } : r
    );
    
    updateRecipes(updatedRecipes);
    showMessage('Recipe Updated', `Recipe "${newName}" updated successfully`, 'success');
  };

  const handleDeleteRecipe = (recipe, side) => {
    const updateRecipes = side === 'right' ? setRecipesRight : setRecipesLeft;
    const recipes = side === 'right' ? recipesRight : recipesLeft;
    
    const filteredRecipes = recipes.filter(r => r !== recipe);
    updateRecipes(filteredRecipes);
    
    const recipeName = typeof recipe === 'string' ? recipe : recipe.name;
    showMessage('Recipe Deleted', `Recipe "${recipeName}" deleted successfully`, 'success');
  };

  const handleOpenParameters = () => {
    // Check role-based access
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot modify part parameters', 'warning');
      return;
    }
    setShowParameterSideSelector(true);
  };

  const handleParameterSideSelect = (side) => {
    setParametersSide(side);
    const recipes = side === 'right' ? recipesRight : recipesLeft;
    const currentRecipeName = currentRecipe[side];
    const recipe = recipes.find(r => r.name === currentRecipeName);
    setCurrentParameters(recipe?.parameters || { tubeID: 0, tubeOD: 0, finalSize: 0, sizeType: 'OD', tubeLength: 0, idFingerRadius: 0 });
    setShowParameterSideSelector(false);
    setParametersOpen(true);
  };

  const handleEnable = (side, action, jogModeEnabled = false) => {
    // Handle expand/reduce operations for each side with optional jog mode
    if (action === 'expand') {
      if (jogModeEnabled) {
        // TODO: Add PLC command to enable jog mode for the side
        // This integrates enable with jog mode activation
      }
      showMessage('Enable', `${side.toUpperCase()} side enabled${jogModeEnabled ? ' with Jog Mode' : ''}.`, 'info');
      // TODO: Add PLC command to enable/expand the specified side
    } else if (action === 'reduce') {
      showMessage('Enable', `${side.toUpperCase()} side disabled.`, 'info');
      // TODO: Add PLC command to reduce the specified side
    }
  };

  const handleSaveParameters = (params) => {
    if (parametersSide) {
      // If coming from AutoTeach flow
      if (autoTeachSide === parametersSide) {
        // Save parameters and proceed to teaching
        setCurrentParameters(params);
        setParametersOpen(false);
        setAutoTeachOpen(true);
        return;
      }
      
      // Normal parameter edit from Recipe Manager
      if (currentRecipe[parametersSide]) {
        const recipeName = currentRecipe[parametersSide];
        const updateRecipes = parametersSide === 'right' ? setRecipesRight : setRecipesLeft;
        const recipes = parametersSide === 'right' ? recipesRight : recipesLeft;
        
        const updatedRecipes = recipes.map(r => 
          r.name === recipeName ? { ...r, parameters: params } : r
        );
        
        updateRecipes(updatedRecipes);
        showMessage('Parameters Saved', `Parameters updated for recipe "${recipeName}"`, 'success');
      }
    }
  };

  const handleSelectSide = (side) => {
    setSelectedSide(side);
    setShowSideSelector(false);
    setShowProgramNameModal(true);
  };

  const handleProgramNameConfirm = (programName) => {
    setCurrentProgram({
      name: programName,
      side: selectedSide,
      createdAt: new Date().toISOString()
    });
    setShowProgramNameModal(false);
    setCurrentStep(1);
    setProgramSteps({});
  };

  const handleStepComplete = (stepData) => {
    const updatedSteps = { ...programSteps, [stepData.step]: stepData };
    setProgramSteps(updatedSteps);

    if (stepData.step === 10) {
      // Program complete - save all steps
      handleProgramComplete(updatedSteps);
    } else {
      // Move to next step
      setCurrentStep(stepData.step + 1);
    }
  };

  const handleStepPrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleProgramComplete = (allSteps) => {
    const completedProgram = {
      ...currentProgram,
      steps: allSteps,
      completedAt: new Date().toISOString()
    };

    setCreatedPrograms([...createdPrograms, completedProgram]);
    
    // Send to PLC
    console.log('Sending program to PLC:', completedProgram);
    sendProgramToPLC(completedProgram);

    showMessage('Program Complete', `Program "${currentProgram.name}" completed and saved!`, 'success');
    handleCancelProgram();
  };

  const showMessage = (title, message, type = 'info') => {
    setMessageModal({ isOpen: true, title, message, type });
  };

  const closeMessage = () => {
    setMessageModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const sendProgramToPLC = (programData) => {
    // This function prepares data for PLC integration
    const plcData = {
      programName: programData.name,
      side: programData.side === 'right' ? 0 : 1,
      steps: Object.keys(programData.steps).map(stepNum => {
        const step = programData.steps[stepNum];
        return {
          step: step.step,
          positions: step.positions,
          pattern: step.pattern
        };
      })
    };

    console.log('PLC Data structure:', plcData);
    // TODO: Send to Beckhoff TwinCAT via ADS
  };

  const handleCancelProgram = () => {
    setCurrentStep(0);
    setShowProgramNameModal(false);
    setShowSideSelector(false);
    setCurrentProgram(null);
    setSelectedSide(null);
    setProgramSteps({});
  };

  const handleEditProgram = () => {
    if (createdPrograms.length === 0) {
      showMessage('No Programs', 'No programs available to edit', 'warning');
      return;
    }
    setShowEditProgramSideSelector(true);
  };

  const handleSelectSideForEdit = (side) => {
    const sidePrograms = createdPrograms.filter(p => p.side === side);
    if (sidePrograms.length === 0) {
      // Fallback: use currently selected recipe to create a temporary program for editing
      const recipeName = currentRecipe[side];
      if (!recipeName) {
        showMessage('No Program', `No programs found for ${side} side. Please select a recipe first.`, 'warning');
        setShowEditProgramSideSelector(false);
        return;
      }
      const recipes = side === 'right' ? recipesRight : recipesLeft;
      const recipe = recipes.find(r => r.name === recipeName);
      const params = recipe?.parameters || { recipeSpeed: 100, stepDelay: 500 };

      const steps = {};
      for (let i = 1; i <= 10; i++) {
        steps[i] = {
          step: i,
          stepName: `Step ${i}`,
          positions: { axis1Cmd: 0, axis2Cmd: 0 },
          pattern: i === 1 ? 5 : 0,
          timestamp: new Date().toISOString()
        };
      }

      const tempProgram = {
        name: recipeName,
        side,
        steps,
        speed: params.recipeSpeed || 100,
        dwell: params.stepDelay || 500
      };

      setProgramToEdit(tempProgram);
      setShowProgramEditor(true);
      setShowEditProgramSideSelector(false);
      return;
    }
    
    if (sidePrograms.length === 1) {
      // Only one program for this side, edit it directly
      const program = sidePrograms[0];
      setProgramToEdit(program);
      setShowProgramEditor(true);
      setShowEditProgramSideSelector(false);
    } else {
      // Multiple programs, show selection prompt
      const programList = sidePrograms.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      const selection = prompt(`Select program to edit (enter number):\n\n${programList}`);
      if (selection && !isNaN(selection)) {
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < sidePrograms.length) {
          const program = sidePrograms[index];
          setProgramToEdit(program);
          setShowProgramEditor(true);
          setShowEditProgramSideSelector(false);
        }
      } else {
        setShowEditProgramSideSelector(false);
      }
    }
  };

  const handleSaveProgramChanges = (updatedProgram) => {
    // Update the program in createdPrograms array
    const updatedPrograms = createdPrograms.map(p => {
      if (p.name === updatedProgram.name && p.side === updatedProgram.side) {
        return updatedProgram;
      }
      return p;
    });
    
    setCreatedPrograms(updatedPrograms);
    showMessage('Program Updated', `Program "${updatedProgram.name}" has been updated successfully`, 'success');
    setShowProgramEditor(false);
    setProgramToEdit(null);
  };

  // Jog mode is now controlled via Enable Jog flow in ControlPanel

  const handleHomingSideSelect = async (side) => {
    try {
      await writePLCVar({ command: 'home', side });
      setHomedSides(prev => ({
        ...prev,
        [side]: true
      }));
      setShowHomingSideSelector(false);
      const sideText = side === 'both' ? 'both sides' : `${side} side`;
      showMessage('Homing Started', `Homing ${sideText}... Moving to start position`, 'info');
    } catch (error) {
      showMessage('Error', `Failed to send home command: ${error.message}`, 'error');
    }
  };

  const handleStartPosition = async (side) => {
    try {
      await writePLCVar({ command: 'startPosition', side });
      const sideText = side === 'left' ? 'left side' : 'right side';
      showMessage('Start Position', `Moving ${sideText} to start position`, 'info');
    } catch (error) {
      showMessage('Error', `Failed to send start position command: ${error.message}`, 'error');
    }
  };

  const handleEnableJogButton = async (side) => {
    try {
      if (currentUser === 'operator') {
        showMessage('Access Denied', 'Operators cannot jog the machine', 'warning');
        return;
      }
      await writePLCVar({ command: 'enableJog', side });
      const sideText = side === 'left' ? 'left side' : 'right side';
      showMessage('Jog Enabled', `Jog mode enabled for ${sideText}`, 'info');
    } catch (error) {
      showMessage('Error', `Failed to enable jog: ${error.message}`, 'error');
    }
  };

  const handleRunSideSelect = async (side) => {
    try {
      await writePLCVar({ command: 'run', side });
      setRunMode(side);
      setShowRunSideSelector(false);
      const sideText = side === 'both' ? 'both sides' : `${side} side`;
      showMessage('Run Mode Active', `Running program on ${sideText}`, 'success');
    } catch (error) {
      showMessage('Error', `Failed to send run command: ${error.message}`, 'error');
    }
  };

  return (
    <div className="main-hmi">
      <div className="hmi-header">
        <h1>UFM CNC ENDFORM</h1>
        <div className="header-right">
          <div className="shift-counts">
            <div className="shift-count-card">
              <div className="shift-label">Machine Count</div>
              <div className="shift-value">{machineCount}</div>
            </div>
          </div>
          <div className="user-info-section">
            <div className="user-display">
              <span className="user-icon">
                {currentUser === 'operator' ? '▶️' : currentUser === 'setup' ? '⚙️' : '🔧'}
              </span>
              <span className="user-role">
                {currentUser === 'operator' ? 'Operator' : currentUser === 'setup' ? 'Setup' : 'Engineering'}
              </span>
            </div>
            <button className="change-user-btn" onClick={() => setShowLoginModal(true)}>
              Change User
            </button>
          </div>
        </div>
      </div>

      <LoginModal 
        isOpen={showLoginModal} 
        onLogin={handleUserLogin}
        currentUser={null}
        onClose={() => setShowLoginModal(false)}
      />

      <div className="hmi-content">
        <div className="panels-container">
          <AxisPanel
            side="Right"
            axis1Name="Axis1 (ID)"
            axis2Name="Axis2 (OD)"
            onAxisChange={handleAxisChange}
            axis1State={axis1State}
            axis2State={axis2State}
            actualPositions={actualPositions.right}
            step={sideStates.right.state}
            stepDescription={sideStates.right.desc}
            recipe={currentRecipe.right}
            recipes={recipesRight}
            onRecipeChange={(recipe) => setCurrentRecipe(prev => ({ ...prev, right: recipe }))}
          />
          <AxisPanel
            side="Left"
            axis1Name="Axis3 (ID)"
            axis2Name="Axis4 (OD)"
            onAxisChange={handleAxisChange}
            axis1State={axis3State}
            axis2State={axis4State}
            actualPositions={actualPositions.left}
            step={sideStates.left.state}
            stepDescription={sideStates.left.desc}
            recipe={currentRecipe.left}
            recipes={recipesLeft}
            onRecipeChange={(recipe) => setCurrentRecipe(prev => ({ ...prev, left: recipe }))}
          />
        </div>
      </div>

      <div className="hmi-mode-controls">
        <div className="mode-button-group">
          <button 
            className="mode-control-btn homing-btn"
            onClick={() => setShowHomingSideSelector(true)}
            title="Select side(s) to home"
          >
            <span className="mode-icon">🏠</span>
            <span>HOMING</span>
          </button>

          <button 
            className="mode-control-btn enable-jog-btn"
            onClick={() => {
              if (currentUser === 'operator') {
                showMessage('Access Denied', 'Operators cannot jog the machine', 'warning');
                return;
              }
              setShowEnableSideSelector(true);
            }}
            disabled={currentUser === 'operator'}
            title={currentUser === 'operator' ? 'Operators cannot jog' : 'Enable jog mode for side'}
          >
            <span className="mode-icon">⟷</span>
            <span>ENABLE JOG</span>
          </button>

          <button 
            className={`mode-control-btn run-control ${runMode ? 'active' : ''}`}
            onClick={() => setShowRunSideSelector(true)}
            disabled={!(homedSides.right || homedSides.left)}
            title={homedSides.right || homedSides.left ? 'Select side(s) to run' : 'Must home at least one side first'}
          >
            <span className="mode-icon">▶</span>
            <span>RUN</span>
          </button>
        </div>
      </div>

      <div className="hmi-bottom">
        <ControlPanel
          onEditProgram={handleEditProgram}
          onParameters={handleOpenParameters}
          onAutoTeach={handleAutoTeach}
          onMachineParameters={() => setMachineParametersOpen(true)}
          onStartPosition={handleStartPosition}
          userRole={currentUser}
        />
      </div>
 
      <RecipeManager
        isOpen={recipeOpen}
        onClose={() => { setRecipeOpen(false); setRecipeSide(null); }}
        recipes={recipeSide === 'right' ? recipesRight : recipesLeft}
        side={recipeSide}
        onLoadRecipe={handleLoadRecipe}
        onCreateRecipe={handleCreateRecipe}
        onEditRecipe={handleEditRecipe}
        onDeleteRecipe={handleDeleteRecipe}
      />

      <MachineParameters
        isOpen={machineParametersOpen}
        onClose={() => setMachineParametersOpen(false)}
      />

      {showSideSelector && (
        <SideSelector
          onSelectSide={handleSelectSide}
          onCancel={handleCancelProgram}
        />
      )}

      {recipeSideSelectorOpen && (
        <SideSelector
          onSelectSide={handleSelectRecipeSide}
          onCancel={() => setRecipeSideSelectorOpen(false)}
          showBothOption={false}
        />
      )}

      {showParameterSideSelector && (
        <SideSelector
          onSelectSide={handleParameterSideSelect}
          onCancel={() => setShowParameterSideSelector(false)}
          title="Select Side for Part Parameters"
          showBothOption={false}
        />
      )}

      {showProgramNameModal && (
        <ProgramNameModal
          isOpen={showProgramNameModal}
          side={selectedSide}
          onConfirm={handleProgramNameConfirm}
          onCancel={handleCancelProgram}
        />
      )}

      {currentStep === 1 && currentProgram && (
        <ProgramCreationStep1
          programName={currentProgram.name}
          side={currentProgram.side}
          onPositionRecorded={handleStepComplete}
          onCancel={handleCancelProgram}
        />
      )}

      {currentStep === 2 && currentProgram && (
        <ProgramCreationStep2
          programName={currentProgram.name}
          side={currentProgram.side}
          onStepComplete={handleStepComplete}
          onCancel={handleCancelProgram}
          onPrevious={handleStepPrevious}
        />
      )}

      {currentStep === 3 && currentProgram && (
        <ProgramCreationStep3
          programName={currentProgram.name}
          side={currentProgram.side}
          onStepComplete={handleStepComplete}
          onCancel={handleCancelProgram}
          onPrevious={handleStepPrevious}
        />
      )}

      {currentStep >= 4 && currentStep <= 10 && currentProgram && (
        <GenericProgramStep
          programName={currentProgram.name}
          side={currentProgram.side}
          stepNumber={currentStep}
          stepName={STEP_CONFIG[currentStep].name}
          description={STEP_CONFIG[currentStep].description}
          onStepComplete={handleStepComplete}
          onCancel={handleCancelProgram}
          onPrevious={handleStepPrevious}
        />
      )}

      <MessageModal
        isOpen={messageModal.isOpen}
        title={messageModal.title}
        message={messageModal.message}
        type={messageModal.type}
        onClose={closeMessage}
      />

      <RecipeParameters
        isOpen={parametersOpen}
        onClose={() => setParametersOpen(false)}
        side={parametersSide}
        parameters={currentParameters}
        onSave={handleSaveParameters}
      />

      {showAutoTeachSelector && (
        <SideSelector
          onSelectSide={handleAutoTeachSelectSide}
          onCancel={() => setShowAutoTeachSelector(false)}
          title="Select Side for Auto Teach"
        />
      )}

      {showAutoTeachNameModal && (
        <ProgramNameModal
          isOpen={showAutoTeachNameModal}
          onConfirm={handleAutoTeachProgramNameConfirm}
          onCancel={() => {
            setShowAutoTeachNameModal(false);
            setAutoTeachSide(null);
          }}
          side={autoTeachSide}
        />
      )}



      {showHomingSideSelector && (
        <SideSelector
          onSelectSide={handleHomingSideSelect}
          onCancel={() => setShowHomingSideSelector(false)}
          title="Select Side(s) to Home"
        />
      )}

      {showEnableSideSelector && (
        <SideSelector
          onSelectSide={handleEnableJogButton}
          onCancel={() => setShowEnableSideSelector(false)}
          title="Select Side for Jog Mode"
          showBothOption={false}
        />
      )}

      {showEditProgramSideSelector && (
        <EditProgramSideSelector
          isOpen={showEditProgramSideSelector}
          onClose={() => setShowEditProgramSideSelector(false)}
          onSelectSide={handleSelectSideForEdit}
        />
      )}

      <ProgramEditor
        isOpen={showProgramEditor}
        onClose={() => {
          setShowProgramEditor(false);
          setProgramToEdit(null);
        }}
        program={programToEdit}
        onSaveProgram={handleSaveProgramChanges}
      />

      <DownloadProgramModal
        isOpen={showDownloadModal}
        program={programToDownload}
        onConfirm={async () => {
          if (!programToDownload) return;
          try {
            await writePLCVar({ command: 'downloadProgram', program: programToDownload });
            showMessage('Program Downloaded', `Program "${programToDownload.name}" downloaded to ${programToDownload.side} side`, 'success');
          } catch (e) {
            showMessage('Download Failed', `Failed to download program "${programToDownload.name}"`, 'error');
          }
          setShowDownloadModal(false);
          setProgramToDownload(null);
        }}
        onCancel={() => {
          setShowDownloadModal(false);
          setProgramToDownload(null);
        }}
      />

      {showRunSideSelector && (
        <SideSelector
          onSelectSide={handleRunSideSelect}
          onCancel={() => setShowRunSideSelector(false)}
          title="Select Side(s) to Run"
        />
      )}

      <AutoTeach
        isOpen={autoTeachOpen}
        onClose={() => {
          setAutoTeachOpen(false);
          setAutoTeachSide(null);
          setAutoTeachProgramName('');
        }}
        programName={autoTeachProgramName}
        side={autoTeachSide}
        actualPositions={autoTeachSide === 'right' ? actualPositions.right : actualPositions.left}
        parameters={currentParameters}
        onSaveProgram={handleSaveAutoTeachProgram}
      />
    </div>
  );
}
