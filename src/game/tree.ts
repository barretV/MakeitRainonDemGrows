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
  | 'drone'
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
  | 'tide'
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
  'tide',
  'mirage',
  'charm',
  'dew',
  'bounty',
  'crit',
  'harvest',
  'purify',
  'sprinkler',
  'spin',
  'drone',
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
  'drone',
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
  'tide',
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
    desc: 'Get bigger. A bigger cloud drinks a wider circle, and stays close enough that you can still see what grows.',
    max: 10,
    color: '#ffe56a',
    costs: [17, 23, 31, 41, 52, 63, 77, 91, 159, 239],
    effect: (level) => `Size ${cloudScale({ ...emptyRanks(), puff: level }).toFixed(2)}`,
  },
  // ---------------------------------------------------------------- pour
  {
    id: 'bottle',
    parent: 'puff',
    branch: 'pour',
    kind: 'gate',
    name: 'Bottle',
    desc: 'Open the bottle. Every pour lasts two seconds longer, and the Flask and the Drizzle come with it.',
    max: 1,
    color: '#8fd4ff',
    costs: [17],
    effect: () => 'Pour +2s',
  },
  {
    id: 'flask',
    parent: 'bottle',
    branch: 'pour',
    kind: 'upgrade',
    name: 'Flask',
    desc: 'A deeper bottle. Each rank pours for another second and a quarter.',
    max: 5,
    color: '#8fd4ff',
    costs: [17, 349, 629, 723, 831],
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
    costs: [47253, 54344, 62871, 73779, 1780906],
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
    costs: [53017, 1645187, 1891964, 58998089, 67849518],
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
    costs: [369992657, 988619004, 2695317554, 7590124323],
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
    costs: [17],
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
    costs: [17, 999, 1199, 1379, 1585, 1822],
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
    costs: [17, 5064, 5823, 6696, 7712, 8868],
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
    costs: [17, 3531, 4060, 4669, 5369, 6174, 7099],
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
    costs: [1346671, 1548701, 59999999, 68999998, 139999999, 160999999],
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
    costs: [51434, 1451096, 1668779, 58999999, 67849998, 78027498],
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
    costs: [62987, 1309966, 1506460],
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
    costs: [17],
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
    costs: [17, 1799, 2200, 2607, 3701, 4256],
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
    costs: [17, 2292, 2644, 6568, 7967, 9190],
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
    costs: [1149360, 1348099, 169999997, 220000597, 260117157],
    effect: (level) => `Radius x${(1 + 0.26 * level).toFixed(2)}`,
  },
  {
    id: 'waterbomb',
    parent: 'circle',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Water Bomb',
    desc: 'A fat drop arcs out and craters a dry patch.',
    max: 7,
    color: '#7ec8f0',
    costs: [1698429, 1953193, 2246171, 2583097, 2970560, 3416144, 3928566],
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
    costs: [1698429, 1953193, 2246171, 2583097, 2970560, 3416144, 3928566],
    blooms: [1, 0, 0, 0, 0, 0, 0],
    worldMin: 2,
    effect: (level) => `Wave +${level}`,
  },
  {
    id: 'tide',
    parent: 'waterbomb',
    branch: 'reach',
    kind: 'upgrade',
    name: 'Tidal Sheet',
    desc: 'A wall of water rolls across a strip of the island.',
    max: 3,
    color: '#7ec8f0',
    costs: [750000, 14000000, 21000000],
    blooms: [1, 1, 2],
    worldMin: 3,
    effect: (level) => `Sheet +${level}`,
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
    costs: [17],
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
    costs: [17, 2592, 2988, 3438, 3954, 4555, 5253, 6054],
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
    costs: [17, 3047, 9337, 10737, 12348, 14200, 16341, 18792, 21611, 24872, 28602, 32892, 37841, 43517],
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
    costs: [45914, 53158, 61131, 70300, 80847, 92982],
    effect: (level) => `${Math.round(critChance({ ...emptyRanks(), crit: level }) * 100)}% crit`,
  },
  {
    id: 'harvest',
    parent: 'bounty',
    branch: 'fortune',
    kind: 'upgrade',
    name: 'Heavy Harvest',
    desc: 'A wider rain. The drops fall further out, so one bottle reaches more of the island.',
    max: 70,
    color: '#ff9bb8',
    worldMin: 3,
    costs: [356533, 410012, 471513, 542239, 623575, 717110, 824676, 948378, 1090633, 1254228, 1442362, 1658715, 1907522, 2193650, 2522697, 2901101, 3336265, 3836705, 4412210, 5074041, 5835147, 6710419, 7716981, 8874528, 10205707, 11736563, 13497047, 15521604, 17849844, 20527321, 23606420, 27147383, 31219491, 35902416, 41287781, 47480952, 54603099, 62793572, 72212617, 83044515, 95501200, 109826384, 126300355, 145245408, 167032219, 192087051, 220900108, 254035124, 292140392, 335961450, 386355667, 444309017, 510955369, 587598673, 675738474, 777099245, 893664131, 1027713750, 1181870811, 1359151433, 1563024148, 1797477769, 2067099434, 2377164349, 2733739001, 3143799850, 3615369828, 4157675301, 4781326595, 5498525585],
    blooms: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    effect: (level) => `Radius +${level * 2}%`,
  },
  {
    id: 'purify',
    parent: 'bounty',
    branch: 'fortune',
    kind: 'upgrade',
    name: 'Purify Rain',
    desc: 'Toxic crust melts under a green wash.',
    max: 24,
    color: '#b8ff9a',
    costs: [380040004, 437046004, 502602904, 577993341, 664692345, 764396200, 879055632, 1010913981, 1162551083, 1336933755, 1537473830, 1768094921, 2033309183, 2338305595, 2689051468, 3092409263, 3556270748, 4089711500, 4703168415, 5408643954, 6219940905, 7152932289, 8225872356, 9459753334],
    blooms: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
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
    desc: 'The cloud spins out jets of water, like a lawn sprinkler.',
    max: 1,
    color: '#ff9bb8',
    costs: [17],
    blooms: [1],
    effect: () => 'Sprinkler unlocked',
  },
  {
    id: 'spin',
    parent: 'sprinkler',
    branch: 'storm',
    kind: 'upgrade',
    name: 'Spin',
    desc: 'More jets, and they reach further.',
    max: 3,
    color: '#ff9bb8',
    costs: [17, 4400, 1482969],
    blooms: [1, 0, 0],
    effect: (level) => `${4 + level} jets`,
  },
  {
    id: 'drone',
    parent: 'sprinkler',
    branch: 'storm',
    kind: 'upgrade',
    name: 'Drizzle Drones',
    desc: 'Little clouds fly off and rain on land you have not touched.',
    max: 3,
    color: '#9fd7ff',
    costs: [1200, 18000, 240000],
    blooms: [1, 1, 1],
    effect: (level) => `${level} drone${level === 1 ? '' : 's'}`,
  },
  {
    id: 'lightning',
    parent: 'sprinkler',
    branch: 'storm',
    kind: 'gate',
    name: 'Water Bolt',
    desc: 'A bolt falls on dead ground and wakes the spot.',
    max: 1,
    color: '#ffd56a',
    costs: [22000],
    blooms: [1],
    worldMin: 1,
    effect: () => 'Sky bolt',
  },
  {
    id: 'zap',
    parent: 'lightning',
    branch: 'storm',
    kind: 'upgrade',
    name: 'Zap',
    desc: 'A second bolt follows the first.',
    max: 3,
    color: '#ffd56a',
    costs: [1729115, 1988482, 56998335],
    blooms: [1, 0, 0],
    effect: (level) => `Bolt +${level}`,
  },
  {
    id: 'tornado',
    parent: 'lightning',
    branch: 'storm',
    kind: 'gate',
    name: 'Water Spout',
    desc: 'A waterspout hunts dead ground and leaves a green trail.',
    max: 4,
    color: '#d7c4ff',
    costs: [12000, 1894330933, 5367687457, 14877496141],
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
    desc: 'A fatter spout that stays out longer.',
    max: 7,
    color: '#d7c4ff',
    costs: [619823651, 1701364217, 4796920081, 13006574943, 25934190676, 45933940806, 81865148337],
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
    desc: 'A geyser punches up out of dry ground.',
    max: 6,
    color: '#5ec8ff',
    costs: [26000, 319799845, 559068439, 1501217668, 4296497954, 11006583631],
    blooms: [1, 1, 2, 2, 2, 2],
    worldMin: 1,
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
    costs: [340070789, 499021662, 1301180601, 3796220834, 10005715311],
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
    costs: [1247959, 1435152, 1650424, 1897988, 2182685, 2510087, 2886600],
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
    costs: [1283288, 1475781, 1697147, 1951718, 2244476, 2581146, 2968318],
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
    max: 10,
    color: '#6ec8ff',
    costs: [7900044, 9085051, 10447809, 12014980, 13817226, 15889810, 18273281, 21014273, 24166414, 27791375],
    blooms: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
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
    drone: 0,
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
    tide: 0,
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
    case 'drone':
      return ranks.sprinkler >= 1;
    case 'lightning':
      return ranks.sprinkler >= 1 && ranks.specks >= 2;
    case 'zap':
      return ranks.lightning >= 1;
    case 'tornado':
      return ranks.lightning >= 1;
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
    case 'tide':
      return ranks.waterbomb >= 1;
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

/** A fresh bottle is 10s. Opening it adds a couple of seconds, and Flask and Reservoir each add 1.25s, so a finished first island sits near 20s. */
export function bottleSeconds(ranks: Ranks): number {
  const open = ranks.bottle >= 1 ? 2 : 0;
  const stretch = (ranks.flask + ranks.reservoir) * 1.25;
  const sip = ranks.linger * 0.35 + ranks.glacier * 0.25;
  return 10 + open + stretch + sip;
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
    (1 + 0.07 * ranks.tornado) *
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

/** Filled in by layoutTree so the workshop frame always wraps the flower. */
export const TREE_CANVAS = { w: 1600, h: 1380 };

export interface SpokeLabel {
  branch: Branch;
  x: number;
  y: number;
}

/** One quiet name past the tip of each straight spoke. */
export let spokeLabels: SpokeLabel[] = [];

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

/**
 * Six straight spokes, one per branch that actually grows out of Cloud Puff.
 * Spark upgrades hang beside the node that unlocks them, so their vines stay
 * short instead of cutting across the flower. `side` 1 points toward the next
 * spoke; tails continue a side branch outward in a column.
 */
interface SpokeDef {
  branch: Branch;
  ids: readonly NodeId[];
  buds: ReadonlyArray<{ id: NodeId; after: NodeId; side: 1 | -1 }>;
  tails?: ReadonlyArray<{ id: NodeId; after: NodeId }>;
}

const SPOKES: readonly SpokeDef[] = [
  {
    branch: 'pour',
    ids: ['bottle', 'flask', 'reservoir', 'linger', 'glacier'],
    buds: [],
  },
  {
    branch: 'rain',
    ids: ['drizzle', 'specks', 'mist', 'soak', 'downpour'],
    buds: [
      { id: 'spore', after: 'specks', side: 1 },
      { id: 'spring', after: 'mist', side: -1 },
      { id: 'hail', after: 'mist', side: 1 },
      { id: 'flow', after: 'soak', side: -1 },
      { id: 'geyser', after: 'soak', side: 1 },
      { id: 'monsoon', after: 'downpour', side: 1 },
    ],
  },
  {
    branch: 'reach',
    ids: ['reach', 'circle', 'wide', 'horizon'],
    buds: [
      { id: 'waterbomb', after: 'circle', side: -1 },
      { id: 'mirage', after: 'wide', side: 1 },
    ],
    tails: [{ id: 'tide', after: 'waterbomb' }],
  },
  {
    branch: 'fortune',
    ids: ['charm', 'dew', 'bounty', 'crit'],
    buds: [
      { id: 'rainbow', after: 'charm', side: -1 },
      { id: 'harvest', after: 'bounty', side: -1 },
      { id: 'purify', after: 'bounty', side: 1 },
    ],
  },
  {
    branch: 'storm',
    ids: ['sprinkler', 'lightning', 'zap'],
    buds: [
      { id: 'spin', after: 'sprinkler', side: -1 },
      { id: 'drone', after: 'sprinkler', side: 1 },
      { id: 'tornado', after: 'lightning', side: -1 },
    ],
    tails: [{ id: 'twist', after: 'tornado' }],
  },
  {
    branch: 'bloom',
    ids: ['blush', 'bow', 'trail', 'buddy', 'sparkle', 'hum'],
    buds: [{ id: 'press', after: 'blush', side: 1 }],
  },
];

const DROP_NODES = new Set<NodeId>([
  'drizzle', 'specks', 'mist', 'soak', 'downpour', 'flow', 'spring',
  'charm', 'dew', 'bounty', 'crit', 'harvest', 'purify',
]);

const GATE_NODES = new Set<NodeId>([
  'bottle', 'drizzle', 'reach', 'charm', 'sprinkler', 'lightning', 'tornado',
]);

/** Match TreeNodeCloud sizes, plus room for the badge above and the rank chip. */
function layoutSize(id: NodeId): { w: number; h: number } {
  if (id === 'puff') return { w: 88, h: 58 };
  const drop = DROP_NODES.has(id);
  const gate = GATE_NODES.has(id);
  if (drop) return gate ? { w: 58, h: 74 } : { w: 54, h: 70 };
  return gate ? { w: 66, h: 46 } : { w: 60, h: 42 };
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function paddedBox(id: NodeId, x: number, y: number): Box {
  const { w, h } = layoutSize(id);
  return { x0: x - w / 2 - 8, y0: y - h / 2 - 16, x1: x + w / 2 + 14, y1: y + h / 2 + 10 };
}

function boxGap(a: Box, b: Box): number {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ox >= 0 && oy >= 0) return -Math.min(ox, oy);
  if (ox >= 0) return -oy;
  if (oy >= 0) return -ox;
  return Math.hypot(-ox, -oy);
}

const CLEAR_GAP = 14;

/** Pixel layout: a hub, six even spokes, and side columns that follow each parent. */
export function layoutTree(): TreePoint[] {
  const squash = 0.92;
  const first = 198;
  const cloudStep = 120;
  const dropStep = 148;
  const count = SPOKES.length;
  const at = new Map<NodeId, { x: number; y: number }>();
  const spokeOf = new Map<NodeId, number>();
  const boxes: Box[] = [];
  const basis: { tx: number; ty: number; rx: number; ry: number; step: number }[] = [];

  const put = (id: NodeId, x: number, y: number, spoke: number) => {
    at.set(id, { x, y });
    spokeOf.set(id, spoke);
    boxes.push(paddedBox(id, x, y));
  };

  put('puff', 0, 0, 0);

  SPOKES.forEach((spoke, s) => {
    const angle = -Math.PI / 2 + s * ((2 * Math.PI) / count);
    const step = DROP_NODES.has(spoke.ids[0]!) ? dropStep : cloudStep;
    let tx = -Math.sin(angle);
    let ty = Math.cos(angle) * squash;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    let rx = Math.cos(angle);
    let ry = Math.sin(angle) * squash;
    const rl = Math.hypot(rx, ry) || 1;
    rx /= rl;
    ry /= rl;
    basis.push({ tx, ty, rx, ry, step });
    spoke.ids.forEach((id, i) => {
      const dist = first + i * step;
      put(id, Math.cos(angle) * dist, Math.sin(angle) * dist * squash, s);
    });
  });

  const clearOf = (id: NodeId, x: number, y: number) => {
    const box = paddedBox(id, x, y);
    return boxes.every((other) => boxGap(box, other) >= CLEAR_GAP);
  };

  const parkBeside = (id: NodeId, after: NodeId, side: 1 | -1) => {
    const spoke = spokeOf.get(after);
    const parent = at.get(after);
    if (spoke == null || !parent) return;
    const { tx, ty, rx, ry } = basis[spoke]!;
    for (const out of [0, 24, 52]) {
      for (const sign of [side, -side] as const) {
        for (let beside = 76; beside <= 240; beside += 4) {
          const x = parent.x + tx * sign * beside + rx * out;
          const y = parent.y + ty * sign * beside + ry * out;
          if (!clearOf(id, x, y)) continue;
          put(id, x, y, spoke);
          return;
        }
      }
    }
    put(id, parent.x + tx * side * 200, parent.y + ty * side * 200, spoke);
  };

  for (const spoke of SPOKES) {
    for (const bud of spoke.buds) parkBeside(bud.id, bud.after, bud.side);
  }

  for (const spoke of SPOKES) {
    for (const tail of spoke.tails ?? []) {
      const spokeIndex = spokeOf.get(tail.after);
      const parent = at.get(tail.after);
      if (spokeIndex == null || !parent) continue;
      const { tx, ty, rx, ry, step } = basis[spokeIndex]!;
      let placed = false;
      for (const extra of [0, 16, -16, 32, -32]) {
        if (placed) break;
        for (const mul of [1, 1.15, 0.85, 1.35]) {
          const x = parent.x + rx * step * mul + tx * extra;
          const y = parent.y + ry * step * mul + ty * extra;
          if (!clearOf(tail.id, x, y)) continue;
          put(tail.id, x, y, spokeIndex);
          placed = true;
          break;
        }
      }
      if (!placed) put(tail.id, parent.x + rx * step, parent.y + ry * step, spokeIndex);
    }
  }

  const labels: { branch: Branch; x: number; y: number }[] = [];
  SPOKES.forEach((spoke, s) => {
    const tip = at.get(spoke.ids[spoke.ids.length - 1]!);
    if (!tip) return;
    const { rx, ry } = basis[s]!;
    labels.push({ branch: spoke.branch, x: tip.x + rx * 96, y: tip.y + ry * 96 });
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [id, p] of at) {
    const box = paddedBox(id, p.x, p.y);
    minX = Math.min(minX, box.x0);
    minY = Math.min(minY, box.y0);
    maxX = Math.max(maxX, box.x1);
    maxY = Math.max(maxY, box.y1);
  }
  for (const label of labels) {
    minX = Math.min(minX, label.x - 78);
    maxX = Math.max(maxX, label.x + 78);
    minY = Math.min(minY, label.y - 18);
    maxY = Math.max(maxY, label.y + 18);
  }
  const margin = 72;
  TREE_CANVAS.w = Math.ceil(maxX - minX + margin * 2);
  TREE_CANVAS.h = Math.ceil(maxY - minY + margin * 2);
  const dx = margin - minX;
  const dy = margin - minY;
  spokeLabels = labels.map((label) => ({ branch: label.branch, x: label.x + dx, y: label.y + dy }));
  return [...at.entries()].map(([id, p]) => ({ id, x: p.x + dx, y: p.y + dy }));
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

layoutTree();
