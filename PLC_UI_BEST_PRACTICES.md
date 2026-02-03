# PLC UI Best Practices Template

> Lessons learned from CNC Dual Head HMI project. Use this as a blueprint for your next PLC-integrated UI.

---

## Table of Contents
1. [Project Architecture](#project-architecture)
2. [Polling & State Management](#polling--state-management)
3. [Component Organization](#component-organization)
4. [PLC Communication Layer](#plc-communication-layer)
5. [Performance Patterns](#performance-patterns)
6. [Testing Strategy](#testing-strategy)
7. [Common Pitfalls](#common-pitfalls)

---

## Project Architecture

### Recommended Structure
```
project-root/
├── src/
│   ├── App.js                          # Root component
│   ├── index.js                        # Entry point
│   ├── store/                          # State management (Redux/Zustand)
│   │   ├── plcSlice.js                 # PLC variables slice
│   │   ├── uiSlice.js                  # UI state (dialogs, etc)
│   │   └── store.js                    # Store config
│   ├── hooks/                          # Custom React hooks
│   │   ├── usePLCPolling.js            # Polling hook
│   │   ├── useBatchRead.js             # Batch read hook
│   │   └── useDebounce.js              # Debounce hook
│   ├── services/                       # API & business logic
│   │   ├── plcApiService.js            # HTTP to backend
│   │   ├── pollingService.js           # Polling orchestration
│   │   └── schemaValidation.js         # PLC variable validation
│   ├── components/
│   │   ├── pages/                      # Full-page components
│   │   ├── modals/                     # Dialog/modal components
│   │   └── controls/                   # Reusable UI controls
│   └── styles/
├── electron/                           # Desktop app wrapper
│   ├── main.js
│   ├── preload.js
│   ├── backend/
│   │   ├── plc-server.js              # Express + ADS backend
│   │   ├── plcConnector.js            # ADS client wrapper
│   │   └── batchReadHandler.js        # Batch read logic
│   └── package.json
├── docs/
│   ├── PLC_VARIABLE_SCHEMA.md         # All PLC vars documented
│   ├── API_SPEC.md                    # Backend endpoints
│   └── ARCHITECTURE.md                # System design
└── package.json
```

---

## Polling & State Management

### 1. Define PLC Variable Schema Upfront

**`src/services/plcSchema.js`**
```javascript
export const PLC_SCHEMA = {
  // Position variables (LREAL arrays, 4 axes)
  positions: {
    leftPosStep: {
      range: [1, 10],
      type: 'LREAL_ARRAY',
      plcPath: 'GPersistent.lLeftPosStep',
      description: 'Left head position for each step'
    },
    rightPosStep: {
      range: [1, 10],
      type: 'LREAL_ARRAY',
      plcPath: 'GPersistent.lRightPosStep',
      description: 'Right head position for each step'
    },
    axis1Actual: {
      type: 'LREAL',
      plcPath: 'GPersistent.lAxis1ActPos',
      debounce: 200  // Milliseconds before UI update
    }
  },

  // Mode feedback (BOOL, no debounce for instant feel)
  modeFeedback: {
    leftJogMode: {
      type: 'BOOL',
      plcPath: 'GLEFTHEAD.bHmiLeftJogMode',
      debounce: 300
    },
    rightJogMode: {
      type: 'BOOL',
      plcPath: 'GRIGHTHEAD.bHmiRightJogMode',
      debounce: 300
    }
  },

  // Sequence counters (INT)
  sequenceActive: {
    leftSeq: {
      type: 'BOOL',
      plcPath: 'GLEFTHEAD.bLeftSeqAct',
      debounce: 300
    },
    rightSeq: {
      type: 'BOOL',
      plcPath: 'GRIGHTHEAD.bRightSeqAct',
      debounce: 300
    }
  },

  // Alarms (DWORD, bitfield)
  alarms: {
    systemAlarm: {
      type: 'DWORD',
      plcPath: 'GAxis.AlarmSystem',
      bitMap: {
        0: { name: 'EmergencyStop', severity: 'critical' },
        1: { name: 'MotorFault', severity: 'critical' },
        2: { name: 'Timeout', severity: 'warning' }
        // ... 15 bits total
      }
    }
  }
};

// Auto-generate batch read list
export const BATCH_READ_TAGS = Object.values(PLC_SCHEMA)
  .flatMap(category => Object.values(category))
  .map(v => v.plcPath);  // [20+ tags]

// Type validation
export function validatePLCValue(key, value) {
  const schema = findSchema(key);
  if (!schema) throw new Error(`Unknown PLC variable: ${key}`);
  
  if (schema.type === 'BOOL' && typeof value !== 'boolean') {
    throw new Error(`${key} expects BOOL, got ${typeof value}`);
  }
  // ... other type checks
  
  return true;
}
```

**Benefits:**
- Single source of truth for all PLC variables
- Easy to add debounce per variable
- Type safety
- Auto-generates batch read list
- Self-documenting

### 2. Custom Polling Hook

**`src/hooks/usePLCPolling.js`**
```javascript
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updatePLC } from '../store/plcSlice';
import { BATCH_READ_TAGS } from '../services/plcSchema';

export function usePLCPolling(enabled = true, options = {}) {
  const {
    activePollInterval = 150,    // Active machine
    idlePollInterval = 1000,      // No motion
    deepIdlePollInterval = 3000,  // Deep idle (user away)
    debounceMs = 300
  } = options;

  const dispatch = useDispatch();
  const intervalRef = useRef(null);
  const machineStateRef = useRef('active');
  const debounceRefsRef = useRef({});

  const performBatchRead = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/read-batch');
      if (!response.ok) {
        // Fallback to individual reads
        await fallbackIndividualReads();
        return;
      }

      const data = await response.json();
      
      // Apply debouncing to boolean feedback
      Object.entries(data).forEach(([key, value]) => {
        const debounceInfo = debounceRefsRef.current[key] = 
          debounceRefsRef.current[key] || { 
            candidate: undefined, 
            since: 0 
          };

        // If value changed, reset debounce timer
        if (debounceInfo.candidate !== value) {
          debounceInfo.candidate = value;
          debounceInfo.since = Date.now();
          return;
        }

        // If debounce window passed, apply update
        if (Date.now() - debounceInfo.since >= debounceMs) {
          dispatch(updatePLC({ [key]: value }));
        }
      });
    } catch (error) {
      console.error('[usePLCPolling] Error:', error);
    }
  }, [dispatch, debounceMs]);

  // Determine poll interval based on machine state
  const getPollInterval = useCallback(() => {
    switch (machineStateRef.current) {
      case 'deep-idle': return deepIdlePollInterval;
      case 'idle': return idlePollInterval;
      case 'active': return activePollInterval;
      default: return activePollInterval;
    }
  }, [activePollInterval, idlePollInterval, deepIdlePollInterval]);

  // Start polling loop
  useEffect(() => {
    if (!enabled) return;

    const startPolling = () => {
      performBatchRead();
      const nextInterval = getPollInterval();
      intervalRef.current = setTimeout(startPolling, nextInterval);
    };

    startPolling();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [enabled, performBatchRead, getPollInterval]);

  // Setter for machine state (call from component when machine starts/stops)
  const setMachineState = useCallback((state) => {
    machineStateRef.current = state;
  }, []);

  return { setMachineState };
}
```

### 3. Debounce Hook

**`src/hooks/useDebounce.js`**
```javascript
import { useRef, useCallback } from 'react';

export function useDebounce(delayMs = 300) {
  const debounceRef = useRef({ candidate: undefined, since: 0 });

  const apply = useCallback((value, onApply) => {
    const now = Date.now();
    const { candidate, since } = debounceRef.current;

    // Value changed, reset timer
    if (candidate !== value) {
      debounceRef.current = { candidate: value, since: now };
      return false;
    }

    // Debounce window passed, apply update
    if (now - since >= delayMs) {
      onApply(value);
      return true;
    }

    return false;
  }, [delayMs]);

  return { apply, reset: () => { debounceRef.current = { candidate: undefined, since: 0 }; } };
}
```

---

## Component Organization

### 1. Separate Container from Presentation

**Bad (all in one):**
```javascript
export function MainPage() {
  const [positions, setPositions] = useState(null);
  const [modes, setModes] = useState(null);
  // ... 20 more states
  
  useEffect(() => {
    // ... polling logic
  }, []);

  return <div>{/* 500+ lines of JSX */}</div>;
}
```

**Good (separated):**

**`src/containers/MainPageContainer.js`** (Logic)
```javascript
import { useSelector, useDispatch } from 'react-redux';
import { usePLCPolling } from '../hooks/usePLCPolling';
import MainPagePresentation from '../components/pages/MainPage';

export default function MainPageContainer() {
  const dispatch = useDispatch();
  const plcData = useSelector(state => state.plc);
  const { setMachineState } = usePLCPolling(true);

  const handleRunPressed = async () => {
    await dispatch(writePLCVar('GLEFTHEAD.bStartLeft', true));
    setMachineState('active');
  };

  return (
    <MainPagePresentation 
      plcData={plcData}
      onRun={handleRunPressed}
    />
  );
}
```

**`src/components/pages/MainPage.js`** (Presentation)
```javascript
export default function MainPagePresentation({ plcData, onRun }) {
  return (
    <div className="main-page">
      <AxisPanel 
        label="Axis 1"
        position={plcData.positions.axis1}
      />
      <button onClick={onRun}>Run</button>
    </div>
  );
}
```

**Benefits:**
- Easy to test presentation (mock props)
- Easy to test logic (mock Redux)
- Reusable components
- Clear data flow

### 2. Smart vs Dumb Components

```javascript
// SMART (knows about Redux, polling, PLC)
export function SmartAxisControl({ axis }) {
  const feedback = useSelector(state => state.plc[`axis${axis}Actual`]);
  const onTargetReached = useCallback(() => {
    // dispatch action
  }, []);
  
  return <DumbAxisControl feedback={feedback} onReady={onTargetReached} />;
}

// DUMB (just renders, no side effects)
function DumbAxisControl({ feedback, onReady }) {
  return (
    <div>
      Position: {feedback}
      <button onClick={onReady}>Confirm</button>
    </div>
  );
}
```

---

## PLC Communication Layer

### 1. Centralized Backend API

**`electron/backend/plc-server.js`**
```javascript
const express = require('express');
const { ADS } = require('ads-client');
const app = express();

const ADS_CLIENT = new ADS({ /* config */ });

// All PLC variables in one place
const PLC_VARS = {
  // Group by category for easier maintenance
  positions: {
    'GPersistent.lLeftPosStep1': { type: 'LREAL' },
    'GPersistent.lLeftPosStep2': { type: 'LREAL' },
    // ... auto-generate from schema
  },
  modes: {
    'GLEFTHEAD.bHmiLeftJogMode': { type: 'BOOL' },
    'GRIGHTHEAD.bHmiRightJogMode': { type: 'BOOL' }
  }
};

// Batch read endpoint
app.get('/read-batch', async (req, res) => {
  try {
    const vars = Object.keys(PLC_VARS.positions)
      .concat(Object.keys(PLC_VARS.modes));

    const results = await Promise.all(
      vars.map(v => ADS_CLIENT.read(v))
    );

    // Organize by category in response
    const response = {
      positions: {},
      modes: {}
    };

    results.forEach((value, idx) => {
      const varName = vars[idx];
      if (PLC_VARS.positions[varName]) {
        response.positions[varName] = value;
      } else if (PLC_VARS.modes[varName]) {
        response.modes[varName] = value;
      }
    });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Individual read (fallback)
app.get('/read/:tag', async (req, res) => {
  try {
    const value = await ADS_CLIENT.read(req.params.tag);
    res.json({ success: true, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Write endpoint with validation
app.post('/write', async (req, res) => {
  try {
    const { tag, value, type } = req.body;
    
    // Validate against schema
    validateWrite(tag, value, type);
    
    await ADS_CLIENT.write(tag, value);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(3001, () => console.log('PLC server running on :3001'));
```

### 2. API Service Layer

**`src/services/plcApiService.js`**
```javascript
const BASE_URL = 'http://localhost:3001';

export async function readBatch() {
  const response = await fetch(`${BASE_URL}/read-batch`);
  if (!response.ok) throw new Error('Batch read failed');
  return response.json();
}

export async function readVar(tag) {
  const response = await fetch(`${BASE_URL}/read/${encodeURIComponent(tag)}`);
  if (!response.ok) throw new Error(`Failed to read ${tag}`);
  const data = await response.json();
  return data.value;
}

export async function writeVar(tag, value, type = 'BOOL') {
  const response = await fetch(`${BASE_URL}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, value, type })
  });
  if (!response.ok) throw new Error(`Failed to write ${tag}`);
  return response.json();
}

// Retry logic for reliability
export async function readVarWithRetry(tag, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await readVar(tag);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

---

## Performance Patterns

### 1. Poll Interval Strategy

```javascript
// Adaptive polling based on machine state
const POLLING_STRATEGY = {
  ACTIVE: {
    interval: 150,        // Machine running, need responsive UI
    components: ['MainHMI', 'JogMode', 'ProgramEditor'],
    batchRead: true
  },
  IDLE: {
    interval: 1000,       // Machine stopped, less critical
    components: ['StatusBanner'],
    batchRead: true
  },
  DEEP_IDLE: {
    interval: 3000,       // No user interaction, save bandwidth
    components: [],
    batchRead: false      // Only read on explicit user action
  }
};
```

**Implement machine state detection:**
```javascript
const detectMachineState = (plcData) => {
  if (plcData.modes.leftJogMode || plcData.modes.rightJogMode) {
    return 'ACTIVE';
  }
  if (plcData.sequenceActive.leftSeq || plcData.sequenceActive.rightSeq) {
    return 'ACTIVE';
  }
  // Last activity was < 10 seconds ago
  if (Date.now() - lastActivityTime < 10000) {
    return 'IDLE';
  }
  return 'DEEP_IDLE';
};
```

### 2. Memory-Efficient Component Updates

```javascript
// Bad: Re-renders entire component
const [allData, setAllData] = useState({});

// Good: Granular updates
const dispatch(updatePosition({ axis: 1, value: 123 }));
// Only components subscribed to axis1 re-render
```

### 3. Memoization

```javascript
import { memo } from 'react';

// Only re-render if props change
const AxisDisplay = memo(function AxisDisplay({ position, label }) {
  return <div>{label}: {position}</div>;
}, (prevProps, nextProps) => 
  prevProps.position === nextProps.position &&
  prevProps.label === nextProps.label
);
```

---

## Testing Strategy

### 1. Unit Tests (Hooks & Services)

**`src/hooks/__tests__/usePLCPolling.test.js`**
```javascript
import { renderHook, act } from '@testing-library/react';
import { usePLCPolling } from '../usePLCPolling';

describe('usePLCPolling', () => {
  it('should poll PLC at specified interval', async () => {
    const { result } = renderHook(() => usePLCPolling(true, { 
      activePollInterval: 50 
    }));

    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // Verify polling occurred (mock fetch should be called)
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should debounce mode feedback', async () => {
    // Test debouncing logic
  });
});
```

### 2. Integration Tests (API Service)

```javascript
describe('plcApiService', () => {
  it('should fallback to individual reads on batch failure', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('Batch failed'))
      .mockResolvedValueOnce({ json: () => ({ value: 123 }) });

    const result = await readBatchWithFallback();
    expect(result).toBeDefined();
  });
});
```

### 3. Component Tests (Presentation)

```javascript
describe('MainPage', () => {
  it('should display axis positions from props', () => {
    const { getByText } = render(
      <MainPage plcData={{ positions: { axis1: 123.45 } }} />
    );
    expect(getByText(/123.45/)).toBeInTheDocument();
  });

  it('should call onRun when button clicked', () => {
    const onRun = jest.fn();
    const { getByText } = render(
      <MainPage plcData={{}} onRun={onRun} />
    );
    fireEvent.click(getByText('Run'));
    expect(onRun).toHaveBeenCalled();
  });
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Multiple State Paths Updating Same Variable
```javascript
// WRONG: Both paths update jog feedback
useEffect(() => {
  // Path 1: Batch read
  const data = await fetch('/read-batch');
  setJogMode(data.jogMode);
}, []);

useEffect(() => {
  // Path 2: Legacy individual read (not guarded)
  const mode = await readVar('GLEFTHEAD.bHmiLeftJogMode');
  setJogMode(mode);
}, []);
// Result: Rapid toggles, UI flicker
```

**Fix:** Guard legacy paths
```javascript
const [batchReadOk, setBatchReadOk] = useState(false);

useEffect(() => {
  const data = await fetch('/read-batch');
  setBatchReadOk(true);
  setJogMode(data.jogMode);
}, []);

useEffect(() => {
  // Only run if batch read failed
  if (!batchReadOk) {
    const mode = await readVar('GLEFTHEAD.bHmiLeftJogMode');
    setJogMode(mode);
  }
}, [batchReadOk]);
```

### ❌ Pitfall 2: Missing Fallback on Batch Failure
```javascript
// WRONG: App breaks if batch endpoint down
const data = await fetch('/read-batch');
updateUI(data);
```

**Fix:** Always have fallback
```javascript
try {
  const data = await fetch('/read-batch');
  updateUI(data);
} catch (error) {
  // Fall back to individual reads
  const individual = await Promise.all([
    readVar('tag1'),
    readVar('tag2')
  ]);
  updateUI(individual);
}
```

### ❌ Pitfall 3: No Debounce on Boolean Feedback
```javascript
// WRONG: Boolean can toggle 10x per second
setJogMode(plcData.jogMode);  // No filter
```

**Fix:** Debounce by default for booleans
```javascript
const debounce = useDebounce(300);
debounce(plcData.jogMode, (value) => setJogMode(value));
```

### ❌ Pitfall 4: Polling Everywhere
```javascript
// WRONG: Every component has its own polling
function JogControl() {
  useEffect(() => {
    setInterval(() => fetch('/read'), 150);
  }, []);
}

function MainHMI() {
  useEffect(() => {
    setInterval(() => fetch('/read-batch'), 150);
  }, []);
}
// Result: 20+ overlapping polls, CPU spike
```

**Fix:** Centralized polling with Redux/store
```javascript
// One polling source of truth
export const usePLCPolling = () => {
  // All components subscribe to same data
  return useSelector(state => state.plc);
};
```

### ❌ Pitfall 5: 1600-Line Components
```javascript
// WRONG: MainHMI.js has everything
export function MainHMI() {
  // 1600 lines of:
  // - Polling logic
  // - State management (30+ states)
  // - UI rendering
  // - Modal dialogs
}
```

**Fix:** Split by feature/responsibility
```
MainHMI/
├── MainHMIContainer.js     (Logic, Redux dispatch)
├── MainHMIPresentation.js  (UI only)
├── useMainHMIPolling.js    (Polling logic)
├── dialogs/
│   ├── JogModeDialog.js
│   ├── ProgramDialog.js
│   └── RecipeDialog.js
└── components/
    ├── AxisPanel.js
    └── ControlPanel.js
```

---

## Quick Checklist for Next Project

- [ ] Define PLC_SCHEMA first (before any components)
- [ ] Separate data fetching from UI rendering
- [ ] Implement batch read endpoint in backend
- [ ] Add debounce to all boolean PLC feedback (default 300ms)
- [ ] Use centralized polling (Redux/store, not component level)
- [ ] Implement adaptive polling intervals (active/idle/deep-idle)
- [ ] Add fallback paths for all network operations
- [ ] Guard legacy code paths to prevent dual updates
- [ ] Write unit tests for polling & debounce logic
- [ ] Profile before optimizing (measure, don't guess)
- [ ] Limit components to <400 lines (split into smaller pieces)
- [ ] Document all PLC variables in schema
- [ ] Test on actual target machine before shipping

---

## Useful Resources

- **Redux:** https://redux.js.org/
- **Zustand:** https://github.com/pmndrs/zustand
- **React Testing Library:** https://testing-library.com/react
- **Electron:** https://www.electronjs.org/docs
- **ADS Client:** https://github.com/Beckhoff/ADS

---

**Last Updated:** January 30, 2026  
**Based on:** CNC Dual Head HMI Project (v1.0.4)
