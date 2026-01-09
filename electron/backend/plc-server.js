const express = require('express');
const { Client } = require('ads-client');
const fs = require('fs');
const path = require('path');

let DEFAULT_NET_ID = process.env.AMS_NET_ID || '169.254.109.230.1.1';
const DEFAULT_ADS_PORT = parseInt(process.env.AMS_PORT || '851', 10);
const DEFAULT_HTTP_PORT = parseInt(process.env.ADS_HTTP_PORT || '3001', 10);
const READ_SYMBOL = process.env.ADS_READ_SYMBOL || 'MAIN.myVar';
const WRITE_SYMBOL = process.env.ADS_WRITE_SYMBOL || 'MAIN.myVar';
const IO_MAP_PATH = path.join(__dirname, 'io-map.json');

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
    await ads.writeValue(tag, value, autoFill);
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
      
      // Disconnect and reconnect with new Net ID
      try {
        await ads.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      
      // Create new client with updated Net ID
      const newAds = new Client({
        targetAmsNetId: DEFAULT_NET_ID,
        targetAdsPort: DEFAULT_ADS_PORT,
      });
      
      try {
        await newAds.connect();
        Object.assign(ads, newAds);
        connected = true;
        console.log(`[plc-server] Connected to ADS at ${DEFAULT_NET_ID}:${DEFAULT_ADS_PORT}`);
        res.json({ success: true, message: 'Net ID updated and connected', amsNetId: DEFAULT_NET_ID });
      } catch (connErr) {
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
      if (!connected) throw new Error('PLC not connected');
      const tag = req.query.tag || READ_SYMBOL;
      const value = await readTagValue(tag);
      console.log(`[plc-server] Read tag "${tag}" returned:`, value, `(type: ${typeof value})`);
      res.json({ success: true, value, tag });
    } catch (err) {
      console.error('[plc-server] Read error for tag', req.query.tag, ':', err.message);
      res.status(500).json({ success: false, error: err.message });
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

  app.post('/write', async (req, res) => {
    try {
      if (!connected) throw new Error('PLC not connected');
      await writeTagValue(WRITE_SYMBOL, req.body.value);
      res.sendStatus(200);
    } catch (err) {
      console.error('[plc-server] Write error:', err.message);
      res.status(500).json({ error: err.message });
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
      if (!tag) {
        return res.status(400).json({ success: false, error: 'Missing tag' });
      }
      if (!connected) {
        return res.status(500).json({ success: false, error: 'PLC not connected' });
      }

      await writeTagValue(tag, true);
      await sleep(Number(durationMs) || 150);
      await writeTagValue(tag, false);

      res.json({ success: true });
    } catch (err) {
      console.error('[plc-server] pulse-bool error:', err.message);
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

      await writeTagValue(tag, true);
      await sleep(Number(durationMs) || 150);
      await writeTagValue(tag, false);

      res.json({ success: true, tag });
    } catch (err) {
      console.error('[plc-server] io/pulse error:', err.message);
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
      if (!connected) {
        return res.status(500).json({ success: false, error: 'PLC not connected' });
      }

      const { side, program } = req.body;
      if (!side || !program || !program.steps) {
        return res.status(400).json({ success: false, error: 'Missing side or program data' });
      }

      const gvlPrefix = side === 'left' ? 'GVL_GLEFTHEAD' : 'GVL_GRIGHTHEAD';
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

      // Write each step (1-10)
      for (let stepNum = 1; stepNum <= 10; stepNum++) {
        const step = program.steps[stepNum];

        if (!step) {
          // Write all enables to false for empty steps
          try {
            await writeTagValue(`${gvlPrefix}.aHmi${headPrefix}StepEna[${stepNum}]`, false);
            await writeTagValue(`${gvlPrefix}.a${headPrefix}RedExtEna[${stepNum}]`, false);
            await writeTagValue(`${gvlPrefix}.a${headPrefix}RedRetEna[${stepNum}]`, false);
            await writeTagValue(`${gvlPrefix}.a${headPrefix}ExpExtEna[${stepNum}]`, false);
            await writeTagValue(`${gvlPrefix}.a${headPrefix}ExpRetEna[${stepNum}]`, false);
            await writeTagValue(`${gvlPrefix}.a${headPrefix}RepeatEna[${stepNum}]`, false);
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

          // Write positions (axis1 = Red/ID, axis2 = Exp/OD)
          if (step.positions) {
            if (step.positions.axis1 !== undefined) {
              await writeTagValue(`${gvlPrefix}.a${headPrefix}RedPos[${stepNum}]`, step.positions.axis1);
            }
            if (step.positions.axis2 !== undefined) {
              await writeTagValue(`${gvlPrefix}.a${headPrefix}ExpPos[${stepNum}]`, step.positions.axis2);
            }
          }

          // Write dwell time
          if (step.dwell !== undefined) {
            await writeTagValue(`${gvlPrefix}.tHmi${headPrefix}StepDwell[${stepNum}]`, step.dwell);
          }

          // Write repeat settings
          if (step.repeatTarget !== undefined) {
            await writeTagValue(`${gvlPrefix}.d${headPrefix}RepeatTarget[${stepNum}]`, step.repeatTarget);
          }
          if (step.repeatCount !== undefined) {
            await writeTagValue(`${gvlPrefix}.dHmi${headPrefix}RepeatTimes[${stepNum}]`, step.repeatCount);
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
    // Start HTTP server first (don't wait for ADS connection)
    server = app.listen(DEFAULT_HTTP_PORT, () => {
      console.log(`[plc-server] ADS Express server running on port ${DEFAULT_HTTP_PORT}`);
    });
    
    // Connect to ADS in background
    connectAds();
    
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

async function startServer() {
  const srv = createServer();
  const result = await srv.start();
  console.log('[plc-server] Backend server started successfully');
  return srv;
}

module.exports = { startServer };
