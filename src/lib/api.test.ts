import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock $app/environment ──────────────────────────────────────────────────

vi.mock('$app/environment', () => ({
  browser: true,
}));

// ─── Mock localStorage ──────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Mock navigator ─────────────────────────────────────────────────────────

vi.stubGlobal('navigator', { vibrate: vi.fn() });

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  // ─── setServerUrl / getServerUrl ──────────────────────────────────────

  describe('setServerUrl / getServerUrl', () => {
    it('strips trailing slashes', async () => {
      const { setServerUrl, getServerUrl } = await import('./api.js');
      setServerUrl('http://192.168.1.100:3001///');
      expect(getServerUrl()).toBe('http://192.168.1.100:3001');
    });

    it('persists to localStorage', async () => {
      const { setServerUrl } = await import('./api.js');
      setServerUrl('http://192.168.1.100:3001');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'server-url',
        'http://192.168.1.100:3001'
      );
    });
  });

  // ─── api.connect ──────────────────────────────────────────────────────

  describe('api.connect', () => {
    it('sends POST with IP in body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: 'Connected' }),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      const result = await api.connect('192.168.1.100');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/connect',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ ip: '192.168.1.100' }),
        })
      );
      expect(result).toEqual({ ok: true, result: 'Connected' });
    });
  });

  // ─── api.key ──────────────────────────────────────────────────────────

  describe('api.key', () => {
    it('sends POST with key in body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      await api.key('KEYCODE_DPAD_UP');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/key',
        expect.objectContaining({
          body: JSON.stringify({ key: 'KEYCODE_DPAD_UP' }),
        })
      );
    });
  });

  // ─── api.text ─────────────────────────────────────────────────────────

  describe('api.text', () => {
    it('sends POST with text in body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      await api.text('Hello');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/text',
        expect.objectContaining({
          body: JSON.stringify({ text: 'Hello' }),
        })
      );
    });
  });

  // ─── api.launch ───────────────────────────────────────────────────────

  describe('api.launch', () => {
    it('sends POST with package in body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      await api.launch('111299001912');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/app/launch',
        expect.objectContaining({
          body: JSON.stringify({ package: '111299001912' }),
        })
      );
    });
  });

  // ─── api.status ───────────────────────────────────────────────────────

  describe('api.status', () => {
    it('sends GET and returns status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ connected: true, device: '192.168.1.100' }),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      const result = await api.status();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/status',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(result).toEqual({ connected: true, device: '192.168.1.100' });
    });

    it('returns fallback on invalid JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('bad json')),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      const result = await api.status();

      expect(result).toEqual({ connected: false, device: null });
    });
  });

  // ─── Error handling — non-OK response ─────────────────────────────────

  describe('error handling', () => {
    it('returns error on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      const result = await api.connect('192.168.1.100');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Server error');
    });

    it('returns fallback error on non-OK response with bad JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('bad json')),
      });

      const { api, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      const result = await api.connect('192.168.1.100');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Request failed (500)');
    });
  });

  // ─── sendKey ──────────────────────────────────────────────────────────

  describe('sendKey', () => {
    it('calls api.key and vibrates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      });

      const { sendKey, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');
      await sendKey('KEYCODE_DPAD_UP');

      expect(navigator.vibrate).toHaveBeenCalledWith(30);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('does not throw on failure', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));

      const { sendKey, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');

      // Should not throw
      await expect(sendKey('KEY_UP')).resolves.toBeUndefined();
    });
  });

  // ─── createStatusSocket ───────────────────────────────────────────────

  describe('createStatusSocket', () => {
    it('constructs ws URL from BASE', async () => {
      const wsInstances: any[] = [];
      vi.stubGlobal('WebSocket', class MockWS {
        url: string;
        onopen: any;
        onmessage: any;
        onclose: any;
        onerror: any;
        constructor(url: string) {
          this.url = url;
          wsInstances.push(this);
        }
        close() {}
      });

      const { createStatusSocket, setServerUrl } = await import('./api.js');
      setServerUrl('http://192.168.1.100:3001');

      const cleanup = createStatusSocket(() => {});
      expect(wsInstances.length).toBeGreaterThan(0);
      expect(wsInstances[wsInstances.length - 1].url).toBe('ws://192.168.1.100:3001/api/ws');

      cleanup();
    });

    it('converts https to wss', async () => {
      const wsInstances: any[] = [];
      vi.stubGlobal('WebSocket', class MockWS {
        url: string;
        onopen: any;
        onmessage: any;
        onclose: any;
        onerror: any;
        constructor(url: string) {
          this.url = url;
          wsInstances.push(this);
        }
        close() {}
      });

      const { createStatusSocket, setServerUrl } = await import('./api.js');
      setServerUrl('https://192.168.1.100:3001');

      const cleanup = createStatusSocket(() => {});
      expect(wsInstances[wsInstances.length - 1].url).toBe('wss://192.168.1.100:3001/api/ws');

      cleanup();
    });

    it('calls onStatus for status messages', async () => {
      let wsInstance: any;
      vi.stubGlobal('WebSocket', class MockWS {
        url: string;
        onopen: any = null;
        onmessage: any = null;
        onclose: any = null;
        onerror: any = null;
        constructor(url: string) {
          this.url = url;
          wsInstance = this;
        }
        close() {}
      });

      const { createStatusSocket, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');

      const onStatus = vi.fn();
      const cleanup = createStatusSocket(onStatus);

      // Simulate status message
      wsInstance.onmessage({ data: JSON.stringify({ type: 'status', connected: true, device: 'TV' }) });

      expect(onStatus).toHaveBeenCalledWith({ type: 'status', connected: true, device: 'TV' });

      cleanup();
    });

    it('ignores non-status messages', async () => {
      let wsInstance: any;
      vi.stubGlobal('WebSocket', class MockWS {
        url: string;
        onopen: any = null;
        onmessage: any = null;
        onclose: any = null;
        onerror: any = null;
        constructor(url: string) {
          this.url = url;
          wsInstance = this;
        }
        close() {}
      });

      const { createStatusSocket, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');

      const onStatus = vi.fn();
      const cleanup = createStatusSocket(onStatus);

      // Simulate non-status message
      wsInstance.onmessage({ data: JSON.stringify({ type: 'ping' }) });

      expect(onStatus).not.toHaveBeenCalled();

      cleanup();
    });

    it('ignores malformed JSON', async () => {
      let wsInstance: any;
      vi.stubGlobal('WebSocket', class MockWS {
        url: string;
        onopen: any = null;
        onmessage: any = null;
        onclose: any = null;
        onerror: any = null;
        constructor(url: string) {
          this.url = url;
          wsInstance = this;
        }
        close() {}
      });

      const { createStatusSocket, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');

      const onStatus = vi.fn();
      const cleanup = createStatusSocket(onStatus);

      // Should not throw
      wsInstance.onmessage({ data: 'not json{{{' });

      expect(onStatus).not.toHaveBeenCalled();

      cleanup();
    });

    it('cleanup closes socket', async () => {
      const closeFn = vi.fn();
      vi.stubGlobal('WebSocket', class MockWS {
        url: string;
        onopen: any = null;
        onmessage: any = null;
        onclose: any = null;
        onerror: any = null;
        constructor(url: string) {
          this.url = url;
        }
        close = closeFn;
      });

      const { createStatusSocket, setServerUrl } = await import('./api.js');
      setServerUrl('http://localhost:3001');

      const cleanup = createStatusSocket(() => {});
      cleanup();

      expect(closeFn).toHaveBeenCalled();
    });
  });
});
