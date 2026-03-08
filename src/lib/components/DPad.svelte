<script lang="ts">
  import { sendKey } from '$lib/api';

  const KEYS = {
    up: 'KEYCODE_DPAD_UP',
    down: 'KEYCODE_DPAD_DOWN',
    left: 'KEYCODE_DPAD_LEFT',
    right: 'KEYCODE_DPAD_RIGHT',
    center: 'KEYCODE_DPAD_CENTER'
  };

  function send(dir: keyof typeof KEYS) {
    sendKey(KEYS[dir]);
  }

  let startX = 0, startY = 0;
  const THRESHOLD = 40;

  function onTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < THRESHOLD && absDy < THRESHOLD) {
      send('center');
      return;
    }
    if (absDx > absDy) {
      send(dx > 0 ? 'right' : 'left');
    } else {
      send(dy > 0 ? 'down' : 'up');
    }
  }

  function onKeydown(e: KeyboardEvent) {
    const map: Record<string, keyof typeof KEYS> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Enter: 'center',
    };
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      send(dir);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="dpad-container"
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
  onkeydown={onKeydown}
>
  <button class="dpad-btn up" onclick={() => send('up')} aria-label="Up">▲</button>
  <button class="dpad-btn left" onclick={() => send('left')} aria-label="Left">◀</button>
  <button
    class="dpad-btn center"
    onclick={() => send('center')}
    aria-label="OK"
  >OK</button>
  <button class="dpad-btn right" onclick={() => send('right')} aria-label="Right">▶</button>
  <button class="dpad-btn down" onclick={() => send('down')} aria-label="Down">▼</button>
</div>

<style>
  .dpad-container {
    display: grid;
    grid-template-areas:
      ".    up   ."
      "left ok   right"
      ".    down .";
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    gap: 6px;
    width: min(260px, 65vw);
    aspect-ratio: 1;
    margin: 0 auto;
  }
  .dpad-btn {
    font-size: 1.4rem;
    border-radius: 50%;
  }
  .up    { grid-area: up; }
  .down  { grid-area: down; }
  .left  { grid-area: left; }
  .right { grid-area: right; }
  .center {
    grid-area: ok;
    background: var(--accent);
    font-size: 1.2rem;
    font-weight: bold;
  }
</style>
