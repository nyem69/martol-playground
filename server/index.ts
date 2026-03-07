import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connect, disconnect, sendKey, sendText, launchApp, getStatus, KEY_MAP } from './samsung.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/api/ws' });

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

app.post('/api/connect', async (req, res) => {
  try {
    const result = await connect(req.body.ip);
    const status = await getStatus();
    broadcast({ type: 'status', ...status });
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/disconnect', async (_req, res) => {
  try {
    await disconnect();
    broadcast({ type: 'status', connected: false, device: null });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/key', async (req, res) => {
  try {
    // Map Android keycodes to Samsung keycodes
    const key = KEY_MAP[req.body.key] || req.body.key;
    await sendKey(key);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/text', async (req, res) => {
  try {
    await sendText(req.body.text);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/app/launch', async (req, res) => {
  try {
    await launchApp(req.body.package);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Serve the built frontend (so everything runs over HTTP from one origin)
const buildPath = join(__dirname, '..', 'build');
app.use(express.static(buildPath));

app.get('/', (_req, res) => {
  res.sendFile(join(buildPath, 'index.html'));
});

app.get('/api/status', async (_req, res) => {
  const status = await getStatus();
  res.json(status);
});

setInterval(async () => {
  const status = await getStatus();
  broadcast({ type: 'status', ...status });
}, 5000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`TV Remote server on :${PORT}`));
