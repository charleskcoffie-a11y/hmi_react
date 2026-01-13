# AI Coding Agent Instructions for HMI React Codebase

## Quick Overview
This is a **React-based HMI (Human-Machine Interface) for a 4-axis CNC machine** with direct Beckhoff TwinCAT 3 PLC integration via ADS (Automation Device Specification). The system supports teaching 10-step machine programs and managing recipes on dual machine heads (left/right sides).

## Architecture

### Core Components
- **React Web App** (`src/`) - Frontend UI with axis controls, program creation, recipe management
- **Electron Wrapper** (`electron/`) - Desktop app packaging with 1024x768 resolution support
- **Node.js ADS Backend** (`electron/backend/plc-server.js`) - Express server bridging web app to PLC via ads-client library
- **PLC Integration** - Direct communication with Beckhoff TwinCAT variables via NET ID `169.254.109.230.1.1`

### Data Flow
1. React components call `plcApiService` (HTTP to localhost:3001)
2. Backend Express app translates HTTP requests to ADS read/write operations
3. ADS client communicates with PLC variables (position arrays, counters, alarms)
4. LocalStorage persists programs and recipes locally

### Key Services
- `plcApiService.js` - HTTP-based API layer for PLC operations
- `plcService.js` - Low-level ADS client operations (legacy, mostly replaced by plcApiService)
- `recipeService.js` - Local recipe file I/O and persistence
- `netIdService.js` - PLC NET ID configuration management
- `ioService.js` - Digital I/O mapping via io-map.json

## Critical Patterns & Conventions

### Program & Recipe Data Structures
Programs and recipes follow this structure (see `TEN_STEP_PROGRAM_GUIDE.md`):
```javascript
{
  name: "Part_Assembly_01",
  side: "right", // or "left"
  createdAt: "2025-12-18T10:30:00.000Z",
  steps: {
    1: { step: 1, positions: { axis1Cmd, axis2Cmd, axis3Cmd, axis4Cmd }, pattern, repeat, repeatTimes },
    2: { /* ... */ },
    // ... up to 10
  }
}
```
- **Step 3 is special**: Records expand/retract positions separately
- **Left side**: Uses axis3 and axis4; **Right side**: Uses axis1 and axis2
- Patterns: 0=single pass, 1-4=multi-pass variations, 5=repeat step (skipped in AutoEdit)

### Component State Management
- **MainHMI.js** is the state hub - manages program creation flow, recipes, dialogs, PLC reads/writes
- Modal pattern: Dialogs render conditionally based on `showXXXDialog` state flags
- Programs flow through steps 1→10, each with dedicated component (Step1, Step2, Step3, then GenericProgramStep 4-10)

### Styling Convention
All styles are in `src/styles/` matching component names. Use CSS classes with component-scoped naming (e.g., `.program-creation-step1-container`).

### Async Operations
- Always use async/await for PLC operations; wrap in try/catch
- Common operations: `readPLCVar()`, `readAxisPositions()`, `writePLCVar()`, `pulseBoolTag()` 
- Handle 5000ms timeout gracefully (default in plcApiService)

## Build & Development Workflows

### React App Development
```bash
npm start              # Dev server on localhost:3000 (auto-refresh)
npm run build          # Production build to ./build/ folder
npm test               # Run Jest tests
```

### Electron Desktop App
```bash
cd electron
npm install            # Install Electron and electron-builder dependencies
npm start              # Run Electron app (loads ./build from parent dir)
npm run dist32         # Build 32-bit Windows NSIS installer
```

The electron build pipeline:
1. Must run `npm run build` from root first to create `./build/`
2. `electron/copy-build.js` copies `./build` into `electron/build` before packaging
3. Final installer placed in `electron/dist/`

### Backend Server (In Electron)
`electron/backend/plc-server.js` is spawned by `electron/main.js` during app startup. It:
- Listens on port 3001 for React app HTTP requests
- Creates ADS client connection to PLC
- Routes commands like `setRecipeParameters`, `downloadProgram`, `enableJogMode`, `home`, `run`

