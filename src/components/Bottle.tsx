import { useRef, useState } from 'react';
import { formatLiters } from '../game/state';

interface BottleProps {
  tank: number;
  slosh: number;
  raining: boolean;
  sleepy: boolean;
  liters: number;
}

const W = 64;
const H = 72;
const CX = 32;
const CY = 45;
const R = 24;

type Mood = 'joy' | 'idle' | 'worry' | 'sleep';

export function Bottle({ tank, slosh, raining, sleepy, liters }: BottleProps) {
  const live = useRef({ tank, slosh, raining, sleepy, shown: tank });
  live.current = { ...live.current, tank, slosh, raining, sleepy };
  const stop = useRef<(() => void) | null>(null);

  const [mount] = useState(() => (canvas: HTMLCanvasElement | null) => {
    stop.current?.();
    stop.current = null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const state = live.current;
      state.shown += (state.tank - state.shown) * 0.12;
      const mood: Mood = state.sleepy ? 'sleep' : state.raining ? 'joy' : state.tank < 0.25 ? 'worry' : 'idle';
      paint(img, (performance.now() - start) / 1000, state.shown, state.slosh, mood, state.raining);
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    stop.current = () => cancelAnimationFrame(raf);
  });

  const pct = Math.round(Math.max(0, Math.min(1, tank)) * 100);
  return (
    <div className="pointer-events-none relative flex items-start" style={{ width: '100%' }}>
      <div className="relative" style={{ width: '64%', aspectRatio: `${W} / ${H}` }}>
        <canvas ref={mount} width={W} height={H} className="absolute inset-0 h-full w-full [image-rendering:pixelated]" />
        <div
          className="pixel absolute inset-x-0 text-center leading-none text-white"
          style={{ top: '43%', fontSize: 'clamp(11px, 1.15vw, 22px)', textShadow: '0 0 2px #1e2a4a, 1px 1px 0 #1e2a4a, -1px 1px 0 #1e2a4a, 1px -1px 0 #1e2a4a, -1px -1px 0 #1e2a4a' }}
        >
          {formatLiters(liters)}
        </div>
      </div>
      <Gauge pct={pct} />
    </div>
  );
}

