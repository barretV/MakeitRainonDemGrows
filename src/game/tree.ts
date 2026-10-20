import { GLOBE_WORLD, TILE, gridOf, worldDef } from './balance';

/** Same shape as Chimney Fisher's UpgradeNode: parent, gate vs ranked upgrade, cost per rank. */
export type NodeId =
  | 'puff'
  | 'bottle'
  | 'flask'
  | 'reservoir'
  | 'linger'
  | 'glacier'
  | 'drizzle'
  | 'specks'
  | 'mist'
  | 'soak'
  | 'flow'
  | 'spring'
  | 'downpour'
  | 'reach'
  | 'circle'
  | 'wide'
  | 'horizon'
  | 'charm'
  | 'dew'
  | 'bounty'
  | 'harvest'
  | 'crit'
  | 'sprinkler'
  | 'spin'
  | 'lightning'
  | 'zap'
  | 'tornado'
  | 'twist'
  | 'geyser'
  | 'spore'
  | 'rainbow'
  | 'hail'
  | 'mirage'
  | 'waterbomb'
  | 'purify'
  | 'monsoon';

export type Branch = 'core' | 'bottle' | 'drizzle' | 'reach' | 'charm';

export interface UpgradeNode {
  id: NodeId;
  parent: NodeId | null;
  branch: Branch;
  kind: 'upgrade' | 'gate';
  name: string;
  desc: string;
  max: number;
  color: string;
  costs: readonly number[];
  /** Blooms (finished mask cells) required for each rank. Omitted ranks are dew-only. */
  blooms?: readonly number[];
  /** Island index that must be unlocked before this rank can be bought. */
  worldMin?: number;
  effect: (level: number) => string;
}

export type Ranks = Record<NodeId, number>;

export const NODE_IDS: readonly NodeId[] = [
  'puff',
  'bottle',
  'flask',
  'reservoir',
  'linger',
  'glacier',
  'drizzle',
  'specks',
  'spore',
  'mist',
  'hail',
  'soak',
  'flow',
  'spring',
  'downpour',
  'geyser',
  'monsoon',
  'reach',
  'circle',
  'waterbomb',
  'wide',
  'mirage',
  'horizon',
  'charm',
  'rainbow',
  'dew',
  'bounty',
  'harvest',
  'purify',
  'crit',
  'sprinkler',
  'spin',
  'lightning',
  'zap',
  'tornado',
  'twist',
];

/** Workshop “next up” + sim buy order (mirrors balance/upgrades.json via dump-upgrades). */
export const PRIORITY: readonly NodeId[] = [
  'puff',
  'bottle',
  'flask',
  'reservoir',
  'drizzle',
  'specks',
  'reach',
  'circle',
  'mist',
  'soak',
  'charm',
  'dew',
  'wide',
  'bounty',
  'linger',
  'crit',
  'flow',
  'spring',
  'geyser',
  'spore',
  'downpour',
  'hail',
  'rainbow',
  'horizon',
  'glacier',
  'mirage',
  'waterbomb',
  'sprinkler',
  'spin',
  'lightning',
  'zap',
  'purify',
  'tornado',
  'twist',
  'monsoon',
  'harvest',
];

