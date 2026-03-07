<script lang="ts">
  import { api } from '$lib/api';

  const apps = [
    { name: 'YouTube', pkg: 'com.google.android.youtube.tv', icon: '▶' },
    { name: 'Netflix', pkg: 'com.netflix.ninja', icon: 'N' },
    { name: 'Disney+', pkg: 'com.disney.disneyplus', icon: 'D' },
    { name: 'Prime', pkg: 'com.amazon.amazonvideo.livingroom', icon: 'P' },
    { name: 'Spotify', pkg: 'com.spotify.tv.android', icon: '♫' },
    { name: 'Plex', pkg: 'com.plexapp.android', icon: '⏵' },
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
