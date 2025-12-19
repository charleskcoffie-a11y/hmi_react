import { AdsClient } from 'ads-client';

const PLC_CONFIG = {
  TARGET_IP: '169.254.109.230.1.1', // Provided NetID
  ADS_PORT: 851, // Provided port
  TIMEOUT: 5000,
};

const adsClient = new AdsClient();

/**
 * Convert HMI program data to PLC command position format
 * Positions recorded during teaching are command positions for execution
 * @param {Object} programData - Complete program with all 10 steps
 * @param {String} side - 'left' or 'right'
 * @param {Number} stepNum - Step number 1-10
 * @returns {Object} Command position data for PLC
 */
const convertToPLCCommandPositions = (programData, side, stepNum) => {
  const stepData = programData.steps[stepNum];
  
  if (!stepData) {
    return {
      fAxis1Cmd: 0.0,
      fAxis2Cmd: 0.0,
      iPattern: 0,
      repeat: false,
      repeatTimes: 0,
      bValid: false
    };
  }

  // For steps 4-10, include repeat and repeatTimes
  const isRepeatStep = stepNum >= 4 && stepNum <= 10;
  return {
    fAxis1Cmd: stepData.positions.axis1Cmd || 0.0,  // Command position for axis 1
    fAxis2Cmd: stepData.positions.axis2Cmd || 0.0,  // Command position for axis 2
    iPattern: stepData.pattern || 0,                 // Pattern code (0-8)
    repeat: isRepeatStep ? !!stepData.repeat : false,
    repeatTimes: isRepeatStep ? (stepData.repeatTimes || 0) : 0,
    bValid: true                                      // Step is valid
  };
};

/**
 * Legacy function - kept for backwards compatibility
 * Convert HMI program data to PLC array format
 * @deprecated Use convertToPLCCommandPositions instead
 */
const convertToPLCArray = (programData, side, stepNum) => {
  const cmdPos = convertToPLCCommandPositions(programData, side, stepNum);
  return [cmdPos.fAxis1Cmd, cmdPos.fAxis2Cmd, 0, 0];
};

/**
 * Send complete program to PLC
 * Writes all 10 steps to respective PLC variables and initializes sequence counters
 * 
 * @param {Object} programData - Program with all steps
 * @returns {Promise}
 * @throws {Error} If PLC connection fails
 */
export const sendProgramToPLC = async (programData) => {
  try {
    console.log('Connecting to PLC:', PLC_CONFIG.TARGET_IP);
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);

    const side = programData.side === 'right' ? 'Right' : 'Left';
    const results = [];

    for (let stepNum = 1; stepNum <= 10; stepNum++) {
      const arrayValues = convertToPLCArray(programData, programData.side, stepNum);
      const symbolName = `PlcState.l${side}PosStep${stepNum}`;
      console.log(`Writing ${symbolName}:`, arrayValues);
      await adsClient.writeSymbol(symbolName, {
        type: 'ARRAY',
        values: arrayValues,
        dataType: 'LREAL'
      });

      const seqVarName = getSequenceVariableName(programData.side, stepNum);
      console.log(`Writing ${seqVarName}: 0 (initialized)`);
      await adsClient.writeSymbol(seqVarName, {
        type: 'INT',
        value: 0
      });

      const patternValue = programData.steps[stepNum]?.pattern ?? 8;
      const patternArray = getPatternArrayName(programData.side);
      const patternSymbol = `${patternArray}[${stepNum}]`;
      console.log(`Writing ${patternSymbol}: ${patternValue}`);
      await adsClient.writeSymbol(patternSymbol, { type: 'INT', value: patternValue });

      results.push({
        step: stepNum,
        positionSymbol: symbolName,
        sequenceSymbol: seqVarName,
        patternSymbol,
        values: arrayValues,
        pattern: patternValue,
        status: 'success'
      });
    }

    await adsClient.disconnect();

    console.log('Program sent to PLC successfully:', results);
    return results;

  } catch (error) {
    console.error('Failed to send program to PLC:', error);
    throw new Error(`PLC communication error: ${error.message}`);
  }
};

