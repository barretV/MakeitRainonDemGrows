import { useState } from 'react';
import type { RainGame } from '../game/RainGame';
import { formatDew, type HudModel } from '../game/state';
import { Bottle } from './Bottle';
import { UpgradeTree } from './UpgradeTree';

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
          <div className="absolute top-[2%] left-[1.1%] z-10 flex w-[34%] items-start gap-[2%] select-none">
            <Revival pct={pct} />
            <div className="min-w-0 flex-1">
              <Bottle
                tank={model.tank}
                slosh={model.slosh}
                raining={model.raining}
                sleepy={model.sleepy}
                liters={model.liters}
              />
            </div>
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
          className="pointer-events-auto absolute top-[3%] right-[2%] grid h-11 w-11 place-items-center rounded-full border-4 border-[#2a1730] bg-[#fff6fb] text-[20px] text-[#3a2444] shadow"
          onClick={() => setGear((v) => !v)}
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      )}

      {gear && playing && (
        <div className="pointer-events-auto absolute top-[12%] right-[2%] w-[240px] rounded-[18px] border-4 border-[#2a1730] bg-[#fff7fb] p-3 text-[#3a2444] shadow-xl">
          <div className="pixel text-[18px]">Settings</div>
          <p className="mt-2 text-[13px] leading-snug">
            WASD or arrows to fly. Space or click to rain. Drag anywhere on touch.
          </p>
          <div className="mt-3 flex gap-2">
            <Mini onClick={() => game.toggleSfx()}>{model.sfx ? 'SFX on' : 'SFX off'}</Mini>
            <Mini onClick={() => game.toggleMusic()}>{model.music ? 'Music on' : 'Music off'}</Mini>
          </div>
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
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-[#1a1028]/55 p-4">
      <div className="w-[min(440px,92%)] rounded-[18px] border-[6px] border-[#2a1730] bg-[#fff6fb] p-4 text-center text-[#3a2444] shadow-[0_8px_0_#2a1730]">
        <div className="pixel text-[32px] leading-none text-[#ff7aa2] [-webkit-text-stroke:4px_#2a1730]">
          {model.cleared ? 'Land restored' : 'Bottle empty'}
        </div>
        <p className="mt-2 text-[15px]">{model.worldName}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          <Stat label="This run" value={`${formatDew(model.runDew)} dew`} />
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
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-[#1a1028]/60 p-4">
      <div className="w-[min(480px,94%)] rounded-[18px] border-[6px] border-[#2a1730] bg-[#fff6fb] p-4 text-[#3a2444]">
        <div className="pixel text-center text-[28px] text-[#ff7aa2]">Worlds</div>
        <p className="mt-1 text-center text-[13px]">A new land starts dead. You stay the size you earned.</p>
        <div className="mt-3 grid gap-2">
          {model.worlds.map((world) => (
            <button
              key={world.index}
              disabled={world.locked}
              onClick={() => game.goto(world.index)}
              className="flex items-center justify-between rounded-2xl border-4 border-[#2a1730] bg-white px-3 py-2 text-left disabled:opacity-40"
            >
              <span>
                {world.name}
                {world.current ? ' · here' : ''}
              </span>
              <span className="text-[12px]">{world.locked ? 'Locked' : `${Math.round(world.best * 100)}% best`}</span>
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
    <div className="rounded-xl border-[3px] border-[#2a1730] bg-white px-2 py-2">
      <div className="text-[11px] uppercase tracking-wide text-[#a05a86]">{label}</div>
      <div className="pixel text-[16px]">{value}</div>
    </div>
  );
}

function Revival({ pct }: { pct: number }) {
  return (
    <div className="relative flex w-[18%] shrink-0 flex-col items-center">
      <div
        className="pixel mb-[4%] rounded-full bg-white/90 px-[8%] py-[10%] text-center leading-none text-[#5a6ad4]"
        style={{ fontSize: 'clamp(7px, 0.7vw, 13px)' }}
      >
        World
        <br />
        Revival
      </div>
      <div className="relative h-[32vh] w-[42%]">
        <div className="absolute inset-0 rounded-full border-[3px] border-white bg-white/40 shadow-[0_0_0_2px_rgba(42,23,48,0.25)]" />
        <div
          className="absolute inset-x-[3px] bottom-[3px] rounded-full"
          style={{
            height: `${Math.max(8, Math.min(100, pct))}%`,
            background: 'linear-gradient(#f48fb1, #ffd54f, #8be08a, #4fc3f7, #b39ddb)',
          }}
        />
        <CloudPuff className="absolute top-[22%] -left-[70%] h-5 w-8" />
        <CloudPuff className="absolute bottom-[18%] -left-[70%] h-5 w-8" />
      </div>
      <div
        className="pixel mt-[8%] text-white"
        style={{ fontSize: 'clamp(11px, 1.2vw, 22px)', textShadow: '1px 1px 0 #2a1730, -1px -1px 0 #2a1730' }}
      >
        {formatPct(pct / 100)}
      </div>
    </div>
  );
}

function CloudPuff({ className }: { className: string }) {
  const paint = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 28;
    canvas.height = 18;
    ctx.clearRect(0, 0, 28, 18);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(14, 11, 12, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(8, 12, 6, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(20, 11, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  return <canvas ref={paint} className={`${className} [image-rendering:pixelated]`} />;
}

function Mini({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pixel rounded-full border-4 border-[#2a1730] bg-[#ffe56a] px-3 py-1 text-[14px] text-[#3a2444] active:scale-95"
    >
      {children}
    </button>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path
        fill="#3a2444"
        d="M9.2 1.5h3.6l.4 2.2a7 7 0 0 1 1.6.7l2-1 2.5 2.5-1 2a7 7 0 0 1 .7 1.6l2.2.4v3.6l-2.2.4a7 7 0 0 1-.7 1.6l1 2-2.5 2.5-2-1a7 7 0 0 1-1.6.7l-.4 2.2H9.2l-.4-2.2a7 7 0 0 1-1.6-.7l-2 1-2.5-2.5 1-2a7 7 0 0 1-.7-1.6l-2.2-.4V8.4l2.2-.4a7 7 0 0 1 .7-1.6l-1-2L5.2 2.4l2 1a7 7 0 0 1 1.6-.7l.4-2.2Zm1.8 6a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      />
    </svg>
  );
}
