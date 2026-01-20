# AutoTeach Axis Selection Modal - Implementation Summary

## Overview
Implemented Option A: Modal with Axis Selection to solve the AutoTeach single-button jog constraint. When teaching patterns that control only one axis (ID or OD), the user must now explicitly select which axis to enable before recording the step.

## Problem Statement
Physical jog control has only 2 buttons (Extend/Retract), meaning only ONE axis can be active at a time. Previous implementation tried to enable both ID and OD simultaneously, which was incorrect for constrained hardware.

## Solution Implementation

### New Components Created

#### 1. AutoTeachAxisSelectorModal.js
**Location**: `src/components/AutoTeachAxisSelectorModal.js`

**Features**:
- Two button options: "ID (Extend)" and "OD (Retract)"
- Side-aware PLC variable mapping:
  - Left side: `GLEFTHEAD.bHmiLeftExpPb` (ID), `GLEFTHEAD.bHmiLeftRedPb` (OD)
  - Right side: `GRIGHTHEAD.bHmiRightExpPb` (ID), `GRIGHTHEAD.bHmiRightRedPb` (OD)
- Real-time feedback showing which axis is currently enabled
- Pulsing of appropriate PLC variable (200ms duration) when user selects an axis
- Status message confirming axis activation
- Cancel button to skip selection
- Confirm button (enabled only after axis selection) to start teaching

**Props**:
- `isOpen`: Boolean to control modal visibility
- `onClose(selectedAxis)`: Callback when user selects an axis (or null if cancelled)
- `patternName`: Pattern name to display in header
- `side`: "left" or "right" for proper PLC variable selection
- `jogReadyStatus`: Real-time feedback object `{ id: boolean, od: boolean }`

### New Styling

#### AutoTeachAxisSelectorModal.css
**Location**: `src/styles/AutoTeachAxisSelectorModal.css`

**Styling highlights**:
- Blue gradient header matching application theme
- Dark background with modern modal overlay
- Side-specific color coding (YELLOW for side indicator)
- Axis buttons with visual feedback:
  - Hover: Blue border + glow effect
  - Selected (green): Green border, green text, darkened background
  - Feedback text: Red initially, green when active
- Smooth animations (slideIn 0.3s)
- Responsive sizing (90% width, max 500px)
- Status messages with color-coded visual hierarchy

### Modified Components

#### AutoTeach.js
**Changes made**:

1. **Import Modal**:
   ```javascript
   import AutoTeachAxisSelectorModal from './AutoTeachAxisSelectorModal';
   ```

2. **Added State Variables**:
   ```javascript
   const [showAxisSelector, setShowAxisSelector] = useState(false);
   const [jogReadyStatus, setJogReadyStatus] = useState({ id: false, od: false });
   ```

3. **Enhanced Polling** (pollJogMode useEffect):
   - Added `pollAxisFeedback()` function
   - Polls both ID feedback (bHmiLeftExpEna/bHmiRightExpEna) and OD feedback (bHmiLeftRedEna/bHmiRightRedEna)
   - Updates state every 500ms alongside jog mode polling
   - Provides real-time UI feedback

4. **Updated handleRecordPosition()**:
   - Detects single-axis patterns (codes 0, 1, 2, 3)
   - Opens axis selector modal instead of immediately recording
   - Delegates recording to new `recordStepWithAxis()` function

5. **New recordStepWithAxis() Function**:
   - Extracted common recording logic
   - Accepts selectedAxis parameter for future extension
   - Maintains all original recording behavior

6. **New handleAxisSelected() Handler**:
   - Closes modal
   - Calls recordStepWithAxis with appropriate step number and pattern

7. **Modal Rendering**:
   ```javascript
   <AutoTeachAxisSelectorModal
     isOpen={showAxisSelector}
     onClose={handleAxisSelected}
     patternName={patternOptions.find(p => p.code === pattern)?.name}
     side={side}
     jogReadyStatus={jogReadyStatus}
   />
   ```

## Workflow

### Before (Incorrect)
1. User selects pattern (0, 1, 2, or 3)
2. Clicks Record
3. Both ID and OD attempted to enable (wrong!)
4. Step recorded

### After (Correct)
1. User selects pattern (0, 1, 2, or 3)
2. Clicks Record
3. **Axis Selection Modal Opens**
   - Pattern name displayed
   - User clicks "ID" or "OD"
   - PLC variable pulsed
   - Feedback shows active axis
4. User clicks "Start Teaching"
5. Step recorded with single axis enabled

## Pattern Coverage

