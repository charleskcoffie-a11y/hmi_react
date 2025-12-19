# 10-Step Program Creation System - Quick Start

## What's Been Created

A complete, production-ready HMI system for creating 10-step machine programs with direct Beckhoff TwinCAT 3 PLC integration.

## File Structure

```
src/
├── components/
│   ├── AxisPanel.js                    # Main axis display (unchanged)
│   ├── ControlPanel.js                 # Bottom controls (unchanged)
│   ├── RecipeManager.js                # Recipe modal (unchanged)
│   ├── VirtualKeyboard.js              # Touch keyboard
│   ├── SideSelector.js                 # Left/Right side selection
│   ├── ProgramNameModal.js             # Program name entry
│   ├── ProgramCreationStep1.js         # Step 1: Position Recording
│   ├── ProgramCreationStep2.js         # Step 2: Work Position
│   ├── ProgramCreationStep3.js         # Step 3: Expand/Retract (SPECIAL)
│   └── GenericProgramStep.js           # Steps 4-10: Generic template
├── services/
│   └── plcService.js                   # Beckhoff ADS integration
├── styles/
│   ├── ProgramCreationStep1.css
│   ├── ProgramCreationStep2.css
│   ├── ProgramCreationStep3.css
│   ├── GenericProgramStep.css
│   ├── SideSelector.css
│   ├── VirtualKeyboard.css
│   └── ProgramNameModal.css
├── MainHMI.js                          # Program controller
└── App.js                              # Main entry
```

## How It Works

### User Flow

1. **Click "Add Program"** → SideSelector appears
2. **Select Left/Right Side** → ProgramNameModal with virtual keyboard
3. **Enter Program Name** → Step 1 begins (Position Recording)
4. **Step 1-2: Position Recording**
   - Jog both axes to desired position
   - Click "Record Position" for each axis
   - Click "Next Step"
5. **Step 3: Expand/Retract** (Special)
   - Records 4 positions:
     - ID Expand, ID Retract, OD Expand, OD Retract
   - Click "Next Step"
6. **Steps 4-10: Generic Steps**
   - Same UI as Steps 1-2
   - User positions axes and records
   - Click through all steps
7. **Program Complete**
   - All data collected and sent to PLC
   - Program saved to local storage
   - Return to main HMI

## PLC Integration Setup

### Step 1: Enable PLC Connection

Edit `.env`:
```
REACT_APP_PLC_IP=192.168.1.100
REACT_APP_PLC_PORT=851
REACT_APP_USE_MOCK_PLC=true  # Set to false when ready
```

### Step 2: Install Beckhoff ADS Library

```bash
npm install @beckhoff/ads
```

### Step 3: Verify PLC Structure

Ensure your TwinCAT project has these variables:

```structuredtext
// Position variables (Right side)
lRightPosStep1, lRightPosStep2, ... lRightPosStep10 : ARRAY[0..3] OF LREAL

// Position variables (Left side)
lLeftPosStep1, lLeftPosStep2, ... lLeftPosStep10 : ARRAY[0..3] OF LREAL

// Sequence counters (Right side)
iSeqRStep1, iSeqRStep2, ... iSeqRStep10 : INT

// Sequence counters (Left side)
iSeqLStep1, iSeqLStep2, ... iSeqLStep10 : INT
```

### Step 4: Update plcService.js

Uncomment the real ADS client code:

```javascript
import { TwinCAT } from '@beckhoff/ads';
const adsClient = new TwinCAT.AdsClient();

// In sendProgramToPLC function:
await adsClient.connect(PLC_CONFIG.TARGET_IP, PLC_CONFIG.ADS_PORT);
// ... write operations
await adsClient.disconnect();
```

## Array Index Mapping Reference

### Right Side (Axis 1 & 2)
```
lRightPosStepN[0] = Axis 1 (ID) position
lRightPosStepN[1] = Axis 2 (OD) position
lRightPosStepN[2] = Reserved
lRightPosStepN[3] = Reserved

iSeqRStepN = Sequence counter for step N
```

