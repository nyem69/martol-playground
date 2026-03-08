import { describe, it, expect } from 'vitest';
import { KEY_MAP } from './samsung.js';

// We test samsung.ts exports that don't require a real WebSocket connection.
// connect/sendKey/sendText/launchApp need a real TV, so we test validation
// by importing fresh modules with mocked dependencies.

// ─── KEY_MAP Tests ──────────────────────────────────────────────────────────

describe('KEY_MAP', () => {
  it('maps all D-pad keys', () => {
    expect(KEY_MAP.KEYCODE_DPAD_UP).toBe('KEY_UP');
    expect(KEY_MAP.KEYCODE_DPAD_DOWN).toBe('KEY_DOWN');
    expect(KEY_MAP.KEYCODE_DPAD_LEFT).toBe('KEY_LEFT');
    expect(KEY_MAP.KEYCODE_DPAD_RIGHT).toBe('KEY_RIGHT');
    expect(KEY_MAP.KEYCODE_DPAD_CENTER).toBe('KEY_ENTER');
  });

  it('maps navigation keys', () => {
    expect(KEY_MAP.KEYCODE_BACK).toBe('KEY_RETURN');
    expect(KEY_MAP.KEYCODE_HOME).toBe('KEY_HOME');
    expect(KEY_MAP.KEYCODE_MENU).toBe('KEY_MENU');
  });

  it('maps volume keys', () => {
    expect(KEY_MAP.KEYCODE_VOLUME_UP).toBe('KEY_VOLUP');
    expect(KEY_MAP.KEYCODE_VOLUME_DOWN).toBe('KEY_VOLDOWN');
    expect(KEY_MAP.KEYCODE_VOLUME_MUTE).toBe('KEY_MUTE');
  });

  it('maps media keys', () => {
    expect(KEY_MAP.KEYCODE_MEDIA_PLAY_PAUSE).toBe('KEY_PLAY');
    expect(KEY_MAP.KEYCODE_MEDIA_PAUSE).toBe('KEY_PAUSE');
    expect(KEY_MAP.KEYCODE_MEDIA_REWIND).toBe('KEY_REWIND');
    expect(KEY_MAP.KEYCODE_MEDIA_FAST_FORWARD).toBe('KEY_FF');
    expect(KEY_MAP.KEYCODE_MEDIA_PREVIOUS).toBe('KEY_REWIND_');
    expect(KEY_MAP.KEYCODE_MEDIA_NEXT).toBe('KEY_FF_');
  });

  it('maps power key', () => {
    expect(KEY_MAP.KEYCODE_POWER).toBe('KEY_POWER');
  });

  it('has exactly 18 mappings', () => {
    expect(Object.keys(KEY_MAP)).toHaveLength(18);
  });

  it('all values are valid Samsung KEY_ codes', () => {
    for (const val of Object.values(KEY_MAP)) {
      expect(val).toMatch(/^KEY_/);
    }
  });
});

// ─── IP Validation Tests (via connect) ──────────────────────────────────────

describe('connect — IP validation', () => {
  it('rejects invalid IP format', async () => {
    const { connect } = await import('./samsung.js');
    await expect(connect('not-an-ip')).rejects.toThrow('Invalid IP address');
  });

  it('rejects loopback address', async () => {
    const { connect } = await import('./samsung.js');
    await expect(connect('127.0.0.1')).rejects.toThrow('Invalid IP address');
  });

  it('rejects IP with octet > 255', async () => {
    const { connect } = await import('./samsung.js');
    await expect(connect('192.168.1.999')).rejects.toThrow('Invalid IP address');
  });

  it('rejects empty string', async () => {
    const { connect } = await import('./samsung.js');
    await expect(connect('')).rejects.toThrow('Invalid IP address');
  });
});

// ─── sendKey — validation (not connected) ───────────────────────────────────

describe('sendKey — not connected', () => {
  it('throws when not connected', async () => {
    const { sendKey } = await import('./samsung.js');
    await expect(sendKey('KEY_UP')).rejects.toThrow('Not connected to TV');
  });
});

// ─── sendText — validation (not connected) ──────────────────────────────────

describe('sendText — not connected', () => {
  it('throws when not connected', async () => {
    const { sendText } = await import('./samsung.js');
    await expect(sendText('hello')).rejects.toThrow('Not connected to TV');
  });
});

// ─── launchApp — validation (not connected) ─────────────────────────────────

describe('launchApp — not connected', () => {
  it('throws when not connected', async () => {
    const { launchApp } = await import('./samsung.js');
    await expect(launchApp('111299001912')).rejects.toThrow('Not connected to TV');
  });
});

// ─── getStatus — disconnected state ─────────────────────────────────────────

describe('getStatus — disconnected', () => {
  it('returns disconnected status', async () => {
    const { getStatus } = await import('./samsung.js');
    const status = await getStatus();
    expect(status.connected).toBe(false);
  });
});

// ─── disconnect — always succeeds ───────────────────────────────────────────

describe('disconnect', () => {
  it('returns Disconnected even when not connected', async () => {
    const { disconnect } = await import('./samsung.js');
    const result = await disconnect();
    expect(result).toBe('Disconnected');
  });
});
