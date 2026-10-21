import * as THREE from 'three';
import { worldDef } from './balance';
import { bakeSpriteNormal, rememberNormal } from './normals';

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
  const tex = texOf(pix.canvas, smooth);
  rememberNormal(tex, bakeSpriteNormal(pix.canvas));
  return tex;
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

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (n1: number, n2: number) =>
    Math.max(0, Math.min(255, Math.round(n1 + (n2 - n1) * t)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function skyCanvas(top: string, mid: string, bot: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const deep = mixHex(bot, mid, 0.4);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top);
  g.addColorStop(0.34, mid);
  g.addColorStop(0.52, mixHex(mid, bot, 0.35));
  g.addColorStop(0.62, bot);
  g.addColorStop(0.78, mixHex(bot, deep, 0.5));
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);

  const soft = (x: number, y: number, w: number, h: number, a: number) => {
    const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, w);
    cg.addColorStop(0, `rgba(255,255,255,${a})`);
    cg.addColorStop(0.5, `rgba(255,252,250,${(a * 0.55).toFixed(3)})`);
    cg.addColorStop(1, 'rgba(255,250,252,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, h / w);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Warm glow around where the billboard sun sits (visible play-camera strip).
  const glow = ctx.createRadialGradient(812, 276, 8, 812, 284, 290);
  glow.addColorStop(0, 'rgba(255,250,226,0.95)');
  glow.addColorStop(0.2, 'rgba(255,228,180,0.5)');
  glow.addColorStop(0.55, 'rgba(255,208,190,0.16)');
  glow.addColorStop(1, 'rgba(255,204,204,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(470, 20, 554, 460);

  // Distant cloud bands along the visible horizon strip.
  soft(150, 268, 200, 30, 0.5);
  soft(430, 252, 240, 34, 0.42);
  soft(700, 262, 180, 28, 0.36);
  soft(950, 244, 210, 30, 0.34);
  soft(300, 300, 260, 30, 0.24);
  soft(620, 308, 240, 28, 0.2);

  // Cloud sea below the horizon so the island reads as floating.
  soft(140, 352, 340, 78, 0.6);
  soft(470, 372, 380, 88, 0.5);
  soft(820, 356, 320, 74, 0.55);
  soft(1010, 392, 300, 70, 0.44);
  soft(320, 404, 360, 76, 0.34);
  soft(660, 428, 400, 80, 0.28);

  // Sparkles high up so the wide intro camera still has sky life.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 30; i += 1) {
    const x = (i * 197) % 1024;
    const y = 16 + ((i * 83) % 150);
    const s = i % 5 === 0 ? 3 : 2;
    ctx.fillRect(x, y, s, s);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 331 + 60) % 1024;
    const y = 150 + ((i * 47) % 110);
    ctx.fillRect(x, y, 2, 2);
  }
  return texOf(canvas, true);
}

/** Deep-space backdrop for the endgame globe world: stars, haze and a faint nebula. */
function spaceCanvas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#05060f');
  g.addColorStop(0.3, '#0a1130');
  g.addColorStop(0.5, '#101c48');
  g.addColorStop(0.62, '#16255a');
  g.addColorStop(0.8, '#0d1638');
  g.addColorStop(1, '#060814');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);

  // soft nebula clouds
  const neb = (x: number, y: number, w: number, h: number, col: string, a: number) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, w);
    rg.addColorStop(0, col.replace('%a', String(a)));
    rg.addColorStop(0.55, col.replace('%a', String(a * 0.36)));
    rg.addColorStop(1, col.replace('%a', '0'));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, h / w);
    ctx.translate(-x, -y);
    ctx.fillStyle = rg;
    ctx.fillRect(x - w, y - w, w * 2, w * 2);
    ctx.restore();
  };
  neb(300, 250, 300, 130, 'rgba(140,110,255,%a)', 0.16);
  neb(760, 210, 260, 120, 'rgba(90,210,255,%a)', 0.12);
  neb(520, 320, 420, 150, 'rgba(255,150,210,%a)', 0.08);

  // milky band
  const band = ctx.createLinearGradient(0, 150, 1024, 400);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.42, 'rgba(226,232,255,0.1)');
  band.addColorStop(0.55, 'rgba(236,240,255,0.14)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 120, 1024, 300);

  const rnd = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  // stars: a spread of sizes/tints, dense enough for any visible strip
  for (let i = 0; i < 620; i += 1) {
    const x = rnd(i * 1.7) * 1024;
    const y = 60 + rnd(i * 3.3 + 11) * 400;
    const r = 0.6 + rnd(i * 5.1) * 1.5;
    const t = rnd(i * 7.7);
    const col = t > 0.82 ? '255,214,178' : t > 0.6 ? '186,214,255' : '255,255,255';
    const a = 0.35 + rnd(i * 2.9) * 0.6;
    ctx.fillStyle = `rgba(${col},${a.toFixed(2)})`;
    ctx.fillRect(x, y, r, r);
    if (r > 1.7) {
      ctx.fillStyle = `rgba(${col},${(a * 0.35).toFixed(2)})`;
      ctx.fillRect(x - r * 1.6, y + r * 0.4, r * 4.2, 1);
      ctx.fillRect(x + r * 0.4, y - r * 1.6, 1, r * 4.2);
    }
  }
  return texOf(canvas, true);
}

