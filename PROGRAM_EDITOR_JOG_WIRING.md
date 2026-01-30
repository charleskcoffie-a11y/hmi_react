# ProgramEditor Jog Button PLC Wiring

## Overview
The jog button in the program editor (edit page) has been wired to communicate directly with the PLC for real-time jog mode control during recipe/program editing.

## Implementation Details

### What Changed
**File**: `src/components/ProgramEditor.js`

### State Management
Three new state variables were added:

1. **`jogMode`** (boolean)
   - Tracks local UI state of jog button
   - Controls whether polling is active
   - Set to `true` when user clicks jog button to enable

2. **`jogModeActive`** (boolean)
   - PLC feedback state showing actual jog mode status
   - Updated via polling from `GLEFTHEAD.bHmiLeftJogMode` or `GRIGHTHEAD.bHmiRightJogMode`
   - Used to render button appearance and tooltip

3. **`jogPollInterval`** (ref)
   - Holds polling interval ID
   - Cleared when jog mode is disabled or component unmounts

### PLC Communication Flow

#### Enable Jog
```
User clicks Jog button
  ↓
handleJogModeToggle() called
  ↓
writePLCVar({ command: 'enableJog', side: 'left' or 'right' })
  ↓
Backend pulses: GLEFTHEAD.bHmiLeftJogPb or GRIGHTHEAD.bHmiRightJogPb (200ms)
  ↓
PLC sets jog mode active
```

#### Polling Feedback
```
Every 200ms (while jogMode is true):
  ↓
Fetch from /read endpoint
  ↓
Check GLEFTHEAD.bHmiLeftJogMode or GRIGHTHEAD.bHmiRightJogMode
  ↓
Update jogModeActive state
  ↓
Button renders with updated visual feedback
```

#### Disable Jog
```
User clicks Jog button again
  ↓
handleJogModeToggle() called
  ↓
writePLCVar({ command: 'disableJog', side: 'left' or 'right' })
  ↓
Backend pulses: GLEFTHEAD.bHmiLeftJogHeadEnabledOff or GRIGHTHEAD.bHmiRightJogHeadEnabledOff (100ms)
  ↓
Polling stops
  ↓
jogModeActive set to false
```

### PLC Variables Used

| Operation | Variable | Value | Duration | Description |
|-----------|----------|-------|----------|-------------|
| Enable (Left) | GLEFTHEAD.bHmiLeftJogPb | true pulse | 200ms | Start jog mode for left head |
| Enable (Right) | GRIGHTHEAD.bHmiRightJogPb | true pulse | 200ms | Start jog mode for right head |
| Feedback (Left) | GLEFTHEAD.bHmiLeftJogMode | boolean | Polled 200ms | Actual jog mode status from PLC |
| Feedback (Right) | GRIGHTHEAD.bHmiRightJogMode | boolean | Polled 200ms | Actual jog mode status from PLC |
| Disable (Left) | GLEFTHEAD.bHmiLeftJogHeadEnabledOff | true pulse | 100ms | Stop jog mode for left head |
| Disable (Right) | GRIGHTHEAD.bHmiRightJogHeadEnabledOff | true pulse | 100ms | Stop jog mode for right head |

### Button UI Changes

**Button Class**: `.step-action-btn.jog`

**States**:
- **Inactive**: `◉ Jog` - Gray button, inactive state
- **Active**: `✓ Jog` - Blue button with checkmark, active state

**Title Tooltip**:
- Inactive: "Jog Mode: Inactive (Click to enable)"
- Active: "Jog Mode: ACTIVE on PLC"

### Error Handling

If jog mode toggle fails:
1. Error is caught in `handleJogModeToggle()`
2. Dialog displayed with error message
3. Local state not updated (remains in previous state)
4. User can retry

Example error dialog:
```
Title: "Jog Mode Error"
Message: "Failed to toggle jog mode: [error details]"
```

### Side Determination

The jog button automatically determines which side to control based on `program.side`:
- `program.side === 'left'` → Uses `GLEFTHEAD` variables
- `program.side === 'right'` → Uses `GRIGHTHEAD` variables

If no program side is defined, the toggle is skipped with console error.

## Usage

1. Open program editor (Edit button on program card)
2. Click the jog button (`◉ Jog`)
3. Button changes to `✓ Jog` when PLC confirms jog mode active
4. Move axes using the machine's physical jog controls
5. Click button again (`✓ Jog`) to disable jog mode
6. Button returns to `◉ Jog` when PLC confirms disabled

## Console Logging

All operations log to browser console with `[ProgramEditor]` prefix:
- `Enabling jog mode for [left|right]`
- `Disabling jog mode for [left|right]`
- `Jog feedback ([left|right]): [true|false]`
- Error messages for failed operations

## Testing Checklist

- [ ] Click jog button → `writePLCVar` called with `command: 'enableJog'`
- [ ] PLC variables receive pulse on `bHmiLeftJogPb` or `bHmiRightJogPb`
- [ ] Polling starts and checks jog mode feedback every 200ms
- [ ] Button shows checkmark when PLC confirms jog mode active
- [ ] Clicking button again → `writePLCVar` called with `command: 'disableJog'`
- [ ] Polling stops when jog mode disabled
- [ ] Button returns to inactive state
- [ ] Disabling unresponsive jog shows error dialog
- [ ] Side correctly determined from program.side (left/right)
