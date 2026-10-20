// Procedural pixel-art textures for the Blockbench billboard tree.
// Art direction: HD-2D / Octopath-ish — distinct foliage masses, leafy serrated
// silhouettes, warm sun rim, deep teal shadows, readable clumps instead of noise.
// Pure Node + zlib, deterministic.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'assets/tree-src');
mkdirSync(outDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Greens: teal-shadowed base -> rich mids -> warm sunlit tips.
const C = {
  ink: '#061c17',
  deep: '#082a23',
  teal: '#0b3d33',
  teal2: '#0f5040',
  shadow: '#123f2c',
  mid1: '#175c35',
  mid2: '#1e7a40',
  mid3: '#2a964a',
  body: '#36ad52',
  bright: '#54c85c',
  lime: '#8fe86a',
  neon: '#c8ff8a',
  sun: '#ffd166',
  sunHot: '#ffe9a8',
  sunDeep: '#f0a83c',
  blossom: '#ff9fbd',
  bark1: '#160c06',
  bark2: '#24140c',
  bark3: '#2e1c12',
  bark4: '#432a18',
  bark5: '#5e3c22',
  bark6: '#7d502c',
  bark7: '#a06a3c',
  bark8: '#c78f52',
  moss1: '#2a4e2a',
  moss2: '#3e7a3a',
  moss3: '#6aaa4a',
};

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const mix = (a, b, t) => {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `#${[ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
    .join('')}`;
};

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Art {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  put(x, y, color) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const [r, g, b] = rgb(color);
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }
  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }
  /** Tapered leaf with a lit upper edge and a shaded underside. */
  leaf(cx, cy, ang, len, wid, lit, body, shade, tip) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const R = len + 2;
    for (let y = Math.floor(cy - R); y <= cy + R; y += 1) {
      for (let x = Math.floor(cx - R); x <= cx + R; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const u = (dx * ca + dy * sa) / len;
        const v = (-dx * sa + dy * ca) / wid;
        if (u < 0.02 || u > 1) continue;
        const taper = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.02)), 0.7);
        if (Math.abs(v) > taper) continue;
        let col = body;
        if (v < -0.34) col = lit;
        else if (v > 0.4) col = shade;
        if (u > 0.9 && tip) col = tip;
        this.put(x, y, col);
      }
    }
  }
  /** Fan of leaves radiating from a point. */
  cluster(cx, cy, baseAng, count, lenMin, lenMax, spread, pal, rnd) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const ang = baseAng + (t - 0.5) * spread + (rnd() - 0.5) * 0.12;
      const len = lenMin + rnd() * (lenMax - lenMin);
      const wid = len * (0.3 + rnd() * 0.1);
      const reach = len * (0.04 + rnd() * 0.08);
      this.leaf(cx + Math.cos(ang) * reach, cy + Math.sin(ang) * reach, ang, len, wid, pal.lit, pal.body, pal.shade, pal.tip);
    }
  }
  /**
   * Foliage mass: flat base volume + leafy serrated perimeter + interior tufts.
   * `flat` skips broad gradient bands so overlapping masses don't read as cabbages.
   */
  puff(cx, cy, rx, ry, pal, seed, options = {}) {
    const wob = options.wobble ?? 0.05;
    const lobes = options.lobes ?? 9;
    const R = Math.max(rx, ry) + 3;
    for (let y = Math.floor(cy - R); y <= cy + R; y += 1) {
      for (let x = Math.floor(cx - R); x <= cx + R; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const q = nx * nx + ny * ny;
        const ang = Math.atan2(ny, nx);
        const edge = 1 + Math.sin(ang * lobes + seed) * wob + Math.sin(ang * 3 - seed * 0.7) * wob * 0.75;
        if (q > edge * edge) continue;
        const sun = -nx * 0.74 - ny * 0.64 + Math.sin(x * 0.17 + y * 0.13 + seed) * 0.05;
        let col = pal.body;
        if (options.flat) {
          if (q > 0.78) col = sun > 0.02 ? pal.light : pal.shade;
          if (q > 0.9 && sun > 0.42) col = pal.hi;
          if (options.crevice && q > 0.9 && sun < -0.2) col = options.crevice;
        } else {
          if (sun > 0.5) col = pal.hi;
          else if (sun > 0.16) col = pal.light;
          else if (sun < -0.46) col = pal.shade;
          if (q > 0.86) col = sun > -0.05 ? pal.light : pal.shade;
          if (options.crevice && q > 0.82 && sun < -0.08) col = options.crevice;
        }
        this.put(x, y, col);
      }
    }
  }
  outline(color) {
    const src = this.data.slice();
    const [r, g, b] = rgb(color);
    const { w, h } = this;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (src[(y * w + x) * 4 + 3] === 0) continue;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = (ny * w + nx) * 4;
            if (src[ni + 3] !== 0) continue;
            this.data[ni] = r;
            this.data[ni + 1] = g;
            this.data[ni + 2] = b;
            this.data[ni + 3] = 255;
          }
        }
      }
    }
  }
  /** Warm sun rim on the upper-left arc only — never a glowing seam all around. */
  sunRim(lit, hot, cx = this.w / 2, cy = this.h / 2) {
    const src = this.data.slice();
    const { w, h } = this;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (!src[(y * w + x) * 4 + 3]) continue;
        const near = !this.alphaAt(x, y - 1) || !this.alphaAt(x - 1, y) || !this.alphaAt(x - 1, y - 1);
        if (!near) continue;
        const sun = -(x - cx) * 0.72 - (y - cy) * 0.69;
        if (sun < 10) continue;
        this.put(x, y, sun > 96 ? hot : lit);
      }
    }
  }
  motes(rnd, count, bounds) {
    for (let i = 0; i < count; i += 1) {
      const x = Math.floor(bounds.x + rnd() * bounds.w);
      const y = Math.floor(bounds.y + rnd() * bounds.h);
      if (!this.alphaAt(x, y) || !this.alphaAt(x + 1, y) || !this.alphaAt(x, y + 1) || !this.alphaAt(x + 1, y + 1)) continue;
      this.put(x, y, i % 4 === 0 ? C.sunHot : C.sun);
      this.put(x + 1, y, i % 4 === 0 ? C.sunHot : C.sun);
      this.put(x, y + 1, C.sunDeep);
      this.put(x + 1, y + 1, C.sunDeep);
    }
    for (let i = 0; i < 3; i += 1) {
      const x = Math.floor(bounds.x + rnd() * bounds.w);
      const y = Math.floor(bounds.y + rnd() * bounds.h);
      if (!this.alphaAt(x, y)) continue;
      this.put(x, y, C.blossom);
      this.put(x + 1, y, mix(C.blossom, '#ffffff', 0.35));
      this.put(x, y + 1, mix(C.blossom, C.ink, 0.25));
    }
  }
  save(name) {
    const file = resolve(outDir, name);
    writeFileSync(file, png(this.w, this.h, this.data));
    let opaque = 0;
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] > 8) opaque += 1;
    return { name, file, coverage: +(opaque / (this.w * this.h)).toFixed(3) };
  }
}

