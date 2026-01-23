# CNC Dual Head HMI - React + Electron + TwinCAT 3

This project is a React-based HMI (Human-Machine Interface) for a 4-axis CNC machine with direct Beckhoff TwinCAT 3 PLC integration via ADS (Automation Device Specification). The system supports teaching 10-step machine programs and managing recipes on dual machine heads (left/right sides).

## Key Features

- **10-Step Program Creation**: Teach positions for each step with support for expand/retract movements
- **Dual Machine Heads**: Independent program control for left and right sides
- **Recipe Management**: Store and load machine parameters (speed, dwell, dimensions)
- **Direct PLC Integration**: Real-time communication via ADS protocol with Beckhoff TwinCAT 3
- **Electron Desktop App**: Packaged as standalone Windows application (32-bit NSIS installer)
- **Auto Teach Mode**: Streamlined workflow for rapid program creation with jog mode integration

## Architecture

- **React Web App** (`src/`) - Frontend UI with axis controls, program creation, recipe management
- **Electron Wrapper** (`electron/`) - Desktop app packaging with 1024x768 resolution support
- **Node.js ADS Backend** (`electron/backend/plc-server.js`) - Express server bridging web app to PLC via ads-client library
- **PLC Integration** - Direct communication with Beckhoff TwinCAT variables via NET ID

## PLC Data Structure

### Step 1 - Start Position
```
GLEFTHEAD.lLeftPosStep1[0]   = OD (Red) position
GLEFTHEAD.lLeftPosStep1[2]   = ID (Exp) position
GRIGHTHEAD.lRightPosStep1[0] = OD (Red) position
GRIGHTHEAD.lRightPosStep1[2] = ID (Exp) position
```

### Steps 2-10 - 2D Arrays with Extend/Retract
```
GLEFTHEAD.aLeftRedPos[2..10, 0..1]  = Left OD [step, 0=retract/1=extend]
GLEFTHEAD.aLeftExpPos[2..10, 0..1]  = Left ID [step, 0=retract/1=extend]
GRIGHTHEAD.aRightRedPos[2..10, 0..1] = Right OD [step, 0=retract/1=extend]
GRIGHTHEAD.aRightExpPos[2..10, 0..1] = Right ID [step, 0=retract/1=extend]
```

## Getting Started

### Development Mode

```bash
npm install          # Install dependencies
npm start            # Run React dev server on localhost:3000
```

### Production Build

```bash
npm run build        # Build React app to ./build/
cd electron
npm install          # Install Electron dependencies
npm start            # Run Electron app (loads ./build)
npm run dist32       # Build 32-bit Windows NSIS installer
```

The installer will be created at `electron/dist/CNC Dual head Setup [version].exe`

## Documentation

- [QUICKSTART.md](QUICKSTART.md) - Quick setup guide
- [TEN_STEP_PROGRAM_GUIDE.md](TEN_STEP_PROGRAM_GUIDE.md) - Program structure and PLC integration details
- [TWINCAT_RECIPE_STRUCTURE.md](TWINCAT_RECIPE_STRUCTURE.md) - Recipe parameter mapping
- [HMI_DESIGN.md](HMI_DESIGN.md) - UI/UX design specifications
- [JOG_MODE_IMPLEMENTATION.md](JOG_MODE_IMPLEMENTATION.md) - Jog mode feature details

## Configuration

### PLC NET ID
Default: `169.254.109.230.1.1` (configurable via Settings modal in app)

### Backend Server
Port: `3001` (HTTP API for PLC operations)

### Electron Window
Resolution: `1024x768` (hardcoded in `electron/main.js`)

## License

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Auto Edit (Global Offset)

The Edit Program page includes an Auto Edit feature to quickly offset taught positions based on measured and desired diameters.

- Open the editor and press the `Auto Edit` button.
- Enter the current diameter and desired diameter. Tap a field to use the on-screen NumericKeypad.
- Confirm to apply a global offset: `delta = desired - current`.
- The offset updates the active axis positions for each step (based on the step pattern and side), while skipping any `Repeat` steps (pattern 5).
- Values are rounded to 3 decimals and only numeric fields are modified.

Notes:
- Right side updates `axis1Cmd` and/or `axis2Cmd` for active axes.
- Left side updates `axis3Cmd`/`axis4Cmd` when present, otherwise `axis1Cmd`/`axis2Cmd`.
- Repeat steps (pattern 5) are not altered.