## Important Integration Points

### PLC Variable Naming Convention
Variables follow TwinCAT naming:
- Position arrays: `GPersistent.lLeftPosStep1` through `GPersistent.lLeftPosStep10`, `GPersistent.lRightPosStep1` through `GPersistent.lRightPosStep10` (ARRAY [0..3] OF LREAL)
- Actual positions: `GPersistent.lAxis1ActPos`, `GPersistent.lAxis2ActPos`, `GPersistent.lAxis3ActPos`, `GPersistent.lAxis4ActPos` (LREAL)
- Sequence counters: `iSeqLStep1` through `iSeqLStep10`, `iSeqRStep1` through `iSeqRStep10` (INT)
- Alarms & status: `GAxis.AlarmSystem` (bitfield), `GAxis.MachineStatus` (bitfield)
- Head control: `GLEFTHEAD.*`, `GRIGHTHEAD.*` (for step positions, recipe parameters, and mode control)
- Jog/Run flags for each side: `bJogLEnabled`, `bJogREnabled`, `bRunLEnabled`, `bRunREnabled`

### Alarm & Status Bit Mappings
Defined as arrays in MainHMI.js:
- `ALARM_MAP` - 15 defined alarm bits with severity levels
- `MACHINE_STATUS_MAP` - 11 machine state bits with status labels
- `decodeAlarmBits()` and `decodeMachineStatus()` helper functions convert bitfield integers to arrays

### NET ID Configuration
- Default: `169.254.109.230.1.1` (in environment or plc-server.js)
- User can configure via Settings modal
- Saved to localStorage (React) and electron config file (persistent)
- Backend initialized via `initializeBackendNetId()` service

### Digital I/O Mapping
`electron/backend/io-map.json` maps button indices to PLC tags:
```json
{
  "buttons": [
    { "index": 0, "tag": "MAIN.ButtonTag1" },
    { "index": 1, "tag": "MAIN.ButtonTag2" }
  ]
}
```

## Testing & Debugging Tips

### Common Tasks
- **Test PLC connection**: Hit `/status` endpoint on port 3001
- **Mock PLC operations**: Modify `plcApiService.js` to return dummy data instead of HTTP calls
- **Check dialog visibility**: Search for `show` + component name in MainHMI.js state
- **Trace program flow**: Log state changes in useEffect dependency arrays

### Console Logging Convention
Code uses prefixed logs for clarity:
- `[App]` - React App.js
- `[plc-server]` - Backend server
- `[electron]` - Electron main process
- `[component-name]` - Individual React components

## When Adding Features

1. **New PLC variable?** Add to MainHMI.js `readPLCVar()` call and `STEP_CONFIG` or alarm/status maps
2. **New program step?** Copy `GenericProgramStep.js`, update step number; add state logic to MainHMI.js
3. **New recipe parameter?** Update `RecipeParameters.js` UI + backend write logic in plc-server.js
4. **New dialog/modal?** Create component, add `showXXXDialog` state to MainHMI, render conditionally
5. **Build issue?** Check `electron/copy-build.js` copies the right files; verify paths are absolute

## Key Files Reference
- **State & orchestration**: src/MainHMI.js (1600+ lines - main controller)
- **Program creation**: src/components/ProgramCreationStep1.js, Step2, Step3, GenericProgramStep
- **API bridge**: src/services/plcApiService.js
- **Backend**: electron/backend/plc-server.js
- **Data structures**: TEN_STEP_PROGRAM_GUIDE.md, HMI_DESIGN.md

## Common Gotchas
- **Step 3 special handling**: Always check for pattern type before applying expand/retract logic
- **Left vs. right axes**: Right uses axis1/2, left uses axis3/4 - easy to swap
- **Repeat steps**: Pattern 5 means the step repeats N times; some features (like AutoEdit) skip these
- **Window resolution**: Electron hardcoded to 1024x768 - check responsive design doesn't break
- **Backend timing**: PLC reads timeout after 5 seconds - network delays matter in manufacturing environments
