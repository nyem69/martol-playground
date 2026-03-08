import WebSocket from 'ws';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let ws: WebSocket | null = null;
let tvIp: string | null = null;
let isConnected = false;
let tvName = '';
let connectGeneration = 0;
let pingInterval: ReturnType<typeof setInterval> | null = null;

const APP_NAME = Buffer.from('TV Remote').toString('base64');
let token: string | null = null;

const TOKEN_FILE = join(__dirname, '.tv-token.json');

// Load persisted token on startup
try {
  const data = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
  if (data.token) {
    token = data.token;
    console.log('[samsung] Loaded persisted token');
  }
} catch {
  // No saved token — that's fine
}

function saveToken(t: string) {
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify({ token: t }), 'utf-8');
  } catch (err) {
    console.error('[samsung] Failed to save token:', (err as Error).message);
  }
}

// Valid Samsung key codes
const VALID_KEYS = new Set([
  'KEY_UP', 'KEY_DOWN', 'KEY_LEFT', 'KEY_RIGHT', 'KEY_ENTER',
  'KEY_RETURN', 'KEY_HOME', 'KEY_MENU',
  'KEY_VOLUP', 'KEY_VOLDOWN', 'KEY_MUTE',
  'KEY_PLAY', 'KEY_PAUSE', 'KEY_REWIND', 'KEY_FF',
  'KEY_REWIND_', 'KEY_FF_',
  'KEY_POWER',
]);

// IP validation — only allow valid IPv4, reject loopback
function isValidIp(ip: string): boolean {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4);
  if (!match) return false;
  const octets = [match[1], match[2], match[3], match[4]].map(Number);
  if (octets.some(o => o > 255)) return false;
  if (octets[0] === 127) return false; // reject loopback
  return true;
}

function getWsUrl(ip: string): string {
  let url = `wss://${ip}:8002/api/v2/channels/samsung.remote.control?name=${APP_NAME}`;
  if (token) {
    url += `&token=${token}`;
  }
  return url;
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function startPing(socket: WebSocket) {
  stopPing();
  pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.ping();
    } else {
      stopPing();
    }
  }, 30000);
}

export async function connect(ip: string): Promise<string> {
  if (!isValidIp(ip)) {
    throw new Error('Invalid IP address');
  }

  // Close existing connection
  if (ws) {
    stopPing();
    ws.close();
    ws = null;
  }

  const generation = ++connectGeneration;

  return new Promise((resolve, reject) => {
    const url = getWsUrl(ip);
    console.log(`[samsung] Connecting to ${ip}:8002`);

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout — make sure the TV is on and check for a permission popup'));
    }, 15000);

    const socket = new WebSocket(url, { rejectUnauthorized: false });

    socket.on('open', () => {
      console.log('[samsung] WebSocket connected');
    });

    socket.on('message', (data) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        console.error('[samsung] Failed to parse message');
        return;
      }
      console.log(`[samsung] ← event: ${msg.event}`);

      if (msg.event === 'ms.channel.connect') {
        clearTimeout(timeout);

        // Stale connection — a newer connect() was called
        if (generation !== connectGeneration) {
          socket.close();
          return;
        }

        // Save token if provided
        if (msg.data?.token) {
          token = msg.data.token as string;
          saveToken(token);
          console.log('[samsung] Token saved');
        }
        tvName = msg.data?.name || ip;
        ws = socket;
        tvIp = ip;
        isConnected = true;
        startPing(socket);
        resolve(`Connected to ${tvName}`);
      } else if (msg.event === 'ms.channel.unauthorized') {
        clearTimeout(timeout);
        reject(new Error('TV denied the connection. Check your TV screen for a permission popup and select "Allow".'));
      }
    });

    socket.on('pong', () => {
      // TV responded to ping — connection is alive
    });

    socket.on('close', () => {
      console.log('[samsung] WebSocket closed');
      stopPing();
      isConnected = false;
      ws = null;
    });

    socket.on('error', (err) => {
      console.error(`[samsung] Error: ${err.message}`);
      clearTimeout(timeout);
      stopPing();
      isConnected = false;
      ws = null;
      reject(err);
    });
  });
}

