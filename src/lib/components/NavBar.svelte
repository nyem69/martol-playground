<script lang="ts">
  import { sendKey } from '$lib/api';
</script>

<div class="nav-bar" role="toolbar" aria-label="Navigation">
  <button onclick={() => sendKey('KEYCODE_BACK')} aria-label="Back">↩ Back</button>
  <button onclick={() => sendKey('KEYCODE_HOME')} aria-label="Home">⏺ Home</button>
  <button onclick={() => sendKey('KEYCODE_MENU')} aria-label="Menu">☰ Menu</button>
</div>

<style>
  .nav-bar {
    display: flex;
    gap: var(--gap);
    justify-content: center;
  }
  button {
    flex: 1;
    max-width: 120px;
    padding: 0.75rem;
    font-size: 0.9rem;
  }
</style>
