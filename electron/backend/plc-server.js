const express = require('express');
const { Client } = require('ads-client');

const DEFAULT_NET_ID = process.env.AMS_NET_ID || '5.34.123.45.1.1';
const DEFAULT_ADS_PORT = parseInt(process.env.AMS_PORT || '851', 10);
const DEFAULT_HTTP_PORT = parseInt(process.env.ADS_HTTP_PORT || '3001', 10);
const READ_SYMBOL = process.env.ADS_READ_SYMBOL || 'MAIN.myVar';
const WRITE_SYMBOL = process.env.ADS_WRITE_SYMBOL || 'MAIN.myVar';

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
    res.json({
      amsNetId: DEFAULT_NET_ID,
      connected,
      disconnectedTags,
    });
  });

  app.get('/read', async (_req, res) => {
    try {
      if (!connected) throw new Error('PLC not connected');
      const value = await ads.readSymbol(READ_SYMBOL);
      res.json({ value });
    } catch (err) {
      console.error('[plc-server] Read error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/write', async (req, res) => {
    try {
      if (!connected) throw new Error('PLC not connected');
      await ads.writeSymbol(WRITE_SYMBOL, req.body.value);
      res.sendStatus(200);
    } catch (err) {
      console.error('[plc-server] Write error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/test-tags', async (req, res) => {
    try {
      const tagsToTest = req.body.tags || TEST_TAGS;
      const results = [];

      for (const tag of tagsToTest) {
        try {
          if (!connected) {
            results.push({ tag, status: 'error', value: null, error: 'PLC not connected' });
          } else {
            const value = await ads.readSymbol(tag);
            results.push({ tag, status: 'ok', value, error: null });
          }
        } catch (err) {
          results.push({ tag, status: 'error', value: null, error: err.message });
        }
      }

      res.json({ results });
    } catch (err) {
      console.error('[plc-server] Test tags error:', err.message);

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
                  await ads.writeSymbol(`${gvlPrefix}.aHmi${headPrefix}StepEna[${stepNum}]`, false);
                  await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}RedExtEna[${stepNum}]`, false);
                  await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}RedRetEna[${stepNum}]`, false);
                  await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}ExpExtEna[${stepNum}]`, false);
                  await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}ExpRetEna[${stepNum}]`, false);
                  await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}RepeatEna[${stepNum}]`, false);
                } catch (err) {
                  errors.push(`Step ${stepNum} (empty): ${err.message}`);
                }
                continue;
              }

              const pattern = patternMap[step.pattern] || patternMap[8]; // Default to All Off
        
              try {
                // Enable step
                await ads.writeSymbol(`${gvlPrefix}.aHmi${headPrefix}StepEna[${stepNum}]`, step.enabled !== false);

                // Write pattern enables
                await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}RedExtEna[${stepNum}]`, pattern.redExt);
                await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}RedRetEna[${stepNum}]`, pattern.redRet);
                await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}ExpExtEna[${stepNum}]`, pattern.expExt);
                await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}ExpRetEna[${stepNum}]`, pattern.expRet);
                await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}RepeatEna[${stepNum}]`, pattern.repeat);

                // Write positions (axis1 = Red/ID, axis2 = Exp/OD)
                if (step.positions) {
                  if (step.positions.axis1 !== undefined) {
                    await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}RedPos[${stepNum}]`, step.positions.axis1);
                  }
                  if (step.positions.axis2 !== undefined) {
                    await ads.writeSymbol(`${gvlPrefix}.a${headPrefix}ExpPos[${stepNum}]`, step.positions.axis2);
                  }
                }

                // Write dwell time
                if (step.dwell !== undefined) {
                  await ads.writeSymbol(`${gvlPrefix}.tHmi${headPrefix}StepDwell[${stepNum}]`, step.dwell);
                }

                // Write repeat settings
                if (step.repeatTarget !== undefined) {
                  await ads.writeSymbol(`${gvlPrefix}.d${headPrefix}RepeatTarget[${stepNum}]`, step.repeatTarget);
                }
                if (step.repeatCount !== undefined) {
                  await ads.writeSymbol(`${gvlPrefix}.dHmi${headPrefix}RepeatTimes[${stepNum}]`, step.repeatCount);
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
      res.status(500).json({ error: err.message });
    }
  });

  let server;

  async function start() {
    await connectAds();
    server = app.listen(DEFAULT_HTTP_PORT, () => {
      console.log(`[plc-server] ADS Express server running on port ${DEFAULT_HTTP_PORT}`);
    });
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
  await srv.start();
  return srv;
}

module.exports = { startServer };
