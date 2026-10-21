/**
 * Fixed 16:9 design stage (1280×720) scaled uniformly to fit the window.
 * Layout never reflows; only --viewport-scale changes (same pattern as MashKin).
 */
export const DESIGN_W = 1280;
export const DESIGN_H = 720;

let syncing = false;

function isTouchUi(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Sync letterbox scale — call once #app-frame exists and on resize. */
export function syncGameFrame(): void {
  if (syncing) return;
  syncing = true;
  try {
    const root = document.documentElement;
    const frame = document.getElementById('app-frame');
    if (!frame) return;

    const r = frame.getBoundingClientRect();
    const fw = Math.max(1, frame.clientWidth);
    const fh = Math.max(1, frame.clientHeight);
    const scale = Math.min(fw / DESIGN_W, fh / DESIGN_H);

    root.classList.toggle('touch-design', isTouchUi());
    root.style.setProperty('--safe-top', `${Math.max(0, r.top)}px`);
    root.style.setProperty('--viewport-scale', String(scale));
    root.style.setProperty('--game-vh-px', `${DESIGN_H / 100}px`);

    window.dispatchEvent(new Event('resize'));
  } finally {
    syncing = false;
  }
}
