const express = require('express');
const { Client } = require('ads-client');
const fs = require('fs');
const path = require('path');

// NET ID can be set via savedNetId parameter from Electron config, or env variable, or default
let DEFAULT_NET_ID = null;  // Will be set by initializeNetId()
const FALLBACK_NET_ID = '169.254.109.230.1.1';
const DEFAULT_ADS_PORT = parseInt(process.env.AMS_PORT || '851', 10);
const DEFAULT_HTTP_PORT = parseInt(process.env.ADS_HTTP_PORT || '3001', 10);
const READ_SYMBOL = process.env.ADS_READ_SYMBOL || 'MAIN.myVar';
const WRITE_SYMBOL = process.env.ADS_WRITE_SYMBOL || 'MAIN.myVar';
const IO_MAP_PATH = path.join(__dirname, 'io-map.json');

function initializeNetId(savedNetId) {
  DEFAULT_NET_ID = savedNetId || process.env.AMS_NET_ID || FALLBACK_NET_ID;
  console.log(`[plc-server] Initialized with NET ID: ${DEFAULT_NET_ID}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadIoMap() {
  try {
    const raw = fs.readFileSync(IO_MAP_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.buttons || [];
  } catch (err) {
    console.warn('[plc-server] IO map not found or invalid, using empty map:', err.message);
    return [];
  }
}

// Default list of critical tags to test (can be overridden via env TEST_TAGS as comma-separated)
const TEST_TAGS = (process.env.TEST_TAGS || 
  'MAIN.Axis1Position,MAIN.Axis2Position,MAIN.Status,MAIN.Speed,MAIN.Temperature').split(',').map(t => t.trim());

function createAdsClient() {
  return new Client({
    targetAmsNetId: DEFAULT_NET_ID,
    targetAdsPort: DEFAULT_ADS_PORT,
  });
}

function createServer() {
  const app = express();
  app.use(express.json());

  const ads = createAdsClient();
  let connected = false;
  const ioMap = loadIoMap();

  const hasReadValue = () => typeof ads?.readValue === 'function';
  const hasWriteValue = () => typeof ads?.writeValue === 'function';

  async function readTagValue(tag) {
    const res = await ads.readValue(tag);
    return res?.value;
  }

  async function writeTagValue(tag, value, autoFill = false) {
    try {
      const result = await ads.writeValue(tag, value, autoFill);
      console.log(`[plc-server] writeTagValue completed for ${tag}: value=${value}, autoFill=${autoFill}`, result);
      return result;
    } catch (err) {
      console.error(`[plc-server] writeTagValue failed for ${tag}:`, err.message);
      throw err;
    }
  }

  function resolveTag(index) {
    const entry = ioMap.find(i => Number(i.index) === Number(index));
    return entry ? entry.tag : null;
  }

  async function connectAds() {
    try {
      await ads.connect();
      connected = true;
      console.log(`[plc-server] Connected to ADS at ${DEFAULT_NET_ID}:${DEFAULT_ADS_PORT}`);
    } catch (err) {
      connected = false;
      console.error('[plc-server] Failed to connect to ADS:', err.message);
    }
  }

  app.get('/status', async (_req, res) => {
    const disconnectedTags = connected ? [] : ['PLC connection unavailable'];
    let heartbeat = null;
    
    // Try to read heartbeat if connected
    if (connected) {
      const candidates = [
        'Main.iHeartBeat',
        'MAIN.iHeartBeat',
        'MAIN.iHeartbeat',
        'GVL.iHeartbeat',
        'MAIN.PRG_Main.iHeartbeat',
        'PRG_MAIN.iHeartbeat'
      ];
      for (const tag of candidates) {
        try {
          const v = await readTagValue(tag);
          if (v !== null && v !== undefined) {
            heartbeat = v;
            global._heartbeatTag = tag;
            console.log('[plc-server] Heartbeat read from', tag, ':', v);
            break;
          }
        } catch (err) {
          // Try next candidate
          console.warn('[plc-server] Heartbeat read failed for', tag, '-', err.message);
        }
      }
    }
    
    res.json({
      amsNetId: DEFAULT_NET_ID,
      connected,
      disconnectedTags,
      heartbeat,
      heartbeatTag: global._heartbeatTag || null
    });
  });

  // Detailed heartbeat diagnostics: tries multiple candidates and returns per-tag results
  app.get('/heartbeat-debug', async (req, res) => {
    const userTag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
    const candidates = [
      ...(userTag ? [userTag] : []),
      'MAIN.iHeartbeat',
      'MAIN.iHeartBeat',
      'GVL.iHeartbeat',
      'GVL.iHeartBeat',
      'MAIN.PRG_Main.iHeartbeat',
      'PRG_MAIN.iHeartbeat'
    ];

    const diagnostics = {
      connected,
      adsType: typeof ads,
      hasReadValue: typeof ads?.readValue,
      requestedTag: userTag || null,
      results: []
    };

    if (!ads || typeof ads.readValue !== 'function') {
      return res.json({
        ...diagnostics,
        results: candidates.map(tag => ({ tag, status: 'error', error: 'ADS client not ready' }))
      });
    }

    for (const tag of candidates) {
      if (!connected) {
        diagnostics.results.push({ tag, status: 'error', error: 'PLC not connected' });
        continue;
      }
      try {
        const { value } = await ads.readValue(tag);
        diagnostics.results.push({ tag, status: 'ok', value });
      } catch (err) {
        diagnostics.results.push({ tag, status: 'error', error: err.message });
      }
    }

    res.json(diagnostics);
  });

  app.post('/set-net-id', async (req, res) => {
    try {
      const { netId } = req.body;
      if (!netId || typeof netId !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid Net ID' });
      }
      
      // Validate Net ID format (should be like 5.34.123.45.1.1)
      if (!/^\d+(\.\d+)*$/.test(netId)) {
        return res.status(400).json({ success: false, error: 'Invalid Net ID format' });
      }
      
      DEFAULT_NET_ID = netId;
      console.log(`[plc-server] Net ID updated to: ${DEFAULT_NET_ID}`);
      
      // Properly disconnect old ADS client
      try {
        await ads.disconnect();
        console.log('[plc-server] Old ADS client disconnected');
      } catch (e) {
        console.warn('[plc-server] Error disconnecting old ADS client:', e.message);
      }
      
      // Create completely new ADS client instance with updated Net ID
      // Do NOT use Object.assign - it doesn't properly transfer connection state
      const newAds = new Client({
        targetAmsNetId: DEFAULT_NET_ID,
        targetAdsPort: DEFAULT_ADS_PORT,
      });
      
      try {
        await newAds.connect();
        // Replace the ads reference with the new client
        // All pending operations on old ads will fail, but future operations use new client
        for (const key in ads) {
          delete ads[key];
        }
        Object.setPrototypeOf(ads, Object.getPrototypeOf(newAds));
        for (const key in newAds) {
          ads[key] = newAds[key];
        }
        connected = true;
        console.log(`[plc-server] Successfully connected to ADS at ${DEFAULT_NET_ID}:${DEFAULT_ADS_PORT}`);
        res.json({ success: true, message: 'Net ID updated and connected', amsNetId: DEFAULT_NET_ID });
      } catch (connErr) {
        connected = false;
        console.error('[plc-server] Failed to connect with new Net ID:', connErr.message);
        res.json({ success: true, message: 'Net ID updated (connection failed)', amsNetId: DEFAULT_NET_ID, warning: connErr.message });
      }
    } catch (err) {
      console.error('[plc-server] set-net-id error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/read', async (req, res) => {
    try {
      const tag = req.query.tag || READ_SYMBOL;
      
      // If not connected, return mock data for offline testing
      if (!connected) {
        console.log(`[plc-server] PLC not connected - returning mock data for tag "${tag}"`);
        return res.json({ success: true, value: 0, tag, source: 'mock' });
      }
      
      const value = await readTagValue(tag);
      console.log(`[plc-server] Read tag "${tag}" returned:`, value, `(type: ${typeof value})`);
      res.json({ success: true, value, tag });
    } catch (err) {
      console.error('[plc-server] Read error for tag', req.query.tag, ':', err.message);
      // Return mock data on error instead of failing
      res.json({ success: true, value: 0, tag: req.query.tag, source: 'mock-error' });
    }
  });

  app.get('/read-axis-positions', async (_req, res) => {
    try {
      if (!connected) {
        return res.json({
          actualPositions: {
            right: { axis1: 0, axis2: 0 },
            left: { axis1: 0, axis2: 0 }
          },
          connected: false
        });
      }

      // Read all 4 axis positions from PLC
      const axis1 = await readTagValue('GPersistent.lAxis1ActPos');
      const axis2 = await readTagValue('GPersistent.lAxis2ActPos');
      const axis3 = await readTagValue('GPersistent.lAxis3ActPos');
      const axis4 = await readTagValue('GPersistent.lAxis4ActPos');

      res.json({
        actualPositions: {
          right: { axis1, axis2 },
          left: { axis1: axis3, axis2: axis4 }
        },
        connected: true
      });
    } catch (err) {
      console.error('[plc-server] Read axis positions error:', err.message);
      res.json({
        actualPositions: {
          right: { axis1: 0, axis2: 0 },
          left: { axis1: 0, axis2: 0 }
        },
        connected: false,
        error: err.message
      });
    }
  });

  /**
   * Comprehensive batch read - reads all critical variables in a single call
   * This reduces network overhead significantly vs individual reads
   */
  app.get('/read-batch', async (_req, res) => {
    try {
      if (!connected) {
        return res.json({
          success: false,
          connected: false,
          error: 'PLC not connected'
        });
      }

      // Define all critical tags to read in batch
      const tagsToRead = [
        // Axis positions (4 tags)
        'GPersistent.lAxis1ActPos',
        'GPersistent.lAxis2ActPos',
        'GPersistent.lAxis3ActPos',
        'GPersistent.lAxis4ActPos',
        // Machine status (2 tags)
        'GPersistent.dABSMachineCount',
        'GAxis.AlarmSystem',
        // Mode feedback (4 tags)
        'GLEFTHEAD.bHmiLeftJogMode',
        'GLEFTHEAD.bHmiLeftRunMode',
        'GRIGHTHEAD.bHmiRightJogMode',
        'GRIGHTHEAD.bHmiRightRunMode',
        // Sequence active (2 tags)
        'GLEFTHEAD.bLeftSeqAct',
        'GRIGHTHEAD.bRightSeqAct',
        // Homing status (4 tags)
        'GLEFTHEAD.bHmiLeftHomeEna',
        'GLEFTHEAD.bLeftHeadHomed',
        'GRIGHTHEAD.bHmiRightHomeEna',
        'GRIGHTHEAD.bRightHeadHomed',
        // Recipe parameters - left (5 tags)
        'GLEFTHEAD.nRecipeTubeID',
        'GLEFTHEAD.nRecipeTubeOD',
        'GLEFTHEAD.nRecipeFinalSize',
        'GLEFTHEAD.nRecipeDepth',
        'GLEFTHEAD.nRecipeSpeed',
        // Recipe parameters - right (5 tags)
        'GRIGHTHEAD.nRecipeTubeID',
        'GRIGHTHEAD.nRecipeTubeOD',
        'GRIGHTHEAD.nRecipeFinalSize',
        'GRIGHTHEAD.nRecipeDepth',
        'GRIGHTHEAD.nRecipeSpeed'
      ];

      // Read all tags in parallel
      const results = await Promise.all(
        tagsToRead.map(async (tag) => {
          try {
            const value = await readTagValue(tag);
            return { tag, value, success: true };
          } catch (err) {
            console.warn(`[plc-server] Failed to read ${tag}:`, err.message);
            return { tag, value: null, success: false, error: err.message };
          }
        })
      );

      // Organize results into structured response
      const data = {
        success: true,
        connected: true,
        timestamp: new Date().toISOString(),
        actualPositions: {
          right: {
            axis1: results.find(r => r.tag === 'GPersistent.lAxis1ActPos')?.value ?? 0,
            axis2: results.find(r => r.tag === 'GPersistent.lAxis2ActPos')?.value ?? 0
          },
          left: {
            axis1: results.find(r => r.tag === 'GPersistent.lAxis3ActPos')?.value ?? 0,
            axis2: results.find(r => r.tag === 'GPersistent.lAxis4ActPos')?.value ?? 0
          }
        },
        machineCount: results.find(r => r.tag === 'GPersistent.dABSMachineCount')?.value ?? 0,
        alarmSystem: results.find(r => r.tag === 'GAxis.AlarmSystem')?.value ?? 0,
        modeFeedback: {
          left: {
            jogMode: results.find(r => r.tag === 'GLEFTHEAD.bHmiLeftJogMode')?.value ?? false,
            runMode: results.find(r => r.tag === 'GLEFTHEAD.bHmiLeftRunMode')?.value ?? false
          },
          right: {
            jogMode: results.find(r => r.tag === 'GRIGHTHEAD.bHmiRightJogMode')?.value ?? false,
            runMode: results.find(r => r.tag === 'GRIGHTHEAD.bHmiRightRunMode')?.value ?? false
          }
        },
        homingStatus: {
          left: {
            enabled: results.find(r => r.tag === 'GLEFTHEAD.bHmiLeftHomeEna')?.value ?? false,
            homed: results.find(r => r.tag === 'GLEFTHEAD.bLeftHeadHomed')?.value ?? false
          },
          right: {
            enabled: results.find(r => r.tag === 'GRIGHTHEAD.bHmiRightHomeEna')?.value ?? false,
            homed: results.find(r => r.tag === 'GRIGHTHEAD.bRightHeadHomed')?.value ?? false
          }
        },
        sequenceActive: {
          left: results.find(r => r.tag === 'GLEFTHEAD.bLeftSeqAct')?.value ?? false,
          right: results.find(r => r.tag === 'GRIGHTHEAD.bRightSeqAct')?.value ?? false
        },
        recipeParameters: {
          left: {
            tubeID: results.find(r => r.tag === 'GLEFTHEAD.nRecipeTubeID')?.value ?? 0,
            tubeOD: results.find(r => r.tag === 'GLEFTHEAD.nRecipeTubeOD')?.value ?? 0,
            finalSize: results.find(r => r.tag === 'GLEFTHEAD.nRecipeFinalSize')?.value ?? 0,
            depth: results.find(r => r.tag === 'GLEFTHEAD.nRecipeDepth')?.value ?? 0,
            speed: results.find(r => r.tag === 'GLEFTHEAD.nRecipeSpeed')?.value ?? 100
          },
          right: {
            tubeID: results.find(r => r.tag === 'GRIGHTHEAD.nRecipeTubeID')?.value ?? 0,
            tubeOD: results.find(r => r.tag === 'GRIGHTHEAD.nRecipeTubeOD')?.value ?? 0,
            finalSize: results.find(r => r.tag === 'GRIGHTHEAD.nRecipeFinalSize')?.value ?? 0,
            depth: results.find(r => r.tag === 'GRIGHTHEAD.nRecipeDepth')?.value ?? 0,
            speed: results.find(r => r.tag === 'GRIGHTHEAD.nRecipeSpeed')?.value ?? 100
          }
        },
        rawResults: results // Include raw results for debugging
      };

      console.log(`[plc-server] Batch read completed: read ${results.length} tags successfully`);
      res.json(data);
    } catch (err) {
      console.error('[plc-server] Batch read error:', err.message);
      res.status(500).json({
        success: false,
        connected: false,
        error: err.message
      });
    }
  });

  app.post('/write', async (req, res) => {
    try {
      const { tag, value } = req.body;
      const targetTag = tag || WRITE_SYMBOL;
      
      // If not connected, simulate success for offline testing
      if (!connected) {
        console.log(`[plc-server] /write called (offline mode) - Would write to ${targetTag}:`, value);
        return res.json({ success: true, source: 'mock', tag: targetTag });
      }
      
      console.log(`[plc-server] /write endpoint - Writing to ${targetTag}:`, value);
      await writeTagValue(targetTag, value, true);
      console.log(`[plc-server] /write endpoint - Write successful for ${targetTag}`);
      
      res.json({ success: true });
    } catch (err) {
      console.error('[plc-server] /write endpoint error for tag:', req.body?.tag, 'error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Write recipe parameters to PLC
  app.post('/write-recipe-params', async (req, res) => {
    try {
      const { side, parameters } = req.body;

      console.log('[plc-server] /write-recipe-params received', { side, parameters });
      
      if (!side || !parameters) {
        console.error('[plc-server] Missing side or parameters:', { side, parameters });
        return res.status(400).json({ success: false, error: 'Missing side or parameters' });
      }
      
      // If not connected, simulate success for offline testing
      if (!connected) {
        console.log('[plc-server] /write-recipe-params called (offline mode) - Would write recipe params for', side);
        return res.json({ success: true, source: 'mock', side, message: 'Recipe parameters simulated' });
      }

      // Map recipe parameters to PLC variable names
      const paramPrefix = side === 'left' ? 'GLEFTHEAD' : 'GRIGHTHEAD';
      const headPrefix = side === 'left' ? 'Left' : 'Right';
      
      const writeResults = [];
      
      try {
        // Write speed/recipe speed
        if (parameters.speed !== undefined) {
          const tag = `${paramPrefix}.iHmi${headPrefix}Speed`;
          const value = parseFloat(parameters.speed);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        // Write step delay
        if (parameters.stepDelay !== undefined) {
          const tag = `${paramPrefix}.tHmi${headPrefix}StepDelay`;
          const value = Math.round(parameters.stepDelay);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        // Write tube dimensions
        if (parameters.tubeID !== undefined) {
          const tag = `${paramPrefix}.rHmi${headPrefix}TubeID`;
          const value = parseFloat(parameters.tubeID);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        if (parameters.tubeOD !== undefined) {
          const tag = `${paramPrefix}.rHmi${headPrefix}TubeOD`;
          const value = parseFloat(parameters.tubeOD);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        if (parameters.finalSize !== undefined) {
          const tag = `${paramPrefix}.rHmi${headPrefix}FinalSize`;
          const value = parseFloat(parameters.finalSize);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        if (parameters.tubeLength !== undefined) {
          const tag = `${paramPrefix}.rHmi${headPrefix}TubeLength`;
          const value = parseFloat(parameters.tubeLength);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        // Write expansion parameters
        if (parameters.idFingerRadius !== undefined) {
          const tag = `${paramPrefix}.rHmi${headPrefix}IDFingerRadius`;
          const value = parseFloat(parameters.idFingerRadius);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        if (parameters.depth !== undefined) {
          const tag = `${paramPrefix}.rHmi${headPrefix}Depth`;
          const value = parseFloat(parameters.depth);
          console.log(`[plc-server] Writing recipe param: ${tag} = ${value}`);
          await writeTagValue(tag, value);
          writeResults.push({ tag, value, success: true });
        }
        
        console.log(`[plc-server] Recipe parameters write complete for ${side} side. Results:`, writeResults);
        res.json({ success: true, message: `Recipe parameters written to ${side} side`, writeResults });
        
      } catch (writeErr) {
        console.error(`[plc-server] Recipe parameter write error for ${side} side:`, writeErr.message, 'Stack:', writeErr.stack);
        res.status(500).json({ 
          success: false, 
          error: `Failed to write recipe parameters: ${writeErr.message}`
        });
      }
    } catch (err) {
      console.error('[plc-server] write-recipe-params endpoint error:', err.message, 'Stack:', err.stack);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Write a specific boolean tag (for push buttons, interlocks, etc.)
  app.post('/write-bool', async (req, res) => {
    try {
      const { tag, value } = req.body;
      if (!tag) {
        return res.status(400).json({ success: false, error: 'Missing tag' });
      }
      if (!connected) {
        return res.status(500).json({ success: false, error: 'PLC not connected' });
      }

      const boolValue = value === true || value === 'true' || value === 1;
      await writeTagValue(tag, boolValue);
      res.json({ success: true });
    } catch (err) {
      console.error('[plc-server] write-bool error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Momentary pulse: write true, wait durationMs (default 150ms), then write false
  app.post('/pulse-bool', async (req, res) => {
    try {
      const { tag, durationMs = 150 } = req.body;
      console.log('[plc-server] PULSE-BOOL REQUEST: tag=', tag, 'durationMs=', durationMs, 'connected=', connected);
      
      if (!tag) {
        console.error('[plc-server] PULSE-BOOL: Missing tag in request body');
        return res.status(400).json({ success: false, error: 'Missing tag' });
      }
      
      // If not connected, simulate pulse for offline testing
      if (!connected) {
        console.log('[plc-server] PULSE-BOOL: Simulating pulse (offline) for tag', tag);
        return res.json({ success: true, source: 'mock', tag, message: 'Pulse simulated' });
      }

      console.log('[plc-server] PULSE-BOOL: Writing TRUE to', tag);
      await writeTagValue(tag, true);
      
      console.log('[plc-server] PULSE-BOOL: Sleeping for', durationMs, 'ms');
      await sleep(Number(durationMs) || 150);
      
      console.log('[plc-server] PULSE-BOOL: Writing FALSE to', tag);
      await writeTagValue(tag, false);

      console.log('[plc-server] PULSE-BOOL: SUCCESS for tag', tag);
      res.json({ success: true });
    } catch (err) {
      console.error('[plc-server] pulse-bool error:', err.message, 'stack:', err.stack);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // IO map: expose configured indices
  app.get('/io-map', (_req, res) => {
    res.json({ buttons: ioMap });
  });

  // Read multiple indices (outputs to HMI)
  app.post('/io/read', async (req, res) => {
    try {
      if (!connected) {
        return res.status(500).json({ success: false, error: 'PLC not connected' });
      }
      const indexes = req.body.indexes || [];
      const results = {};

      for (const idx of indexes) {
        const tag = resolveTag(idx);
        if (!tag) {
          results[idx] = { error: 'Unknown index' };
          continue;
        }
        try {
          const value = await readTagValue(tag);
          results[idx] = { value };
        } catch (err) {
          results[idx] = { error: err.message };
        }
      }

      res.json({ success: true, results });
    } catch (err) {
      console.error('[plc-server] io/read error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Write by index (boolean)
  app.post('/io/write', async (req, res) => {
    try {
      const { index, value } = req.body;
      if (index === undefined) {
        return res.status(400).json({ success: false, error: 'Missing index' });
      }
      if (!connected) {
        return res.status(500).json({ success: false, error: 'PLC not connected' });
      }
      const tag = resolveTag(index);
      if (!tag) {
        return res.status(400).json({ success: false, error: 'Unknown index' });
      }

      const boolValue = value === true || value === 'true' || value === 1;
      await writeTagValue(tag, boolValue);
      res.json({ success: true, tag });
    } catch (err) {
      console.error('[plc-server] io/write error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Pulse by index (momentary button)
  app.post('/io/pulse', async (req, res) => {
    try {
      const { index, durationMs = 150 } = req.body;
      console.log(`[plc-server] IO pulse request - index: ${index}, duration: ${durationMs}ms`);
      
      if (index === undefined) {
        return res.status(400).json({ success: false, error: 'Missing index' });
      }
      
      const tag = resolveTag(index);
      if (!tag) {
        console.error(`[plc-server] Unknown IO index: ${index}`);
        return res.status(400).json({ success: false, error: `Unknown index ${index}` });
      }
      
      // If not connected, simulate pulse for offline testing
      if (!connected) {
        console.log(`[plc-server] IO pulse simulated (offline) for tag ${tag} (index ${index})`);
        return res.json({ success: true, tag, source: 'mock', message: 'IO pulse simulated' });
      }

      console.log(`[plc-server] Pulsing tag ${tag} (index ${index})`);
      console.log(`[plc-server] Writing TRUE to ${tag}...`);
      await writeTagValue(tag, true);
      console.log(`[plc-server] Wrote TRUE to ${tag}`);
      
      await sleep(Number(durationMs) || 150);
      
      console.log(`[plc-server] Writing FALSE to ${tag}...`);
      await writeTagValue(tag, false);
      console.log(`[plc-server] Wrote FALSE to ${tag}`);
      console.log(`[plc-server] IO pulse complete for ${tag}`);

      res.json({ success: true, tag });
    } catch (err) {
      console.error('[plc-server] io/pulse error:', err.message);
      console.error('[plc-server] io/pulse stack:', err.stack);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/test-tags', async (req, res) => {
    try {
      const tagsToTest = req.body.tags || TEST_TAGS;
      const results = [];

      console.log('[plc-server] Test tags request:', tagsToTest);
      console.log('[plc-server] ADS connected:', connected);
      console.log('[plc-server] ADS object type:', typeof ads);
      console.log('[plc-server] ADS has readValue:', typeof ads?.readValue);

      if (!ads || typeof ads.readValue !== 'function') {
        return res.status(500).json({ error: 'ADS client not properly initialized. ads=' + typeof ads + ', readValue=' + typeof ads?.readValue });
      }

      for (const tag of tagsToTest) {
        try {
          if (!connected) {
            results.push({ tag, status: 'error', value: null, error: 'PLC not connected' });
          } else {
            console.log('[plc-server] Reading tag:', tag);
            const value = await readTagValue(tag);
            console.log('[plc-server] Tag read success:', tag, '=', value);
            results.push({ tag, status: 'ok', value, error: null });
          }
        } catch (err) {
          console.error('[plc-server] Tag read error for', tag, ':', err.message);
          results.push({ tag, status: 'error', value: null, error: err.message });
        }
      }

      res.json({ results });
    } catch (err) {
      console.error('[plc-server] Test tags error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Write 10-step program to PLC arrays
  app.post('/write-program', async (req, res) => {
    try {
      const { side, program, machineParameters } = req.body;
      
      // If not connected, simulate success for offline testing
      if (!connected) {
        console.log('[plc-server] /write-program called (offline mode) - Would write program for', side);
        return res.json({ success: true, source: 'mock', side, message: 'Program download simulated' });
      }

      if (!side || !program || !program.steps) {
        return res.status(400).json({ success: false, error: 'Missing side or program data' });
      }

      console.log(`[plc-server] /write-program called with:`, {
        side,
        programName: program.name,
        numSteps: Object.keys(program.steps).length,
        stepNumbers: Object.keys(program.steps).sort((a, b) => Number(a) - Number(b))
      });

      // Validate positions against machine parameters
      const validationErrors = [];
      const minPosition = machineParameters?.minPosition ?? 0;
      const maxPosition = machineParameters?.maxPosition ?? 999999;
      
      console.log(`[plc-server] Position validation limits: min=${minPosition}, max=${maxPosition}`);
      
      for (let stepNum = 1; stepNum <= 20; stepNum++) {
        const step = program.steps[stepNum];
        if (!step || !step.positions) continue;
        
        const positions = step.positions;
        
        // Get axis values based on side
        const axis1Cmd = side === 'left' ? positions.axis3Cmd : positions.axis1Cmd;
        const axis2Cmd = side === 'left' ? positions.axis4Cmd : positions.axis2Cmd;
        
        // Check axis1 (ID)
        if (axis1Cmd !== undefined && axis1Cmd !== null) {
          if (axis1Cmd < minPosition) {
            validationErrors.push(`Step ${stepNum} ID position ${axis1Cmd.toFixed(2)} is below minimum ${minPosition.toFixed(2)}`);
          } else if (axis1Cmd > maxPosition) {
            validationErrors.push(`Step ${stepNum} ID position ${axis1Cmd.toFixed(2)} exceeds maximum ${maxPosition.toFixed(2)}`);
          }
        }
        
        // Check axis2 (OD)
        if (axis2Cmd !== undefined && axis2Cmd !== null) {
          if (axis2Cmd < minPosition) {
            validationErrors.push(`Step ${stepNum} OD position ${axis2Cmd.toFixed(2)} is below minimum ${minPosition.toFixed(2)}`);
          } else if (axis2Cmd > maxPosition) {
            validationErrors.push(`Step ${stepNum} OD position ${axis2Cmd.toFixed(2)} exceeds maximum ${maxPosition.toFixed(2)}`);
          }
        }
      }
      
      if (validationErrors.length > 0) {
        console.error('[plc-server] Position validation errors:', validationErrors);
        return res.json({ 
          success: false, 
          error: `Position validation failed: ${validationErrors.join('; ')}`,
          validationErrors 
        });
      }
      
      console.log('[plc-server] Position validation passed');

      const gvlPrefix = side === 'left' ? 'GLEFTHEAD' : 'GRIGHTHEAD';
      const headPrefix = side === 'left' ? 'Left' : 'Right';

      // Pattern mapping:
      // 0: Red Ext, 1: Red Ret, 2: Exp Ext, 3: Exp Ret,
      // 4: RedRet+ExpRet, 5: Repeat, 6: RedExt+ExpExt, 7: RedExt+ExpRet, 8: All Off
      const patternMap = {
        0: { redExt: true, redRet: false, expExt: false, expRet: false, repeat: false },
        1: { redExt: false, redRet: true, expExt: false, expRet: false, repeat: false },
        2: { redExt: false, redRet: false, expExt: true, expRet: false, repeat: false },
        3: { redExt: false, redRet: false, expExt: false, expRet: true, repeat: false },
        4: { redExt: false, redRet: true, expExt: false, expRet: true, repeat: false },
        5: { redExt: false, redRet: false, expExt: false, expRet: false, repeat: true },
        6: { redExt: true, redRet: false, expExt: true, expRet: false, repeat: false },
        7: { redExt: true, redRet: false, expExt: false, expRet: true, repeat: false },
        8: { redExt: false, redRet: false, expExt: false, expRet: false, repeat: false }
      };

      const errors = [];

      // Write each step (1-20)
      for (let stepNum = 1; stepNum <= 20; stepNum++) {
        const step = program.steps[stepNum];

        if (!step) {
          // Write all enables to false for empty steps
          try {
            if (stepNum === 1) {
              // Step 1 uses different enable variable names
              await writeTagValue(`${gvlPrefix}.aHmi${headPrefix}StepEna[${stepNum}]`, false);
              // Step 1 position structure is different, handled separately below
            } else {
              // Steps 2-10 use standard array enable variables
              await writeTagValue(`${gvlPrefix}.aHmi${headPrefix}StepEna[${stepNum}]`, false);
              await writeTagValue(`${gvlPrefix}.a${headPrefix}RedExtEna[${stepNum}]`, false);
              await writeTagValue(`${gvlPrefix}.a${headPrefix}RedRetEna[${stepNum}]`, false);
              await writeTagValue(`${gvlPrefix}.a${headPrefix}ExpExtEna[${stepNum}]`, false);
              await writeTagValue(`${gvlPrefix}.a${headPrefix}ExpRetEna[${stepNum}]`, false);
              await writeTagValue(`${gvlPrefix}.a${headPrefix}RepeatEna[${stepNum}]`, false);
            }
          } catch (err) {
            errors.push(`Step ${stepNum} (empty): ${err.message}`);
          }
          continue;
        }

        const pattern = patternMap[step.pattern] || patternMap[8]; // Default to All Off

        try {
          // Enable step
          await writeTagValue(`${gvlPrefix}.aHmi${headPrefix}StepEna[${stepNum}]`, step.enabled !== false);

          // Write pattern enables
          await writeTagValue(`${gvlPrefix}.a${headPrefix}RedExtEna[${stepNum}]`, pattern.redExt);
          await writeTagValue(`${gvlPrefix}.a${headPrefix}RedRetEna[${stepNum}]`, pattern.redRet);
          await writeTagValue(`${gvlPrefix}.a${headPrefix}ExpExtEna[${stepNum}]`, pattern.expExt);
          await writeTagValue(`${gvlPrefix}.a${headPrefix}ExpRetEna[${stepNum}]`, pattern.expRet);
          await writeTagValue(`${gvlPrefix}.a${headPrefix}RepeatEna[${stepNum}]`, pattern.repeat);

          // Write positions (machine mapping: Red = OD, Exp = ID)
          // NOTE: Step 1 uses different variable structure than steps 2-20
          // IMPORTANT: Right side uses axis1/axis2, Left side uses axis3/axis4
          if (step.positions) {
            // Determine which axis commands to read based on side
            const idAxisCmd = side === 'left' ? step.positions.axis3Cmd : step.positions.axis1Cmd;
            const odAxisCmd = side === 'left' ? step.positions.axis4Cmd : step.positions.axis2Cmd;
            
            // DEBUG: Log what positions we're about to write
            console.log(`[plc-server] Step ${stepNum} - Position data:`, {
              side,
              stepNumber: stepNum,
              receivedPositions: step.positions,
              extractedIdAxisCmd: idAxisCmd,
              extractedOdAxisCmd: odAxisCmd,
              pattern: step.pattern,
              patternSettings: pattern
            });
            
            if (stepNum === 1) {
              // Step 1: uses lRightPosStep1 / lLeftPosStep1 with fixed indices
              // [0] = OD (Red), [2] = ID (Exp)
              // Right: axis1Cmd = ID (Exp), axis2Cmd = OD (Red)
              // Left: axis3Cmd = ID (Exp), axis4Cmd = OD (Red)
              if (idAxisCmd !== undefined) {
                const tag = `${gvlPrefix}.l${headPrefix}PosStep1[2]`;
                console.log(`[plc-server] ${side} Step 1: Writing ID position (ExpPos) = ${idAxisCmd}`);
                await writeTagValue(tag, idAxisCmd);
              }
              if (odAxisCmd !== undefined) {
                const tag = `${gvlPrefix}.l${headPrefix}PosStep1[0]`;
                console.log(`[plc-server] ${side} Step 1: Writing OD position (RedPos) = ${odAxisCmd}`);
                await writeTagValue(tag, odAxisCmd);
              }
            } else {
              // Steps 2-20: use 2D arrays ARRAY[2..20, 0..1] OF LREAL
              // [step,0] = Retract pos, [step,1] = Extend pos
              // Right: axis1Cmd = ID (Exp), axis2Cmd = OD (Red)
              // Left: axis3Cmd = ID (Exp), axis4Cmd = OD (Red)
              if (idAxisCmd !== undefined && idAxisCmd !== null) {
                // Determine Exp (ID) index: 0=retract, 1=extend
                const expIdx = (pattern.expExt) ? 1 : 0;
                const tag = `${gvlPrefix}.a${headPrefix}ExpPos[${stepNum},${expIdx}]`;
                console.log(`[plc-server] ${side} Step ${stepNum}: Writing ID position (ExpPos[${stepNum},${expIdx}]) = ${idAxisCmd}`);
                try {
                  await writeTagValue(tag, idAxisCmd);
                  console.log(`[plc-server] SUCCESS: ${tag} = ${idAxisCmd}`);
                } catch (writeErr) {
                  console.error(`[plc-server] FAILED to write ${tag}:`, writeErr.message);
                }
              } else {
                console.warn(`[plc-server] Step ${stepNum}: ID axis is undefined/null, skipping write`);
              }
              if (odAxisCmd !== undefined && odAxisCmd !== null) {
                // Determine Red (OD) index: 0=retract, 1=extend
                const redIdx = (pattern.redExt) ? 1 : 0;
                const tag = `${gvlPrefix}.a${headPrefix}RedPos[${stepNum},${redIdx}]`;
                console.log(`[plc-server] ${side} Step ${stepNum}: Writing OD position (RedPos[${stepNum},${redIdx}]) = ${odAxisCmd}`);
                try {
                  await writeTagValue(tag, odAxisCmd);
                  console.log(`[plc-server] SUCCESS: ${tag} = ${odAxisCmd}`);
                } catch (writeErr) {
                  console.error(`[plc-server] FAILED to write ${tag}:`, writeErr.message);
                }
              } else {
                console.warn(`[plc-server] Step ${stepNum}: OD axis is undefined/null, skipping write`);
              }
            }
          }

          // Write dwell time
          if (step.dwell !== undefined) {
            await writeTagValue(`${gvlPrefix}.tHmi${headPrefix}StepDwell[${stepNum}]`, step.dwell);
          }

          // Write repeat settings (pattern 5 = repeat)
          if (pattern.repeat && step.repeatTargetStep !== undefined) {
            const repeatTarget = Number(step.repeatTargetStep);
            if (Number.isFinite(repeatTarget)) {
              await writeTagValue(`${gvlPrefix}.dHmi${headPrefix}RepeatTarget[${stepNum}]`, Math.round(repeatTarget), true);
              console.log(`[plc-server] Step ${stepNum}: Writing repeat target = ${Math.round(repeatTarget)}`);
            }
          }
          if (pattern.repeat && step.repeatCount !== undefined) {
            const repeatTimes = Number(step.repeatCount);
            if (Number.isFinite(repeatTimes)) {
              await writeTagValue(`${gvlPrefix}.dHmi${headPrefix}RepeatTimes[${stepNum}]`, Math.max(1, Math.round(repeatTimes)), true);
              console.log(`[plc-server] Step ${stepNum}: Writing repeat times = ${Math.max(1, Math.round(repeatTimes))}`);
            }
          }

        } catch (err) {
          errors.push(`Step ${stepNum}: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        console.error('[plc-server] Write program errors:', errors);
        return res.json({ success: false, error: `Write errors: ${errors.join(', ')}` });
      }

      console.log(`[plc-server] Program written successfully to ${side} side`);
      res.json({ success: true });

    } catch (err) {
      console.error('[plc-server] Write program error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  let server;

  async function start() {
    // Start HTTP server first
    server = app.listen(DEFAULT_HTTP_PORT, () => {
      console.log(`[plc-server] ADS Express server running on port ${DEFAULT_HTTP_PORT}`);
    });
    
    // Wait for ADS connection to be established (with timeout)
    // This ensures the backend is ready before React app starts calling endpoints
    await Promise.race([
      connectAds(),
      new Promise(resolve => setTimeout(() => {
        console.warn('[plc-server] ADS connection timeout (5s) - continuing anyway');
        resolve();
      }, 5000))
    ]);
    
    return { port: DEFAULT_HTTP_PORT };
  }

  async function stop() {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('[plc-server] HTTP server stopped');
    }
    if (connected) {
      try {
        await ads.disconnect();
        console.log('[plc-server] ADS client disconnected');
      } catch (err) {
        console.error('[plc-server] ADS disconnect error:', err.message);
      }
    }
  }

  return { start, stop };
}

async function startServer(savedNetId) {
  // Initialize NET ID from saved config or defaults
  initializeNetId(savedNetId);
  
  const srv = createServer();
  const result = await srv.start();
  console.log('[plc-server] Backend server started successfully');
  return srv;
}

module.exports = { startServer };