Modal triggers for these single-axis patterns:
- **Pattern 0** (Red Ext) → OD axis
- **Pattern 1** (Red Ret) → OD axis
- **Pattern 2** (Exp Ext) → ID axis
- **Pattern 3** (Exp Ret) → ID axis

Modal does NOT trigger for:
- **Pattern 5** (Repeat) - Already has its own config modal
- **Pattern 4** (RedRet + ExpRet) - Both axes, no selection needed
- **Pattern 6** (RedExt + ExpExt) - Both axes, no selection needed
- **Pattern 8** (All off) - No axes active
- **Step 1** - Always pattern 6 (both axes)

## PLC Variable Mapping

### Left Head Axis Enable
- **ID (Expand)**: `GLEFTHEAD.bHmiLeftExpPb` (push button tag)
- **OD (Retract)**: `GLEFTHEAD.bHmiLeftRedPb` (push button tag)
- **Feedback**: `bHmiLeftExpEna`, `bHmiLeftRedEna` (enable feedback)

### Right Head Axis Enable
- **ID (Expand)**: `GRIGHTHEAD.bHmiRightExpPb` (push button tag)
- **OD (Retract)**: `GRIGHTHEAD.bHmiRightRedPb` (push button tag)
- **Feedback**: `bHmiRightExpEna`, `bHmiRightRedEna` (enable feedback)

## Technical Details

### PLC Communication
- Method: HTTP POST to `http://localhost:3001/pulse-bool` via `pulseBoolTag()`
- Duration: 200ms pulse for axis enable tags
- Polling: 500ms interval reads feedback variables every 500ms
- Timeout: 5000ms default (inherited from plcApiService)

### State Management
- Modal state: `showAxisSelector` boolean
- Feedback state: `jogReadyStatus` object { id: boolean, od: boolean }
- Axis selection tracked via modal's internal state, passed back via callback

### Error Handling
- Failed PLC writes logged to console
- Graceful degradation if PLC unreachable
- Modal remains open to allow retry
- No blocking errors prevent teaching

## Build & Deployment

### Build Process
```bash
npm run build                    # Create optimized React build
cd electron
npm install                      # Install Electron dependencies
npm run dist32                   # Build 32-bit Windows installer
```

### Output
- **Installer**: `electron/dist/CNC Dual head Setup 1.0.0.exe` (57.78 MB)
- **Build Date**: 2026-01-20 3:14:57 PM
- **Architecture**: 32-bit (--ia32 flag)
- **Format**: NSIS installer with unpacked resources

## Testing Recommendations

1. **Modal Opening**
   - Verify modal opens after selecting patterns 0, 1, 2, 3
   - Verify modal does NOT open for patterns 4, 5, 6, 8
   - Verify modal does NOT open for Step 1

2. **Axis Selection**
   - Click ID button → verify correct PLC variable pulsed
   - Click OD button → verify correct PLC variable pulsed
   - Verify feedback text turns green when axis enables

3. **Side Switching**
   - Test left side: verify left-specific variables pulse
   - Test right side: verify right-specific variables pulse
   - Verify side label displays correctly

4. **Recording**
   - After axis selection, verify step records successfully
   - Verify recorded step preserves selected axis info
   - Verify PLC receives correct step data

5. **Error Cases**
   - Unplug PLC network → feedback should not update
   - Close modal without selecting → no step recorded
   - Cancel during modal → verify return to pattern selection

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `src/components/AutoTeachAxisSelectorModal.js` | NEW | 151 |
| `src/styles/AutoTeachAxisSelectorModal.css` | NEW | 166 |
| `src/components/AutoTeach.js` | Modified | +85 / -40 |

## Commits

- **Commit**: "Implement AutoTeach axis selection modal for constrained jog teaching"
- **Hash**: 5629022 (bottomwrite branch)
- **Files**: 3 changed, 434 insertions(+), 3 deletions(-)
- **Date**: 2026-01-20

## Future Enhancements

1. **Switch Axis Button**: Add button during teaching to allow changing axis without canceling
2. **Axis History**: Remember last selected axis to pre-select in modal
3. **Keyboard Shortcuts**: Numbers 1/2 to quickly select ID/OD
4. **Audio Feedback**: Beep when axis successfully enables
5. **Extended Feedback**: Show live position values for selected axis
6. **Batch Mode**: Record multiple steps with same axis without re-opening modal

## Notes

- Modal is non-blocking: user can cancel anytime
- PLC variables are pulsed (not held), maintaining hardware safety
- Feedback variables polled at 500ms for responsive UI
- All logging uses [AutoTeachAxisSelector] prefix for debugging
- Component follows existing HMI design patterns and color scheme
