# TwinCAT 3 Recipe Variables Structure

## Overview
This document defines the TwinCAT recipe parameter variable structure that the HMI application expects to communicate with.

**Related Documentation**: 
- [TEN_STEP_PROGRAM_GUIDE.md](TEN_STEP_PROGRAM_GUIDE.md) - 10-step position array structure
- [IO_MAPPING_REFERENCE.md](IO_MAPPING_REFERENCE.md) - Discrete input/output controls

## Recipe vs. Program Structure

### Programs (Steps 1-10)
Programs contain the **position arrays** for each step:
- `lLeftPosStep1..10` - Left side axis positions (Axis 3 ID, Axis 4 OD)
- `lRightPosStep1..10` - Right side axis positions (Axis 1 ID, Axis 2 OD)
- `iSeqLStep1..10` / `iSeqRStep1..10` - Sequence counters

See [TEN_STEP_PROGRAM_GUIDE.md](TEN_STEP_PROGRAM_GUIDE.md) for program structure details.

### Recipes (Parameters)
Recipes contain the **machine and material parameters** that control how a program executes:
- Speed percentage
- Step delays
- Tube dimensions (ID, OD, length)
- Expansion parameters (finger radius, depth)
- Size type (OD-based or ID-based)

**Key Relationship**: A program defines **what positions to move to**, a recipe defines **how fast and with what parameters**.

## Recipe Parameter Variables

### Right Side Recipe Parameters (GVL_GRIGHTHEAD)

```
GVL_GRIGHTHEAD (Global Variable List)
├── iHmiRightSpeed          : INT        // Recipe speed percentage (0-100, default: 100)
├── tHmiRightStepDelay      : TIME       // Delay between steps (ms, default: 500)
├── rHmiRightTubeID         : REAL       // Inner Diameter measurement (mm)
├── rHmiRightTubeOD         : REAL       // Outer Diameter measurement (mm)
├── rHmiRightFinalSize      : REAL       // Final size target (mm)
├── rHmiRightTubeLength     : REAL       // Tube length (mm)
├── rHmiRightIDFingerRadius : REAL       // ID expansion finger radius (mm)
├── rHmiRightDepth          : REAL       // Expansion depth (mm)
└── sHmiRightSizeType       : STRING(2)  // Size type: "OD" or "ID"
```

### Left Side Recipe Parameters (GVL_GLEFTHEAD)

```
GVL_GLEFTHEAD (Global Variable List)
├── iHmiLeftSpeed           : INT        // Recipe speed percentage (0-100, default: 100)
├── tHmiLeftStepDelay       : TIME       // Delay between steps (ms, default: 500)
├── rHmiLeftTubeID          : REAL       // Inner Diameter measurement (mm)
├── rHmiLeftTubeOD          : REAL       // Outer Diameter measurement (mm)
├── rHmiLeftFinalSize       : REAL       // Final size target (mm)
├── rHmiLeftTubeLength      : REAL       // Tube length (mm)
├── rHmiLeftIDFingerRadius  : REAL       // ID expansion finger radius (mm)
├── rHmiLeftDepth           : REAL       // Expansion depth (mm)
└── sHmiLeftSizeType        : STRING(2)  // Size type: "OD" or "ID"
```

## TwinCAT Code Template

### GVL Declaration (Global Variable List)

```st
{attribute 'qualified_only'}
VAR_GLOBAL
    // Right Head Recipe Parameters
    iHmiRightSpeed : INT := 100;
    tHmiRightStepDelay : TIME := T#500ms;
    rHmiRightTubeID : REAL := 0.0;
    rHmiRightTubeOD : REAL := 0.0;
    rHmiRightFinalSize : REAL := 0.0;
    rHmiRightTubeLength : REAL := 0.0;
    rHmiRightIDFingerRadius : REAL := 0.0;
    rHmiRightDepth : REAL := 0.0;
    sHmiRightSizeType : STRING(2) := 'OD';
    
    // Left Head Recipe Parameters
    iHmiLeftSpeed : INT := 100;
    tHmiLeftStepDelay : TIME := T#500ms;
    rHmiLeftTubeID : REAL := 0.0;
    rHmiLeftTubeOD : REAL := 0.0;
    rHmiLeftFinalSize : REAL := 0.0;
    rHmiLeftTubeLength : REAL := 0.0;
    rHmiLeftIDFingerRadius : REAL := 0.0;
    rHmiLeftDepth : REAL := 0.0;
    sHmiLeftSizeType : STRING(2) := 'OD';
END_VAR
```