const NODES: readonly UpgradeNode[] = [
  {
    id: 'puff',
    parent: null,
    branch: 'core',
    kind: 'upgrade',
    name: 'Cloud Puff',
    desc: 'Get bigger. A bigger cloud drinks a wider circle and the camera leans in.',
    max: 8,
    color: '#ffe56a',
    costs: [4, 8, 14, 18, 31, 38, 75, 93],
    effect: (level) => `Size ${cloudScale({ ...emptyRanks(), puff: level }).toFixed(2)}`,
  },
  {
    id: 'bottle',
    parent: 'puff',
    branch: 'bottle',
    kind: 'gate',
    name: 'Bottle',
    desc: 'Open the bottle petal. The next ranks hold more water.',
    max: 1,
    color: '#8fd4ff',
    costs: [100],
    effect: () => 'Bottle petal open',
  },
  {
    id: 'flask',
    parent: 'bottle',
    branch: 'bottle',
    kind: 'upgrade',
    name: 'Flask',
    desc: 'More liters in the next bottle. Nothing refills while you fly.',
    max: 5,
    color: '#8fd4ff',
    costs: [100, 114, 131, 150, 172],
    effect: (level) => `${Math.round(maxLiters({ ...emptyRanks(), bottle: 1, flask: level }))} L`,
  },
  {
    id: 'reservoir',
    parent: 'flask',
    branch: 'bottle',
    kind: 'upgrade',
    name: 'Reservoir',
    desc: 'A deeper bottle for the long passes.',
    max: 5,
    color: '#8fd4ff',
    costs: [123, 114, 131, 150, 172],
    effect: (level) => `Liters x${(1.26 ** level).toFixed(2)}`,
  },
  {
    id: 'linger',
    parent: 'reservoir',
    branch: 'bottle',
    kind: 'upgrade',
    name: 'Linger',
    desc: 'The bottle empties slower, so you can sit in a patch.',
    max: 5,
    color: '#8fd4ff',
    costs: [230508, 271999, 304175, 349801, 402271],
    effect: (level) => `Drain /${(1.14 ** level).toFixed(2)}`,
  },
  {
    id: 'glacier',
    parent: 'linger',
    branch: 'bottle',
    kind: 'upgrade',
    name: 'Glacier',
    desc: 'The last sip lasts. Built for a whole land.',
    max: 4,
    color: '#8fd4ff',
    costs: [450000, 517499, 595123, 553055],
    effect: (level) => `Drain /${(1.12 ** level).toFixed(2)}`,
  },
  {
    id: 'drizzle',
    parent: 'puff',
    branch: 'drizzle',
    kind: 'gate',
    name: 'Drizzle',
    desc: 'Open the rain petal. The first cloud only leaks.',
    max: 1,
    color: '#7eb6ff',
    costs: [123],
    effect: () => 'Drizzle petal open',
  },
  {
    id: 'specks',
    parent: 'drizzle',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Specks',
    desc: 'More drops in the circle. Still patchy.',
    max: 5,
    color: '#7eb6ff',
    costs: [100, 160, 210, 270, 320],
    effect: (level) => `${Math.round(patchFraction({ ...emptyRanks(), drizzle: 1, specks: level }) * 100)}% of the circle`,
  },
  {
    id: 'mist',
    parent: 'specks',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Mist',
    desc: 'The dry holes in the circle close up.',
    max: 5,
    color: '#7eb6ff',
    costs: [1700, 1954, 2247, 2584, 2971],
    effect: (level) => `Patches +${level}`,
  },
  {
    id: 'soak',
    parent: 'mist',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Soak',
    desc: 'Each drop sinks deeper. Patches fill instead of only darkening.',
    max: 5,
    color: '#7eb6ff',
    costs: [2700, 3104, 3569, 4104, 4719],
    effect: (level) => `Soak x${(1.42 ** level).toFixed(2)}`,
  },
  {
    id: 'downpour',
    parent: 'soak',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Downpour',
    desc: 'The circle finally means it.',
    max: 4,
    color: '#7eb6ff',
    costs: [340000, 390999, 449648, 460455],
    effect: (level) => `Soak x${(1.36 ** level).toFixed(2)}`,
  },
  {
    id: 'geyser',
    parent: 'soak',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Geyser Burst',
    desc: 'Auto geysers punch through dry ground when you pour.',
    max: 4,
    color: '#5ec8ff',
    costs: [340000, 390999, 449648, 494954],
    blooms: [0, 2300, 2645, 3041],
    effect: (level) => `Geyser rank ${level}`,
  },
  {
    id: 'flow',
    parent: 'soak',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Cascade',
    desc: 'The bottle tips harder and every drop sinks further.',
    max: 4,
    color: '#5ec8ff',
    costs: [340000, 390999, 449648, 517095],
    blooms: [2300, 2645, 3041, 3497],
    effect: (level) => `Pour x${(1.3 ** level).toFixed(2)}`,
  },
  {
    id: 'spring',
    parent: 'mist',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Meadow Spring',
    desc: 'Finished ground holds a pool that seeps into thirsty neighbours.',
    max: 3,
    color: '#8ee0a0',
    costs: [340000, 390999, 449648],
    blooms: [2300, 2645, 3041],
    effect: (level) => `Pools ${Math.round((0.72 + 0.22 * level) * 100)}%`,
  },
  {
    id: 'spore',
    parent: 'specks',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Spore Drizzle',
    desc: 'Green spores wake moss in a wide arc.',
    max: 3,
    color: '#7ddf6a',
    costs: [340000, 390999, 449648],
    blooms: [0, 2300, 2645],
    effect: (level) => `Spore +${level}`,
  },
  {
    id: 'reach',
    parent: 'puff',
    branch: 'reach',
    kind: 'gate',
    name: 'Reach',
    desc: 'Open the reach petal. Grow your bottle first — then widen the rain circle.',
    max: 1,
    color: '#b6e86a',
    costs: [380],
    effect: () => 'Reach petal open',
  },
  {
    id: 'circle',
    parent: 'reach',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Circle',
    desc: 'A wider rain circle.',
    max: 5,
    color: '#b6e86a',
    costs: [380, 570, 810, 1000, 1400],
    effect: (level) => `Radius x${(1 + 0.32 * level).toFixed(2)}`,
  },
  {
    id: 'wide',
    parent: 'circle',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Wide',
    desc: 'The circle covers a meadow, not a puddle.',
    max: 5,
    color: '#b6e86a',
    costs: [7500, 11000, 15000, 20000, 25000],
    effect: (level) => `Radius x${(1 + 0.28 * level).toFixed(2)}`,
  },
  {
    id: 'horizon',
    parent: 'wide',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Horizon',
    desc: 'Big enough to walk a whole land in one bottle.',
    max: 4,
    color: '#b6e86a',
    costs: [340000, 480000, 552000, 440715],
    effect: (level) => `Radius x${(1 + 0.26 * level).toFixed(2)}`,
  },
  {
    id: 'mirage',
    parent: 'wide',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Mirage Wave',
    desc: 'Rolling heat-waves carry water across the dunes.',
    max: 3,
    color: '#f5d27a',
    costs: [910000, 1046499, 1203473],
    blooms: [6100, 7014, 8066],
    worldMin: 2,
    effect: (level) => `Wave +${level}`,
  },
  {
    id: 'waterbomb',
    parent: 'circle',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Water Bomb',
    desc: 'Lobs a soaking splash ahead of the cloud.',
    max: 3,
    color: '#7ec8f0',
    costs: [910000, 1046499, 1203473],
    blooms: [6100, 7014, 8066],
    worldMin: 2,
    effect: (level) => `Bomb +${level}`,
  },
  {
    id: 'charm',
    parent: 'puff',
    branch: 'charm',
    kind: 'gate',
    name: 'Charm',
    desc: 'Open the charm petal. The cloud gets loud about it.',
    max: 1,
    color: '#ff9bb8',
    costs: [3278],
    effect: () => 'Charm petal open',
  },
  {
    id: 'dew',
    parent: 'charm',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Dew',
    desc: 'Every finished patch pays more.',
    max: 5,
    color: '#ff9bb8',
    costs: [2700, 3400, 4100, 5000, 6100],
    effect: (level) => `Dew x${(1.22 ** level).toFixed(2)}`,
  },
  {
    id: 'rainbow',
    parent: 'charm',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Rainbow Arc',
    desc: 'A shimmering arc paints frost into bloom.',
    max: 3,
    color: '#ffb4e8',
    costs: [372667, 310500, 357075],
    blooms: [2800, 3219, 3701],
    worldMin: 1,
    effect: (level) => `Arc +${level}`,
  },
  {
    id: 'hail',
    parent: 'mist',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Hail Melt',
    desc: 'Ice shatters into instant growth.',
    max: 3,
    color: '#d8f4ff',
    costs: [270000, 372670, 357075],
    blooms: [2800, 3219, 3701],
    worldMin: 1,
    effect: (level) => `Melt +${level}`,
  },
  {
    id: 'purify',
    parent: 'bounty',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Purify Rain',
    desc: 'Toxic crust melts under a green wash.',
    max: 3,
    color: '#b8ff9a',
    costs: [4500000, 5175000, 5951250],
    blooms: [22000, 25299, 29093],
    worldMin: 3,
    effect: (level) => `Purify +${level}`,
  },
  {
    id: 'monsoon',
    parent: 'downpour',
    branch: 'drizzle',
    kind: 'upgrade',
    name: 'Monsoon Band',
    desc: 'A latitude belt of rain wraps the globe.',
    max: 2,
    color: '#6ec8ff',
    costs: [7100000, 15000000],
    blooms: [36000, 77000],
    worldMin: 4,
    effect: (level) => `Band +${level}`,
  },
  {
    id: 'bounty',
    parent: 'dew',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Bounty',
    desc: 'The meadow tips extra.',
    max: 12,
    color: '#ff9bb8',
    costs: [31000, 37000, 44000, 52000, 61000, 72000, 85000, 100000, 114999, 140000, 161000, 195091],
    effect: (level) => `Dew x${(1.18 ** level).toFixed(2)}`,
  },
  {
    id: 'harvest',
    parent: 'bounty',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Heavy Harvest',
    desc: 'A wider rain on the last world. Each rank is a globe bottle well spent.',
    max: 24,
    color: '#ff9bb8',
    worldMin: 4,
    costs: [7400000, 15000000, 32000000, 68000000, 140000000, 300000000, 640000000, 1300000000, 2700000000, 5800000000, 12000000000, 25000000000, 53000000000, 110000000000, 230000000000, 490000000000, 1000000000000, 2100000000000, 4500000000000, 9600000000000, 20000000000000, 43000000000000, 92000000000000, 190000000000000],
    blooms: [1800, 3800, 8100, 17000, 36000, 77000, 160000, 340000, 730000, 1500000, 3200000, 6800000, 14000000, 30000000, 64000000, 130000000, 270000000, 580000000, 1200000000, 2500000000, 5300000000, 11000000000, 23000000000, 49000000000],
    effect: (level) => `Radius +${level * 2}%`,
  },
  {
    id: 'crit',
    parent: 'bounty',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Sunshower',
    desc: 'Some patches bloom on contact and pay triple.',
    max: 4,
    color: '#ff9bb8',
    costs: [272000, 264500, 304175, 349801],
    effect: (level) => `${Math.round(critChance({ ...emptyRanks(), crit: level }) * 100)}% crit`,
  },
  {
    id: 'sprinkler',
    parent: 'crit',
    branch: 'charm',
    kind: 'gate',
    name: 'Sprinkler',
    desc: 'The cloud spins and paints a ring. Off until you buy it.',
    max: 1,
    color: '#ff9bb8',
    costs: [515864],
    blooms: [4500],
    worldMin: 1,
    effect: () => 'Sprinkler unlocked',
  },
  {
    id: 'spin',
    parent: 'sprinkler',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Spin',
    desc: 'The ring reaches further.',
    max: 3,
    color: '#ff9bb8',
    costs: [910000, 1046499, 1203473],
    blooms: [6100, 7014, 8066],
    worldMin: 1,
    effect: (level) => `Ring +${level}`,
  },
  {
    id: 'lightning',
    parent: 'sprinkler',
    branch: 'charm',
    kind: 'gate',
    name: 'Lightning',
    desc: 'A bolt finishes a tight circle of patches.',
    max: 1,
    color: '#ffd56a',
    costs: [1700000],
    blooms: [8500],
    worldMin: 2,
    effect: () => 'Lightning unlocked',
  },
  {
    id: 'zap',
    parent: 'lightning',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Zap',
    desc: 'The bolt covers more patches.',
    max: 3,
    color: '#ffd56a',
    costs: [3600000, 4139999, 4760998],
    blooms: [18000, 20700, 23804],
    worldMin: 2,
    effect: (level) => `Bolt +${level}`,
  },
  {
    id: 'tornado',
    parent: 'lightning',
    branch: 'charm',
    kind: 'gate',
    name: 'Tornado',
    desc: 'A twister walks ahead and greens what it touches.',
    max: 1,
    color: '#d7c4ff',
    costs: [4500000],
    blooms: [22000],
    worldMin: 3,
    effect: () => 'Tornado unlocked',
  },
  {
    id: 'twist',
    parent: 'tornado',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Twist',
    desc: 'A fatter twister.',
    max: 3,
    color: '#d7c4ff',
    costs: [5700000, 6554999, 7538248],
    blooms: [28000, 32199, 37028],
    worldMin: 3,
    effect: (level) => `Twister +${level}`,
  },
];

