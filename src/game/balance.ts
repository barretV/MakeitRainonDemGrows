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
  /**
   * Where the sun sits, in world space. Fixed per island so the light stays put
   * when the player turns the camera.
   */
  sun: readonly [number, number, number];
}

export const GLOBE_WORLD = 4;

export const WORLDS: readonly WorldDef[] = [
  {
    name: 'Dead Forest',
    cols: 11,
    rows: 8,
    tiles: 88,
    hp: 76,
    pay: 3,
    skyTop: '#2e1a3a',
    skyMid: '#6e3a56',
    skyBot: '#e8a0bc',
    hill: '#3a2030',
    farHill: '#2a1824',
    sun: [0.86, 0.24, -0.16],
  },
  {
    name: 'Frostbite Forest',
    cols: 18,
    rows: 16,
    tiles: 288,
    hp: 2579,
    pay: 2,
    skyTop: '#101828',
    skyMid: '#243858',
    skyBot: '#c87898',
    hill: '#7ea0d0',
    farHill: '#c47ab8',
    sun: [0.74, 0.38, -0.2],
  },
  {
    name: 'Parched Desert',
    cols: 31,
    rows: 24,
    tiles: 744,
    hp: 1500,
    pay: 3,
    skyTop: '#3a1c10',
    skyMid: '#6a3818',
    skyBot: '#e0a060',
    hill: '#e2c08a',
    farHill: '#f0d7a8',
    sun: [0.9, 0.5, -0.12],
  },
  {
    name: 'Toxic Sludge Dump',
    cols: 34,
    rows: 26,
    tiles: 884,
    hp: 3730,
    pay: 4,
    skyTop: '#1c1828',
    skyMid: '#3a4030',
    skyBot: '#b0c070',
    hill: '#6d7a52',
    farHill: '#8e7aaa',
    sun: [0.66, 0.34, -0.24],
  },
  {
    name: 'The Whole World',
    cols: 14,
    rows: 9,
    tiles: 126,
    hp: 97889,
    pay: 4,
    skyTop: '#1c2a6a',
    skyMid: '#3a4e9a',
    skyBot: '#8ec8f0',
    hill: '#6a8a5a',
    farHill: '#d7e6fb',
    sun: [0.8, 0.42, -0.18],
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
  { id: 'first-drop', name: 'First Drop', desc: 'Bloom a tile with your own rain.', reward: 3 },
  { id: 'gardener', name: 'Soft Launch', desc: 'Bloom 80 tiles.', reward: 25 },
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
    if (n <= 2) decor = 'tree';
    else if (n <= 4) decor = 'bush';
    else if (n === 5) decor = 'rock';
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
