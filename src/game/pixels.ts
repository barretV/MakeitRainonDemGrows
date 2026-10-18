import * as THREE from 'three';
import { worldDef } from './balance';

class Pix {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  set(x: number, y: number, color: string): void {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(xi, yi, 1, 1);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 400; guard += 1) {
      this.set(x, y, color);
      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  shadeLower(tint: string, from: number): void {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const [r, g, b] = rgb(tint);
    const start = (from * this.h) | 0;
    for (let y = start; y < this.h; y += 1) {
      const k = (y - start) / Math.max(1, this.h - start);
      for (let x = 0; x < this.w; x += 1) {
        const i = (y * this.w + x) * 4;
        if ((img.data[i + 3] ?? 0) < 20) continue;
        img.data[i] = Math.round((img.data[i] ?? 0) * (1 - k * 0.45) + r * k * 0.45);
        img.data[i + 1] = Math.round((img.data[i + 1] ?? 0) * (1 - k * 0.45) + g * k * 0.45);
        img.data[i + 2] = Math.round((img.data[i + 2] ?? 0) * (1 - k * 0.45) + b * k * 0.45);
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  outline(color: string): void {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const marks: number[] = [];
    const filled = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      return (img.data[(y * this.w + x) * 4 + 3] ?? 0) > 20;
    };
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (!filled(x, y)) continue;
        if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) {
          marks.push(x, y);
        }
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.set(marks[i] ?? 0, marks[i + 1] ?? 0, color);
  }

  star(x: number, y: number, color: string): void {
    this.set(x, y, color);
    this.set(x - 1, y, color);
    this.set(x + 1, y, color);
    this.set(x, y - 1, color);
    this.set(x, y + 1, color);
    this.set(x, y - 2, '#fff');
  }
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function texOf(canvas: HTMLCanvasElement, smooth = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  tex.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function bake(draw: (p: Pix) => void, w: number, h: number, smooth = false): THREE.CanvasTexture {
  const pix = new Pix(w, h);
  draw(pix);
  return texOf(pix.canvas, smooth);
}

export type CloudMood = 'idle' | 'joy' | 'sleep' | 'grin' | 'pout' | 'blink';

function face(p: Pix, mood: CloudMood, cx: number, cy: number): void {
  const blush = mood === 'sleep' ? '#e7b7c4' : mood === 'grin' ? '#ff7aa2' : '#ff9bb8';
  p.ellipse(cx - 16, cy + 4, mood === 'grin' ? 5 : 4.2, mood === 'grin' ? 3.1 : 2.6, blush);
  p.ellipse(cx + 16, cy + 4, mood === 'grin' ? 5 : 4.2, mood === 'grin' ? 3.1 : 2.6, blush);
  if (mood === 'sleep') {
    p.line(cx - 8, cy, cx - 3, cy + 2, '#596174');
    p.line(cx + 8, cy, cx + 3, cy + 2, '#596174');
    p.ellipse(cx, cy + 7, 2.2, 1.6, '#7d8798');
    return;
  }
  if (mood === 'blink') {
    p.line(cx - 11, cy, cx - 6, cy, '#2b2b33');
    p.line(cx + 6, cy, cx + 11, cy, '#2b2b33');
    p.line(cx - 4, cy + 7, cx + 4, cy + 6, '#3a3038');
    return;
  }
  const eye = '#2b2b33';
  const tall = mood === 'grin' ? 3.8 : mood === 'pout' ? 3.6 : 3.3;
  p.ellipse(cx - 9, cy - 1, 2.4, tall, eye);
  p.ellipse(cx + 9, cy - 1, 2.4, tall, eye);
  p.set(cx - 10, cy - 2, '#fff');
  p.set(cx + 8, cy - 2, '#fff');
  if (mood === 'grin' || mood === 'joy') {
    p.line(cx - 6, cy + 5, cx, cy + 9, '#3a3038');
    p.line(cx, cy + 9, cx + 6, cy + 5, '#3a3038');
    p.ellipse(cx, cy + 8, mood === 'grin' ? 3.2 : 2.2, mood === 'grin' ? 2.2 : 1.4, '#ff8fab');
  } else if (mood === 'pout') {
    p.line(cx - 5, cy + 9, cx, cy + 7, '#3a3038');
    p.line(cx, cy + 7, cx + 5, cy + 9, '#3a3038');
  } else {
    p.line(cx - 3, cy + 6, cx + 3, cy + 7, '#3a3038');
  }
}

function drawCloud(mood: CloudMood): THREE.CanvasTexture {
  return bake((p) => {
    const fill = mood === 'sleep' ? '#d7dbe4' : mood === 'pout' ? '#f4f7fb' : '#ffffff';
    const blobs: Array<[number, number, number, number]> = [
      [48, 34, 24, 15],
      [28, 36, 15, 12],
      [68, 35, 16, 12],
      [40, 22, 14, 11],
      [58, 21, 14, 10],
      [22, 40, 10, 7],
      [40, 42, 12, 7],
      [58, 42, 12, 7],
      [74, 39, 9, 7],
    ];
    for (const [x, y, rx, ry] of blobs) p.ellipse(x, y, rx, ry, fill);
    p.shadeLower(mood === 'sleep' ? '#b7becc' : '#d7f1ff', 0.48);
    p.outline(mood === 'sleep' ? '#9aa3b5' : mood === 'pout' ? '#b9c6d6' : '#8ec8ea');
    face(p, mood, 48, 30);
    if (mood !== 'sleep' && mood !== 'pout') {
      p.star(12, 14, '#fff4b0');
      p.star(84, 16, '#fff');
      p.star(18, 48, '#d9f4ff');
      if (mood === 'joy') {
        p.star(8, 28, '#ffe27a');
        p.star(88, 34, '#fff');
      }
    }
  }, 96, 64);
}

function skyCanvas(top: string, mid: string, bot: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const g = ctx.createLinearGradient(0, 0, 0, 360);
  g.addColorStop(0, top);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 360);
  const puff = (x: number, y: number, rx: number, ry: number, a: number) => {
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  puff(90, 70, 80, 28, 0.16);
  puff(160, 84, 54, 22, 0.12);
  puff(300, 54, 96, 30, 0.14);
  puff(420, 78, 70, 22, 0.1);
  puff(520, 48, 50, 18, 0.1);
  ctx.fillStyle = 'rgba(255, 180, 210, 0.18)';
  ctx.beginPath();
  ctx.ellipse(480, 90, 70, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 210, 255, 0.16)';
  ctx.beginPath();
  ctx.ellipse(180, 120, 90, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  return texOf(canvas, true);
}

function drawBird(): THREE.CanvasTexture {
  return bake((p) => {
    p.line(4, 8, 12, 4, '#2b3344');
    p.line(12, 4, 20, 8, '#2b3344');
    p.line(10, 6, 14, 6, '#4a5568');
    p.set(13, 5, '#fff');
  }, 24, 14, true);
}

function drawMountain(): THREE.CanvasTexture {
  return bake((p) => {
    const peak = 118;
    for (let y = 0; y < p.h; y += 1) {
      const t = y / p.h;
      const halfL = t * 78;
      const halfR = t * 70;
      for (let x = 0; x < p.w; x += 1) {
        if (x < peak - halfL || x > peak + halfR) continue;
        const u = (x - (peak - halfL)) / Math.max(1, halfL + halfR);
        let color = u > 0.52 ? '#d5e3f2' : '#f7fbff';
        if (t > 0.58 && u < 0.42) color = '#c5d3e2';
        if (t > 0.74) color = '#b7c6d6';
        if ((x * 13 + y * 7) % 19 === 0 && t < 0.45) color = '#ffffff';
        p.set(x, y, color);
      }
    }
    const peak2 = 46;
    for (let y = 40; y < p.h; y += 1) {
      const t = (y - 40) / (p.h - 40);
      const half = t * 36;
      for (let x = 0; x < p.w; x += 1) {
        if (x < peak2 - half || x > peak2 + half * 0.75) continue;
        if (x > 70) continue;
        p.set(x, y, t > 0.7 ? '#c9d5e4' : '#eef5fb');
      }
    }
    p.outline('#9aafc4');
    p.star(112, 28, '#fff');
    p.star(130, 46, '#fff');
  }, 200, 130);
}

function drawHills(color: string, back: string): THREE.CanvasTexture {
  return bake((p) => {
    for (let i = 0; i < 8; i += 1) {
      const cx = 20 + i * 34;
      const cy = 58 + (i % 2) * 8;
      p.ellipse(cx, cy, 28, 18, i % 2 === 0 ? color : back);
    }
    p.outline('#ffffff22');
  }, 280, 80);
}

function groundTex(colors: string[], cracks: boolean): THREE.CanvasTexture {
  return bake((p) => {
    const base = colors[1] ?? colors[0] ?? '#888';
    const alt = colors[0] ?? base;
    const hi = colors[2] ?? base;
    const deep = colors[3] ?? alt;
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        const n = (x * 3 + y * 5 + ((x >> 2) * (y >> 2))) % 11;
        const color = n === 0 ? hi : n === 1 ? alt : n === 2 ? deep : base;
        p.set(x, y, color);
      }
    }
    if (cracks) {
      p.ellipse(16, 20, 7, 4, '#5a534c');
      p.ellipse(44, 40, 8, 5, '#4a453f');
      p.ellipse(30, 52, 5, 3, '#6a6258');
      p.line(8, 14, 26, 22, '#3a342e');
      p.line(36, 18, 56, 30, '#3a342e');
    } else {
      const flowers = ['#ff8fb8', '#fff7fb', '#7ec8f0', '#ffd36e', '#c084fc'];
      for (let i = 0; i < 14; i += 1) {
        const x = 4 + ((i * 17) % 56);
        const y = 6 + ((i * 13) % 52);
        p.set(x, y, '#2f7a32');
        p.set(x, y - 1, '#3f9a3a');
        p.set(x, y - 2, '#8ed85a');
        if (i % 2 === 0) p.set(x + 1, y - 3, flowers[i % flowers.length] ?? '#fff');
      }
    }
  }, 64, 64);
}

function cliffTex(bands: string[]): THREE.CanvasTexture {
  return bake((p) => {
    for (let y = 0; y < p.h; y += 1) {
      const band = bands[Math.min(bands.length - 1, Math.floor((y / p.h) * bands.length))] ?? '#666';
      for (let x = 0; x < p.w; x += 1) {
        const speck = (x * 5 + y * 3) % 8 === 0;
        p.set(x, y, speck ? shift(band) : band);
      }
    }
  }, 32, 48);
}

function shift(hex: string): string {
  const [r, g, b] = rgb(hex);
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  return `#${[clamp(r + 24), clamp(g + 18), clamp(b + 12)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function bareTree(trunk: string, limb: string): THREE.CanvasTexture {
  return bake((p) => {
    p.line(24, 62, 24, 34, trunk);
    p.line(23, 62, 23, 40, trunk);
    p.line(25, 62, 25, 42, trunk);
    p.line(24, 40, 10, 22, limb);
    p.line(24, 36, 38, 16, limb);
    p.line(24, 44, 8, 36, limb);
    p.line(24, 42, 40, 30, limb);
    p.line(12, 26, 6, 18, limb);
    p.line(34, 22, 42, 12, limb);
    p.line(16, 40, 12, 48, limb);
  }, 48, 64);
}

function cherryTree(): THREE.CanvasTexture {
  return bake((p) => {
    p.line(24, 62, 24, 36, '#8d5a38');
    p.line(23, 62, 23, 40, '#6e4128');
    p.line(25, 62, 25, 42, '#a56b42');
    const puffs: Array<[number, number, number, string]> = [
      [24, 24, 14, '#ff8fb8'],
      [12, 28, 10, '#ffb3d0'],
      [36, 26, 11, '#ff7aa8'],
      [20, 16, 8, '#ffd0e2'],
      [32, 15, 8, '#ff9ec4'],
      [24, 30, 9, '#ff6f9e'],
    ];
    for (const [x, y, r, c] of puffs) p.ellipse(x, y, r, r * 0.82, c);
    p.outline('#c45b86');
    p.set(18, 18, '#fff');
    p.set(30, 20, '#fff');
    p.set(24, 12, '#fff');
    p.star(8, 10, '#fff');
  }, 48, 64);
}

function pineTree(leaf: string, edge: string): THREE.CanvasTexture {
  return bake((p) => {
    p.line(24, 62, 24, 46, '#6b4630');
    p.line(23, 62, 23, 50, '#4e3222');
    for (let i = 0; i < 4; i += 1) {
      const y = 14 + i * 9;
      const w = 16 - i * 3;
      p.line(24, y, 24 - w, y + 10, leaf);
      p.line(24, y, 24 + w, y + 10, leaf);
      p.line(24 - w, y + 10, 24 + w, y + 10, leaf);
    }
    p.outline(edge);
    p.star(24, 8, '#fff');
  }, 48, 64);
}

function cactusTree(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(24, 36, 7, 20, '#5ec45a');
    p.ellipse(12, 32, 5, 10, '#49a84a');
    p.ellipse(36, 30, 5, 12, '#6ed86a');
    p.outline('#2f7a3a');
    for (const [x, y] of [
      [16, 20],
      [30, 18],
      [24, 28],
      [10, 30],
      [38, 26],
    ] as Array<[number, number]>) {
      p.ellipse(x, y, 2.2, 2.2, '#ff8fb8');
    }
    p.set(22, 34, '#e8ffc8');
  }, 48, 64);
}

function alienTree(): THREE.CanvasTexture {
  return bake((p) => {
    p.line(24, 62, 24, 34, '#6a4a8a');
    p.ellipse(24, 24, 14, 12, '#7cf0d2');
    p.ellipse(12, 30, 8, 7, '#c084fc');
    p.ellipse(36, 28, 8, 8, '#67e8f9');
    p.ellipse(24, 16, 6, 5, '#f9a8d4');
    p.outline('#3d6b78');
    p.star(24, 8, '#fff');
    p.set(20, 22, '#06303a');
    p.set(28, 22, '#06303a');
  }, 48, 64);
}

function moneyTree(): THREE.CanvasTexture {
  return bake((p) => {
    p.line(24, 62, 24, 30, '#a56b2a');
    p.line(23, 62, 23, 36, '#7a4e16');
    p.ellipse(24, 22, 16, 13, '#ffe56a');
    p.ellipse(12, 28, 9, 8, '#ffd36e');
    p.ellipse(36, 26, 9, 8, '#fff1a8');
    p.outline('#c9891a');
    p.star(24, 8, '#fff');
    p.star(8, 16, '#fff6c8');
    p.set(24, 22, '#fff');
  }, 48, 72);
}

function boomboxTree(): THREE.CanvasTexture {
  return bake((p) => {
    p.line(24, 62, 24, 34, '#6b3f28');
    p.ellipse(24, 22, 12, 10, '#86efac');
    p.outline('#3f8f5a');
    p.ellipse(24, 40, 10, 7, '#f472b6');
    p.ellipse(16, 40, 4, 4, '#222');
    p.ellipse(32, 40, 4, 4, '#222');
    p.set(15, 39, '#fff');
    p.set(31, 39, '#fff');
  }, 48, 64);
}

function bush(live: boolean): THREE.CanvasTexture {
  return bake((p) => {
    if (!live) {
      p.line(8, 20, 16, 8, '#5c5148');
      p.line(24, 22, 20, 6, '#4a4038');
      p.line(24, 22, 34, 8, '#6a5e54');
      p.line(16, 16, 10, 12, '#3e352e');
      return;
    }
    p.ellipse(16, 16, 12, 8, '#7dce4a');
    p.ellipse(10, 18, 7, 6, '#b6e86a');
    p.ellipse(22, 18, 6, 5, '#4caf3a');
    p.outline('#2f7a32');
    p.set(8, 14, '#ff8fb8');
    p.set(18, 12, '#fff');
    p.set(14, 16, '#7ec8f0');
  }, 32, 28);
}

function rockSprite(moss: boolean): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 14, 12, 8, moss ? '#8d97a3' : '#9a938c');
    p.ellipse(12, 16, 6, 5, moss ? '#6e7884' : '#7d776f');
    p.outline('#4e4a46');
    if (moss) {
      p.ellipse(16, 10, 6, 3, '#7dce4a');
      p.set(12, 10, '#b6e86a');
    }
  }, 32, 24);
}

function twigPatch(): THREE.CanvasTexture {
  return bake((p) => {
    p.line(4, 16, 12, 8, '#6a5e54');
    p.line(14, 18, 18, 6, '#4e453e');
    p.line(20, 16, 28, 10, '#7a6e64');
  }, 32, 24);
}

function flowerPatch(): THREE.CanvasTexture {
  return bake((p) => {
    const colors = ['#ff8fb8', '#fff', '#7ec8f0', '#c084fc', '#ffd36e'];
    for (let i = 0; i < 7; i += 1) {
      const x = 4 + (i % 4) * 7;
      const y = 8 + (i % 3) * 5;
      p.set(x, y + 4, '#3e8a32');
      p.set(x, y + 5, '#3e8a32');
      p.ellipse(x, y, 2.2, 2.2, colors[i % colors.length] ?? '#fff');
      p.set(x, y, '#fff6c2');
    }
  }, 32, 24);
}

/** 8 frames of 16x16 in one strip. 0-2 dead litter, 3 blank, 4-7 blooms. */
function floraAtlas(): THREE.CanvasTexture {
  return bake((p) => {
    const at = (frame: number, x: number, y: number, color: string) => p.set(frame * 16 + x, y, color);
    // twig
    for (let i = 0; i < 9; i += 1) at(0, 3 + i, 14 - Math.floor(i * 0.5), i % 3 === 0 ? '#4a3f37' : '#6a5d52');
    at(0, 8, 10, '#6a5d52');
    at(0, 9, 9, '#6a5d52');
    // pebbles
    for (const [x, y, c] of [[5, 14, '#8a837c'], [6, 14, '#8a837c'], [6, 13, '#a49d95'], [7, 14, '#6a645e'], [10, 14, '#7d766f'], [11, 14, '#7d766f'], [10, 13, '#9a938b']] as Array<[number, number, string]>) at(1, x, y, c);
    // dry sprig
    for (let y = 8; y < 15; y += 1) at(2, 8, y, '#7a6650');
    at(2, 7, 9, '#7a6650');
    at(2, 6, 8, '#8d775e');
    at(2, 9, 10, '#7a6650');
    at(2, 10, 9, '#8d775e');
    at(2, 5, 11, '#6a5642');
    // pink flower
    for (let y = 9; y < 15; y += 1) at(4, 8, y, '#3e8a32');
    at(4, 7, 12, '#5cb83a');
    at(4, 9, 11, '#5cb83a');
    for (const [x, y] of [[7, 6], [9, 6], [8, 5], [8, 7], [7, 7], [9, 7], [7, 5], [9, 5]] as Array<[number, number]>) at(4, x, y, '#ff8fb8');
    at(4, 8, 6, '#fff3a8');
    // grass tuft
    for (const [x, h] of [[4, 4], [6, 6], [7, 8], [9, 7], [11, 5], [12, 3]] as Array<[number, number]>) {
      for (let y = 15 - h; y < 15; y += 1) at(5, x, y, y < 15 - h + 2 ? '#a8e870' : '#5cb83a');
    }
    // white and blue trio
    for (const [x, c] of [[4, '#ffffff'], [8, '#7ec8f0'], [12, '#ffffff']] as Array<[number, string]>) {
      for (let y = 10; y < 15; y += 1) at(6, x, y, '#3e8a32');
      at(6, x - 1, 9, c);
      at(6, x + 1, 9, c);
      at(6, x, 8, c);
      at(6, x, 10, c);
      at(6, x, 9, '#ffe56a');
    }
    // blossom bush
    p.ellipse(7 * 16 + 8, 11, 6, 4.2, '#62be46');
    p.ellipse(7 * 16 + 6, 10, 3.5, 3, '#86d65a');
    for (const [x, y] of [[5, 9], [9, 8], [11, 11], [7, 12], [4, 12]] as Array<[number, number]>) at(7, x, y, '#ff8fb8');
    at(7, 8, 9, '#ffffff');
  }, 128, 16);
}

function frog(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 16, 10, 7, '#7dce4a');
    p.ellipse(16, 18, 6, 4, '#e8ffc4');
    p.outline('#3f8a32');
    p.ellipse(10, 10, 3.3, 3.3, '#fff');
    p.ellipse(22, 10, 3.3, 3.3, '#fff');
    p.ellipse(10, 10, 1.6, 1.6, '#2b2b33');
    p.ellipse(22, 10, 1.6, 1.6, '#2b2b33');
    p.set(9, 9, '#fff');
    p.set(21, 9, '#fff');
    p.ellipse(8, 16, 2, 1.2, '#ff9bb8');
    p.ellipse(24, 16, 2, 1.2, '#ff9bb8');
    p.line(14, 18, 18, 18, '#2f6a32');
  }, 32, 28);
}

function fox(scarf: boolean): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 18, 10, 7, '#f29a3a');
    p.ellipse(16, 20, 6, 4, '#fff6e8');
    p.ellipse(8, 8, 3, 5, '#f29a3a');
    p.ellipse(24, 8, 3, 5, '#f29a3a');
    p.ellipse(8, 8, 1.4, 2.4, '#ffb6c8');
    p.ellipse(24, 8, 1.4, 2.4, '#ffb6c8');
    p.outline('#c46a22');
    p.ellipse(12, 16, 1.5, 1.5, '#2b2b33');
    p.ellipse(20, 16, 1.5, 1.5, '#2b2b33');
    p.set(16, 18, '#2b2b33');
    if (scarf) {
      p.line(8, 22, 24, 22, '#ff6f9e');
      p.line(20, 22, 22, 28, '#ff8fb8');
    }
  }, 32, 32);
}

function fennec(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 20, 9, 7, '#f6d7a8');
    p.ellipse(16, 22, 5, 3.5, '#fff');
    p.ellipse(7, 10, 4, 8, '#f6d7a8');
    p.ellipse(25, 10, 4, 8, '#f6d7a8');
    p.ellipse(7, 12, 2, 4, '#ffb6c8');
    p.ellipse(25, 12, 2, 4, '#ffb6c8');
    p.outline('#d2a56a');
    p.ellipse(12, 18, 1.6, 1.6, '#2b2b33');
    p.ellipse(20, 18, 1.6, 1.6, '#2b2b33');
    p.set(16, 21, '#2b2b33');
  }, 32, 32);
}

function duck(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 18, 11, 7, '#ffe56a');
    p.ellipse(16, 20, 7, 4, '#fff6c2');
    p.outline('#e2b83a');
    p.ellipse(10, 12, 2.2, 2.2, '#fff');
    p.ellipse(16, 10, 2.2, 2.2, '#fff');
    p.ellipse(22, 12, 2.2, 2.2, '#fff');
    p.set(10, 12, '#2b2b33');
    p.set(16, 10, '#2b2b33');
    p.set(22, 12, '#2b2b33');
    p.ellipse(24, 18, 4, 2, '#ff9a3c');
  }, 32, 28);
}

function koi(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 12, 10, 6, '#ff8a3d');
    p.ellipse(16, 12, 5, 3, '#fff');
    p.line(4, 12, 0, 6, '#ff8a3d');
    p.line(4, 12, 0, 18, '#ff8a3d');
    p.outline('#e06a20');
    p.set(22, 11, '#2b2b33');
    p.ellipse(8, 13, 2, 1.2, '#ff9bb8');
  }, 32, 24);
}

function pond(full: boolean): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(24, 16, 20, 10, full ? '#3ec4ff' : '#8a7568');
    p.outline(full ? '#1a7ec8' : '#5c4c44');
    if (full) {
      p.line(10, 14, 18, 12, '#e8f8ff');
      p.line(22, 18, 34, 15, '#e8f8ff');
      p.set(16, 16, '#fff');
    } else {
      p.line(10, 12, 20, 18, '#5a463c');
      p.line(22, 10, 36, 16, '#5a463c');
    }
  }, 48, 32);
}

function seedSprite(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 16, 8, 11, '#c4a05a');
    p.outline('#8a6a32');
    p.line(16, 6, 16, 14, '#6b8f3a');
    p.ellipse(16, 6, 3, 2, '#7dce4a');
  }, 32, 32);
}

function dropSprite(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(6, 8, 4, 5.2, '#7ec8ff');
    p.ellipse(6, 7, 3, 4.2, '#c4f0ff');
    p.set(6, 3, '#ffffff');
    p.set(5, 7, '#ffffff');
  }, 12, 16);
}

function bit(kind: 'star' | 'leaf' | 'spark' | 'heart'): THREE.CanvasTexture {
  return bake((p) => {
    if (kind === 'star') {
      p.star(6, 6, '#ffe56a');
      p.set(6, 6, '#fff');
    } else if (kind === 'leaf') {
      p.ellipse(6, 6, 4, 2.4, '#7dce4a');
      p.line(4, 8, 8, 4, '#3f8a32');
    } else if (kind === 'heart') {
      p.ellipse(5, 5, 2.4, 2.2, '#ff8fb8');
      p.ellipse(8, 5, 2.4, 2.2, '#ff8fb8');
      p.ellipse(6.5, 8, 3, 2.4, '#ff6f9e');
    } else {
      p.set(6, 6, '#fff');
      p.set(6, 4, '#d9f4ff');
      p.set(6, 8, '#d9f4ff');
      p.set(4, 6, '#fff6c2');
      p.set(8, 6, '#fff6c2');
    }
  }, 12, 12);
}

function tornadoSprite(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 8, 12, 4, '#ffd0e6');
    p.ellipse(16, 16, 8, 4, '#ff9ec8');
    p.ellipse(16, 24, 5, 3, '#fff');
    p.outline('#f472b6');
    p.star(8, 6, '#fff');
  }, 32, 32);
}

function butterfly(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(5, 8, 4, 3, '#7ec8f0');
    p.ellipse(12, 8, 4, 3, '#ffb3d0');
    p.line(8, 6, 8, 14, '#3a3038');
  }, 16, 16);
}

function barrel(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 16, 10, 12, '#6f8f3a');
    p.line(8, 10, 24, 10, '#4e6428');
    p.line(8, 22, 24, 22, '#4e6428');
    p.outline('#3e5220');
    p.set(16, 16, '#d7f06a');
  }, 32, 32);
}

function babyCloud(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(16, 12, 8, 5, '#fff');
    p.ellipse(10, 13, 5, 4, '#fff');
    p.ellipse(22, 13, 5, 4, '#fff');
    p.outline('#bfe6fb');
    p.set(13, 12, '#2b2b33');
    p.set(19, 12, '#2b2b33');
    p.set(12, 14, '#ff9bb8');
    p.set(20, 14, '#ff9bb8');
  }, 32, 24);
}

function lipTex(): THREE.CanvasTexture {
  return bake((p) => {
    const bands = ['#6e4a2e', '#8a5a32', '#5a3a22', '#4a2e1c', '#3a2416'];
    for (let y = 0; y < p.h; y += 1) {
      const band = bands[Math.min(bands.length - 1, Math.floor((y / p.h) * bands.length))] ?? '#4a2e1c';
      for (let x = 0; x < p.w; x += 1) {
        p.set(x, y, (x * 3 + y) % 7 === 0 ? '#a56b42' : band);
      }
    }
  }, 32, 32);
}

export interface ArtSet {
  cloud: Record<CloudMood, THREE.CanvasTexture>;
  baby: THREE.CanvasTexture;
  skies: THREE.CanvasTexture[];
  mountain: THREE.CanvasTexture;
  hills: THREE.CanvasTexture[];
  deadTop: THREE.CanvasTexture[];
  liveTop: THREE.CanvasTexture[];
  deadCliff: THREE.CanvasTexture[];
  liveCliff: THREE.CanvasTexture[];
  lip: THREE.CanvasTexture;
  deadTree: THREE.CanvasTexture[];
  liveTree: THREE.CanvasTexture[];
  money: THREE.CanvasTexture;
  boombox: THREE.CanvasTexture;
  bushDead: THREE.CanvasTexture;
  bushLive: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  rockMoss: THREE.CanvasTexture;
  twig: THREE.CanvasTexture;
  flowers: THREE.CanvasTexture;
  frog: THREE.CanvasTexture;
  fox: THREE.CanvasTexture;
  fennec: THREE.CanvasTexture;
  duck: THREE.CanvasTexture;
  koi: THREE.CanvasTexture;
  pondEmpty: THREE.CanvasTexture;
  pondFull: THREE.CanvasTexture;
  seed: THREE.CanvasTexture;
  drop: THREE.CanvasTexture;
  star: THREE.CanvasTexture;
  leaf: THREE.CanvasTexture;
  spark: THREE.CanvasTexture;
  heart: THREE.CanvasTexture;
  tornado: THREE.CanvasTexture;
  butterfly: THREE.CanvasTexture;
  bird: THREE.CanvasTexture;
  barrel: THREE.CanvasTexture;
  flora: THREE.CanvasTexture;
}

let cached: ArtSet | null = null;

export function getArt(): ArtSet {
  if (cached) return cached;
  cached = {
    cloud: {
      idle: drawCloud('idle'),
      joy: drawCloud('joy'),
      sleep: drawCloud('sleep'),
      grin: drawCloud('grin'),
      pout: drawCloud('pout'),
      blink: drawCloud('blink'),
    },
    baby: babyCloud(),
    skies: [0, 1, 2, 3].map((i) => {
      const w = worldDef(i);
      return skyCanvas(w.skyTop, w.skyMid, w.skyBot);
    }),
    mountain: drawMountain(),
    hills: [0, 1, 2, 3].map((i) => {
      const w = worldDef(i);
      return drawHills(w.hill, w.farHill);
    }),
    deadTop: [
      groundTex(['#8a8178', '#6e675f', '#a39890', '#7a726a'], true),
      groundTex(['#d5e4f4', '#b9cbe0', '#eef5fb', '#9fb4cc'], true),
      groundTex(['#e6d2a8', '#d8c090', '#f0e2c0', '#c8b088'], true),
      groundTex(['#6a7a48', '#546038', '#7d8a52', '#3e4a28'], true),
    ],
    liveTop: [
      groundTex(['#7dce4a', '#5cb83a', '#b6e86a', '#4caf38'], false),
      groundTex(['#b7f0ff', '#8fd8f0', '#e8fbff', '#6ec4e0'], false),
      groundTex(['#7dce4a', '#c8f090', '#ffe08a', '#5cb83a'], false),
      groundTex(['#67e8f9', '#c084fc', '#86efac', '#5eead4'], false),
    ],
    deadCliff: [
      cliffTex(['#9a928a', '#6e675f', '#514c46', '#3e3a36']),
      cliffTex(['#e8f2fb', '#c5d7ea', '#9fb6d0', '#7f96b0']),
      cliffTex(['#ead7b0', '#d2b48a', '#b8926a', '#8c6a48']),
      cliffTex(['#6a8a40', '#4e682c', '#7a5ea0', '#3a4424']),
    ],
    liveCliff: [
      cliffTex(['#7dce4a', '#6b4428', '#8a5a32', '#4a2e1c']),
      cliffTex(['#b7f0ff', '#9fd0ea', '#7eb6d4', '#5e90b4']),
      cliffTex(['#b6e86a', '#c4a06a', '#a07848', '#6e5030']),
      cliffTex(['#86efac', '#67e8f9', '#5b8a7a', '#3d5c6e']),
    ],
    lip: lipTex(),
    deadTree: [
      bareTree('#4a4038', '#2e2824'),
      bareTree('#d5e6f6', '#9fb4cc'),
      bareTree('#e7d7b8', '#b8a078'),
      bareTree('#6a8a48', '#445828'),
    ],
    liveTree: [cherryTree(), pineTree('#9be7ff', '#5eb0d4'), cactusTree(), alienTree()],
    money: moneyTree(),
    boombox: boomboxTree(),
    bushDead: bush(false),
    bushLive: bush(true),
    rock: rockSprite(false),
    rockMoss: rockSprite(true),
    twig: twigPatch(),
    flowers: flowerPatch(),
    frog: frog(),
    fox: fox(true),
    fennec: fennec(),
    duck: duck(),
    koi: koi(),
    pondEmpty: pond(false),
    pondFull: pond(true),
    seed: seedSprite(),
    drop: dropSprite(),
    star: bit('star'),
    leaf: bit('leaf'),
    spark: bit('spark'),
    heart: bit('heart'),
    tornado: tornadoSprite(),
    butterfly: butterfly(),
    bird: drawBird(),
    barrel: barrel(),
    flora: floraAtlas(),
  };
  return cached;
}