const BY_ID = new Map<NodeId, UpgradeNode>(NODES.map((node) => [node.id, node]));

export function upgradeNode(id: NodeId): UpgradeNode {
  const node = BY_ID.get(id);
  if (!node) throw new Error(`Missing node ${id}`);
  return node;
}

export function allNodes(): readonly UpgradeNode[] {
  return NODES;
}

export function emptyRanks(): Ranks {
  return {
    puff: 0,
    bottle: 0,
    flask: 0,
    reservoir: 0,
    linger: 0,
    glacier: 0,
    drizzle: 0,
    specks: 0,
    mist: 0,
    soak: 0,
    flow: 0,
    spring: 0,
    downpour: 0,
    reach: 0,
    circle: 0,
    wide: 0,
    horizon: 0,
    charm: 0,
    dew: 0,
    bounty: 0,
    harvest: 0,
    crit: 0,
    sprinkler: 0,
    spin: 0,
    lightning: 0,
    zap: 0,
    tornado: 0,
    twist: 0,
    geyser: 0,
    spore: 0,
    rainbow: 0,
    hail: 0,
    mirage: 0,
    waterbomb: 0,
    purify: 0,
    monsoon: 0,
  };
}

export function nodeCost(id: NodeId, level: number): number {
  const node = upgradeNode(id);
  return node.costs[level] ?? node.costs[node.costs.length - 1] ?? 0;
}