const P = {
  back: { body: C.mid1, light: C.mid2, hi: C.mid3, shade: C.deep, lit: C.mid2, tip: C.mid3 },
  deep: { body: C.shadow, light: C.teal2, hi: C.mid1, shade: C.deep, lit: C.teal2, tip: C.mid1 },
  mid: { body: C.mid2, light: C.mid3, hi: C.bright, shade: C.mid1, lit: C.mid3, tip: C.bright },
  front: { body: C.mid3, light: C.body, hi: C.bright, shade: C.mid1, lit: C.body, tip: C.lime },
  sun: { body: C.body, light: C.bright, hi: C.lime, shade: C.mid2, lit: C.bright, tip: C.neon },
  gold: { body: C.bright, light: C.lime, hi: C.sun, shade: C.mid2, lit: C.lime, tip: C.sunHot },
};
const under = (pal) =>
  pal === P.front ? P.mid : pal === P.sun ? P.front : pal === P.gold ? P.sun : pal === P.mid ? P.deep : P.deep;

/** One foliage mass: shaded underlayer, body, leafy perimeter, interior tufts. */
function mass(a, rnd, cx, cy, rx, ry, pal, opts = {}) {
  const seed = rnd() * 9;
  if (opts.under !== false) {
    a.puff(cx + 4, cy + 6, rx * 0.97, ry * 0.97, under(pal), seed + 1.7, { flat: true });
  }
  a.puff(cx, cy, rx, ry, pal, seed, { flat: true, crevice: C.deep });
  // serrated leaf silhouette
  const n = Math.max(8, Math.round((rx + ry) * 0.19));
  for (let i = 0; i < n; i += 1) {
    const ang = -Math.PI * 0.92 + (i / (n - 1)) * Math.PI * 1.84 + (rnd() - 0.5) * 0.1;
    const lx = cx + Math.cos(ang) * rx * 0.86;
    const ly = cy + Math.sin(ang) * ry * 0.86;
    const len = (opts.leafMin ?? 7) + rnd() * (opts.leafMax ?? 11);
    a.leaf(lx, ly, ang + (rnd() - 0.5) * 0.2, len, len * (0.32 + rnd() * 0.08), pal.lit, pal.body, pal.shade, pal.tip);
  }
  // interior leaf tufts break up the flat body
  const tufts = opts.tufts ?? 3;
  for (let i = 0; i < tufts; i += 1) {
    const tx = cx + (rnd() - 0.5) * rx * 1.25;
    const ty = cy + (rnd() - 0.5) * ry * 1.05;
    const dx = (tx - cx) / rx;
    const dy = (ty - cy) / ry;
    if (dx * dx + dy * dy > 0.62) continue;
    const ang = -Math.PI * 0.65 + rnd() * Math.PI * 0.9;
    a.puff(tx, ty, rx * 0.27, ry * 0.25, pal, rnd() * 9, { flat: true });
    a.cluster(tx, ty, ang, 6, rx * 0.22, rx * 0.4, 2.1, pal, rnd);
  }
}