function drawSun(): THREE.CanvasTexture {
  return bake(
    (p) => {
      p.ellipse(24, 24, 19, 19, 'rgba(255,196,96,0.3)');
      p.ellipse(24, 24, 14, 14, '#ffc95c');
      p.ellipse(24, 24, 11, 11, '#ffdd86');
      p.ellipse(24, 24, 8, 8, '#fff4c4');
      p.star(24, 24, '#fffdf2');
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const x = 24 + Math.cos(a) * 16;
        const y = 24 + Math.sin(a) * 16;
        p.ellipse(x, y, 2.4, 1.3, '#ffe9a0');
      }
    },
    48,
    48,
    true,
  );
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
    const light = mixHex(color, '#ffffff', 0.4);
    const rim = mixHex(color, '#fff4ea', 0.55);
    const dark = mixHex(color, '#4a3346', 0.5);
    const tree = mixHex(color, '#241a24', 0.55);
    const backLight = mixHex(back, '#ffffff', 0.3);
    const backDark = mixHex(back, '#2e1c2e', 0.24);
    const backTree = mixHex(back, '#241a24', 0.4);
    const rnd = (n: number) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    type Hill = { cx: number; cy: number; rx: number; ry: number };
    const ridge = (list: Hill[], fill: string) => {
      for (const h of list) p.ellipse(h.cx, h.cy, h.rx, h.ry, fill);
    };
    const crestOf = (list: Hill[]): number[] => {
      const crest: number[] = new Array(p.w).fill(9999);
      for (let x = 0; x < p.w; x += 1) {
        for (const h of list) {
          const dx = (x - h.cx) / h.rx;
          if (Math.abs(dx) >= 1) continue;
          const y = h.cy - h.ry * Math.sqrt(1 - dx * dx);
          if (y < crest[x]!) crest[x] = y;
        }
      }
      return crest;
    };

    // far ridge (hazier, only its crest shows above the near range)
    const far: Hill[] = [];
    for (let i = 0; i < 12; i += 1) {
      const cx = -20 + i * 58;
      const top = 2 + Math.floor(rnd(i + 7) * 12);
      far.push({ cx, cy: top + 28, rx: 52, ry: 31 });
    }
    ridge(far, backDark);
    ridge(far.map((h) => ({ ...h, cx: h.cx - 8, rx: 40, ry: h.ry - 7 })), back);
    const farCrest = crestOf(far);
    for (let x = 0; x < p.w; x += 1) {
      const y = Math.round(farCrest[x]!);
      if (y > 900) continue;
      p.set(x, y, backLight);
      if (x % 3 === 0 && rnd(x + 5) > 0.45) {
        const th = 1 + Math.floor(rnd(x + 11) * 3);
        for (let k = 1; k <= th; k += 1) p.set(x, y - k, backTree);
      }
    }

    // solid base (drawn before the near ridge so no hard seam shows)
    for (let y = 33; y < p.h; y += 1) for (let x = 0; x < p.w; x += 1) p.set(x, y, dark);

    // near ridge with a sun-kissed crest and a forest fringe
    const near: Hill[] = [];
    for (let i = 0; i < 11; i += 1) {
      const cx = -14 + i * 62;
      const top = 12 + Math.floor(rnd(i + 91) * 14);
      near.push({ cx, cy: top + 21, rx: 56, ry: 28 });
    }
    ridge(near, color);
    const nearCrest = crestOf(near);
    for (let x = 0; x < p.w; x += 1) {
      const y = Math.round(nearCrest[x]!);
      if (y > 900) continue;
      // sunlit crest: rim highlight with a short falloff down the upper slope
      p.set(x, y, rim);
      p.set(x, y + 1, light);
      p.set(x, y + 2, mixHex(color, '#ffffff', 0.22));
      p.set(x, y + 3, mixHex(color, '#ffffff', 0.1));
      // forest fringe: little tree tops peeking over the ridge
      const n = rnd(x + 37);
      if (n > 0.42) {
        const th = 1 + Math.floor(rnd(x + 71) * 4);
        const spread = n > 0.78 ? 1 : 0;
        for (let k = 1; k <= th; k += 1) {
          p.set(x, y - k, tree);
          if (spread && k > 1) p.set(x + 1, y - k, tree);
          if (spread && k > 2) p.set(x - 1, y - k, tree);
        }
      }
    }
    // volume: lower slopes sink into shadow where the range meets the island
    p.shadeLower(mixHex(color, '#3a2436', 0.55), 0.3);
    // dissolve into the sky so the range never ends on a hard horizontal cut
    const img = p.ctx.getImageData(0, 0, p.w, p.h);
    const fadeFrom = p.h - 13;
    for (let y = fadeFrom; y < p.h; y += 1) {
      const k = 1 - (y - fadeFrom) / (p.h - fadeFrom);
      const a = Math.pow(k, 1.35);
      for (let x = 0; x < p.w; x += 1) {
        const i = (y * p.w + x) * 4 + 3;
        img.data[i] = Math.round((img.data[i] ?? 0) * a);
      }
    }
    p.ctx.putImageData(img, 0, 0);
  }, 640, 48);
}