export function nodeBloomCost(id: NodeId, level: number): number {
  const node = upgradeNode(id);
  return node.blooms?.[level] ?? 0;
}

/** Blooms already spent on tree ranks (not the petal shop). */
export function treeBloomsSpent(ranks: Ranks): number {
  let sum = 0;
  for (const node of NODES) {
    if (!node.blooms) continue;
    const level = ranks[node.id];
    for (let i = 0; i < level; i += 1) sum += node.blooms[i] ?? 0;
  }
  return sum;
}

export function worldMet(id: NodeId, unlocked: number): boolean {
  return (upgradeNode(id).worldMin ?? 0) <= unlocked;
}

/** A node can be seen and bought once this is true. Hidden buds stay off the flower. */
export function prereqMet(id: NodeId, ranks: Ranks): boolean {
  switch (id) {
    case 'puff':
      return true;
    case 'bottle':
      return ranks.puff >= 1;
    case 'drizzle':
      return ranks.bottle >= 1;
    case 'reach':
      return ranks.drizzle >= 1;
    case 'charm':
      return ranks.reach >= 1;
    case 'flask':
      return ranks.bottle >= 1;
    case 'reservoir':
      return ranks.flask >= 1;
    case 'linger':
      return ranks.reservoir >= 1;
    case 'glacier':
      return ranks.linger >= 2;
    case 'specks':
      return ranks.drizzle >= 1;
    case 'mist':
      return ranks.specks >= 1;
    case 'soak':
      return ranks.mist >= 1;
    case 'downpour':
      return ranks.soak >= 2;
    case 'flow':
      return ranks.soak >= 2;
    case 'spring':
      return ranks.mist >= 2;
    case 'circle':
      return ranks.reach >= 1;
    case 'wide':
      return ranks.circle >= 1;
    case 'horizon':
      return ranks.wide >= 2;
    case 'dew':
      return ranks.charm >= 1;
    case 'bounty':
      return ranks.dew >= 1;
    case 'harvest':
      return ranks.bounty >= 4;
    case 'crit':
      return ranks.bounty >= 1;
    case 'sprinkler':
      return ranks.crit >= 2;
    case 'spin':
      return ranks.sprinkler >= 1;
    case 'lightning':
      return ranks.sprinkler >= 1 && ranks.crit >= 3;
    case 'zap':
      return ranks.lightning >= 1;
    case 'tornado':
      return ranks.lightning >= 1 && ranks.zap >= 2;
    case 'twist':
      return ranks.tornado >= 1;
    case 'geyser':
      return ranks.soak >= 1;
    case 'spore':
      return ranks.specks >= 1;
    case 'rainbow':
      return ranks.charm >= 1;
    case 'hail':
      return ranks.mist >= 1;
    case 'mirage':
      return ranks.wide >= 1;
    case 'waterbomb':
      return ranks.circle >= 1;
    case 'purify':
      return ranks.bounty >= 1;
    case 'monsoon':
      return ranks.downpour >= 1;
    default:
      return false;
  }
}

