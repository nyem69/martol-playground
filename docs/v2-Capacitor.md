# TV Remote v2 — Capacitor Native App

## Goal

Eliminate the local Node.js server by moving the Samsung TV WebSocket connection into a native Capacitor plugin. The app becomes a standalone mobile app — no separate server process needed.

---

## Why Capacitor?

The current architecture requires a local Express server because **browsers cannot connect to the TV's self-signed WSS endpoint** (port 8002). Native code has no such restriction.

| | v1 (Current) | v2 (Capacitor) |
|---|---|---|
| Architecture | Browser → Express → TV | Native App → TV |
| Server required | Yes (Node.js on LAN) | No |
| Install method | Open URL + run server | Install APK / IPA |
| WebSocket to TV | Node.js `ws` library | Native WebSocket (no TLS restriction) |
| UI framework | SvelteKit (same) | SvelteKit (same) |

---

## Architecture

```
┌──────────────────────────────────────────┐
│ Capacitor App (Android / iOS)            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ WebView (SvelteKit PWA)            │  │
│  │  - Same UI components              │  │
│  │  - Calls Capacitor plugin bridge   │  │
│  └──────────────┬─────────────────────┘  │
│                 │ Capacitor Bridge        │
│  ┌──────────────▼─────────────────────┐  │
│  │ Native Plugin: SamsungTVPlugin     │  │
│  │  - Raw WebSocket (no cert check)   │  │
│  │  - Token persistence (Preferences) │  │
│  │  - Key/text/app commands           │  │
│  └──────────────┬─────────────────────┘  │
│                 │ WSS (port 8002)         │
└─────────────────┼────────────────────────┘
                  ▼
        ┌──────────────────┐
        │ Samsung TV       │
        │ (Tizen OS)       │
        └──────────────────┘
```

---

## Implementation Plan

### Step 1: Install Capacitor

```bash
pnpm add @capacitor/core @capacitor/cli
npx cap init "TV Remote" com.tvremote.app --web-dir build
pnpm add @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
```

**Config** (`capacitor.config.ts`):
```ts
import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.tvremote.app',
  appName: 'TV Remote',
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
};

export default config;
```

---

### Step 2: Create Native Plugin — `SamsungTVPlugin`

Create a Capacitor plugin that handles the WSS connection natively.

**Plugin Interface** (`src/lib/plugins/samsung-tv.ts`):
```ts
import { registerPlugin } from '@capacitor/core';

export interface SamsungTVPlugin {
  connect(options: { ip: string; token?: string }): Promise<{ name: string; token: string }>;
  disconnect(): Promise<void>;
  sendKey(options: { key: string }): Promise<void>;
  sendText(options: { text: string }): Promise<void>;
  launchApp(options: { appId: string }): Promise<void>;
  getStatus(): Promise<{ connected: boolean; device: string | null; detail?: string }>;
  addListener(event: 'statusChange', callback: (status: { connected: boolean; device: string | null }) => void): Promise<{ remove: () => void }>;
}

const SamsungTV = registerPlugin<SamsungTVPlugin>('SamsungTV');
export default SamsungTV;
```

**Android Implementation** (`android/src/main/java/.../SamsungTVPlugin.java`):
- Use `OkHttp` WebSocket client (ships with Android, no TLS restriction)
- `TrustAllCerts` SSL context for self-signed TV certs
- Token persistence via `SharedPreferences`
- Ping/pong keepalive (30s interval)
- Event emission to WebView on status change

**iOS Implementation** (`ios/Sources/.../SamsungTVPlugin.swift`):
- Use `URLSessionWebSocketTask` (iOS 13+)
- `URLSessionDelegate` with `didReceive challenge` to accept self-signed certs
- Token persistence via `UserDefaults`
- Same ping/pong + event pattern

---

### Step 3: Adapt `src/lib/api.ts`

Replace the HTTP/WS client with the Capacitor plugin bridge.

