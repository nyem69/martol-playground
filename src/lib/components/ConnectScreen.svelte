<script lang="ts">
  import { browser } from '$app/environment';
  import { api, setServerUrl, getServerUrl } from '$lib/api';

  let { onConnected }: { onConnected: () => void } = $props();

  let serverUrl = $state(getServerUrl());
  let ip = $state(browser ? (localStorage.getItem('tv-ip') || '') : '');
  let error = $state('');
  let loading = $state(false);

  async function handleConnect() {
    // Auto-prepend http:// if missing
    if (serverUrl && !serverUrl.match(/^https?:\/\//)) {
      serverUrl = 'http://' + serverUrl;
    }
    // Server URL is optional when served from same origin
    if (serverUrl) {
      setServerUrl(serverUrl);
    }
    if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      error = 'Enter a valid TV IP address';
      return;
    }
    loading = true;
    error = '';
    try {
      const res = await api.connect(ip);
      if (res.ok) {
        localStorage.setItem('tv-ip', ip);
        onConnected();
      } else {
        error = res.error || res.result || 'Connection failed';
      }
    } catch {
      error = 'Cannot reach server. Is it running?';
    } finally {
      loading = false;
    }
  }
</script>

<div class="connect-screen">
  <h1>TV Remote</h1>

  <label class="field">
    <span>Server URL (leave empty if same origin)</span>
    <input
      type="url"
      placeholder="same origin"
      aria-label="Server URL"
      bind:value={serverUrl}
    />
  </label>

  <label class="field">
    <span>TV IP Address</span>
    <input
      type="text"
      inputmode="decimal"
      placeholder="192.168.1.x"
      aria-label="TV IP address"
      aria-describedby={error ? 'connect-error' : undefined}
      bind:value={ip}
      onkeydown={(e) => e.key === 'Enter' && handleConnect()}
    />
  </label>

  <button class="connect-btn" onclick={handleConnect} disabled={loading}>
    {loading ? 'Connecting...' : 'Connect'}
  </button>

  {#if error}
    <p class="error" id="connect-error">{error}</p>
  {/if}

  <p class="hint">
    1. Run the server on your local network<br/>
    2. Enter the server's IP and port above<br/>
    3. Enter your Samsung TV's IP address
  </p>
</div>

<style>
  .connect-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100dvh;
    padding: 2rem;
    gap: 1rem;
    text-align: center;
  }
  h1 { font-size: 2rem; }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    max-width: 320px;
    text-align: left;
  }
  .field span {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding-left: 0.25rem;
  }
  input {
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--bg-button);
    background: var(--bg-surface);
    color: var(--text);
    font-size: 1rem;
    text-align: center;
  }
  .connect-btn {
    width: 100%;
    max-width: 320px;
    padding: 0.75rem;
    font-size: 1rem;
    background: var(--accent);
  }
  .error { color: var(--accent); }
  .hint { color: var(--text-muted); font-size: 0.8rem; margin-top: 1rem; line-height: 1.6; }
</style>