/** Distant restored sky-islands for parallax backdrop. */
function drawParallaxIsland(variant: number): THREE.CanvasTexture {
  const v = variant % 6;
  return bake((p) => {
    const cx = 48;
    const capY = 34;
    const rock = ['#8a6a52', '#6e5038', '#a07858', '#5c4838', '#7a6048', '#6b5544'][v]!;
    const rockDeep = ['#5c4030', '#4a3224', '#6e4a34', '#3e2c20', '#524030', '#463628'][v]!;
    const grass = ['#7dce4a', '#8fd8f0', '#c8f090', '#86efac', '#b6e86a', '#9be7ff'][v]!;
    const grassHi = ['#b6e86a', '#e8fbff', '#ffe08a', '#c084fc', '#d7f06a', '#b7f0ff'][v]!;

    for (let y = capY; y < p.h; y += 1) {
      const t = (y - capY) / (p.h - capY);
      const bulge = 1 - t * 0.78;
      const rx = 38 * bulge + Math.sin(y * 0.4) * 1.2;
      for (let x = 0; x < p.w; x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        if (dx * dx > 1) continue;
        const edge = Math.abs(dx);
        let c = edge > 0.82 ? rockDeep : rock;
        if ((x * 5 + y * 11) % 17 === 0) c = rockDeep;
        if ((x * 7 + y * 3) % 23 === 0 && t < 0.55) c = '#a56b42';
        p.set(x, y, c);
      }
    }
    for (let i = 0; i < 5 + (v % 3); i += 1) {
      const sx = cx - 18 + ((i * 17 + v * 9) % 36);
      const sy = p.h - 4 - (i % 4) * 3;
      const len = 4 + (i % 3);
      for (let k = 0; k < len; k += 1) p.set(sx, sy + k, k === len - 1 ? rockDeep : rock);
    }
    p.ellipse(cx, capY - 2, 40, 14, grass);
    p.ellipse(cx - 8, capY, 28, 10, grassHi);
    p.ellipse(cx + 10, capY + 1, 24, 9, grass);
    if (v === 1 || v === 5) {
      p.ellipse(cx + 14, capY + 4, 9, 4, '#6ec4e0');
      p.ellipse(cx + 14, capY + 4, 6, 2.5, '#b7f0ff');
    }
    const tree = (tx: number, kind: number) => {
      p.line(tx, capY + 6, tx, capY - 4, '#6b4630');
      if (kind === 0) {
        p.ellipse(tx, capY - 8, 7, 6, '#ff8fb8');
        p.ellipse(tx - 4, capY - 6, 5, 4, '#ffb3d0');
        p.ellipse(tx + 4, capY - 7, 5, 4, '#ff7aa8');
      } else if (kind === 1) {
        p.line(tx, capY - 6, tx - 6, capY + 2, '#5eb0d4');
        p.line(tx, capY - 6, tx + 6, capY + 2, '#5eb0d4');
        p.line(tx - 6, capY + 2, tx + 6, capY + 2, '#9be7ff');
      } else {
        p.ellipse(tx, capY - 7, 6, 5, '#5cb83a');
        p.ellipse(tx, capY - 11, 5, 4, '#7dce4a');
      }
    };
    tree(cx - 16, v % 3);
    tree(cx + 6, (v + 1) % 3);
    if (v % 2 === 0) tree(cx + 22, (v + 2) % 3);
    if (v === 3) {
      p.ellipse(cx - 20, capY + 2, 3, 2, '#67e8f9');
      p.line(cx - 20, capY + 2, cx - 20, capY + 10, '#c084fc88');
    }
    p.star(cx - 4, capY - 14, '#fff');
    if (v === 2) p.star(cx + 18, capY - 12, '#ffe56a');
    p.shadeLower('#f7c6df', 0.55);
    p.outline('#3e3228');
  }, 96, 72);
}

