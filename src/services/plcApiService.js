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
    } else if (command === 'disableJog') {
      return disableJogMode(payload);
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
  const tagName = side === 'left' ? 'GLEFTHEAD.bHmiLeftJogPb' : 'GRIGHTHEAD.bHmiRightJogPb';
  
  console.log(`[plcApiService] Enabling jog mode for ${side} side - index: ${index}, tag: ${tagName}`);
  
  try {
    // First try by index via io/pulse
    const res = await fetch(`${API_BASE}/io/pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, durationMs: 200 })
    });
    const data = await res.json();

    // If index-based pulse fails, fall back to direct tag pulse
    if (!data.success) {
      console.warn(`[plcApiService] io/pulse failed for ${side} side (index ${index}). Falling back to tag ${tagName}. Error: ${data.error}`);
      const fallback = await fetch(`${API_BASE}/pulse-bool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagName, durationMs: 200 })
      });
      const fb = await fallback.json();
      if (!fb.success) {
        console.error(`[plcApiService] Jog mode enable FAILED for ${side} side via tag:`, fb.error);
        throw new Error(fb.error || 'Failed to enable jog mode');
      }
      console.log(`[plcApiService] Jog mode enabled SUCCESS for ${side} side via tag pulse: ${tagName}`);
      return fb;
    }

    console.log(`[plcApiService] Jog mode enabled SUCCESS for ${side} side - pulsed tag: ${data.tag || tagName}`);
    return data;
  } catch (err) {
    console.error(`[plcApiService] Failed to enable jog mode for ${side} side:`, err.message);
    throw err;
  }
}

/**
 * Disable jog mode for specified side
 * @param {Object} payload - { side: 'left' or 'right' }
 */
