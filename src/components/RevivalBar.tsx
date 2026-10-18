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
      <svg className="revival-cloud__svg revival-cloud__svg--back" viewBox="0 0 72 48" aria-hidden>
        <path d={CLOUD} transform="translate(1,2)" opacity="0.35" />
      </svg>
      <svg className="revival-cloud__svg" viewBox="0 0 72 48" aria-hidden>
        <path d={CLOUD} />
      </svg>
      <div className="revival-cloud__label pixel">{children}</div>
    </div>
  );
}

function TrackMist() {
  return (
    <svg className="revival-bar__mist" viewBox="0 0 32 200" preserveAspectRatio="none" aria-hidden>
      <g fill="#fff" opacity="0.45">
        <ellipse cx="10" cy="28" rx="9" ry="5" />
        <ellipse cx="22" cy="52" rx="7" ry="4" />
        <ellipse cx="8" cy="78" rx="8" ry="4.5" />
        <ellipse cx="24" cy="104" rx="6" ry="3.5" />
        <ellipse cx="12" cy="132" rx="9" ry="5" />
        <ellipse cx="20" cy="162" rx="7" ry="4" />
        <ellipse cx="9" cy="188" rx="8" ry="4" />
      </g>
      <g fill="#fff" opacity="0.22">
        <ellipse cx="26" cy="38" rx="5" ry="3" />
        <ellipse cx="6" cy="118" rx="5" ry="3" />
        <ellipse cx="25" cy="178" rx="5" ry="3" />
      </g>
    </svg>
  );
}

export function RevivalBar({ pct }: { pct: number }) {
  const fill = Math.max(2, Math.min(100, pct));
  const label = formatPct(pct / 100);

  return (
    <div className="revival-bar select-none">
      <CloudShell>
        <span className="revival-cloud__title">World revival</span>
      </CloudShell>

      <div className="revival-bar__column">
        <div className="revival-bar__track">
          <div className="revival-bar__sky" />
          <TrackMist />
          <div className="revival-bar__shine" />
          <div className="revival-bar__fill" style={{ height: `${fill}%` }}>
            <div className="revival-bar__fill-shimmer" />
            <div className="revival-bar__pct-anchor">
              <CloudShell wide>{label}</CloudShell>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
