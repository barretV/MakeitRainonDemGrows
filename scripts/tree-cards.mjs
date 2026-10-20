// Deterministic 2.5D foliage-card layout for the hero tree.
// Output: assets/tree-src/tree-cards.json (vertices in tree space, Y up, ground y=0).
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'assets/tree-src/tree-cards.json');

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(20261020);
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const CROWN = [0, 162, 0];
const R = [78, 58, 64];
const SUN = norm([-0.55, 0.72, 0.42]);
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const cards = [];
function boneFor(n) {
  if (n[1] > 0.58) return 'crown_top';
  if (n[0] < 0 && n[2] < 0) return 'leaf_nw';
  if (n[0] >= 0 && n[2] < 0) return 'leaf_ne';
  if (n[0] < 0) return 'leaf_sw';
  return 'leaf_se';
}
function card({ name, dir, shell, size, kindBias = 0, yMin = 96 }) {
  dir = norm(dir);
  const pos = [
    CROWN[0] + dir[0] * R[0] * shell + (rnd() - 0.5) * 7,
    Math.max(yMin, CROWN[1] + dir[1] * R[1] * shell + (rnd() - 0.5) * 5),
    CROWN[2] + dir[2] * R[2] * shell + (rnd() - 0.5) * 7,
  ];
  const normal = norm([dir[0], dir[1] * 0.92, dir[2]]);
  const up0 = Math.abs(normal[1]) > 0.92 ? [0, 0, 1] : [0, 1, 0];
  let right = norm(cross(up0, normal));
  let up = norm(cross(normal, right));
  const roll = (rnd() - 0.5) * 0.5;
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const r2 = add(mul(right, c), mul(up, s));
  const u2 = add(mul(right, -s), mul(up, c));
  right = r2;
  up = u2;
  const h = size / 2;
  const verts = [
    add(add(pos, mul(right, -h)), mul(up, -h)),
    add(add(pos, mul(right, h)), mul(up, -h)),
    add(add(pos, mul(right, h)), mul(up, h)),
    add(add(pos, mul(right, -h)), mul(up, h)),
  ];
  const sun = dot(normal, SUN) + kindBias;
  const kind = sun > 0.4 ? 'sun' : sun < -0.04 ? 'deep' : 'mid';
  cards.push({ name, verts, kind, bone: boneFor(normal), size });
}

// outer shell, evenly spread, flattened underside
for (let i = 0; i < 20; i += 1) {
  const y = 1 - (i / 19) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * GOLDEN;
  let dir = [Math.cos(th) * r, y, Math.sin(th) * r];
  dir = norm([dir[0], dir[1] < 0 ? dir[1] * 0.82 : dir[1], dir[2]]);
  card({ name: `leaf_${i}`, dir, shell: 0.9 + rnd() * 0.14, size: 60 + rnd() * 16 });
}
// inner shell for density and parallax
for (let i = 0; i < 8; i += 1) {
  const th = rnd() * Math.PI * 2;
  const y = -0.25 + rnd() * 0.8;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  card({ name: `leaf_in_${i}`, dir: [Math.cos(th) * r, y, Math.sin(th) * r], shell: 0.45 + rnd() * 0.25, size: 48 + rnd() * 12, kindBias: -0.25, yMin: 112 });
}
// low drooping cards around the under-crown
for (let i = 0; i < 4; i += 1) {
  const th = i * (Math.PI / 2) + 0.4;
  card({ name: `leaf_low_${i}`, dir: [Math.cos(th) * 0.75, -0.62, Math.sin(th) * 0.75], shell: 0.82, size: 46 + rnd() * 10, kindBias: -0.1, yMin: 100 });
}

// trunk: two crossed vertical planes
function plane(name, center, right, up, w, h, kind, bone) {
  const verts = [
    add(add(center, mul(right, -w / 2)), mul(up, -h / 2)),
    add(add(center, mul(right, w / 2)), mul(up, -h / 2)),
    add(add(center, mul(right, w / 2)), mul(up, h / 2)),
    add(add(center, mul(right, -w / 2)), mul(up, h / 2)),
  ];
  cards.push({ name, verts, kind, bone, size: Math.max(w, h) });
}
plane('trunk_a', [0, 52, 0], [1, 0, 0], [0, 1, 0], 52, 104, 'bark', 'trunk');
plane('trunk_b', [0, 52, 0], [0, 0, 1], [0, 1, 0], 52, 104, 'bark', 'trunk');
// base ferns
plane('fern_a', [-24, 13, 18], norm([-0.62, 0, 0.78]), [0, 1, 0], 30, 26, 'fern', 'trunk');
plane('fern_b', [22, 12, -16], norm([0.62, 0, -0.78]), [0, 1, 0], 28, 24, 'fern', 'trunk');

const counts = {};
for (const c of cards) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
writeFileSync(out, JSON.stringify({ cards, counts }, null, 1));
const compact = cards.map((c) => ({
  n: c.name,
  v: c.verts.map((v) => v.map((x) => Math.round(x * 100) / 100)),
  k: c.kind,
  b: c.bone,
}));
writeFileSync(resolve(root, 'assets/tree-src/tree-cards-compact.json'), JSON.stringify(compact));
console.log(JSON.stringify({ out, total: cards.length, counts }, null, 2));
