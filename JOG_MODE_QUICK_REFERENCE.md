# Jog Mode - Quick Reference Card

## 📋 Files Modified/Created

| File | Type | Changes |
|------|------|---------|
| `src/components/JogModeDialog.js` | NEW | 180 lines - Main dialog component |
| `src/styles/JogModeDialog.css` | NEW | 320 lines - Dialog styling & animations |
| `src/MainHMI.js` | MODIFIED | +50 lines - Import, state, polling, render |
| `JOG_MODE_IMPLEMENTATION.md` | NEW | 250+ lines - Complete technical guide |
| `JOG_MODE_FEATURE_SUMMARY.md` | NEW | 216 lines - Visual diagrams & flows |
| `JOG_MODE_CHECKLIST.md` | NEW | 208 lines - Feature checklist & testing |

## 🎮 User Controls

### Button Layout
```
┌────────────────────────────────────────────┐
│  LEFT SIDE JOG ACTIVE        [SWITCH SIDE] │ ← Orange
├────────────────────────────────────────────┤
│  SELECT JOG MODE:                          │
│  [ID ✓]  [OD ✗]                            │ ← Blue/Orange
├────────────────────────────────────────────┤
│  ✓ ID is ready to jog                      │
│  Instructions here...                      │
├────────────────────────────────────────────┤
│  [⬆️ EXTEND]  [⬇️ RETRACT]                  │ ← Green/Red
├────────────────────────────────────────────┤
│  Axis 1: 123.456      Axis 2: 789.012      │
├────────────────────────────────────────────┤
│  [CLOSE]                                   │ ← Dark gray
└────────────────────────────────────────────┘
```

## 🔌 PLC Tag Summary

### **Feedback (HMI Reads)**
```javascript
// Jog Mode Status
GLEFTHEAD.bHmiLeftJogMode     // = true when in jog
GRIGHTHEAD.bHmiRightJogMode   // = true when in jog

// Ready Status (ID/OD Availability)
GLEFTHEAD.bHmiLeftExpEna      // = true when ID ready
GLEFTHEAD.bHmiLeftRedEna      // = true when OD ready
GRIGHTHEAD.bHmiRightExpEna    // = true when ID ready
GRIGHTHEAD.bHmiRightRedEna    // = true when OD ready
```

### **Commands (HMI Writes)**
```javascript
// Enable Jog (pulse 100ms)
GLEFTHEAD.bHmiLeftJogPb       // Pulse to enable left jog
GRIGHTHEAD.bHmiRightJogPb     // Pulse to enable right jog

// Extend/Retract (pulse 150ms)
GLEFTHEAD.bHmiLeftExpPb       // Pulse to extend ID
GLEFTHEAD.bHmiLeftRedPb       // Pulse to retract OD
GRIGHTHEAD.bHmiRightExpPb     // Pulse to extend ID
GRIGHTHEAD.bHmiRightRedPb     // Pulse to retract OD
```

## 🔄 Data Flow

```
Operator selects side (left/right)
    ↓
HMI pulses jog pushbutton (100ms)
    ↓
PLC sets bHmiLeftJogMode/bHmiRightJogMode = true
    ↓
HMI polling detects change (every ~2s)
    ↓
Dialog auto-opens with ready status
    ↓
Operator selects ID or OD
    ↓
Operator presses Extend or Retract
    ↓
HMI pulses corresponding button (150ms)
    ↓
PLC moves the head
    ↓
actualPositions updates from PLC
    ↓
Dialog displays new axis values
    ↓
(Repeat or Switch Side)
```

## ⚡ Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Dialog won't open | Check PLC tag `bHmiLeftJogMode` = true |
| ID button grayed out | Check PLC tag `bHmiLeftExpEna` = true |
| OD button grayed out | Check PLC tag `bHmiLeftRedEna` = true |
| Extend/Retract not working | Verify mode selected and ready, check pulse pulse in network monitor |
| Positions show 0.000 | Check `/read-axis-positions` endpoint, verify PLC axis positions are valid |
| Side switch doesn't work | Check `writePLCVar` succeeds, verify new side's `bHmiJogMode` changes |
| Dialog won't close | Check PLC clears `bHmiLeftJogMode` and `bHmiRightJogMode` to false |

## 📞 API Calls Used

```javascript
// Read jog mode status
fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftJogMode')
fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftExpEna')
fetch('http://localhost:3001/read?tag=GLEFTHEAD.bHmiLeftRedEna')

// Pulse extend/retract
pulseBoolTag('GLEFTHEAD.bHmiLeftExpPb', 150)
pulseBoolTag('GLEFTHEAD.bHmiLeftRedPb', 150)

// Switch sides
writePLCVar({ command: 'enableJog', side: 'right' })

// Read axis positions
fetch('http://localhost:3001/read-axis-positions')
```

## 🎨 Color Reference

```javascript
const COLORS = {
  dialogBackground: '#1e1e1e',      // Dark gray
  dialogBorder: '#9C27B0',          // Purple
  headerBg: 'linear-gradient(90deg, #9C27B0, #7B1FA2)', // Purple gradient
  
  idButton: '#2196F3',              // Blue
  odButton: '#FF5722',              // Orange-Red
  switchButton: '#FF6F00',          // Orange
  extendButton: '#4CAF50',          // Green
  retractButton: '#F44336',         // Red
  closeButton: '#424242',           // Dark gray
  
  statusReady: '#4CAF50',            // Green (ready)
  statusWaiting: '#FF9800',          // Orange (waiting)
  statusDisabled: 'rgba(255,255,255,0.1)' // Faded white
};
```

## 📊 Component Props

```javascript
<JogModeDialog
  side="left"                    // 'left' or 'right'
  isActive={true}                // Show/hide
  readyStatus={{
    id: true,                    // ID ready?
    od: false                    // OD ready?
  }}
  actualPositions={{
    axis1: 123.456,              // Current position
    axis2: 789.012               // Current position
  }}
  onClose={() => {}}             // Close handler
  onSwitchSide={(newSide) => {}} // Side switch handler
/>
```

## ✅ Pre-Deployment Checklist

- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript/ESLint errors
- [ ] No console errors in browser
- [ ] Dialog renders correctly
- [ ] All buttons clickable
- [ ] Animations smooth
- [ ] PLC tags defined in TwinCAT
- [ ] PLC logic for jog mode complete
- [ ] Test with live PLC connected
- [ ] Verify all tag reads/writes work

## 🚀 Deployment Steps

```bash
# On development machine
git checkout JogMode
npm run build

# Copy build folder to Electron app folder
cp -r build/* electron/build/

# Test in Electron (optional)
cd electron
npm start

# If all looks good, create pull request to master
git push origin JogMode
# Then merge on GitHub
```

## 📱 Responsive Design

- Designed for 1024x768 (Electron kiosk mode)
- Dialog centers on screen
- Buttons have adequate touch targets (44px min)
- Text readable from 2+ feet away
- Works on smaller screens too (tested down to 800x600)

## 🎓 Learning Resources

For more details, see:
- `JOG_MODE_IMPLEMENTATION.md` - Technical deep dive
- `JOG_MODE_FEATURE_SUMMARY.md` - Visual diagrams
- `JOG_MODE_CHECKLIST.md` - Complete feature list
- `src/components/JogModeDialog.js` - Source code with comments
