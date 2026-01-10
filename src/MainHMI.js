import React, { useState, useEffect } from 'react';
import AxisPanel from './components/AxisPanel';
import ModernDialog from './components/ModernDialog';
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
import AutoAdjustProgram from './components/AutoAdjustProgram';
import DownloadProgramModal from './components/DownloadProgramModal';
import DebugPanel from './components/DebugPanel';
import DigitalIOPage from './components/DigitalIOPage';
import './styles/MainHMI.css';
import { readPLCVar, writePLCVar, readAxisPositions, pulseBoolTag } from './services/plcApiService';
import { saveRecipeToFile, loadRecipesFromFolder, deleteRecipeFile } from './services/recipeService';
import { initializeBackendNetId } from './services/netIdService';

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

// Alarm bit mapping (GVL_GAXIS.AlarmSystem bitfield)
const ALARM_MAP = [
  { bit: 0, message: 'Oil level Low', severity: 'warning' },
  { bit: 1, message: 'Oil Temp High', severity: 'warning' },
  { bit: 2, message: 'Estop Open', severity: 'critical' },
  { bit: 3, message: 'Gate Open', severity: 'critical' },
  { bit: 4, message: 'Pump Motor Tripped', severity: 'critical' },
  { bit: 5, message: 'Radiator Motor Tripped', severity: 'warning' },
  { bit: 6, message: 'Pump Not Running', severity: 'warning' },
  { bit: 7, message: 'Right Head ID Error', severity: 'critical' },
  { bit: 8, message: 'Right Head OD Error', severity: 'critical' },
  { bit: 9, message: 'Left Head ID Error', severity: 'critical' },
  { bit: 10, message: 'Left Head OD Error', severity: 'critical' },
  { bit: 11, message: 'Pump idle time', severity: 'warning' },
  { bit: 12, message: 'High Pressure Low', severity: 'warning' },
  { bit: 13, message: 'Low Air Pressure', severity: 'warning' },
  { bit: 14, message: 'Lube fault', severity: 'warning' }
];

// Machine status bit mapping (GVL_GAXIS.MachineStatus bitfield)
const MACHINE_STATUS_MAP = [
  { bit: 0, label: 'Pump Running', color: '#2196F3' },
  { bit: 1, label: 'Right Homing', color: '#FF9800' },
  { bit: 2, label: 'Left Homing', color: '#FF9800' },
  { bit: 3, label: 'RunMove', color: '#00c853' },
  { bit: 4, label: 'JogMove', color: '#9C27B0' },
  { bit: 5, label: 'Right at Start', color: '#4CAF50' },
  { bit: 6, label: 'Left at Start', color: '#4CAF50' },
  { bit: 7, label: 'Right not at Start', color: '#FFC107' },
  { bit: 8, label: 'Left not At Start', color: '#FFC107' },
  { bit: 9, label: 'Right Head Active', color: '#00BCD4' },
  { bit: 10, label: 'Left Head Active', color: '#00BCD4' }
];

function decodeAlarmBits(bits) {
  const active = [];
  ALARM_MAP.forEach(def => {
    if (bits & (1 << def.bit)) {
      active.push({ bit: def.bit, message: def.message, severity: def.severity || 'warning' });
    }
  });

  for (let i = 0; i < 32; i += 1) {
    const mask = 1 << i;
    const alreadyMapped = ALARM_MAP.some(def => def.bit === i);
    if (!alreadyMapped && (bits & mask)) {
      active.push({ bit: i, message: `Alarm bit ${i} active`, severity: 'warning' });
    }
  }
  return active;
}

function decodeMachineStatus(bits) {
  const active = [];
  MACHINE_STATUS_MAP.forEach(def => {
    if (bits & (1 << def.bit)) {
      active.push({ bit: def.bit, label: def.label, color: def.color });
    }
  });
  return active;
}