/** Flat pixel ellipse, used for the dark cluster core. */
function ell(a, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1.02) a.put(x, y, color);
    }
  }
}

const CLUSTER_PALETTES = {
  sun: {
    base: { dark: C.mid2, body: C.mid3, light: C.body, hi: C.bright },
    back: { body: C.mid3, lit: C.body, shade: C.mid2, tip: C.mid3 },
    mid: { body: C.body, lit: C.bright, shade: C.mid3, tip: C.lime },
    front: { body: C.bright, lit: C.lime, shade: C.body, tip: C.lime },
  },
  mid: {
    base: { dark: C.mid1, body: C.mid2, light: C.mid3, hi: C.body },
    back: { body: C.mid2, lit: C.mid3, shade: C.mid1, tip: C.mid3 },
    mid: { body: C.mid3, lit: C.body, shade: C.mid2, tip: C.bright },
    front: { body: C.body, lit: C.bright, shade: C.mid3, tip: C.lime },
  },
  deep: {
    base: { dark: C.teal, body: C.teal2, light: C.mid1, hi: C.mid2 },
    back: { body: C.teal2, lit: C.mid1, shade: C.teal, tip: C.mid1 },
    mid: { body: C.mid1, lit: C.mid2, shade: C.teal2, tip: C.mid2 },
    front: { body: C.mid2, lit: C.mid3, shade: C.mid1, tip: C.mid3 },
  },
};