function Gauge({ pct }: { pct: number }) {
  return (
    <div className="relative ml-[2%]" style={{ width: '34%', aspectRatio: '34 / 76' }}>
      <svg viewBox="0 0 34 76" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="gauge-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8f59a" />
            <stop offset="50%" stopColor="#7fe6cf" />
            <stop offset="100%" stopColor="#8fb6ff" />
          </linearGradient>
        </defs>
        <path d="M5 70 Q 26 46 5 22" fill="none" stroke="#1e2a4a" strokeWidth="9.5" strokeLinecap="round" opacity="0.55" />
        <path d="M5 70 Q 26 46 5 22" fill="none" stroke="#eef8ff" strokeWidth="7.5" strokeLinecap="round" opacity="0.55" />
        <path
          d="M5 70 Q 26 46 5 22"
          fill="none"
          stroke="url(#gauge-fill)"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(0.01, pct)} 100`}
          style={{ transition: 'stroke-dasharray 200ms linear' }}
        />
      </svg>
      <div
        className="pixel absolute left-[30%] text-white"
        style={{ top: '88%', fontSize: 'clamp(10px, 0.95vw, 18px)', textShadow: '1px 1px 0 #1e2a4a, -1px 1px 0 #1e2a4a, 1px -1px 0 #1e2a4a, -1px -1px 0 #1e2a4a' }}
      >
        {pct}%
      </div>
    </div>
  );
}

function put(img: ImageData, x: number, y: number, r: number, g: number, b: number, a = 255): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

function hex(img: ImageData, x: number, y: number, color: number, a = 255): void {
  put(img, x, y, (color >> 16) & 255, (color >> 8) & 255, color & 255, a);
}

function inGlass(x: number, y: number): boolean {
  const dx = x + 0.5 - CX;
  const dy = y + 0.5 - CY;
  if (dx * dx + dy * dy <= R * R) return true;
  return x >= 26 && x <= 37 && y >= 12 && y <= 24;
}

function paint(img: ImageData, t: number, tank: number, slosh: number, mood: Mood, raining: boolean): void {
  img.data.fill(0);
  const fill = Math.max(0, Math.min(1, tank));
  const waterTop = CY + R - fill * (2 * R - 3) - 1;
  const chop = raining ? 1.1 : 0.55;

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const inside = inGlass(x, y);
      if (!inside) {
        if (inGlass(x - 1, y) || inGlass(x + 1, y) || inGlass(x, y - 1) || inGlass(x, y + 1)) hex(img, x, y, 0x2c3a6a);
        continue;
      }
      const rim = !inGlass(x - 1, y) || !inGlass(x + 1, y) || !inGlass(x, y - 1) || !inGlass(x, y + 1);
      const surface = waterTop + Math.sin(x * 0.38 + t * 3.1) * chop + (x - CX) * slosh * 0.22;
      const d = y - surface;
      if (fill > 0.005 && d >= 0 && y > 12) {
        const k = Math.min(1, (y - surface) / 30);
        let c = d < 1.2 ? 0xd2f6ff : d < 2.6 ? 0x8fe2ff : k < 0.45 ? 0x56c8ff : 0x3aa6f2;
        if (k >= 0.45 && k < 0.6 && (x + y) % 2 === 0) c = 0x56c8ff;
        if (k > 0.85) c = (x + y) % 2 === 0 ? 0x3aa6f2 : 0x2f8fe6;
        if (x > CX + 12) c = shade(c, 0.9);
        hex(img, x, y, c, rim ? 255 : 245);
      } else {
        hex(img, x, y, rim ? 0xf4fbff : 0xdcefff, rim ? 235 : 120);
      }
    }
  }

  for (let a = 3.5; a < 4.4; a += 0.035) {
    hex(img, Math.round(CX + Math.cos(a) * (R - 4)), Math.round(CY + Math.sin(a) * (R - 4)), 0xffffff, 230);
  }
  hex(img, CX - 13, CY + 6, 0xffffff, 200);
  hex(img, CX - 14, CY + 4, 0xffffff, 200);
  for (let y = 13; y < 23; y += 1) hex(img, 28, y, 0xffffff, 170);

  for (let y = 2; y < 13; y += 1) {
    const half = y < 4 ? 7 : 6;
    for (let x = CX - half; x < CX + half; x += 1) {
      const edge = x === CX - half || x === CX + half - 1 || y === 2 || y === 12;
      let c = y < 4 ? 0xe2ad72 : 0xc28650;
      if (!edge && (x * 7 + y * 3) % 9 === 0) c = 0x9a6436;
      if (!edge && y > 5 && (x + y) % 11 === 0) c = 0xd99c62;
      hex(img, x, y, edge ? 0x5a3420 : c);
    }
  }

  const faceY = CY + 6;
  const wet = waterTop < faceY - 4;
  const ink = wet ? 0x1e2a4a : 0x4a5578;
  const blink = Math.sin(t * 1.3) > 0.985;
  const eye = (ex: number) => {
    if (mood === 'sleep' || blink) {
      hex(img, ex - 1, faceY, ink);
      hex(img, ex, faceY, ink);
      hex(img, ex + 1, faceY, ink);
      return;
    }
    if (mood === 'joy') {
      hex(img, ex - 1, faceY, ink);
      hex(img, ex, faceY - 1, ink);
      hex(img, ex + 1, faceY, ink);
      return;
    }
    hex(img, ex, faceY - 1, ink);
    hex(img, ex + 1, faceY - 1, ink);
    hex(img, ex, faceY, ink);
    hex(img, ex + 1, faceY, ink);
    hex(img, ex, faceY - 1, 0xffffff);
  };
  eye(CX - 7);
  eye(CX + 6);
  const blush = wet ? 0xff8fb8 : 0xffb6cc;
  for (const bx of [CX - 11, CX - 10, CX + 10, CX + 11]) hex(img, bx, faceY + 2, blush);
  if (mood === 'worry') {
    hex(img, CX - 2, faceY + 4, ink);
    hex(img, CX - 1, faceY + 3, ink);
    hex(img, CX, faceY + 3, ink);
    hex(img, CX + 1, faceY + 4, ink);
  } else if (mood === 'sleep') {
    hex(img, CX - 1, faceY + 4, ink);
    hex(img, CX, faceY + 4, ink);
  } else {
    hex(img, CX - 2, faceY + 3, ink);
    hex(img, CX - 1, faceY + 4, ink);
    hex(img, CX, faceY + 4, ink);
    hex(img, CX + 1, faceY + 3, ink);
    if (mood === 'joy') hex(img, CX - 1 + ((t * 2) | 0) % 2, faceY + 5, 0xff6f9e);
  }

  const tw = Math.sin(t * 2.2) > 0.2;
  if (tw) {
    const sx = CX + 15;
    const sy = CY - 14;
    hex(img, sx, sy, 0xffffff);
    hex(img, sx - 1, sy, 0xffffff, 200);
    hex(img, sx + 1, sy, 0xffffff, 200);
    hex(img, sx, sy - 1, 0xffffff, 200);
    hex(img, sx, sy + 1, 0xffffff, 200);
  }
  for (let i = 0; i < 3; i += 1) {
    const by = Math.round(CY + R - 3 - ((t * (5 + i * 2) + i * 9) % Math.max(1, CY + R - waterTop - 4)));
    const bx = CX - 6 + i * 6;
    if (by > waterTop + 2 && fill > 0.05) hex(img, bx, by, 0xe8fbff, 200);
  }
}

function shade(c: number, k: number): number {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | b;
}
