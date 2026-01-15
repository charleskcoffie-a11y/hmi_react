# IO Mapping Reference Guide

## Overview

The IO mapping (`electron/backend/io-map.json`) defines all discrete inputs and outputs used by the HMI to communicate with the PLC. This document provides a comprehensive reference for understanding and extending the IO mapping.

## Index Ranges

| Range | Category | Count | Type |
|-------|----------|-------|------|
| 1-12 | Left Side Controls | 12 | Input/Output |
| 40-51 | Right Side Controls | 12 | Input/Output |
| 100-111 | Global Inputs | 12 | Input |
| 150-163 | Global Outputs | 14 | Output |
| **Total** | | **50** | |

---

## LEFT SIDE CONTROLS (Indices 1-12)

### GVL_GLEFTHEAD Variables

| Index | Tag | Label | Direction | Function |
|-------|-----|-------|-----------|----------|
| 1 | `bHmiEnaLeftHomePb` | Left Home PB | Input | Home position push button |
| 2 | `bHmiLeftHomeEna` | Left Home Ena | Output | Home enable output |
| 3 | `bHmiLeftJogPb` | Left Jog PB | Input | Jog mode push button |
| 4 | `bHmiLeftJogMode` | Left Jog Mode | Output | Jog mode enable |
| 5 | `bHmiLeftRunPb` | Left Run PB | Input | Run program push button |
| 6 | `bHmiLeftRunMode` | Left Run Mode | Output | Run mode enable |
| 7 | `bHmiLeftExpPb` | Left Exp PB | Input | Expand push button |
| 8 | `bHmiLeftExpEna` | Left Exp Ena | Output | Expansion enable |
| 9 | `bHmiLeftRedPb` | Left Red PB | Input | Retract push button |
| 10 | `bHmiLeftRedEna` | Left Red Ena | Output | Retraction enable |
| 11 | `bHmiLeftStartPosPb` | Left StartPos PB | Input | Start position push button |
| 12 | `bHmiLeftStartPosEna` | Left StartPos Ena | Output | Start position enable |

**Pattern**: Each control has an input button (odd indices) and an output enable (even indices)

---

## RIGHT SIDE CONTROLS (Indices 40-51)

### GVL_GRIGHTHEAD Variables

| Index | Tag | Label | Direction | Function |
|-------|-----|-------|-----------|----------|
| 40 | `bHmiEnaRightHomePb` | Right Home PB | Input | Home position push button |
| 41 | `bHmiRightHomeEna` | Right Home Ena | Output | Home enable output |
| 42 | `bHmiRightJogPb` | Right Jog PB | Input | Jog mode push button |
| 43 | `bHmiRightJogMode` | Right Jog Mode | Output | Jog mode enable |
| 44 | `bHmiRightRunPb` | Right Run PB | Input | Run program push button |
| 45 | `bHmiRightRunMode` | Right Run Mode | Output | Run mode enable |
| 46 | `bHmiRightExpPb` | Right Exp PB | Input | Expand push button |
| 47 | `bHmiRightExpEna` | Right Exp Ena | Output | Expansion enable |
| 48 | `bHmiRightRedPb` | Right Red PB | Input | Retract push button |
| 49 | `bHmiRightRedEna` | Right Red Ena | Output | Retraction enable |
| 50 | `bHmiRightStartPosPb` | Right StartPos PB | Input | Start position push button |
| 51 | `bHmiRightStartPosEna` | Right StartPos Ena | Output | Start position enable |

**Pattern**: Mirror of Left Side Controls (offset by 39)

---

## GLOBAL INPUTS (Indices 100-111)

### GIO Variables - Input Devices

| Index | Tag | Label | Type | Function |
|-------|-----|-------|------|----------|
| 100 | `bCycleStartPb` | Cycle Start PB | Button | Start cycle operation |
| 101 | `bRightFootSw` | Right Foot SW | Switch | Right foot pedal |
| 102 | `bLeftFootSw` | Left Foot SW | Switch | Left foot pedal |
| 103 | `bCycleHoldPb` | Cycle Hold PB | Button | Hold/pause cycle |
| 104 | `bJogAdvPb` | Jog Advance PB | Button | Jog forward |
| 105 | `bJogRetPb` | Jog Retract PB | Button | Jog backward |
| 106 | `bEditLock` | Edit Lock | Switch | Program edit lock |
| 107 | `bOilTempSw` | Oil Temp SW | Switch | Oil temperature warning |
| 108 | `bOilLevelSw` | Oil Level SW | Switch | Oil level low alarm |
| 109 | `bPumpRunning` | Pump Running | Sensor | Pump status feedback |
| 110 | `bPowerOnPb` | Power On PB | Button | System power-on |
| 111 | `bPumpOffPb` | Pump Off PB | Button | Pump shutdown |

