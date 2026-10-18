import { useState, type ReactNode } from 'react';
import type { RainGame } from '../game/RainGame';
import { formatDew, walletDew, type HudModel } from '../game/state';
import { Bottle } from './Bottle';
import { HudDewIcon, HudPlantIcon } from './HudCurrencyIcons';
import { RevivalBar } from './RevivalBar';
import { UpgradeTree } from './UpgradeTree';

function HudChip({
  value,
  display,
  icon,
  ariaLabel,
}: {
  value: number;
  display: string;
  icon: ReactNode;
  ariaLabel: string;
}) {
  return (
    <div className="hud-chip pixel" aria-label={ariaLabel}>
      <span className="hud-chip__icon" aria-hidden>{icon}</span>
      <span key={value} className="hud-chip__amt tabular-nums">{display}</span>
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

  return (
    <div className="pointer-events-none absolute inset-0">
      {playing && (
        <>
          <div className="hud-play-stack absolute top-[2%] left-[1.1%] z-10 select-none">
            <div className="hud-play-top">
              <div className="hud-play-jug">
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
                  value={walletDew(model.dew)}
                  display={formatDew(model.dew)}
                  icon={<HudDewIcon />}
                  ariaLabel={`${formatDew(model.dew)} dew`}
                />
                <HudChip
                  value={model.runTiles}
                  display={String(model.runTiles)}
                  icon={<HudPlantIcon />}
                  ariaLabel={`${model.runTiles} plants this bottle`}
                />
              </div>
            </div>
            <RevivalBar pct={pct} />
          </div>
          <div
            className="pixel absolute bottom-[2.4%] left-[1.4%] select-none text-white"
            style={{ fontSize: 'clamp(13px, 1.7vw, 30px)', textShadow: '2px 2px 0 #2a1730, -1px -1px 0 #2a1730, 1px -1px 0 #2a1730, -1px 1px 0 #2a1730' }}
          >
            {model.worldName}: {formatPct(model.restored)} Reclaimed
          </div>
        </>
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