### Left Side (Axis 3 & 4)
```
lLeftPosStepN[0] = Axis 3 (ID) position
lLeftPosStepN[1] = Axis 4 (OD) position
lLeftPosStepN[2] = Reserved
lLeftPosStepN[3] = Reserved

iSeqLStepN = Sequence counter for step N
```

### Step 3 Special Case (Expand/Retract)
```
lRightPosStep3[0] = ID Expand
lRightPosStep3[1] = ID Retract
lRightPosStep3[2] = OD Expand
lRightPosStep3[3] = OD Retract

iSeqRStep3 = Sequence counter for step 3
```

## Testing Without PLC Hardware

The system includes a mock PLC for development:

```javascript
// .env
REACT_APP_USE_MOCK_PLC=true
```

This allows you to:
- Test the complete UI flow
- Verify data structure
- Practice program creation
- Debug without hardware

Programs are logged to console in mock mode.

## Key Features

✅ **10-Step Program Creation**
✅ **Automatic JOG MODE Activation**
✅ **Position Recording per Step**
✅ **Special Handling for Step 3** (Expand/Retract with 4 values)
✅ **Virtual Keyboard** for touchscreen input
✅ **Left/Right Side Selection**
✅ **Previous/Next Navigation**
✅ **Real-time Position Display**
✅ **Direct Value Input**
✅ **Beckhoff ADS Integration Ready**
✅ **Mock PLC for Development**
✅ **Data Validation**
✅ **Error Handling**

## API Reference

### Main Components

```javascript
// Start program creation
<ProgramCreationStep1
  programName="Part_A"
  side="right"  // or "left"
  onPositionRecorded={(data) => {}}  // Fired when step complete
  onCancel={() => {}}
/>

// Generic step (steps 4-10)
<GenericProgramStep
  programName="Part_A"
  side="right"
  stepNumber={5}
  stepName="Step 5 Position"
  description="Record positions..."
  onStepComplete={(data) => {}}
  onCancel={() => {}}
  onPrevious={() => {}}
/>
```

### PLC Service

```javascript
import { 
  sendProgramToPLC, 
  readSequenceCounter,
  writeSequenceCounter
} from './services/plcService';

// Send complete program to PLC (writes both positions and initializes sequence counters)
await sendProgramToPLC(programData);

// Read sequence counter for a specific step
const seqValue = await readSequenceCounter('right', 1);  // Get iSeqRStep1

// Write sequence counter value
await writeSequenceCounter('left', 3, 42);  // Set iSeqLStep3 = 42

// Validate program data
const validation = validateProgramData(programData);

// Export/Import
const json = exportProgramAsJSON(programData);
const program = importProgramFromJSON(json);
```

## Documentation Files

- **[TEN_STEP_PROGRAM_GUIDE.md](TEN_STEP_PROGRAM_GUIDE.md)** - Complete reference guide
- **[PROGRAM_CREATION_FLOW.md](PROGRAM_CREATION_FLOW.md)** - Original single-step guide
- **[HMI_DESIGN.md](HMI_DESIGN.md)** - HMI design overview

## Troubleshooting

### Program won't save to PLC

1. Check PLC is running (TwinCAT 3 service)
2. Verify ADS port 851 is accessible
3. Check network connectivity
4. Ensure variable names match exactly
5. Set `REACT_APP_USE_MOCK_PLC=true` to test locally

### Positions not recording

1. Click "Record Position" button for each axis
2. Ensure JOG MODE is active (purple indicator)
3. Check both axes show position values
4. Verify "✓ Recorded" badge appears

### Navigation issues

1. Use "Previous Step" button to go back
2. Can't skip steps - must complete each one
3. All positions must be recorded before "Next"

## Next Steps

1. **Install dependencies**: `npm install`
2. **Configure PLC connection**: Edit `.env`
3. **Test with mock PLC**: `REACT_APP_USE_MOCK_PLC=true`
4. **Run development server**: `npm start`
5. **Test program creation flow**
6. **Connect to real PLC** when ready

## Support

For questions or issues:
- Check component props in source code
- Review PLC data structure in TwinCAT
- Enable console logging for debugging
- Test with mock PLC first
