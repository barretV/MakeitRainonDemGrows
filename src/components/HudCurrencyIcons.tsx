/** Pixel sprout + dew drop from the play HUD mockup (originally on the bottle gauge). */

export function HudDewIcon() {
  return (
    <svg viewBox="0 0 8 9" className="hud-chip__sprite" shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="0" width="2" height="2" fill="#7ec8f0" />
      <rect x="2" y="2" width="4" height="2" fill="#5ab4ec" />
      <rect x="1" y="4" width="6" height="3" fill="#3ea2e6" />
      <rect x="2" y="7" width="4" height="1" fill="#2f8fe0" />
      <rect x="2" y="4" width="1" height="2" fill="#d9f4ff" />
    </svg>
  );
}

export function HudPlantIcon({ className = 'hud-chip__sprite' }: { className?: string } = {}) {
  return (
    <svg viewBox="0 0 14 14" className={className} shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="9" width="8" height="3" fill="#8a5a36" />
      <rect x="2" y="10" width="10" height="2" fill="#6b4428" />
      <rect x="6" y="5" width="2" height="5" fill="#4caf3a" />
      <rect x="2" y="3" width="4" height="3" fill="#7dce4a" />
      <rect x="1" y="4" width="2" height="2" fill="#5cb83a" />
      <rect x="8" y="2" width="4" height="3" fill="#86d65a" />
      <rect x="11" y="3" width="2" height="2" fill="#5cb83a" />
    </svg>
  );
}
