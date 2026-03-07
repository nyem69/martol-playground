<script lang="ts">
  import { api } from '$lib/api';

  // Samsung Tizen app IDs
  const apps = [
    { name: 'YouTube', pkg: '111299001912', icon: '▶' },
    { name: 'Netflix', pkg: '3201907018807', icon: 'N' },
    { name: 'Disney+', pkg: '3201901017640', icon: 'D' },
    { name: 'Prime', pkg: '3201910019365', icon: 'P' },
    { name: 'Spotify', pkg: '3201606009684', icon: '♫' },
    { name: 'Apple TV', pkg: '3201807016597', icon: 'A' },
  ];

  function launch(pkg: string) {
    api.launch(pkg);
    if (navigator.vibrate) navigator.vibrate(30);
  }
</script>

<div class="app-launcher">
  {#each apps as app}
    <button onclick={() => launch(app.pkg)} title={app.name}>
      <span class="icon">{app.icon}</span>
      <span class="label">{app.name}</span>
    </button>
  {/each}
</div>

<style>
  .app-launcher {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
    padding: 0 var(--gap);
  }
  button {
    flex-direction: column;
    gap: 2px;
    padding: 0.5rem 0.75rem;
    min-width: 56px;
    font-size: 0.75rem;
  }
  .icon { font-size: 1.3rem; }
  .label { font-size: 0.65rem; color: var(--text-muted); }
</style>