export function isVisible(id: NodeId, ranks: Ranks): boolean {
  return prereqMet(id, ranks);
}

export function isGhost(id: NodeId, ranks: Ranks): boolean {
  if (ranks.puff < 1) return false;
  if (isVisible(id, ranks)) return false;
  const parent = upgradeNode(id).parent;
  if (!parent) return false;
  return isVisible(parent, ranks);
}

export const BASE_SCALE = 0.48;
const PUFF_STEP = 0.085;

export function cloudScale(ranks: Ranks): number {
  return BASE_SCALE + ranks.puff * PUFF_STEP;
}

export function maxLiters(ranks: Ranks): number {
  return 260 * 1.22 ** ranks.flask * 1.18 ** ranks.reservoir;
}

export function drainPerSec(ranks: Ranks): number {
  return (46 / 1.1 ** ranks.linger / 1.08 ** ranks.glacier) * 1.3 ** ranks.flow;
}

export function bottleSeconds(ranks: Ranks): number {
  return maxLiters(ranks) / drainPerSec(ranks);
}

export function rainRadius(ranks: Ranks): number {
  const grown = cloudScale(ranks) / BASE_SCALE;
  const reach =
    (1 + 0.23 * ranks.circle) *
    (1 + 0.21 * ranks.wide) *
    (1 + 0.19 * ranks.horizon) *
    (1 + 0.12 * ranks.harvest) *
    (1 + 0.16 * ranks.sprinkler) *
    (1 + 0.06 * ranks.spin) *
    (1 + 0.12 * ranks.lightning) *
    (1 + 0.04 * ranks.zap) *
    (1 + 0.12 * ranks.tornado) *
    (1 + 0.04 * ranks.twist) *
    (1 + 0.7 * ranks.monsoon);
  return 0.92 * grown * reach;
}

