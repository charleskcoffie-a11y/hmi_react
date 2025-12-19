# 10-Step Program Creation - Beckhoff TwinCAT 3 Integration

## Overview

Complete program creation system with 10 configurable steps that maps directly to your PLC data structure.

## PLC Structure Mapping

### Your PLC Definition
```structuredtext
//Step 1
	lLeftPosStep1		:ARRAY [0..3] OF LREAL;
	lRightPosStep1		:ARRAY [0..3] OF LREAL;
	
//Step 2
	lleftPosStep2		:ARRAY [0..3] OF LREAL;
	lRightPosStep2		:ARRAY [0..3] OF LREAL;
	
//Step 3 (Special: index 0-id expand, index 1-id retract, index 2-od expand, index 3-od retract)
	lleftPosStep3		:ARRAY [0..3] OF LREAL;
	lRightPosStep3		:ARRAY [0..3] OF LREAL;
	
//Step 4-10 (Same structure)
	lleftPosStep4		:ARRAY [0..3] OF LREAL;
	lRightPosStep4		:ARRAY [0..3] OF LREAL;
	...
	lleftPosStep10		:ARRAY [0..3] OF LREAL;
	lRightPosStep10		:ARRAY [0..3] OF LREAL;
```
**Position Arrays:**
```structuredtext
// Left side - Steps 1-10
lLeftPosStep1	: ARRAY [0..3] OF LREAL;
lLeftPosStep2	: ARRAY [0..3] OF LREAL;
lLeftPosStep3	: ARRAY [0..3] OF LREAL;  // Special: expand/retract
// ... lLeftPosStep4 through lLeftPosStep10

// Right side - Steps 1-10
lRightPosStep1	: ARRAY [0..3] OF LREAL;
lRightPosStep2	: ARRAY [0..3] OF LREAL;
lRightPosStep3	: ARRAY [0..3] OF LREAL;  // Special: expand/retract
// ... lRightPosStep4 through lRightPosStep10
```

**Sequence Counters (NEW - INT tracking):**
```structuredtext
// Left head sequence counters
iSeqLStep1	: INT;
iSeqLStep2	: INT;
iSeqLStep3	: INT;
iSeqLStep4	: INT;
iSeqLStep5	: INT;
iSeqLStep6	: INT;
iSeqLStep7	: INT;
iSeqLStep8	: INT;
iSeqLStep9	: INT;
iSeqLStep10	: INT;

// Right head sequence counters
iSeqRStep1	: INT;
iSeqRStep2	: INT;
iSeqRStep3	: INT;
iSeqRStep4	: INT;
iSeqRStep5	: INT;
iSeqRStep6	: INT;
iSeqRStep7	: INT;
iSeqRStep8	: INT;
iSeqRStep9	: INT;
iSeqRStep10	: INT;
```

### HMI Data Structure
```javascript
programData = {
  name: "Part_Assembly_01",
  side: "right",  // or "left"
  createdAt: "2025-12-18T10:30:00.000Z",
  steps: {
    1: {
      step: 1,
      stepName: "Position Recording",
      positions: {
        "Axis1 (ID)": 50.25,      // index 0
        "Axis2 (OD)": 75.50       // index 1
      },
      timestamp: "2025-12-18T10:32:00.000Z"
    },
    2: {
      step: 2,
      stepName: "Work Position",
      positions: {
        "Axis1 (ID)": 60.00,
        "Axis2 (OD)": 85.00
      },
      timestamp: "2025-12-18T10:35:00.000Z"
    },
    3: {
      step: 3,
      stepName: "Expand/Retract Positions",
      positions: {
        "Axis1 (ID)": {
          expand: 70.00,           // index 0
          retract: 30.00           // index 1
        },
        "Axis2 (OD)": {
          expand: 95.00,           // index 2
          retract: 55.00           // index 3
        }
      },
      timestamp: "2025-12-18T10:38:00.000Z"
    },
    4: {
      step: 4,
      // Similar to step 1, 2
      positions: { ... }
    },
    // ... Steps 5-10
  },
  completedAt: "2025-12-18T10:55:00.000Z"
}
```

## Array Index Mapping

### Right Side (Axis 1 & 2)
```
Index 0: Axis 1 (ID) - Inner Diameter
Index 1: Axis 2 (OD) - Outer Diameter
Index 2: (Unused/Reserved)
Index 3: (Unused/Reserved)
Sequence: iSeqRStepN (INT) for step N
```