async function disableJogMode(payload) {
  const { side } = payload;
  if (!side) {
    throw new Error('Missing side for jog mode disable');
  }
  
  // Pulse the same jog button again to toggle jog OFF
  // The PLC handles toggle logic - each pulse toggles jog state
  const index = side === 'left' ? 3 : 42;
  const tagName = side === 'left' ? 'GLEFTHEAD.bHmiLeftJogPb' : 'GRIGHTHEAD.bHmiRightJogPb';
  
  console.log(`[plcApiService] Disabling jog mode for ${side} side - index: ${index}, tag: ${tagName}`);
  
  try {
    // Try by index via io/pulse
    const res = await fetch(`${API_BASE}/io/pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, durationMs: 200 })
    });
    const data = await res.json();

    // If index-based pulse fails, fall back to direct tag pulse
    if (!data.success) {
      console.warn(`[plcApiService] io/pulse failed for ${side} side (index ${index}). Falling back to tag ${tagName}. Error: ${data.error}`);
      const fallback = await fetch(`${API_BASE}/pulse-bool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagName, durationMs: 200 })
      });
      const fb = await fallback.json();
      if (!fb.success) {
        console.error(`[plcApiService] Jog mode disable FAILED for ${side} side via tag:`, fb.error);
        throw new Error(fb.error || 'Failed to disable jog mode');
      }
      console.log(`[plcApiService] Jog mode disabled SUCCESS for ${side} side via tag pulse: ${tagName}`);
      return fb;
    }

    console.log(`[plcApiService] Jog mode disabled SUCCESS for ${side} side - pulsed tag: ${data.tag || tagName}`);
    return data;
  } catch (err) {
    console.error(`[plcApiService] Failed to disable jog mode for ${side} side:`, err.message);
    throw err;
  }
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
  
  // Map side to PLC variable
  const pbTag = side === 'left' ? 'GLEFTHEAD.bHmiLeftStartPosPb' : 'GRIGHTHEAD.bHmiRightStartPosPb';
  const durationMs = 200;
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  console.log(`[plcApiService] Sending StartPos command - side: ${side}, tag: ${pbTag}`);
  try {
    // Prefer precise PLC-side pulse to guarantee a clean bool write
    const pulseRes = await fetch(`${API_BASE}/pulse-bool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: pbTag, durationMs })
    });

    const pulseData = await pulseRes.json();
    console.log(`[plcApiService] StartPos pulse response:`, pulseData);

    if (pulseRes.ok && pulseData.success) {
      console.log(`[plcApiService] StartPos command sent successfully for ${side} via pulse-bool`);
      return { success: true, message: `${side} side start position command sent` };
    }

    // Fallback: explicit write true/false with bool endpoint
    console.warn(`[plcApiService] pulse-bool failed for ${side} (${pulseData.error || 'unknown error'}). Falling back to write-bool sequence.`);
    await fetch(`${API_BASE}/write-bool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: pbTag, value: true })
    });
    await delay(durationMs);
    await fetch(`${API_BASE}/write-bool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: pbTag, value: false })
    });
    console.log(`[plcApiService] StartPos fallback write-bool sequence completed for ${side}`);
    return { success: true, message: `${side} side start position command sent (fallback)` };
  } catch (err) {
    console.error(`[plcApiService] Failed to send StartPos command for ${side}:`, err.message);
    throw err;
  }
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
  
  // Support left, right, or both
  const targets = side === 'both'
    ? ['GLEFTHEAD.bHmiLeftRunPb', 'GRIGHTHEAD.bHmiRightRunPb']
    : [side === 'left' ? 'GLEFTHEAD.bHmiLeftRunPb' : 'GRIGHTHEAD.bHmiRightRunPb'];

  const durationMs = 200;
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (const tag of targets) {
    console.log(`[plcApiService] Sending Run command via pulse-bool: tag=${tag}, duration=${durationMs}`);
    try {
      const res = await fetch(`${API_BASE}/pulse-bool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, durationMs })
      });
      const data = await res.json();
      console.log(`[plcApiService] Run pulse response for ${tag}:`, data);

      if (res.ok && data.success) {
        continue; // success for this tag
      }

      // Fallback: explicit true/false writes
      console.warn(`[plcApiService] pulse-bool failed for ${tag} (${data.error || 'unknown error'}). Falling back to write-bool sequence.`);
      await fetch(`${API_BASE}/write-bool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, value: true })
      });
      await delay(durationMs);
      await fetch(`${API_BASE}/write-bool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, value: false })
      });
      console.log(`[plcApiService] Run fallback write-bool sequence completed for ${tag}`);
    } catch (err) {
      console.error(`[plcApiService] Failed to send Run command for tag ${tag}:`, err.message);
      throw err;
    }
  }

  return { success: true, message: `Run command sent to ${side}` };
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

/**
 * Write current screen index to PLC for tracking
 * @param {number} screenIndex - The screen index from SCREEN_INDEX mapping
 */
export async function writeScreenIndex(screenIndex) {
  try {
    console.log(`[plcApiService] ===== WRITING SCREEN INDEX to GAXIS.dHmiCurrScrnIndex: ${screenIndex} =====`);
    const res = await fetch(`${API_BASE}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tag: 'GAXIS.dHmiCurrScrnIndex', 
        value: screenIndex 
      })
    });
    
    if (!res.ok) {
      console.error(`[plcApiService] Screen index write HTTP error: ${res.status} ${res.statusText}`);
      return { success: false, error: `HTTP ${res.status}` };
    }
    
    const data = await res.json();
    if (!data.success) {
      console.error(`[plcApiService] ❌ Screen index write FAILED: ${data.error}`);
    } else {
      console.log(`[plcApiService] ✓ Screen index write SUCCESS: ${screenIndex} written to GAXIS.dHmiCurrScrnIndex`);
    }
    return data;
  } catch (err) {
    console.error(`[plcApiService] ❌ EXCEPTION writing screen index:`, err.message, err);
    // Non-blocking - app continues if this fails
    return { success: false, error: err.message };
  }
}