```ts
import { Capacitor } from '@capacitor/core';
import SamsungTV from './plugins/samsung-tv';

const isNative = Capacitor.isNativePlatform();

// If native, use plugin directly. If web, fall back to server API.
export const api = {
  connect: async (ip: string) => {
    if (isNative) {
      const result = await SamsungTV.connect({ ip });
      return { ok: true, result: `Connected to ${result.name}` };
    }
    return post('/api/connect', { ip });
  },

  disconnect: async () => {
    if (isNative) {
      await SamsungTV.disconnect();
      return { ok: true };
    }
    return post('/api/disconnect');
  },

  key: async (key: string) => {
    if (isNative) {
      await SamsungTV.sendKey({ key });
      return { ok: true };
    }
    return post('/api/key', { key });
  },

  text: async (text: string) => {
    if (isNative) {
      await SamsungTV.sendText({ text });
      return { ok: true };
    }
    return post('/api/text', { text });
  },

  launch: async (pkg: string) => {
    if (isNative) {
      await SamsungTV.launchApp({ appId: pkg });
      return { ok: true };
    }
    return post('/api/app/launch', { package: pkg });
  },

  status: async () => {
    if (isNative) {
      return SamsungTV.getStatus();
    }
    return get('/api/status');
  },
};
```

---

### Step 4: Adapt Status Socket

Replace WebSocket status polling with Capacitor event listener:

```ts
export function createStatusSocket(onStatus: (s: Status) => void): () => void {
  if (Capacitor.isNativePlatform()) {
    let listener: { remove: () => void } | null = null;
    SamsungTV.addListener('statusChange', onStatus).then(l => listener = l);
    return () => { listener?.remove(); };
  }

  // Existing WebSocket implementation for web fallback
  // ...
}
```

---

### Step 5: Remove Server URL from ConnectScreen

When running as a native app, the "Server URL" field is unnecessary. Hide it:

```svelte
{#if !isNative}
  <label class="field">
    <span>Server URL (leave empty if same origin)</span>
    <input type="url" ... />
  </label>
{/if}
```

---

### Step 6: Build & Sync

```bash
# Build SvelteKit static output
pnpm build

# Sync web assets to native projects
npx cap sync

# Open in Android Studio / Xcode
npx cap open android
npx cap open ios
```

**Android permissions** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

**iOS permissions** (`ios/App/App/Info.plist`):
- `NSLocalNetworkUsageDescription` — required for LAN access on iOS 14+

---

### Step 7: Optional Enhancements

| Feature | Plugin |
|---|---|
| TV discovery (SSDP/UPnP) | `@nicepayments/capacitor-ssdp` or custom |
| Haptic feedback | `@capacitor/haptics` (replace `navigator.vibrate`) |
| Keep screen on | `@capacitor-community/keep-awake` |
| App icon & splash | `@capacitor/assets` |
| Local notifications | `@capacitor/local-notifications` (connection alerts) |

---

## Migration Strategy

### Phase 1: Dual-mode (recommended first step)
- Add Capacitor to existing project
- Use `Capacitor.isNativePlatform()` to branch between native plugin and server API
- Web version continues to work with the Express server
- Native version connects directly to TV

### Phase 2: Native plugin implementation
- Implement Android `SamsungTVPlugin` with OkHttp WebSocket
- Implement iOS `SamsungTVPlugin` with URLSession
- Test on real devices against actual Samsung TV

### Phase 3: Polish
- Add SSDP TV discovery (no manual IP entry)
- Native haptics
- App store assets (icon, splash, screenshots)
- Deep link support (`tvremote://connect?ip=x.x.x.x`)

---

## File Changes Summary

| Action | File |
|---|---|
| CREATE | `capacitor.config.ts` |
| CREATE | `src/lib/plugins/samsung-tv.ts` |
| CREATE | `android/src/.../SamsungTVPlugin.java` |
| CREATE | `ios/Sources/.../SamsungTVPlugin.swift` |
| MODIFY | `src/lib/api.ts` — add native bridge |
| MODIFY | `src/lib/components/ConnectScreen.svelte` — hide server URL on native |
| MODIFY | `package.json` — add Capacitor deps |
| KEEP | `server/` — unchanged, still works for web version |

---

## Key Decisions

1. **Keep web version working** — dual-mode, not a rewrite
2. **OkHttp for Android** — battle-tested, handles WSS with custom TrustManager
3. **URLSession for iOS** — native API, no third-party deps
4. **Token storage** — `SharedPreferences` (Android) / `UserDefaults` (iOS) via `@capacitor/preferences`
5. **Samsung key mapping** — move `KEY_MAP` to shared TypeScript (used by both web and native)
6. **Server stays** — the Express server remains for users who prefer the PWA/web approach