### Left Side (Axis 3 & 4)
```
Index 0: Axis 3 (ID) - Inner Diameter
Index 1: Axis 4 (OD) - Outer Diameter
Index 2: (Unused/Reserved)
Index 3: (Unused/Reserved)
Sequence: iSeqLStepN (INT) for step N
```

### Special for Step 3 (Expand/Retract)
```
Index 0: ID Expand
Index 1: ID Retract
Index 2: OD Expand
Index 3: OD Retract
Sequence: iSeq{L|R}Step3 tracks execution/order for step 3
```

## Sequence Counter Integration

- Naming: iSeqLStep1..10 (left head), iSeqRStep1..10 (right head), all INT
- Purpose: Track execution order/state per step alongside position arrays
- HMI writes: initialized to 0 when sending a program; you can overwrite with any INT
- HMI reads: available via readSequenceCounter(side, stepNum)
- Mock mode: stored in mockPLCData.sequences for development without PLC

### PLC Service APIs (sequence)
```javascript
import { readSequenceCounter, writeSequenceCounter } from './services/plcService';

// Read counter
const seq = await readSequenceCounter('right', 4); // iSeqRStep4

// Write counter
await writeSequenceCounter('left', 2, 7); // iSeqLStep2 = 7
```

## Step Pattern Flags (Decode)

TwinCAT flags `aSeqRStep[2..10]` (and equivalent for left if present) use these codes per step:

| Code | Meaning                 |
|------|-------------------------|
| 0    | Red Ext                 |
| 1    | Red Ret                 |
| 2    | Exp Ext                 |
| 3    | Exp Ret                 |
| 4    | RedRet + ExpRet         |
| 5    | Repeat                  |
| 6    | RedExt + ExpExt         |
| 8    | All off                 |

**Notes:**
- Applies to steps 2..10 (step 1 typically start/position capture).
- Store in INT arrays (e.g., `aSeqRStep : ARRAY[2..10] OF INT;`).
- HMI currently does not write these flags; add ADS symbols and UI bindings if you want operators to edit patterns.

## Sequence Variable Integration

### Purpose

The sequence counter variables (iSeqLStepN / iSeqRStepN) track execution state for each step:
- **0 (default)**: Step not executed
- **1+**: Step counter for tracking step execution progress
- **Value interpretation**: Can be used by PLC for conditional logic, cycle counting, or validation

### Writing Sequence Variables

When a program is sent to the HMI from the PLC, all sequence counters are initialized to **0**:

```javascript
// In plcService.js - sendProgramToPLC()
for (let stepNum = 1; stepNum <= 10; stepNum++) {
  // Write position array
  await adsClient.writeSymbol(`PlcState.l${side}PosStep${stepNum}`, arrayValues);
  
  // Initialize sequence counter to 0
  await adsClient.writeSymbol(`PlcState.iSeq${sidePrefix}Step${stepNum}`, { value: 0 });
}
```

### Reading Sequence Variables

The HMI can read current sequence counter values:

```javascript
const currentValue = await readSequenceCounter('right', 1);  // Get iSeqRStep1
console.log(`Step 1 sequence value: ${currentValue}`);
```

### PLC Writing to Sequence Variables

Your TwinCAT 3 program can update these counters to provide feedback to the HMI:

```structuredtext
// Example in TwinCAT program
IF bStep1Complete THEN
  iSeqRStep1 := 100;  // Mark as complete
ELSIF bStep1Running THEN
  iSeqRStep1 := 50;   // Mark as in-progress
ELSE
  iSeqRStep1 := 0;    // Not started
END_IF;
```

## Component Architecture

### 1. **ProgramCreationStep1.js** - Position Recording
- Records starting position for both axes
- Automatically enables JOG MODE
- Input: Two axis positions
- Output: Step 1 data with 2 position values

### 2. **ProgramCreationStep2.js** - Work Position
- Records desired work location
- Same UI as Step 1
- Input: Two axis positions
- Output: Step 2 data with 2 position values

### 3. **ProgramCreationStep3.js** - Expand/Retract Positions
- Special handling for expand/retract movements
- Records 4 positions:
  - ID Expand (index 0)
  - ID Retract (index 1)
  - OD Expand (index 2)
  - OD Retract (index 3)
- Input: 4 positions
- Output: Step 3 data mapped to array indices 0-3

### 4-10. **GenericProgramStep.js** - Standard Steps
- Generic template for steps 4-10
- Each records 2 positions (like Step 1 & 2)
- Configurable step names and descriptions
- Input: Two axis positions
- Output: Step N data with 2 position values

