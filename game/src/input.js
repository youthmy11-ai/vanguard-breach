// Keyboard, mouse, ADS, and pointer lock input handler with graceful fallback if PointerLock is rejected.
export function createInput(canvas, onLockChange, onAction) {
  const keys = new Set();
  const state = { keys, locked: false, active: false, firing: false, ads: false, lookX: 0, lookY: 0 };
  let wasLocked = false;

  function setKey(event, down) {
    if (down) {
      const firstPress = !keys.has(event.code);
      keys.add(event.code);
      if (firstPress && onAction) onAction(event.code);
    } else {
      keys.delete(event.code);
    }
    if (event.code === 'Space') event.preventDefault();
  }

  function requestLock() {
    try {
      if (document.pointerLockElement !== canvas && canvas.isConnected) {
        const res = canvas.requestPointerLock?.();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      }
    } catch {}
  }

  function exitLock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock?.();
    } catch {}
  }

  window.addEventListener('keydown', (event) => setKey(event, true));
  window.addEventListener('keyup', (event) => setKey(event, false));
  window.addEventListener('blur', () => {
    keys.clear();
    state.firing = false;
    state.ads = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (!state.locked && (!state.active || event.target !== canvas)) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.ads = true;
    if (!state.locked && state.active && event.target === canvas) requestLock();
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.ads = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    const nextLocked = document.pointerLockElement === canvas;
    state.locked = nextLocked;
    if (!nextLocked && wasLocked) {
      keys.clear();
      state.firing = false;
      state.ads = false;
    }
    if (nextLocked !== wasLocked) {
      wasLocked = nextLocked;
      onLockChange(nextLocked);
    }
  });
  document.addEventListener('pointerlockerror', () => {
    state.locked = false;
    state.firing = false;
    state.ads = false;
    wasLocked = false;
  });

  return {
    state,
    setActive(active) {
      state.active = Boolean(active);
      if (!state.active) {
        state.firing = false;
        state.ads = false;
      }
    },
    requestLock,
    exitLock,
    takeLook() {
      const x = state.lookX;
      const y = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { x, y };
    },
  };
}
