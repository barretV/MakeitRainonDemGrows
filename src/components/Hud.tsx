import { useRef, useState, type ReactNode } from 'react';
import type { RainGame } from '../game/RainGame';
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

      {playing && model.nextAbility && (
        <div
          className="hud-ability-telegraph pointer-events-none absolute top-[11%] right-[2%] select-none"
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
        <button
          className="menu-gear pointer-events-auto absolute top-[3%] right-[2%]"
          onClick={() => setGear((v) => !v)}
          aria-label="Settings"
        >
          <GearIcon />
        </button>
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
  return (
    <div className="menu-veil pointer-events-auto">
      <div className="menu-card menu-card--pop w-[min(460px,92%)] text-center">
        <div className="menu-card__title">{model.cleared ? 'Land restored' : 'Bottle empty'}</div>
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
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Mini onClick={() => game.retry()}>Rain again</Mini>
          <Mini onClick={() => game.openWorkshop()}>Workshop</Mini>
          {model.cleared && <Mini onClick={() => game.openWorlds()}>Worlds</Mini>}
        </div>
        <div className="achievements-panel mt-4 text-left">
          <div className="menu-card__title text-sm">Achievements</div>
          <ul className="achievements-list">
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
