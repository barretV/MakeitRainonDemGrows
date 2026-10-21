import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RainGame } from '../game/RainGame';
import { milestoneIsland, worldDef } from '../game/balance';
import { formatDew, walletDew, type HudModel } from '../game/state';
import { TWEAK_KNOBS } from '../tweak';
import { Bottle } from './Bottle';
import { HudDewIcon, HudPlantIcon } from './HudCurrencyIcons';
import { HudToast } from './HudToast';
import { UpgradeTree } from './UpgradeTree';

/** True on a touch-first device: no mouse, only fingers. */
function useTouchControls(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const fine = window.matchMedia('(any-pointer: fine)');
    const read = () => setTouch(query.matches && !fine.matches);
    read();
    query.addEventListener('change', read);
    fine.addEventListener('change', read);
    return () => {
      query.removeEventListener('change', read);
      fine.removeEventListener('change', read);
    };
  }, []);
  return touch;
}

function Key({ children }: { children: ReactNode }) {
  return <span className="hud-controls__key">{children}</span>;
}

/**
 * The control legend along the bottom row. Desktop shows the keys, touch shows
 * the two-stick scheme: one finger flies, a second finger turns the world.
 */
function ControlHints() {
  const touch = useTouchControls();
  return (
    <div className="hud-controls pixel" aria-label="Controls">
      {touch ? (
        <>
          <span className="hud-controls__item">
            <svg viewBox="0 0 16 16" className="hud-controls__glyph" aria-hidden>
              <path d="M8 1c2 3 3 5 3 7a3 3 0 1 1-6 0c0-2 1-4 3-7z" fill="currentColor" />
              <path d="M1 13c2-1 4-1 6 0M9 13c2-1 4-1 6 0" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
            Drag to fly
          </span>
          <span className="hud-controls__item">
            <svg viewBox="0 0 16 16" className="hud-controls__glyph" aria-hidden>
              <path d="M13 8a5 5 0 1 1-2-4" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M11 1v4h-4" stroke="currentColor" strokeWidth="1.6" fill="none" />
            </svg>
            Two fingers to turn
          </span>
        </>
      ) : (
        <>
          <span className="hud-controls__item">
            <Key>W</Key>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key>
            Fly
          </span>
          <span className="hud-controls__item">
            <Key>Q</Key>
            <Key>E</Key>
            Turn
          </span>
        </>
      )}
    </div>
  );
}

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
  const pct = Math.min(100, Math.max(0, ratio * 100));
  if (pct >= 100) return '100%';
  if (pct <= 0) return '0%';
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

