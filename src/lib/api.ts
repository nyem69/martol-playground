import { browser } from '$app/environment';

let BASE = '';
if (browser) {
  BASE = localStorage.getItem('server-url') || import.meta.env.VITE_API_URL || '';
}

export function setServerUrl(url: string) {
  BASE = url.replace(/\/+$/, '');
  if (browser) localStorage.setItem('server-url', BASE);
}

export function getServerUrl(): string {
  return BASE;
}

export type Status = { connected: boolean; device: string | null; detail?: string };

export interface ApiResponse {
  ok: boolean;
  result?: string;
  error?: string;
}

async function post(path: string, body: object = {}): Promise<ApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || `Request failed (${res.status})` };
    }
    return await res.json().catch(() => ({ ok: false, error: 'Invalid response' }));
  } finally {
    clearTimeout(timeout);
  }
}

async function get(path: string): Promise<Status> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json().catch(() => ({ connected: false, device: null }));
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  connect: (ip: string) => post('/api/connect', { ip }),
  disconnect: () => post('/api/disconnect'),
  key: (key: string) => post('/api/key', { key }),
  text: (text: string) => post('/api/text', { text }),
  launch: (pkg: string) => post('/api/app/launch', { package: pkg }),
  status: () => get('/api/status'),
};

/** Send a key with haptic feedback and error catching */
export async function sendKey(key: string): Promise<void> {
  try {
    navigator.vibrate?.(30);
    await api.key(key);
  } catch {
    // Silently fail — UI stays responsive
  }
}

export function createStatusSocket(onStatus: (s: Status) => void): () => void {
  let destroyed = false;
  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout>;
  let backoff = 1000;
  const MAX_BACKOFF = 30000;

  function connectWs() {
    if (destroyed) return;

    let wsUrl: string;
    if (BASE) {
      wsUrl = BASE.replace(/^http/, 'ws') + '/api/ws';
    } else {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${location.host}/api/ws`;
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      backoff = 1000; // reset on successful connect
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'status') onStatus(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (e) => {
      ws = null;
      if (destroyed) return;
      // Reconnect with exponential backoff, skip for intentional closes (1000)
      if (e.code !== 1000) {
        reconnectTimeout = setTimeout(connectWs, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF);
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  connectWs();

  // Return cleanup function
  return () => {
    destroyed = true;
    clearTimeout(reconnectTimeout);
    if (ws) {
      ws.close();
      ws = null;
    }
  };
}