---

## GLOBAL OUTPUTS (Indices 150-163)

### GIO Variables - Output Devices

| Index | Tag | Label | Device Type | Function |
|-------|-----|-------|-------------|----------|
| 150 | `bPumpRunningLt` | Pump Running Lt | Light | Pump running indicator |
| 151 | `bCyleStartLt` | Cycle Start Lt | Light | Cycle active indicator |
| 152 | `bCylHoldLt` | Cycle Hold Lt | Light | Cycle hold indicator |
| 153 | `bJogAdvLt` | Jog Advance Lt | Light | Jog forward indicator |
| 154 | `bJogRetLt` | Jog Retract Lt | Light | Jog retract indicator |
| 155 | `bHydrualicPump` | Hydraulic Pump | Pump | Main hydraulic pump |
| 156 | `bHeatExchanger` | Heat Exchanger | Cooler | Hydraulic cooler |
| 157 | `bLubeHead` | Lube Head | Solenoid | Lubrication head |
| 158 | `bLubeHeadSelected` | Lube Head Selected | Solenoid | Secondary lube |
| 159 | `bPumpOnLight` | Pump On Light | Light | Pump power indicator |
| 160 | `bPowerOnLight` | Power On Light | Light | System power indicator |
| 161 | `bDO_K1` | DO K1 | Relay | Auxiliary relay K1 |
| 162 | `bDO_K2` | DO K2 | Relay | Auxiliary relay K2 |
| 163 | `bDumpVal` | Dump Valve | Solenoid | Pressure relief valve |

---

## Control Flow Diagrams

### Left/Right Side Operation Flow

```
┌─────────────────────────────────────────────────────┐
│           SIDE CONTROL PAIR (Index Pattern)         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Input Button (PB)              Output Enable (Ena)│
│  ┌──────────────────┐          ┌─────────────────┐ │
│  │  User presses    │──────────│ HMI sends       │ │
│  │  button on       │          │ enable to PLC   │ │
│  │  cabinet         │          │                 │ │
│  └──────────────────┘          └─────────────────┘ │
│         (Index: N)                   (Index: N+1)  │
│                                                     │
│  Example: Left Home (Indices 1-2)                  │
│  ────────────────────────────────                  │
│  • User presses "Home" button                       │
│  • Index 1 reads bHmiEnaLeftHomePb = TRUE          │
│  • HMI writes Index 2 bHmiLeftHomeEna = TRUE       │
│  • PLC homes left side                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### System Operation Hierarchy

```
┌──────────────────────────────────────────────────────┐
│         GLOBAL CONTROL SYSTEM (Indices 100+)        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Main Controls (100-105)                            │
│  ├─ Cycle Start (100)          ► Cycle Start Lt(151)│
│  ├─ Cycle Hold (103)           ► Cycle Hold Lt(152) │
│  ├─ Jog Advance (104)          ► Jog Adv Lt (153)   │
│  └─ Jog Retract (105)          ► Jog Ret Lt (154)   │
│                                                      │
│  Foot Switches (101-102)                            │
│  ├─ Right Foot Pedal (101)                          │
│  └─ Left Foot Pedal (102)                           │
│                                                      │
│  System Monitoring (107-111)                        │
│  ├─ Oil Temperature (107)                           │
│  ├─ Oil Level (108)                                 │
│  ├─ Pump Status (109)          ► Pump Lights(150,159)
│  ├─ Power On (110)             ► Power Light (160)  │
│  └─ Pump Off (111)                                  │
│                                                      │
│  Power Systems (155-163)                            │
│  ├─ Hydraulic Pump (155)                            │
│  ├─ Heat Exchanger (156)                            │
│  ├─ Lubrication (157-158)                           │
│  ├─ Relief Valve (163)                              │
│  └─ Auxiliary Relays (161-162)                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## API Usage Examples

### Reading IO by Index

```javascript
// Read left home push button status
GET /io/read?index=1

Response:
{
  "index": 1,
  "tag": "GVL_GLEFTHEAD.bHmiEnaLeftHomePb",
  "value": true,
  "label": "Left Home PB"
}
```

