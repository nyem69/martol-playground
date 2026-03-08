import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mock samsung.ts so we can test routes without a real TV ────────────────

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSendKey = vi.fn();
const mockSendText = vi.fn();
const mockLaunchApp = vi.fn();
const mockGetStatus = vi.fn();

vi.mock('./samsung.js', () => ({
  connect: (...args: any[]) => mockConnect(...args),
  disconnect: (...args: any[]) => mockDisconnect(...args),
  sendKey: (...args: any[]) => mockSendKey(...args),
  sendText: (...args: any[]) => mockSendText(...args),
  launchApp: (...args: any[]) => mockLaunchApp(...args),
  getStatus: (...args: any[]) => mockGetStatus(...args),
  KEY_MAP: {
    KEYCODE_DPAD_UP: 'KEY_UP',
    KEYCODE_DPAD_DOWN: 'KEY_DOWN',
    KEYCODE_HOME: 'KEY_HOME',
  },
}));

// Build a minimal Express app mirroring index.ts routes (without timers/WSS)
async function createTestApp() {
  const app = express();
  app.use(express.json());

  const { KEY_MAP } = await import('./samsung.js');

  app.post('/api/connect', async (req, res) => {
    try {
      const { ip } = req.body;
      if (typeof ip !== 'string' || !ip.trim()) {
        res.status(400).json({ ok: false, error: 'IP address is required' });
        return;
      }
      const result = await mockConnect(ip.trim());
      res.json({ ok: true, result });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: 'Connection failed' });
    }
  });

  app.post('/api/disconnect', async (_req, res) => {
    try {
      await mockDisconnect();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: 'Disconnect failed' });
    }
  });

  app.post('/api/key', async (req, res) => {
    try {
      const { key } = req.body;
      if (typeof key !== 'string' || !key.trim()) {
        res.status(400).json({ ok: false, error: 'Key is required' });
        return;
      }
      const mapped = (KEY_MAP as any)[key] || key;
      await mockSendKey(mapped);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: 'Failed to send key' });
    }
  });

  app.post('/api/text', async (req, res) => {
    try {
      const { text } = req.body;
      if (typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ ok: false, error: 'Text is required' });
        return;
      }
      await mockSendText(text);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: 'Failed to send text' });
    }
  });

  app.post('/api/app/launch', async (req, res) => {
    try {
      const pkg = req.body.package;
      if (typeof pkg !== 'string' || !pkg.trim()) {
        res.status(400).json({ ok: false, error: 'Package is required' });
        return;
      }
      await mockLaunchApp(pkg.trim());
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: 'Failed to launch app' });
    }
  });

  app.get('/api/status', async (_req, res) => {
    try {
      const status = await mockGetStatus();
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ connected: false, device: null });
    }
  });

  return app;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('API Routes', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/connect ────────────────────────────────────────────────

  describe('POST /api/connect', () => {
    it('connects with valid IP', async () => {
      mockConnect.mockResolvedValue('Connected to TV');

      const res = await request(app)
        .post('/api/connect')
        .send({ ip: '192.168.1.100' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, result: 'Connected to TV' });
      expect(mockConnect).toHaveBeenCalledWith('192.168.1.100');
    });

    it('returns 400 without IP', async () => {
      const res = await request(app)
        .post('/api/connect')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('IP address is required');
    });

    it('returns 400 with empty IP', async () => {
      const res = await request(app)
        .post('/api/connect')
        .send({ ip: '   ' });

      expect(res.status).toBe(400);
    });

    it('returns 500 on connect failure', async () => {
      mockConnect.mockRejectedValue(new Error('Connection timeout'));

      const res = await request(app)
        .post('/api/connect')
        .send({ ip: '192.168.1.100' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Connection failed');
    });
  });

  // ─── POST /api/disconnect ─────────────────────────────────────────────

  describe('POST /api/disconnect', () => {
    it('disconnects successfully', async () => {
      mockDisconnect.mockResolvedValue('Disconnected');

      const res = await request(app).post('/api/disconnect');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('returns 500 on failure', async () => {
      mockDisconnect.mockRejectedValue(new Error('fail'));

      const res = await request(app).post('/api/disconnect');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Disconnect failed');
    });
  });

  // ─── POST /api/key ────────────────────────────────────────────────────

  describe('POST /api/key', () => {
    it('sends a mapped key', async () => {
      mockSendKey.mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/key')
        .send({ key: 'KEYCODE_DPAD_UP' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockSendKey).toHaveBeenCalledWith('KEY_UP');
    });

    it('passes through unmapped keys', async () => {
      mockSendKey.mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/key')
        .send({ key: 'KEY_CUSTOM' });

      expect(res.status).toBe(200);
      expect(mockSendKey).toHaveBeenCalledWith('KEY_CUSTOM');
    });

    it('returns 400 without key', async () => {
      const res = await request(app)
        .post('/api/key')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Key is required');
    });

    it('returns 500 on sendKey failure', async () => {
      mockSendKey.mockRejectedValue(new Error('Not connected'));

      const res = await request(app)
        .post('/api/key')
        .send({ key: 'KEY_UP' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to send key');
    });
  });

  // ─── POST /api/text ───────────────────────────────────────────────────

  describe('POST /api/text', () => {
    it('sends text successfully', async () => {
      mockSendText.mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/text')
        .send({ text: 'Hello TV' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockSendText).toHaveBeenCalledWith('Hello TV');
    });

    it('returns 400 without text', async () => {
      const res = await request(app)
        .post('/api/text')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Text is required');
    });

    it('returns 400 with empty text', async () => {
      const res = await request(app)
        .post('/api/text')
        .send({ text: '   ' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/app/launch ─────────────────────────────────────────────

  describe('POST /api/app/launch', () => {
    it('launches app successfully', async () => {
      mockLaunchApp.mockResolvedValue('OK');

      const res = await request(app)
        .post('/api/app/launch')
        .send({ package: '111299001912' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockLaunchApp).toHaveBeenCalledWith('111299001912');
    });

    it('returns 400 without package', async () => {
      const res = await request(app)
        .post('/api/app/launch')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Package is required');
    });

    it('returns 500 on launch failure', async () => {
      mockLaunchApp.mockRejectedValue(new Error('Not connected'));

      const res = await request(app)
        .post('/api/app/launch')
        .send({ package: '111299001912' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to launch app');
    });
  });

  // ─── GET /api/status ──────────────────────────────────────────────────

  describe('GET /api/status', () => {
    it('returns connected status', async () => {
      mockGetStatus.mockResolvedValue({
        connected: true,
        device: '192.168.1.100',
        detail: 'Samsung TV',
      });

      const res = await request(app).get('/api/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        connected: true,
        device: '192.168.1.100',
        detail: 'Samsung TV',
      });
    });

    it('returns disconnected status', async () => {
      mockGetStatus.mockResolvedValue({
        connected: false,
        device: null,
      });

      const res = await request(app).get('/api/status');

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });

    it('returns 500 on failure', async () => {
      mockGetStatus.mockRejectedValue(new Error('fail'));

      const res = await request(app).get('/api/status');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ connected: false, device: null });
    });
  });
});