/** Branch-tip card: curved bough carrying irregular clumps of small leaves. */
function leafCluster(kind, seed) {
  const pal = CLUSTER_PALETTES[kind];
  const a = new Art(128, 128);
  const rnd = mulberry(seed);

  // tapered bough: dark core, single lit edge
  const bough = (x0, y0, x1, y1, w0, w1) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      const w = w0 + (w1 - w0) * t;
      const hw = Math.max(0, Math.round(w / 2));
      for (let d = -hw; d <= hw; d += 1) {
        a.put(x + d, y, d < 0 ? C.bark5 : d > 0 ? C.bark1 : C.bark3);
      }
    }
  };

  const spine = [[64, 118], [62, 104], [58, 90], [54, 76], [49, 60], [45, 44], [42, 30]];
  for (let i = 0; i < spine.length - 1; i += 1) {
    bough(spine[i][0], spine[i][1], spine[i + 1][0], spine[i + 1][1], 3.2 - i * 0.33, 2.87 - i * 0.33);
  }
  bough(58, 90, 82, 84, 1.9, 1.1);
  bough(82, 84, 96, 70, 1.1, 0.8);
  bough(54, 76, 30, 68, 1.9, 1.1);
  bough(30, 68, 20, 52, 1.1, 0.8);
  bough(49, 60, 66, 50, 1.5, 0.9);
  bough(66, 50, 74, 36, 0.9, 0.7);
  bough(62, 104, 40, 100, 1.5, 0.9);
  bough(40, 100, 30, 88, 0.9, 0.7);

  const clumps = [
    [42, 30, 15], [46, 44, 15], [68, 42, 14], [94, 68, 14],
    [20, 54, 12], [32, 66, 14], [58, 76, 16], [82, 86, 14],
    [42, 92, 13], [26, 86, 11], [96, 52, 11], [64, 58, 15],
    [68, 104, 12], [50, 112, 10],
  ];

  const leafList = [];
  for (const [ccx, ccy, cr] of clumps) {
    // small opaque heart keeps the clump from turning into lace
    ell(a, ccx + 2, ccy + 3, cr * 0.5, cr * 0.46, pal.base.body);
    ell(a, ccx - 1, ccy - 1, cr * 0.34, cr * 0.32, pal.base.light);
    const count = 13 + Math.floor(rnd() * 5);
    for (let i = 0; i < count; i += 1) {
      const th = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * cr * 0.95;
      const x = ccx + Math.cos(th) * rr;
      const y = ccy + Math.sin(th) * rr;
      const outward = Math.atan2(y - ccy, x - ccx);
      const dir = rnd() < 0.28 ? outward + Math.PI * 0.5 + (rnd() - 0.5) * 0.5 : outward + (rnd() - 0.5) * 1.5;
      const len = 4.5 + rnd() * 5;
      const wid = len * (0.36 + rnd() * 0.12);
      const s = (62 - x) * 0.45 + (66 - y) * 0.55 + (rnd() - 0.5) * 9;
      const group = s > 5 ? 'front' : s < -6 ? 'back' : 'mid';
      leafList.push({ x, y, dir, len, wid, group });
    }
    for (let i = 0; i < 3; i += 1) {
      const th = 0.4 + rnd() * 2.2;
      const rr = rnd() * cr * 0.7;
      const x = ccx + 2 + Math.cos(th) * rr;
      const y = ccy + 3 + Math.sin(th) * rr;
      const len = 4 + rnd() * 3.5;
      leafList.push({ x, y, dir: th + (rnd() - 0.5) * 1.4, len, wid: len * 0.4, group: 'back' });
    }
  }

  leafList.sort((l, r) => l.y - r.y);
  for (const group of ['back', 'mid', 'front']) {
    const p = pal[group];
    for (const l of leafList) {
      if (l.group !== group) continue;
      a.leaf(l.x, l.y, l.dir, l.len, l.wid, p.lit, p.body, p.shade, p.tip);
    }
  }

  if (kind === 'sun') {
    for (let i = 0; i < 3; i += 1) {
      const x = 34 + Math.floor(rnd() * 44);
      const y = 32 + Math.floor(rnd() * 44);
      if (!a.alphaAt(x, y) || !a.alphaAt(x + 1, y)) continue;
      a.put(x, y, '#eaff9a');
      a.put(x + 1, y, C.lime);
    }
  }

  return a;
}

