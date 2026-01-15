# Jog Mode Implementation Guide

## Overview
A comprehensive jog mode dialog has been implemented that displays when either the left or right side enters jog mode. The interface allows operators to select between ID (expand) and OD (reduction) modes, with real-time feedback on ready status and axis position display.

## PLC Tags Used

### Jog Mode Status (Feedback - Read by UI)
- **Left Side**: `GLEFTHEAD.bHmiLeftJogMode` - indicates left side is in jog mode
- **Right Side**: `GRIGHTHEAD.bHmiRightJogMode` - indicates right side is in jog mode

### Jog Ready Status (Feedback - Read by UI)
These tags indicate which mode (ID or OD) is ready to jog on each side:
- **Left ID Ready**: `GLEFTHEAD.bHmiLeftExpEna`
- **Left OD Ready**: `GLEFTHEAD.bHmiLeftRedEna`
- **Right ID Ready**: `GRIGHTHEAD.bHmiRightExpEna`
- **Right OD Ready**: `GRIGHTHEAD.bHmiRightRedEna`

### Jog Control Buttons (Write by UI)
These are momentary pushbuttons pulsed when user presses Extend/Retract:
- **Left ID Extend**: `GLEFTHEAD.bHmiLeftExpPb` (index 3) - pulse to extend ID
- **Left OD Retract**: `GLEFTHEAD.bHmiLeftRedPb` (index 9) - pulse to retract OD
- **Right ID Extend**: `GRIGHTHEAD.bHmiRightExpPb` (index 42) - pulse to extend ID
- **Right OD Retract**: `GRIGHTHEAD.bHmiRightRedPb` (index 48) - pulse to retract OD

### Physical Machine Buttons Referenced
According to io-map.json:
- **Jog Advance (Extend)**: Index 104 → `GIO.bJogAdvPb` (physical button on machine)
- **Jog Retract**: Index 105 → `GIO.bJogRetPb` (physical button on machine)
- **Jog Advance Light**: Index 153 → `GIO.bJogAdvLt` (indicator light)
- **Jog Retract Light**: Index 154 → `GIO.bJogRetLt` (indicator light)

## Component Files

### React Component: JogModeDialog.js
**Location**: `src/components/JogModeDialog.js`

**Props**:
- `side` (string): 'left' or 'right' - which side is in jog mode
- `isActive` (boolean): whether the dialog should be visible
- `readyStatus` (object): { id: boolean, od: boolean } - ready status for ID and OD
- `actualPositions` (object): { axis1: number, axis2: number } - current axis positions
- `onClose` (function): callback when user closes dialog
- `onSwitchSide` (function): callback when user switches to other side

**Features**:
1. **Header Banner**: Shows "LEFT/RIGHT SIDE JOG ACTIVE" with purple gradient
2. **Mode Selection Buttons**: ID and OD buttons with ready/not-ready status
3. **Status Messages**: Dynamic messages based on mode readiness
4. **Instructions**: Shows which buttons to use (Extend/Retract)
5. **Jog Controls**: Large green Extend and red Retract buttons
6. **Axis Position Display**: Shows real-time axis1 and axis2 positions
7. **Side Switch Button**: Orange button to switch to the other side
8. **Close Button**: To dismiss the dialog

### CSS Styling: JogModeDialog.css
**Location**: `src/styles/JogModeDialog.css`

Includes:
- Dark gradient dialog with purple accent border
- Pulsing animation on header banner
- Color-coded buttons (blue for ID, red/orange for OD, green for extend, red for retract)
- Ready/waiting status colors (green for ready, orange for waiting)
- Smooth animations and hover effects
- Monospace font for position display

### MainHMI.js Integration

**New State Variables**:
```javascript
const [showJogDialog, setShowJogDialog] = useState(false);
const [jogActiveSide, setJogActiveSide] = useState(null); // 'left' or 'right'
const [jogReadyStatus, setJogReadyStatus] = useState({
  left: { id: false, od: false },
  right: { id: false, od: false }
});
```

**Polling Loop Updates**:
- Added code to detect when jog mode is active and automatically open the dialog
- Reads both `bHmiLeftJogMode`/`bHmiRightJogMode` and ready status tags
- Only closes dialog when both sides exit jog mode

**Handler Functions**:
- `handleJogModeSideSwitch(newSide)`: Updates which side is active and calls `writePLCVar({ command: 'enableJog', side })`
- `handleJogDialogClose()`: Closes the dialog

## User Workflow

