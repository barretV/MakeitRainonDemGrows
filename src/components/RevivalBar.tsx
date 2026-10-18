import type { ReactNode } from 'react';

const CLOUD =
  'M18 36c-5 0-9-4-9-9 0-4 2-7 6-8-1-6 5-10 11-10 3 0 6 1 8 4 2-1 4-2 6-2 6 0 11 4 11 10 0 1 0 2-1 3 4 2 7 6 7 11 0 7-6 12-13 12H22c-7 0-13-5-13-11z';

function formatPct(ratio: number): string {
  const pct = ratio * 100;
  if (pct <= 0) return '0%';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

function CloudShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`revival-cloud${wide ? ' revival-cloud--wide' : ''}`}>
      <svg className="revival-cloud__svg" viewBox="0 0 72 48" aria-hidden>
        <path d={CLOUD} />
      </svg>
      <div className="revival-cloud__label pixel">{children}</div>
    </div>
  );
}

function SidePuff({ side, offset }: { side: 'left' | 'right'; offset: string }) {
  return (
    <svg
      className={`revival-side-puff revival-side-puff--${side}`}
      style={{ top: offset }}
      viewBox="0 0 40 24"
      aria-hidden
    >
      <path
        d="M10 16c-3 0-5-2-5-5 0-2 1-4 3-4-1-3 3-5 6-5 2 0 3 1 4 2 1-1 2-1 4-1 3 0 6 2 6 5 0 1 0 2 0 3 2 1 4 3 4 3 0 5-4 5-9H12c-4 0-7-3-7-6z"
        fill="#fff"
      />
    </svg>
  );
}

export function RevivalBar({ pct }: { pct: number }) {
  const fill = Math.max(2, Math.min(100, pct));
  const label = formatPct(pct / 100);

  return (
    <div className="revival-bar select-none">
      <CloudShell>
        World
        <br />
        Revival
      </CloudShell>

      <div className="revival-bar__column">
        <SidePuff side="left" offset="8%" />
        <SidePuff side="right" offset="22%" />
        <SidePuff side="left" offset="42%" />
        <SidePuff side="right" offset="58%" />
        <SidePuff side="left" offset="74%" />

        <div className="revival-bar__track">
          <div className="revival-bar__fill" style={{ height: `${fill}%` }}>
            <div className="revival-bar__pct-anchor">
              <CloudShell wide>{label}</CloudShell>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