/** Thick tapered trunk, flared roots, forked limbs reaching into the crown. */
function trunk() {
  const a = new Art(128, 256);
  const rnd = mulberry(505);
  const cxAt = (y) => 64 + Math.sin((y - 80) * 0.012) * 4;
  const halfAt = (y) => {
    if (y > 228) return 40 + (y - 228) * 0.75;
    if (y > 140) return 22 + ((y - 140) / 88) * 18;
    return 22;
  };
  for (let y = 140; y < 250; y += 1) {
    const cx = cxAt(y);
    const hw = halfAt(y);
    for (let x = Math.floor(cx - hw); x <= cx + hw; x += 1) {
      const t = (x - (cx - hw)) / (hw * 2);
      let col = C.bark4;
      if (t < 0.08) col = C.bark8;
      else if (t < 0.2) col = C.bark7;
      else if (t < 0.36) col = C.bark6;
      else if (t < 0.5) col = C.bark5;
      else if (t > 0.88) col = C.bark2;
      else if (t > 0.72) col = C.bark3;
      a.put(x, y, col);
    }
    if (y % 6 === 0) {
      const x0 = Math.floor(cx - hw * 0.55 + rnd() * hw * 0.45);
      for (let k = 0; k < 2 + ((rnd() * 3) | 0); k += 1) a.put(x0 + k, y + (k % 2), C.bark3);
    }
    if (y % 9 === 0) {
      const x0 = Math.floor(cx + hw * 0.2 + rnd() * hw * 0.2);
      a.put(x0, y, C.bark7);
      a.put(x0 + 1, y + 1, C.bark6);
    }
    if (y % 23 === 0) {
      const x0 = Math.floor(cx - hw * 0.2);
      for (let d = -1; d <= 1; d += 1) a.put(x0 + d, y + Math.abs(d), C.bark2);
    }
  }
  // central bark ridge masks the crossed-plane seam and adds character
  for (let y = 148; y < 250; y += 1) {
    const cx = Math.round(cxAt(y) + Math.sin(y * 0.08) * 1.5);
    a.put(cx, y, C.bark3);
    a.put(cx + 1, y, C.bark2);
    a.put(cx - 1, y, C.bark5);
    if (y % 9 < 2) a.put(cx - 2, y, C.bark6);
  }
  for (const [y, dx, len] of [[172, 7, 7], [196, -9, 6], [214, 6, 8], [236, -7, 5]]) {
    const cx = cxAt(y);
    for (let i = 0; i < len; i += 1) a.put(cx + dx + i, y + (i % 3 === 0 ? 1 : 0), C.bark2);
  }
  const root = (x0, y0, x1, y1, w0, w1) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const w = w0 + (w1 - w0) * t;
      for (let d = -w; d <= w; d += 1) {
        const c = d < -w * 0.3 ? C.bark7 : d > w * 0.35 ? C.bark2 : C.bark4;
        a.put(x + d, y + Math.abs(d) * 0.18, c);
      }
    }
  };
  root(54, 224, 16, 250, 10, 3);
  root(60, 230, 32, 254, 9, 3);
  root(74, 228, 98, 252, 10, 3);
  root(82, 222, 114, 246, 8, 2.5);
  root(68, 236, 50, 255, 7, 2);
  root(78, 236, 82, 255, 7, 2);
  const limb = (x0, y0, x1, y1, w0, w1) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t + Math.sin(t * 5) * 1.2;
      const y = y0 + (y1 - y0) * t;
      const w = w0 + (w1 - w0) * t;
      for (let d = -w; d <= w; d += 1) {
        const c = d < -w * 0.28 ? C.bark7 : d > w * 0.32 ? C.bark2 : d > 0 ? C.bark5 : C.bark4;
        a.put(x + d, y, c);
      }
    }
  };
  const chain = (pts, w0, w1) => {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const wa = w0 + (w1 - w0) * (i / (pts.length - 1));
      const wb = w0 + (w1 - w0) * ((i + 1) / (pts.length - 1));
      limb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], wa, wb);
    }
  };
  chain([[62, 150], [38, 122], [26, 94], [18, 64], [14, 40]], 16, 4);
  chain([[66, 144], [90, 120], [104, 92], [112, 64], [114, 44]], 15, 3.5);
  chain([[66, 146], [70, 112], [76, 80], [80, 56]], 9, 3);
  chain([[38, 122], [20, 108], [12, 94]], 6, 2);
  chain([[90, 120], [100, 104]], 5, 2);
  chain([[48, 128], [38, 112], [32, 100]], 4.5, 1.8);
  chain([[104, 92], [116, 78]], 4, 1.5);
  chain([[26, 94], [14, 86]], 3.5, 1.4);
  for (const [x, y, r] of [[52, 192, 3], [76, 166, 2], [48, 150, 2], [70, 212, 2], [58, 236, 2]]) {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (dx * dx + dy * dy <= r * r) a.put(x + dx, y + dy, dy < 0 ? C.bark2 : C.bark4);
    }
    a.put(x - r, y - r + 1, C.bark7);
  }
  const moss = (x, y, r) => {
    for (let i = 0; i < r; i += 1) {
      a.put(x + (i % 2), y + i, i % 3 ? C.moss2 : C.moss1);
      a.put(x + 1, y + i, i % 3 ? C.moss2 : C.moss3);
    }
  };
  for (const [x, y, r] of [[42, 224, 14], [36, 240, 9], [50, 202, 8], [88, 234, 7], [56, 172, 6], [50, 152, 5], [80, 246, 5], [30, 112, 6], [88, 104, 5], [18, 76, 4], [104, 82, 4], [70, 98, 4]]) moss(x, y, r);
  a.outline(C.bark1);
  return a;
}

function fern() {
  const a = new Art(64, 64);
  const rnd = mulberry(88);
  const baseX = 32;
  const baseY = 60;
  const blade = (ang, len, lit, body, tip) => {
    for (let i = 0; i <= len; i += 1) {
      const t = i / len;
      const x = baseX + Math.cos(ang) * i;
      const y = baseY + Math.sin(ang) * i - Math.sin(t * 3.1) * 2;
      const c = i < len * 0.32 ? lit : i > len * 0.88 ? tip : body;
      a.put(x, y, c);
      a.put(x + 1, y, body);
      if (i > len * 0.5 && i % 4 < 2) a.put(x + 2, y, body);
    }
  };
  for (let i = 0; i < 11; i += 1) {
    const ang = -Math.PI * 0.98 + (i / 10) * Math.PI * 0.96 + (rnd() - 0.5) * 0.1;
    blade(ang, 16 + rnd() * 22, i % 3 ? C.mid3 : C.bright, i % 2 ? C.mid2 : C.mid1, i % 4 ? C.bright : C.lime);
  }
  a.sunRim(C.lime, C.bright, 32, 40);
  a.outline(C.ink);
  return a;
}

