<script lang="ts">
  import { api } from '$lib/api';

  function send(key: string) {
    api.key(key);
    if (navigator.vibrate) navigator.vibrate(30);
  }
</script>

<div class="volume-bar">
  <button onclick={() => send('KEYCODE_VOLUME_DOWN')}>🔉</button>
  <button class="mute" onclick={() => send('KEYCODE_VOLUME_MUTE')}>🔇</button>
  <button onclick={() => send('KEYCODE_VOLUME_UP')}>🔊</button>
</div>

<style>
  .volume-bar {
    display: flex;
    gap: var(--gap);
    justify-content: center;
  }
  button {
    flex: 1;
    max-width: 100px;
    padding: 0.75rem;
    font-size: 1.2rem;
  }
  .mute { background: var(--accent); }
</style>