## Data Flow

```
Main HMI
    ↓
Add Program Button
    ↓
Side Selector (Right/Left)
    ↓
Program Name Entry
    ↓
Step 1: Position Recording
    ↓ (save step1 data)
Step 2: Work Position
    ↓ (save step2 data)
Step 3: Expand/Retract (Special)
    ↓ (save step3 data with 4 indices)
Step 4-10: Generic Steps
    ↓ (save each step data)
Program Complete
    ↓
Send to PLC via ADS
    ↓
Return to Main HMI
```

## Beckhoff ADS Integration

### Service File: `services/plcService.js`

```javascript
import { TwinCAT } from '@beckhoff/ads';

const adsClient = new TwinCAT.AdsClient();

export const sendProgramToPLC = async (programData) => {
  try {
    await adsClient.connect('127.0.0.1', 851); // Target PLC
    
    const side = programData.side === 'right' ? 'Right' : 'Left';
    
    for (let stepNum = 1; stepNum <= 10; stepNum++) {
      const stepData = programData.steps[stepNum];
      if (!stepData) continue;
      
      const positions = stepData.positions;
      let arrayValues = [0, 0, 0, 0];
      
      if (stepNum === 3) {
        // Special handling for Step 3
        arrayValues[0] = positions['Axis' + (programData.side === 'right' ? '1' : '3') + ' (ID)'].expand;
        arrayValues[1] = positions['Axis' + (programData.side === 'right' ? '1' : '3') + ' (ID)'].retract;
        arrayValues[2] = positions['Axis' + (programData.side === 'right' ? '2' : '4') + ' (OD)'].expand;
        arrayValues[3] = positions['Axis' + (programData.side === 'right' ? '2' : '4') + ' (OD)'].retract;
      } else {
        // Standard steps
        const axis1Value = programData.side === 'right' 
          ? positions['Axis1 (ID)'] 
          : positions['Axis3 (ID)'];
        const axis2Value = programData.side === 'right' 
          ? positions['Axis2 (OD)'] 
          : positions['Axis4 (OD)'];
          
        arrayValues[0] = axis1Value;
        arrayValues[1] = axis2Value;
      }
      
      // Write to PLC
      const symbolName = `PlcState.l${side}PosStep${stepNum}`;
      await adsClient.writeSymbol(symbolName, arrayValues);
      
      console.log(`Step ${stepNum} sent to PLC: ${symbolName}`);
    }
    
    console.log('Program sent to PLC successfully');
    
  } catch (error) {
    console.error('Failed to send program to PLC:', error);
    throw error;
  }
};

export const readProgramFromPLC = async (side, step) => {
  try {
    await adsClient.connect('127.0.0.1', 851);
    const symbolName = `PlcState.l${side}PosStep${step}`;
    const positions = await adsClient.readSymbol(symbolName);
    return positions;
  } catch (error) {
    console.error('Failed to read program from PLC:', error);
  }
};
```

### Integration in MainHMI.js

```javascript
import { sendProgramToPLC } from './services/plcService';

const handleProgramComplete = (allSteps) => {
  const completedProgram = {
    ...currentProgram,
    steps: allSteps,
    completedAt: new Date().toISOString()
  };

  setCreatedPrograms([...createdPrograms, completedProgram]);
  
  // Send to PLC
  try {
    await sendProgramToPLC(completedProgram);
    alert(`Program "${currentProgram.name}" sent to PLC successfully!`);
  } catch (error) {
    alert(`Error sending program to PLC: ${error.message}`);
  }
  
  handleCancelProgram();
};
```

## Step Configuration

Each step is defined with:
- **stepNumber**: 1-10
- **stepName**: Display name in UI
- **description**: User instructions
- **dataIndices**: Which array indices to populate

```javascript
const STEP_CONFIG = {
  1: { name: 'Position Recording', description: 'Record starting position for both axes' },
  2: { name: 'Work Position', description: 'Position both axes at the desired work location' },
  3: { name: 'Expand/Retract Positions', description: 'Record expand and retract positions' },
  4: { name: 'Step 4 Position', description: 'Record axis positions for step 4' },
  5: { name: 'Step 5 Position', description: 'Record axis positions for step 5' },
  6: { name: 'Step 6 Position', description: 'Record axis positions for step 6' },
  7: { name: 'Step 7 Position', description: 'Record axis positions for step 7' },
  8: { name: 'Step 8 Position', description: 'Record axis positions for step 8' },
  9: { name: 'Step 9 Position', description: 'Record axis positions for step 9' },
  10: { name: 'Final Position', description: 'Record final position for step 10' }
};
```

