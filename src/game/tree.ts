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
  | 'reach'
  | 'circle'
  | 'wide'
  | 'horizon'
  | 'charm'
  | 'dew'
  | 'bounty'
  | 'crit'
  | 'sprinkler'
  | 'spin'
  | 'lightning'
  | 'zap'
  | 'tornado'
  | 'twist';

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
  'reach',
  'circle',
  'wide',
  'horizon',
  'charm',
  'dew',
  'bounty',
  'crit',
  'sprinkler',
  'spin',
  'lightning',
  'zap',
  'tornado',
  'twist',
];

/** Greedy campaign order. A node is skipped until its parent rank is high enough and the player can afford the next rank. */
export const PRIORITY: readonly NodeId[] = [
  'puff',
  'bottle',
  'drizzle',
  'reach',
  'charm',
  'flask',
  'specks',
  'circle',
  'dew',
  'soak',
  'reservoir',
  'mist',
  'wide',
  'bounty',
  'linger',
  'crit',
  'downpour',
  'horizon',
  'glacier',
  'sprinkler',
  'spin',
  'lightning',
  'zap',
  'tornado',
  'twist',
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
    costs: [6, 11, 26, 62, 145, 340, 780, 1750],
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
    costs: [8],
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
    costs: [12, 30, 72, 165, 380],
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
    costs: [38, 95, 220, 500, 1150],
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
    costs: [48, 115, 265, 620, 1450],
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
    costs: [180, 420, 980, 2200],
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
    costs: [9],
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
    costs: [14, 34, 82, 190, 440],
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
    costs: [52, 125, 290, 670, 1550],
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
    costs: [18, 44, 105, 245, 560],
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
    costs: [4200, 10500, 24000, 52000],
    effect: (level) => `Soak x${(1.36 ** level).toFixed(2)}`,
  },
  {
    id: 'reach',
    parent: 'puff',
    branch: 'reach',
    kind: 'gate',
    name: 'Reach',
    desc: 'Open the reach petal. The circle can grow past the puff.',
    max: 1,
    color: '#b6e86a',
    costs: [10],
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
    costs: [16, 40, 95, 220, 510],
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
    costs: [58, 140, 325, 7500, 18500],
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
    costs: [13500, 30000, 58000, 100000],
    effect: (level) => `Radius x${(1 + 0.26 * level).toFixed(2)}`,
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
    costs: [11],
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
    costs: [15, 38, 90, 210, 480],
    effect: (level) => `Dew x${(1.22 ** level).toFixed(2)}`,
  },
  {
    id: 'bounty',
    parent: 'dew',
    branch: 'charm',
    kind: 'upgrade',
    name: 'Bounty',
    desc: 'The meadow tips extra.',
    max: 4,
    color: '#ff9bb8',
    costs: [72, 180, 420, 960],
    effect: (level) => `Dew x${(1.18 ** level).toFixed(2)}`,
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
    costs: [78, 195, 450, 1050],
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
    costs: [18000],
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
    costs: [24000, 52000, 110000],
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
    costs: [40000],
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
    costs: [48000, 100000, 200000],
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
    costs: [120000],
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
    costs: [140000, 260000, 480000],
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
    downpour: 0,
    reach: 0,
    circle: 0,
    wide: 0,
    horizon: 0,
    charm: 0,
    dew: 0,
    bounty: 0,
    crit: 0,
    sprinkler: 0,
    spin: 0,
    lightning: 0,
    zap: 0,
    tornado: 0,
    twist: 0,
  };
}

export function nodeCost(id: NodeId, level: number): number {
  const node = upgradeNode(id);
  return node.costs[level] ?? node.costs[node.costs.length - 1] ?? 0;
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
const PUFF_STEP = 0.075;

export function cloudScale(ranks: Ranks): number {
  return BASE_SCALE + ranks.puff * PUFF_STEP;
}

export function maxLiters(ranks: Ranks): number {
  return 260 * 1.22 ** ranks.flask * 1.18 ** ranks.reservoir;
}

export function drainPerSec(ranks: Ranks): number {
  return 46 / 1.1 ** ranks.linger / 1.08 ** ranks.glacier;
}

export function bottleSeconds(ranks: Ranks): number {
  return maxLiters(ranks) / drainPerSec(ranks);
}

export function rainRadius(ranks: Ranks): number {
  const grown = cloudScale(ranks) / BASE_SCALE;
  const reach = (1 + 0.18 * ranks.circle) * (1 + 0.16 * ranks.wide) * (1 + 0.14 * ranks.horizon);
  return 0.92 * grown * reach;
}

export function soakPerTick(ranks: Ranks): number {
  return 1.35 * 1.28 ** ranks.soak * 1.22 ** ranks.downpour;
}

/** Fraction of the disc that actually receives rain. The rest stays a dry hole in the circle. */
export function patchFraction(ranks: Ranks): number {
  return Math.min(0.84, 0.15 + ranks.specks * 0.05 + ranks.mist * 0.045);
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

export function cellDew(world: number, ranks: Ranks): number {
  return worldDef(world).pay * dewMultiplier(ranks);
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
    { angle: 0.05, ids: ['drizzle', 'specks', 'mist', 'soak', 'downpour'], step: 68 },
    { angle: Math.PI / 2, ids: ['reach', 'circle', 'wide', 'horizon'], step: 72 },
    { angle: Math.PI, ids: ['charm', 'dew', 'bounty', 'crit', 'sprinkler', 'spin', 'lightning', 'zap', 'tornado', 'twist'], step: 0 },
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

export function buildTree(ranks: Ranks, dew: number, spendable = Math.floor(dew)): TreeNodeView[] {
  const points = new Map(layoutTree().map((point) => [point.id, point]));
  return allNodes().map((node) => {
    const level = ranks[node.id];
    const point = points.get(node.id);
    const visible = isVisible(node.id, ranks);
    const maxed = level >= node.max;
    const cost = nodeCost(node.id, Math.min(level, node.max - 1));
    return {
      id: node.id,
      name: node.name,
      desc: node.desc,
      effect: node.effect(Math.min(level, node.max)),
      level,
      max: node.max,
      cost,
      kind: node.kind,
      color: node.color,
      branch: node.branch,
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      parent: node.parent,
      visible,
      ghost: isGhost(node.id, ranks),
      maxed,
      afford: visible && !maxed && spendable >= cost,
    };
  });
}

export function abilityOn(ranks: Ranks, which: 'sprinkler' | 'lightning' | 'tornado'): boolean {
  return ranks[which] >= 1;
}

export function worldCount(): number {
  return GLOBE_WORLD + 1;
}
