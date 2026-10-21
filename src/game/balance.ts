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
    skyMid: '#5c2f47',
    skyBot: '#c9798f',
    hill: '#3a2030',
    farHill: '#2a1824',
    sun: [0.86, 0.24, -0.16],
  },
  {
    name: 'Frostbite Forest',
    cols: 18,
    rows: 16,
    tiles: 288,
    hp: 3070,
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
    hp: 2400,
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
    hp: 13700,
    pay: 5,
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
    hp: 1120000,
    pay: 300,
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
  /** The island this milestone belongs to, if it belongs to one. */
  island?: number;
  /** How much of that island has to be green. */
  goal?: number;
}

/** How much of an island has to be green for each of its milestones. */
const MILESTONE_GOALS = [0.25, 0.5, 0.9, 1];

/**
 * The ids of the "island is green again" milestones. The first four are the
 * ones the game shipped with, so old saves keep their unlocks.
 */
const CLEAR_IDS = ['forest', 'frost', 'oasis', 'clean', 'globe'];

/** Each island's own story, told in four milestones. */
const ISLAND_STORIES: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
  // The Dead Forest
  [
    ['First Shoots', 'A quarter of the Dead Forest is green again.'],
    ['Half Awake', 'Half the Dead Forest has come back to life.'],
    ['Almost Home', 'Only the last of the Dead Forest is still thirsty.'],
    ['Forest Returns', 'The Dead Forest is green again.'],
  ],
  // Frostbite Forest
  [
    ['First Thaw', 'A quarter of Frostbite Forest has melted back to life.'],
    ['Half Melted', 'Half the frost is gone from Frostbite Forest.'],
    ['Last Snow', 'Only the last of Frostbite Forest is still frozen.'],
    ['Thawed Out', 'The Frostbite Forest is green again.'],
  ],
  // Parched Desert
  [
    ['First Rain', 'A quarter of the Parched Desert has bloomed.'],
    ['Half Bloomed', 'Half the Parched Desert is green again.'],
    ['Last Mirage', 'Only the last of the Parched Desert is still sand.'],
    ['Oasis Hours', 'The Parched Desert is green again.'],
  ],
  // Toxic Sludge Dump
  [
    ['First Purge', 'A quarter of the Toxic Sludge Dump is clean.'],
    ['Half Clean', 'Half the Toxic Sludge Dump no longer stinks.'],
    ['Last Ledge', 'Only the last of the Toxic Sludge Dump is still foul.'],
    ['Superfund Babes', 'The Toxic Sludge Dump is green again.'],
  ],
  // The Whole World
  [
    ['First Continent', 'A quarter of the world is green again.'],
    ['Half the Planet', 'Half the world has come back to life.'],
    ['Last Continent', 'Only the last of the world is still dry.'],
    ['World Reborn', 'The whole world is green again.'],
  ],
];

/** What each milestone pays, island by island. */
const MILESTONE_REWARDS: ReadonlyArray<readonly number[]> = [
  [10, 25, 60, 220],
  [25, 60, 140, 480],
  [50, 120, 280, 900],
  [120, 320, 750, 2400],
  [300, 800, 1900, 6000],
];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-drop', name: 'First Drop', desc: 'Bloom a tile with your own rain.', reward: 3 },
  { id: 'gardener', name: 'Soft Launch', desc: 'Bloom 80 tiles.', reward: 25 },
  { id: 'koi', name: 'Koi Season', desc: 'Fill a cracked pond.', reward: 120 },
  { id: 'money', name: 'Money Tree', desc: 'Wake a mega flora.', reward: 280 },
  { id: 'friend', name: 'Friend of the Meadow', desc: 'Pet 10 happy animals.', reward: 140 },
  { id: 'band', name: 'Dew Bandit', desc: 'Earn 1,000 dew.', reward: 0 },
  { id: 'mogul', name: 'Cloud Mogul', desc: 'Earn 50,000 dew.', reward: 600 },
  { id: 'drip-check', name: 'Big Mood', desc: 'Grow Cloud Puff to rank 4.', reward: 80 },
  ...ISLAND_STORIES.flatMap((story, island) =>
    story.map(([name, desc], index) => ({
      id:
        index === MILESTONE_GOALS.length - 1
          ? (CLEAR_IDS[island] ?? `w${island}-100`)
          : `w${island}-${Math.round(MILESTONE_GOALS[index]! * 100)}`,
      name,
      desc,
      reward: MILESTONE_REWARDS[island]?.[index] ?? 0,
      island,
      goal: MILESTONE_GOALS[index]!,
    })),
  ),
];

