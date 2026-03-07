# TV Remote

A mobile-first web app for controlling a Samsung Smart TV over the local network.

## Architecture

```
Mobile Browser ──HTTP/WS──▶ Express Server ──WSS──▶ Samsung TV
   (SvelteKit PWA)           (Node.js)              (Tizen OS)
     port 3001               port 3001            port 8002 (WSS)
```

**Frontend:** SvelteKit 2 + Svelte 5, built as a static PWA and served by the Express server (same-origin).

**Backend:** Express server acts as a bridge — the browser talks REST/WebSocket to Express, which maintains a persistent WSS connection to the Samsung TV using the Samsung Remote Control protocol.

**Why a server?** Browsers cannot open raw WebSocket connections to the TV's self-signed SSL endpoint. The Node.js server handles the WSS connection with `rejectUnauthorized: false`.

## Samsung TV Protocol

Samsung Smart TVs (Tizen OS) expose a WebSocket API on ports 8001 (WS) and 8002 (WSS).

- **Port 8001** (WS) — works for basic connections but newer TVs (2024+) won't show the authorization prompt
- **Port 8002** (WSS) — uses a self-signed SSL certificate; required for the TV to display the "Allow/Deny" prompt

### Connection Flow

1. Server opens `wss://<tv-ip>:8002/api/v2/channels/samsung.remote.control?name=<base64-name>`
2. TV displays an authorization prompt on screen — user selects "Allow"
3. TV sends `ms.channel.connect` event with a token for future reconnections
4. Subsequent connections include `&token=<token>` to skip the prompt

### Sending Commands

```json
{
  "method": "ms.remote.control",
  "params": {
    "Cmd": "Click",
    "DataOfCmd": "KEY_UP",
    "Option": "false",
    "TypeOfRemote": "SendRemoteKey"
  }
}
```

### Key Codes

| Function        | Samsung Key Code |
|-----------------|------------------|
| D-pad Up        | `KEY_UP`         |
| D-pad Down      | `KEY_DOWN`       |
| D-pad Left      | `KEY_LEFT`       |
| D-pad Right     | `KEY_RIGHT`      |
| Select/Enter    | `KEY_ENTER`      |
| Back            | `KEY_RETURN`      |
| Home            | `KEY_HOME`        |
| Menu            | `KEY_MENU`        |
| Volume Up       | `KEY_VOLUP`       |
| Volume Down     | `KEY_VOLDOWN`     |
| Mute            | `KEY_MUTE`        |
| Play/Pause      | `KEY_PLAY`        |
| Power           | `KEY_POWER`       |

### Launching Apps

```json
{
  "method": "ms.channel.emit",
  "params": {
    "event": "ed.apps.launch",
    "to": "host",
    "data": {
      "appId": "111299001912",
      "action_type": "NATIVE_LAUNCH"
    }
  }
}
```

Known Samsung Tizen app IDs:

| App       | ID              |
|-----------|-----------------|
| YouTube   | `111299001912`  |
| Netflix   | `3201907018807` |
| Disney+   | `3201901017640` |
| Prime     | `3201910019365` |
| Spotify   | `3201606009684` |
| Apple TV  | `3201807016597` |

### Sending Text

Text is sent as base64-encoded strings via the `SendInputString` remote type. Useful when the TV has a text input field focused.

## API Endpoints

| Method | Path              | Body                    | Description              |
|--------|-------------------|-------------------------|--------------------------|
| POST   | `/api/connect`    | `{ "ip": "x.x.x.x" }`  | Connect to TV            |
| POST   | `/api/disconnect` | —                       | Disconnect from TV       |
| POST   | `/api/key`        | `{ "key": "KEY_UP" }`   | Send a key press         |
| POST   | `/api/text`       | `{ "text": "hello" }`   | Send text input          |
| POST   | `/api/app/launch` | `{ "package": "id" }`   | Launch an app by ID      |
| GET    | `/api/status`     | —                       | Get connection status    |
| WS     | `/api/ws`         | —                       | Real-time status updates |

## Project Structure

```
├── server/
│   ├── index.ts          # Express server, REST + WS endpoints
│   └── samsung.ts        # Samsung TV WebSocket protocol handler
├── src/
│   ├── app.css            # Global styles (dark theme)
│   ├── lib/
│   │   ├── api.ts         # Frontend API client + status WebSocket
│   │   └── components/
│   │       ├── ConnectScreen.svelte   # Server URL + TV IP input
│   │       ├── DPad.svelte            # Directional pad with center button
│   │       ├── NavBar.svelte          # Back, Home, Menu buttons
│   │       ├── VolumeBar.svelte       # Volume up/down/mute
│   │       ├── MediaBar.svelte        # Play, pause, rewind, fast-forward
│   │       ├── TextInput.svelte       # Text input for TV keyboard
│   │       └── AppLauncher.svelte     # Quick-launch app buttons
│   └── routes/
│       └── +page.svelte   # Main page — assembles all components
├── docs/
│   └── plans/             # Implementation plans
└── static/
    └── manifest.json      # PWA manifest
```

## Setup

### Prerequisites

- Node.js 20+
- pnpm
- Samsung Smart TV on the same local network

### Install & Run

```bash
# Install dependencies
pnpm install
cd server && pnpm install && cd ..

# Development (frontend + backend)
pnpm dev:all

# Production
pnpm build
cd server && pnpm start
```

The server starts on port 3001 and serves both the API and the built frontend.

### First Connection

1. Open `http://<server-ip>:3001` on your phone
2. Enter the TV's IP address (find it in TV Settings > General > Network > IP)
3. Press Connect — a prompt will appear on the TV screen
4. Select "Allow" on the TV
5. The remote control UI appears — start controlling your TV

The TV remembers the authorization via a token, so subsequent connections won't need approval.

## Troubleshooting

| Problem                        | Solution                                                                 |
|--------------------------------|--------------------------------------------------------------------------|
| "Cannot reach server"          | Make sure the server is running and phone is on the same network         |
| "Connection timeout"           | TV must be powered on. Check the IP address is correct                   |
| No permission prompt on TV     | Must use WSS (port 8002). WS (port 8001) won't trigger the prompt on newer TVs |
| "TV denied the connection"     | Select "Allow" on the TV screen when prompted                            |
| Buttons not responding         | Check status indicator — if disconnected, press settings and reconnect   |
| Mixed content errors           | Access via `http://` (not `https://`) or serve frontend from Express     |
