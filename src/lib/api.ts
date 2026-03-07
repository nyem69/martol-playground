// If served from the Express server, use same origin (empty string). Otherwise use saved/configured URL.
let BASE = localStorage.getItem('server-url') || import.meta.env.VITE_API_URL || '';

export function setServerUrl(url: string) {
  BASE = url.replace(/\/+$/, '');
  localStorage.setItem('server-url', BASE);
}

export function getServerUrl(): string {
  return BASE;
}

async function post(path: string, body: object = {}): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

export const api = {
  connect: (ip: string) => post('/api/connect', { ip }),
  disconnect: () => post('/api/disconnect'),
  key: (key: string) => post('/api/key', { key }),
  text: (text: string) => post('/api/text', { text }),
  launch: (pkg: string) => post('/api/app/launch', { package: pkg }),
  status: () => get('/api/status')
};

export type Status = { connected: boolean; device: string | null; detail?: string };

export function createStatusSocket(onStatus: (s: Status) => void): WebSocket {
  const wsUrl = BASE.replace(/^http/, 'ws') + '/api/ws';
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'status') onStatus(data);
  };
  ws.onclose = () => setTimeout(() => createStatusSocket(onStatus), 3000);
  return ws;
}