/**
 * Read sequence counter from PLC
 * @param {String} side - 'left' or 'right'
 * @param {Number} stepNum - Step number 1-10
 * @returns {Promise<Number>} Sequence counter value
 */
export const readSequenceCounter = async (side, stepNum) => {
  try {
    const seqVarName = getSequenceVariableName(side, stepNum);
    console.log(`Reading from PLC: ${seqVarName}`);
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    const value = await adsClient.readSymbol(seqVarName);
    await adsClient.disconnect();
    return value;
  } catch (error) {
    console.error(`Failed to read sequence counter from PLC:`, error);
    throw error;
  }
};

/**
 * Write sequence counter to PLC
 * @param {String} side - 'left' or 'right'
 * @param {Number} stepNum - Step number 1-10
 * @param {Number} value - Counter value
 * @returns {Promise}
 */
export const writeSequenceCounter = async (side, stepNum, value) => {
  try {
    const seqVarName = getSequenceVariableName(side, stepNum);
    console.log(`Writing ${seqVarName}: ${value}`);
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    await adsClient.writeSymbol(seqVarName, {
      type: 'INT',
      value: value
    });
    await adsClient.disconnect();
    return { success: true, variable: seqVarName, value };
  } catch (error) {
    console.error(`Failed to write sequence counter to PLC:`, error);
    throw error;
  }
};

/**
 * Read program from PLC (for editing existing programs)
 * @param {String} side - 'left' or 'right'
 * @param {Number} stepNum - Step number 1-10
 * @returns {Promise<Array>} Position values
 */
export const readProgramFromPLC = async (side, stepNum) => {
  try {
    const sideLabel = side === 'right' ? 'Right' : 'Left';
    const symbolName = `PlcState.l${sideLabel}PosStep${stepNum}`;
    console.log(`Reading from PLC: ${symbolName}`);
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    const positions = await adsClient.readSymbol(symbolName);
    await adsClient.disconnect();
    return positions;
  } catch (error) {
    console.error('Failed to read program from PLC:', error);
    throw error;
  }
};

/**
 * Write complete program command positions to PLC
 * @param {Object} programData - Program with recorded command positions
 * @param {String} side - 'left' or 'right'
 * @returns {Promise<Boolean>} Success status
 */
export const writeProgramToPLC = async (programData, side) => {
  try {
    const prefix = side === 'right' ? 'R' : 'L';
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    for (let stepNum = 1; stepNum <= 10; stepNum++) {
      const cmdPos = convertToPLCCommandPositions(programData, side, stepNum);
      if (cmdPos.bValid) {
        await adsClient.writeSymbol(`PlcState.aStep${prefix}[${stepNum}]`, cmdPos);
      }
    }
    await adsClient.disconnect();
    return true;
  } catch (error) {
    console.error('Error writing program to PLC:', error);
    return false;
  }
};

/**
 * Execute a specific step by sending command positions to PLC
 * @param {Number} stepNum - Step number to execute
 * @param {Object} stepData - Step data with command positions
 * @param {String} side - 'left' or 'right'
 * @returns {Promise<Boolean>} Success status
 */
export const executeStep = async (stepNum, stepData, side) => {
  try {
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    // 1. Write command positions to PLC
    await adsClient.writeSymbol(`PlcState.Step${side}[${stepNum}]`, stepData.positions);
    // 2. Set pattern flag
    await adsClient.writeSymbol(`PlcState.Pattern${side}[${stepNum}]`, { type: 'INT', value: stepData.pattern });
    // 3. Trigger step execution (assuming a trigger symbol exists)
    await adsClient.writeSymbol(`PlcState.Trigger${side}`, { type: 'BOOL', value: true });
    await adsClient.disconnect();
    return true;
  } catch (error) {
    console.error('Error executing step:', error);
    return false;
  }
};

/**
 * Read actual axis positions from PLC for a side
 * @param {'right'|'left'} side
 * @returns {Promise<{axis1:number, axis2:number}>}
 */
