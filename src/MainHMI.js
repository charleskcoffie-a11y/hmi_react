import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import HomingDialog from './components/HomingDialog';
import JogModeDialog from './components/JogModeDialog';
import DebugPanel from './components/DebugPanel';
import DigitalIOPage from './components/DigitalIOPage';
import './styles/MainHMI.css';
import { readPLCVar, writePLCVar, readAxisPositions, pulseBoolTag, writeScreenIndex } from './services/plcApiService';
import { saveRecipeToFile, loadRecipesFromFolder, deleteRecipeFile } from './services/recipeService';
import { initializeBackendNetId } from './services/netIdService';
import packageJson from '../package.json';

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
  { bit: 10, label: 'Left Head Active', color: '#00BCD4' },
  { bit: 11, label: 'Power is Off..Turn Power On', color: '#FF5252' }
];

// Screen index mapping for PLC tracking (GAXIS.dHmiCurrScrnIndex)
const SCREEN_INDEX = {
  MAIN_CONTROL: 0,
  AUTO_TEACH_LEFT: 1,
  AUTO_TEACH_RIGHT: 2,
  PROGRAM_EDITOR: 3,
  RECIPE_MANAGER: 4,
  RECIPE_PARAMETERS: 5,
  MACHINE_PARAMETERS: 6,
  JOG_MODE: 7,
  JOG_SIDE_SELECTOR: 8,
  HOMING: 9,
  JOG_MODE_LEFT: 12,
  JOG_MODE_RIGHT: 13,
  DIGITAL_IO: 10,
  NET_ID_SETTINGS: 11,
  // Right side program creation (20-29)
  RIGHT_PROGRAM_STEP_1: 20,
  RIGHT_PROGRAM_STEP_2: 21,
  RIGHT_PROGRAM_STEP_3: 22,
  RIGHT_PROGRAM_STEP_4: 23,
  RIGHT_PROGRAM_STEP_5: 24,
  RIGHT_PROGRAM_STEP_6: 25,
  RIGHT_PROGRAM_STEP_7: 26,
  RIGHT_PROGRAM_STEP_8: 27,
  RIGHT_PROGRAM_STEP_9: 28,
  RIGHT_PROGRAM_STEP_10: 29,
  // Left side program creation (30-39)
  LEFT_PROGRAM_STEP_1: 30,
  LEFT_PROGRAM_STEP_2: 31,
  LEFT_PROGRAM_STEP_3: 32,
  LEFT_PROGRAM_STEP_4: 33,
  LEFT_PROGRAM_STEP_5: 34,
  LEFT_PROGRAM_STEP_6: 35,
  LEFT_PROGRAM_STEP_7: 36,
  LEFT_PROGRAM_STEP_8: 37,
  LEFT_PROGRAM_STEP_9: 38,
  LEFT_PROGRAM_STEP_10: 39,
  AUTO_ADJUST: 40,
  DOWNLOAD_PROGRAM: 41
};

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
    admin: '5771',
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
  const [unitSystem, setUnitSystem] = useState('inch');
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
  const [plcConnected, setPlcConnected] = useState(false);

  // Homing status states
  const [showHomingDialog, setShowHomingDialog] = useState(false);
  const [homingSide, setHomingSide] = useState(null);
  const [homingTimeout, setHomingTimeout] = useState(() => {
    const saved = localStorage.getItem('homingTimeout');
    return saved ? parseInt(saved, 10) : 60; // Default 60 seconds
  });
  const [homingStatus, setHomingStatus] = useState({
    left: {
      enabled: false,  // GLEFTHEAD.bHmiLeftHomeEna
      homed: false     // GLEFTHEAD.bLeftHeadHomed
    },
    right: {
      enabled: false,  // GRIGHTHEAD.bHmiRightHomeEna
      homed: false     // GRIGHTHEAD.bRightHeadHomed
    }
  });

  const [plcStatus, setPlcStatus] = useState('unknown');

  // Start position enable status states (feedback from PLC)
  const [startPosReadyStatus, setStartPosReadyStatus] = useState({
    left: false,   // GLEFTHEAD.bHmiLeftStartPosEna
    right: false   // GRIGHTHEAD.bHmiRightStartPosEna
  });

  // Start position PB feedback (momentary) for visual pulse
  const [startPosFeedback, setStartPosFeedback] = useState({
    left: false,   // GLEFTHEAD.bHmiLeftStartPosPb
    right: false   // GRIGHTHEAD.bHmiRightStartPosPb
  });

  // Axis at start position status (when true, axis is already at start position)
  const [atStartPos, setAtStartPos] = useState({
    left: false,   // GLEFTHEAD.bLeftAtStartPos
    right: false   // GRIGHTHEAD.bRightAtStartPos
  });

  // Jog mode dialog states
  const [showJogDialog, setShowJogDialog] = useState(false);
  const [jogActiveSide, setJogActiveSide] = useState(null); // 'left' or 'right'
  const [jogReadyStatus, setJogReadyStatus] = useState({
    left: { id: false, od: false },
    right: { id: false, od: false }
  });
  
  // Pump enable status (controls if Home and Start Position buttons are enabled)
  const [pumpEnabled, setPumpEnabled] = useState(false);
  
  // Current screen tracking for PLC
  const [currentScreen, setCurrentScreen] = useState(SCREEN_INDEX.MAIN_CONTROL);
  
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
  
  // Write current screen index to PLC whenever it changes
  useEffect(() => {
    writeScreenIndex(currentScreen);
    console.log(`[MainHMI] Screen changed to index ${currentScreen}`);
  }, [currentScreen]);
  
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        // Read axis positions from PLC
        const data = await readAxisPositions();
        const newPositions = data.actualPositions || { right: { axis1: 0, axis2: 0 }, left: { axis1: 0, axis2: 0 } };
        
        // Only update if positions actually changed (prevents unnecessary re-renders)
        setActualPositions(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(newPositions)) {
            return newPositions;
          }
          return prev;
        });
        
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
              // Only update if value changed
              setMachineCount(prev => prev !== finalCount ? finalCount : prev);
            } else {
              console.warn('[MainHMI] Machine count read failed:', countData.error);
            }
          }
        } catch (countErr) {
          console.warn('[MainHMI] Machine count fetch error:', countErr.message || countErr);
        }

        // Read right head step number and description from PLC
        try {
          const stateResponse = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.Rstate');
          const descResponse = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.RstateDesc');
          
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
              
              const newRightStep = {
                stepNumber: stepNum,  // Display PLC value as-is (e.g., 500, 200, etc.)
                stepDescription: String(stepDesc).trim()
              };
              
              // Only update if changed
              setRightStepDisplay(prev => {
                if (prev.stepNumber !== newRightStep.stepNumber || prev.stepDescription !== newRightStep.stepDescription) {
                  return newRightStep;
                }
                return prev;
              });
            }
          }
        } catch (stepErr) {
          console.warn('[MainHMI] Right step read error:', stepErr.message || stepErr);
        }

        // Read left head step number and description from PLC
        try {
          const stateResponse = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.Lstate');
          const descResponse = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.LstateDesc');
          
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
              
              const newLeftStep = {
                stepNumber: stepNum,  // Display PLC value as-is (e.g., 500, 200, etc.)
                stepDescription: String(stepDesc).trim()
              };
              
              // Only update if changed
              setLeftStepDisplay(prev => {
                if (prev.stepNumber !== newLeftStep.stepNumber || prev.stepDescription !== newLeftStep.stepDescription) {
                  return newLeftStep;
                }
                return prev;
              });
            }
          }
        } catch (stepErr) {
          console.warn('[MainHMI] Left step read error:', stepErr.message || stepErr);
        }

        // Read mode feedback from PLC (RunMode and JogMode)
        try {
          const rightRunRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bHmiRightRunMode');
          const rightJogRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bHmiRightJogMode');
          const leftRunRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftRunMode');
          const leftJogRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftJogMode');
          
          if (rightRunRes.ok && rightJogRes.ok && leftRunRes.ok && leftJogRes.ok) {
            const [rightRunData, rightJogData, leftRunData, leftJogData] = await Promise.all([
              rightRunRes.json(),
              rightJogRes.json(),
              leftRunRes.json(),
              leftJogRes.json()
            ]);
            
            const newModeFeedback = {
              right: {
                runMode: rightRunData.success ? Boolean(rightRunData.value) : false,
                jogMode: rightJogData.success ? Boolean(rightJogData.value) : false
              },
              left: {
                runMode: leftRunData.success ? Boolean(leftRunData.value) : false,
                jogMode: leftJogData.success ? Boolean(leftJogData.value) : false
              }
            };
            
            // Only update if changed
            setModeFeedback(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newModeFeedback)) {
                return newModeFeedback;
              }
              return prev;
            });

            // Note: Dialog visibility is now controlled by user selection (handleEnableJogButton)
            // Not automatically opening/closing based on PLC feedback to avoid timing delays
            // User can click CLOSE button to exit, which will clear jog mode on PLC
          }
        } catch (modeErr) {
          console.warn('[MainHMI] Mode feedback read error:', modeErr.message || modeErr);
        }

        // Read start position enable status from PLC (ready to move to start position)
        try {
          const leftStartRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftStartPosEna');
          const rightStartRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bHmiRightStartPosEna');
          
          if (leftStartRes.ok && rightStartRes.ok) {
            const [leftStartData, rightStartData] = await Promise.all([
              leftStartRes.json(),
              rightStartRes.json()
            ]);
            
            const newStartPosReadyStatus = {
              left: leftStartData.success ? Boolean(leftStartData.value) : false,
              right: rightStartData.success ? Boolean(rightStartData.value) : false
            };
            
            // Only update if changed
            setStartPosReadyStatus(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newStartPosReadyStatus)) {
                return newStartPosReadyStatus;
              }
              return prev;
            });
          }
        } catch (startPosErr) {
          console.warn('[MainHMI] Start position ready status read error:', startPosErr.message || startPosErr);
        }

        // Read start position pushbutton feedback (momentary) to drive UI pulse color
        try {
          const leftPbRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftStartPosPb');
          const rightPbRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bHmiRightStartPosPb');

          if (leftPbRes.ok && rightPbRes.ok) {
            const [leftPbData, rightPbData] = await Promise.all([
              leftPbRes.json(),
              rightPbRes.json()
            ]);

            const newStartPosFeedback = {
              left: leftPbData.success ? Boolean(leftPbData.value) : false,
              right: rightPbData.success ? Boolean(rightPbData.value) : false
            };

            setStartPosFeedback(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newStartPosFeedback)) {
                return newStartPosFeedback;
              }
              return prev;
            });
          }
        } catch (startPosFbErr) {
          console.warn('[MainHMI] Start position PB feedback read error:', startPosFbErr.message || startPosFbErr);
        }

        // Read "at start position" status from PLC (indicates axis is already at start position)
        try {
          const leftAtStartRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bLeftAtStartPos');
          const rightAtStartRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bRightAtStartPos');

          if (leftAtStartRes.ok && rightAtStartRes.ok) {
            const [leftAtStartData, rightAtStartData] = await Promise.all([
              leftAtStartRes.json(),
              rightAtStartRes.json()
            ]);

            const newAtStartPos = {
              left: leftAtStartData.success ? Boolean(leftAtStartData.value) : false,
              right: rightAtStartData.success ? Boolean(rightAtStartData.value) : false
            };

            setAtStartPos(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newAtStartPos)) {
                return newAtStartPos;
              }
              return prev;
            });
          }
        } catch (atStartErr) {
          console.warn('[MainHMI] At start position read error:', atStartErr.message || atStartErr);
        }

        // Read jog ready status from PLC (ID and OD ready flags)
        try {
          const leftIdRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftExpEna');
          const leftOdRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftRedEna');
          const rightIdRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bHmiRightExpEna');
          const rightOdRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bHmiRightRedEna');
          
          if (leftIdRes.ok && leftOdRes.ok && rightIdRes.ok && rightOdRes.ok) {
            const [leftIdData, leftOdData, rightIdData, rightOdData] = await Promise.all([
              leftIdRes.json(),
              leftOdRes.json(),
              rightIdRes.json(),
              rightOdRes.json()
            ]);
            
            const newJogReadyStatus = {
              left: {
                id: leftIdData.success ? Boolean(leftIdData.value) : false,
                od: leftOdData.success ? Boolean(leftOdData.value) : false
              },
              right: {
                id: rightIdData.success ? Boolean(rightIdData.value) : false,
                od: rightOdData.success ? Boolean(rightOdData.value) : false
              }
            };
            
            // Only update if changed
            setJogReadyStatus(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newJogReadyStatus)) {
                return newJogReadyStatus;
              }
              return prev;
            });
          }
        } catch (jogReadyErr) {
          console.warn('[MainHMI] Jog ready status read error:', jogReadyErr.message || jogReadyErr);
        }


        // Read alarm bitfield from PLC (GAxis.AlarmSystem)
        try {
          const alarmRes = await fetch('http://localhost:3001/read?tag=GAxis.AlarmSystem');
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

        // Read machine status bitfield from PLC (GAxis.MachineStatus)
        try {
          const statusRes = await fetch('http://localhost:3001/read?tag=GAxis.MachineStatus');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            console.log('[MainHMI] Machine status response:', statusData);
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
              setPlcConnected(true); // Successfully read from PLC
              console.log('[MainHMI] PLC connected, status bits:', bitfield);
            } else {
              setPlcConnected(false); // Read failed
              console.warn('[MainHMI] Machine status read failed:', statusData.error);
            }
          } else {
            setPlcConnected(false); // HTTP error
            console.warn('[MainHMI] HTTP error reading machine status:', statusRes.status);
          }
        } catch (statusErr) {
          setPlcConnected(false); // Exception occurred
          console.warn('[MainHMI] Machine status read error:', statusErr.message || statusErr);
        }

        // Read pump enable status from PLC (GAxis.bPumpEnable)
        try {
          const pumpRes = await fetch('http://localhost:3001/read?tag=GAxis.bPumpEnable');
          if (pumpRes.ok) {
            const pumpData = await pumpRes.json();
            if (pumpData.success) {
              const pumpValue = Boolean(pumpData.value);
              // Only update if changed
              setPumpEnabled(prev => prev !== pumpValue ? pumpValue : prev);
            }
          }
        } catch (pumpErr) {
          console.warn('[MainHMI] Pump enable read error:', pumpErr.message || pumpErr);
        }

        // Read homing status variables from PLC
        try {
          const leftHomeEnaRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftHomeEna');
          const leftHomedRes = await fetch('http://localhost:3001/read?tag=GLEFTHEAD.bLeftHeadHomed');
          const rightHomeEnaRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bHmiRightHomeEna');
          const rightHomedRes = await fetch('http://localhost:3001/read?tag=GRIGHTHEAD.bRightHeadHomed');
          
          if (leftHomeEnaRes.ok && leftHomedRes.ok && rightHomeEnaRes.ok && rightHomedRes.ok) {
            const [leftEnaData, leftHomedData, rightEnaData, rightHomedData] = await Promise.all([
              leftHomeEnaRes.json(),
              leftHomedRes.json(),
              rightHomeEnaRes.json(),
              rightHomedRes.json()
            ]);
            
            const newHomingStatus = {
              left: {
                enabled: leftEnaData.success ? Boolean(leftEnaData.value) : false,
                homed: leftHomedData.success ? Boolean(leftHomedData.value) : false
              },
              right: {
                enabled: rightEnaData.success ? Boolean(rightEnaData.value) : false,
                homed: rightHomedData.success ? Boolean(rightHomedData.value) : false
              }
            };
            
            // Only update if changed
            setHomingStatus(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newHomingStatus)) {
                return newHomingStatus;
              }
              return prev;
            });

            // Update homedSides state based on PLC feedback
            setHomedSides({
              left: newHomingStatus.left.homed,
              right: newHomingStatus.right.homed
            });
          }
        } catch (homingErr) {
          console.warn('[MainHMI] Homing status read error:', homingErr.message || homingErr);
        }
      } catch (err) {
        setPlcStatus('bad');
        setPlcConnected(false);
        console.warn('Axis position read failed:', err.message || err);
        // Set positions to 0 on error
        setActualPositions({ right: { axis1: 0, axis2: 0 }, left: { axis1: 0, axis2: 0 } });
      }
    };
    poll();
    timer = setInterval(poll, 500); // Poll every 500ms to reduce UI churn and improve responsiveness
    return () => clearInterval(timer);
  }, []);

  // Program creation states
  const [showSideSelector, setShowSideSelector] = useState(false);
  const [selectedSide, setSelectedSide] = useState(null);
  const [showProgramNameModal, setShowProgramNameModal] = useState(false);
  const [currentProgram, setCurrentProgram] = useState(null);
  const [createdPrograms, setCreatedPrograms] = useState([]);
  const [, setProgramSteps] = useState({});

  // Load recipes from filesystem on mount and auto-load last recipe to PLC
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        const rightRecipes = await loadRecipesFromFolder('right');
        const leftRecipes = await loadRecipesFromFolder('left');
        if (rightRecipes.length > 0) setRecipesRight(rightRecipes);
        if (leftRecipes.length > 0) setRecipesLeft(leftRecipes);
        
        // Auto-load last used recipes to PLC on startup
        const lastRightRecipeName = localStorage.getItem('lastRecipe_right');
        const lastLeftRecipeName = localStorage.getItem('lastRecipe_left');
        
        if (lastRightRecipeName && rightRecipes.length > 0) {
          const lastRightRecipe = rightRecipes.find(r => r.name === lastRightRecipeName);
          if (lastRightRecipe && lastRightRecipe.parameters) {
            console.log(`[MainHMI] Auto-loading last right recipe to PLC: ${lastRightRecipeName}`);
            try {
              await sendRecipeParametersToPLC(lastRightRecipe.parameters, 'right');
              setCurrentRecipe(prev => ({ ...prev, right: lastRightRecipeName }));
              console.log(`[MainHMI] Successfully auto-loaded right recipe parameters to PLC`);
            } catch (err) {
              console.warn(`[MainHMI] Failed to auto-load right recipe to PLC:`, err);
            }
          }
        }
        
        if (lastLeftRecipeName && leftRecipes.length > 0) {
          const lastLeftRecipe = leftRecipes.find(r => r.name === lastLeftRecipeName);
          if (lastLeftRecipe && lastLeftRecipe.parameters) {
            console.log(`[MainHMI] Auto-loading last left recipe to PLC: ${lastLeftRecipeName}`);
            try {
              await sendRecipeParametersToPLC(lastLeftRecipe.parameters, 'left');
              setCurrentRecipe(prev => ({ ...prev, left: lastLeftRecipeName }));
              console.log(`[MainHMI] Successfully auto-loaded left recipe parameters to PLC`);
            } catch (err) {
              console.warn(`[MainHMI] Failed to auto-load left recipe to PLC:`, err);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load recipes:', err);
      }
    };
    loadRecipes();
  }, []);

  const [recipesRight, setRecipesRight] = useState([]);

  const [recipesLeft, setRecipesLeft] = useState([]);

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
    console.log(`[MainHMI] Home Left button clicked, showHomingDialog=${showHomingDialog}, homingSide=${homingSide}`);
    if (homingStatus.left.homed) {
      showMessage('Already Homed', 'Left axis is already homed', 'info');
      return;
    }
    
    try {
      console.log('[MainHMI] Starting left side homing...');
      setHomingSide('left');
      setShowHomingDialog(true);
      setCurrentScreen(SCREEN_INDEX.HOMING);
      await pulseBoolTag('GLEFTHEAD.bHmiEnaLeftHomePb', 200);
      console.log('[MainHMI] Left homing pulse sent');
    } catch (error) {
      setShowHomingDialog(false);
      showMessage('Error', `Failed to trigger left homing: ${error.message}`, 'error');
    }
  };

  const handleHomeRight = async () => {
    console.log(`[MainHMI] Home Right button clicked, showHomingDialog=${showHomingDialog}, homingSide=${homingSide}`);
    if (homingStatus.right.homed) {
      showMessage('Already Homed', 'Right axis is already homed', 'info');
      return;
    }
    
    try {
      console.log('[MainHMI] Starting right side homing...');
      setHomingSide('right');
      setShowHomingDialog(true);
      setCurrentScreen(SCREEN_INDEX.HOMING);
      await pulseBoolTag('GRIGHTHEAD.bHmiEnaRightHomePb', 200);
      console.log('[MainHMI] Right homing pulse sent');
    } catch (error) {
      setShowHomingDialog(false);
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
    
    // Save as last used recipe for this side
    localStorage.setItem(`lastRecipe_${side}`, recipeName);
    
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
    setCurrentScreen(SCREEN_INDEX.RECIPE_MANAGER);
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
    
    // Track as last used recipe
    localStorage.setItem(`lastRecipe_${side}`, recipeName);
    
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

  const handleProgramNameConfirm = async (name) => {
    const programName = name?.trim() ? name.trim() : 'New Program';
    
    // Reset all PLC recipe variables to zero/defaults when starting new program
    try {
      console.log('[MainHMI] Resetting PLC recipe variables for new program');
      const sidePrefix = selectedSide === 'left' ? 'GLEFTHEAD' : 'GRIGHTHEAD';
      const headSuffix = selectedSide === 'left' ? 'Left' : 'Right';
      
      const resetVariables = [
        { tag: `${sidePrefix}.iHmi${headSuffix}Speed`, value: 100 },
        { tag: `${sidePrefix}.tHmi${headSuffix}StepDelay`, value: 500 },
        { tag: `${sidePrefix}.rHmi${headSuffix}TubeID`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}TubeOD`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}FinalSize`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}TubeLength`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}IDFingerRadius`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}Depth`, value: 0.0 }
      ];
      
      // Write each variable to reset them
      for (const variable of resetVariables) {
        try {
          await fetch('http://localhost:3001/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag: variable.tag, value: variable.value })
          });
          console.log(`[MainHMI] Reset ${variable.tag} to ${variable.value}`);
        } catch (err) {
          console.warn(`[MainHMI] Failed to reset ${variable.tag}:`, err.message);
        }
      }
      
      console.log('[MainHMI] PLC recipe variables reset complete');
    } catch (err) {
      console.error('[MainHMI] Error resetting PLC variables:', err.message);
      // Don't fail the program creation, just warn
    }
    
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

  const handleCancelProgram = async () => {
    setShowSideSelector(false);
    setShowProgramNameModal(false);
    setSelectedSide(null);
    setCurrentProgram(null);
    setProgramSteps({});
    setCurrentStep(1);
    setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
    // Explicitly write screen index to PLC
    await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
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

  const handleAutoTeachProgramNameConfirm = async (name) => {
    const programName = name?.trim() ? name.trim() : 'AutoTeach Program';
    
    // Reset all PLC recipe variables to zero/defaults when starting new AutoTeach program
    try {
      console.log('[MainHMI] Resetting PLC recipe variables for AutoTeach');
      const sidePrefix = autoTeachSide === 'left' ? 'GLEFTHEAD' : 'GRIGHTHEAD';
      const headSuffix = autoTeachSide === 'left' ? 'Left' : 'Right';
      
      const resetVariables = [
        { tag: `${sidePrefix}.iHmi${headSuffix}Speed`, value: 100 },
        { tag: `${sidePrefix}.tHmi${headSuffix}StepDelay`, value: 500 },
        { tag: `${sidePrefix}.rHmi${headSuffix}TubeID`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}TubeOD`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}FinalSize`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}TubeLength`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}IDFingerRadius`, value: 0.0 },
        { tag: `${sidePrefix}.rHmi${headSuffix}Depth`, value: 0.0 }
      ];
      
      // Write each variable to reset them
      for (const variable of resetVariables) {
        try {
          await fetch('http://localhost:3001/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag: variable.tag, value: variable.value })
          });
          console.log(`[MainHMI] Reset ${variable.tag} to ${variable.value}`);
        } catch (err) {
          console.warn(`[MainHMI] Failed to reset ${variable.tag}:`, err.message);
        }
      }
      
      console.log('[MainHMI] PLC recipe variables reset complete');
    } catch (err) {
      console.error('[MainHMI] Error resetting PLC variables:', err.message);
      // Don't fail the AutoTeach, just warn
    }
    
    setAutoTeachProgramName(programName);
    setShowAutoTeachNameModal(false);
    setAutoTeachOpen(true);
    // Set screen index based on side
    const screenIndex = autoTeachSide === 'left' ? SCREEN_INDEX.AUTO_TEACH_LEFT : SCREEN_INDEX.AUTO_TEACH_RIGHT;
    setCurrentScreen(screenIndex);
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
    
    // Auto-download the updated program to PLC after saving
    (async () => {
      try {
        // Sync recipe parameters first (if available for this session)
        if (currentParameters && updatedProgram.side) {
          const paramsSent = await sendRecipeParametersToPLC(currentParameters, updatedProgram.side);
          if (!paramsSent) {
            console.warn('[MainHMI] Auto-download: failed to send recipe parameters before program download');
          }
        }

        // Push program to PLC
        await writePLCVar({
          command: 'downloadProgram',
          program: updatedProgram,
          parameters: currentParameters || undefined
        });

        showMessage('Program Saved & Downloaded', `Program "${updatedProgram.name}" saved and sent to ${updatedProgram.side} side`, 'success');
      } catch (err) {
        console.error('[MainHMI] Auto-download failed after save:', err.message);
        showMessage('Program Saved (PLC sync failed)', `Program "${updatedProgram.name}" saved locally, but PLC sync failed: ${err.message}`, 'warning');
      }
    })();

    setShowProgramEditor(false);
    setProgramToEdit(null);
  };

  const handleJogModeSideSwitch = useCallback((newSide) => {
    console.log(`[MainHMI] handleJogModeSideSwitch called with newSide: ${newSide}`);
    setJogActiveSide(newSide);
    // Update screen index to match the new side
    const jogScreenIndex = newSide === 'left' ? SCREEN_INDEX.JOG_MODE_LEFT : SCREEN_INDEX.JOG_MODE_RIGHT;
    setCurrentScreen(jogScreenIndex);
    console.log(`[MainHMI] jogActiveSide state updated to: ${newSide}, screen index: ${jogScreenIndex}`);
  }, []);

  const handleJogDialogClose = useCallback(() => {
    setShowJogDialog(false);
    setJogActiveSide(null);
    setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
  }, []);

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
    console.log(`[MainHMI] handleStartPosition called - side: ${side}`);
    try {
      console.log(`[MainHMI] Calling writePLCVar with startPosition command`);
      await writePLCVar({ command: 'startPosition', side });
      const sideText = side === 'left' ? 'left side' : 'right side';
      console.log(`[MainHMI] StartPosition command successful for ${side}`);
      // Latch UI pulse so momentary write is visible even if PLC poll misses the 200ms window
      setStartPosFeedback(prev => ({ ...prev, [side]: true }));
      setTimeout(() => {
        setStartPosFeedback(prev => ({ ...prev, [side]: false }));
      }, 600);
      showMessage('Start Position', `Moving ${sideText} to start position`, 'info');
    } catch (error) {
      console.error(`[MainHMI] StartPosition error:`, error);
      showMessage('Error', `Failed to send start position command: ${error.message}`, 'error');
    }
  };

  const handleEnableJogButton = async (side) => {
    console.log(`[MainHMI] handleEnableJogButton called for ${side} side`);
    try {
      if (currentUser === 'operator') {
        showMessage('Access Denied', 'Operators cannot jog the machine', 'warning');
        return;
      }
      console.log(`[MainHMI] Calling writePLCVar enableJog for ${side} side...`);
      await writePLCVar({ command: 'enableJog', side });
      console.log(`[MainHMI] EnableJog command successful for ${side} side`);
      
      setShowEnableSideSelector(false);
      // Proactively open the Jog Mode dialog for the selected side
      setJogActiveSide(side);
      setShowJogDialog(true);
      // Set screen index based on which side is active
      const jogScreenIndex = side === 'left' ? SCREEN_INDEX.JOG_MODE_LEFT : SCREEN_INDEX.JOG_MODE_RIGHT;
      setCurrentScreen(jogScreenIndex);
      console.log(`[MainHMI] Jog dialog opened for ${side} side with screen index ${jogScreenIndex}`);
      // Dialog will open automatically when PLC sets jog mode feedback
    } catch (error) {
      console.error(`[MainHMI] Failed to enable jog for ${side} side:`, error);
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

  // Memoize stroke calculation to prevent recalculation on every render
  const jogStrokeMemo = useMemo(() => {
    if (!jogActiveSide) return { id: 2, od: 2 };
    
    const side = jogActiveSide;
    // Read machine parameters from localStorage (stored in inches)
    const machineParams = (() => {
      try {
        const saved = localStorage.getItem('machineParameters');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to load machine parameters');
      }
      return {
        rightIdStroke: 2,
        rightOdStroke: 2,
        leftIdStroke: 2,
        leftOdStroke: 2
      };
    })();
    
    // Get stroke values for the active side (stored in inches)
    const idStrokeInches = side === 'right' ? (machineParams.rightIdStroke || 2) : (machineParams.leftIdStroke || 2);
    const odStrokeInches = side === 'right' ? (machineParams.rightOdStroke || 2) : (machineParams.leftOdStroke || 2);
    
    // Convert to current display units if needed
    const convertPos2 = (val) => unitSystem === 'mm' ? val * 25.4 : val;
    
    return {
      id: convertPos2(idStrokeInches),
      od: convertPos2(odStrokeInches)
    };
  }, [jogActiveSide, unitSystem]);

  return (
    <div className="main-hmi">
      <div className="hmi-header">
        <div className="header-title">
          <h1 className="modern-header">UFM CNC ENDFORMER</h1>
          <span className="header-version">v{packageJson.version}</span>
        </div>
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
                {currentUser === 'operator' ? '▶️' : currentUser === 'setup' ? '⚙️' : currentUser === 'admin' ? '👑' : '🔧'}
              </span>
              <span className="user-role">
                {currentUser === 'operator' ? 'Operator' : currentUser === 'setup' ? 'Setup' : currentUser === 'admin' ? 'Admin' : 'Engineering'}
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
          <div className="machine-status-list">
            {plcConnected ? (
              machineStatus.length > 0 ? (
                machineStatus.map(status => (
                  <div 
                    key={status.bit} 
                    className="status-list-item"
                    style={{ borderColor: status.color, color: status.color }}
                    title={`Bit ${status.bit}`}
                  >
                    <span className="status-dot" style={{ backgroundColor: status.color }} />
                    <span className="status-label">{status.label}</span>
                  </div>
                ))
              ) : (
                <span style={{ color: '#FFC107', fontSize: '14px', fontWeight: '700', letterSpacing: '0.3px', textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)', gridColumn: '1 / -1' }}>⚠ Pump Not Running</span>
              )
            ) : (
              <span style={{ color: '#90CAF9', fontSize: '14px', fontWeight: '700', letterSpacing: '0.3px', textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)', gridColumn: '1 / -1' }}>• PLC not connected</span>
            )}
          </div>
        </div>
      </div>

      <div className="hmi-mode-controls">
        <div className="mode-button-group">
          <button 
            className="mode-control-btn homing-btn"
            onClick={handleHomeLeft}
            disabled={!pumpEnabled || homedSides.left}
            title={
              homedSides.left
                ? 'Left side already homed'
                : pumpEnabled
                  ? 'Home Left Side'
                  : 'Pump must be running to enable homing'
            }
          >
            <span className="mode-icon">🏠</span>
            <span>HOME LEFT</span>
          </button>

          <button 
            className="mode-control-btn homing-btn"
            onClick={handleHomeRight}
            disabled={!pumpEnabled || homedSides.right}
            title={
              homedSides.right
                ? 'Right side already homed'
                : pumpEnabled
                  ? 'Home Right Side'
                  : 'Pump must be running to enable homing'
            }
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
              setCurrentScreen(SCREEN_INDEX.JOG_SIDE_SELECTOR);
              setShowEnableSideSelector(true);
            }}
            disabled={currentUser === 'operator' || (!pumpEnabled && currentUser !== 'admin')}
            title={
              currentUser === 'operator' 
                ? 'Operators cannot jog' 
                : !pumpEnabled && currentUser !== 'admin'
                  ? 'Pump must be running to enable jog'
                  : currentUser === 'admin' && !pumpEnabled
                    ? 'Admin mode: Jog enabled without pump (testing)'
                    : 'Enable jog mode for side'
            }
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
          pumpEnabled={pumpEnabled}
          startPosReadyStatus={startPosReadyStatus}
          startPosFeedback={startPosFeedback}
          homedSides={homedSides}
          atStartPos={atStartPos}
        />
      </div>
 
      <RecipeManager
        isOpen={recipeOpen}
        onClose={async () => { 
          setRecipeOpen(false); 
          setRecipeSide(null);
          setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
          await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
        }}
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
        onClose={async () => {
          setMachineParametersOpen(false);
          setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
          await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
        }}
        plcStatus={plcStatus}
        unitSystem={unitSystem}
        onUnitChange={setUnitSystem}
        userRole={currentUser}
        userPasswords={userPasswords}
        onUpdatePasswords={setUserPasswords}
        onOpenDebug={() => setDebugPanelOpen(true)}
        homingTimeout={homingTimeout}
        onHomingTimeoutChange={(newTimeout) => {
          setHomingTimeout(newTimeout);
          localStorage.setItem('homingTimeout', newTimeout.toString());
        }}
      />

      <DigitalIOPage
        isOpen={ioPageOpen}
        onClose={async () => {
          setIoPageOpen(false);
          setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
          await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
        }}
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
        onClose={async () => {
          setParametersOpen(false);
          setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
          await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
        }}
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
        onClose={async () => {
          setShowProgramEditor(false);
          setProgramToEdit(null);
          setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
          await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
        }}
        program={{ ...programToEdit, recipeName: programToEdit?.side ? currentRecipe[programToEdit.side] : undefined }}
        onSaveProgram={handleSaveProgramChanges}
        onWriteToPLC={handlePLCWrite}
      />

      <AutoAdjustProgram
        isOpen={showAutoAdjust}
        onClose={async () => {
          setShowAutoAdjust(false);
          setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
          await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
        }}
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

        {/* Homing Progress Dialog */}
        <HomingDialog
          isOpen={showHomingDialog}
          onClose={() => {
            console.log(`[MainHMI] HomingDialog onClose called for ${homingSide} side`);
            setShowHomingDialog(false);
            setHomingSide(null);
            setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
            console.log('[MainHMI] Homing dialog closed and state reset');
          }}
          side={homingSide}
          timeout={homingTimeout}
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
          onClose={async () => {
            setAutoTeachOpen(false);
            setAutoTeachSide(null);
            setAutoTeachProgramName('');
            setCurrentScreen(SCREEN_INDEX.MAIN_CONTROL);
            // Explicitly write screen index to PLC on close
            await writeScreenIndex(SCREEN_INDEX.MAIN_CONTROL);
          }}
          programName={autoTeachProgramName}
          side={autoTeachSide}
          actualPositions={autoTeachSide === 'right' ? actualPositions.right : actualPositions.left}
          parameters={currentParameters}
          onSaveProgram={handleSaveAutoTeachProgram}
          onWriteToPLC={handlePLCWrite}
        />

        {/* Jog Mode Dialog */}
        {showJogDialog && jogActiveSide && (
          <JogModeDialog
            side={jogActiveSide}
            isActive={showJogDialog}
            readyStatus={jogReadyStatus[jogActiveSide]}
            actualPositions={jogActiveSide === 'right' ? actualPositions.right : actualPositions.left}
            modeFeedback={modeFeedback[jogActiveSide]}
            strokes={jogStrokeMemo}
            onClose={handleJogDialogClose}
            onSwitchSide={handleJogModeSideSwitch}
          />
        )}
      </>

      {/* DebugPanel disabled - Dev page hidden */}
    </div>
  );
}
