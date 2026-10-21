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
  | 'downpour'
  | 'flow'
  | 'spring'
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
  | 'monsoon'
  | 'blush'
  | 'bow'
  | 'trail'
  | 'buddy'
  | 'sparkle'
  | 'hum'
  | 'press';

/**
 * One spoke of the web. Every branch owns a direction so a player can read the
 * shape of their build at a glance: pour, rain, growth, reach, fortune, storm
 * and the rare bloom branch.
 */
export type Branch = 'core' | 'pour' | 'rain' | 'reach' | 'fortune' | 'storm' | 'spark' | 'bloom';

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
  /** Blooms (rare currency) required for each rank. Omitted ranks are dew-only. */
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
  'mist',
  'soak',
  'downpour',
  'flow',
  'spring',
  'spore',
  'geyser',
  'monsoon',
  'reach',
  'circle',
  'wide',
  'horizon',
  'waterbomb',
  'mirage',
  'charm',
  'dew',
  'bounty',
  'crit',
  'harvest',
  'purify',
  'sprinkler',
  'spin',
  'lightning',
  'zap',
  'tornado',
  'twist',
  'rainbow',
  'hail',
  'blush',
  'bow',
  'trail',
  'buddy',
  'sparkle',
  'hum',
  'press',
];

/**
 * Workshop "next up" + sim buy order (mirrors balance/upgrades.json via dump-upgrades).
 * The order is the recommended path: size, then the pour, the rain, the reach, the
 * first abilities and a rare bloom treat, then the deep branches.
 */
export const PRIORITY: readonly NodeId[] = [
  'puff',
  'bottle',
  'flask',
  'drizzle',
  'specks',
  'reach',
  'circle',
  'sprinkler',
  'spin',
  'lightning',
  'zap',
  'mist',
  'soak',
  'blush',
  'press',
  'charm',
  'dew',
  'wide',
  'bounty',
  'crit',
  'reservoir',
  'linger',
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
  'purify',
  'tornado',
  'twist',
  'monsoon',
  'harvest',
  'bow',
  'trail',
  'buddy',
  'sparkle',
  'hum',
];