function groundTex(colors: string[], cracks: boolean): THREE.CanvasTexture {
  return bake((p) => {
    const base = colors[1] ?? colors[0] ?? '#888';
    const alt = colors[0] ?? base;
    const hi = colors[2] ?? base;
    const deep = colors[3] ?? alt;
    for (let y = 0; y < p.h; y += 1) {
      for (let x = 0; x < p.w; x += 1) {
        let color = base;
        if (cracks) {
          const n = (x * 3 + y * 5 + ((x >> 2) * (y >> 2))) % 11;
          color = n === 0 ? hi : n === 1 ? alt : n === 2 ? deep : base;
        } else {
          // scattered grass speckle instead of a regular weave
          const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
          color = h < 0.1 ? hi : h < 0.27 ? alt : h < 0.33 ? deep : base;
        }
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
    const bark = mixHex(trunk, '#ffffff', 0.22);
    const barkDark = mixHex(trunk, '#000000', 0.3);
    const limbHi = mixHex(limb, '#ffffff', 0.2);
    // gnarled, tapering trunk with a gentle lean
    for (let y = 24; y < 63; y += 1) {
      const t = (y - 24) / 39;
      const cx = 24 + Math.round(Math.sin((y - 24) * 0.18) * 1.4) - Math.round(t);
      const half = Math.round(0.4 + t * 2.1);
      for (let dx = -half; dx <= half; dx += 1) {
        p.set(cx + dx, y, dx <= 0 ? bark : barkDark);
      }
    }
    // roots
    p.line(23, 60, 16, 64, trunk);
    p.line(25, 60, 32, 64, trunk);
    p.line(18, 62, 13, 65, barkDark);
    p.line(30, 62, 35, 65, barkDark);
    // crooked branches
    const twig = (x0: number, y0: number, segs: Array<[number, number]>) => {
      let x = x0;
      let y = y0;
      for (const [dx, dy] of segs) {
        p.line(x, y, x + dx, y + dy, limb);
        p.line(x, y + 1, x + dx, y + dy + 1, limbHi);
        x += dx;
        y += dy;
      }
    };
    twig(23, 38, [[-4, -6], [1, -7], [-5, -6], [1, -6]]);
    twig(25, 36, [[4, -6], [-1, -7], [5, -6], [-1, -5]]);
    twig(23, 50, [[-6, -4], [-3, -5]]);
    twig(25, 47, [[7, -5], [3, -4]]);
    twig(19, 19, [[-4, -5]]);
    twig(30, 17, [[5, -4]]);
    twig(18, 44, [[-5, 3]]);
    twig(27, 43, [[6, 2]]);
    twig(15, 13, [[-3, -4]]);
    twig(34, 12, [[3, -4]]);
  }, 48, 64);
}

const TREE_PALETTES: TreePalette[] = [
  // The Dead Forest: deep summer green.
  {
    crown: '#3f9a3a', crownShade: '#2f7a32', crownLit: '#5cb83a', crownTop: '#7dce4a',
    edge: '#1f4a22', trunk: '#6b4630', trunkShade: '#4e3222', trunkLight: '#3b2718', accent: '#ff8fb8',
  },
  // Frostbite Forest: frosted blue green.
  {
    crown: '#5fb0a8', crownShade: '#3f8a86', crownLit: '#9fe0d8', crownTop: '#cdeef4',
    edge: '#2f6a72', trunk: '#c8d4dc', trunkShade: '#a2b2bc', trunkLight: '#8a9aa6', accent: '#bfe6fb',
  },
  // Parched Desert: dry olive.
  {
    crown: '#8a9a3a', crownShade: '#6a7a2c', crownLit: '#b6c25a', crownTop: '#d2d97a',
    edge: '#4a5520', trunk: '#7a5a38', trunkShade: '#5a4028', trunkLight: '#96703f', accent: '#ffb45e',
  },
  // Toxic Sludge Dump: sickly violet green.
  {
    crown: '#6f9a3a', crownShade: '#4f7028', crownLit: '#9cc44a', crownTop: '#c2d95a',
    edge: '#3a4a22', trunk: '#6a4a8a', trunkShade: '#4a3360', trunkLight: '#8a6aac', accent: '#c084fc',
  },
];

function birchTree(pal: TreePalette): THREE.CanvasTexture {
  return bake((p) => {
    // rounder, fuller crown
    p.ellipse(24, 13, 12, 10, pal.crownTop);
    p.ellipse(13, 20, 10, 8, pal.crownShade);
    p.ellipse(35, 19, 10, 8, pal.crownLit);
    p.ellipse(24, 24, 11, 7, pal.crown);
    p.outline(pal.edge);
    // solid pale trunk with a gentle lean, warm shadow side
    for (let y = 22; y < 62; y += 1) {
      const x = 23 - Math.round((62 - y) * 0.02);
      p.set(x, y, pal.trunk);
      p.set(x + 1, y, pal.trunkShade);
      p.set(x + 2, y, pal.trunkLight);
    }
    for (let y = 28; y < 58; y += 8) {
      const x = 23 + ((y * 5) % 2);
      p.line(x, y, x + 1, y + 1, '#4a4a52');
    }
    p.line(24, 30, 17, 24, '#efeadf');
    p.line(24, 36, 31, 30, '#efeadf');
  }, 48, 64);
}

/**
 * The colours of a tree. Every island grows its own kind of tree, so the
 * palette is a parameter and not a set of constants.
 */
interface TreePalette {
  crown: string;
  crownShade: string;
  crownLit: string;
  crownTop: string;
  edge: string;
  trunk: string;
  trunkShade: string;
  trunkLight: string;
  accent: string;
}

function oakTree(pal: TreePalette): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(24, 24, 16, 13, pal.crown);
    p.ellipse(12, 28, 10, 8, pal.crownShade);
    p.ellipse(36, 26, 10, 9, pal.crownLit);
    p.ellipse(24, 14, 9, 7, pal.crownTop);
    p.outline(pal.edge);
    p.line(24, 62, 24, 34, pal.trunk);
    p.line(23, 62, 23, 40, pal.trunkShade);
    p.line(25, 62, 25, 42, pal.trunkLight);
    p.set(18, 18, '#e8ffc8');
    p.set(30, 20, '#fff');
  }, 48, 64);
}

function cherryTree(pal: TreePalette): THREE.CanvasTexture {
  return bake((p) => {
    const puffs: Array<[number, number, number, string]> = [
      [24, 24, 14, pal.crown],
      [12, 28, 10, pal.crownLit],
      [36, 26, 11, pal.crownShade],
      [20, 16, 8, pal.crownTop],
      [32, 15, 8, pal.crown],
      [24, 30, 9, pal.crownShade],
    ];
    for (const [x, y, r, c] of puffs) p.ellipse(x, y, r, r * 0.82, c);
    p.outline(pal.edge);
    p.line(24, 62, 24, 36, pal.trunk);
    p.line(23, 62, 23, 40, pal.trunkShade);
    p.line(25, 62, 25, 42, pal.trunkLight);
    p.set(18, 18, '#fff');
    p.set(30, 20, '#fff');
    p.set(24, 12, '#fff');
    p.star(8, 10, '#fff');
  }, 48, 64);
}

