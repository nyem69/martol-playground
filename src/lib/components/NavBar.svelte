<script lang="ts">
  import { api } from '$lib/api';

  function send(key: string) {
    api.key(key);
    if (navigator.vibrate) navigator.vibrate(30);
  }
</script>

<div class="nav-bar">
  <button onclick={() => send('KEYCODE_BACK')}>↩ Back</button>
  <button onclick={() => send('KEYCODE_HOME')}>⏺ Home</button>
  <button onclick={() => send('KEYCODE_MENU')}>☰ Menu</button>
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
