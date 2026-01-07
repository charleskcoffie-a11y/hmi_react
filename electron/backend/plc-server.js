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
