import WebSocket from 'ws';

let ws: WebSocket | null = null;
let tvIp: string | null = null;
let isConnected = false;
let tvName = '';

const APP_NAME = Buffer.from('TV Remote').toString('base64');
let token: string | null = null;

function getWsUrl(ip: string): string {
  // Use WSS on port 8002 — newer Samsung TVs require SSL for the auth prompt to appear
  let url = `wss://${ip}:8002/api/v2/channels/samsung.remote.control?name=${APP_NAME}`;
  if (token) {
    url += `&token=${token}`;
  }
  return url;
}

export async function connect(ip: string): Promise<string> {
  // Close existing connection
  if (ws) {
    ws.close();
    ws = null;
  }

  return new Promise((resolve, reject) => {
    const url = getWsUrl(ip);
    console.log(`[samsung] Connecting to ${url}`);

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout — make sure the TV is on and check for a permission popup'));
    }, 15000);

    const socket = new WebSocket(url, { rejectUnauthorized: false });

    socket.on('open', () => {
      console.log('[samsung] WebSocket connected');
      clearTimeout(timeout);
      ws = socket;
      tvIp = ip;
      isConnected = true;
    });

    socket.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log(`[samsung] ← ${JSON.stringify(msg).substring(0, 300)}`);

      if (msg.event === 'ms.channel.connect') {
        // Save token if provided for future connections
        if (msg.data?.token) {
          token = msg.data.token;
          console.log(`[samsung] Token received: ${token.substring(0, 20)}...`);
        }
        tvName = msg.data?.name || ip;
        resolve(`Connected to ${tvName}`);
      } else if (msg.event === 'ms.channel.unauthorized') {
        clearTimeout(timeout);
        reject(new Error('TV denied the connection. Check your TV screen for a permission popup and select "Allow".'));
      }
    });

    socket.on('close', () => {
      console.log('[samsung] WebSocket closed');
      isConnected = false;
      ws = null;
    });

    socket.on('error', (err) => {
      console.log(`[samsung] Error: ${err.message}`);
      clearTimeout(timeout);
      isConnected = false;
      ws = null;
      reject(err);
    });
  });
}

export async function disconnect(): Promise<string> {
  if (ws) {
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
  ws.send(JSON.stringify(payload));
  return 'OK';
}

export async function sendText(text: string): Promise<string> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to TV');
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

  console.log(`[samsung] → text: ${text}`);
  ws.send(JSON.stringify(payload));
  return 'OK';
}

export async function launchApp(appId: string): Promise<string> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to TV');
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
  ws.send(JSON.stringify(payload));
  return 'OK';
}

export async function getInstalledApps(): Promise<any> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to TV');
  }

  const payload = {
    method: 'ms.channel.emit',
    params: {
      event: 'ed.installedApp.get',
      to: 'host'
    }
  };

  ws.send(JSON.stringify(payload));
  return 'Request sent';
}

export async function getStatus(): Promise<{ connected: boolean; device: string | null; detail?: string }> {
  const connected = isConnected && ws !== null && ws.readyState === WebSocket.OPEN;

  if (!connected && tvIp) {
    return { connected: false, device: tvIp, detail: 'Connection lost — try reconnecting' };
  }

  return { connected, device: tvIp, detail: connected ? tvName : undefined };
}

// Samsung key code mapping from our generic codes
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

// Samsung app IDs
export const APP_MAP: Record<string, string> = {
  'com.google.android.youtube.tv': 'YouTube',
  'com.netflix.ninja': 'Netflix',
  'com.disney.disneyplus': 'Disney+',
  'com.amazon.amazonvideo.livingroom': 'Amazon Prime Video',
  'com.spotify.tv.android': 'Spotify',
  'com.plexapp.android': 'Plex',
};