export async function disconnect(): Promise<string> {
  if (ws) {
    stopPing();
    ws.close();
    ws = null;
  }
  isConnected = false;
  tvIp = null;
  return 'Disconnected';
}

export async function sendKey(keycode: string): Promise<string> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to TV');
  }

  if (!VALID_KEYS.has(keycode)) {
    throw new Error('Invalid key code');
  }

  const payload = {
    method: 'ms.remote.control',
    params: {
      Cmd: 'Click',
      DataOfCmd: keycode,
      Option: 'false',
      TypeOfRemote: 'SendRemoteKey'
    }
  };

  console.log(`[samsung] → ${keycode}`);
  return new Promise((resolve, reject) => {
    ws!.send(JSON.stringify(payload), (err) => {
      if (err) reject(err);
      else resolve('OK');
    });
  });
}

export async function sendText(text: string): Promise<string> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to TV');
  }

  if (typeof text !== 'string' || text.length === 0 || text.length > 500) {
    throw new Error('Text must be 1-500 characters');
  }

  const encoded = Buffer.from(text).toString('base64');
  const payload = {
    method: 'ms.remote.control',
    params: {
      Cmd: encoded,
      DataOfCmd: 'base64',
      TypeOfRemote: 'SendInputString'
    }
  };

  console.log(`[samsung] → text input (${text.length} chars)`);
  return new Promise((resolve, reject) => {
    ws!.send(JSON.stringify(payload), (err) => {
      if (err) reject(err);
      else resolve('OK');
    });
  });
}

export async function launchApp(appId: string): Promise<string> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to TV');
  }

  if (typeof appId !== 'string' || !/^[A-Za-z0-9.]+$/.test(appId)) {
    throw new Error('Invalid app ID');
  }

  const payload = {
    method: 'ms.channel.emit',
    params: {
      event: 'ed.apps.launch',
      to: 'host',
      data: {
        appId: appId,
        action_type: 'NATIVE_LAUNCH'
      }
    }
  };

  console.log(`[samsung] → launch app: ${appId}`);
  return new Promise((resolve, reject) => {
    ws!.send(JSON.stringify(payload), (err) => {
      if (err) reject(err);
      else resolve('OK');
    });
  });
}

export async function getStatus(): Promise<{ connected: boolean; device: string | null; detail?: string }> {
  const connected = isConnected && ws !== null && ws.readyState === WebSocket.OPEN;

  if (!connected && tvIp) {
    return { connected: false, device: tvIp, detail: 'Connection lost — try reconnecting' };
  }

  return { connected, device: tvIp, detail: connected ? tvName : undefined };
}

// Samsung key code mapping
export const KEY_MAP: Record<string, string> = {
  // D-pad
  KEYCODE_DPAD_UP: 'KEY_UP',
  KEYCODE_DPAD_DOWN: 'KEY_DOWN',
  KEYCODE_DPAD_LEFT: 'KEY_LEFT',
  KEYCODE_DPAD_RIGHT: 'KEY_RIGHT',
  KEYCODE_DPAD_CENTER: 'KEY_ENTER',
  // Navigation
  KEYCODE_BACK: 'KEY_RETURN',
  KEYCODE_HOME: 'KEY_HOME',
  KEYCODE_MENU: 'KEY_MENU',
  // Volume
  KEYCODE_VOLUME_UP: 'KEY_VOLUP',
  KEYCODE_VOLUME_DOWN: 'KEY_VOLDOWN',
  KEYCODE_VOLUME_MUTE: 'KEY_MUTE',
  // Media
  KEYCODE_MEDIA_PLAY_PAUSE: 'KEY_PLAY',
  KEYCODE_MEDIA_PAUSE: 'KEY_PAUSE',
  KEYCODE_MEDIA_REWIND: 'KEY_REWIND',
  KEYCODE_MEDIA_FAST_FORWARD: 'KEY_FF',
  KEYCODE_MEDIA_PREVIOUS: 'KEY_REWIND_',
  KEYCODE_MEDIA_NEXT: 'KEY_FF_',
  // Power
  KEYCODE_POWER: 'KEY_POWER',
};