1. **Operator Clicks "ENABLE JOG"** → HMI pulses the jog pushbutton tag (100ms pulse)
2. **PLC Responds** → Sets `bHmiLeftJogMode` or `bHmiRightJogMode` to true
3. **UI Polling Detects** → Reads jog mode status and automatically opens JogModeDialog
4. **Dialog Displays**:
   - "LEFT/RIGHT SIDE JOG ACTIVE" banner
   - ID and OD buttons (enabled/disabled based on ready status)
   - Waits for ID/OD selection
5. **Operator Selects ID or OD**:
   - If ID ready: Shows "Push extend button to extend ID and retract button to retract ID"
   - If OD ready: Shows "Push extend button to extend OD and retract button to retract OD"
6. **Operator Presses Extend/Retract**:
   - HMI pulses the corresponding PLC tag for 150ms
   - PLC processes the movement
   - UI displays real-time axis positions
7. **Switch Sides** (Optional):
   - Operator can click "SWITCH TO RIGHT/LEFT SIDE"
   - HMI disables jog on current side and enables on new side
   - Dialog updates to show new side
8. **Exit Jog Mode**:
   - Operator presses physical "CYCLE HOLD" or similar PLC-level exit
   - PLC clears `bHmiLeftJogMode`/`bHmiRightJogMode`
   - Dialog automatically closes

## Technical Notes

### Button Pulse Timing
- **Enable Jog**: 100ms pulse (from `enableJogMode` in plcApiService.js)
- **Extend/Retract**: 150ms pulse (from JogModeDialog component)
- Adjust as needed if PLC firmware requires longer/shorter pulses

### Ready Status Interpretation
- `bHmiLeftExpEna = true` means ID (expand head) is ready to accept extend/retract commands
- `bHmiLeftRedEna = true` means OD (reduction/red head) is ready to accept extend/retract commands
- Both can be true simultaneously, allowing operator to choose

### Axis Position Units
- Positions are displayed from `actualPositions.axis1` and `actualPositions.axis2`
- These are read via `/read-axis-positions` endpoint from PLC
- Units are converted based on `unitSystem` (mm or inch) - but not converted in JogModeDialog for accuracy
- Displayed with 3 decimal places

### Side Switching Logic
When operator clicks "SWITCH TO RIGHT/LEFT SIDE":
1. Calls `onSwitchSide(newSide)` which updates `jogActiveSide`
2. Calls `writePLCVar({ command: 'enableJog', side: newSide })`
3. This pulses the new side's jog pushbutton tag
4. PLC-side logic should handle the switchover
5. Dialog re-renders with new side's data

## io-map.json Mapping

Relevant jog-related indices:
- **Index 3**: `GLEFTHEAD.bHmiLeftJogPb` (input)
- **Index 4**: `GLEFTHEAD.bHmiLeftJogMode` (output)
- **Index 42**: `GRIGHTHEAD.bHmiRightJogPb` (input)
- **Index 43**: `GRIGHTHEAD.bHmiRightJogMode` (output)
- **Index 104**: `GIO.bJogAdvPb` (physical Advance button)
- **Index 105**: `GIO.bJogRetPb` (physical Retract button)
- **Index 153**: `GIO.bJogAdvLt` (Advance indicator light)
- **Index 154**: `GIO.bJogRetLt` (Retract indicator light)

## Future Enhancements

1. **Multi-axis Control**: Could extend to show all 4 axes if needed
2. **Jog Speed Control**: Add slider to adjust jog speed on-the-fly
3. **Step Increments**: Allow fixed increments (e.g., 0.1mm, 0.5mm) instead of continuous
4. **Preset Positions**: Quick buttons to move to predefined positions
5. **Audio/Visual Feedback**: Beep or flash when movements complete
6. **Axis Limit Detection**: Warn operator when near soft limits
7. **Dual-Side Jog**: Allow jogging both sides simultaneously

## Troubleshooting

### Dialog doesn't open when Enable Jog is pressed
- Check that PLC is setting `bHmiLeftJogMode` or `bHmiRightJogMode` to true
- Verify poll interval is fast enough (~2s) to catch the mode change
- Check browser console for read errors

### Ready buttons are disabled
- Check PLC tags `bHmiLeftExpEna`, `bHmiLeftRedEna`, etc.
- PLC logic should set these when the respective head is ready
- May need to trigger homing or start position first

### Axis positions show as 0.000
- Check `/read-axis-positions` endpoint is working
- Verify PLC tags `GPersistent.lAxis1ActPos`, etc. have valid values
- Check poll interval is not too aggressive (causes read timeouts)

### Extend/Retract buttons not responding
- Check pulse timing (150ms) is sufficient for PLC
- Verify PLC is actually in jog mode (not blocked by another state)
- Check for interlock conditions in PLC (e.g., pump not running, head not ready)