function pineTree(leaf: string, edge: string): THREE.CanvasTexture {
  return bake((p) => {
    const dark = mixHex(leaf, edge, 0.6);
    const light = mixHex(leaf, '#ffffff', 0.3);
    // three overlapping frond tiers, each with a shaded underside
    const tier = (top: number, half: number, h: number) => {
      for (let y = 0; y < h; y += 1) {
        const w = Math.max(1, Math.round((y / (h - 1)) * half));
        for (let dx = -w; dx <= w; dx += 1) {
          let c = leaf;
          if (y >= h - 2) c = dark;
          else if (dx <= -w + 1) c = light;
          else if (dx >= w - 1) c = dark;
          p.set(24 + dx, top + y, c);
        }
      }
    };
    tier(8, 11, 15);
    tier(20, 16, 15);
    tier(32, 20, 15);
    // trunk
    for (let y = 46; y < 62; y += 1) {
      p.set(23, y, '#6b4630');
      p.set(24, y, '#54382a');
      p.set(25, y, '#4e3222');
    }
    p.set(24, 7, '#ffffff');
    p.set(23, 7, '#f4ffe0');
    p.set(25, 7, '#f4ffe0');
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
    p.ellipse(24, 24, 14, 12, '#7cf0d2');
    p.ellipse(12, 30, 8, 7, '#c084fc');
    p.ellipse(36, 28, 8, 8, '#67e8f9');
    p.ellipse(24, 16, 6, 5, '#f9a8d4');
    p.outline('#3d6b78');
    p.line(24, 62, 24, 34, '#6a4a8a');
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

function bush(live: boolean, pal?: TreePalette): THREE.CanvasTexture {
  return bake((p) => {
    if (!live) {
      p.line(8, 20, 16, 8, '#5c5148');
      p.line(24, 22, 20, 6, '#4a4038');
      p.line(24, 22, 34, 8, '#6a5e54');
      p.line(16, 16, 10, 12, '#3e352e');
      return;
    }
    const crown = pal?.crown ?? '#7dce4a';
    const lit = pal?.crownTop ?? '#b6e86a';
    const shade = pal?.crownShade ?? '#4caf3a';
    p.ellipse(16, 16, 12, 8, crown);
    p.ellipse(10, 18, 7, 6, lit);
    p.ellipse(22, 18, 6, 5, shade);
    p.outline(pal?.edge ?? '#2f7a32');
    p.set(8, 14, pal?.accent ?? '#ff8fb8');
    p.set(18, 12, '#fff');
    p.set(14, 16, pal?.crownLit ?? '#7ec8f0');
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
    p.line(6, 18, 14, 9, '#8a7c6e');
    p.line(14, 9, 22, 7, '#7a6c60');
    p.line(14, 12, 18, 18, '#94867a');
    p.line(9, 15, 5, 10, '#7a6c60');
    p.set(22, 6, '#b09a7a');
    p.set(7, 11, '#b09a7a');
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
interface FloraPalette {
  grass: string;
  grassHi: string;
  stem: string;
  bloom: string;
  bloom2: string;
  pollen: string;
  tall: string;
  frond: string;
  frondHi: string;
}

const FLORA_PALETTES: FloraPalette[] = [
  // The Dead Forest: warm meadow greens and pink blossoms.
  { grass: '#5cb83a', grassHi: '#a8e870', stem: '#3e8a32', bloom: '#ff8fb8', bloom2: '#7ec8f0', pollen: '#ffe56a', tall: '#c8f28a', frond: '#4caf3a', frondHi: '#a8e870' },
  // Frostbite Forest: cold greens, ice blue and white flowers.
  { grass: '#4fb08f', grassHi: '#9fe8d0', stem: '#2f7a62', bloom: '#bfe6fb', bloom2: '#ffffff', pollen: '#ffe56a', tall: '#c8f0e0', frond: '#3f9c80', frondHi: '#8fdcc4' },
  // Parched Desert: dry olive greens and golden blooms.
  { grass: '#9aa83a', grassHi: '#d8d86a', stem: '#6a7630', bloom: '#ffb45e', bloom2: '#ff8f5e', pollen: '#fff0a8', tall: '#e0d87a', frond: '#7f8c34', frondHi: '#c2c85e' },
  // Toxic Sludge Dump: sickly yellow greens and violet flowers.
  { grass: '#6f9a3a', grassHi: '#b6d86a', stem: '#4a6a2f', bloom: '#c084fc', bloom2: '#ff6f9e', pollen: '#e8ff6a', tall: '#a8c86a', frond: '#5d8a38', frondHi: '#a6c463' },
];

function floraAtlas(palette: FloraPalette = FLORA_PALETTES[0]!): THREE.CanvasTexture {
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
    for (let y = 9; y < 15; y += 1) at(4, 8, y, palette.stem);
    at(4, 7, 12, palette.grass);
    at(4, 9, 11, palette.grass);
    for (const [x, y] of [[7, 6], [9, 6], [8, 5], [8, 7], [7, 7], [9, 7], [7, 5], [9, 5]] as Array<[number, number]>) at(4, x, y, palette.bloom);
    at(4, 8, 6, '#fff3a8');
    // grass tuft
    for (const [x, h] of [[4, 4], [6, 6], [7, 8], [9, 7], [11, 5], [12, 3]] as Array<[number, number]>) {
      for (let y = 15 - h; y < 15; y += 1) at(5, x, y, y < 15 - h + 2 ? palette.grassHi : palette.grass);
    }
    // white and blue trio
    for (const [x, c] of [[4, '#ffffff'], [8, palette.bloom2], [12, '#ffffff']] as Array<[number, string]>) {
      for (let y = 10; y < 15; y += 1) at(6, x, y, palette.stem);
      at(6, x - 1, 9, c);
      at(6, x + 1, 9, c);
      at(6, x, 8, c);
      at(6, x, 10, c);
      at(6, x, 9, palette.pollen);
    }
    // blossom bush
    p.ellipse(7 * 16 + 8, 11, 6, 4.2, '#62be46');
    p.ellipse(7 * 16 + 6, 10, 3.5, 3, '#86d65a');
    for (const [x, y] of [[5, 9], [9, 8], [11, 11], [7, 12], [4, 12]] as Array<[number, number]>) at(7, x, y, palette.bloom);
    at(7, 8, 9, '#ffffff');
    // tall grass
    for (const [x, h] of [[3, 7], [5, 10], [7, 6], [9, 11], [11, 8], [13, 5]] as Array<[number, number]>) {
      for (let y = 15 - h; y < 15; y += 1) at(8, x, y, y < 15 - h + 2 ? palette.tall : palette.grass);
    }
    // cattail reeds
    for (const [x, top] of [[5, 6], [9, 4], [13, 7]] as Array<[number, number]>) {
      for (let y = top + 2; y < 15; y += 1) at(9, x, y, y < top + 5 ? '#a8dc62' : palette.frond);
      p.ellipse(9 * 16 + x, top, 1.5, 2.6, '#8a5a32');
      at(9, x, top - 2, '#c9a06a');
    }
    // clover patch
    for (const [cx, cy] of [[5, 11], [9, 9], [11, 12], [7, 13]] as Array<[number, number]>) {
      for (let y = 13; y < 15; y += 1) at(10, cx, y, palette.stem);
      at(10, cx - 1, cy, palette.frondHi);
      at(10, cx + 1, cy, palette.frondHi);
      at(10, cx, cy - 1, '#b6e86a');
      at(10, cx, cy + 1, palette.grass);
    }
    // mushroom
    for (let y = 10; y < 15; y += 1) at(11, 8, y, '#f4e3c8');
    at(11, 7, 14, '#d9c4a2');
    p.ellipse(11 * 16 + 8, 9, 5, 3, '#ff6f6f');
    at(11, 6, 8, '#fff');
    at(11, 10, 8, '#fff');
    at(11, 8, 7, '#fff');
    // daisy cluster
    for (const [x, top] of [[4, 9], [8, 7], [12, 10]] as Array<[number, number]>) {
      for (let y = top + 2; y < 15; y += 1) at(12, x, y, palette.stem);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) at(12, x + dx, top + dy, '#fff');
      at(12, x, top, palette.pollen);
    }
    // fern frond
    for (let x = 4; x < 13; x += 1) {
      const y = 13 - Math.round(Math.sin(((x - 4) / 8) * Math.PI) * 7);
      at(13, x, y, palette.frond);
      if (x % 2 === 0) {
        at(13, x, y - 1, palette.frondHi);
        at(13, x, y - 2, palette.grassHi);
      }
    }
    // mossy pebble
    p.ellipse(14 * 16 + 8, 12, 6, 3.4, '#9a938c');
    p.ellipse(14 * 16 + 7, 10, 3.5, 2, palette.frondHi);
    at(14, 6, 12, '#b6e86a');
    at(14, 10, 13, '#6a645e');
    // golden bud
    for (let y = 8; y < 15; y += 1) at(15, 8, y, palette.stem);
    at(15, 7, 11, palette.grass);
    at(15, 9, 10, palette.grass);
    p.ellipse(15 * 16 + 8, 6, 3, 3.6, '#ffd36e');
    at(15, 8, 5, '#fff6c2');
    at(15, 6, 7, '#ffb703');
  }, 256, 16);
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
    // raised muddy bank
    p.ellipse(24, 16.5, 21, 11, '#7a6553');
    p.ellipse(24, 15.5, 20.5, 10.2, '#947d66');
    p.ellipse(24, 14.8, 19.5, 9.4, '#a89076');
    // inner basin: wet mud, or open water when restored
    p.ellipse(24, 16, 17, 8.6, full ? '#1a8ec8' : '#4a3c34');
    p.ellipse(24, 15, 15, 7.2, full ? '#3ec4ff' : '#5f4c40');
    p.outline(full ? '#146a9c' : '#3a2e26');
    if (full) {
      p.line(12, 14, 20, 12, '#dff6ff');
      p.line(24, 18, 33, 16, '#dff6ff');
      p.set(16, 15, '#ffffff');
      p.set(31, 17, '#bfeaff');
    } else {
      // cracked mud
      p.line(12, 14, 20, 19, '#3a2e26');
      p.line(22, 12, 34, 17, '#3a2e26');
      p.line(18, 15, 18, 18, '#3a2e26');
      p.line(27, 13, 27, 17, '#3a2e26');
      p.set(28, 14, '#6b5850');
    }
  }, 48, 32);
}

/** Inner water ellipse only: scales up inside the basin so the pond visibly fills. */
function pondWater(shimmer: boolean): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(24, 17, 19, 9.5, '#3ec4ff');
    p.ellipse(24, 18.5, 16, 6.5, '#1a9be0');
    p.ellipse(24, 15.5, 13, 4.5, '#7fdcff');
    if (shimmer) {
      p.line(12, 15, 20, 13, '#e8f8ff');
      p.line(24, 19, 33, 16, '#e8f8ff');
      p.line(15, 18, 22, 19, '#bfeaff');
      p.set(28, 14, '#ffffff');
      p.set(18, 17, '#ffffff');
    } else {
      p.line(14, 17, 21, 16, '#d6f2ff');
      p.line(26, 18, 34, 17, '#d6f2ff');
      p.set(20, 14, '#ffffff');
    }
  }, 48, 32);
}