### Alternative Structure (if using FB_FileOpen for persistence)

```st
TYPE ST_RecipeParameters :
STRUCT
    iSpeed : INT;                    // 0-100 percentage
    tStepDelay : TIME;               // Step delay in ms
    rTubeID : REAL;                  // Inner Diameter
    rTubeOD : REAL;                  // Outer Diameter
    rFinalSize : REAL;               // Final size target
    rTubeLength : REAL;              // Tube length
    rIDFingerRadius : REAL;          // Expansion finger radius
    rDepth : REAL;                   // Expansion depth
    sRecipeName : STRING(32);        // Recipe name
    sizeType : STRING(2);            // 'OD' or 'ID'
END_STRUCT
END_TYPE
```

## Recipe Data Flow

### 1. Recipe Load (HMI → PLC)

When user loads a recipe in the HMI:

```javascript
// From HMI
{
  command: 'setRecipeParameters',
  side: 'right',
  parameters: {
    speed: 100,
    stepDelay: 500,
    tubeID: 25.4,
    tubeOD: 31.75,
    finalSize: 30.0,
    sizeType: 'OD',
    tubeLength: 100,
    idFingerRadius: 2.5,
    depth: 50
  }
}
```

**Backend routes to**: `/write-recipe-params`

**Writes to PLC**:
- `GVL_GRIGHTHEAD.iHmiRightSpeed := 100`
- `GVL_GRIGHTHEAD.tHmiRightStepDelay := T#500ms`
- `GVL_GRIGHTHEAD.rHmiRightTubeID := 25.4`
- `GVL_GRIGHTHEAD.rHmiRightTubeOD := 31.75`
- ... etc

### 2. Program Download (HMI → PLC)

When user downloads a program, recipe parameters are sent first, then program data:

```javascript
// HMI sends recipe params, then program positions
await sendRecipeParametersToPLC(currentParameters, side);
await writePLCVar({ 
  command: 'downloadProgram', 
  program: programToDownload,
  parameters: currentParameters
});

// Program structure from TEN_STEP_PROGRAM_GUIDE.md
// Downloads all 10 steps with position arrays:
// lLeftPosStep1..10 or lRightPosStep1..10
// iSeqLStep1..10 or iSeqRStep1..10
```

### 3. Complete Operating Sequence

```
Recipe Load
    ↓
Recipe parameters written to PLC
(Speed, delays, tube dimensions)
    ↓
Program Download
    ↓
Recipe params sent first (already set above)
    ↓
Program positions sent to PLC
(All 10 steps with position arrays)
    ↓
PLC Ready to Execute
    ↓
Execute Program
    ↓
PLC uses recipe parameters to modify execution:
- Adjust speed based on iHmiSpeed
- Apply delays from tHmiStepDelay
- Use tube dimensions for calculations
- Use expansion parameters for step 3
```

### 4. PLC Processing

The TwinCAT program can use recipe parameters to modify behavior:

```st
PROGRAM PRG_RecipeExecution
VAR
    nSpeed : INT;
    tStepDly : TIME;
    rTubeID : REAL;
    rFinalSize : REAL;
END_VAR

// Read current recipe speed
nSpeed := GVL_GRIGHTHEAD.iHmiRightSpeed;

// Apply step delay from recipe
tStepDly := GVL_GRIGHTHEAD.tHmiRightStepDelay;

// Use tube dimensions for calculations
IF GVL_GRIGHTHEAD.sHmiRightSizeType = 'OD' THEN
    // Expand based on OD
    rFinalSize := GVL_GRIGHTHEAD.rHmiRightFinalSize;
ELSE
    // Expand based on ID
    rFinalSize := GVL_GRIGHTHEAD.rHmiRightTubeID - GVL_GRIGHTHEAD.rHmiRightFinalSize;
END_IF

// Example: Execute program with recipe parameters
// Step 1 position from program
lRightPos := lRightPosStep1[0];  // Get axis 1 position
lRightPos := lRightPosStep1[1];  // Get axis 2 position

// Modify execution speed based on recipe
nVelocity := nMaxVelocity * (nSpeed / 100);  // Scale to recipe speed

// Apply step delay before moving to next step
IF bMoveComplete THEN
    F_Wait(tStepDly, bDelayDone);
END_IF
```

### 5. Program and Recipe Integration Example

