import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RainGame } from '../game/RainGame';
import { worldDef } from '../game/balance';
import { formatDew, walletDew, type HudModel } from '../game/state';
import { Bottle } from './Bottle';
import { HudDewIcon, HudPlantIcon } from './HudCurrencyIcons';
import { RevivalBar } from './RevivalBar';
import { UpgradeTree } from './UpgradeTree';

function HudChip({
  display,
  icon,
  ariaLabel,
  bump,
}: {
  display: string;
  icon: ReactNode;
  ariaLabel: string;
  bump?: boolean;
}) {
  return (
    <div className="hud-chip pixel" aria-label={ariaLabel}>
      <span className="hud-chip__icon" aria-hidden>{icon}</span>
      <span className={`hud-chip__amt tabular-nums${bump ? ' hud-chip__amt--bump' : ''}`}>{display}</span>
    </div>
  );
}

function formatPct(ratio: number): string {
  const pct = ratio * 100;
  if (pct <= 0) return '0%';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

export function Hud({ model, game }: { model: HudModel; game: RainGame }) {
  const [gear, setGear] = useState(false);
  const pct = model.restored * 100;
  const playing = model.screen === 'play';
  const plantTotal = model.stats.tiles;
  const dewNow = walletDew(model.dew);
  const bumpRef = useRef({ dew: dewNow, plants: plantTotal, liters: model.liters });
  const bumpDew = dewNow > bumpRef.current.dew;
  const bumpPlants = plantTotal > bumpRef.current.plants;
  const bumpLiters = model.liters > bumpRef.current.liters;
  bumpRef.current = { dew: dewNow, plants: plantTotal, liters: model.liters };
  const jugScale = 0.88 + Math.min(0.22, Math.max(0, (model.liters - 260) / 900) * 0.22);

  return (
    <div className="pointer-events-none absolute inset-0">
      {playing && (
        <>
          <div className="hud-play-stack absolute top-[2%] left-[1.1%] z-10 select-none">
            <div className="hud-play-top">
              <div
                className={`hud-play-jug${bumpLiters ? ' hud-play-jug--bump' : ''}`}
                style={{ transform: `scale(${jugScale})`, ['--jug-scale' as string]: String(jugScale) }}
              >
                <Bottle
                  tank={model.tank}
                  slosh={model.slosh}
                  raining={model.raining}
                  sleepy={model.sleepy}
                  liters={model.liters}
                />
              </div>
              <div className="hud-currency-strip">
                <HudChip
                  display={formatDew(model.dew)}
                  icon={<HudDewIcon />}
                  ariaLabel={`${formatDew(model.dew)} dew`}
                  bump={bumpDew}
                />
                <HudChip
                  display={String(plantTotal)}
                  icon={<HudPlantIcon />}
                  ariaLabel={`${plantTotal} plants grown`}
                  bump={bumpPlants}
                />
              </div>
            </div>
            <RevivalBar pct={pct} />
          </div>
          <div
            className={`hud-reclaimed-chip pixel absolute bottom-[2.4%] left-[1.4%] select-none${model.revivalGlow > 0.2 ? ' hud-reclaimed-chip--glow' : ''}`}
            aria-label={`${model.worldName} ${formatPct(model.restored)} reclaimed`}
          >
            <span className="hud-reclaimed-chip__world">{model.worldName}</span>
            <span className="hud-reclaimed-chip__sep" aria-hidden>·</span>
            <span className="hud-reclaimed-chip__pct tabular-nums">{formatPct(model.restored)}</span>
            <span className="hud-reclaimed-chip__label">Reclaimed</span>
          </div>
        </>
      )}

      {model.phase === 'finale' && (
        <div className="finale-veil pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center select-none">
          <div className="finale-banner pixel">
            <span className="finale-banner__spark" aria-hidden>✦</span>
            <span className="finale-banner__pct tabular-nums">100%</span>
            <span className="finale-banner__title">Land Restored</span>
            <span className="finale-banner__sub">{model.worldName}</span>
          </div>
          <div className="finale-progress pixel" aria-hidden>
            <div className="finale-progress__fill" style={{ transform: `scaleX(${Math.max(0.04, model.finaleProgress)})` }} />
          </div>
          <button
            type="button"
            className="finale-skip pixel pointer-events-auto"
            onClick={() => game.skipFinale()}
          >
            Skip
          </button>
        </div>
      )}

      {playing && model.nextAbility && (
        <div
          className="hud-ability-telegraph pointer-events-none absolute top-[18%] right-[2%] select-none"
          aria-hidden
        >
          <div
            className="hud-ability-telegraph__ring"
            style={{
              background: `conic-gradient(var(--color-primary) ${model.abilityCdNorm * 360}deg, rgba(0,0,0,0.45) 0deg)`,
            }}
          />
          <span className="hud-ability-telegraph__label">{model.nextAbility}</span>
        </div>
      )}

      {playing && (
        <div className="hud-cam-rig pointer-events-auto absolute top-[2.6%] right-[2%] z-20 flex flex-col items-end gap-1.5 select-none">
          <div className="hud-cam-rig__cluster pixel" role="toolbar" aria-label="Camera">
            <CamBtn label="Rotate left" hint="Q" onClick={() => game.orbitCamera(0.11)}>↺</CamBtn>
            <CamBtn label="Zoom in" hint="in" onClick={() => game.zoomCamera(-0.08)}>−</CamBtn>
            <CamBtn label="Zoom out" hint="out" onClick={() => game.zoomCamera(0.08)}>+</CamBtn>
            <CamBtn label="Rotate right" hint="E" onClick={() => game.orbitCamera(-0.11)}>↻</CamBtn>
          </div>
          <button
            className="menu-gear hud-cam-rig__gear"
            onClick={() => setGear((v) => !v)}
            aria-label="Settings"
          >
            <GearIcon />
          </button>
        </div>
      )}

      {gear && playing && (
        <div className="menu-card menu-card--pop pointer-events-auto absolute top-[12%] right-[2%] w-[260px] text-left">
          <div className="menu-card__title">Settings</div>
          <p className="menu-card__sub">WASD or arrows to fly. Space or click to rain. Drag anywhere on touch.</p>
          <div className="mt-3 flex gap-2">
            <Mini onClick={() => game.toggleSfx()}>{model.sfx ? 'SFX on' : 'SFX off'}</Mini>
            <Mini onClick={() => game.toggleMusic()}>{model.music ? 'Music on' : 'Music off'}</Mini>
          </div>
          <p className="menu-card__sub mt-3">Full wipe needs Reset below (browser cache alone keeps saved dew).</p>
          <button
            type="button"
            className="menu-row mt-2 w-full border-red-400/30 text-red-200"
            onClick={() => {
              if (!window.confirm('Reset all progress? Dew, upgrades, and worlds will be wiped.')) return;
              void game.reset();
              setGear(false);
            }}
          >
            Reset all progress
          </button>
        </div>
      )}

      {model.screen === 'results' && <Results model={model} game={game} />}
      {model.screen === 'workshop' && <UpgradeTree model={model} game={game} />}
      {model.screen === 'worlds' && <Worlds model={model} game={game} />}
    </div>
  );
}

function Results({ model, game }: { model: HudModel; game: RainGame }) {
  const reached = Math.max(model.runReached, model.restored);
  const pct = formatPct(reached);
  const best = formatPct(Math.max(model.best, reached));
  const actions = useMemo(
    () => {
      const list: Array<{ id: string; label: string; run: () => void }> = [];
      if (model.cleared && model.canNext && !model.nextLocked) {
        const next = worldDef(model.worldIndex + 1);
        list.push({ id: 'next', label: `Next · ${next.name}`, run: () => game.advance() });
      }
      list.push(
        { id: 'rain', label: 'Rain again', run: () => game.retry() },
        { id: 'workshop', label: 'Workshop', run: () => game.openWorkshop() },
      );
      if (model.cleared) list.push({ id: 'worlds', label: 'Worlds', run: () => game.openWorlds() });
      return list;
    },
    [model.cleared, model.canNext, model.nextLocked, model.worldIndex, game],
  );
  const [focus, setFocus] = useState(0);
  const focusIdx = Math.min(focus, Math.max(0, actions.length - 1));
  const focusRef = useRef(focusIdx);
  focusRef.current = focusIdx;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const keyListenerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  const bindResultsVeil = useCallback((el: HTMLDivElement | null) => {
    if (keyListenerRef.current) {
      window.removeEventListener('keydown', keyListenerRef.current);
      keyListenerRef.current = null;
    }
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const acts = actionsRef.current;
      if (!acts.length) return;
      const next = (delta: number) => {
        const i = (focusRef.current + delta + acts.length) % acts.length;
        focusRef.current = i;
        setFocus(i);
      };
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        next(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        next(-1);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        acts[focusRef.current]?.run();
      }
    };
    keyListenerRef.current = onKey;
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => el.focus({ preventScroll: true }));
  }, []);

  return (
    <div ref={bindResultsVeil} className="menu-veil pointer-events-auto" tabIndex={-1}>
      <div className="menu-card menu-card--pop results-card text-center">
        <div className="menu-card__title">{model.cleared ? 'A living world' : 'Bottle empty'}</div>
        <p className="menu-card__sub">{model.worldName}</p>
        <p className="menu-wallet">Wallet · {formatDew(model.dew)} dew</p>
        {model.runDew > 0 && model.runTiles > 0 && (
          <p className="menu-card__sub mt-1">Rain earned {formatDew(model.runDew)} dew · {model.runTiles} blooms</p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="This bottle" value={`${formatDew(model.runDew)} dew`} />
          <Stat label="Reached" value={pct} />
          <Stat label="Best" value={best} />
        </div>
        <div className="results-actions mt-4" role="toolbar" aria-label="Results actions">
          {actions.map((action, i) => (
            <ResultsAction
              key={action.id}
              selected={i === focusIdx}
              onClick={() => {
                focusRef.current = i;
                setFocus(i);
                action.run();
              }}
            >
              {action.label}
            </ResultsAction>
          ))}
        </div>
        <p className="results-keyhint pixel" aria-hidden>A / D or arrows · Enter to choose</p>
        <div className="achievements-panel achievements-panel--sheet mt-4 text-left">
          <div className="menu-card__title text-sm">Achievements</div>
          <ul className="achievements-list achievements-list--grid">
            {model.achievements.map((a) => (
              <li key={a.id} className={a.done ? 'achievements-list__done' : ''}>
                <span className="achievements-list__name">{a.name}</span>
                <span className="achievements-list__desc">{a.desc}</span>
                {a.done && <span className="achievements-list__check">Done</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResultsAction({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`menu-btn pixel results-action${selected ? ' results-action--focus' : ''}`}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

function Worlds({ model, game }: { model: HudModel; game: RainGame }) {
  return (
    <div className="menu-veil pointer-events-auto">
      <div className="menu-card menu-card--pop w-[min(480px,94%)]">
        <div className="menu-card__title text-center">Worlds</div>
        <p className="menu-card__sub text-center">A new land starts dead. You stay the size you earned.</p>
        <div className="mt-3 grid gap-2">
          {model.worlds.map((world) => (
            <button
              key={world.index}
              disabled={world.locked}
              onClick={() => game.goto(world.index)}
              className="menu-row"
            >
              <span>
                {world.name}
                {world.current ? ' · here' : ''}
              </span>
              <span>{world.locked ? 'Locked' : `${Math.round(world.best * 100)}% best`}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Mini onClick={() => game.showResults()}>Back</Mini>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="menu-stat">
      <div className="menu-stat__label">{label}</div>
      <div className="menu-stat__value pixel">{value}</div>
    </div>
  );
}

function Mini({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="menu-btn pixel">
      {children}
    </button>
  );
}

function CamBtn({
  children,
  label,
  hint,
  onClick,
}: {
  children: string;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="hud-cam-btn" aria-label={label} onClick={onClick}>
      <span className="hud-cam-btn__glyph" aria-hidden>{children}</span>
      <span className="hud-cam-btn__hint" aria-hidden>{hint}</span>
    </button>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path
        fill="#f2cf78"
        d="M9.2 1.5h3.6l.4 2.2a7 7 0 0 1 1.6.7l2-1 2.5 2.5-1 2a7 7 0 0 1 .7 1.6l2.2.4v3.6l-2.2.4a7 7 0 0 1-.7 1.6l1 2-2.5 2.5-2-1a7 7 0 0 1-1.6.7l-.4 2.2H9.2l-.4-2.2a7 7 0 0 1-1.6-.7l-2 1-2.5-2.5 1-2a7 7 0 0 1-.7-1.6l-2.2-.4V8.4l2.2-.4a7 7 0 0 1 .7-1.6l-1-2L5.2 2.4l2 1a7 7 0 0 1 1.6-.7l.4-2.2Zm1.8 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      />
    </svg>
  );
}
