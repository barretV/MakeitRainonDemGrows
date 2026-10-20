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
  | 'tornado';

export interface AbilityContext {
  cloudX: number;
  cloudZ: number;
  faceX: number;
  faceZ: number;
  velX: number;
  velZ: number;
}

export interface AbilityDef {
  id: AbilityId;
  worldMin: number;
  baseCd: number;
  label: string;
  rank: (ranks: Ranks) => number;
  enabled: (ranks: Ranks, world: number) => boolean;
  execute: (state: SaveState, ctx: AbilityContext) => void;
}

const CD = {
  geyser: 14,
  spore: 9,
  rainbow: 18,
  hail: 16,
  mirage: 15,
  waterbomb: 22,
  whirlpool: 11,
  purify: 20,
  monsoon: 24,
  lifestorm: 42,
  sprinkler: 11,
  lightning: 16,
  tornado: 42,
} as const;

export const ABILITY_ORDER: AbilityId[] = [
  'geyser',
  'spore',
  'rainbow',
  'hail',
  'mirage',
  'waterbomb',
  'whirlpool',
  'purify',
  'monsoon',
  'lifestorm',
  'lightning',
  'sprinkler',
  'tornado',
];

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  geyser: {
    id: 'geyser',
    worldMin: 0,
    baseCd: CD.geyser,
    label: 'Geyser',
    rank: (r) => r.geyser,
    enabled: (r, w) => w >= 0 && r.geyser >= 1,
    execute: (s, ctx) => {
      const g = s.ranks.geyser;
      const rad = s.reach() * (0.35 + g * 0.08);
      s.burst(ctx.cloudX, ctx.cloudZ, rad, 8 + g * 6);
      s.chainSpill(ctx.cloudX, ctx.cloudZ, 6 + g * 2);
      s.stampWaveAt(ctx.cloudX, ctx.cloudZ, 1.2);
    },
  },
  spore: {
    id: 'spore',
    worldMin: 0,
    baseCd: CD.spore,
    label: 'Spore',
    rank: (r) => Math.max(r.spore, r.specks >= 2 ? 1 : 0),
    enabled: (r, w) => w >= 0 && (r.spore >= 1 || r.specks >= 2),
    execute: (s, ctx) => {
      const rank = Math.max(s.ranks.spore, s.ranks.specks >= 2 ? 1 : 0);
      s.paintPatch(ctx.cloudX, ctx.cloudZ, s.reach() * 1.15, s.soakAmount() * (1.4 + rank * 0.2), false);
      s.boostMossBand(ctx.cloudX, ctx.cloudZ, s.reach() * 0.9, 0.12 + rank * 0.04);
    },
  },
  rainbow: {
    id: 'rainbow',
    worldMin: 1,
    baseCd: CD.rainbow,
    label: 'Rainbow',
    rank: (r) => r.rainbow,
    enabled: (r, w) => w >= 1 && r.rainbow >= 1,
    execute: (s, ctx) => {
      const steps = 5 + s.ranks.rainbow;
      const span = s.reach() * 1.4;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / (steps - 1)) * Math.PI;
        const ox = ctx.cloudX + Math.cos(t) * span * 0.5;
        const oz = ctx.cloudZ + Math.sin(t) * span * 0.35 + ctx.velZ * 0.15 * i;
        s.paintPatch(ox, oz, span * 0.28, s.soakAmount() * 1.6, false);
      }
      s.stampWaveAt(ctx.cloudX, ctx.cloudZ, 1.5);
    },
  },
  hail: {
    id: 'hail',
    worldMin: 1,
    baseCd: CD.hail,
    label: 'Hail Melt',
    rank: (r) => r.hail,
    enabled: (r, w) => w >= 1 && r.hail >= 1,
    execute: (s, ctx) => {
      s.burst(ctx.cloudX, ctx.cloudZ, s.reach() * 0.75, 12 + s.ranks.hail * 8);
      s.boostStageInRadius(ctx.cloudX, ctx.cloudZ, s.reach() * 0.7, 1);
      s.stampWaveAt(ctx.cloudX, ctx.cloudZ, 1.3);
    },
  },
  mirage: {
    id: 'mirage',
    worldMin: 2,
    baseCd: CD.mirage,
    label: 'Mirage Wave',
    rank: (r) => r.mirage,
    enabled: (r, w) => w >= 2 && r.mirage >= 1,
    execute: (s, ctx) => {
      const dir = Math.hypot(ctx.velX, ctx.velZ) > 0.01 ? { x: ctx.velX, z: ctx.velZ } : { x: ctx.faceX, z: ctx.faceZ };
      const len = Math.hypot(dir.x, dir.z) || 1;
      const nx = dir.x / len;
      const nz = dir.z / len;
      const band = s.reach() * (1.2 + s.ranks.mirage * 0.15);
      for (let i = -2; i <= 2; i += 1) {
        s.paintPatch(ctx.cloudX + nx * i * band * 0.35, ctx.cloudZ + nz * i * band * 0.35, band * 0.55, s.soakAmount() * 1.3, false);
        s.pushPoolWave(ctx.cloudX + nx * i * band * 0.4, ctx.cloudZ + nz * i * band * 0.4, band * 0.5);
      }
    },
  },
  waterbomb: {
    id: 'waterbomb',
    worldMin: 2,
    baseCd: CD.waterbomb,
    label: 'Water Bomb',
    rank: (r) => r.waterbomb,
    enabled: (r, w) => w >= 2 && r.waterbomb >= 1,
    execute: (s, ctx) => {
      const ahead = s.reach() * (0.9 + s.ranks.waterbomb * 0.12);
      const tx = ctx.cloudX + ctx.faceX * ahead;
      const tz = ctx.cloudZ + ctx.faceZ * ahead;
      s.burst(tx, tz, s.reach() * (0.95 + s.ranks.waterbomb * 0.1), 22 + s.ranks.waterbomb * 10);
      s.stampWaveAt(tx, tz, 2);
    },
  },
  whirlpool: {
    id: 'whirlpool',
    worldMin: 0,
    baseCd: CD.whirlpool,
    label: 'Whirlpool',
    rank: (r) => Math.max(r.spin, r.sprinkler >= 1 ? 1 : 0),
    enabled: (r, w) => w >= 0 && r.sprinkler >= 1,
    execute: (s, ctx) => {
      s.siphonPoolToCenter(ctx.cloudX, ctx.cloudZ, s.reach() * (1.05 + s.ranks.spin * 0.22));
      s.burst(ctx.cloudX, ctx.cloudZ, s.reach() * 0.45, 10 + s.ranks.spin * 6);
    },
  },
  purify: {
    id: 'purify',
    worldMin: 3,
    baseCd: CD.purify,
    label: 'Purify',
    rank: (r) => r.purify,
    enabled: (r, w) => w >= 3 && r.purify >= 1,
    execute: (s, ctx) => {
      s.paintPatch(ctx.cloudX, ctx.cloudZ, s.reach() * 1.1, s.soakAmount() * 2.2, false);
      s.boostStageInRadius(ctx.cloudX, ctx.cloudZ, s.reach(), 2);
      s.stampWaveAt(ctx.cloudX, ctx.cloudZ, 1.6);
    },
  },
  monsoon: {
    id: 'monsoon',
    worldMin: 4,
    baseCd: CD.monsoon,
    label: 'Monsoon',
    rank: (r) => r.monsoon,
    enabled: (r, w) => w === GLOBE_WORLD && r.monsoon >= 1,
    execute: (s, ctx) => {
      void ctx;
      s.monsoonBand(s.ranks.monsoon);
    },
  },
  lifestorm: {
    id: 'lifestorm',
    worldMin: 1,
    baseCd: CD.lifestorm,
    label: 'Life Storm',
    rank: (r) => Math.max(r.twist, r.tornado >= 1 ? 1 : 0),
    enabled: (r, w) => w >= 1 && r.tornado >= 1,
    execute: (s, ctx) => {
      s.burst(ctx.cloudX, ctx.cloudZ, 1.1 + s.ranks.twist * 0.35, 8 + s.ranks.twist * 5);
      s.stampWaveAt(ctx.cloudX, ctx.cloudZ, 1.8);
      s.flagLifeStorm();
    },
  },
  sprinkler: {
    id: 'sprinkler',
    worldMin: 0,
    baseCd: CD.sprinkler,
    label: 'Sprinkler',
    rank: (r) => r.spin,
    enabled: (r, w) => w >= 0 && r.sprinkler >= 1,
    execute: (s, ctx) => {
      s.burst(ctx.cloudX, ctx.cloudZ, s.reach() * (1.05 + s.ranks.spin * 0.22), 14 + s.ranks.spin * 8);
    },
  },
  lightning: {
    id: 'lightning',
    worldMin: 0,
    baseCd: CD.lightning,
    label: 'Water Bolt',
    rank: (r) => r.zap,
    enabled: (r, w) => w >= 0 && r.lightning >= 1,
    execute: (s, ctx) => {
      s.burst(ctx.cloudX, ctx.cloudZ, s.reach() * 0.62, 18 + s.ranks.zap * 12);
      s.stampWaveAt(ctx.cloudX, ctx.cloudZ, 1.1);
    },
  },
  tornado: {
    id: 'tornado',
    worldMin: 1,
    baseCd: CD.tornado,
    label: 'Water Spout',
    rank: (r) => r.twist,
    enabled: (r, w) => w >= 1 && r.tornado >= 1,
    execute: (s, ctx) => {
      void s;
      void ctx;
      // Movement handled in RainGame.spawnTornado
    },
  },
};

export function abilityCooldown(id: AbilityId, ranks: Ranks): number {
  const def = ABILITIES[id];
  const rank = def.rank(ranks);
  return Math.max(3.5, def.baseCd * (1 - Math.min(0.35, rank * 0.06)));
}

export function pickAutoAbility(state: SaveState, cds: Record<string, number>): AbilityId | null {
  if (state.phase !== 'play') return null;
  const ranks = state.ranks;
  const world = state.world;
  for (const id of ABILITY_ORDER) {
    const def = ABILITIES[id];
    if (!def.enabled(ranks, world)) continue;
    if (id === 'tornado' || id === 'lifestorm') continue;
    if ((cds[id] ?? 0) > 0) continue;
    return id;
  }
  return null;
}