/** The island a milestone belongs to, if it is one. */
export function milestoneIsland(id: string): { island: number; goal: number } | null {
  const found = ACHIEVEMENTS.find((a) => a.id === id);
  if (!found || found.island === undefined || found.goal === undefined) return null;
  return { island: found.island, goal: found.goal };
}

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

/**
 * Which cells of an island are land. The sea cannot be restored, so it does
 * not count towards the island either.
 */
export function landMask(world: number, maskCols: number, maskRows: number): Uint8Array {
  const mask = new Uint8Array(maskCols * maskRows);
  if (world === GLOBE_WORLD) {
    mask.fill(1);
    return mask;
  }
  const { cols, rows } = gridOf(world);
  const w = cols * TILE;
  const h = rows * TILE;
  const radius = islandRadius(world, w, h);
  const centerX = -TILE / 2 + w * 0.5;
  const centerZ = -TILE / 2 + h * 0.5;
  for (let r = 0; r < maskRows; r += 1) {
    for (let c = 0; c < maskCols; c += 1) {
      const x = ((c + 0.5) / maskCols) * w - TILE / 2;
      const z = ((r + 0.5) / maskRows) * h - TILE / 2;
      mask[r * maskCols + c] = islandShore(world, x - centerX, z - centerZ, radius) < 0 ? 1 : 0;
    }
  }
  return mask;
}

/** True when the middle of a tile is on the island rather than in the sea. */
export function tileIsLand(world: number, col: number, row: number): boolean {
  if (world === GLOBE_WORLD) return true;
  const { cols, rows } = gridOf(world);
  const w = cols * TILE;
  const h = rows * TILE;
  const radius = islandRadius(world, w, h);
  const x = (col + 0.5) * TILE - TILE / 2;
  const z = (row + 0.5) * TILE - TILE / 2;
  const centerX = -TILE / 2 + w * 0.5;
  const centerZ = -TILE / 2 + h * 0.5;
  return islandShore(world, x - centerX, z - centerZ, radius) < 0;
}

/**
 * How much of its board an island fills. The shapes are drawn around this
 * radius, so a bigger number means more land to walk over.
 */
const ISLAND_FILL: readonly number[] = [0.47, 0.5, 0.5, 0.5];

/** The radius of an island's shape, in world units. */
export function islandRadius(world: number, width: number, depth: number): number {
  const fill = ISLAND_FILL[world] ?? 0.47;
  return Math.min(width, depth) * fill;
}

/**
 * The silhouette of an island.
 *
 * `dx` and `dz` are the distance from the island's centre in world units and
 * `radius` is the island's base radius. The result is how far outside the
 * island a point is: negative on land, zero on the shore, positive out at
 * sea. Every island has its own shape so no two of them feel the same.
 */
export function islandShore(world: number, dx: number, dz: number, radius: number): number {
  const r = Math.hypot(dx, dz) / radius;
  const ang = Math.atan2(dz, dx);
  switch (world) {
    case 1: {
      // Frostbite: a six-armed snowflake. The arms are fat, so the rain can
      // still reach into them.
      const spike = Math.abs(Math.cos(3 * ang));
      return r - (0.72 + 0.3 * Math.pow(spike, 0.5));
    }
    case 2: {
      // The desert: a ring of land with a dry lake in the middle.
      const outer = Math.hypot(dx, dz) / radius;
      const hollow = Math.hypot(dx, dz) / (radius * 0.34);
      return Math.max(outer - 1.02, -(hollow - 1));
    }
    case 3: {
      // The sludge dump: an archipelago. A big island and three outlying
      // islets to hop to.
      const main = Math.hypot(dx, dz) / radius - 0.64;
      const isletA = Math.hypot(dx - radius * 0.72, dz - radius * 0.46) / (radius * 0.34) - 1;
      const isletB = Math.hypot(dx + radius * 0.78, dz - radius * 0.04) / (radius * 0.28) - 1;
      const isletC = Math.hypot(dx - radius * 0.06, dz + radius * 0.78) / (radius * 0.24) - 1;
      return Math.min(main, isletA, isletB, isletC);
    }
    default: {
      // The first island: a soft round shape with a cove cut out of one side.
      const lobe =
        1 +
        0.13 * Math.sin(ang * 3 + 0.7) +
        0.08 * Math.sin(ang * 5 - 1.2) +
        0.06 * Math.cos(ang * 2 + 0.4);
      const cove = Math.max(0, 1 - Math.hypot(dx + radius * 0.52, dz - radius * 0.34) / (radius * 0.62));
      return r - lobe + cove * 0.55;
    }
  }
}
