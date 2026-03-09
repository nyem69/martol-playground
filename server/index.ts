import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connect, disconnect, sendKey, sendText, launchApp, getStatus, KEY_MAP } from './samsung.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/api/ws',
  verifyClient: (info: { origin: string; req: IncomingMessage }) => {
    // Per-IP connection limit
    const ip = info.req.socket.remoteAddress || '';
    if ((wsConnectionsByIp.get(ip) || 0) >= MAX_WS_PER_IP) return false;

    const origin = info.origin || info.req.headers.origin || '';
    // Allow connections with no origin (non-browser clients)
    if (!origin) return true;
    try {
      const url = new URL(origin);
      const host = info.req.headers.host || '';
      // Allow same-origin (parsed origin host matches request Host header)
      if (host && url.host === host) return true;
      // Allow localhost/127.0.0.1 exactly
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
      return false;
    } catch {
      return false;
    }
  },
});

const wsConnectionsByIp = new Map<string, number>();
const MAX_WS_PER_IP = 5;

let lastStatus: object | null = null;

function broadcast(data: object) {
  if (wss.clients.size === 0) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Ping/pong keepalive for browser clients
const clientAlive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || '';
  wsConnectionsByIp.set(ip, (wsConnectionsByIp.get(ip) || 0) + 1);
  clientAlive.set(ws, true);
  ws.on('pong', () => clientAlive.set(ws, true));
  ws.on('close', () => {
    const count = wsConnectionsByIp.get(ip) || 1;
    if (count <= 1) wsConnectionsByIp.delete(ip);
    else wsConnectionsByIp.set(ip, count - 1);
  });
});

const pingClients = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!clientAlive.get(ws)) {
      ws.terminate();
      return;
    }
    clientAlive.set(ws, false);
    ws.ping();
  });
}, 30000);

app.post('/api/connect', async (req, res) => {
  try {
    const { ip } = req.body;
    if (typeof ip !== 'string' || !ip.trim()) {
      res.status(400).json({ ok: false, error: 'IP address is required' });
      return;
    }
    const result = await connect(ip.trim());
    const status = await getStatus();
    broadcast({ type: 'status', ...status });
    res.json({ ok: true, result });
  } catch (e: any) {
    broadcast({ type: 'status', connected: false, device: null });
    res.status(500).json({ ok: false, error: 'Connection failed' });
    console.error('[server] Connect error:', e.message);
  }
});

app.post('/api/disconnect', async (_req, res) => {
  try {
    await disconnect();
    broadcast({ type: 'status', connected: false, device: null });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: 'Disconnect failed' });
    console.error('[server] Disconnect error:', e.message);
  }
});

app.post('/api/key', async (req, res) => {
  try {
    const { key } = req.body;
    if (typeof key !== 'string' || !key.trim()) {
      res.status(400).json({ ok: false, error: 'Key is required' });
      return;
    }
    const mapped = KEY_MAP[key] || key;
    await sendKey(mapped);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: 'Failed to send key' });
    console.error('[server] Key error:', e.message);
  }
});

app.post('/api/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ ok: false, error: 'Text is required' });
      return;
    }
    await sendText(text.trim());
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: 'Failed to send text' });
    console.error('[server] Text error:', e.message);
  }
});

app.post('/api/app/launch', async (req, res) => {
  try {
    const pkg = req.body.package;
    if (typeof pkg !== 'string' || !pkg.trim()) {
      res.status(400).json({ ok: false, error: 'Package is required' });
      return;
    }
    await launchApp(pkg.trim());
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: 'Failed to launch app' });
    console.error('[server] Launch error:', e.message);
  }
});

app.get('/api/status', async (_req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ connected: false, device: null });
    console.error('[server] Status error:', e.message);
  }
});

// Serve the built frontend (so everything runs over HTTP from one origin)
const buildPath = join(__dirname, '..', 'build');
app.use(express.static(buildPath, {
  setHeaders: (res, filePath) => {
    if (filePath.includes('_app/immutable/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// SPA catch-all — serve index.html for client-side routes
app.get('*', (_req, res) => {
  res.sendFile(join(buildPath, 'index.html'));
});

// Heartbeat — only broadcast when status changes
setInterval(async () => {
  try {
    const status = await getStatus();
    const statusObj = { type: 'status', ...status };
    const statusStr = JSON.stringify(statusObj);
    if (statusStr !== JSON.stringify(lastStatus)) {
      lastStatus = statusObj;
      broadcast(statusObj);
    }
  } catch (e: any) {
    console.error('[server] Heartbeat error:', e.message);
  }
}, 5000);

// Graceful shutdown
function shutdown() {
  console.log('[server] Shutting down...');
  clearInterval(pingClients);
  wss.clients.forEach(client => client.close());
  server.close(() => {
    console.log('[server] Closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`TV Remote server on :${PORT}`));