## TwinCAT 3 Project Structure

```structuredtext
PROGRAM MAIN
VAR
  (* Program storage *)
  Programs : ARRAY[0..99] OF ST_ProgramData;
  CurrentProgram : ST_ProgramData;
  
  (* Step position storage *)
  lLeftPosStep1  : ARRAY[0..3] OF LREAL;
  lRightPosStep1 : ARRAY[0..3] OF LREAL;
  lLeftPosStep2  : ARRAY[0..3] OF LREAL;
  lRightPosStep2 : ARRAY[0..3] OF LREAL;
  lLeftPosStep3  : ARRAY[0..3] OF LREAL;
  lRightPosStep3 : ARRAY[0..3] OF LREAL;
  (* ... Steps 4-10 *)
END_VAR
```

## Error Handling

### Validation Rules
1. **Position Values**
   - Range: -1000 to +1000 mm
   - Data type: LREAL (float)
   - Step 3 special handling for 4 values

2. **PLC Connection**
   - Verify ADS connection status
   - Check PLC is running
   - Validate AMS ports
   - Handle timeout scenarios

3. **Data Integrity**
   - All steps must be recorded
   - Array indices must match PLC structure
   - Timestamps for tracking

### Error Messages
```javascript
if (!axis1Recorded || !axis2Recorded) {
  throw new Error('Please record positions for both axes');
}
if (Math.abs(position) > 1000) {
  throw new Error('Position exceeds maximum range (-1000 to +1000 mm)');
}
if (!plcConnected) {
  throw new Error('PLC connection failed. Check network and TwinCAT service');
}
```

## Testing Checklist

- [ ] Side selection works (Left/Right)
- [ ] Program name entry validates correctly
- [ ] Step 1 position recording works
- [ ] Step 2 position recording works
- [ ] Step 3 expand/retract recording (4 positions)
- [ ] Steps 4-10 generic steps work
- [ ] Previous button navigates back
- [ ] Complete button saves all steps
- [ ] Cancel button works at any step
- [ ] Data sends to PLC successfully
- [ ] Array indices match PLC structure
- [ ] Both right and left sides work
- [ ] Position values persist correctly

## Component File Structure

```
src/
├── components/
│   ├── ProgramCreationStep1.js      # Starting position
│   ├── ProgramCreationStep2.js      # Work position
│   ├── ProgramCreationStep3.js      # Expand/Retract (4 positions)
│   ├── GenericProgramStep.js        # Steps 4-10 template
│   ├── SideSelector.js              # Left/Right selection
│   ├── ProgramNameModal.js          # Name entry
│   └── VirtualKeyboard.js           # Input method
├── services/
│   └── plcService.js                # ADS communication
├── styles/
│   ├── ProgramCreationStep1.css
│   ├── ProgramCreationStep2.css
│   ├── ProgramCreationStep3.css
│   ├── GenericProgramStep.css
│   ├── SideSelector.css
│   └── ProgramNameModal.css
└── MainHMI.js                       # Program controller
```

## Future Enhancements

1. **Program Editing**: Load and modify existing programs
2. **Program Cloning**: Duplicate programs with variations
3. **Conditional Branching**: IF/THEN logic between steps
4. **Dwell Time**: Add time delays between steps
5. **Tool Changes**: Select tools for specific steps
6. **Tool Offsets**: Apply position offsets
7. **Sensor Checks**: Verify conditions before proceeding
8. **Logging**: Store program execution history
9. **Batch Processing**: Multiple programs in sequence
10. **Program Preview**: Visual representation before running

## Performance Notes

- JOG MODE enabled automatically for each step
- Real-time position updates
- Smooth slider and jog controls
- Responsive UI with minimal lag
- Efficient state management
- Optimized re-renders

## Support & Troubleshooting

### Common Issues

**PLC Connection Failed**
- Check TwinCAT service is running
- Verify ADS port 851 is accessible
- Confirm network connectivity
- Check firewall rules

**Position Values Not Saving**
- Ensure both axes are recorded
- Check array index mapping
- Verify LREAL data type in PLC

**Step Navigation Issues**
- Clear browser cache
- Check component mounting
- Verify state updates

### Debug Logging

```javascript
// Enable detailed logging
console.log('Program Data:', programData);
console.log('PLC Structure:', plcData);
console.log('Step:', currentStep);
console.log('Positions:', recordedPositions);
```