export const readActualPositions = async (side) => {
  try {
    const symbols = getActualPositionSymbols(side);
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    const axis1 = await adsClient.readSymbol(symbols.axis1);
    const axis2 = await adsClient.readSymbol(symbols.axis2);
    await adsClient.disconnect();
    return { axis1, axis2 };
  } catch (error) {
    console.error('Failed to read actual positions from PLC:', error);
    throw error;
  }
};

/**
 * Read side state DINT and description STRING(80) from PLC
 * @param {'right'|'left'} side
 * @returns {Promise<{state:number, desc:string}>}
 */
export const readSideState = async (side) => {
  try {
    const symbols = getSideStateSymbols(side);
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    const stateVal = await adsClient.readSymbol(symbols.state); // DINT
    const stateDesc = await adsClient.readSymbol(symbols.desc); // STRING(80)
    await adsClient.disconnect();
    return { state: stateVal, desc: stateDesc };
  } catch (error) {
    console.error('Failed to read side state from PLC:', error);
    throw error;
  }
};

/**
 * Check PLC connection status
 * @returns {Promise<Boolean>}
 */
export const checkPLCConnection = async () => {
  try {
    await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
    await adsClient.disconnect();
    return true;
  } catch (error) {
    console.error('PLC not accessible:', error);
    return false;
  }
};

/**
 * Mock PLC Functions (for development without hardware)
 */

const mockPLCData = {
  Right: {
    positions: {},
    sequences: {},
    patterns: {}
  },
  Left: {
    positions: {},
    sequences: {},
    patterns: {}
  }
};

const mockActualPositions = {
  right: { axis1: 0, axis2: 0 },
  left: { axis1: 0, axis2: 0 }
};

const mockSideStates = {
  right: { state: 0, desc: 'Idle' },
  left: { state: 0, desc: 'Idle' }
};

export const sendProgramToMockPLC = (programData) => {
  const side = programData.side === 'right' ? 'Right' : 'Left';
  
  for (let stepNum = 1; stepNum <= 10; stepNum++) {
    const arrayValues = convertToPLCArray(programData, programData.side, stepNum);
    mockPLCData[side].positions[`Step${stepNum}`] = arrayValues;
    mockPLCData[side].sequences[`Step${stepNum}`] = 0;  // Initialize sequence counter
    mockPLCData[side].patterns[`Step${stepNum}`] = programData.steps[stepNum]?.pattern ?? 8;
  }
  
  console.log('Program saved to mock PLC:', mockPLCData);
  return Promise.resolve({
    success: true,
    message: 'Program saved to mock PLC',
    data: mockPLCData[side]
  });
};

export const readProgramFromMockPLC = (side, stepNum) => {
  const sideLabel = side === 'right' ? 'Right' : 'Left';
  return Promise.resolve(mockPLCData[sideLabel].positions[`Step${stepNum}`] || [0, 0, 0, 0]);
};

export const readSequenceFromMockPLC = (side, stepNum) => {
  const sideLabel = side === 'right' ? 'Right' : 'Left';
  return Promise.resolve(mockPLCData[sideLabel].sequences[`Step${stepNum}`] || 0);
};

export const writeSequenceToMockPLC = (side, stepNum, value) => {
  const sideLabel = side === 'right' ? 'Right' : 'Left';
  mockPLCData[sideLabel].sequences[`Step${stepNum}`] = value;
  console.log(`Mock PLC - Wrote sequence: ${sideLabel} Step${stepNum} = ${value}`);
  return Promise.resolve({ success: true, value });
};

/**
 * Export program data as JSON (for backup/sharing)
 * @param {Object} programData
 * @returns {String} JSON string
 */
export const exportProgramAsJSON = (programData) => {
  return JSON.stringify(programData, null, 2);
};

/**
 * Import program data from JSON
 * @param {String} jsonString
 * @returns {Object} Program data
 */