export default function MainHMI() {
  const [currentUser, setCurrentUser] = useState('operator');
  const [userPasswords, setUserPasswords] = useState({
    operator: '1234',
    setup: '5678',
    engineering: '9999'
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeSideSelectorOpen, setRecipeSideSelectorOpen] = useState(false);
  const [recipeSide, setRecipeSide] = useState(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [ioPageOpen, setIoPageOpen] = useState(false);
  const [axis1State] = useState({ status: 'idle' });
  const [axis2State] = useState({ status: 'idle' });
  const [axis3State] = useState({ status: 'idle' });
  const [axis4State] = useState({ status: 'idle' });
  const [runMode, setRunMode] = useState(null);
  const [homedSides, setHomedSides] = useState({ right: false, left: false });
  const [showRunSideSelector, setShowRunSideSelector] = useState(false);
  const [showHomingSideSelector, setShowHomingSideSelector] = useState(false);
  const [machineCount, setMachineCount] = useState(0);
  const [unitSystem, setUnitSystem] = useState('mm');
  const [actualPositions, setActualPositions] = useState({
    right: { axis1: 0, axis2: 0 }, // PLC tags: lAxis1ActPos, lAxis2ActPos
    left: { axis1: 0, axis2: 0 }   // PLC tags: lAxis3ActPos, lAxis4ActPos
  });
  const [plcDirty, setPlcDirty] = useState({ right: false, left: false });
  const [sideStates, setSideStates] = useState({
    right: { state: 0, desc: 'Idle' },
    left: { state: 0, desc: 'Idle' }
  });

  const [rightStepDisplay, setRightStepDisplay] = useState({
    stepNumber: 1,
    stepDescription: 'Idle'
  });

  const [leftStepDisplay, setLeftStepDisplay] = useState({
    stepNumber: 1,
    stepDescription: 'Idle'
  });

  // Mode feedback states from PLC (read-only feedback)
  const [modeFeedback, setModeFeedback] = useState({
    right: {
      runMode: false,
      jogMode: false
    },
    left: {
      runMode: false,
      jogMode: false
    }
  });

  // Alarm system (bitfield from PLC)
  const [alarmBits, setAlarmBits] = useState(0);
  const [alarms, setAlarms] = useState([]);
  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState([]);
  const [alarmBannerVisible, setAlarmBannerVisible] = useState(true);
  const [alarmBannerTimeout, setAlarmBannerTimeout] = useState(null);

  // Machine status system (bitfield from PLC)
  const [machineStatusBits, setMachineStatusBits] = useState(0);
  const [machineStatus, setMachineStatus] = useState([]);

  const [plcStatus, setPlcStatus] = useState('unknown');
  
  // Handle alarm acknowledgment with auto-reshow after 5 seconds
  const handleAcknowledgeAlarm = () => {
    setAcknowledgedAlarms(alarms.map(a => a.bit));
    setAlarmBannerVisible(false);
    
    // Clear any existing timeout
    if (alarmBannerTimeout) {
      clearTimeout(alarmBannerTimeout);
    }
    
    // Set new timeout to reshow banner after 5 seconds
    const newTimeout = setTimeout(() => {
      setAlarmBannerVisible(true);
    }, 5000);
    
    setAlarmBannerTimeout(newTimeout);
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (alarmBannerTimeout) {
        clearTimeout(alarmBannerTimeout);
      }
    };
  }, [alarmBannerTimeout]);
  // Initialize backend with saved Net ID on mount
  useEffect(() => {
    initializeBackendNetId();
  }, []);
  
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        // Read axis positions from PLC
        const data = await readAxisPositions();
        setActualPositions(data.actualPositions || { right: { axis1: 0, axis2: 0 }, left: { axis1: 0, axis2: 0 } });
        setPlcStatus(data.connected ? 'good' : 'bad');
        
        // Read machine count from PLC
        try {
          const countResponse = await fetch('http://localhost:3001/read?tag=GPersistent.dABSMachineCount');
          if (countResponse.ok) {
            const countData = await countResponse.json();
            console.log('[MainHMI] Machine count response:', countData);
            if (countData.success) {
              // DINT is a 32-bit signed integer - handle various response formats
              let count = 0;
              if (typeof countData.value === 'number') {
                count = countData.value;
              } else if (countData.value && typeof countData.value === 'object') {
                // Handle object responses (ads-client sometimes wraps values)
                if ('value' in countData.value) {
                  count = countData.value.value;
                } else if ('low' in countData.value) {
                  count = countData.value.low || 0;
                } else {
                  // Try to extract first numeric value from object
                  count = Object.values(countData.value).find(v => typeof v === 'number') || 0;
                }
              }
              const finalCount = Math.floor(Math.max(0, count)); // Ensure non-negative
              console.log('[MainHMI] Setting machine count to:', finalCount);
              setMachineCount(finalCount);
            } else {
              console.warn('[MainHMI] Machine count read failed:', countData.error);
            }
          }
        } catch (countErr) {
          console.warn('[MainHMI] Machine count fetch error:', countErr.message || countErr);
        }

        // Read right head step number and description from PLC
        try {
          const stateResponse = await fetch('http://localhost:3001/read?tag=GVL_GRIGHTHEAD.Rstate');
          const descResponse = await fetch('http://localhost:3001/read?tag=GVL_GRIGHTHEAD.RstateDesc');
          
          if (stateResponse.ok && descResponse.ok) {
            const stateData = await stateResponse.json();
            const descData = await descResponse.json();
            
            if (stateData.success && descData.success) {
              let stepNum = stateData.value;
              if (typeof stepNum === 'object' && 'value' in stepNum) {
                stepNum = stepNum.value;
              }
              stepNum = Math.max(1, Math.min(10, parseInt(stepNum) || 1)); // Ensure 1-10
              
              let stepDesc = descData.value || 'Idle';
              if (typeof stepDesc === 'object' && 'value' in stepDesc) {
                stepDesc = stepDesc.value;
              }
              
              setRightStepDisplay({
                stepNumber: stepNum,
                stepDescription: String(stepDesc).trim()
              });
            }
          }
        } catch (stepErr) {
          console.warn('[MainHMI] Right step read error:', stepErr.message || stepErr);
        }

        // Read left head step number and description from PLC
        try {
          const stateResponse = await fetch('http://localhost:3001/read?tag=GVL_GLEFTHEAD.Lstate');
          const descResponse = await fetch('http://localhost:3001/read?tag=GVL_GLEFTHEAD.LstateDesc');
          
          if (stateResponse.ok && descResponse.ok) {
            const stateData = await stateResponse.json();
            const descData = await descResponse.json();
            
            if (stateData.success && descData.success) {
              let stepNum = stateData.value;
              if (typeof stepNum === 'object' && 'value' in stepNum) {
                stepNum = stepNum.value;
              }
              stepNum = Math.max(1, Math.min(10, parseInt(stepNum) || 1)); // Ensure 1-10
              
              let stepDesc = descData.value || 'Idle';
              if (typeof stepDesc === 'object' && 'value' in stepDesc) {
                stepDesc = stepDesc.value;
              }
              
              setLeftStepDisplay({
                stepNumber: stepNum,
                stepDescription: String(stepDesc).trim()
              });
            }
          }
        } catch (stepErr) {
          console.warn('[MainHMI] Left step read error:', stepErr.message || stepErr);
        }

        // Read mode feedback from PLC (RunMode and JogMode)
        try {
          const rightRunRes = await fetch('http://localhost:3001/read?tag=GVL_GRIGHTHEAD.bHmiRightRunMode');
          const rightJogRes = await fetch('http://localhost:3001/read?tag=GVL_GRIGHTHEAD.bHmiRightJogMode');
          const leftRunRes = await fetch('http://localhost:3001/read?tag=GVL_GLEFTHEAD.bHmiLeftRunMode');
          const leftJogRes = await fetch('http://localhost:3001/read?tag=GVL_GLEFTHEAD.bHmiLeftJogMode');
          
          if (rightRunRes.ok && rightJogRes.ok && leftRunRes.ok && leftJogRes.ok) {
            const [rightRunData, rightJogData, leftRunData, leftJogData] = await Promise.all([
              rightRunRes.json(),
              rightJogRes.json(),
              leftRunRes.json(),
              leftJogRes.json()
            ]);
            
            setModeFeedback({
              right: {
                runMode: rightRunData.success ? Boolean(rightRunData.value) : false,
                jogMode: rightJogData.success ? Boolean(rightJogData.value) : false
              },
              left: {
                runMode: leftRunData.success ? Boolean(leftRunData.value) : false,
                jogMode: leftJogData.success ? Boolean(leftJogData.value) : false
              }
            });
          }
        } catch (modeErr) {
          console.warn('[MainHMI] Mode feedback read error:', modeErr.message || modeErr);
        }

        // Read alarm bitfield from PLC (GVL_GAXIS.AlarmSystem)
        try {
          const alarmRes = await fetch('http://localhost:3001/read?tag=GVL_GAXIS.AlarmSystem');
          if (alarmRes.ok) {
            const alarmData = await alarmRes.json();
            if (alarmData.success) {
              let alarmVal = alarmData.value;
              if (typeof alarmVal === 'object' && 'value' in alarmVal) {
                alarmVal = alarmVal.value;
              } else if (typeof alarmVal === 'object' && 'low' in alarmVal) {
                alarmVal = alarmVal.low || 0;
              }
              const bitfield = Number(alarmVal) || 0;
              setAlarmBits(bitfield);
              setAlarms(decodeAlarmBits(bitfield));
            }
          }
        } catch (alarmErr) {
          console.warn('[MainHMI] Alarm read error:', alarmErr.message || alarmErr);
        }

        // Read machine status bitfield from PLC (GVL_GAXIS.MachineStatus)
        try {
          const statusRes = await fetch('http://localhost:3001/read?tag=GVL_GAXIS.MachineStatus');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.success) {
              let statusVal = statusData.value;
              if (typeof statusVal === 'object' && 'value' in statusVal) {
                statusVal = statusVal.value;
              } else if (typeof statusVal === 'object' && 'low' in statusVal) {
                statusVal = statusVal.low || 0;
              }
              const bitfield = Number(statusVal) || 0;
              setMachineStatusBits(bitfield);
              setMachineStatus(decodeMachineStatus(bitfield));
            }
          }
        } catch (statusErr) {
          console.warn('[MainHMI] Machine status read error:', statusErr.message || statusErr);
        }
      } catch (err) {
        setPlcStatus('bad');
        console.warn('Axis position read failed:', err.message || err);
        // Set positions to 0 on error
        setActualPositions({ right: { axis1: 0, axis2: 0 }, left: { axis1: 0, axis2: 0 } });
      }
    };
    poll();
    timer = setInterval(poll, 500); // Poll every 500ms for smoother updates
    return () => clearInterval(timer);
  }, []);

  // Program creation states
  const [showSideSelector, setShowSideSelector] = useState(false);
  const [selectedSide, setSelectedSide] = useState(null);
  const [showProgramNameModal, setShowProgramNameModal] = useState(false);
  const [currentProgram, setCurrentProgram] = useState(null);
  const [createdPrograms, setCreatedPrograms] = useState([]);
  const [, setProgramSteps] = useState({});

  // Load recipes from filesystem on mount
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        const rightRecipes = await loadRecipesFromFolder('right');
        const leftRecipes = await loadRecipesFromFolder('left');
        if (rightRecipes.length > 0) setRecipesRight(rightRecipes);
        if (leftRecipes.length > 0) setRecipesLeft(leftRecipes);
      } catch (err) {
        console.warn('Failed to load recipes:', err);
      }
    };
    loadRecipes();
  }, []);

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
    // Default recipe removed
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
    right: null,
    left: null
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
  const [currentStep, setCurrentStep] = useState(1);

  const [showEnableSideSelector, setShowEnableSideSelector] = useState(false);

  const [autoTeachOpen, setAutoTeachOpen] = useState(false);
  const [autoTeachSide, setAutoTeachSide] = useState(null);
  const [autoTeachProgramName, setAutoTeachProgramName] = useState('');
  const [showAutoTeachSelector, setShowAutoTeachSelector] = useState(false);
  const [showAutoTeachNameModal, setShowAutoTeachNameModal] = useState(false);

  const [showEditProgramSideSelector, setShowEditProgramSideSelector] = useState(false);
  const [showProgramEditor, setShowProgramEditor] = useState(false);
  const [programToEdit, setProgramToEdit] = useState(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [programToDownload, setProgramToDownload] = useState(null);
  const [showEditModeDialog, setShowEditModeDialog] = useState(false);
  const [showAutoAdjust, setShowAutoAdjust] = useState(false);

  const handleAxisChange = (axisName, value, mode) => {
    console.log(`${axisName} changed to ${value} (${mode})`);
  };

  // Homing handlers: pulse momentary tags for left/right heads
  const handleHomeLeft = async () => {
    try {
      await pulseBoolTag('GLEFTHEAD.bHmiEnaLeftHomePb', 200);
      setHomedSides(prev => ({ ...prev, left: true }));
      showMessage('Homing Started', 'Homing left side...', 'info');
    } catch (error) {
      showMessage('Error', `Failed to trigger left homing: ${error.message}`, 'error');
    }
  };

  const handleHomeRight = async () => {
    try {
      await pulseBoolTag('GRIGHTHEAD.bHmiEnaRightHomePb', 200);
      setHomedSides(prev => ({ ...prev, right: true }));
      showMessage('Homing Started', 'Homing right side...', 'info');
    } catch (error) {
      showMessage('Error', `Failed to trigger right homing: ${error.message}`, 'error');
    }
  };

  /**
   * Send recipe parameters to PLC
   * @param {Object} parameters - Recipe parameters object
   * @param {String} side - 'left' or 'right'
   */
  const sendRecipeParametersToPLC = async (parameters, side) => {
    if (!parameters || !side) return false;
    try {
      await writePLCVar({
        command: 'setRecipeParameters',
        side,
        parameters: {
          speed: parameters.recipeSpeed || 100,
          stepDelay: parameters.stepDelay || 500,
          tubeID: parameters.tubeID || 0,
          tubeOD: parameters.tubeOD || 0,
          finalSize: parameters.finalSize || 0,
          sizeType: parameters.sizeType || 'OD',
          tubeLength: parameters.tubeLength || 0,
          idFingerRadius: parameters.idFingerRadius || 0,
          depth: parameters.depth || 0
        }
      });
      console.log(`Recipe parameters sent to PLC for ${side} side`);
      return true;
    } catch (error) {
      console.error(`Failed to send recipe parameters to PLC: ${error.message}`);
      return false;
    }
  };

  const handleLoadRecipe = (recipe, side) => {
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot change recipes.', 'warning');
      return;
    }
    const recipeName = typeof recipe === 'string' ? recipe : recipe?.name;
    if (!recipeName || !side) return;
    setCurrentRecipe((prev) => ({ ...prev, [side]: recipeName }));
    
    const recipeObj = typeof recipe === 'string'
      ? (side === 'right' ? recipesRight : recipesLeft).find((r) => r.name === recipeName)
      : recipe;
    const parameters = recipeObj?.parameters ?? null;
    setCurrentParameters(parameters);
    
    // Send recipe parameters to PLC
    if (parameters) {
      sendRecipeParametersToPLC(parameters, side)
        .then((success) => {
          if (success) {
            showMessage('Recipe Loaded', `Recipe "${recipeName}" loaded and sent to ${side} side`, 'success');
          } else {
            showMessage('Recipe Loaded (PLC Sync Failed)', `Recipe "${recipeName}" loaded but PLC parameters may not have updated`, 'warning');
          }
        })
        .catch((error) => {
          showMessage('Recipe Loaded (PLC Error)', `Recipe loaded but failed to sync PLC: ${error.message}`, 'warning');
        });
    } else {
      showMessage('Recipe Loaded', `Recipe "${recipeName}" loaded for ${side} side`, 'success');
    }
    
    // Close the recipe manager after loading
    setRecipeOpen(false);
    setRecipeSide(null);
  };

  const handleOpenRecipeSelector = (side) => {
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot change recipes.', 'warning');
      return;
    }
    setRecipeSide(side);
    setRecipeOpen(true);
  };

  // ...existing code...

  const handleCreateRecipe = (recipeName, recipeDescription, side) => {
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot create recipes.', 'warning');
      return;
    }
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
    
    // Save to filesystem
    saveRecipeToFile(newRecipe, side);
    
    if (side === 'right') {
      setRecipesRight(prev => {
        const updated = [...prev, newRecipe];
        setCurrentRecipe(cr => ({ ...cr, right: recipeName }));
        setTimeout(() => handleLoadRecipe(newRecipe, 'right'), 0);
        return updated;
      });
    } else {
      setRecipesLeft(prev => {
        const updated = [...prev, newRecipe];
        setCurrentRecipe(cr => ({ ...cr, left: recipeName }));
        setTimeout(() => handleLoadRecipe(newRecipe, 'left'), 0);
        return updated;
      });
    }
    showMessage('Recipe Created', `Recipe "${recipeName}" created and loaded`, 'success');
  };

  const handleEditRecipe = (oldRecipe, newName, newDescription, side) => {
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot edit recipes.', 'warning');
      return;
    }
    const updateRecipes = side === 'right' ? setRecipesRight : setRecipesLeft;
    const recipes = side === 'right' ? recipesRight : recipesLeft;
    
    const updatedRecipes = recipes.map(r => {
      if (r === oldRecipe) {
        const updated = { ...r, name: newName, description: newDescription };
        // If name changed, delete old file and save with new name
        if (oldRecipe.name !== newName) {
          deleteRecipeFile(oldRecipe.name, side);
        }
        saveRecipeToFile(updated, side);
        return updated;
      }
      return r;
    });
    
    updateRecipes(updatedRecipes);
    showMessage('Recipe Updated', `Recipe "${newName}" updated successfully`, 'success');
  };

  // Duplicate handleSelectSideForEdit removed to fix redeclaration error

  const showMessage = (title, message, type = 'info') => {
    setMessageModal({ isOpen: true, title, message, type });
  };

  const closeMessage = () => {
    setMessageModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  const handleUserLogin = (userRole) => {
    if (userRole) setCurrentUser(userRole);
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    setCurrentUser('operator');
  };

  const handleEditProgram = () => {
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot edit programs.', 'warning');
      return;
    }
    setShowEditProgramSideSelector(true);
  };

  const handleOpenParameters = () => {
    setShowParameterSideSelector(true);
  };

  const handleAutoTeach = () => {
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot create programs.', 'warning');
      return;
    }
    setShowAutoTeachSelector(true);
  };

  const handleSelectSide = (side) => {
    setSelectedSide(side);
    setShowSideSelector(false);
    setShowProgramNameModal(true);
  };

  const handleProgramNameConfirm = (name) => {
    const programName = name?.trim() ? name.trim() : 'New Program';
    setCurrentProgram({ name: programName, side: selectedSide, steps: {} });
    setProgramSteps({});
    setCurrentStep(1);
    setShowProgramNameModal(false);
  };

  const handleStepComplete = (stepData) => {
    if (!currentProgram) return;
    setProgramSteps((prev) => ({ ...prev, [currentStep]: stepData }));
    setCurrentProgram((prev) => {
      if (!prev) return prev;
      return { ...prev, steps: { ...(prev.steps || {}), [currentStep]: stepData } };
    });

    if (currentStep >= 10) {
      setCreatedPrograms((prev) => [...prev, { ...currentProgram, steps: { ...(currentProgram.steps || {}), [currentStep]: stepData } }]);
      setCurrentRecipe(prev => ({ ...prev, [currentProgram.side]: currentProgram.name }));
      showMessage('Program Created', `Program "${currentProgram.name}" saved`, 'success');
      setCurrentProgram(null);
      setSelectedSide(null);
      setCurrentStep(1);
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleStepPrevious = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleCancelProgram = () => {
    setShowSideSelector(false);
    setShowProgramNameModal(false);
    setSelectedSide(null);
    setCurrentProgram(null);
    setProgramSteps({});
    setCurrentStep(1);
  };

  const handleSelectRecipeSide = (side) => {
    setRecipeSide(side);
    setRecipeSideSelectorOpen(false);
    setRecipeOpen(true);
  };

  const handleParameterSideSelect = (side) => {
    setParametersSide(side);
    setShowParameterSideSelector(false);
    const recipeName = currentRecipe?.[side];
    const recipes = side === 'right' ? recipesRight : recipesLeft;
    const recipe = recipes.find((r) => r.name === recipeName);
    setCurrentParameters(recipe?.parameters ?? null);
    setParametersOpen(true);
  };

  const handleSaveParameters = (updatedParameters) => {
    setCurrentParameters(updatedParameters);
    
    // Update recipe in state and save to file
    if (parametersSide) {
      const recipeName = currentRecipe?.[parametersSide];
      if (recipeName) {
        const updateRecipes = parametersSide === 'right' ? setRecipesRight : setRecipesLeft;
        
        updateRecipes(prev => prev.map(r => {
          if (r.name === recipeName) {
            const updated = { ...r, parameters: updatedParameters };
            saveRecipeToFile(updated, parametersSide);
            return updated;
          }
          return r;
        }));
      }
    }
    
    setParametersOpen(false);
  };

  const handleDeleteRecipe = (recipe, sideParam) => {
    if (currentUser === 'operator') {
      showMessage('Access Denied', 'Operators cannot delete recipes.', 'warning');
      return;
    }
    const side = sideParam ?? recipeSide;
    const recipeName = typeof recipe === 'string' ? recipe : recipe?.name;
    if (!side || !recipeName) return;

    // Delete from filesystem
    deleteRecipeFile(recipeName, side);

    if (side === 'right') {
      setRecipesRight((prev) => prev.filter((r) => r.name !== recipeName));
      setCurrentRecipe((prev) => ({ ...prev, right: prev.right === recipeName ? null : prev.right }));
    } else {
      setRecipesLeft((prev) => prev.filter((r) => r.name !== recipeName));
      setCurrentRecipe((prev) => ({ ...prev, left: prev.left === recipeName ? null : prev.left }));
    }
    showMessage('Recipe Deleted', `Recipe "${recipeName}" deleted`, 'success');
  };

  const handleAutoTeachSelectSide = (side) => {
    setAutoTeachSide(side);
    setShowAutoTeachSelector(false);
    setShowAutoTeachNameModal(true);
  };

  const handleAutoTeachProgramNameConfirm = (name) => {
    const programName = name?.trim() ? name.trim() : 'AutoTeach Program';
    setAutoTeachProgramName(programName);
    setShowAutoTeachNameModal(false);
    setAutoTeachOpen(true);
  };

  const handlePLCWrite = (programPayload) => {
    const side = programPayload?.side;
    if (!side) return;
    setPlcDirty((prev) => ({ ...prev, [side]: true }));
  };

  const handleSaveAutoTeachProgram = (stepsArray) => {
    const steps = {};
    (stepsArray || []).forEach((s) => {
      if (s?.step != null) steps[s.step] = s;
    });
    const program = { name: autoTeachProgramName, side: autoTeachSide, steps };
    setCreatedPrograms((prev) => [...prev, program]);
    
    // Create a recipe from the auto teach program
    const newRecipe = {
      name: autoTeachProgramName,
      description: `Auto Teach program for ${autoTeachSide} side`,
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
      },
      program: program // Store the program data within the recipe
    };

    // Add to appropriate recipe list and set as current
    if (autoTeachSide === 'right') {
      setRecipesRight(prev => {
        // Check if recipe already exists and update it, or add new
        const existingIndex = prev.findIndex(r => r.name === autoTeachProgramName);
        let recipeToSave;
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], program: program };
          recipeToSave = updated[existingIndex];
          saveRecipeToFile(recipeToSave, 'right');
          return updated;
        }
        recipeToSave = newRecipe;
        saveRecipeToFile(recipeToSave, 'right');
        return [...prev, newRecipe];
      });
      setCurrentRecipe(cr => ({ ...cr, right: autoTeachProgramName }));
    } else {
      setRecipesLeft(prev => {
        // Check if recipe already exists and update it, or add new
        const existingIndex = prev.findIndex(r => r.name === autoTeachProgramName);
        let recipeToSave;
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], program: program };
          recipeToSave = updated[existingIndex];
          saveRecipeToFile(recipeToSave, 'left');
          return updated;
        }
        recipeToSave = newRecipe;
        saveRecipeToFile(recipeToSave, 'left');
        return [...prev, newRecipe];
      });
      setCurrentRecipe(cr => ({ ...cr, left: autoTeachProgramName }));
    }

    showMessage('Auto Teach Saved', `Program "${program.name}" saved and loaded as active recipe`, 'success');
    if (autoTeachSide) {
      setPlcDirty(prev => ({ ...prev, [autoTeachSide]: false }));
    }
    
    // Close the AutoTeach modal
    setAutoTeachOpen(false);
    setAutoTeachSide(null);
    setAutoTeachProgramName('');
  };

  // Duplicate handleSelectSideForEdit removed to fix redeclaration error
