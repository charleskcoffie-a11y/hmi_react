# Program Creation Flow - Beckhoff TwinCAT 3 Integration Guide

## Overview

This document outlines the complete program creation workflow for the 4-Axis Machine HMI with Beckhoff TwinCAT 3 PLC integration.

## Program Creation Flow

### Step 0: Side Selection
**Component**: `SideSelector.js`

When user clicks "Add Program" button:
1. Side selector modal appears
2. User chooses **Right Side** or **Left Side**
3. Display of available axes for each side:
   - Right Side: Axis 1 (ID), Axis 2 (OD)
   - Left Side: Axis 3 (ID), Axis 4 (OD)

### Step 1: Program Name Entry
**Component**: `ProgramNameModal.js` + `VirtualKeyboard.js`

After side selection:
1. Virtual keyboard modal opens
2. User enters program name (max 32 characters)
3. Name requirements:
   - Minimum 3 characters
   - Alphanumeric, spaces, dashes, underscores, dots, slashes allowed
   - Real-time character count display
4. Enter button confirms and proceeds to Step 1

**Virtual Keyboard Features**:
- Standard QWERTY layout with numbers
- Special characters: `-` `_` `/` `.`
- Spacebar for spaces
- Backspace button
- Character limit enforcement

### Step 2: Position Recording (Step 1)
**Component**: `ProgramCreationStep1.js`

After program name confirmation:

#### Automatic Setup
- Machine automatically enters **JOG MODE**
- Both axes on selected side are **ENABLED**
- Visual indicator shows "JOG MODE ACTIVE"

#### Axis Control for Each Axis
Each axis card includes:

1. **Status Display**
   - Current position value (real-time, in mm)
   - Recorded indicator badge

2. **Jog Controls**
   - Up button (+) - increases position
   - Down button (-) - decreases position
   - Increment: 1mm per click

3. **Slider**
   - Range: -1000 to +1000 mm
   - Fine-grained control
   - Real-time position update

4. **Direct Input**
   - Numeric input field
   - Manual value entry
   - Enables precise positioning

5. **Record Position Button**
   - Records current position when clicked
   - Changes to "✓ Position Recorded" state
   - Green highlight when recorded

#### Step Completion
- Both axes must have recorded positions
- Completion button enables when both recorded
- Proceeds to next step (Step 2, Step 3, etc.)

### Data Structure for Beckhoff Integration

#### Program Object
```javascript
{
  programName: "Part_Assembly_01",
  side: "right",  // or "left"
  createdAt: "2025-12-18T10:30:00.000Z",
  step1Data: {
    step: 1,
    stepName: "Position Recording",
    positions: {
      "Axis1 (ID)": 50.25,
      "Axis2 (OD)": 75.50
    },
    timestamp: "2025-12-18T10:32:00.000Z"
  }
}
```

#### Axis Position Mapping
**Right Side**:
```
positions["Axis 1 (ID)"] = axis1Position  // Inner Diameter
positions["Axis 2 (OD)"] = axis2Position  // Outer Diameter
```

**Left Side**:
```
positions["Axis 3 (ID)"] = axis3Position  // Inner Diameter
positions["Axis 4 (OD)"] = axis4Position  // Outer Diameter
```

## Beckhoff TwinCAT 3 PLC Integration

### Step 1: Communication Setup

Add to your MainHMI.js or create a new `plcService.js`:

```javascript
// services/plcService.js
import { TwinCAT } from '@beckhoff/ads';

const adsClient = new TwinCAT.AdsClient();

export const sendProgramToPLC = async (programData) => {
  try {
    await adsClient.connect('127.0.0.1', 851);
    
    const programVariable = {
      programName: programData.programName,
      side: programData.side === 'right' ? 0 : 1,
      axis1Pos: programData.step1Data.positions['Axis1 (ID)'] || 
                programData.step1Data.positions['Axis3 (ID)'],
      axis2Pos: programData.step1Data.positions['Axis2 (OD)'] || 
                programData.step1Data.positions['Axis4 (OD)'],
      timestamp: new Date(programData.step1Data.timestamp).getTime()
    };
    
    // Write to PLC symbol
    await adsClient.writeSymbol('PlcState.ProgramBuffer', programVariable);
    console.log('Program sent to PLC successfully');
    
  } catch (error) {
    console.error('Failed to send program to PLC:', error);
    throw error;
  }
};

export const readProgramFromPLC = async (programName) => {
  try {
    await adsClient.connect('127.0.0.1', 851);
    const program = await adsClient.readSymbol(`PlcState.Programs.${programName}`);
    return program;
  } catch (error) {
    console.error('Failed to read program from PLC:', error);
  }
};
```

### Step 2: PLC Side Structure (TwinCAT)

Define in your TwinCAT project:

```structuredtext
TYPE ProgramData :
STRUCT
    programName     : STRING;
    side            : UINT := 0; // 0=Right, 1=Left
    axis1Pos        : REAL;
    axis2Pos        : REAL;
    timestamp       : ULINT;
END_STRUCT
END_TYPE

TYPE PlcState :
STRUCT
    ProgramBuffer   : ProgramData;
    Programs        : ARRAY [0..99] OF ProgramData;
    CurrentProgram  : ProgramData;
END_STRUCT
END_TYPE
```

### Step 3: Handle Position Recording

Update `handlePositionRecorded` in MainHMI.js:

```javascript
const handlePositionRecorded = async (stepData) => {
  try {
    // Send to PLC
    await sendProgramToPLC({
      ...currentProgram,
      step1Data: stepData
    });
    
    // Save locally
    setCreatedPrograms([...createdPrograms, { ...currentProgram, step1Data: stepData }]);
    
    // Notify user
    alert(`Program "${stepData.programName}" saved and sent to PLC!`);
    
    // Reset UI
    setShowProgramStep1(false);
    setCurrentProgram(null);
    
  } catch (error) {
    alert(`Error saving program: ${error.message}`);
  }
};
```

## State Flow Diagram

```
Main HMI
    ↓
User clicks "Add Program"
    ↓
SideSelector Component
    (User selects Right/Left)
    ↓
ProgramNameModal Component
    (User enters name via Virtual Keyboard)
    ↓
ProgramCreationStep1 Component
    (User jogs axes and records positions)
    ↓
Save to PLC & Local Storage
    ↓
Return to Main HMI
```

## Keyboard Shortcuts (Future Enhancement)

```javascript
// Optional: Add keyboard support
document.addEventListener('keydown', (e) => {
  if (jogMode) {
    if (e.key === 'ArrowUp') handleAxis1Jog('up');
    if (e.key === 'ArrowDown') handleAxis1Jog('down');
    if (e.key === 'w') handleAxis2Jog('up');
    if (e.key === 's') handleAxis2Jog('down');
  }
});
```

## Error Handling

### Validation Rules
1. **Program Name**
   - Not empty
   - Minimum 3 characters
   - Maximum 32 characters
   - No special characters except: `-` `_` `/` `.`

2. **Position Recording**
   - Both axes must have recorded positions
   - Positions within valid range (-1000 to +1000 mm)
   - Positions recorded successfully on PLC

3. **PLC Communication**
   - Check ADS connection status
   - Verify PLC is running
   - Handle timeout scenarios

### Error Messages
```javascript
if (!programName.trim()) {
  throw new Error('Program name cannot be empty');
}
if (programName.trim().length < 3) {
  throw new Error('Program name must be at least 3 characters');
}
if (!axis1Recorded || !axis2Recorded) {
  throw new Error('Please record positions for both axes');
}
```

## Testing Checklist

- [ ] Side selection works correctly
- [ ] Virtual keyboard input works smoothly
- [ ] Program name validation works
- [ ] Jog mode activates automatically
- [ ] Both axes can be jogged
- [ ] Position values update in real-time
- [ ] Position recording saves correctly
- [ ] Data sends to PLC successfully
- [ ] Program appears in recipe list after creation
- [ ] Cancel button works at each step

## Future Enhancements

1. **Step 2**: Speed/Acceleration parameters
2. **Step 3**: Dwell time/Duration settings
3. **Step 4**: Tool selection and offsets
4. **Step 5**: Condition checks (sensors, limits)
5. **Program Preview**: Visual representation before running
6. **Undo/Redo**: Step navigation
7. **Program Duplication**: Clone existing programs
8. **Batch Import**: Load programs from files

## File Structure

```
src/
├── components/
│   ├── VirtualKeyboard.js          # Input method
│   ├── SideSelector.js             # Step 0: Side selection
│   ├── ProgramNameModal.js         # Step 1: Name entry
│   ├── ProgramCreationStep1.js     # Step 2: Position recording
│   ├── (Future) ProgramCreationStep2.js
│   ├── (Future) ProgramCreationStep3.js
│   └── (Future) ProgramCreationStep4.js
├── services/
│   └── (New) plcService.js         # Beckhoff ADS communication
├── styles/
│   ├── VirtualKeyboard.css
│   ├── SideSelector.css
│   ├── ProgramNameModal.css
│   └── ProgramCreationStep1.css
└── MainHMI.js                      # Main controller
```

## API Reference

### VirtualKeyboard
```javascript
<VirtualKeyboard
  value={string}              // Current input text
  onInput={(value) => {}}    // Called on key click
  onEnter={(value) => {}}    // Called on Enter press
  onBackspace={(value) => {}}  // Called on Backspace
/>
```

### SideSelector
```javascript
<SideSelector
  onSelectSide={(side) => {}} // 'right' or 'left'
  onCancel={() => {}}         // Close without selecting
/>
```

### ProgramNameModal
```javascript
<ProgramNameModal
  isOpen={boolean}
  side={'right' | 'left'}
  onConfirm={(name) => {}}    // Program name confirmed
  onCancel={() => {}}         // Canceled
/>
```

### ProgramCreationStep1
```javascript
<ProgramCreationStep1
  programName={string}
  side={'right' | 'left'}
  onPositionRecorded={(data) => {}}  // Step complete
  onCancel={() => {}}                // Canceled
/>
```

## Notes for Beckhoff Integration

- **ADS Port**: Default 851 for TwinCAT runtime
- **Target IP**: Adjust based on PLC location (127.0.0.1 for local)
- **Communication Protocol**: ADS (Automation Device Specification)
- **Data Types**: Use REAL for axis positions (floating point)
- **Timestamps**: Store as ULINT (milliseconds since epoch)
- **Program Storage**: Recommend using FB_FileOpen for persistent storage

## Support

For questions about Beckhoff integration:
- Reference: [Beckhoff ADS Documentation](https://infosys.beckhoff.com/)
- TwinCAT 3 PLC Documentation
- Contact: Your TwinCAT/PLC team