/** Reed stalk for one bank of a pond — keeps the open side clear for water. */
function cattail(): THREE.CanvasTexture {
  return bake((p) => {
    for (let y = 9; y < 22; y += 1) {
      p.set(11, y, '#5c4a3a');
      p.set(12, y, '#6b5848');
      p.set(13, y, '#5c4a3a');
    }
    p.ellipse(12, 6.5, 3.2, 5.8, '#3f342c');
    p.ellipse(12, 5.5, 2.4, 4.4, '#524538');
    p.set(10, 7, '#2f2a24');
    p.set(14, 7, '#2f2a24');
    p.ellipse(9, 17, 2.2, 1.4, '#6fa84a');
    p.ellipse(15, 19, 2, 1.2, '#7dce4a');
    p.set(12, 21, '#5cb83a');
  }, 24, 26);
}

/** Lily pad with an optional water-lily bloom. */
function lilyPad(flower: boolean): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(12, 12, 10, 6, '#4caf3a');
    p.ellipse(11, 11, 7, 4, '#7dce4a');
    p.line(12, 12, 18, 7, '#2f7a32');
    p.set(8, 10, '#b6e86a');
    p.outline('#2f7a32');
    if (flower) {
      p.ellipse(12, 5, 4, 3, '#ff8fb8');
      p.ellipse(12, 4, 2.6, 2, '#ffd9e8');
      p.set(12, 4, '#ffe56a');
      p.set(9, 5, '#fff');
      p.set(15, 6, '#ff6f9e');
    }
  }, 24, 18);
}