// ...existing code...

  // Handle user choice in edit mode dialog
  const handleEditModeChoice = (mode) => {
    setShowEditModeDialog(false);
    if (mode === 'manual') {
      setShowProgramEditor(true);
    } else if (mode === 'auto') {
      setShowAutoAdjust(true);
    }
  };

  const handleSelectSideForEdit = (side) => {
    const recipeName = currentRecipe?.[side];
    const recipes = side === 'right' ? recipesRight : recipesLeft;

    // Prefer the currently selected recipe/program for this side.
    // Always load from recipes first since that's where we save updates
    const preferredProgram = (() => {
      const recipe = recipes.find((r) => r.name === recipeName);
      // Check if recipe has program data (steps, speed, dwell)
      if (recipe && recipe.steps) {
        return { ...recipe, name: recipe.name, side };
      }
      // Fallback to createdPrograms if recipe doesn't have program data
      const namedProgram = createdPrograms.find((p) => p.side === side && p.name === recipeName);
      if (namedProgram) return namedProgram;
      return null;
    })();

    if (preferredProgram) {
      setProgramToEdit(preferredProgram);
      setShowProgramEditor(true);
      setShowEditProgramSideSelector(false);
      return;
    }

    const sidePrograms = createdPrograms.filter((p) => p.side === side);
    if (sidePrograms.length === 0) {
      // Fallback: use currently selected recipe to create a temporary program for editing
      const fallbackName = recipeName;
      if (!fallbackName) {
        showMessage('No Program', `No programs found for ${side} side. Please select a recipe first.`, 'warning');
        setShowEditProgramSideSelector(false);
        return;
      }
      const recipe = recipes.find((r) => r.name === fallbackName);
      const params = recipe?.parameters || { recipeSpeed: 100, stepDelay: 500 };

      const steps = {
        1: {
          step: 1,
          stepName: 'Start Position',
          positions: { axis1Cmd: 0, axis2Cmd: 0 },
          pattern: 6,
          timestamp: new Date().toISOString()
        }
      };

      const tempProgram = {
        name: fallbackName,
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
      // Multiple programs, show selection prompt (default is current recipe if present)
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
    
    // Save to recipe file to persist changes
    if (updatedProgram?.side) {
      // Find the existing recipe and merge program data into it
      const recipes = updatedProgram.side === 'right' ? recipesRight : recipesLeft;
      const existingRecipe = recipes.find(r => r.name === updatedProgram.name);
      
      if (existingRecipe) {
        // Merge program data into the existing recipe
        const mergedRecipe = {
          ...existingRecipe,
          steps: updatedProgram.steps,
          speed: updatedProgram.speed,
          dwell: updatedProgram.dwell,
          side: updatedProgram.side
        };
        saveRecipeToFile(mergedRecipe, updatedProgram.side);
        
        // Also update the recipesRight/recipesLeft state
        const updateRecipes = updatedProgram.side === 'right' ? setRecipesRight : setRecipesLeft;
        updateRecipes(prev => {
          return prev.map(r => r.name === updatedProgram.name ? mergedRecipe : r);
        });
      } else {
        // If no existing recipe, save program as-is
        saveRecipeToFile(updatedProgram, updatedProgram.side);
        const updateRecipes = updatedProgram.side === 'right' ? setRecipesRight : setRecipesLeft;
        updateRecipes(prev => [...prev, updatedProgram]);
      }
      
      setPlcDirty(prev => ({ ...prev, [updatedProgram.side]: false }));
    }
    
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

  const convertPos = (val) => unitSystem === 'mm' ? val * 25.4 : val;
  const displayPositions = {
    right: {
      axis1: convertPos(actualPositions.right.axis1 || 0),
      axis2: convertPos(actualPositions.right.axis2 || 0)
    },
    left: {
      axis1: convertPos(actualPositions.left.axis1 || 0),
      axis2: convertPos(actualPositions.left.axis2 || 0)
    }
  };

  return (
    <div className="main-hmi">
      <div className="hmi-header">
        <h1 className="modern-header">UFM CNC ENDFORMER</h1>
        <div className="header-right">
          <div className="shift-counts">
            <div className="shift-count-card">
              <div className="shift-label">Count</div>
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
            <button className="change-user-btn" onClick={handleLogout} title="Logout to Operator">
              Logout
            </button>
          </div>
          {(plcDirty.left || plcDirty.right) && (
            <div className="plc-dirty-indicator" title="PLC has live changes not saved to recipe">
              <span className="plc-dirty-dot" />
              <span>
                PLC differs:
                {plcDirty.left ? ' L' : ''}
                {plcDirty.left && plcDirty.right ? '&' : ''}
                {plcDirty.right ? ' R' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {alarms.length > 0 && alarmBannerVisible && (
        <div className="alarm-banner">
          <div className="alarm-banner-header">
            <span className="alarm-icon">⚠</span>
            <span className="alarm-title">
              {alarms.length === 1 ? 'Active Alarm' : `${alarms.length} Active Alarms`}
            </span>
            <span className="alarm-code">0x{alarmBits.toString(16).toUpperCase().padStart(8, '0')}</span>
          </div>
          <div className="alarm-items">
            {alarms.slice(0, 4).map(alarm => (
              <div key={alarm.bit} className={`alarm-pill ${alarm.severity}`}>
                <span className="alarm-pill-bit">B{alarm.bit}</span>
                <span className="alarm-pill-text">{alarm.message}</span>
              </div>
            ))}
            {alarms.length > 4 && (
              <div className="alarm-pill more">+{alarms.length - 4} more</div>
            )}
          </div>
          <button 
            className="alarm-acknowledge-btn" 
            onClick={handleAcknowledgeAlarm}
          >
            OK / Acknowledge
          </button>
        </div>
      )}

      <LoginModal 
        isOpen={showLoginModal} 
        onLogin={handleUserLogin}
        currentUser={currentUser}
        userPasswords={userPasswords}
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
            actualPositions={displayPositions.right}
            unitSystem={unitSystem}
            step={rightStepDisplay.stepNumber}
            stepDescription={rightStepDisplay.stepDescription}
            recipe={currentRecipe.right}
            recipes={recipesRight}
            onRecipeChange={(recipe) => setCurrentRecipe(prev => ({ ...prev, right: recipe }))}
            onOpenRecipeSelector={handleOpenRecipeSelector}
            userRole={currentUser}
            runMode={modeFeedback.right.runMode}
            jogMode={modeFeedback.right.jogMode}
          />
          <AxisPanel
            side="Left"
            axis1Name="Axis3 (ID)"
            axis2Name="Axis4 (OD)"
            onAxisChange={handleAxisChange}
            axis1State={axis3State}
            axis2State={axis4State}
            actualPositions={displayPositions.left}
            unitSystem={unitSystem}
            step={leftStepDisplay.stepNumber}
            stepDescription={leftStepDisplay.stepDescription}
            recipe={currentRecipe.left}
            recipes={recipesLeft}
            onRecipeChange={(recipe) => setCurrentRecipe(prev => ({ ...prev, left: recipe }))}
            onOpenRecipeSelector={handleOpenRecipeSelector}
            userRole={currentUser}
            runMode={modeFeedback.left.runMode}
            jogMode={modeFeedback.left.jogMode}
          />
        </div>
      </div>

      {/* Machine Status Banner - spans both panels at bottom */}
      <div className="machine-status-banner">
        <div className="machine-status-content">
          <span className="machine-status-header">Machine Status:</span>
          <div className="machine-status-indicators">
            {machineStatus.length > 0 ? (
              machineStatus.map(status => (
                <div 
                  key={status.bit} 
                  className="status-indicator"
                  style={{ borderColor: status.color, color: status.color }}
                  title={`Bit ${status.bit}`}
                >
                  <span className="status-dot" style={{ backgroundColor: status.color }} />
                  {status.label}
                </div>
              ))
            ) : (
              <span style={{ color: '#90CAF9', fontSize: '13px', fontWeight: '600' }}>• PLC not connected</span>
            )}
          </div>
          <span className="machine-status-code">0x{machineStatusBits.toString(16).toUpperCase().padStart(8, '0')}</span>
        </div>
      </div>

      <div className="hmi-mode-controls">
        <div className="mode-button-group">
          <button 
            className="mode-control-btn homing-btn"
            onClick={handleHomeLeft}
            title="Home Left Side"
          >
            <span className="mode-icon">🏠</span>
            <span>HOME LEFT</span>
          </button>

          <button 
            className="mode-control-btn homing-btn"
            onClick={handleHomeRight}
            title="Home Right Side"
          >
            <span className="mode-icon">🏠</span>
            <span>HOME RIGHT</span>
          </button>

          <button 
            className={`mode-control-btn enable-jog-btn ${(modeFeedback.right.jogMode || modeFeedback.left.jogMode) ? 'active' : ''}`}
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
            {(modeFeedback.right.jogMode || modeFeedback.left.jogMode) && (
              <span className="mode-indicator"> ●</span>
            )}
          </button>

          <button 
            className={`mode-control-btn run-control ${(modeFeedback.right.runMode || modeFeedback.left.runMode) ? 'active' : ''}`}
            onClick={() => setShowRunSideSelector(true)}
            disabled={!(homedSides.right || homedSides.left)}
            title={homedSides.right || homedSides.left ? 'Select side(s) to run' : 'Must home at least one side first'}
          >
            <span className="mode-icon">▶</span>
            <span>RUN</span>
            {(modeFeedback.right.runMode || modeFeedback.left.runMode) && (
              <span className="mode-indicator"> ●</span>
            )}
          </button>

          <button 
            className="mode-control-btn io-btn"
            onClick={() => setIoPageOpen(true)}
            title="View and test Digital IO"
          >
            <span className="mode-icon">⚡</span>
            <span>IO</span>
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
        userRole={currentUser}
      />

      <MachineParameters
        isOpen={machineParametersOpen}
        onClose={() => setMachineParametersOpen(false)}
        plcStatus={plcStatus}
        unitSystem={unitSystem}
        onUnitChange={setUnitSystem}
        userRole={currentUser}
        userPasswords={userPasswords}
        onUpdatePasswords={setUserPasswords}
        onOpenDebug={() => setDebugPanelOpen(true)}
      />

      <DigitalIOPage
        isOpen={ioPageOpen}
        onClose={() => setIoPageOpen(false)}
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
          showBothOption={false}
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



      {/* Homing side selector removed; direct buttons used */}

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
        program={{ ...programToEdit, recipeName: programToEdit?.side ? currentRecipe[programToEdit.side] : undefined }}
        onSaveProgram={handleSaveProgramChanges}
        onWriteToPLC={handlePLCWrite}
      />

      <AutoAdjustProgram
        isOpen={showAutoAdjust}
        onClose={() => setShowAutoAdjust(false)}
        side={programToEdit?.side || ''}
        stepCount={programToEdit ? Object.keys(programToEdit.steps).length : 10}
        stroke={programToEdit?.side === 'right' ? parametersOpen ? undefined : undefined : undefined}
      />
      <>
        {/* ModernDialog for manual/auto choice */}
        {showEditModeDialog && (
          <ModernDialog
            isOpen={showEditModeDialog}
            title="Choose Edit Mode"
            onClose={() => setShowEditModeDialog(false)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button onClick={() => handleEditModeChoice('manual')}>Edit Manually</button>
              <button onClick={() => handleEditModeChoice('auto')}>Auto Adjust</button>
            </div>
          </ModernDialog>
        )}

        <DownloadProgramModal
          isOpen={showDownloadModal}
          program={programToDownload}
          onConfirm={async () => {
            if (!programToDownload) return;
            try {
              // Send recipe parameters first if available
              if (currentParameters && programToDownload.side) {
                const paramsSent = await sendRecipeParametersToPLC(currentParameters, programToDownload.side);
                if (!paramsSent) {
                  console.warn('Failed to send recipe parameters, continuing with program download');
                }
              }
              
              // Then download the program
              await writePLCVar({ 
                command: 'downloadProgram', 
                program: programToDownload,
                parameters: currentParameters || undefined
              });
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
          onWriteToPLC={handlePLCWrite}
        />
      </>

      <DebugPanel isOpen={debugPanelOpen} onClose={() => setDebugPanelOpen(false)} />
    </div>
  );
}
