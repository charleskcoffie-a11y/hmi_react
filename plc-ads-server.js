import { Client } from 'ads-client';
import express from 'express';

const app = express();
app.use(express.json());

const ads = new Client({
  targetAmsNetId: '169.254.109.230.1.1', // Replace with your PLC NetID
  targetAdsPort: 851                // Replace with your PLC port
});

(async () => {
  await ads.connect();
})();

app.get('/read', async (req, res) => {
  try {
    const value = await ads.readSymbol('MAIN.myVar'); // Replace with your PLC variable
    res.json({ value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/write', async (req, res) => {
  try {
    await ads.writeSymbol('MAIN.myVar', req.body.value); // Replace with your PLC variable
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log('ADS Express server running on port 3001');
});
