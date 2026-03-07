<script lang="ts">
  import { api } from '$lib/api';

  let { onConnected }: { onConnected: () => void } = $props();

  let ip = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleConnect() {
    if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      error = 'Enter a valid IP address';
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
        error = res.error || 'Connection failed';
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
  <p class="subtitle">Enter your Android TV's IP address</p>

  <div class="input-group">
    <input
      type="text"
      inputmode="decimal"
      placeholder="192.168.1.x"
      bind:value={ip}
      onkeydown={(e) => e.key === 'Enter' && handleConnect()}
    />
    <button onclick={handleConnect} disabled={loading}>
      {loading ? 'Connecting...' : 'Connect'}
    </button>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <p class="hint">Make sure ADB debugging is enabled on your TV<br/>Settings → Device Preferences → Developer Options</p>
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
  .subtitle { color: var(--text-muted); }
  .input-group {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    max-width: 320px;
  }
  input {
    flex: 1;
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--bg-button);
    background: var(--bg-surface);
    color: var(--text);
    font-size: 1.1rem;
    text-align: center;
  }
  .input-group button {
    padding: 0.75rem 1.25rem;
    white-space: nowrap;
  }
  .error { color: var(--accent); }
  .hint { color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem; }
</style>
