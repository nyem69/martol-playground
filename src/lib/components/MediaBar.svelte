<script lang="ts">
  import { api } from '$lib/api';

  function send(key: string) {
    api.key(key);
    if (navigator.vibrate) navigator.vibrate(30);
  }
</script>

<div class="media-bar">
  <button onclick={() => send('KEYCODE_MEDIA_PREVIOUS')}>⏮</button>
  <button onclick={() => send('KEYCODE_MEDIA_REWIND')}>⏪</button>
  <button class="play" onclick={() => send('KEYCODE_MEDIA_PLAY_PAUSE')}>⏯</button>
  <button onclick={() => send('KEYCODE_MEDIA_FAST_FORWARD')}>⏩</button>
  <button onclick={() => send('KEYCODE_MEDIA_NEXT')}>⏭</button>
</div>

<style>
  .media-bar {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  button {
    flex: 1;
    max-width: 64px;
    padding: 0.6rem;
    font-size: 1.1rem;
  }
  .play { background: var(--accent); }
</style>