export function Hud({ model, game }: { model: HudModel; game: RainGame }) {
  const [gear, setGear] = useState(false);
  const playing = model.screen === 'play';
  const blooms = model.spendableBlooms;
  const dewNow = walletDew(model.dew);
  const bumpRef = useRef({ dew: dewNow, blooms, liters: model.liters });
  const bumpDew = dewNow > bumpRef.current.dew;
  const bumpBlooms = blooms > bumpRef.current.blooms;
  const bumpLiters = model.liters > bumpRef.current.liters;
  bumpRef.current = { dew: dewNow, blooms, liters: model.liters };
  const jugScale = 0.88 + Math.min(0.22, Math.max(0, (model.liters - 260) / 900) * 0.22);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <HudToast toasts={model.toasts} active={playing} />
      {playing && (
        <>
          <div
            className="hud-play-stack absolute top-[2%] left-[1.1%] z-10 select-none"
            style={{ transform: `translate(${TWEAK_KNOBS.hudOffsetX}px, ${TWEAK_KNOBS.hudOffsetY}px)` }}
          >
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
                <div className="hud-currency-strip__wallet">
                  <HudChip
                    display={formatDew(model.dew)}
                    icon={<HudDewIcon />}
                    ariaLabel={`${formatDew(model.dew)} dew`}
                    bump={bumpDew}
                  />
                  <HudChip
                    display={String(blooms)}
                    icon={<HudPlantIcon />}
                    ariaLabel={`${blooms} blooms`}
                    bump={bumpBlooms}
                  />
                </div>
                <div
                  className={`hud-chain pixel tabular-nums${model.chain > 1.05 ? '' : ' hud-chain--hidden'}`}
                  aria-hidden={model.chain <= 1.05}
                  aria-label={model.chain > 1.05 ? `Chain multiplier ${model.chain.toFixed(1)}` : undefined}
                >
                  <span className="hud-chain__x">x</span>
                  {model.chain.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
          <div className="hud-bottom-bar absolute bottom-[2.4%] left-[1.4%] flex items-end gap-2 select-none">
            <div
              className={`hud-reclaimed-chip pixel${model.revivalGlow > 0.2 ? ' hud-reclaimed-chip--glow' : ''}`}
              aria-label={`${model.worldName} ${formatPct(model.restored)} reclaimed`}
            >
              <span className="hud-reclaimed-chip__world">{model.worldName}</span>
              <span className="hud-reclaimed-chip__sep" aria-hidden>·</span>
              <span className="hud-reclaimed-chip__pct tabular-nums">{formatPct(model.restored)}</span>
              <span className="hud-reclaimed-chip__label">Reclaimed</span>
            </div>
            <ControlHints />
          </div>
          {model.patchesLeft > 0 && model.restored > 0.35 && model.restored < 0.99 && (
            <div className="hud-patches pixel" aria-label={`${model.pocketsLeft} spots left to restore`}>
              <span className="hud-patches__count tabular-nums">{model.pocketsLeft}</span>
              <span className="hud-patches__label">
                {model.pocketsLeft === 1 ? 'spot left' : 'spots left'}
              </span>
              {model.pocketsLeft > 1 && <span className="hud-patches__spots">follow the light</span>}
            </div>
          )}
          {model.nextGoal && (
            <div className="hud-goal pixel" aria-label={`Next: ${model.nextGoal.name}`}>
              <span className="hud-goal__label">Next</span>
              <span className="hud-goal__name">{model.nextGoal.name}</span>
              <span className="hud-goal__cost tabular-nums">
                {model.nextGoal.blooms > 0 ? `${model.nextGoal.blooms} blooms` : formatDew(model.nextGoal.cost)}
              </span>
              <span className="hud-goal__bar" aria-hidden>
                <span
                  className="hud-goal__fill"
                  style={{ transform: `scaleX(${model.nextGoal.progress.toFixed(3)})` }}
                />
              </span>
            </div>
          )}
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
            <CamBtn label="Rotate left" hint="Q" onClick={() => game.orbitCamera(-0.55)}>↺</CamBtn>
            <CamBtn label="Zoom in" hint="in" onClick={() => game.zoomCamera(-0.08)}>−</CamBtn>
            <CamBtn label="Zoom out" hint="out" onClick={() => game.zoomCamera(0.08)}>+</CamBtn>
            <CamBtn label="Rotate right" hint="E" onClick={() => game.orbitCamera(0.55)}>↻</CamBtn>
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
          <p className="menu-card__sub">WASD or arrows to fly. The cloud rains on its own. Drag anywhere on touch.</p>
          <div className="mt-3 flex gap-2">
            <Mini onClick={() => game.toggleSfx()}>{model.sfx ? 'SFX on' : 'SFX off'}</Mini>
            <Mini onClick={() => game.toggleMusic()}>{model.music ? 'Music on' : 'Music off'}</Mini>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <VolumeSlider
              label="Effects"
              value={model.sfxVolume}
              onChange={(value) => game.setSfxVolume(value)}
            />
            <VolumeSlider
              label="Music"
              value={model.musicVolume}
              onChange={(value) => game.setMusicVolume(value)}
            />
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
      {model.screen === 'start' && <Worlds model={model} game={game} start />}
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
  const [barsOn, setBarsOn] = useState(false);
  const barsFrame = useRef(0);
  const focusIdx = Math.min(focus, Math.max(0, actions.length - 1));
  const focusRef = useRef(focusIdx);
  focusRef.current = focusIdx;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const keyListenerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  const bindBars = useCallback((el: HTMLDivElement | null) => {
    cancelAnimationFrame(barsFrame.current);
    if (!el) {
      setBarsOn(false);
      return;
    }
    setBarsOn(false);
    barsFrame.current = requestAnimationFrame(() => setBarsOn(true));
  }, []);

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

  const islandAchievements = useMemo(
    () => model.achievements.filter((a) => a.island === model.worldIndex),
    [model.achievements, model.worldIndex],
  );

  return (
    <div ref={bindResultsVeil} className="menu-veil menu-veil--results pointer-events-auto" tabIndex={-1}>
      <div className="menu-card menu-card--pop results-card text-center">
        <div className="results-card__head">
          <div className="menu-card__title">{model.cleared ? 'A living world' : 'Bottle empty'}</div>
          <p className="menu-card__sub">{model.worldName}</p>
          <p className="menu-wallet">Wallet · {formatDew(model.dew)} dew</p>
          {model.runDew > 0 && (
            <p className="results-earned">
              Rain earned {formatDew(model.runDew)} dew
              {model.runBlooms > 0 ? ` · ${model.runBlooms} bloom${model.runBlooms > 1 ? 's' : ''}` : ''} · {model.runTiles}{' '}
              patches
            </p>
          )}
          <div className="results-stats">
            <Stat label="This bottle" value="" count={model.runDew} suffix=" dew" />
            <Stat
              label="Reached"
              value={pct}
              tag={model.newBest ? 'New best' : reached > 0.0005 && reached + 0.0005 >= model.best ? 'Personal best' : undefined}
              hot={model.newBest}
            />
            <Stat label="Best" value={best} />
          </div>
          <div className="results-actions" role="toolbar" aria-label="Results actions">
            {actions.map((action, i) => (
              <ResultsAction
                key={action.id}
                selected={i === focusIdx}
                onClick={() => {
                  focusRef.current = i;
                  setFocus(i);
                  game.audio.ui();
                  action.run();
                }}
              >
                {action.label}
              </ResultsAction>
            ))}
          </div>
          <p className="results-keyhint pixel" aria-hidden>A / D or arrows · Enter to choose</p>
        </div>
        {islandAchievements.length > 0 && (
          <div className="achievements-panel achievements-panel--sheet text-left" ref={bindBars}>
            <div className="results-ach-title">{model.worldName} milestones</div>
            <ul className="achievements-list achievements-list--stack">
              {islandAchievements.map((a) => {
                const ratio = a.goal > 0 ? Math.max(0, Math.min(1, a.current / a.goal)) : 0;
                return (
                  <li key={a.id} className={a.done ? 'ach-card ach-card--done' : 'ach-card'}>
                    <AchIcon id={a.id} />
                    <span className="ach-card__copy">
                      <span className="achievements-list__name">{a.name}</span>
                      <span className="achievements-list__desc">{a.desc}</span>
                      <span className="ach-meter" aria-hidden>
                        <span
                          className={barsOn ? 'ach-meter__fill ach-meter__fill--on' : 'ach-meter__fill'}
                          style={{ ['--p' as string]: String(a.done ? 1 : ratio) }}
                        />
                      </span>
                    </span>
                    <span className="ach-card__side">
                      {a.done ? (
                        <span className="achievements-list__check">Done</span>
                      ) : (
                        <span className="ach-card__count">{trackText(a.id, a.current, a.goal)}</span>
                      )}
                      {a.reward > 0 && <span className="ach-card__pay">+{a.reward}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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

function Worlds({ model, game, start = false }: { model: HudModel; game: RainGame; start?: boolean }) {
  const current = model.worlds.find((world) => world.current);
  return (
    <div className="menu-veil pointer-events-auto">
      <div className="menu-card menu-card--pop w-[min(480px,94%)]">
        <div className="menu-card__title text-center">{start ? 'Where should it rain?' : 'Worlds'}</div>
        <p className="menu-card__sub text-center">
          {start
            ? 'Pick a land. You keep the size you earned, and every island waits as you left it.'
            : 'A new land starts dead. You stay the size you earned.'}
        </p>
        <div className="mt-3 grid gap-2">
          {model.worlds.map((world) => (
            <button
              key={world.index}
              disabled={world.locked}
              onClick={() => {
                game.audio.ui();
                game.goto(world.index);
              }}
              className="menu-row"
            >
              <span>
                {world.name}
                {world.current ? ' · here' : ''}
              </span>
              <span>{world.locked ? 'Locked' : `${Math.min(100, Math.round(world.best * 100))}% best`}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 text-center">
          {start ? (
            <button
              type="button"
              className="menu-btn pixel w-full"
              onClick={() => {
                game.audio.ui();
                game.goto(current?.index ?? model.worldIndex);
              }}
            >
              Rain on {current?.name ?? model.worldName}
            </button>
          ) : (
            <Mini onClick={() => {
              game.audio.ui();
              game.showResults();
            }}>
              Back
            </Mini>
          )}
        </div>
      </div>
    </div>
  );
}

function trackText(id: string, current: number, goal: number): string {
  // The island milestones are all a share of the island, so they read as a
  // percentage of what is green.
  if (milestoneIsland(id)) {
    return `${Math.round(Math.min(1, Math.max(0, current)) * 100)}%`;
  }
  if (goal >= 1000) {
    const shown = Math.min(current, goal);
    const goalLabel = goal >= 10000 ? `${Math.round(goal / 1000)}K` : formatDew(goal);
    const nowLabel = shown >= 10000 ? `${Math.round(shown / 1000)}K` : formatDew(shown);
    return `${nowLabel}/${goalLabel}`;
  }
  return `${Math.min(goal, Math.floor(current))}/${goal}`;
}

function Stat({
  label,
  value,
  count,
  suffix,
  tag,
  hot,
}: {
  label: string;
  value: string;
  count?: number;
  suffix?: string;
  tag?: string;
  hot?: boolean;
}) {
  return (
    <div className="menu-stat">
      <div className="menu-stat__label">
        {label}
        {tag && <span className={hot ? 'results-best-tag results-best-tag--hot' : 'results-best-tag'}>{tag}</span>}
      </div>
      <div className="menu-stat__value pixel">
        {count !== undefined ? <CountUp value={count} suffix={suffix ?? ''} /> : value}
      </div>
    </div>
  );
}

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const [shown, setShown] = useState(0);
  const frame = useRef(0);
  const bind = useCallback((node: HTMLSpanElement | null) => {
    cancelAnimationFrame(frame.current);
    if (!node) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 850);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(value * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    setShown(0);
    frame.current = requestAnimationFrame(tick);
  }, [value]);
  return (
    <span ref={bind} className="results-countup tabular-nums">
      {formatDew(shown)}
      {suffix}
    </span>
  );
}

function AchIcon({ id }: { id: string }) {
  return (
    <span className="ach-ico" aria-hidden>
      <AchSvg id={id} />
    </span>
  );
}

function AchSvg({ id }: { id: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none' } as const;
  switch (id) {
    case 'gardener':
      return (
        <svg {...common}>
          <path d="M8 14V7" stroke="#b6ff7a" strokeWidth="2" />
          <path d="M8 8c0-3 2-5 5-5-1 3-3 5-5 5Z" fill="#7dce4a" />
          <path d="M8 9C8 6 6 4 3 4c1 3 3 5 5 5Z" fill="#d7f06a" />
        </svg>
      );
    case 'koi':
      return (
        <svg {...common}>
          <ellipse cx="7" cy="8" rx="5" ry="3" fill="#ff8fb8" />
          <path d="M12 8l3-3v6l-3-3Z" fill="#ffd0e2" />
          <circle cx="5" cy="7.5" r="0.8" fill="#1a1020" />
        </svg>
      );
    case 'money':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" fill="#ffe56a" />
          <path d="M8 4.5v7M6 6.2h3.2a1.4 1.4 0 0 1 0 2.8H6.8" stroke="#7a4e10" strokeWidth="1.3" />
        </svg>
      );
    case 'friend':
      return (
        <svg {...common}>
          <circle cx="5" cy="6" r="2" fill="#fff" />
          <circle cx="11" cy="6" r="2" fill="#fff" />
          <ellipse cx="8" cy="11" rx="4" ry="2.4" fill="#ffb3d0" />
        </svg>
      );
    case 'forest':
      return (
        <svg {...common}>
          <path d="M8 2l4 5H4l4-5Z" fill="#7dce4a" />
          <path d="M8 5l5 6H3l5-6Z" fill="#3f9a3a" />
          <path d="M7 11h2v3H7z" fill="#8d5a38" />
        </svg>
      );
    case 'frost':
      return (
        <svg {...common}>
          <path d="M8 2v12M3 4.5l10 7M13 4.5l-10 7" stroke="#d8f4ff" strokeWidth="1.6" />
        </svg>
      );
    case 'oasis':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3" fill="#ffe56a" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" stroke="#ffe56a" strokeWidth="1.3" />
        </svg>
      );
    case 'clean':
      return (
        <svg {...common}>
          <path d="M8 2l1.2 3.4H13l-2.8 2.2 1.1 3.4L8 9.8 4.7 11l1.1-3.4L3 5.4h3.8L8 2Z" fill="#d6ff7a" />
        </svg>
      );
    case 'band':
      return (
        <svg {...common}>
          <path d="M8 2c2 3 3 4.2 3 6a3 3 0 0 1-6 0c0-1.8 1-3 3-6Z" fill="#7ec8ff" />
        </svg>
      );
    case 'mogul':
      return (
        <svg {...common}>
          <path d="M2 12l2-7 2 3 2-5 2 5 2-3 2 7H2Z" fill="#ffe56a" />
        </svg>
      );
    case 'drip-check':
      return (
        <svg {...common}>
          <ellipse cx="8" cy="9" rx="5" ry="3" fill="#fff" />
          <ellipse cx="5" cy="8" rx="3" ry="2.4" fill="#fff" />
          <ellipse cx="11" cy="8" rx="3" ry="2.4" fill="#fff" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" fill="#7ec8f0" />
          <path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" stroke="#3f7fa8" strokeWidth="1" />
          <path d="M4 5.5c2-1.5 6-1.5 8 0" stroke="#b6ff7a" strokeWidth="1.6" />
        </svg>
      );
    default:
      // The island milestones: a little island with a cloud over it.
      return (
        <svg {...common}>
          <path d="M3 12h10l-2-3H5l-2 3Z" fill="#7dce4a" />
          <path d="M4.5 8.5h7a3.5 3.5 0 0 0-7 0Z" fill="#e8f4ff" />
        </svg>
      );
  }
}

function Mini({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="menu-btn pixel">
      {children}
    </button>
  );
}

/** A volume slider. The number is the percentage, because that is what people read. */
function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const pct = Math.round(value * 100);
  return (
    <label className="vol-row">
      <span className="vol-row__label pixel">{label}</span>
      <input
        className="vol-row__slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        aria-label={`${label} volume`}
        style={{ ['--fill' as string]: `${pct}%` }}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <span className="vol-row__value pixel tabular-nums">{pct}%</span>
    </label>
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
