// plcApiService.js
// Service for communicating with local Node.js ADS backend

const API_BASE = 'http://localhost:3001';

export async function readPLCVar() {
  const res = await fetch(`${API_BASE}/read`);
  if (!res.ok) throw new Error('Failed to read from PLC');
  const data = await res.json();
  return data.value;
}

export async function readAxisPositions() {
  const res = await fetch(`${API_BASE}/read-axis-positions`);
  if (!res.ok) throw new Error('Failed to read axis positions');
  const data = await res.json();
  return data;
}

export async function writePLCVar(value) {
  // Handle command routing
  if (value && typeof value === 'object' && value.command) {
    const { command, ...payload } = value;
    
    if (command === 'setRecipeParameters') {
      return writeRecipeParameters(payload);
    } else if (command === 'downloadProgram') {
      return downloadProgram(payload);
    } else if (command === 'enableJog') {
      return enableJogMode(payload);
    } else if (command === 'home') {
      return sendHomeCommand(payload);
    } else if (command === 'startPosition') {
      return sendStartPositionCommand(payload);
    } else if (command === 'run') {
      return sendRunCommand(payload);
    }
  }
  
  // Default write to standard endpoint
  const res = await fetch(`${API_BASE}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error('Failed to write to PLC');
}

/**
 * Write recipe parameters to PLC
 * @param {Object} payload - { side, parameters: {...} }
 */
async function writeRecipeParameters(payload) {
  const { side, parameters } = payload;
  if (!side || !parameters) {
    throw new Error('Missing side or parameters');
  }
  
  const res = await fetch(`${API_BASE}/write-recipe-params`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side, parameters })
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to write recipe parameters to PLC');
  }
  return data;
}

/**
 * Download program to PLC
 * @param {Object} payload - { program, parameters }
 */
async function downloadProgram(payload) {
  const { program, parameters } = payload;
  if (!program) {
    throw new Error('Missing program data');
  }
  
  const res = await fetch(`${API_BASE}/write-program`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side: program.side, program, parameters })
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to download program to PLC');
  }
  return data;
}

/**
 * Enable jog mode for specified side
 * @param {Object} payload - { side: 'left' or 'right' }
 */
async function enableJogMode(payload) {
  const { side } = payload;
  if (!side) {
    throw new Error('Missing side for jog mode');
  }
  
  // Indices: 3=Left JogPb, 42=Right JogPb
  const index = side === 'left' ? 3 : 42;
  
  const res = await fetch(`${API_BASE}/io/pulse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, durationMs: 100 })
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to enable jog mode');
  }
  return data;
}

/**
 * Send HOME command for specified side
 * @param {Object} payload - { side: 'left' or 'right' }
 */
async function sendHomeCommand(payload) {
  const { side } = payload;
  if (!side) {
    throw new Error('Missing side for home command');
  }
  
  // Indices: 2=Left HomePb, 41=Right HomePb
  const index = side === 'left' ? 2 : 41;
  
  const res = await fetch(`${API_BASE}/io/pulse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, durationMs: 100 })
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to send home command');
  }
  return data;
}

/**
 * Send START POSITION command for specified side
 * @param {Object} payload - { side: 'left' or 'right' }
 */
async function sendStartPositionCommand(payload) {
  const { side } = payload;
  if (!side) {
    throw new Error('Missing side for start position command');
  }
  
  // Indices: 11=Left StartPosPb, 50=Right StartPosPb
  const index = side === 'left' ? 11 : 50;
  
  const res = await fetch(`${API_BASE}/io/pulse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, durationMs: 100 })
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to send start position command');
  }
  return data;
}

/**
 * Send RUN command for specified side
 * @param {Object} payload - { side: 'left' or 'right' }
 */
async function sendRunCommand(payload) {
  const { side } = payload;
  if (!side) {
    throw new Error('Missing side for run command');
  }
  
  // Indices: 12=Left RunPb, 51=Right RunPb
  const index = side === 'left' ? 12 : 51;
  
  const res = await fetch(`${API_BASE}/io/pulse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, durationMs: 100 })
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to send run command');
  }
  return data;
}

// Write a specific boolean tag
export async function writeBoolTag(tag, value) {
  const res = await fetch(`${API_BASE}/write-bool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, value })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to write boolean tag');
  return data;
}

// Pulse a momentary boolean tag (true, wait, then false)
export async function pulseBoolTag(tag, durationMs = 150) {
  const res = await fetch(`${API_BASE}/pulse-bool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, durationMs })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to pulse boolean tag');
  return data;
}
