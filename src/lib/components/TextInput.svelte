<script lang="ts">
  import { api } from '$lib/api';

  let text = $state('');
  let sending = $state(false);

  async function handleSend() {
    if (!text.trim() || sending) return;
    sending = true;
    await api.text(text);
    text = '';
    sending = false;
  }
</script>

<div class="text-input">
  <input
    type="text"
    placeholder="Type text..."
    bind:value={text}
    onkeydown={(e) => e.key === 'Enter' && handleSend()}
  />
  <button onclick={handleSend} disabled={sending}>Send</button>
</div>

<style>
  .text-input {
    display: flex;
    gap: 8px;
    padding: 0 var(--gap);
  }
  input {
    flex: 1;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius);
    border: 1px solid var(--bg-button);
    background: var(--bg-surface);
    color: var(--text);
    font-size: 1rem;
  }
  button {
    padding: 0.6rem 1rem;
    white-space: nowrap;
  }
</style>
