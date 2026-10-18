export interface WorldDef {
  name: string;
  cols: number;
  rows: number;
  tiles: number;
  /** Hit points of one small mask cell. A fresh drizzle only finishes a handful. */
  hp: number;
  /** Dew for one finished mask cell, before charm multipliers. */
  pay: number;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  hill: string;
  farHill: string;
}

export const GLOBE_WORLD = 4;

export const WORLDS: readonly WorldDef[] = [
  {
    name: 'Dead Forest',
    cols: 8,
    rows: 6,
    tiles: 48,
    hp: 128,
    pay: 3,
    skyTop: '#f7bdd9',
    skyMid: '#f6d0c4',
    skyBot: '#f3e2f4',
    hill: '#d7a8be',
    farHill: '#e7c3d6',
  },
  {
    name: 'Frostbite Forest',
    cols: 13,
    rows: 9,
    tiles: 117,
    hp: 720,
    pay: 2,
    skyTop: '#c5d6f7',
    skyMid: '#d5e6fb',
    skyBot: '#eef4ff',
    hill: '#b7cbe8',
    farHill: '#d5e3f6',
  },
  {
    name: 'Parched Desert',
    cols: 15,
    rows: 11,
    tiles: 165,
    hp: 820,
    pay: 3,
    skyTop: '#f6ddb0',
    skyMid: '#f3c99a',
    skyBot: '#f8e7c8',
    hill: '#e2c08a',
    farHill: '#f0d7a8',
  },
  {
    name: 'Toxic Sludge Dump',
    cols: 17,
    rows: 12,
    tiles: 204,
    hp: 680,
    pay: 4,
    skyTop: '#6a5484',
    skyMid: '#7f9468',
    skyBot: '#d5e08a',
    hill: '#6d7a52',
    farHill: '#8e7aaa',
  },
  {
    name: 'The Whole World',
    cols: 14,
    rows: 9,
    tiles: 126,
    hp: 680,
    pay: 4,
    skyTop: '#1c2a6a',
    skyMid: '#3a4e9a',
    skyBot: '#8ec8f0',
    hill: '#6a8a5a',
    farHill: '#d7e6fb',
  },
];

export function worldDef(index: number): WorldDef {
  const w = WORLDS[Math.max(0, Math.min(WORLDS.length - 1, index))];
  if (!w) throw new Error('Missing world definition');
  return w;
}

export function gridOf(world: number): { cols: number; rows: number } {
  const w = worldDef(world);
  return { cols: w.cols, rows: w.rows };
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-drop', name: 'First Drop', desc: 'Bloom a tile with your own rain.', reward: 30 },
  { id: 'gardener', name: 'Soft Launch', desc: 'Bloom 30 tiles.', reward: 90 },
  { id: 'koi', name: 'Koi Season', desc: 'Fill a cracked pond.', reward: 120 },
  { id: 'money', name: 'Money Tree', desc: 'Wake a mega flora.', reward: 280 },
  { id: 'friend', name: 'Friend of the Meadow', desc: 'Pet 10 happy animals.', reward: 140 },
  { id: 'forest', name: 'Forest Returns', desc: 'Reclaim the Dead Forest.', reward: 220 },
  { id: 'frost', name: 'Thawed Out', desc: 'Reclaim the Frostbite Forest.', reward: 480 },
  { id: 'oasis', name: 'Oasis Hours', desc: 'Reclaim the Parched Desert.', reward: 900 },
  { id: 'clean', name: 'Superfund Babes', desc: 'Reclaim the Toxic Sludge Dump.', reward: 2400 },
  { id: 'band', name: 'Dew Bandit', desc: 'Earn 1,000 dew.', reward: 0 },
  { id: 'mogul', name: 'Cloud Mogul', desc: 'Earn 50,000 dew.', reward: 600 },
  { id: 'drip-check', name: 'Big Mood', desc: 'Grow Cloud Puff to rank 4.', reward: 80 },
];

export const TILE = 3.2;
export const BASE_LITERS = 260;
export const DRAIN_PER_SEC = 46;

export type TileKind = 'ground' | 'pond' | 'seed';
export type Decor = 'tree' | 'bush' | 'rock' | 'twig';

export interface TileSpec {
  kind: TileKind;
  decor: Decor;
  height: number;
}

export function tileSpec(world: number, index: number, count: number): TileSpec {
  void count;
  const { cols, rows } = gridOf(world);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const pondAt = (c: number, r: number) => r * cols + c;
  const ponds = [
    pondAt(Math.floor(cols * 0.22), Math.floor(rows * 0.3)),
    pondAt(Math.floor(cols * 0.58), Math.floor(rows * 0.68)),
    pondAt(Math.floor(cols * 0.78), Math.floor(rows * 0.32)),
  ];
  const seedAt = pondAt(Math.floor(cols * 0.5), Math.floor(rows * 0.48));
  let kind: TileKind = 'ground';
  if (index === seedAt) kind = 'seed';
  else if (ponds.includes(index)) kind = 'pond';

  let decor: Decor = 'twig';
  if (kind === 'ground') {
    const n = (col * 5 + row * 3 + world * 2) % 8;
    if (n <= 1) decor = 'tree';
    else if (n === 2) decor = 'bush';
    else if (n === 3) decor = 'rock';
  }
  return { kind, decor, height: columnHeight(world, col, row, kind) };
}

export function columnHeight(world: number, col: number, row: number, kind: TileKind): number {
  if (kind === 'pond') return 1;
  const { cols, rows } = gridOf(world);
  const nx = col / Math.max(1, cols - 1);
  const nz = row / Math.max(1, rows - 1);
  const hill = Math.sin(nx * 6.2 + world * 1.1) * Math.cos(nz * 4.1 + 0.6);
  const mound = Math.sin(nx * 2.2 + row * 0.15) * Math.sin(nz * 2.5 + world);
  const edge = Math.min(nx, 1 - nx, nz, 1 - nz);
  const lip = edge < 0.14 ? -0.85 : 0;
  const n = 2.35 + hill * 0.95 + mound * 0.65 + lip + (world >= 3 ? 0.35 : 0);
  return Math.max(1, Math.min(4, Math.round(n)));
}

export function tileMaxHp(world: number, kind: TileKind): number {
  const hp = worldDef(world).hp;
  return kind === 'seed' ? hp * 2 : hp;
}
