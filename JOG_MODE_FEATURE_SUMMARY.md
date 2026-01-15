# Jog Mode Dialog - Feature Summary

## ✅ What's Implemented

### 1. **Auto-Opening Dialog**
- When operator clicks "ENABLE JOG" and selects a side (left/right)
- HMI polls `GLEFTHEAD.bHmiLeftJogMode` / `GRIGHTHEAD.bHmiRightJogMode`
- As soon as PLC sets the tag to TRUE, dialog automatically opens
- Dialog closes automatically when both sides exit jog mode

### 2. **ID/OD Mode Selection**
```
┌─────────────────────────────────────────┐
│   LEFT SIDE JOG ACTIVE                 │
│                                         │
│  Select Jog Mode:                      │
│  ┌─────────────────────────────────┐  │
│  │ ID ✓      │      OD ✗           │  │
│  └─────────────────────────────────┘  │
│                                         │
│  ✓ ID is ready to jog                  │
│  Push Extend Button to extend ID       │
│  Push Retract Button to retract ID     │
│                                         │
│  ⬆️ EXTEND          ⬇️ RETRACT         │
│                                         │
│  Axis 1 Pos: 123.456   Axis 2 Pos: 789 │
└─────────────────────────────────────────┘
```

### 3. **Ready Status Indicators**
- **Blue "ID" Button**: Enabled if `bHmiLeftExpEna` = true
- **Orange/Red "OD" Button**: Enabled if `bHmiLeftRedEna` = true
- Status messages change dynamically:
  - ⚠️ "Select either ID or OD above to begin jogging"
  - ⏳ "Waiting for ID to be ready..."
  - ✓ "ID is ready to jog"

### 4. **Extend/Retract Controls**
- **Green "⬆️ EXTEND" Button**: Pulses `bHmiLeftExpPb` (100ms for ID)
- **Red "⬇️ RETRACT" Button**: Pulses `bHmiLeftRedPb` (100ms for OD)
- Buttons disabled until ID or OD is selected AND ready
- Visual feedback during pulse (button shows "⏳ EXTENDING...")

### 5. **Real-Time Axis Position Display**
```
Axis 1 Pos: 123.456    Axis 2 Pos: 789.012
```
- Updates as machine moves during jogging
- 3 decimal place precision
- Units match system setting (mm/inch)
- Displays axes for the active side

### 6. **Side Switch Button**
```
┌──────────────────────────┐
│  SWITCH TO RIGHT SIDE    │
└──────────────────────────┘
```
- Orange button to switch to opposite side
- When clicked:
  1. Pulses the new side's jog pushbutton
  2. Updates dialog to show new side's data
  3. Dialog title changes to "RIGHT SIDE JOG ACTIVE"
  4. Ready status updates for new side
  5. Axis positions update for new side

