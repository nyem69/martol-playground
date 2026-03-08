<script lang="ts">
  import { sendKey } from '$lib/api';
</script>

<div class="volume-bar" role="toolbar" aria-label="Volume controls">
  <button onclick={() => sendKey('KEYCODE_VOLUME_DOWN')} aria-label="Volume down">🔉</button>
  <button class="mute" onclick={() => sendKey('KEYCODE_VOLUME_MUTE')} aria-label="Mute">🔇</button>
  <button onclick={() => sendKey('KEYCODE_VOLUME_UP')} aria-label="Volume up">🔊</button>
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