const NODES: readonly UpgradeNode[] = [
  {
    id: 'puff',
    parent: null,
    branch: 'core',
    kind: 'upgrade',
    name: 'Cloud Puff',
    desc: 'Get bigger. A bigger cloud drinks a wider circle and the camera leans in.',
    max: 10,
    color: '#ffe56a',
    costs: [38, 190, 300, 440, 570, 710, 880, 1011, 1200, 1500],
    effect: (level) => `Size ${cloudScale({ ...emptyRanks(), puff: level }).toFixed(2)}`,
  },
  // ---------------------------------------------------------------- pour
  {
    id: 'bottle',
    parent: 'puff',
    branch: 'pour',
    kind: 'gate',
    name: 'Bottle',
    desc: 'Open the bottle. Every pour after this lasts longer.',
    max: 1,
    color: '#8fd4ff',
    costs: [38],
    effect: () => 'Bottle open',
  },
  {
    id: 'flask',
    parent: 'bottle',
    branch: 'pour',
    kind: 'upgrade',
    name: 'Flask',
    desc: 'A deeper bottle. Each rank is one more second of rain.',
    max: 5,
    color: '#8fd4ff',
    costs: [38, 1700, 3599, 4139, 4760],
    effect: (level) => `+${(level * 1.25).toFixed(1)}s pour`,
  },
  {
    id: 'reservoir',
    parent: 'flask',
    branch: 'pour',
    kind: 'upgrade',
    name: 'Reservoir',
    desc: 'The bottle never empties early. Another second of rain on every rank.',
    max: 5,
    color: '#8fd4ff',
    costs: [67717, 2780842, 3197967, 3677661, 4229310],
    effect: (level) => `+${(level * 1.25).toFixed(1)}s pour`,
  },
  {
    id: 'linger',
    parent: 'reservoir',
    branch: 'pour',
    kind: 'upgrade',
    name: 'Linger',
    desc: 'The last sip lasts a little longer.',
    max: 5,
    color: '#8fd4ff',
    costs: [170623, 2269303, 2609698, 3001153, 3451328],
    effect: (level) => `+${(level * 0.35).toFixed(1)}s sip`,
  },
  {
    id: 'glacier',
    parent: 'linger',
    branch: 'pour',
    kind: 'upgrade',
    name: 'Glacier',
    desc: 'A final sip for the long islands.',
    max: 4,
    color: '#8fd4ff',
    costs: [640000001, 1399999999, 3100000005, 6200000011],
    effect: (level) => `+${(level * 0.25).toFixed(1)}s sip`,
  },
  // ---------------------------------------------------------------- rain
  {
    id: 'drizzle',
    parent: 'puff',
    branch: 'rain',
    kind: 'gate',
    name: 'Drizzle',
    desc: 'Open the rain. The first cloud only leaks.',
    max: 1,
    color: '#7eb6ff',
    costs: [38],
    effect: () => 'Rain open',
  },
  {
    id: 'specks',
    parent: 'drizzle',
    branch: 'rain',
    kind: 'upgrade',
    name: 'Specks',
    desc: 'More drops in the circle. Still patchy.',
    max: 6,
    color: '#7eb6ff',
    costs: [38, 1699, 3299, 4499, 5174, 5950],
    effect: (level) => `${Math.round(patchFraction({ ...emptyRanks(), drizzle: 1, specks: level }) * 100)}% of the circle`,
  },
  {
    id: 'mist',
    parent: 'specks',
    branch: 'rain',
    kind: 'upgrade',
    name: 'Mist',
    desc: 'The dry holes in the circle close up.',
    max: 6,
    color: '#7eb6ff',
    costs: [38, 11223, 13023, 14984, 17231, 19816],
    effect: (level) => `Patches +${level}`,
  },
  {
    id: 'soak',
    parent: 'mist',
    branch: 'rain',
    kind: 'upgrade',
    name: 'Soak',
    desc: 'Each drop sinks deeper. Patches fill instead of only darkening.',
    max: 7,
    color: '#7eb6ff',
    costs: [38, 10248, 11785, 13552, 15585, 17922, 20610],
    effect: (level) => `Soak x${(1.42 ** level).toFixed(2)}`,
  },
  {
    id: 'downpour',
    parent: 'soak',
    branch: 'rain',
    kind: 'upgrade',
    name: 'Downpour',
    desc: 'The circle finally means it.',
    max: 6,
    color: '#7eb6ff',
    costs: [39, 2323491, 2723429, 3602099, 4148809, 570000001],
    effect: (level) => `Soak x${(1.36 ** level).toFixed(2)}`,
  },
  {
    id: 'flow',
    parent: 'soak',
    branch: 'rain',
    kind: 'upgrade',
    name: 'Cascade',
    desc: 'The bottle tips harder and every drop sinks further.',
    max: 6,
    color: '#5ec8ff',
    costs: [170517, 197023, 2019913, 2322997, 2671447, 3193873],
    effect: (level) => `Pour x${(1.3 ** level).toFixed(2)}`,
  },
  {
    id: 'spring',
    parent: 'mist',
    branch: 'rain',
    kind: 'upgrade',
    name: 'Meadow Spring',
    desc: 'Finished ground holds a pool that seeps into thirsty neighbours.',
    max: 3,
    color: '#8ee0a0',
    costs: [39, 1795890, 2070795],
    effect: (level) => `Pools ${Math.round((0.72 + 0.22 * level) * 100)}%`,
  },
  // --------------------------------------------------------------- reach
  {
    id: 'reach',
    parent: 'puff',
    branch: 'reach',
    kind: 'gate',
    name: 'Reach',
    desc: 'Open the reach. Grow your bottle first, then widen the rain circle.',
    max: 1,
    color: '#b6e86a',
    costs: [38],
    effect: () => 'Reach open',
  },
  {
    id: 'circle',
    parent: 'reach',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Circle',
    desc: 'A wider rain circle.',
    max: 6,
    color: '#b6e86a',
    costs: [38, 5199, 6499, 8188, 9629, 11168],
    effect: (level) => `Radius x${(1 + 0.32 * level).toFixed(2)}`,
  },
  {
    id: 'wide',
    parent: 'circle',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Wide',
    desc: 'The circle covers a meadow, not a puddle.',
    max: 6,
    color: '#b6e86a',
    costs: [38, 8644, 9986, 11484, 13526, 15569],
    effect: (level) => `Radius x${(1 + 0.28 * level).toFixed(2)}`,
  },
  {
    id: 'horizon',
    parent: 'wide',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Horizon',
    desc: 'Big enough to walk a whole land in one bottle.',
    max: 5,
    color: '#b6e86a',
    costs: [39, 4799902, 5529301, 6358696, 510000001],
    effect: (level) => `Radius x${(1 + 0.26 * level).toFixed(2)}`,
  },
  {
    id: 'waterbomb',
    parent: 'circle',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Water Bomb',
    desc: 'Lobs a soaking splash ahead of the cloud.',
    max: 7,
    color: '#7ec8f0',
    costs: [1425411, 2693843, 3097919, 3562606, 5675754, 6527117, 65000000],
    blooms: [1, 0, 0, 0, 0, 0, 0],
    worldMin: 2,
    effect: (level) => `Bomb +${level}`,
  },
  {
    id: 'mirage',
    parent: 'wide',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Mirage Wave',
    desc: 'Rolling heat-waves carry water across the dunes.',
    max: 7,
    color: '#f5d27a',
    costs: [1425411, 2693843, 3097919, 3562606, 6756977, 7770522, 8936100],
    blooms: [1, 0, 0, 0, 0, 0, 0],
    worldMin: 2,
    effect: (level) => `Wave +${level}`,
  },
  // ------------------------------------------------------------- fortune
  {
    id: 'charm',
    parent: 'puff',
    branch: 'fortune',
    kind: 'gate',
    name: 'Charm',
    desc: 'Open the charm. The land starts paying you back.',
    max: 1,
    color: '#ff9bb8',
    costs: [38],
    effect: () => 'Charm open',
  },
  {
    id: 'dew',
    parent: 'charm',
    branch: 'fortune',
    kind: 'upgrade',
    name: 'Dew',
    desc: 'Every finished patch pays more.',
    max: 8,
    color: '#ff9bb8',
    costs: [38, 9035, 10439, 12005, 13805, 15875, 18256, 20995],
    effect: (level) => `Dew x${(1.22 ** level).toFixed(2)}`,
  },
  {
    id: 'bounty',
    parent: 'dew',
    branch: 'fortune',
    kind: 'upgrade',
    name: 'Bounty',
    desc: 'The meadow tips extra.',
    max: 14,
    color: '#ff9bb8',
    costs: [38, 7505, 9056, 15294, 18564, 21842, 25200, 29097, 33462, 38482, 44275, 50968, 58613, 67404],
    effect: (level) => `Dew x${(1.18 ** level).toFixed(2)}`,
  },
  {
    id: 'crit',
    parent: 'bounty',
    branch: 'fortune',
    kind: 'upgrade',
    name: 'Sunshower',
    desc: 'Some patches bloom on contact and pay triple.',
    max: 6,
    color: '#ff9bb8',
    costs: [38, 62580, 71966, 2503125, 2881593, 3313831],
    effect: (level) => `${Math.round(critChance({ ...emptyRanks(), crit: level }) * 100)}% crit`,
  },
  {
    id: 'harvest',
    parent: 'bounty',
    branch: 'fortune',
    kind: 'upgrade',
    name: 'Heavy Harvest',
    desc: 'A wider rain on the last world. Each rank is a globe bottle well spent.',
    max: 40,
    color: '#ff9bb8',
    worldMin: 4,
    costs: [7399999, 64000000, 73600000, 84640000, 110000000, 126499999, 145474998, 167296247, 192390684, 221249286, 254436678, 292602179, 336492505, 450000001, 1200000005, 2800000005, 5500000011, 9700000017, 14999999999, 21000000059, 27000000059, 33000000119, 37950000137, 43642500157, 50188875180, 57717206456, 66374787424, 76331005537, 87780656368, 100947754822, 116089918045, 133503405751, 153528916613, 176558254104, 203041992220, 233498291053, 268523034710, 308801489917, 355121713404, 408389970414],
    blooms: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    effect: (level) => `Radius +${level * 2}%`,
  },
  {
    id: 'purify',
    parent: 'bounty',
    branch: 'fortune',
    kind: 'upgrade',
    name: 'Purify Rain',
    desc: 'Toxic crust melts under a green wash.',
    max: 12,
    color: '#b8ff9a',
    costs: [400000001, 1099999999, 2499999999, 4900000011, 8700000017, 13000000059, 18999999999, 21849999999, 25127499998, 28896624997, 33231118746, 38215786558],
    blooms: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    worldMin: 3,
    effect: (level) => `Purify +${level}`,
  },
  // --------------------------------------------------------------- storm
  {
    id: 'sprinkler',
    parent: 'puff',
    branch: 'storm',
    kind: 'gate',
    name: 'Sprinkler',
    desc: 'The cloud spins and paints a ring of rain behind it.',
    max: 1,
    color: '#ff9bb8',
    costs: [39],
    blooms: [1],
    effect: () => 'Sprinkler unlocked',
  },
  {
    id: 'spin',
    parent: 'sprinkler',
    branch: 'storm',
    kind: 'upgrade',
    name: 'Spin',
    desc: 'The ring reaches further.',
    max: 3,
    color: '#ff9bb8',
    costs: [39, 2209411, 2540823],
    blooms: [1, 0, 0],
    effect: (level) => `Ring +${level}`,
  },
  {
    id: 'lightning',
    parent: 'sprinkler',
    branch: 'storm',
    kind: 'gate',
    name: 'Water Bolt',
    desc: 'A bolt finishes a tight circle of patches.',
    max: 1,
    color: '#ffd56a',
    costs: [2477987],
    blooms: [1],
    effect: () => 'Bolt unlocked',
  },
  {
    id: 'zap',
    parent: 'lightning',
    branch: 'storm',
    kind: 'upgrade',
    name: 'Zap',
    desc: 'The bolt covers more patches.',
    max: 3,
    color: '#ffd56a',
    costs: [2725474, 3134295, 3604438],
    blooms: [1, 0, 0],
    effect: (level) => `Bolt +${level}`,
  },
  {
    id: 'tornado',
    parent: 'lightning',
    branch: 'storm',
    kind: 'gate',
    name: 'Water Spout',
    desc: 'A twister walks ahead and greens what it touches.',
    max: 4,
    color: '#d7c4ff',
    costs: [200000000, 360000000, 999999999, 2200000005],
    blooms: [1, 0, 0, 0],
    worldMin: 1,
    effect: () => 'Spout unlocked',
  },
  {
    id: 'twist',
    parent: 'tornado',
    branch: 'storm',
    kind: 'upgrade',
    name: 'Twist',
    desc: 'A fatter twister.',
    max: 7,
    color: '#d7c4ff',
    costs: [230000000, 320000000, 900000001, 1900000005, 4400000005, 7700000017, 12000000000],
    blooms: [0, 0, 0, 0, 0, 0, 0],
    worldMin: 1,
    effect: (level) => `Twister +${level}`,
  },
  // ---------------------------------------------------------------- spark
  {
    id: 'geyser',
    parent: 'soak',
    branch: 'spark',
    kind: 'upgrade',
    name: 'Geyser Burst',
    desc: 'Auto geysers punch through dry ground when you pour.',
    max: 6,
    color: '#5ec8ff',
    costs: [1841872, 140000000, 180039063, 230000000, 264499999, 304174998],
    blooms: [1, 1, 2, 2, 2, 2],
    effect: (level) => `Geyser rank ${level}`,
  },
  {
    id: 'spore',
    parent: 'specks',
    branch: 'spark',
    kind: 'upgrade',
    name: 'Spore Drizzle',
    desc: 'Green spores wake moss in a wide arc.',
    max: 5,
    color: '#7ddf6a',
    costs: [199999999, 289999998, 800000001, 1700000005, 3900000005],
    blooms: [1, 2, 2, 2, 2],
    effect: (level) => `Spore +${level}`,
  },
  {
    id: 'rainbow',
    parent: 'charm',
    branch: 'spark',
    kind: 'upgrade',
    name: 'Rainbow Arc',
    desc: 'A shimmering arc paints frost into bloom.',
    max: 7,
    color: '#ffb4e8',
    costs: [2170, 2717, 4746469, 5458459, 6277227, 7218811, 8301632],
    blooms: [1, 0, 0, 0, 0, 0, 0],
    worldMin: 1,
    effect: (level) => `Arc +${level}`,
  },
  {
    id: 'hail',
    parent: 'mist',
    branch: 'spark',
    kind: 'upgrade',
    name: 'Hail Melt',
    desc: 'Ice shatters into instant growth.',
    max: 7,
    color: '#d8f4ff',
    costs: [2170, 2495, 2869, 3299, 3794, 4652501, 5350376],
    blooms: [1, 0, 0, 0, 0, 0, 0],
    worldMin: 1,
    effect: (level) => `Melt +${level}`,
  },
  {
    id: 'monsoon',
    parent: 'downpour',
    branch: 'spark',
    kind: 'upgrade',
    name: 'Monsoon Band',
    desc: 'A latitude belt of rain wraps the globe.',
    max: 6,
    color: '#6ec8ff',
    costs: [7399999, 8509999, 9786499, 11254474, 12942645, 14884041],
    blooms: [2, 0, 0, 0, 0, 0],
    worldMin: 4,
    effect: (level) => `Band +${level}`,
  },
  // --------------------------------------------------------------- bloom
  {
    id: 'blush',
    parent: 'puff',
    branch: 'bloom',
    kind: 'upgrade',
    name: 'Rosy Cheeks',
    desc: 'The cloud blushes when it rains. One bloom.',
    max: 1,
    color: '#ff9ec8',
    costs: [0],
    blooms: [1],
    effect: () => 'Rosy cheeks',
  },
  {
    id: 'bow',
    parent: 'blush',
    branch: 'bloom',
    kind: 'upgrade',
    name: 'Rain Bow',
    desc: 'A little ribbon on your fluff.',
    max: 1,
    color: '#ff9ec8',
    costs: [0],
    blooms: [1],
    effect: () => 'Rain bow',
  },
  {
    id: 'trail',
    parent: 'bow',
    branch: 'bloom',
    kind: 'upgrade',
    name: 'Silver Drops',
    desc: 'Rain streaks catch the light.',
    max: 1,
    color: '#ff9ec8',
    costs: [0],
    blooms: [2],
    effect: () => 'Silver drops',
  },
  {
    id: 'buddy',
    parent: 'trail',
    branch: 'bloom',
    kind: 'upgrade',
    name: 'Meadow Friend',
    desc: 'One more critter wanders the green.',
    max: 1,
    color: '#ff9ec8',
    costs: [0],
    blooms: [2],
    effect: () => '+1 critter',
  },
  {
    id: 'sparkle',
    parent: 'buddy',
    branch: 'bloom',
    kind: 'upgrade',
    name: 'Bloom Sparkle',
    desc: 'Tiny glints when tiles pop green.',
    max: 1,
    color: '#ff9ec8',
    costs: [0],
    blooms: [2],
    effect: () => 'Bloom sparkle',
  },
  {
    id: 'hum',
    parent: 'sparkle',
    branch: 'bloom',
    kind: 'upgrade',
    name: 'Happy Hum',
    desc: 'Soft hum while the bottle drains.',
    max: 1,
    color: '#ff9ec8',
    costs: [0],
    blooms: [3],
    effect: () => 'Happy hum',
  },
  {
    id: 'press',
    parent: 'blush',
    branch: 'bloom',
    kind: 'upgrade',
    name: 'Pressed Petals',
    desc: 'Press every drop harder. +4% dew each rank.',
    max: 10,
    color: '#ff9ec8',
    costs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    blooms: [1, 1, 1, 2, 2, 2, 2, 2, 2, 3],
    effect: (level) => `Dew +${level * 4}%`,
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
    blush: 0,
    bow: 0,
    trail: 0,
    buddy: 0,
    sparkle: 0,
    hum: 0,
    press: 0,
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
      return ranks.drizzle >= 1;
    case 'spin':
      return ranks.sprinkler >= 1;
    case 'lightning':
      return ranks.sprinkler >= 1 && ranks.specks >= 2;
    case 'zap':
      return ranks.lightning >= 1;
    case 'tornado':
      return ranks.lightning >= 1 && ranks.zap >= 1;
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
    case 'blush':
      return ranks.puff >= 1;
    case 'bow':
      return ranks.blush >= 1;
    case 'trail':
      return ranks.bow >= 1;
    case 'buddy':
      return ranks.trail >= 1;
    case 'sparkle':
      return ranks.buddy >= 1;
    case 'hum':
      return ranks.sparkle >= 1;
    case 'press':
      return ranks.blush >= 1;
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

/** A fresh bottle is 10s. Flask and Reservoir each add 1s, so a finished first island sits near 20s. */
export function bottleSeconds(ranks: Ranks): number {
  const stretch = (ranks.flask + ranks.reservoir) * 1.25;
  const sip = ranks.linger * 0.35 + ranks.glacier * 0.25;
  return 10 + stretch + sip;
}

export function drainPerSec(_ranks: Ranks): number {
  return 46;
}

export function maxLiters(ranks: Ranks): number {
  return drainPerSec(ranks) * bottleSeconds(ranks);
}

export function rainRadius(ranks: Ranks): number {
  const grown = cloudScale(ranks) / BASE_SCALE;
  const reach =
    (1 + 0.12 * ranks.circle) *
    (1 + 0.11 * ranks.wide) *
    (1 + 0.1 * ranks.horizon) *
    (1 + 0.008 * ranks.harvest) *
    (1 + 0.16 * ranks.sprinkler) *
    (1 + 0.06 * ranks.spin) *
    (1 + 0.12 * ranks.lightning) *
    (1 + 0.04 * ranks.zap) *
    (1 + 0.12 * ranks.tornado) *
    (1 + 0.04 * ranks.twist) *
    (1 + 0.12 * ranks.monsoon);
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
  return 1.22 ** ranks.dew * 1.18 ** ranks.bounty * (1 + 0.04 * ranks.press);
}

export function maskOf(world: number): { cols: number; rows: number } {
  const table = [
    { cols: 133, rows: 97 },
    { cols: 244, rows: 217 },
    { cols: 355, rows: 275 },
    { cols: 340, rows: 260 },
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

export function cellDew(world: number, ranks: Ranks): number {
  return worldDef(world).pay * dewMultiplier(ranks);
}

export interface TreePoint {
  id: NodeId;
  x: number;
  y: number;
}

export const TREE_CANVAS = { w: 1240, h: 900 };

export const BRANCH_COLORS: Record<Branch, string> = {
  core: '#ffe56a',
  pour: '#8fd4ff',
  rain: '#7eb6ff',
  reach: '#c9a0ff',
  fortune: '#ff9ec8',
  storm: '#ffb3d0',
  spark: '#7ddf6a',
  bloom: '#ffd9f0',
};

/** One spoke of the web: a chain of nodes radiating from the cloud. */
interface Spoke {
  /** Direction in radians (0 = right, -PI/2 = up). */
  angle: number;
  /** Node ids, first one nearest the centre. */
  ids: readonly NodeId[];
  /** Distance between two nodes on this spoke. */
  step: number;
  /** How much the spoke curls as it goes outward. */
  drift: number;
  /** Nodes that hang beside their parent instead of continuing the chain. */
  buds?: ReadonlyArray<{ id: NodeId; after: NodeId; turn: number }>;
}

/**
 * The upgrade web: Cloud Puff sits in the middle and every kind of power runs
 * out along its own spoke, so a finished build reads like a flower.
 */
const SPOKES: readonly Spoke[] = [
  {
    angle: -Math.PI / 2,
    ids: ['bottle', 'flask', 'reservoir', 'linger', 'glacier'],
    step: 74,
    drift: 0.012,
  },
  {
    angle: -Math.PI / 2 + 0.92,
    ids: ['drizzle', 'specks', 'mist', 'soak', 'downpour'],
    step: 72,
    drift: 0.03,
    buds: [
      { id: 'flow', after: 'soak', turn: -0.42 },
      { id: 'spring', after: 'mist', turn: -0.4 },
    ],
  },
  {
    angle: 0.12,
    ids: ['geyser', 'spore', 'rainbow', 'hail', 'monsoon'],
    step: 76,
    drift: -0.028,
  },
  {
    angle: Math.PI / 2 + 0.22,
    ids: ['reach', 'circle', 'wide', 'horizon'],
    step: 80,
    drift: -0.03,
    buds: [
      { id: 'waterbomb', after: 'circle', turn: 0.4 },
      { id: 'mirage', after: 'wide', turn: 0.38 },
    ],
  },
  {
    angle: Math.PI - 0.28,
    ids: ['charm', 'dew', 'bounty', 'crit', 'harvest'],
    step: 78,
    drift: 0.03,
    buds: [{ id: 'purify', after: 'bounty', turn: 0.42 }],
  },
  {
    angle: Math.PI + 0.42,
    ids: ['sprinkler', 'lightning', 'zap', 'tornado', 'twist'],
    step: 76,
    drift: 0.034,
    buds: [{ id: 'spin', after: 'sprinkler', turn: -0.42 }],
  },
  {
    angle: -Math.PI + 0.42,
    ids: ['blush', 'bow', 'trail', 'buddy', 'sparkle', 'hum'],
    step: 70,
    drift: -0.03,
    buds: [{ id: 'press', after: 'blush', turn: 0.44 }],
  },
];

/** Pixel layout for the upgrade web: a hub with seven spokes. */
export function layoutTree(): TreePoint[] {
  const center = { x: TREE_CANVAS.w / 2, y: TREE_CANVAS.h / 2 };
  const points: TreePoint[] = [{ id: 'puff', x: center.x, y: center.y }];
  // The web is a little wider than tall so it fills a 16:9 workshop panel.
  const squash = 0.82;
  for (const spoke of SPOKES) {
    const place = new Map<NodeId, { x: number; y: number }>();
    spoke.ids.forEach((id, i) => {
      const angle = spoke.angle + spoke.drift * i;
      const dist = 118 + i * spoke.step;
      place.set(id, {
        x: center.x + Math.cos(angle) * dist,
        y: center.y + Math.sin(angle) * dist * squash,
      });
    });
    for (const [id, p] of place) points.push({ id, x: p.x, y: p.y });
    for (const bud of spoke.buds ?? []) {
      const parent = place.get(bud.after);
      if (!parent) continue;
      const angle = spoke.angle + spoke.drift * (spoke.ids.indexOf(bud.after) + 1) + bud.turn;
      const dist = 118 + (spoke.ids.indexOf(bud.after) + 1) * spoke.step;
      points.push({
        id: bud.id,
        x: center.x + Math.cos(angle) * dist,
        y: center.y + Math.sin(angle) * dist * squash,
      });
    }
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
