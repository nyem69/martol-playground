<script lang="ts">
  import { sendKey } from '$lib/api';
</script>

<div class="media-bar" role="toolbar" aria-label="Media controls">
  <button onclick={() => sendKey('KEYCODE_MEDIA_PREVIOUS')} aria-label="Previous track">⏮</button>
  <button onclick={() => sendKey('KEYCODE_MEDIA_REWIND')} aria-label="Rewind">⏪</button>
  <button class="play" onclick={() => sendKey('KEYCODE_MEDIA_PLAY_PAUSE')} aria-label="Play/Pause">⏯</button>
  <button onclick={() => sendKey('KEYCODE_MEDIA_FAST_FORWARD')} aria-label="Fast forward">⏩</button>
  <button onclick={() => sendKey('KEYCODE_MEDIA_NEXT')} aria-label="Next track">⏭</button>
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
    min-height: 44px;
    padding: 0.6rem;
    font-size: 1.1rem;
  }
  .play { background: var(--accent); }
</style>