export function soakPerTick(ranks: Ranks): number {
  return 1.35 * 1.28 ** ranks.soak * 1.22 ** ranks.downpour * 1.3 ** ranks.flow;
}

/** Fraction of spilled rain that stands on finished ground. */
export function poolGain(ranks: Ranks): number {
  return 0.72 + 0.22 * ranks.spring;
}

/** How hard a standing pool seeps into a thirsty neighbour. */
export function poolFlow(ranks: Ranks): number {
  return 0.9 + 0.12 * ranks.spring;
}

/** Fraction of the disc that actually receives rain. The rest stays a dry hole in the circle. */
export function patchFraction(ranks: Ranks): number {
  return Math.min(1, 0.18 + ranks.specks * 0.09 + ranks.mist * 0.075);
}

export function critChance(ranks: Ranks): number {
  return Math.min(0.4, ranks.crit * 0.06);
}

export function dewMultiplier(ranks: Ranks): number {
  return 1.22 ** ranks.dew * 1.18 ** ranks.bounty;
}

export function maskOf(world: number): { cols: number; rows: number } {
  const table = [
    { cols: 100, rows: 75 },
    { cols: 130, rows: 90 },
    { cols: 150, rows: 110 },
    { cols: 170, rows: 120 },
    { cols: 140, rows: 90 },
  ];
  return table[Math.max(0, Math.min(table.length - 1, world))] ?? { cols: 80, rows: 60 };
}

export function cellHp(world: number): number {
  return worldDef(world).hp;
}

export function boardSpan(world: number): { w: number; h: number } {
  const { cols, rows } = gridOf(world);
  return { w: cols * TILE, h: rows * TILE };
}

export function cellDew(world: number, ranks: Ranks, petalPress = 0): number {
  return worldDef(world).pay * dewMultiplier(ranks) * (1 + 0.04 * petalPress);
}

export interface TreePoint {
  id: NodeId;
  x: number;
  y: number;
}

export const TREE_CANVAS = { w: 900, h: 720 };

export const BRANCH_COLORS: Record<Branch, string> = {
  core: '#ffe56a',
  bottle: '#8fd4ff',
  drizzle: '#7eb6ff',
  reach: '#c9a0ff',
  charm: '#ff9ec8',
};