export const importProgramFromJSON = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON format: ${error.message}`);
  }
};

/**
 * Validate program data structure
 * @param {Object} programData
 * @returns {Object} Validation result
 */
export const validateProgramData = (programData) => {
  const errors = [];
  
  if (!programData.name) errors.push('Program name is required');
  if (!programData.side || !['left', 'right'].includes(programData.side)) {
    errors.push('Valid side selection required (left/right)');
  }
  if (!programData.steps) errors.push('No steps defined');
  
  // Check all 10 steps
  for (let i = 1; i <= 10; i++) {
    if (!programData.steps[i]) {
      errors.push(`Step ${i} is missing`);
    } else {
      const step = programData.steps[i];
      if (!step.positions) errors.push(`Step ${i} has no positions`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: []
  };
};

/**
 * Get PLC diagnostics information
 * @returns {Promise<Object>}
 */
export const getPLCDiagnostics = async () => {
  return {
    plcIp: PLC_CONFIG.TARGET_IP,
    adsPort: PLC_CONFIG.ADS_PORT,
    timeout: PLC_CONFIG.TIMEOUT,
    // mockMode: false,
    // connected: false,
    timestamp: new Date().toISOString()
  };
};

/**
 * PLC Data Structure Documentation
 * 
 * Each program step stores an array of 4 LREAL values:
 * 
 * Right Side:
 *   Index 0: Axis 1 (ID) position
 *   Index 1: Axis 2 (OD) position
 *   Index 2: Reserved
 *   Index 3: Reserved
 * 
 * Left Side:
 *   Index 0: Axis 3 (ID) position
 *   Index 1: Axis 4 (OD) position
 *   Index 2: Reserved
 *   Index 3: Reserved
 * 
 * Step 3 Special Handling:
 *   Index 0: ID Expand position
 *   Index 1: ID Retract position
 *   Index 2: OD Expand position
 *   Index 3: OD Retract position
 */

/**
 * Momentary button pulse - sends TRUE then FALSE after brief delay
 * @param {string} tagName - PLC variable name
 * @param {number} pulseMs - Duration to hold TRUE (default 100ms)
 * @returns {Promise<void>}
 */
export const sendMomentaryButton = async (tagName, pulseMs = 100) => {
  try {
    // Mock implementation - in production, use ADS write
    console.log(`[HMI → PLC] Momentary pulse on ${tagName} for ${pulseMs}ms`);
    
    // Simulate setting to TRUE
    console.log(`  Set ${tagName} = TRUE`);
    
    // Wait for pulse duration
    await new Promise(resolve => setTimeout(resolve, pulseMs));
    
    // Reset to FALSE
    console.log(`  Set ${tagName} = FALSE`);
    
    // TODO: Replace with actual ADS write when PLC connected
    // const adsWriteSymbol = async (symbol, value) => {
    //   await adsClient.writeSymbol(tagName, value);
    // };
    // await adsWriteSymbol(tagName, true);
    // await new Promise(resolve => setTimeout(resolve, pulseMs));
    // await adsWriteSymbol(tagName, false);
  } catch (error) {
    console.error(`Error sending momentary button ${tagName}:`, error);
    throw error;
  }
};

/**
 * Send GO TO START command for specified side
 * @param {string} side - 'left' or 'right'
 * @returns {Promise<void>}
 */
export const sendStartPosition = async (side) => {
  const tagName = side === 'left' ? 'bHmiLeftStartPosPb' : 'bHmiRightStartPosPb';
  return sendMomentaryButton(tagName, 100);
};

/**
 * Send HOME command for specified side
 * @param {string} side - 'left' or 'right'
 * @returns {Promise<void>}
 */
export const sendHomeCommand = async (side) => {
  const tagName = side === 'left' ? 'bHmiEnaLeftHomePb' : 'bHmiEnaRightHomePb';
  return sendMomentaryButton(tagName, 100);
};

/**
 * Send ENABLE JOG command for specified side
 * @param {string} side - 'left' or 'right'
 * @returns {Promise<void>}
 */
export const sendEnableJog = async (side) => {
  const tagName = side === 'left' ? 'bHmiLeftJogPb' : 'bHmiRightJogPb';
  return sendMomentaryButton(tagName, 100);
};

/**
 * Send RUN command for specified side
 * @param {string} side - 'left' or 'right'
 * @returns {Promise<void>}
 */
export const sendRunCommand = async (side) => {
  const tagName = side === 'left' ? 'bHmiLeftRunPb' : 'bHmiRightRunPb';
  return sendMomentaryButton(tagName, 100);
};