### Writing IO by Index

```javascript
// Enable left jog mode
POST /io/write
{
  "index": 4,
  "value": true
}

// PLC Variable: GVL_GLEFTHEAD.bHmiLeftJogMode = TRUE
```

### Pulsing IO (Momentary Button)

```javascript
// Momentary pulse of cycle start (150ms)
POST /io/pulse
{
  "index": 100,
  "durationMs": 150
}

// Sequence:
// 1. Set GIO.bCycleStartPb = TRUE
// 2. Wait 150ms
// 3. Set GIO.bCycleStartPb = FALSE
```

---

## TwinCAT Variable Declaration

### Required GVL Variables

```st
{attribute 'qualified_only'}
VAR_GLOBAL
    // Left Side Controls
    bHmiEnaLeftHomePb : BOOL := FALSE;
    bHmiLeftHomeEna : BOOL := FALSE;
    bHmiLeftJogPb : BOOL := FALSE;
    bHmiLeftJogMode : BOOL := FALSE;
    bHmiLeftRunPb : BOOL := FALSE;
    bHmiLeftRunMode : BOOL := FALSE;
    bHmiLeftExpPb : BOOL := FALSE;
    bHmiLeftExpEna : BOOL := FALSE;
    bHmiLeftRedPb : BOOL := FALSE;
    bHmiLeftRedEna : BOOL := FALSE;
    bHmiLeftStartPosPb : BOOL := FALSE;
    bHmiLeftStartPosEna : BOOL := FALSE;
    
    // Right Side Controls
    bHmiEnaRightHomePb : BOOL := FALSE;
    bHmiRightHomeEna : BOOL := FALSE;
    bHmiRightJogPb : BOOL := FALSE;
    bHmiRightJogMode : BOOL := FALSE;
    bHmiRightRunPb : BOOL := FALSE;
    bHmiRightRunMode : BOOL := FALSE;
    bHmiRightExpPb : BOOL := FALSE;
    bHmiRightExpEna : BOOL := FALSE;
    bHmiRightRedPb : BOOL := FALSE;
    bHmiRightRedEna : BOOL := FALSE;
    bHmiRightStartPosPb : BOOL := FALSE;
    bHmiRightStartPosEna : BOOL := FALSE;
END_VAR

{attribute 'qualified_only'}
VAR_GLOBAL
    // Global IO - Inputs
    bCycleStartPb : BOOL := FALSE;
    bRightFootSw : BOOL := FALSE;
    bLeftFootSw : BOOL := FALSE;
    bCycleHoldPb : BOOL := FALSE;
    bJogAdvPb : BOOL := FALSE;
    bJogRetPb : BOOL := FALSE;
    bEditLock : BOOL := FALSE;
    bOilTempSw : BOOL := FALSE;
    bOilLevelSw : BOOL := FALSE;
    bPumpRunning : BOOL := FALSE;
    bPowerOnPb : BOOL := FALSE;
    bPumpOffPb : BOOL := FALSE;
    
    // Global IO - Outputs
    bPumpRunningLt : BOOL := FALSE;
    bCyleStartLt : BOOL := FALSE;
    bCylHoldLt : BOOL := FALSE;
    bJogAdvLt : BOOL := FALSE;
    bJogRetLt : BOOL := FALSE;
    bHydrualicPump : BOOL := FALSE;
    bHeatExchanger : BOOL := FALSE;
    bLubeHead : BOOL := FALSE;
    bLubeHeadSelected : BOOL := FALSE;
    bPumpOnLight : BOOL := FALSE;
    bPowerOnLight : BOOL := FALSE;
    bDO_K1 : BOOL := FALSE;
    bDO_K2 : BOOL := FALSE;
    bDumpVal : BOOL := FALSE;
END_VAR
```

---

## Example Control Logic - TwinCAT

### Home Operation

```st
PROGRAM PRG_LeftHomeControl
VAR
    nHomeStep : INT := 0;
END_VAR

// Monitor home button
IF GVL_GLEFTHEAD.bHmiEnaLeftHomePb AND nHomeStep = 0 THEN
    // Start homing sequence
    nHomeStep := 1;
    GVL_GLEFTHEAD.bHmiLeftHomeEna := TRUE;  // Acknowledge enable output
END_IF

// Execute home sequence
CASE nHomeStep OF
    1:
        // Move to home position
        IF HomeSequenceComplete THEN
            nHomeStep := 2;
        END_IF
    2:
        // Home complete, reset
        GVL_GLEFTHEAD.bHmiLeftHomeEna := FALSE;
        nHomeStep := 0;
END_CASE
```