/** Seamless bark tile wrapped around the 3D trunk, limbs, and roots. */
function barkTile() {
  const a = new Art(256, 256);
  const rnd = mulberry(4242);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      // Phase-shifted so the tile center (trunk front with the seam at the back)
      // lands on a lit bark ridge instead of a dark groove.
      const p = (x / 256) * Math.PI * 2 + Math.PI / 2;
      let h = Math.sin(p * 6 + 0.4) * 0.55 + Math.sin(p * 10 + 1.9) * 0.3 + Math.sin(p * 14 + 0.7) * 0.15;
      h += Math.sin(y * 0.05 + p) * 0.05;
      h += Math.sin(y * 0.017 + p * 2) * 0.03;
      let col = C.bark2;
      if (h > 0.74) col = C.bark7;
      else if (h > 0.42) col = C.bark6;
      else if (h > 0.12) col = C.bark5;
      else if (h > -0.18) col = C.bark4;
      else if (h > -0.5) col = C.bark3;
      a.put(x, y, col);
    }
  }
  for (const base of [28, 86, 152, 216]) {
    for (let y = 0; y < 256; y += 1) {
      if (rnd() < 0.25) continue;
      const x = base + Math.round(Math.sin(y * 0.09 + base * 0.5) * 2);
      a.put(x, y, C.bark2);
      a.put(x + 1, y, C.bark1);
      if (rnd() < 0.3) a.put(x - 1, y, C.bark4);
    }
  }
  for (let i = 0; i < 7; i += 1) {
    const cx = 16 + Math.floor(rnd() * 224);
    const cy = 12 + Math.floor(rnd() * 232);
    const len = 2 + Math.floor(rnd() * 4);
    for (let j = 0; j < len; j += 1) a.put(cx + j, cy + (j % 3 === 0 ? 1 : 0), C.bark3);
  }
  for (const [kx, ky, kr] of [[68, 74, 3], [184, 156, 3], [44, 206, 2], [220, 96, 2]]) {
    ell(a, kx, ky, kr + 1, kr * 0.8 + 1, C.bark2);
    ell(a, kx, ky, kr, kr * 0.75, C.bark4);
    ell(a, kx, ky, Math.max(1, kr - 2), Math.max(1, kr * 0.4), C.bark1);
    a.put(kx - kr, ky - kr + 1, C.bark7);
    a.put(kx - kr + 1, ky - kr + 1, C.bark6);
  }
  for (let i = 0; i < 560; i += 1) {
    const x = Math.floor(rnd() * 256);
    const y = Math.floor(rnd() * 256);
    const c = rnd() < 0.5 ? C.bark2 : C.bark6;
    a.put(x, y, c);
    if (rnd() < 0.4) a.put(x + 1, y, c);
  }
  for (let i = 0; i < 22; i += 1) {
    const mx = 16 + Math.floor(rnd() * 224);
    const my = 10 + Math.floor(rnd() * 230);
    const mr = 2 + Math.floor(rnd() * 7);
    for (let j = 0; j < mr * 2; j += 1) {
      const x = mx + Math.floor((rnd() - 0.5) * mr * 2);
      const y = my + Math.floor(rnd() * mr * 2);
      a.put(x, y, rnd() < 0.5 ? C.moss2 : C.moss1);
      if (rnd() < 0.3) a.put(x + 1, y, C.moss3);
    }
  }
  for (const [mx, my, ml] of [[104, 40, 18], [208, 120, 14], [56, 178, 20], [172, 226, 12], [244, 60, 10]]) {
    for (let i = 0; i < ml; i += 1) a.put(mx + (i % 2), my + i, i % 3 ? C.moss2 : C.moss1);
  }
  return a;
}

const results = [];
results.push(barkTile().save('tree_bark.png'));
results.push(leafCluster('sun', 1201).save('tree_leaf_sun.png'));
results.push(leafCluster('mid', 7723).save('tree_leaf_mid.png'));
results.push(leafCluster('deep', 5519).save('tree_leaf_deep.png'));
results.push(trunk().save('tree_trunk.png'));
results.push(fern().save('tree_fern.png'));

console.log(JSON.stringify(results, null, 2));
