import { GLOBE_WORLD } from './balance';
import type { SaveState } from './state';
import type { Ranks } from './tree';

export type AbilityId =
  | 'geyser'
  | 'spore'
  | 'rainbow'
  | 'hail'
  | 'mirage'
  | 'waterbomb'
  | 'whirlpool'
  | 'purify'
  | 'monsoon'
  | 'lifestorm'
  | 'sprinkler'
  | 'lightning'
  | 'tornado'
  | 'drone'
  | 'tide';

export interface AbilityContext {
  cloudX: number;
  cloudZ: number;
  faceX: number;
  faceZ: number;
}

export interface AbilityDef {
  id: AbilityId;
  worldMin: number;
  baseCd: number;
  label: string;
  rank: (ranks: Ranks) => number;
  enabled: (ranks: Ranks, world: number) => boolean;
}

const CD = {
  geyser: 16,
  spore: 14,
  rainbow: 18,
  hail: 16,
  mirage: 18,
  waterbomb: 20,
  whirlpool: 11,
  purify: 20,
  monsoon: 24,
  lifestorm: 42,
  sprinkler: 11,
  lightning: 16,
  tornado: 26,
  drone: 13,
  tide: 32,
} as const;

/**
 * Weather that can fire on its own timer while the bottle is pouring.
 * Whirlpool and lifestorm stay in the catalog so old saves still parse,
 * but the sprinkler jets and the hunting spout took their place.
 */
export const WEATHER_CASTS: AbilityId[] = [
  'sprinkler',
  'drone',
  'lightning',
  'geyser',
  'hail',
  'spore',
  'rainbow',
  'tornado',
  'waterbomb',
  'mirage',
  'purify',
  'tide',
  'monsoon',
];

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  geyser: {
    id: 'geyser',
    worldMin: 1,
    baseCd: CD.geyser,
    label: 'Geyser',
    rank: (r) => r.geyser,
    enabled: (r, w) => w >= 1 && r.geyser >= 1,
  },
  spore: {
    id: 'spore',
    worldMin: 0,
    baseCd: CD.spore,
    label: 'Spore',
    rank: (r) => Math.max(r.spore, r.specks >= 2 ? 1 : 0),
    enabled: (r, w) => w >= 0 && (r.spore >= 1 || r.specks >= 2),
  },
  rainbow: {
    id: 'rainbow',
    worldMin: 1,
    baseCd: CD.rainbow,
    label: 'Rainbow',
    rank: (r) => r.rainbow,
    enabled: (r, w) => w >= 1 && r.rainbow >= 1,
  },
  hail: {
    id: 'hail',
    worldMin: 1,
    baseCd: CD.hail,
    label: 'Hail',
    rank: (r) => r.hail,
    enabled: (r, w) => w >= 1 && r.hail >= 1,
  },
  mirage: {
    id: 'mirage',
    worldMin: 2,
    baseCd: CD.mirage,
    label: 'Mirage',
    rank: (r) => r.mirage,
    enabled: (r, w) => w >= 2 && r.mirage >= 1,
  },
  waterbomb: {
    id: 'waterbomb',
    worldMin: 2,
    baseCd: CD.waterbomb,
    label: 'Bomb',
    rank: (r) => r.waterbomb,
    enabled: (r, w) => w >= 2 && r.waterbomb >= 1,
  },
  whirlpool: {
    id: 'whirlpool',
    worldMin: 0,
    baseCd: CD.whirlpool,
    label: 'Whirlpool',
    rank: (r) => r.spin,
    enabled: () => false,
  },
  purify: {
    id: 'purify',
    worldMin: 3,
    baseCd: CD.purify,
    label: 'Purify',
    rank: (r) => r.purify,
    enabled: (r, w) => w >= 3 && r.purify >= 1,
  },
  monsoon: {
    id: 'monsoon',
    worldMin: 4,
    baseCd: CD.monsoon,
    label: 'Monsoon',
    rank: (r) => r.monsoon,
    enabled: (r, w) => w === GLOBE_WORLD && r.monsoon >= 1,
  },
  lifestorm: {
    id: 'lifestorm',
    worldMin: 1,
    baseCd: CD.lifestorm,
    label: 'Life Storm',
    rank: (r) => r.twist,
    enabled: () => false,
  },
  sprinkler: {
    id: 'sprinkler',
    worldMin: 0,
    baseCd: CD.sprinkler,
    label: 'Sprinkler',
    rank: (r) => r.spin,
    enabled: (r, w) => w >= 0 && r.sprinkler >= 1,
  },
  lightning: {
    id: 'lightning',
    worldMin: 1,
    baseCd: CD.lightning,
    label: 'Bolt',
    rank: (r) => r.zap,
    enabled: (r, w) => w >= 1 && r.lightning >= 1,
  },
  tornado: {
    id: 'tornado',
    worldMin: 1,
    baseCd: CD.tornado,
    label: 'Spout',
    rank: (r) => r.twist,
    enabled: (r, w) => w >= 1 && r.tornado >= 1,
  },
  drone: {
    id: 'drone',
    worldMin: 0,
    baseCd: CD.drone,
    label: 'Drone',
    rank: (r) => r.drone,
    enabled: (r, w) => w >= 0 && r.drone >= 1,
  },
  tide: {
    id: 'tide',
    worldMin: 3,
    baseCd: CD.tide,
    label: 'Tide',
    rank: (r) => r.tide,
    enabled: (r, w) => w >= 3 && r.tide >= 1,
  },
};

export function abilityCooldown(id: AbilityId, ranks: Ranks): number {
  const def = ABILITIES[id];
  const rank = def.rank(ranks);
  return Math.max(3.5, def.baseCd * (1 - Math.min(0.35, rank * 0.06)));
}

/** Every owned weather whose hidden timer has run out. They overlap. */
export function readyCasts(state: SaveState, cds: Record<string, number>): AbilityId[] {
  if (state.phase !== 'play') return [];
  const out: AbilityId[] = [];
  for (const id of WEATHER_CASTS) {
    const def = ABILITIES[id];
    if (!def.enabled(state.ranks, state.world)) continue;
    if ((cds[id] ?? 0) > 0) continue;
    out.push(id);
  }
  return out;
}