### 7. **Color Scheme**
| Element | Color | Purpose |
|---------|-------|---------|
| Dialog Border | Purple (#9C27B0) | Jog mode indicator |
| Header Banner | Purple Gradient | "SIDE JOG ACTIVE" banner |
| ID Button | Blue (#2196F3) | ID/Expand mode |
| OD Button | Orange/Red (#FF5722) | OD/Reduction mode |
| Extend Button | Green (#4CAF50) | Positive action |
| Retract Button | Red (#F44336) | Negative action |
| Switch Side | Orange (#FF6F00) | Mode transition |
| Ready Status | Green (ready), Orange (waiting) | State feedback |

## 📋 PLC Tag Wiring

### **Inputs (HMI Pulses)**
```
Operator selects Side L
    ↓
Pulse GLEFTHEAD.bHmiLeftJogPb (index 3) for 100ms
    ↓
PLC logic processes
    ↓
Sets GLEFTHEAD.bHmiLeftJogMode = true (feedback)
Sets GLEFTHEAD.bHmiLeftExpEna = true (ID ready)
Sets GLEFTHEAD.bHmiLeftRedEna = true (OD ready)
    ↓
HMI detects jog mode and opens dialog
```

### **Outputs (HMI Reads)**
```
GLEFTHEAD.bHmiLeftJogMode      ← Is left in jog? (auto-open dialog)
GRIGHTHEAD.bHmiRightJogMode    ← Is right in jog?
GLEFTHEAD.bHmiLeftExpEna       ← Can ID extend right now?
GLEFTHEAD.bHmiLeftRedEna       ← Can OD retract right now?
GRIGHTHEAD.bHmiRightExpEna     ← Can ID extend right now? (right side)
GRIGHTHEAD.bHmiRightRedEna     ← Can OD retract right now? (right side)
```

### **Pulses (Extend/Retract)**
```
User presses Extend button for ID
    ↓
Pulse GLEFTHEAD.bHmiLeftExpPb for 150ms
    ↓
Pulse GLEFTHEAD.bHmiLeftRedPb for 150ms
    ↓
PLC moves the head(s)
    ↓
GLEFTHEAD.lAxis1ActPos updates
GLEFTHEAD.lAxis2ActPos updates
    ↓
UI displays new positions
```

## 🎯 User Actions Flow

```
┌─────────────────────────┐
│ Operator Clicks         │
│ "ENABLE JOG"            │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│ Side Selector Opens     │
│ Choose LEFT or RIGHT    │
└────────────┬────────────┘
             ↓
┌─────────────────────────────────────────┐
│ HMI pulses jog pushbutton (100ms)       │
│ Waits for PLC jog mode feedback         │
└────────────┬────────────────────────────┘
             ↓
┌────────────────────────────────────────────┐
│ JOG MODE DIALOG OPENS                      │
│ Shows ready status for ID and OD           │
└────────────┬─────────────────────────────┘
             ↓
        ┌────────────┬────────────┐
        ↓            ↓            ↓
   Not Ready    Select ID    Select OD
        ↓            ↓            ↓
   (Gray out)   (Ready?)     (Ready?)
              ┌──────┴──────┐
              ↓             ↓
          Ready         Not Ready
              ↓             ↓
         Show Extend    Show Wait
         Show Retract   Message
              ↓
    User presses Extend/Retract
              ↓
    HMI pulses PLC tag (150ms)
              ↓
    Machine moves, positions update
              ↓
        (Repeat or Switch Side)
              ↓
    User exits jog (via PLC)
              ↓
    Dialog auto-closes
```

## 🔌 Backend Integration

The dialog uses existing `plcApiService.js` functions:
- `pulseBoolTag(tag, durationMs)` - sends 150ms pulse for extend/retract
- `writePLCVar({ command: 'enableJog', side })` - enables jog on new side
- `/read-axis-positions` endpoint - gets axis1/axis2 positions
- `/read` endpoint with specific tags - gets ready status

## 📁 Files Created/Modified

**New Files**:
- `src/components/JogModeDialog.js` (180 lines) - Main dialog component
- `src/styles/JogModeDialog.css` (320 lines) - Styling with animations
- `JOG_MODE_IMPLEMENTATION.md` - Comprehensive guide

**Modified Files**:
- `src/MainHMI.js` - Added jog dialog state and polling logic
  - Import JogModeDialog
  - Add state: `showJogDialog`, `jogActiveSide`, `jogReadyStatus`
  - Add polling for jog ready status tags
  - Auto-open/close dialog based on PLC feedback
  - Add handlers: `handleJogModeSideSwitch()`, `handleJogDialogClose()`
  - Render JogModeDialog in JSX

## 🚀 Next Steps (Optional)

1. **Test on Live PLC**
   - Verify jog mode trigger and status tags
   - Confirm pulse timing (100ms for enable, 150ms for extend/retract)
   - Check axis position updates in real-time

2. **Fine-Tune Pulse Duration**
   - If PLC needs longer than 150ms, update JogModeDialog.js `handleExtend()` and `handleRetract()`
   - If too long, reduce to 100ms

3. **Add Jog Speed Control**
   - Add slider to adjust `GLEFTHEAD.iHmiLeftSpeed`
   - Allows operators to control jog speed on-the-fly

4. **Limit Detection**
   - Add visual warnings when axis near soft limits
   - Disable extend/retract if limit would be exceeded

5. **Dual-Side Jog**
   - Modify dialog to control both sides simultaneously
   - Show all 4 axes on screen