### Jog Mode Control

```st
PROGRAM PRG_JogControl
VAR
    nJogMode : BOOL := FALSE;
END_VAR

// Monitor jog button
IF GVL_GLEFTHEAD.bHmiLeftJogPb AND NOT nJogMode THEN
    nJogMode := TRUE;
    GVL_GLEFTHEAD.bHmiLeftJogMode := TRUE;  // Enable jog
ELSIF NOT GVL_GLEFTHEAD.bHmiLeftJogPb AND nJogMode THEN
    nJogMode := FALSE;
    GVL_GLEFTHEAD.bHmiLeftJogMode := FALSE;  // Disable jog
END_IF
```

### Cycle Operation with Indicators

```st
PROGRAM PRG_CycleControl
VAR
    bCycleActive : BOOL := FALSE;
    bCycleHold : BOOL := FALSE;
END_VAR

// Start cycle
IF GIO.bCycleStartPb THEN
    bCycleActive := TRUE;
    GIO.bCyleStartLt := TRUE;  // Light indicator
END_IF

// Hold cycle
IF GIO.bCycleHoldPb AND bCycleActive THEN
    bCycleHold := TRUE;
    GIO.bCylHoldLt := TRUE;
ELSIF GIO.bCycleHoldPb AND bCycleHold THEN
    bCycleHold := FALSE;
    GIO.bCylHoldLt := FALSE;
END_IF

// Monitor pump
GIO.bPumpRunningLt := GIO.bPumpRunning;  // Mirror pump status
```

---

## Frontend Usage Examples

### Reading Button Status in React

```javascript
import { writeBoolTag } from './services/plcApiService';

// Get left home button status
async function checkLeftHomeButton() {
  const response = await fetch('http://localhost:3001/io/read?index=1');
  const data = await response.json();
  console.log('Left Home PB:', data.value);
}

// Trigger left home operation
async function requestLeftHome() {
  await writeBoolTag('GVL_GLEFTHEAD.bHmiLeftHomeEna', true);
  // PLC will execute home sequence
}
```

### Setting Output States

```javascript
// Turn on pump
async function startPump() {
  const response = await fetch('http://localhost:3001/io/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index: 155, value: true })
  });
  const data = await response.json();
  console.log('Pump started:', data.success);
}

// Pulse cycle start button (momentary)
async function startCycle() {
  const response = await fetch('http://localhost:3001/io/pulse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index: 100, durationMs: 150 })
  });
  const data = await response.json();
  console.log('Cycle initiated:', data.success);
}
```

---

## Adding New IO Points

### Step 1: Update io-map.json

```json
{
  "index": 164,
  "tag": "GIO.bNewControl",
  "label": "New Control",
  "direction": "output"
}
```

### Step 2: Add to TwinCAT GVL

```st
bNewControl : BOOL := FALSE;
```

### Step 3: Use in Frontend

```javascript
// Read
await fetch('http://localhost:3001/io/read?index=164');

// Write
await writeBoolTag('GIO.bNewControl', true);
```

---

## Verification Checklist

- [ ] All variables exist in TwinCAT GVL
- [ ] Variable names match io-map.json exactly
- [ ] Input buttons (PB) are readable
- [ ] Output enables (Ena) are writable
- [ ] Lights (Lt) show actual state
- [ ] All switches return correct status
- [ ] Pump outputs function properly
- [ ] Relay controls K1/K2 work

---

## Notes

1. **Naming Convention**: 
   - `bHmi` prefix = HMI controlled variables
   - `Pb` = Push Button (input)
   - `Ena` = Enable (output)
   - `Lt` = Light indicator (output)
   - `Sw` = Switch (input)

2. **Index Offset Pattern**:
   - Left Side: 1-12 (GVL_GLEFTHEAD)
   - Right Side: 40-51 (GVL_GRIGHTHEAD, +39 offset)
   - Global: 100+ (GIO)

3. **Safety Considerations**:
   - Always verify device feedback before assuming operation
   - Use timeout mechanisms for critical operations
   - Monitor oil temperature and level
   - Implement emergency stop logic

4. **Performance**:
   - IO operations are typically <10ms
   - Use batch operations for multiple IO points
   - Monitor PLC connection status
