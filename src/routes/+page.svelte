<script lang="ts">
  import { onMount } from 'svelte';
  import { api, createStatusSocket, type Status } from '$lib/api';
  import ConnectScreen from '$lib/components/ConnectScreen.svelte';
  import DPad from '$lib/components/DPad.svelte';
  import NavBar from '$lib/components/NavBar.svelte';
  import VolumeBar from '$lib/components/VolumeBar.svelte';
  import MediaBar from '$lib/components/MediaBar.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import AppLauncher from '$lib/components/AppLauncher.svelte';

  let connected = $state(false);
  let showConnect = $state(true);

  onMount(() => {
    const savedIp = localStorage.getItem('tv-ip');
    if (savedIp) {
      api.status().then((s: Status) => {
        if (s.connected) {
          connected = true;
          showConnect = false;
        }
      }).catch(() => {});
    }

    createStatusSocket((s) => {
      connected = s.connected;
    });
  });

  function handleConnected() {
    connected = true;
    showConnect = false;
  }

  function handlePower() {
    api.key('KEYCODE_POWER');
    if (navigator.vibrate) navigator.vibrate(50);
  }
</script>

{#if showConnect}
  <ConnectScreen onConnected={handleConnected} />
{:else}
  <div class="remote">
    <header>
      <button class="power" onclick={handlePower}>⏻</button>
      <div class="status" class:online={connected}>
        {connected ? 'Connected' : 'Disconnected'}
      </div>
      <button class="settings" onclick={() => showConnect = true}>⚙</button>
    </header>

    <div class="controls">
      <NavBar />
      <DPad />
      <VolumeBar />
      <MediaBar />
      <TextInput />
      <AppLauncher />
    </div>
  </div>
{/if}

<style>
  .remote {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 420px;
    margin: 0 auto;
    padding: var(--gap);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
  }
  .power, .settings {
    width: 44px;
    height: 44px;
    font-size: 1.3rem;
    border-radius: 50%;
  }
  .power { background: var(--accent); }
  .status {
    font-size: 0.8rem;
    color: var(--accent);
  }
  .status.online { color: #4ade80; }
  .controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    justify-content: space-evenly;
    overflow-y: auto;
  }
</style>