/** Tiny green sprout that bridges dead decor and the grown bush/tree. */
function bushSprout(): THREE.CanvasTexture {
  return bake((p) => {
    for (let y = 10; y < 17; y += 1) p.set(12, y, '#3e8a32');
    p.ellipse(9, 10, 3.4, 2.4, '#7dce4a');
    p.ellipse(15, 9, 3.2, 2.2, '#b6e86a');
    p.set(12, 7, '#b6e86a');
    p.set(8, 12, '#5cb83a');
    p.set(16, 12, '#5cb83a');
  }, 24, 20);
}

/** Young tree: trunk first, two leaf clumps, so trees visibly grow in. */
function sapling(): THREE.CanvasTexture {
  return bake((p) => {
    p.line(16, 38, 16, 20, '#6a4a2a');
    p.line(15, 38, 15, 24, '#8a6038');
    p.line(16, 26, 10, 21, '#8a6038');
    p.line(16, 24, 22, 20, '#8a6038');
    p.ellipse(10, 18, 5, 4, '#5cb83a');
    p.ellipse(22, 17, 5.5, 4.5, '#7dce4a');
    p.ellipse(16, 14, 6, 4.6, '#b6e86a');
    p.outline('#2f7a32');
    p.set(14, 14, '#dff8b0');
  }, 32, 40);
}

/** Translucent gust streak for wind trails. */
function windStreak(): THREE.CanvasTexture {
  return bake((p) => {
    for (let x = 2; x < 62; x += 1) {
      const t = x / 64;
      const thick = Math.max(1, Math.round(Math.sin(t * Math.PI) * 3.2));
      for (let y = 0; y < thick; y += 1) p.set(x, 6 + y - Math.floor(thick / 2), y === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(235,248,255,0.34)');
    }
    p.set(60, 6, 'rgba(255,255,255,0.7)');
  }, 64, 12);
}

/** Big soft backdrop cloud, much larger and fluffier than the hero cloud. */
function softCloud(): THREE.CanvasTexture {
  return bake((p) => {
    const blobs: Array<[number, number, number, number]> = [
      [64, 38, 40, 15],
      [34, 42, 24, 12],
      [94, 42, 24, 12],
      [48, 30, 22, 12],
      [82, 30, 20, 11],
      [64, 24, 18, 10],
    ];
    for (const [x, y, rx, ry] of blobs) p.ellipse(x, y, rx, ry, 'rgba(255,255,255,0.85)');
    for (const [x, y, rx, ry] of blobs) p.ellipse(x, y - ry * 0.32, rx * 0.82, ry * 0.62, 'rgba(255,255,255,0.9)');
  }, 128, 64, true);
}

/** Standing rainbow arc: fades in once most of an island is alive. */
function rainbowArc(): THREE.CanvasTexture {
  return bake((p) => {
    const bands: Array<[number, string]> = [
      [62, 'rgba(255,110,110,0.5)'],
      [56, 'rgba(255,190,110,0.5)'],
      [50, 'rgba(255,246,140,0.46)'],
      [44, 'rgba(140,230,150,0.46)'],
      [38, 'rgba(130,200,255,0.5)'],
      [32, 'rgba(190,150,255,0.42)'],
    ];
    for (const [radius, color] of bands) {
      for (let a = 0; a <= 180; a += 1) {
        const rad = (a * Math.PI) / 180;
        const x = 128 - Math.cos(rad) * radius;
        const y = 122 - Math.sin(rad) * radius;
        p.set(x, y, color);
        p.set(x, y + 1, color.replace(/0\.\d+\)$/, '0.22)'));
      }
    }
  }, 256, 128);
}

/** Warm radial glow used behind the sun and under god rays. */
function sunGlow(): THREE.CanvasTexture {
  return bake(
    (p) => {
      for (let r = 40; r > 0; r -= 1) {
        const k = 1 - r / 40;
        const a = Math.pow(k, 2.1) * 0.5;
        p.ellipse(40, 40, r, r * 0.92, `rgba(255,238,190,${a.toFixed(3)})`);
      }
      p.ellipse(40, 40, 9, 9, 'rgba(255,248,220,0.6)');
      p.ellipse(40, 40, 5, 5, 'rgba(255,252,240,0.75)');
    },
    80,
    80,
    true,
  );
}

/** Falling petal / pollen motes for ambient life. */
function petalBit(): THREE.CanvasTexture {
  return bake((p) => {
    p.ellipse(4, 4, 3, 1.8, '#ffb3d0');
    p.set(3, 4, '#ff8fb8');
    p.set(5, 3, '#fff');
  }, 8, 8);
}

