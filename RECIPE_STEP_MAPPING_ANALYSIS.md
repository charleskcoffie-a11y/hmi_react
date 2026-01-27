# Recipe Step Mapping Analysis

## Current Recipe Structure (What Recipes Look Like)

When a recipe is created or saved, it has this structure:

```javascript
{
  name: "My_Recipe_01",
  description: "My recipe description",
  side: "right",           // Added when program is saved
  
  // PARAMETERS ONLY (Tool settings)
  parameters: {
    tubeID: 2.0,
    tubeOD: 3.5,
    finalSize: 3.0,
    sizeType: "OD",
    tubeLength: 10.0,
    idFingerRadius: 0.5,
    depth: 1.5,
    recipeSpeed: 100,
    stepDelay: 500
  },
  
  // PROGRAM DATA (Added when program is saved/merged)
  steps: {
    1: {
      step: 1,
      stepName: "Start Position",
      positions: {
        axis1Cmd: 50.25,    // ID position
        axis2Cmd: 75.50     // OD position
      },
      pattern: 6,
      timestamp: "2025-01-27T..."
    },
    2: {
      step: 2,
      stepName: "Work Position",
      positions: {
        axis1Cmd: 60.00,
        axis2Cmd: 85.00
      },
      pattern: 0,
      repeat: false,
      repeatTimes: 1,
      timestamp: "2025-01-27T..."
    },
    3: {
      step: 3,
      stepName: "Expand/Retract Positions",
      positions: {
        axis1Cmd: {
          expand: 70.00,
          retract: 30.00
        },
        axis2Cmd: {
          expand: 95.00,
          retract: 55.00
        }
      },
      pattern: 1,
      timestamp: "2025-01-27T..."
    },
    // ... Steps 4-10 similar to step 2
  },
  
  // Optional: stored in recipe file
  speed: 100,
  dwell: 500
}
```

---

## PLC Structure (What PLC Expects)

The PLC has this variable structure (from TEN_STEP_PROGRAM_GUIDE.md):

### Step 1 - Start Position (1D Arrays)
```plc
// Left side
GLEFTHEAD.lLeftPosStep1[0]  = Red (OD) position
GLEFTHEAD.lLeftPosStep1[2]  = Exp (ID) position

// Right side  
GRIGHTHEAD.lRightPosStep1[0] = Red (OD) position
GRIGHTHEAD.lRightPosStep1[2] = Exp (ID) position
```

### Steps 2-10 - Per-Step Positions (2D Arrays)
```plc
// Left side
aLeftRedPos[step, 0]  = Red (OD) retract
aLeftRedPos[step, 1]  = Red (OD) extend
aLeftExpPos[step, 0]  = Exp (ID) retract
aLeftExpPos[step, 1]  = Exp (ID) extend

// Right side
aRightRedPos[step, 0] = Red (OD) retract
aRightRedPos[step, 1] = Red (OD) extend
aRightExpPos[step, 0] = Exp (ID) retract
aRightExpPos[step, 1] = Exp (ID) extend
```

---

## Current Axis Mapping Issue

### HMI Steps 1-10 Use Generic Axes
```javascript
positions: {
  axis1Cmd: 50.25,    // Generic label
  axis2Cmd: 75.50     // Generic label
}
```

### But PLC Maps Like This
```
axis1 (Axis1 ID-Exp) in HMI = Red (OD) position in PLC (indices 0,1)
axis2 (Axis2 OD-Red) in HMI  = Exp (ID) position in PLC (indices 2,3)
```

**ISSUE:** The HMI uses `axis1Cmd` and `axis2Cmd`, but the PLC expects:
- For **Step 1**: Array indices [0] and [2]
- For **Steps 2-10**: Array indices with [step, 0], [step, 1] for retract/extend

---

## Pattern Mapping

The `pattern` field in steps determines what gets written to the PLC:

```javascript
Pattern codes (from HMI):
0 = Single Pass
1 = Red Ext Multi-Pass
2 = Red Ext Multi-Pass  
3 = Red Ret Multi-Pass
4 = Red Ret Multi-Pass
5 = Repeat Step
6 = Initial / Start Position (used for Step 1)
```

Pattern determines which axis (Red/Exp) gets which movement (extend/retract).

---

## What Needs to Match

When converting from HMI recipe step → PLC write:

### Recipe Step 1 Example
```javascript
// HMI Recipe Step 1
{
  step: 1,
  positions: {
    axis1Cmd: 50.25,    // This should go to lPosStep1[2] (Exp/ID)
    axis2Cmd: 75.50     // This should go to lPosStep1[0] (Red/OD)
  },
  pattern: 6
}

// PLC Expectation
GRIGHTHEAD.lRightPosStep1[0] = 75.50   // Red (OD) - was axis2Cmd
GRIGHTHEAD.lRightPosStep1[2] = 50.25   // Exp (ID) - was axis1Cmd
```

### Recipe Step 3 Example (Expand/Retract)
```javascript
// HMI Recipe Step 3
{
  step: 3,
  positions: {
    axis1Cmd: { expand: 70, retract: 30 },  // Exp (ID)
    axis2Cmd: { expand: 95, retract: 55 }   // Red (OD)
  },
  pattern: 1
}

// PLC Expectation (Step 3)
GRIGHTHEAD.aRightRedPos[3, 0] = 55      // Red retract - from axis2Cmd.retract
GRIGHTHEAD.aRightRedPos[3, 1] = 95      // Red extend - from axis2Cmd.expand
GRIGHTHEAD.aRightExpPos[3, 0] = 30      // Exp retract - from axis1Cmd.retract
GRIGHTHEAD.aRightExpPos[3, 1] = 70      // Exp extend - from axis1Cmd.expand
## Recommendation

The recipe step mapping **appears correct** in terms of storage:
- ✅ Recipes store both parameters and program steps
- ✅ Steps are saved with `axis1Cmd` and `axis2Cmd` values
- ✅ Pattern field captures the operation type

**But we should verify:**
1. When downloading a program to PLC, are axis1/axis2 correctly mapped to [0]/[2] for Step 1?
2. For Steps 2-10, are the retract/expand indices correctly assigned based on pattern?
3. Is the 2D array indexing correct for Steps 2-10 [step, 0/1]?

This mapping translation should happen in `plc-server.js` when processing the `downloadProgram` command.

---

## File Locations to Check

- [plc-server.js](electron/backend/plc-server.js) - Where programs are downloaded to PLC
- [ProgramEditor.js](src/components/ProgramEditor.js) - Where programs are edited
- [GenericProgramStep.js](src/components/GenericProgramStep.js) - Where step data is captured
