# 4-Axis Machine HMI - React Application

A professional Human-Machine Interface (HMI) for controlling a 4-axis machine with recipe management capabilities.

## System Architecture

### Machine Configuration
- **Right Side**: Axis 1 (ID), Axis 2 (OD)
- **Left Side**: Axis 3 (ID), Axis 4 (OD)

## Component Structure

```
src/
├── App.js                          # Main application entry point
├── MainHMI.js                      # Main HMI controller
├── components/
│   ├── AxisPanel.js               # Individual axis control panels
│   ├── ControlPanel.js            # Bottom control bar
│   └── RecipeManager.js           # Recipe modal management
└── styles/
    ├── App.css                    # Main app styling
    ├── MainHMI.css               # Main HMI layout
    ├── AxisPanel.css             # Axis panel styling
    ├── ControlPanel.css          # Control panel styling
    └── RecipeManager.css         # Recipe modal styling
```

## Features

### Main Screen Layout

#### Top Header
- Machine title with mode indicators
- Shows active Jog/Run modes with visual feedback

#### Two Side Panels
**Right Side Panel** (Red accent)
- Axis 1 (ID) - Inner Diameter control
- Axis 2 (OD) - Outer Diameter control

**Left Side Panel** (Teal accent)
- Axis 3 (ID) - Inner Diameter control
- Axis 4 (OD) - Outer Diameter control

#### Each Axis Card Includes
- **Status Indicator**: Shows Idle/Running/Error/Warning states
- **Position Display**: Real-time position value in mm
- **Jog Controls**: Up/Down buttons for manual control
- **Slider**: Range input for precise positioning (-100 to +100)
- **Mode Selector**: Switch between Manual/Auto modes

#### Bottom Control Panel

**Program Controls**
- **Add Program**: Create new programs
- **Edit Program**: Modify existing programs

**Mode Controls**
- **Jog Mode**: Enable/disable manual jogging (Purple indicator)
- **Run Mode**: Enable/disable automatic operation (Green indicator)

**Recipe Controls**
- **Recipe Manager**: Opens modal for recipe management

### Recipe Manager Modal

**Features**
- Listbox showing all available recipes
- **Actions**:
  - **Load**: Load selected recipe
  - **Edit**: Modify recipe parameters
  - **Copy**: Duplicate existing recipe
  - **Delete**: Remove recipe
  - **Create**: Add new recipe

**Available Operations**
- Recipe selection with visual feedback
- Recipe name editing
- Save/Cancel operations
- Scrollable recipe list

## Design Features

### Visual Design
- **Dark Theme**: Professional industrial HMI look
- **Color Scheme**:
  - Primary Blue (#0066cc): UI elements and borders
  - Accent Colors:
    - Green (#28a745): Load, Create, Run mode
    - Red (#ff6b6b): Jog mode, Error states
    - Purple (#6f42c1): Manual/Jog operations
    - Teal (#4ecdc4): Left side indicator
    - Yellow (#ffc107): Edit mode
  - Dark Grays: Background, cards, inactive elements

### Interactive Elements
- Smooth animations and transitions
- Hover effects with glow shadows
- Active/disabled button states
- Status pulse animations
- Smooth modal transitions

### Responsiveness
- Grid-based layout adapts to screen size
- Single-column layout on smaller screens
- Touch-friendly button sizes
- Scrollable content areas

## State Management

The application uses React hooks for state management:
- `jogMode`: Toggle jog functionality
- `runMode`: Toggle run functionality
- `recipeOpen`: Control recipe modal visibility
- `axis1State` to `axis4State`: Individual axis status
- `selectedRecipe`: Currently selected recipe

## API Hooks

All components include callback handlers ready for integration:

### MainHMI callbacks
```javascript
handleAxisChange(axisName, value, mode)
handleAddProgram()
handleEditProgram()
handleJogMode(active)
handleRunMode(active)
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. The application will open at `http://localhost:3000`

## Customization

### Adding More Axes
Extend `MainHMI.js` to add additional axis panels:
```javascript
<AxisPanel
  side="Name"
  axis1Name="Axis5"
  axis2Name="Axis6"
  // ...
/>
```

### Connecting to Backend
Integrate the callback handlers with your backend API:
```javascript
const handleAxisChange = async (axisName, value, mode) => {
  const response = await fetch(`/api/axis/${axisName}`, {
    method: 'POST',
    body: JSON.stringify({ value, mode })
  });
  // Handle response
};
```

### Customizing Colors
Update color values in CSS files:
- `#0066cc` → Primary blue
- `#28a745` → Success green
- `#ff6b6b` → Error red

## Browser Compatibility
- Chrome/Edge: Latest versions
- Firefox: Latest versions
- Safari: Latest versions

## Performance Notes
- CSS Grid for efficient layouts
- Smooth 60fps animations
- Optimized scrolling with custom scrollbars
- Minimal re-renders with functional components

## Future Enhancements
- WebSocket integration for real-time updates
- Data logging and history
- Advanced recipe parameters
- Multi-machine support
- User authentication
- Program execution visualization