function pollenBit(): THREE.CanvasTexture {
  return bake((p) => {
    p.set(2, 2, '#fff6c2');
    p.set(1, 2, 'rgba(255,240,190,0.7)');
    p.set(2, 1, 'rgba(255,240,190,0.7)');
    p.set(3, 2, 'rgba(255,240,190,0.55)');
    p.set(2, 3, 'rgba(255,240,190,0.55)');
  }, 5, 5);
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
  space: THREE.CanvasTexture;
  mountain: THREE.CanvasTexture;
  parallaxIslands: THREE.CanvasTexture[];
  hills: THREE.CanvasTexture[];
  deadTop: THREE.CanvasTexture[];
  liveTop: THREE.CanvasTexture[];
  deadCliff: THREE.CanvasTexture[];
  liveCliff: THREE.CanvasTexture[];
  lip: THREE.CanvasTexture;
  deadTree: THREE.CanvasTexture[];
  liveTree: THREE.CanvasTexture[];
  grove: THREE.CanvasTexture[];
  /** A grove of trees for each island, in the colours of that island. */
  groveByWorld: THREE.CanvasTexture[][];
  bushByWorld: THREE.CanvasTexture[];
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
  pondWaterA: THREE.CanvasTexture;
  pondWaterB: THREE.CanvasTexture;
  lilyPad: THREE.CanvasTexture;
  lilyPadFlower: THREE.CanvasTexture;
  cattail: THREE.CanvasTexture;
  bushSprout: THREE.CanvasTexture;
  sapling: THREE.CanvasTexture;
  windStreak: THREE.CanvasTexture;
  softCloud: THREE.CanvasTexture;
  rainbow: THREE.CanvasTexture;
  sunGlow: THREE.CanvasTexture;
  petal: THREE.CanvasTexture;
  pollen: THREE.CanvasTexture;
  seed: THREE.CanvasTexture;
  drop: THREE.CanvasTexture;
  star: THREE.CanvasTexture;
  leaf: THREE.CanvasTexture;
  spark: THREE.CanvasTexture;
  heart: THREE.CanvasTexture;
  tornado: THREE.CanvasTexture;
  butterfly: THREE.CanvasTexture;
  bird: THREE.CanvasTexture;
  sun: THREE.CanvasTexture;
  barrel: THREE.CanvasTexture;
  flora: THREE.CanvasTexture;
  /** The same plants, in the colours of each island. */
  floraByWorld: THREE.CanvasTexture[];
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
    space: spaceCanvas(),
    parallaxIslands: [0, 1, 2, 3, 4, 5].map((i) => drawParallaxIsland(i)),
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
      cliffTex(['#dfe6ee', '#b3bccb', '#8b95a6', '#6b7484']),
      cliffTex(['#ead7b0', '#d2b48a', '#b8926a', '#8c6a48']),
      cliffTex(['#6a8a40', '#4e682c', '#7a5ea0', '#3a4424']),
    ],
    liveCliff: [
      cliffTex(['#7dce4a', '#6b4428', '#8a5a32', '#4a2e1c']),
      cliffTex(['#cdeaf4', '#9dc0cf', '#7d9dae', '#5d7c8c']),
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
    liveTree: [cherryTree(TREE_PALETTES[0]!), pineTree('#9be7ff', '#5eb0d4'), cactusTree(), alienTree()],
    grove: [
      oakTree(TREE_PALETTES[0]!),
      birchTree(TREE_PALETTES[0]!),
      cherryTree(TREE_PALETTES[0]!),
      pineTree('#3f9a3a', '#1f4a22'),
      oakTree(TREE_PALETTES[0]!),
      birchTree(TREE_PALETTES[0]!),
    ],
    groveByWorld: [
      // The Dead Forest: oak, birch, cherry and pine.
      [
        oakTree(TREE_PALETTES[0]!),
        birchTree(TREE_PALETTES[0]!),
        cherryTree(TREE_PALETTES[0]!),
        pineTree('#3f9a3a', '#1f4a22'),
        oakTree(TREE_PALETTES[0]!),
        birchTree(TREE_PALETTES[0]!),
      ],
      // Frostbite Forest: frosted pines and pale birches.
      [
        pineTree('#9be7ff', '#4a7fa8'),
        pineTree('#cfeef8', '#5f8fa8'),
        birchTree(TREE_PALETTES[1]!),
        oakTree(TREE_PALETTES[1]!),
        pineTree('#8fd4e8', '#3f6a86'),
        birchTree(TREE_PALETTES[1]!),
      ],
      // Parched Desert: cacti and dry, tough trees.
      [
        cactusTree(),
        oakTree(TREE_PALETTES[2]!),
        pineTree('#9aa83a', '#5f6a22'),
        cactusTree(),
        oakTree(TREE_PALETTES[2]!),
        pineTree('#b6b055', '#6a6a2c'),
      ],
      // Toxic Sludge Dump: things that should not be growing.
      [
        alienTree(),
        pineTree('#c084fc', '#5f3a8a'),
        oakTree(TREE_PALETTES[3]!),
        alienTree(),
        pineTree('#7cf0d2', '#2f6a72'),
        oakTree(TREE_PALETTES[3]!),
      ],
    ],
    bushByWorld: [
      bush(true, TREE_PALETTES[0]),
      bush(true, TREE_PALETTES[1]),
      bush(true, TREE_PALETTES[2]),
      bush(true, TREE_PALETTES[3]),
    ],
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
    pondWaterA: pondWater(false),
    pondWaterB: pondWater(true),
    lilyPad: lilyPad(false),
    lilyPadFlower: lilyPad(true),
    cattail: cattail(),
    bushSprout: bushSprout(),
    sapling: sapling(),
    windStreak: windStreak(),
    softCloud: softCloud(),
    rainbow: rainbowArc(),
    sunGlow: sunGlow(),
    petal: petalBit(),
    pollen: pollenBit(),
    seed: seedSprite(),
    drop: dropSprite(),
    star: bit('star'),
    leaf: bit('leaf'),
    spark: bit('spark'),
    heart: bit('heart'),
    tornado: tornadoSprite(),
    butterfly: butterfly(),
    bird: drawBird(),
    sun: drawSun(),
    barrel: barrel(),
    flora: floraAtlas(FLORA_PALETTES[0]!),
    floraByWorld: FLORA_PALETTES.map((palette) => floraAtlas(palette)),
  };
  return cached;
}