/** Pixel layout for the flower. Center puff, four petals. Charm is two columns on the left. */
export function layoutTree(): TreePoint[] {
  const center = { x: TREE_CANVAS.w / 2, y: TREE_CANVAS.h / 2 + 8 };
  const points: TreePoint[] = [{ id: 'puff', x: center.x, y: center.y }];
  const petals: Array<{ angle: number; ids: NodeId[]; step: number }> = [
    { angle: -Math.PI / 2, ids: ['bottle', 'flask', 'reservoir', 'linger', 'glacier'], step: 68 },
    {
      angle: 0.05,
      ids: ['drizzle', 'specks', 'spore', 'mist', 'hail', 'soak', 'flow', 'spring', 'downpour', 'geyser', 'monsoon'],
      step: 52,
    },
    { angle: Math.PI / 2, ids: ['reach', 'circle', 'waterbomb', 'wide', 'mirage', 'horizon'], step: 64 },
    {
      angle: Math.PI,
      ids: [
        'charm',
        'rainbow',
        'dew',
        'bounty',
        'purify',
        'crit',
        'sprinkler',
        'spin',
        'lightning',
        'zap',
        'tornado',
        'twist',
        'harvest',
      ],
      step: 0,
    },
  ];
  for (const petal of petals) {
    if (petal.step === 0) {
      petal.ids.forEach((id, i) => {
        const col = i < 5 ? 0 : 1;
        const row = i % 5;
        points.push({ id, x: center.x - 160 - col * 108, y: 88 + row * 78 });
      });
      continue;
    }
    petal.ids.forEach((id, i) => {
      const dist = 92 + i * petal.step;
      points.push({
        id,
        x: center.x + Math.cos(petal.angle) * dist,
        y: center.y + Math.sin(petal.angle) * dist,
      });
    });
  }
  return points;
}

export interface TreeNodeView {
  id: NodeId;
  name: string;
  desc: string;
  effect: string;
  level: number;
  max: number;
  cost: number;
  blooms: number;
  /** Island index still required, when the node is visible but world-locked. */
  worldReq: number | null;
  kind: 'upgrade' | 'gate';
  color: string;
  branch: Branch;
  x: number;
  y: number;
  parent: NodeId | null;
  visible: boolean;
  ghost: boolean;
  maxed: boolean;
  afford: boolean;
}

/** True when the player can spend dew on the next rank (not a preview ghost). */
/** Nodes that became fully visible (not ghost) since the previous ranks snapshot. */
export function nodesUnlockedSince(before: Ranks, after: Ranks, unlocked = 99): NodeId[] {
  const out: NodeId[] = [];
  for (const id of NODE_IDS) {
    if (id === 'puff') continue;
    const was = isVisible(id, before) && !isGhost(id, before) && worldMet(id, unlocked);
    const now = isVisible(id, after) && !isGhost(id, after) && worldMet(id, unlocked);
    if (now && !was) out.push(id);
  }
  return out;
}

export function canPurchase(
  id: NodeId,
  ranks: Ranks,
  dew: number,
  blooms = Number.POSITIVE_INFINITY,
  unlocked = 99,
): boolean {
  if (!isVisible(id, ranks) || isGhost(id, ranks)) return false;
  const node = upgradeNode(id);
  const level = ranks[id];
  if (level >= node.max) return false;
  if (!prereqMet(id, ranks) || !worldMet(id, unlocked)) return false;
  return dew >= nodeCost(id, level) && blooms >= nodeBloomCost(id, level);
}

export function buildTree(
  ranks: Ranks,
  wallet: { dew: number; blooms: number },
  unlocked = 0,
): TreeNodeView[] {
  const points = new Map(layoutTree().map((point) => [point.id, point]));
  return allNodes().map((node) => {
    const level = ranks[node.id];
    const point = points.get(node.id);
    const visible = isVisible(node.id, ranks);
    const ghost = isGhost(node.id, ranks);
    const maxed = level >= node.max;
    const cost = nodeCost(node.id, level);
    const blooms = nodeBloomCost(node.id, level);
    const worldMin = node.worldMin ?? 0;
    const worldLocked = visible && !ghost && !maxed && worldMin > unlocked;
    return {
      id: node.id,
      name: node.name,
      desc: node.desc,
      effect: node.effect(Math.min(level, node.max)),
      level,
      max: node.max,
      cost,
      blooms,
      worldReq: worldLocked ? worldMin : null,
      kind: node.kind,
      color: node.color,
      branch: node.branch,
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      parent: node.parent,
      visible,
      ghost,
      maxed,
      afford: canPurchase(node.id, ranks, wallet.dew, wallet.blooms, unlocked),
    };
  });
}

export function abilityOn(ranks: Ranks, which: 'sprinkler' | 'lightning' | 'tornado'): boolean {
  return ranks[which] >= 1;
}

export function worldCount(): number {
  return GLOBE_WORLD + 1;
}