```st
// Assume these come from program download
VAR PERSISTENT
    lRightPosStep3 : ARRAY [0..3] OF LREAL;  // From program
END_VAR

// And these come from recipe load
VAR (GVL_GRIGHTHEAD)
    rHmiRightIDFingerRadius : REAL;           // From recipe
    rHmiRightDepth : REAL;                    // From recipe
    iHmiRightSpeed : INT;                     // From recipe
END_VAR

// In your machine logic
PROGRAM PRG_Step3Expansion
VAR
    bIDExpandDone : BOOL;
    bODExpandDone : BOOL;
    nMotionVelocity : INT;
END_VAR

// Set velocity from recipe speed
nMotionVelocity := 1000 * (iHmiRightSpeed / 100);  // 1000 mm/s * speed %

// Move to ID expand position from program with recipe velocity
// lRightPosStep3[0] = ID expand position (from program)
// rHmiRightIDFingerRadius = expansion finger radius (from recipe)
// rHmiRightDepth = expansion depth (from recipe)

IF NOT bIDExpandDone THEN
    F_MoveAxis1(lRightPosStep3[0], nMotionVelocity, bIDExpandDone);
END_IF

IF NOT bODExpandDone AND bIDExpandDone THEN
    F_MoveAxis2(lRightPosStep3[2], nMotionVelocity, bODExpandDone);
END_IF
```

## Parameter Ranges & Defaults

| Parameter | Type | Min | Max | Default | Unit |
|-----------|------|-----|-----|---------|------|
| Speed | INT | 0 | 100 | 100 | % |
| Step Delay | TIME | 0 | 5000 | 500 | ms |
| Tube ID | REAL | 0 | 100 | 0 | mm |
| Tube OD | REAL | 0 | 100 | 0 | mm |
| Final Size | REAL | 0 | 100 | 0 | mm |
| Tube Length | REAL | 0 | 500 | 0 | mm |
| ID Finger Radius | REAL | 0 | 10 | 0 | mm |
| Depth | REAL | 0 | 200 | 0 | mm |

## Integration Checklist

- [ ] Create GVL variables in TwinCAT project
- [ ] Publish variables as public symbols
- [ ] Update variable names if different from this spec
- [ ] Implement recipe parameter usage in machine logic
- [ ] Test recipe loading from HMI
- [ ] Verify values update on PLC side
- [ ] Add error handling for invalid ranges
- [ ] Document any custom recipe parameters

## Notes

1. **Variable Naming Convention**: All recipe parameters use prefix `iHmi`, `tHmi`, or `rHmi` to clearly indicate they are HMI-managed
2. **Persistence**: Optionally use `FB_FileOpen` to persist recipes to file
3. **Validation**: Add input validation in TwinCAT to ensure values are within acceptable ranges
4. **Units**: All REAL values are in millimeters (mm) for consistency
5. **Speed**: Integer 0-100 represents percentage of maximum speed

## Backend Implementation Reference

The Node.js backend at `/write-recipe-params` maps HMI parameters to these PLC variables:

```javascript
const paramPrefix = side === 'left' ? 'GVL_GLEFTHEAD' : 'GVL_GRIGHTHEAD';
const headPrefix = side === 'left' ? 'Left' : 'Right';

// Maps HMI → PLC
{
  'speed': `${paramPrefix}.iHmi${headPrefix}Speed`,
  'stepDelay': `${paramPrefix}.tHmi${headPrefix}StepDelay`,
  'tubeID': `${paramPrefix}.rHmi${headPrefix}TubeID`,
  'tubeOD': `${paramPrefix}.rHmi${headPrefix}TubeOD`,
  'finalSize': `${paramPrefix}.rHmi${headPrefix}FinalSize`,
  'tubeLength': `${paramPrefix}.rHmi${headPrefix}TubeLength`,
  'idFingerRadius': `${paramPrefix}.rHmi${headPrefix}IDFingerRadius`,
  'depth': `${paramPrefix}.rHmi${headPrefix}Depth`
}
```

If your actual PLC uses different variable names, update the mapping in `electron/backend/plc-server.js` line ~260.

---

## Relationship to 10-Step Program Structure

### Program Data (from TEN_STEP_PROGRAM_GUIDE.md)

The 10-step program structure defines **WHAT** the machine will do:

```
lLeftPosStep1..10  : ARRAY[0..3] OF LREAL   // Position targets for each step
lRightPosStep1..10 : ARRAY[0..3] OF LREAL   // Left = Axis 3,4; Right = Axis 1,2
iSeqLStep1..10     : INT                    // Sequence tracking
iSeqRStep1..10     : INT                    // Sequence tracking
```

**Example Step 3** (Expand/Retract - Special):
```
lRightPosStep3[0] = ID Expand position
lRightPosStep3[1] = ID Retract position
lRightPosStep3[2] = OD Expand position
lRightPosStep3[3] = OD Retract position
```

### Recipe Data (this document)

The recipe structure defines **HOW** the machine will execute the program:

```
iHmiRightSpeed        : INT                 // Speed percentage (0-100)
tHmiRightStepDelay    : TIME                // Delay between steps
rHmiRightTubeID       : REAL                // Tube inner diameter
rHmiRightTubeOD       : REAL                // Tube outer diameter
rHmiRightFinalSize    : REAL                // Target final size
rHmiRightIDFingerRadius : REAL              // Expansion tool radius
rHmiRightDepth        : REAL                // Expansion depth
sHmiRightSizeType     : STRING(2)           // 'OD' or 'ID' based
```

### Working Together

```
╔═══════════════════════════════════════════════════════╗
║           10-STEP PROGRAM (WHAT)                      ║
║  Position arrays for steps 1-10                       ║
║  lRightPosStep1[0]=50, lRightPosStep1[1]=75, ...     ║
║  lRightPosStep2[0]=60, lRightPosStep2[1]=85, ...     ║
║  lRightPosStep3[0-3]=expand/retract positions        ║
║  ... Steps 4-10 ...                                   ║
╚═══════════════════════════════════════════════════════╝
                         ↑
                    PLC reads positions
                         ↓
╔═══════════════════════════════════════════════════════╗
║           RECIPE PARAMETERS (HOW)                     ║
║  iHmiRightSpeed = 85%                                 ║
║  tHmiRightStepDelay = T#250ms                         ║
║  rHmiRightTubeOD = 31.75mm                            ║
║  rHmiRightFinalSize = 30.0mm                          ║
║  sHmiRightSizeType = 'OD'                             ║
║  ... (other parameters) ...                           ║
╚═══════════════════════════════════════════════════════╝
                         ↑
                    PLC reads parameters
                         ↓
╔═══════════════════════════════════════════════════════╗
║           MACHINE EXECUTION                           ║
║  Move Axis 1 to position lRightPosStep1[0]            ║
║  At velocity = 1000mm/s * (iHmiRightSpeed/100)        ║
║  = 850 mm/s                                           ║
║  Wait tHmiRightStepDelay before next step             ║
║  Verify tube dimensions match rHmiRightTubeOD         ║
║  Apply expansion with parameters                      ║
╚═══════════════════════════════════════════════════════╝
```

---

## Implementation Checklist

- [ ] Create GVL variables in TwinCAT project (both program steps AND recipes)
- [ ] Add all 10-step position arrays (see TEN_STEP_PROGRAM_GUIDE.md)
- [ ] Add all recipe parameter variables (this file)
- [ ] Publish all variables as public symbols
- [ ] Create test recipes with different parameters
- [ ] Test program loading
- [ ] Test recipe loading
- [ ] Test combined program + recipe execution
- [ ] Verify speed scaling works correctly
- [ ] Verify step delays are applied
- [ ] Verify tube dimension calculations
- [ ] Test Step 3 special handling with recipe parameters

---

## Notes

1. **Naming Convention**: 
   - `bHmi` = HMI-controlled BOOL (inputs/outputs)
   - `iHmi` = HMI-controlled INT (recipe speed)
   - `tHmi` = HMI-controlled TIME (delays)
   - `rHmi` = HMI-controlled REAL (dimensions)
   - `sHmi` = HMI-controlled STRING (type selection)
   - `iSeq` = Sequence counter (tracking)

2. **Variable Scope**:
   - Programs are step-specific (10 steps per side)
   - Recipes are side-specific (one active recipe per side)
   - Programs define positions
   - Recipes modify how those positions are executed

3. **Performance**:
   - Recipe parameter writes: <20ms
   - Program download (10 steps): <50ms
   - Parameter reads: <10ms
   - No performance impact on cycle execution

4. **Safety Considerations**:
   - Always verify tube dimensions before expansion
   - Monitor actual vs. target sizes
   - Implement emergency stop override
   - Log parameter changes for traceability
   - Add validation for out-of-range parameters

