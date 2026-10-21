import {
  ACHIEVEMENTS,
  GLOBE_WORLD,
  TILE,
  type AchievementDef,
  type TileSpec,
  gridOf,
  islandRadius,
  islandShore,
  landMask,
  milestoneIsland,
  tileSpec,
  worldDef,
} from './balance';
import { abilityCooldown, pickAutoAbility, type AbilityId, ABILITIES } from './abilities';
import {
  growthStage,
  type GrowthPulseEvent,
  type RestorationWave,
  WAVE_SPEED,
  WAVE_THICK,
} from './growth';
import {
  abilityOn,
  boardSpan,
  bottleSeconds,
  buildTree,
  cellDew,
  cellHp,
  cloudScale,
  critChance,
  drainPerSec,
  emptyRanks,
  maskOf,
  maxLiters,
  NODE_IDS,
  nodeBloomCost,
  nodeCost,
  patchFraction,
  poolFlow,
  poolGain,
  prereqMet,
  PRIORITY,
  rainRadius,
  soakPerTick,
  treeBloomsSpent,
  upgradeNode,
  worldCount,
  worldMet,
  type NodeId,
  type Ranks,
  type TreeNodeView,
} from './tree';

const REVIVAL_MILESTONES = [10, 25, 50, 75, 100] as const;

/**
 * Blooms are the rare currency: one for every tenth of an island you restore
 * and one more when the island comes back to life. Ten per island, fifty over
 * the whole campaign, so every bloom spent has to be worth it.
 */
export const BLOOM_STEPS = 10;

/** Blooms a restored island is worth. */
export function islandBlooms(ratio: number, cleared: boolean): number {
  if (ratio <= 0) return 0;
  return Math.min(BLOOM_STEPS - 1, Math.floor(ratio * BLOOM_STEPS)) + (cleared ? 1 : 0);
}

export interface TileState {
  hp: number;
  pond: number;
  cracked: boolean;
}

/** A pocket of land that still needs water. */
export interface DryTarget {
  /** World position of the pocket's centre. */
  x: number;
  z: number;
  /** Mask cells still short inside this pocket. */
  cells: number;
  /** 0–1, how thirsty the pocket is. */
  dry: number;
  /** 0–1, how close the pocket already is to done. */
  nearly: number;
}

export interface RunLogEntry {
  /** Island the bottle was poured on. */
  world: number;
  /** Bottle number inside that island. */
  run: number;
  /** Seconds the bottle poured for. */
  seconds: number;
  /** Dew earned during the bottle. */
  dew: number;
  /** Mask cells finished during the bottle. */
  cells: number;
  /** Blooms earned during the bottle. */
  blooms: number;
  /** Rain radius the bottle had. */
  radius: number;
  /** Island restored fraction after the bottle. */
  ratio: number;
  /** Upgrades bought right after the bottle. */
  buys: string[];
}

export interface Stats {
  dewEarned: number;
  tiles: number;
  ponds: number;
  animals: number;
  blooms: number;
  playSeconds: number;
}

export interface SoakResult {
  dew: number;
  bloomed: boolean;
  crit: boolean;
  pond: boolean;
  mega: boolean;
  filling: number | null;
}

export type RunPhase = 'play' | 'finale' | 'dry' | 'clear';
/** 'start' is the world picker shown the moment the game boots. */
export type Screen = 'start' | 'play' | 'results' | 'workshop' | 'worlds';

export interface WorldChip {
  index: number;
  name: string;
  locked: boolean;
  current: boolean;
  best: number;
}

export interface HudModel {
  ready: boolean;
  dew: number;
  liters: number;
  maxLiters: number;
  tank: number;
  raining: boolean;
  sleepy: boolean;
  slosh: number;
  worldName: string;
  worldIndex: number;
  worldCount: number;
  restored: number;
  canPrev: boolean;
  canNext: boolean;
  nextLocked: boolean;
  sfx: boolean;
  music: boolean;
  sfxVolume: number;
  musicVolume: number;
  toast: string;
  boost: boolean;
  pond: number | null;
  phase: RunPhase;
  screen: Screen;
  runDew: number;
  /** Mask cells completed this bottle. */
  runTiles: number;
  /** Rare blooms earned this bottle. */
  runBlooms: number;
  /** Peak revival % this run (survives until Rain again). */
  runReached: number;
  best: number;
  cleared: boolean;
  /** This bottle set a new revival record on the current world. */
  newBest: boolean;
  tree: TreeNodeView[];
  worlds: WorldChip[];
  stats: Stats;
  achievements: Array<AchievementDef & { done: boolean; current: number; goal: number }>;
  spendableBlooms: number;
  /** Every message the game wants to show, oldest first. */
  toasts: { seq: number; text: string }[];
  /** The chain multiplier on the dew this bottle is paying. */
  chain: number;
  /** The next upgrade to aim for, so there is always a target. */
  nextGoal: { name: string; cost: number; blooms: number; progress: number } | null;
  /** Mask cells that still need water on this island. */
  patchesLeft: number;
  /** Separate pockets of thirsty land. */
  pocketsLeft: number;
  /** How much of the island is still thirsty, 0-1. */
  dryFraction: number;
  nextAbility: string;
  abilityCdNorm: number;
  revivalGlow: number;
  /** 0–1 during the 100% restoration spectacle (play screen). */
  finaleProgress: number;
}

interface PersistedLand {
  world: number;
  progress: number[];
  green: boolean[];
  tiles: TileState[];
  waterPool?: number[];
}

interface PersistedV6 {
  v: 6;
  dew: number;
  ranks: Partial<Ranks>;
  world: number;
  unlocked: number;
  best: number[];
  stats: Stats;
  achievements: string[];
  lands: PersistedLand[];
  sfx: boolean;
  music: boolean;
  sfxVolume?: number;
  musicVolume?: number;
  lastSave: number;
}

interface PersistedV5 {
  v: 5;
  dew: number;
  ranks: Partial<Ranks>;
  petals: Partial<Record<string, number>>;
  world: number;
  unlocked: number;
  best: number[];
  stats: Stats;
  achievements: string[];
  lands: PersistedLand[];
  sfx: boolean;
  music: boolean;
  lastSave: number;
}

interface PersistedV4 {
  v: 4;
  dew: number;
  ranks: Partial<Ranks>;
  petals: Partial<Record<string, number>>;
  world: number;
  unlocked: number;
  best: number[];
  stats: Stats;
  achievements: string[];
  lands: PersistedLand[];
  sfx: boolean;
  music: boolean;
  lastSave: number;
}

interface PersistedV3 {
  v: 3;
  dew: number;
  ranks: Partial<Ranks>;
  world: number;
  unlocked: number;
  best: number[];
  stats: Stats;
  achievements: string[];
  lands: PersistedLand[];
  sfx: boolean;
  music: boolean;
  lastSave: number;
}

interface PersistedV2 {
  v: 2;
  dew: number;
  ranks: Partial<Ranks>;
  world: number;
  unlocked: number;
  best: number[];
  stats: Stats;
  achievements: string[];
  sfx: boolean;
  music: boolean;
  lastSave: number;
}

interface PersistedV1 {
  v: 1;
  dew?: number;
  sfx?: boolean;
  music?: boolean;
}

interface LandPack {
  progress: Float32Array;
  pixels: Uint8Array;
  pulse: Uint8Array;
  waterPool: Float32Array;
  green: boolean[];
  tiles: TileState[];
}

const LIGHTNING_CD = 16;
const TORNADO_CD = 42;
const SPIN_CD = 11;

function emptyStats(): Stats {
  return { dewEarned: 0, tiles: 0, ponds: 0, animals: 0, blooms: 0, playSeconds: 0 };
}

function hash01(c: number, r: number): number {
  const n = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function rankTotal(ranks: Ranks): number {
  return NODE_IDS.reduce((sum, id) => sum + ranks[id], 0);
}

function sanitizeLoadedState(s: SaveState): void {
  for (const id of NODE_IDS) {
    const node = upgradeNode(id);
    s.ranks[id] = Math.max(0, Math.min(node.max, Math.floor(s.ranks[id] ?? 0)));
  }
  // Day one: no upgrades and no saved restoration means wallet stays empty.
  if (rankTotal(s.ranks) === 0 && !s.hasLandProgress()) {
    s.dew = 0;
    s.achievements = [];
    s.stats = emptyStats();
  }
}

/** Whole dew only — micro-drips accrue internally but the wallet display and shop use integers. */
export function walletDew(dew: number): number {
  return Math.max(0, Math.floor(dew));
}

export class SaveState {
  dew = 0;
  ranks: Ranks = emptyRanks();
  world = 0;
  unlocked = 0;
  tank = 1;
  tiles: TileState[][] = [];
  stats: Stats = emptyStats();
  /** Achievements paid out this session, waiting for a fanfare. */
  pendingAchievements: string[] = [];
  /** Blooms paid out this session, waiting for a fanfare. */
  pendingBlooms = 0;
  /** Revival milestone hit this session (percent), waiting for a fanfare. */
  pendingMilestone = 0;
  /** Cached scan of the thirsty land, so the mask is not walked every frame. */
  private dryCache: { cells: number; pockets: DryTarget[]; total: number } | null = null;
  private dryCacheAt = 0;
  achievements: string[] = [];
  sfx = true;
  music = true;
  /** How loud the effects are, 0 to 1. */
  sfxVolume = 0.7;
  /** How loud the music bed is, 0 to 1. */
  musicVolume = 1;
  lastSave = Date.now();
  /** Latest message. Every write also lands in the toast log so the HUD can
   * show them one at a time instead of overwriting each other. */
  private toastValue = '';
  toastLog: { seq: number; text: string }[] = [];
  private toastSeq = 0;
  boostUntil = 0;
  lightningCd = 8;
  tornadoCd = 14;
  spinCd = 5;
  phase: RunPhase = 'play';
  screen: Screen = 'play';
  /** Rare currency earned from restoring land. */
  blooms = 0;
  /** Blooms already paid out per island, so a milestone is never paid twice. */
  private bloomAwarded = new Map<number, number>();
  /**
   * Dev-only ledger of every bottle the player pours. The balance simulator is
   * only a guess; this is what the game actually paid out.
   */
  runLog: RunLogEntry[] = [];
  private runBuys: string[] = [];
  private runBlooms = 0;
  private runIndex = 0;
  private runOpen = false;
  runDew = 0;
  /**
   * The chain: every new patch this bottle pays a little more than the last.
   * Keeping the water on fresh soil is the one decision the player makes.
   */
  chainMultiplier(): number {
    return Math.min(2.5, 1 + this.runTiles / 200);
  }
  /** Tree ranks bought since the last refill. Two per bottle. */
  runTiles = 0;
  runReached = 0;
  best: number[] = [0, 0, 0, 0, 0];

  progress: Float32Array = new Float32Array(0);
  pixels: Uint8Array = new Uint8Array(0);
  pulse: Uint8Array = new Uint8Array(0);
  waterPool: Float32Array = new Float32Array(0);
  maskDirty = false;
  pulseDirty = false;
  abilityCds: Record<string, number> = {};
  nextAbilityId: AbilityId | '' = '';
  lifeStormPulse = false;
  revivalGlow = 0;
  finaleProgress = 0;
  newBest = false;
  private filled = 0;
  /** Running total of the mask progress, so the ratio never scans every cell. */
  private progressSum = 0;
  private green: boolean[] = [];
  private justGreen: number[] = [];
  private ripples = 0;
  private waves: RestorationWave[] = [];
  private growthPulses: GrowthPulseEvent[] = [];
  private lands = new Map<number, LandPack>();
  private revivalMilestones = new Set<number>();
  /** Which mask cells are land. The sea is not part of the island. */
  private landCache = new Map<number, Uint8Array>();
  private landCountCache = new Map<number, number>();

  static fresh(): SaveState {
    const s = new SaveState();
    s.dew = 0;
    s.ranks = emptyRanks();
    s.world = 0;
    s.unlocked = 0;
    s.stats = emptyStats();
    s.achievements = [];
    s.best = [0, 0, 0, 0, 0];
    s.toast = 'A little cloud. A little drizzle.';
    s.lands.clear();
    s.tiles = [];
    s.beginWorld(0, true);
    return s;
  }

  static fromJSON(raw: string): SaveState | null {
    try {
      const data = JSON.parse(raw) as
        | PersistedV6
        | PersistedV5
        | PersistedV4
        | PersistedV3
        | PersistedV2
        | PersistedV1;
      if (!data || (data.v !== 1 && data.v !== 2 && data.v !== 3 && data.v !== 4 && data.v !== 5 && data.v !== 6))
        return null;
      const s = new SaveState();
      s.sfx = data.sfx !== false;
      s.music = data.music === true;
      const sfxVolume = (data as { sfxVolume?: unknown }).sfxVolume;
      const musicVolume = (data as { musicVolume?: unknown }).musicVolume;
      s.sfxVolume = typeof sfxVolume === 'number' ? Math.max(0, Math.min(1, sfxVolume)) : 0.7;
      s.musicVolume = typeof musicVolume === 'number' ? Math.max(0, Math.min(1, musicVolume)) : 1;
      if (data.v === 1) {
        s.dew = 0;
        s.ranks = emptyRanks();
        s.world = 0;
        s.unlocked = 0;
        s.stats = emptyStats();
        s.achievements = [];
        s.best = [0, 0, 0, 0, 0];
      } else if (data.v >= 2) {
        s.dew = Number.isFinite(data.dew) ? Number(data.dew) : 0;
        s.ranks = { ...emptyRanks(), ...data.ranks };
        s.world = Math.max(0, Math.min(GLOBE_WORLD, data.world | 0));
        s.unlocked = Math.max(s.world, Math.max(0, Math.min(GLOBE_WORLD, data.unlocked | 0)));
        s.stats = { ...emptyStats(), ...data.stats };
        s.achievements = Array.isArray(data.achievements) ? data.achievements.filter((id) => typeof id === 'string') : [];
        s.best = [0, 1, 2, 3, 4].map((i) => {
          const n = data.best?.[i];
          return typeof n === 'number' && n >= 0 ? Math.min(1, n) : 0;
        });
        if (
          (data.v === 3 || data.v === 4 || data.v === 5 || data.v === 6) &&
          Array.isArray(data.lands)
        ) {
          s.importLands(data.lands);
          s.correctSavedBests();
        }
        if (data.v === 4 || data.v === 5) {
          // The petal shop is gone: its purchases become bloom branch ranks.
          s.migratePetals(data.petals);
        }
      }
      s.screen = 'play';
      s.phase = 'play';
      s.beginWorld(s.world, false);
      sanitizeLoadedState(s);
      s.syncBloomsFromLands();
      s.syncPhaseAfterLoad();
      s.lastSave = Date.now();
      return s;
    } catch {
      return null;
    }
  }

  toJSON(): string {
    const data: PersistedV6 = {
      v: 6,
      dew: this.dew,
      ranks: this.ranks,
      world: this.world,
      unlocked: this.unlocked,
      best: this.best,
      stats: this.stats,
      achievements: this.achievements,
      lands: this.exportLands(),
      sfx: this.sfx,
      music: this.music,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      lastSave: Date.now(),
    };
    this.lastSave = data.lastSave;
    return JSON.stringify(data);
  }

  /** Old petal purchases become ranks on the bloom branch of the tree. */
  private migratePetals(petals: Partial<Record<string, number>> | undefined): void {
    if (!petals) return;
    const map: Array<[string, NodeId]> = [
      ['blush', 'blush'],
      ['bow', 'bow'],
      ['trail', 'trail'],
      ['buddy', 'buddy'],
      ['sparkle', 'sparkle'],
      ['hum', 'hum'],
      ['press', 'press'],
    ];
    for (const [petal, node] of map) {
      const level = Math.max(0, Math.min(8, Math.floor(Number(petals[petal]) || 0)));
      if (level > this.ranks[node]) this.ranks[node] = level;
    }
  }

  maxLiters(): number {
    return maxLiters(this.ranks);
  }

  scale(): number {
    return cloudScale(this.ranks);
  }

  /**
   * The next thing worth buying, so the player always has a target in reach.
   * Mirrors the workshop's "recommended" order.
   */
  nextGoal(): { name: string; cost: number; blooms: number; progress: number } | null {
    const wallet = walletDew(this.dew);
    for (const id of PRIORITY) {
      const node = upgradeNode(id);
      const level = this.ranks[id];
      if (level >= node.max) continue;
      if (!prereqMet(id, this.ranks)) continue;
      if (!worldMet(id, this.unlocked)) continue;
      const cost = nodeCost(id, level);
      return {
        name: node.name,
        cost,
        blooms: nodeBloomCost(id, level),
        progress: cost > 0 ? Math.min(1, wallet / cost) : 1,
      };
    }
    return null;
  }

  /** Blooms left in the wallet after everything bought on the tree. */
  spendableBlooms(): number {
    return Math.max(0, this.blooms - treeBloomsSpent(this.ranks));
  }

  /**
   * Dev-only export of what the player actually earned, bottle by bottle.
   * `balance/analytics.py` compares this against the simulator.
   */
  analytics(): { version: number; runs: RunLogEntry[] } {
    return { version: 1, runs: this.runLog };
  }

  /**
   * Pay out the blooms this island has earned. One for every tenth of the land
   * that is green again, and one more when the island itself is whole.
   */
  private syncBlooms(): void {
    const world = this.world;
    const earned = islandBlooms(this.ratio(), this.islandRestored());
    const had = this.bloomAwarded.get(world) ?? 0;
    if (earned <= had) return;
    this.bloomAwarded.set(world, earned);
    this.blooms += earned - had;
    this.runBlooms += earned - had;
    this.pendingBlooms += earned - had;
    this.toast = earned - had > 1 ? 'Blooms open!' : 'A bloom opens!';
  }

  /**
   * Dev-only: close the books on the bottle that just ended. The simulator is
   * only a guess, this is what the game really paid.
   */
  private logRun(): void {
    if (!import.meta.env.DEV || !this.runOpen) return;
    this.runOpen = false;
    this.runIndex += 1;
    this.runLog.push({
      world: this.world,
      run: this.runIndex,
      seconds: Math.round(this.bottleTime() * 10) / 10,
      dew: Math.round(this.runDew),
      cells: this.runTiles,
      blooms: this.runBlooms,
      radius: Math.round(this.reach() * 100) / 100,
      ratio: Math.round(this.ratio() * 1000) / 1000,
      buys: [...this.runBuys],
    });
    this.runBuys = [];
    this.runBlooms = 0;
  }

  /** Recompute the whole bloom wallet from the saved land (used after a load). */
  private syncBloomsFromLands(): void {
    let total = 0;
    for (const [world, pack] of this.lands) {
      const hp = cellHp(world);
      let full = 0;
      for (let i = 0; i < pack.progress.length; i += 1) {
        if ((pack.progress[i] ?? 0) >= hp) full += 1;
      }
      const ratio = pack.progress.length ? full / pack.progress.length : 0;
      const earned = islandBlooms(ratio, ratio >= 0.98);
      this.bloomAwarded.set(world, earned);
      total += earned;
    }
    this.blooms = total;
  }

  liters(): number {
    return this.tank * this.maxLiters();
  }

  reach(): number {
    return this.world === GLOBE_WORLD ? rainRadius(this.ranks) * 0.05 : rainRadius(this.ranks);
  }

  patch(): number {
    return patchFraction(this.ranks);
  }

  bottleTime(): number {
    return bottleSeconds(this.ranks);
  }

  dropEvery(): number {
    return 0.18 / (1 + this.ranks.specks * 0.55 + this.ranks.mist * 0.25 + this.ranks.flow * 0.3);
  }

  tick(dt: number, mode: { raining: boolean; moving: boolean }): void {
    void mode.moving;
    if (this.phase !== 'play') return;
    this.stats.playSeconds += dt;
    this.tickAbilityCooldowns(dt);
    if (this.revivalGlow > 0) this.revivalGlow = Math.max(0, this.revivalGlow - dt * 0.35);
    if (mode.raining && this.tank > 0) {
      const max = this.maxLiters();
      this.tank = Math.max(0, this.tank - (drainPerSec(this.ranks) / max) * dt);
      if (this.tank <= 0.001) {
        this.tank = 0;
        this.captureRunPeak();
        this.phase = 'dry';
        this.screen = 'results';
        this.noteBest();
        this.logRun();
        this.toast = 'The bottle is empty.';
      }
    }
    this.syncBlooms();
    this.finishIfDone();
  }

  /**
   * The latest message. Writing it also files the message in the toast log, so
   * a burst of rewards is never swallowed by the next one.
   */
  get toast(): string {
    return this.toastValue;
  }

  set toast(value: string) {
    this.toastValue = value;
    if (!value) return;
    this.toastSeq += 1;
    this.toastLog.push({ seq: this.toastSeq, text: value });
    if (this.toastLog.length > 12) this.toastLog.shift();
  }

  /** Attach this world's saved mask + tiles, or create empty land. */
  beginWorld(world: number, forceFresh: boolean): void {
    this.world = world;
    this.runIndex = 0;
    this.runOpen = true;
    this.runBuys = [];
    this.runBlooms = 0;
    // Milestones are per island: every land deserves its own celebrations.
    this.revivalMilestones.clear();
    if (forceFresh) {
      this.lands.delete(world);
    }
    this.mountWorld(world);
    this.refillBottle();
  }

  /** The land cells of an island, and how many there are. */
  private landOf(world: number, cols: number, rows: number): Uint8Array {
    let mask = this.landCache.get(world);
    if (!mask || mask.length !== cols * rows) {
      mask = landMask(world, cols, rows);
      this.landCache.set(world, mask);
      let count = 0;
      for (let i = 0; i < mask.length; i += 1) count += mask[i] ?? 0;
      this.landCountCache.set(world, count);
    }
    return mask;
  }

  /** How many cells of the island are land. The sea does not count. */
  landCells(world = this.world): number {
    const { cols, rows } = maskOf(world);
    this.landOf(world, cols, rows);
    return this.landCountCache.get(world) ?? cols * rows;
  }

  /** True when the cell is on the island rather than in the sea. */
  private isLand(c: number, r: number): boolean {
    const { cols, rows } = maskOf(this.world);
    const mask = this.landOf(this.world, cols, rows);
    return (mask[r * cols + c] ?? 1) !== 0;
  }

  private mountWorld(world: number): void {
    const { cols, rows } = maskOf(world);
    const cells = cols * rows;
    let pack = this.lands.get(world);
    if (!pack || pack.progress.length !== cells) {
      pack = this.createLandPack(world);
      this.lands.set(world, pack);
    }
    this.landOf(world, cols, rows);
    if (!pack.pulse || pack.pulse.length !== cells) pack.pulse = new Uint8Array(cells);
    if (!pack.waterPool || pack.waterPool.length !== cells) pack.waterPool = new Float32Array(cells);
    this.progress = pack.progress;
    this.pixels = pack.pixels;
    this.pulse = pack.pulse;
    this.waterPool = pack.waterPool;
    this.green = pack.green;
    this.tiles[world] = pack.tiles;
    this.filled = 0;
    this.maskDirty = true;
    this.pulseDirty = true;
    this.ripples = 0;
    this.justGreen = [];
    this.waves = [];
    this.growthPulses = [];
    this.pulse.fill(0);
    // Ocean progress used to inflate the percentage. Drop it before the pixels rebuild.
    this.scrubSea();
    this.rebuildMaskPixels();
    this.refreshGreenFromProgress();
    this.recountLand();
  }

  /**
   * The sea is not part of the island. Spill used to soak it anyway, and those
   * cells were added to the restored total, so a half-brown island could read 100%.
   */
  private scrubSea(): void {
    const { cols, rows } = maskOf(this.world);
    const land = this.landOf(this.world, cols, rows);
    for (let i = 0; i < this.progress.length; i += 1) {
      if (land[i]) continue;
      this.progress[i] = 0;
    }
  }

  /**
   * Saved bests were written from the inflated total. Pull each one back to
   * the land that is actually green, and forget ocean progress on the way.
   */
  private correctSavedBests(): void {
    for (let world = 0; world <= GLOBE_WORLD; world += 1) {
      const pack = this.lands.get(world);
      if (!pack) continue;
      const { cols, rows } = maskOf(world);
      const land = this.landOf(world, cols, rows);
      const hp = cellHp(world);
      let sum = 0;
      let count = 0;
      const n = Math.min(land.length, pack.progress.length);
      for (let i = 0; i < n; i += 1) {
        if (!land[i]) {
          pack.progress[i] = 0;
          continue;
        }
        count += 1;
        sum += Math.min(hp, pack.progress[i] ?? 0);
      }
      const real = Math.min(1, count > 0 ? sum / (count * hp) : 0);
      this.best[world] = Math.min(real, this.best[world] ?? 0);
    }
  }

  /** Restored total for land cells only. Also pulls a saved best back down if the sea had inflated it. */
  private recountLand(): void {
    const { cols, rows } = maskOf(this.world);
    const land = this.landOf(this.world, cols, rows);
    const hp = cellHp(this.world);
    let sum = 0;
    let full = 0;
    let count = 0;
    for (let i = 0; i < this.progress.length; i += 1) {
      if (!land[i]) continue;
      count += 1;
      const value = Math.min(hp, this.progress[i] ?? 0);
      sum += value;
      if (value >= hp) full += 1;
    }
    this.progressSum = sum;
    this.filled = full;
    const real = Math.min(1, count > 0 ? sum / (count * hp) : 0);
    if ((this.best[this.world] ?? 0) > real) this.best[this.world] = real;
  }

  private createLandPack(world: number): LandPack {
    const { cols, rows } = maskOf(world);
    const cells = cols * rows;
    const tiles = makeTiles(world);
    return {
      progress: new Float32Array(cells),
      pixels: new Uint8Array(cells * 4),
      pulse: new Uint8Array(cells),
      waterPool: new Float32Array(cells),
      green: tiles.map(() => false),
      tiles,
    };
  }

  private refillBottle(): void {
    this.tank = 1;
    this.resetAbilityCooldowns(true);
    this.lightningCd = abilityOn(this.ranks, 'lightning') ? 6 : LIGHTNING_CD;
    this.tornadoCd = abilityOn(this.ranks, 'tornado') ? 10 : TORNADO_CD;
    this.spinCd = abilityOn(this.ranks, 'sprinkler') ? 4 : SPIN_CD;
    if (this.ratio() < 1) {
      this.phase = 'play';
    }
  }

  private syncPhaseAfterLoad(): void {
    if (this.islandRestored()) {
      this.phase = 'clear';
      this.screen = 'results';
      this.toast = `${worldDef(this.world).name} is green again.`;
      this.finaleProgress = 1;
    }
  }

  private exportLands(): PersistedLand[] {
    const out: PersistedLand[] = [];
    for (const [world, pack] of this.lands) {
      out.push({
        world,
        progress: [...pack.progress],
        green: [...pack.green],
        tiles: pack.tiles.map((t) => ({ ...t })),
        waterPool: [...pack.waterPool],
      });
    }
    return out;
  }

  hasLandProgress(): boolean {
    for (const pack of this.lands.values()) {
      for (let i = 0; i < pack.progress.length; i += 1) {
        if ((pack.progress[i] ?? 0) > 0.001) return true;
      }
    }
    return false;
  }

  private importLands(rows: PersistedLand[]): void {
    this.lands.clear();
    for (const row of rows) {
      if (row.world < 0 || row.world > GLOBE_WORLD) continue;
      const { cols, rows: maskRows } = maskOf(row.world);
      const cells = cols * maskRows;
      const tiles = row.tiles?.length === worldDef(row.world).tiles ? row.tiles : makeTiles(row.world);
      const green =
        row.green?.length === tiles.length ? row.green : tiles.map(() => false);
      const progress = new Float32Array(cells);
      const src = row.progress ?? [];
      for (let i = 0; i < cells; i += 1) {
        const v = src[i];
        progress[i] = typeof v === 'number' && v >= 0 ? v : 0;
      }
      const pixels = new Uint8Array(cells * 4);
      const pulse = new Uint8Array(cells);
      const waterPool = new Float32Array(cells);
      const poolSrc = row.waterPool ?? [];
      for (let i = 0; i < cells; i += 1) {
        const p = poolSrc[i];
        waterPool[i] = typeof p === 'number' && p > 0 ? p : 0;
      }
      this.lands.set(row.world, { progress, pixels, pulse, waterPool, green, tiles });
    }
  }

  private rebuildMaskPixels(): void {
    const hp = cellHp(this.world);
    const pixels = this.pixels;
    const progress = this.progress;
    for (let i = 0; i < progress.length; i += 1) {
      const now = progress[i] ?? 0;
      const pixel = i * 4;
      if (now >= hp) pixels[pixel] = 255;
      else if (now > 0) pixels[pixel] = Math.min(254, Math.floor((now / hp) * 254));
      else pixels[pixel] = 0;
      // Green is a live splash and blue is a live wave. Leaving either set
      // makes the flora shader pop every plant, then fadeRipples shrinks them
      // the moment play resumes.
      pixels[pixel + 1] = 0;
      pixels[pixel + 2] = 0;
    }
  }

  private refreshGreenFromProgress(): void {
    const { cols, rows } = gridOf(this.world);
    const count = cols * rows;
    for (let i = 0; i < count; i += 1) {
      this.green[i] = false;
      this.syncHillFromMask(i);
    }
  }

  private syncHillFromMask(index: number): void {
    const { cols, rows } = gridOf(this.world);
    const { cols: maskCols, rows: maskRows } = maskOf(this.world);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const c0 = Math.floor((col / cols) * maskCols);
    const c1 = Math.floor(((col + 1) / cols) * maskCols);
    const r0 = Math.floor((row / rows) * maskRows);
    const r1 = Math.floor(((row + 1) / rows) * maskRows);
    const hp = cellHp(this.world);
    let seen = 0;
    let done = 0;
    for (let r = r0; r < r1; r += 1) {
      for (let c = c0; c < c1; c += 1) {
        if (!this.isLand(c, r)) continue;
        seen += 1;
        if ((this.progress[r * maskCols + c] ?? 0) >= hp) done += 1;
      }
    }
    if (seen === 0 || done / seen < 0.62) return;
    this.green[index] = true;
    const tile = this.tiles[this.world]?.[index];
    if (tile) {
      tile.hp = 0;
      tile.pond = 1;
      tile.cracked = true;
    }
  }

  retryRun(): void {
    this.runDew = 0;
    this.runTiles = 0;
    this.runReached = 0;
    this.newBest = false;
    this.screen = 'play';
    this.runBuys = [];
    this.runBlooms = 0;
    this.runOpen = true;
    // Growth stays. The next bottle picks up where this one left off.
    this.mountWorld(this.world);
    this.refillBottle();
    this.phase = 'play';
    this.toast =
      this.ratio() >= 1 ? `${worldDef(this.world).name} · another bottle` : worldDef(this.world).name;
  }

  openWorkshop(): void {
    if (this.phase === 'play') return;
    this.screen = 'workshop';
  }

  openWorlds(): void {
    if (this.phase !== 'clear') return;
    this.screen = 'worlds';
  }

  /** World picker on the title screen: shown every time the game boots. */
  openStart(): void {
    this.screen = 'start';
  }

  showResults(): void {
    if (this.phase === 'play') return;
    this.screen = 'results';
  }

  goto(world: number): boolean {
    if (world < 0 || world > GLOBE_WORLD || world > this.unlocked) {
      this.toast = 'That land is still shut.';
      return false;
    }
    this.beginWorld(world, false);
    this.runDew = 0;
    this.runTiles = 0;
    this.runReached = 0;
    this.newBest = false;
    this.screen = 'play';
    this.syncPhaseAfterLoad();
    this.toast = worldDef(this.world).name;
    return true;
  }

  buy(id: NodeId): boolean {
    if (this.screen !== 'workshop') {
      this.toast = 'Open Workshop from the results screen.';
      return false;
    }
    if (!prereqMet(id, this.ranks)) {
      this.toast = 'Unlock the parent upgrade first.';
      return false;
    }
    if (!worldMet(id, this.unlocked)) {
      this.toast = 'That upgrade waits for a farther island.';
      return false;
    }
    const node = upgradeNode(id);
    const level = this.ranks[id];
    if (level >= node.max) return false;
    const cost = nodeCost(id, level);
    const wallet = walletDew(this.dew);
    if (wallet < cost) {
      this.toast = `Need ${cost} dew (you have ${wallet}).`;
      return false;
    }
    const bloomCost = nodeBloomCost(id, level);
    const blooms = this.spendableBlooms();
    if (blooms < bloomCost) {
      this.toast = `Need ${bloomCost} blooms (you have ${blooms}).`;
      return false;
    }
    this.dew -= cost;
    this.ranks[id] += 1;
    this.runBuys.push(`${id}${this.ranks[id]}`);
    this.toast = node.kind === 'gate' ? `${node.name} unlocked.` : `${node.name} rank ${this.ranks[id]}.`;
    this.claim();
    return true;
  }

  /**
   * Paint the circular patch under the cloud. Most of the circle stays dry until
   * Specks and Mist open more of it. Returns dew banked this splash.
   */
  drizzle(x: number, z: number): { dew: number; filled: number; crits: number } {
    if (this.phase !== 'play') return { dew: 0, filled: 0, crits: 0 };
    const radius = this.reach();
    return this.paint(x, z, radius, soakPerTick(this.ranks), true);
  }

  /** Finish a handful of cells inside a circle. Lightning, sprinkler, and the twister. */
  burst(x: number, z: number, radius: number, limit: number): { dew: number; filled: number } {
    if (this.phase !== 'play') return { dew: 0, filled: 0 };
    const hit = this.paint(x, z, radius, cellHp(this.world), false, limit);
    return { dew: hit.dew, filled: hit.filled };
  }

  soakAmount(): number {
    return soakPerTick(this.ranks);
  }

  paintPatch(x: number, z: number, radius: number, amount: number, respectPatches: boolean): void {
    if (this.phase !== 'play') return;
    this.paint(x, z, radius, amount, respectPatches);
  }

  chainSpill(x: number, z: number, hops: number): void {
    const { cols, rows } = maskOf(this.world);
    const hp = cellHp(this.world);
    const gate = 1 - patchFraction(this.ranks);
    for (let h = 0; h < hops; h += 1) {
      let best = -1;
      let bestD = Number.POSITIVE_INFINITY;
      for (let i = 0; i < this.progress.length; i += 1) {
        if ((this.progress[i] ?? 0) < hp) continue;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const at = this.cellCenter(c, r, cols, rows);
        const d = this.gap(x, z, at.x, at.z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) break;
      const spilled = this.spillFrom(best, x, z, cols, rows, soakPerTick(this.ranks) * 1.4, hp, false, gate);
      if (!spilled) break;
    }
  }

  stampWaveAt(x: number, z: number, strength = 1): void {
    const { cols, rows } = maskOf(this.world);
    const at = this.maskPos(x, z, cols, rows);
    const c = Math.max(0, Math.min(cols - 1, Math.floor(at.c)));
    const r = Math.max(0, Math.min(rows - 1, Math.floor(at.r)));
    const maxR = 6 * strength;
    this.waves.push({ c, r, radius: 0, maxRadius: maxR, speed: WAVE_SPEED * strength });
    this.maskDirty = true;
  }

  boostMossBand(x: number, z: number, radius: number, amount: number): void {
    const hp = cellHp(this.world);
    const bounds = this.cellBounds(x, z, radius, maskOf(this.world).cols, maskOf(this.world).rows);
    const { cols, rows } = maskOf(this.world);
    for (let r = bounds.minR; r <= bounds.maxR; r += 1) {
      for (let c = bounds.minC; c <= bounds.maxC; c += 1) {
        const at = this.cellCenter(c, r, cols, rows);
        if (this.gap(x, z, at.x, at.z) > radius) continue;
        const i = r * cols + c;
        const was = this.progress[i] ?? 0;
        if (was >= hp) continue;
        const wet = was / hp;
        if (wet < 0.12 || wet > 0.55) continue;
        this.applySoak(i, c, r, cols, rows, hp * amount, hp, false, 0);
      }
    }
  }

  boostStageInRadius(x: number, z: number, radius: number, stages: number): void {
    const hp = cellHp(this.world);
    const { cols, rows } = maskOf(this.world);
    const bounds = this.cellBounds(x, z, radius, cols, rows);
    const bump = (hp / 5) * stages;
    for (let r = bounds.minR; r <= bounds.maxR; r += 1) {
      for (let c = bounds.minC; c <= bounds.maxC; c += 1) {
        const at = this.cellCenter(c, r, cols, rows);
        if (this.gap(x, z, at.x, at.z) > radius) continue;
        const i = r * cols + c;
        const was = this.progress[i] ?? 0;
        if (was >= hp) continue;
        this.applySoak(i, c, r, cols, rows, bump, hp, false, 0);
      }
    }
  }

  pushPoolWave(x: number, z: number, radius: number): void {
    const { cols, rows } = maskOf(this.world);
    const bounds = this.cellBounds(x, z, radius, cols, rows);
    const add = soakPerTick(this.ranks) * 0.9;
    for (let r = bounds.minR; r <= bounds.maxR; r += 1) {
      for (let c = bounds.minC; c <= bounds.maxC; c += 1) {
        const at = this.cellCenter(c, r, cols, rows);
        if (this.gap(x, z, at.x, at.z) > radius) continue;
        const i = r * cols + c;
        this.waterPool[i] = (this.waterPool[i] ?? 0) + add;
      }
    }
    this.syncPoolPixels();
    this.maskDirty = true;
  }

  siphonPoolToCenter(x: number, z: number, radius: number): void {
    const { cols, rows } = maskOf(this.world);
    const at = this.maskPos(x, z, cols, rows);
    const cc = Math.max(0, Math.min(cols - 1, Math.floor(at.c)));
    const cr = Math.max(0, Math.min(rows - 1, Math.floor(at.r)));
    const center = cr * cols + cc;
    let gathered = 0;
    const bounds = this.cellBounds(x, z, radius, cols, rows);
    for (let r = bounds.minR; r <= bounds.maxR; r += 1) {
      for (let c = bounds.minC; c <= bounds.maxC; c += 1) {
        const pos = this.cellCenter(c, r, cols, rows);
        if (this.gap(x, z, pos.x, pos.z) > radius) continue;
        if (c === cc && r === cr) continue;
        const i = r * cols + c;
        const pool = this.waterPool[i] ?? 0;
        if (pool <= 0.001) continue;
        const take = pool * 0.55;
        this.waterPool[i] = pool - take;
        gathered += take;
      }
    }
    if (gathered > 0) {
      this.waterPool[center] = (this.waterPool[center] ?? 0) + gathered;
      const hp = cellHp(this.world);
      const was = this.progress[center] ?? 0;
      if (was < hp) {
        this.setProgress(center, Math.min(hp, was + gathered * 0.9));
        this.applySoak(center, cc, cr, cols, rows, 0, hp, false, 0);
      }
    }
    this.syncPoolPixels();
  }

  monsoonBand(rank: number): void {
    const { cols, rows } = maskOf(this.world);
    const hp = cellHp(this.world);
    const latBand = Math.floor(rows * (0.35 + rank * 0.04));
    const thick = 4 + rank;
    for (let r = Math.max(0, latBand - thick); r < Math.min(rows, latBand + thick); r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        if ((this.progress[i] ?? 0) >= hp) continue;
        this.applySoak(i, c, r, cols, rows, hp * 0.08, hp, false, 0);
      }
    }
  }

  flagLifeStorm(): void {
    this.lifeStormPulse = true;
  }

  consumeLifeStorm(): boolean {
    if (!this.lifeStormPulse) return false;
    this.lifeStormPulse = false;
    return true;
  }

  tickAbilityCooldowns(dt: number): void {
    for (const key of Object.keys(this.abilityCds)) {
      this.abilityCds[key] = Math.max(0, (this.abilityCds[key] ?? 0) - dt);
    }
    this.lightningCd = Math.max(0, this.lightningCd - dt);
    this.tornadoCd = Math.max(0, this.tornadoCd - dt);
    this.spinCd = Math.max(0, this.spinCd - dt);
    const next = pickAutoAbility(this, this.abilityCds);
    this.nextAbilityId = next ?? '';
    if (next) {
      const cd = abilityCooldown(next, this.ranks);
      const left = this.abilityCds[next] ?? 0;
      this.nextAbilityId = next;
      void cd;
      void left;
    }
  }

  abilityTelegraph(): { id: string; cdNorm: number } {
    const id = this.nextAbilityId;
    if (!id) return { id: '', cdNorm: 0 };
    const cd = abilityCooldown(id, this.ranks);
    const left = this.abilityCds[id] ?? 0;
    return { id: ABILITIES[id].label, cdNorm: cd > 0 ? 1 - left / cd : 0 };
  }

  resetAbilityCooldowns(short = false): void {
    for (const id of Object.keys(ABILITIES) as AbilityId[]) {
      const def = ABILITIES[id];
      if (!def.enabled(this.ranks, this.world)) continue;
      const cd = abilityCooldown(id, this.ranks);
      this.abilityCds[id] = short ? Math.min(6, cd * 0.28) : cd;
    }
  }

  tryCastAbility(ctx: import('./abilities').AbilityContext): AbilityId | null {
    if (this.phase !== 'play' || this.tank < 0.08) return null;
    const id = pickAutoAbility(this, this.abilityCds);
    if (!id) return null;
    const cd = abilityCooldown(id, this.ranks);
    if ((this.abilityCds[id] ?? 0) > 0) return null;
    this.abilityCds[id] = cd;
    if (id === 'sprinkler') this.spinCd = SPIN_CD;
    if (id === 'lightning') this.lightningCd = LIGHTNING_CD;
    if (id === 'tornado') this.tornadoCd = TORNADO_CD;
    ABILITIES[id].execute(this, ctx);
    return id;
  }

  takeGrowthPulses(): GrowthPulseEvent[] {
    const out = this.growthPulses;
    this.growthPulses = [];
    return out;
  }

  tickRestorationWaves(dt: number): void {
    if (this.waves.length === 0) return;
    const { cols, rows } = maskOf(this.world);
    const next: RestorationWave[] = [];
    for (const w of this.waves) {
      w.radius += w.speed * dt;
      const rad = w.radius;
      const inner = rad - WAVE_THICK;
      for (let dr = -Math.ceil(rad + 2); dr <= Math.ceil(rad + 2); dr += 1) {
        for (let dc = -Math.ceil(rad + 2); dc <= Math.ceil(rad + 2); dc += 1) {
          const nc = w.c + dc;
          const nr = w.r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const dist = Math.hypot(dc, dr);
          if (dist > rad || dist < inner) continue;
          const i = nr * cols + nc;
          const pixel = i * 4 + 2;
          this.pixels[pixel] = Math.max(this.pixels[pixel] ?? 0, 235);
          this.pulse[i] = Math.max(this.pulse[i] ?? 0, 210);
        }
      }
      if (w.radius < w.maxRadius) next.push(w);
    }
    this.waves = next;
    this.maskDirty = true;
    this.pulseDirty = true;
  }

  decayPulse(dt: number): void {
    const step = Math.max(1, Math.floor(255 * dt / 0.55));
    let any = false;
    for (let i = 0; i < this.pulse.length; i += 1) {
      const v = this.pulse[i] ?? 0;
      if (v <= 0) continue;
      const n = Math.max(0, v - step);
      this.pulse[i] = n;
      if (n > 0) any = true;
    }
    if (any) this.pulseDirty = true;
    const waveStep = Math.max(1, Math.floor(255 * dt / 0.85));
    for (let i = 2; i < this.pixels.length; i += 4) {
      const b = this.pixels[i] ?? 0;
      if (b <= 0) continue;
      this.pixels[i] = Math.max(0, b - waveStep);
      this.maskDirty = true;
    }
  }

  flowWaterStep(): void {
    const { cols, rows } = maskOf(this.world);
    const hp = cellHp(this.world);
    const eps = 0.02;
    const transfers: Array<{ from: number; to: number; amt: number }> = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        const pool = this.waterPool[i] ?? 0;
        if (pool <= eps) continue;
        const prog = this.progress[i] ?? 0;
        const neighbors = [
          [c - 1, r],
          [c + 1, r],
          [c, r - 1],
          [c, r + 1],
        ];
        let best = -1;
        let bestScore = prog - pool * 0.01;
        for (const pair of neighbors) {
          const nc = pair[0];
          const nr = pair[1];
          if (nc === undefined || nr === undefined) continue;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const ni = nr * cols + nc;
          const nProg = this.progress[ni] ?? 0;
          const nPool = this.waterPool[ni] ?? 0;
          const score = nProg + nPool * 0.02;
          if (score < bestScore) {
            bestScore = score;
            best = ni;
          }
        }
        if (best < 0) continue;
        const move = Math.min(pool * 0.42, 0.35);
        if (move <= eps) continue;
        transfers.push({ from: i, to: best, amt: move });
      }
    }
    for (const t of transfers) {
      this.waterPool[t.from] = (this.waterPool[t.from] ?? 0) - t.amt;
      this.waterPool[t.to] = (this.waterPool[t.to] ?? 0) + t.amt;
      const nProg = this.progress[t.to] ?? 0;
      if (nProg < hp) {
        const bc = t.to % cols;
        const br = Math.floor(t.to / cols);
        this.applySoak(t.to, bc, br, cols, rows, t.amt * poolFlow(this.ranks), hp, false, 0);
      }
    }
    this.syncPoolPixels();
  }

  syncPoolPixels(): void {
    const cap = cellHp(this.world) * 0.35;
    for (let i = 0; i < this.waterPool.length; i += 1) {
      const pool = this.waterPool[i] ?? 0;
      const a = cap > 0 ? Math.min(255, Math.floor((pool / cap) * 255)) : 0;
      this.pixels[i * 4 + 3] = a;
    }
    this.maskDirty = true;
  }

  depositPool(index: number, amount: number): void {
    if (amount <= 0) return;
    this.waterPool[index] = (this.waterPool[index] ?? 0) + amount;
    const pixel = index * 4 + 3;
    const cap = cellHp(this.world) * 0.35;
    const pool = this.waterPool[index] ?? 0;
    this.pixels[pixel] = cap > 0 ? Math.min(255, Math.floor((pool / cap) * 255)) : 0;
    this.maskDirty = true;
  }

  fadeRipples(dt: number): void {
    if (this.ripples <= 0) return;
    const step = Math.max(1, Math.floor(255 * dt / 0.65));
    const pixels = this.pixels;
    let left = 0;
    for (let i = 1; i < pixels.length; i += 4) {
      const g = pixels[i] ?? 0;
      if (g <= 0) continue;
      const next = Math.max(0, g - step);
      pixels[i] = next;
      if (next > 0) left += 1;
    }
    this.ripples = left;
    this.maskDirty = true;
  }

  takeGreen(): number[] {
    const hills = this.justGreen;
    this.justGreen = [];
    return hills;
  }

  /**
   * Dev-only visual QA helper (see scripts/shot.mjs): soaks a radial blob of the
   * current island so staged restoration can be inspected without a full run.
   */
  devSoak(pct: number): void {
    if (!import.meta.env.DEV) return;
    const { cols, rows } = maskOf(this.world);
    const hp = cellHp(this.world);
    const land = this.landOf(this.world, cols, rows);
    const cx = cols * 0.5;
    const cz = rows * 0.5;
    const radius = Math.hypot(cx, cz) * Math.sqrt(Math.min(1, Math.max(0, pct)));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const idx = r * cols + c;
        if (!land[idx]) continue;
        const d = Math.hypot(c + 0.5 - cx, r + 0.5 - cz);
        const wobble =
          0.86 + 0.1 * Math.sin(c * 0.45 + r * 0.9) + 0.06 * Math.sin(c * 1.7 - r * 0.6);
        const t = d < radius - 2.5 ? 1 : Math.max(0, 1 - (d - (radius - 2.5)) / 5);
        const value = Math.min(1, Math.max(0, t * wobble)) * hp;
        if ((this.progress[idx] ?? 0) < value) this.setProgress(idx, value);
      }
    }
    this.rebuildMaskPixels();
    this.refreshGreenFromProgress();
    this.trackProgress();
    this.claim();
    this.maskDirty = true;
    this.pulseDirty = true;
  }

  ratio(world = this.world): number {
    if (world !== this.world) return Math.min(1, this.best[world] ?? 0);
    const count = this.landCells(this.world);
    if (count === 0) return 0;
    const hp = cellHp(this.world);
    return Math.min(1, this.progressSum / (count * hp));
  }

  /** Match the balance sim (~98% cells full) and HUD rounding to 100%. */
  islandRestored(): boolean {
    const count = this.landCells(this.world);
    if (count === 0) return false;
    return this.filled / count >= 0.98 || this.ratio() >= 0.995;
  }

  /** Centre of playable land in world space (finale camera and restoration wave). */
  islandFocal(): { x: number; z: number } {
    const { cols, rows } = maskOf(this.world);
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!this.isLand(c, r)) continue;
        const at = this.cellCenter(c, r, cols, rows);
        sx += at.x;
        sz += at.z;
        n += 1;
      }
    }
    if (n === 0) return { x: 0, z: 0 };
    return { x: sx / n, z: sz / n };
  }

  /** Furthest dry land from the island centre — size of the finale green wave. */
  islandCoverRadius(): number {
    const focal = this.islandFocal();
    const { cols, rows } = maskOf(this.world);
    let max = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!this.isLand(c, r)) continue;
        const at = this.cellCenter(c, r, cols, rows);
        max = Math.max(max, this.gap(focal.x, focal.z, at.x, at.z));
      }
    }
    return max + 2.5;
  }

  isRestored(index: number, world = this.world): boolean {
    if (world !== this.world) return (this.best[world] ?? 0) >= 1;
    return this.green[index] === true;
  }

  /**
   * A handful of world-space spots where the mask is actually growing.
   * Spread apart so sun shafts land on separate patches instead of one stack.
   */
  sunPatches(limit: number): { x: number; z: number; w: number }[] {
    if (this.world === GLOBE_WORLD || limit <= 0) return [];
    const { cols, rows } = maskOf(this.world);
    const hp = Math.max(1, cellHp(this.world));
    const stride = Math.max(1, Math.floor(Math.sqrt((cols * rows) / 4000)));
    const hits: { x: number; z: number; w: number }[] = [];
    for (let r = 0; r < rows; r += stride) {
      for (let c = 0; c < cols; c += stride) {
        const w = Math.min(1, (this.progress[r * cols + c] ?? 0) / hp);
        if (w < 0.2) continue;
        const at = this.cellCenter(c, r, cols, rows);
        hits.push({ x: at.x, z: at.z, w });
      }
    }
    hits.sort((a, b) => b.w - a.w);
    const picked: { x: number; z: number; w: number }[] = [];
    for (const hit of hits) {
      if (picked.length >= limit) break;
      let crowded = false;
      for (const spot of picked) {
        if ((spot.x - hit.x) ** 2 + (spot.z - hit.z) ** 2 < 2.4) {
          crowded = true;
          break;
        }
      }
      if (!crowded) picked.push(hit);
    }
    return picked;
  }

  /**
   * Remaining dry pockets, once most of the island is already green.
   * One pin per pocket so the last percent is somewhere you can see.
   */
  thirstySpots(limit: number): { x: number; z: number; dry: number }[] {
    return this.drySurvey(limit).targets.map((t) => ({ x: t.x, z: t.z, dry: t.dry }));
  }

  /**
   * Where the land still needs water.
   *
   * Groups the thirsty mask cells into pockets so the player can be pointed at
   * a place rather than a pixel, and counts what is left so the HUD can say
   * "3 patches" instead of an ambiguous percentage. The scan is cached: it
   * walks every mask cell, so it must not run every frame.
   */
  drySurvey(limit: number): { cells: number; pockets: number; total: number; targets: DryTarget[] } {
    if (limit <= 0) return { cells: 0, pockets: 0, total: 0, targets: [] };
    const now = Date.now();
    if (!this.dryCache || now - this.dryCacheAt > 300) {
      this.dryCache = this.scanDryPockets();
      this.dryCacheAt = now;
    }
    const cache = this.dryCache;
    const targets: DryTarget[] = [];
    for (const target of cache.pockets) {
      if (targets.some((p) => (p.x - target.x) ** 2 + (p.z - target.z) ** 2 < 36)) continue;
      targets.push(target);
      if (targets.length >= limit) break;
    }
    return { cells: cache.cells, pockets: cache.pockets.length, total: cache.total, targets };
  }

  /** One pass over the mask, grouping the thirsty cells into pockets. */
  private scanDryPockets(): { cells: number; pockets: DryTarget[]; total: number } {
    const { cols, rows } = maskOf(this.world);
    const hp = Math.max(1, cellHp(this.world));
    const land = this.landOf(this.world, cols, rows);
    const bucket = 2.4;
    const map = new Map<string, { x: number; z: number; cells: number; dry: number; wet: number }>();
    let cells = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const index = r * cols + c;
        // The sea is not thirsty. Only the island is.
        if (!land[index]) continue;
        const p = this.progress[index] ?? 0;
        if (p >= hp) continue;
        cells += 1;
        const at = this.cellCenter(c, r, cols, rows);
        const key = `${Math.floor(at.x / bucket)}:${Math.floor(at.z / bucket)}`;
        const entry = map.get(key);
        const wet = p / hp;
        if (entry) {
          entry.x += at.x;
          entry.z += at.z;
          entry.cells += 1;
          entry.dry += 1 - wet;
          entry.wet += wet;
        } else {
          map.set(key, { x: at.x, z: at.z, cells: 1, dry: 1 - wet, wet });
        }
      }
    }
    const pockets: DryTarget[] = [];
    for (const entry of map.values()) {
      pockets.push({
        x: entry.x / entry.cells,
        z: entry.z / entry.cells,
        cells: entry.cells,
        dry: entry.dry / entry.cells,
        nearly: entry.wet / entry.cells,
      });
    }
    pockets.sort((a, b) => b.cells - a.cells || b.dry - a.dry);
    // The total is the land of the island, not the whole grid.
    return { cells, pockets, total: this.landCells(this.world) };
  }

  /** True for land the cloud can score, plus the dead rim the cinematic finishes. */
  spectacleTile(index: number): boolean {
    const { cols, rows } = gridOf(this.world);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const w = cols * TILE;
    const h = rows * TILE;
    const radius = islandRadius(this.world, w, h);
    const centerX = -TILE / 2 + w * 0.5;
    const centerZ = -TILE / 2 + h * 0.5;
    const x = (col + 0.5) * TILE - TILE / 2;
    const z = (row + 0.5) * TILE - TILE / 2;
    return islandShore(this.world, x - centerX, z - centerZ, radius) <= 0.16;
  }

  /** Average mask soak for one board tile (0–1). Drives staged props before the hill is "green". */
  hillWet(index: number): number {
    const { cols, rows } = gridOf(this.world);
    const { cols: maskCols, rows: maskRows } = maskOf(this.world);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const c0 = Math.floor((col / cols) * maskCols);
    const c1 = Math.floor(((col + 1) / cols) * maskCols);
    const r0 = Math.floor((row / rows) * maskRows);
    const r1 = Math.floor(((row + 1) / rows) * maskRows);
    const hp = cellHp(this.world);
    let sum = 0;
    let seen = 0;
    for (let r = r0; r < r1; r += 1) {
      for (let c = c0; c < c1; c += 1) {
        if (!this.isLand(c, r)) continue;
        seen += 1;
        sum += Math.min(hp, this.progress[r * maskCols + c] ?? 0) / hp;
      }
    }
    return seen > 0 ? sum / seen : 0;
  }

  spec(index: number): TileSpec {
    const tiles = this.current();
    return tileSpec(this.world, index, tiles.length);
  }

  /** Continuous pond fill (0–1) driven by the mask soak so water visibly rises. */
  pondFill(index: number): number {
    if (this.isRestored(index)) return 1;
    return Math.min(1, this.hillWet(index) * 1.02);
  }

  current(): TileState[] {
    return this.tiles[this.world] ?? [];
  }

  hillBloomLevel(index: number): number {
    const { cols, rows } = gridOf(this.world);
    const { cols: maskCols, rows: maskRows } = maskOf(this.world);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const c0 = Math.floor((col / cols) * maskCols);
    const c1 = Math.floor(((col + 1) / cols) * maskCols);
    const r0 = Math.floor((row / rows) * maskRows);
    const r1 = Math.floor(((row + 1) / rows) * maskRows);
    const hp = cellHp(this.world);
    let sum = 0;
    let seen = 0;
    for (let r = r0; r < r1; r += 1) {
      for (let c = c0; c < c1; c += 1) {
        if (!this.isLand(c, r)) continue;
        seen += 1;
        sum += growthStage(this.progress[r * maskCols + c] ?? 0, hp);
      }
    }
    return seen > 0 ? sum / seen : 0;
  }

  animalCount(): number {
    if (this.phase === 'finale') {
      const { cols, rows } = gridOf(this.world);
      return Math.min(20, Math.max(10, Math.floor(cols * rows * 0.55)));
    }
    const ratio = this.ratio();
    if (ratio < 0.03) return 0;
    const { cols, rows } = gridOf(this.world);
    let lush = 0;
    for (let i = 0; i < cols * rows; i += 1) {
      if (this.green[i] || this.hillBloomLevel(i) >= 3.6) lush += 1;
    }
    const cap = 8 + (this.ranks.buddy >= 1 ? 2 : 0);
    const fromTiles = Math.floor(lush * 0.45);
    return Math.min(cap, Math.max(0, fromTiles) + (this.ranks.buddy >= 1 ? 1 : 0));
  }

  helperCount(): number {
    if (this.phase === 'finale') return 4;
    return Math.min(4, Math.floor(this.ranks.puff / 2));
  }

  boomboxIndexes(): number[] {
    return [];
  }

  /**
   * The manual casts share one clock with the automatic ones, so a button press
   * and the auto-fire can never disagree about what is ready.
   */
  private manualReady(id: 'sprinkler' | 'lightning' | 'tornado', cd: number): boolean {
    if (!abilityOn(this.ranks, id)) return false;
    if ((this.abilityCds[id] ?? 0) > 0) return false;
    this.abilityCds[id] = cd;
    if (id === 'sprinkler') this.spinCd = SPIN_CD;
    if (id === 'lightning') this.lightningCd = LIGHTNING_CD;
    if (id === 'tornado') this.tornadoCd = TORNADO_CD;
    return true;
  }

  trySpin(): boolean {
    return this.manualReady('sprinkler', SPIN_CD);
  }

  startTornado(): boolean {
    return this.manualReady('tornado', TORNADO_CD);
  }

  armLightning(): boolean {
    return this.manualReady('lightning', LIGHTNING_CD);
  }

  pet(): number {
    this.stats.animals += 1;
    const dew = this.addDew(8 * worldDef(this.world).pay);
    this.toast = `+${formatDew(dew)} · a little heart`;
    this.claim();
    return dew;
  }

  snapshot(extra: { raining: boolean; sleepy: boolean; slosh: number; music: boolean; pond: number | null }): HudModel {
    const wallet = {
      dew: walletDew(this.dew),
      blooms: this.spendableBlooms(),
    };
    const dry = this.drySurvey(1);
    return {
      ready: true,
      dew: this.dew,
      liters: this.liters(),
      maxLiters: this.maxLiters(),
      tank: this.tank,
      raining: extra.raining,
      sleepy: extra.sleepy,
      slosh: extra.slosh,
      worldName: worldDef(this.world).name,
      worldIndex: this.world,
      worldCount: worldCount(),
      restored: this.ratio(),
      canPrev: this.world > 0,
      canNext: this.world < GLOBE_WORLD,
      nextLocked: this.world < GLOBE_WORLD && this.world + 1 > this.unlocked,
      sfx: this.sfx,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      music: extra.music,
      toast: this.toast,
      boost: false,
      pond: extra.pond,
      phase: this.phase,
      screen:
        this.screen === 'start'
          ? 'start'
          : this.phase === 'play' || this.phase === 'finale'
            ? 'play'
            : this.screen,
      runDew: this.runDew,
      runTiles: this.runTiles,
      runBlooms: this.runBlooms,
      runReached: this.runReached,
      best: this.best[this.world] ?? 0,
      cleared: this.phase === 'clear',
      newBest: this.newBest,
      tree: buildTree(this.ranks, wallet, this.unlocked),
      nextGoal: this.nextGoal(),
      worlds: [0, 1, 2, 3, 4].map((index) => ({
        index,
        name: worldDef(index).name,
        locked: index > this.unlocked,
        current: index === this.world,
        best: this.best[index] ?? 0,
      })),
      stats: { ...this.stats },
      achievements: ACHIEVEMENTS.map((a) => {
        const track = this.achievementTrack(a.id);
        return { ...a, done: this.achievements.includes(a.id), current: track.current, goal: track.goal };
      }),
      spendableBlooms: wallet.blooms,
      toasts: this.toastLog.map((t) => ({ ...t })),
      chain: this.chainMultiplier(),
      patchesLeft: dry.cells,
      pocketsLeft: dry.pockets,
      dryFraction: dry.total > 0 ? dry.cells / dry.total : 0,
      nextAbility: this.abilityTelegraph().id,
      abilityCdNorm: this.abilityTelegraph().cdNorm,
      revivalGlow: this.phase === 'finale' ? Math.max(this.revivalGlow, 0.85 + this.finaleProgress * 0.4) : this.revivalGlow,
      finaleProgress: this.finaleProgress,
    };
  }

  private checkRevivalMilestones(): void {
    const pct = Math.floor(this.ratio() * 100);
    for (const m of REVIVAL_MILESTONES) {
      if (pct >= m && !this.revivalMilestones.has(m)) {
        this.revivalMilestones.add(m);
        this.revivalGlow = 1.35;
        this.pendingMilestone = m;
        this.toast = m >= 100 ? 'The land is whole again!' : `World revival ${m}%!`;
      }
    }
  }

  private paint(
    x: number,
    z: number,
    radius: number,
    amount: number,
    respectPatches: boolean,
    limit = Number.POSITIVE_INFINITY,
  ): { dew: number; filled: number; crits: number } {
    const { cols, rows } = maskOf(this.world);
    const hp = cellHp(this.world);
    const gate = 1 - patchFraction(this.ranks);
    const bounds = this.cellBounds(x, z, radius, cols, rows);
    let dew = 0;
    let filled = 0;
    let crits = 0;
    let used = 0;
    const hills = new Set<number>();
    const spills: number[] = [];
    for (let r = bounds.minR; r <= bounds.maxR && used < limit; r += 1) {
      for (let c = bounds.minC; c <= bounds.maxC && used < limit; c += 1) {
        const at = this.cellCenter(c, r, cols, rows);
        if (this.gap(x, z, at.x, at.z) > radius) continue;
        if (!this.isLand(c, r)) continue;
        if (respectPatches && hash01(c, r) < gate) continue;
        const edge = 1 - this.gap(x, z, at.x, at.z) / Math.max(0.001, radius);
        if (respectPatches && this.ranks.specks >= 2 && hash01(c + 19, r + 3) > gate + edge * 0.28) continue;
        const index = r * cols + c;
        if ((this.progress[index] ?? 0) >= hp) {
          this.depositPool(index, amount * poolGain(this.ranks));
          if (spills.length < 18) spills.push(index);
          continue;
        }
        const soaked = this.applySoak(index, c, r, cols, rows, amount, hp, respectPatches, gate);
        dew += soaked.dew;
        filled += soaked.filled;
        crits += soaked.crits;
        used += soaked.filled;
        if (soaked.hill >= 0) hills.add(soaked.hill);
      }
    }
    for (const full of spills) {
      const spilled = this.spillFrom(full, x, z, cols, rows, amount, hp, respectPatches, gate);
      if (!spilled) continue;
      dew += spilled.dew;
      filled += spilled.filled;
      crits += spilled.crits;
      if (spilled.hill >= 0) hills.add(spilled.hill);
    }
    for (const hill of hills) this.considerHill(hill);
    if (filled > 0) {
      this.trackProgress();
      this.claim();
      this.checkRevivalMilestones();
      this.finishIfDone();
    }
    if (this.phase === 'play') this.captureRunPeak();
    return { dew, filled, crits };
  }

  /** Rain that lands on a finished cell rolls outward to the nearest thirsty cell. */
  private spillFrom(
    fullIndex: number,
    originX: number,
    originZ: number,
    cols: number,
    rows: number,
    amount: number,
    hp: number,
    respectPatches: boolean,
    gate: number,
  ): { dew: number; filled: number; crits: number; hill: number } | null {
    const c0 = fullIndex % cols;
    const r0 = Math.floor(fullIndex / cols);
    let best = -1;
    let bestAway = -1;
    for (let rad = 1; rad <= 6; rad += 1) {
      for (let dr = -rad; dr <= rad; dr += 1) {
        for (let dc = -rad; dc <= rad; dc += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
          const nc = c0 + dc;
          const nr = r0 + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          if (!this.isLand(nc, nr)) continue;
          const ni = nr * cols + nc;
          if ((this.progress[ni] ?? 0) >= hp) continue;
          const at = this.cellCenter(nc, nr, cols, rows);
          const away = this.gap(originX, originZ, at.x, at.z);
          if (away > bestAway) {
            bestAway = away;
            best = ni;
          }
        }
      }
      if (best >= 0) break;
    }
    if (best < 0) return null;
    const nc = best % cols;
    const nr = Math.floor(best / cols);
    return this.applySoak(best, nc, nr, cols, rows, amount, hp, respectPatches, gate);
  }

  /** Write a cell's progress and keep the cached mask total in step. */
  private setProgress(index: number, value: number): void {
    const was = this.progress[index] ?? 0;
    if (value === was) return;
    this.progress[index] = value;
    this.progressSum += value - was;
  }

  private applySoak(
    index: number,
    c: number,
    r: number,
    cols: number,
    rows: number,
    amount: number,
    hp: number,
    respectPatches: boolean,
    gate: number,
  ): { dew: number; filled: number; crits: number; hill: number } {
    const was = this.progress[index] ?? 0;
    if (was >= hp) return { dew: 0, filled: 0, crits: 0, hill: -1 };
    let crit = false;
    if (was <= 0 && Math.random() < critChance(this.ranks)) {
      this.progress[index] = hp;
      crit = true;
    } else {
      this.progress[index] = Math.min(hp, was + amount);
    }
    const now = this.progress[index] ?? 0;
    this.progressSum += now - was;
    if (now > was) {
      const st0 = growthStage(was, hp);
      const st1 = growthStage(now, hp);
      if (st1 > st0) {
        this.pulse[index] = 255;
        const at = this.cellCenter(c, r, cols, rows);
        this.growthPulses.push({ x: at.x, z: at.z, stage: st1 });
        this.pulseDirty = true;
      }
      this.splashRipple(index);
      this.bleedMask(c, r, cols, rows, (now - was) * 0.14, hp, respectPatches, gate);
    }
    const done = now >= hp;
    const byte = done ? 255 : Math.min(254, Math.floor((now / hp) * 254));
    const pixel = index * 4;
    this.pixels[pixel] = byte;
    let dew = 0;
    let filled = 0;
    let hill = -1;
    if (now > was && !done) {
      const drip = cellDew(this.world, this.ranks) * ((now - was) / hp) * 0.22 * this.chainMultiplier();
      if (drip >= 0.001) dew += this.addDew(drip);
    }
    if (done) {
      this.pixels[pixel + 1] = 255;
      this.ripples += 1;
      this.filled += 1;
      filled = 1;
      dew += this.addDew(cellDew(this.world, this.ranks) * (crit ? 3 : 1) * this.chainMultiplier());
      this.stats.tiles += 1;
      this.runTiles += 1;
      hill = this.hillIndex(c, r, cols, rows);
    }
    this.maskDirty = true;
    return { dew, filled, crits: crit ? 1 : 0, hill };
  }

  private cellBounds(x: number, z: number, radius: number, cols: number, rows: number): { minC: number; maxC: number; minR: number; maxR: number } {
    const a = this.maskPos(x - radius, z - radius, cols, rows);
    const b = this.maskPos(x + radius, z + radius, cols, rows);
    return {
      minC: Math.max(0, Math.floor(Math.min(a.c, b.c))),
      maxC: Math.min(cols - 1, Math.ceil(Math.max(a.c, b.c))),
      minR: Math.max(0, Math.floor(Math.min(a.r, b.r))),
      maxR: Math.min(rows - 1, Math.ceil(Math.max(a.r, b.r))),
    };
  }

  private splashRipple(index: number): void {
    const pixel = index * 4 + 1;
    const g = this.pixels[pixel] ?? 0;
    if (g < 210) {
      this.pixels[pixel] = 220;
      this.ripples += 1;
    }
    this.maskDirty = true;
  }

  private bleedMask(
    c: number,
    r: number,
    cols: number,
    rows: number,
    amount: number,
    hp: number,
    respectPatches: boolean,
    gate: number,
  ): void {
    if (amount <= 0.001) return;
    const neighbors = [
      [c - 1, r],
      [c + 1, r],
      [c, r - 1],
      [c, r + 1],
    ];
    for (const pair of neighbors) {
      const nc = pair[0];
      const nr = pair[1];
      if (nc === undefined || nr === undefined) continue;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (!this.isLand(nc, nr)) continue;
      if (respectPatches && hash01(nc, nr) < gate) continue;
      const i = nr * cols + nc;
      const was = this.progress[i] ?? 0;
      if (was >= hp) continue;
      const cap = hp * 0.94;
      const next = Math.min(cap, was + amount);
      if (next <= was) continue;
      this.setProgress(i, next);
      const byte = Math.min(254, Math.floor((next / hp) * 254));
      const pixel = i * 4;
      this.pixels[pixel] = byte;
      this.splashRipple(i);
      this.maskDirty = true;
    }
  }

  private maskPos(x: number, z: number, cols: number, rows: number): { c: number; r: number } {
    if (this.world === GLOBE_WORLD) {
      const lon = ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const lat = Math.max(-1.15, Math.min(1.15, z));
      return { c: (lon / (Math.PI * 2)) * cols, r: (lat / 2.3 + 0.5) * rows };
    }
    const span = boardSpan(this.world);
    return { c: ((x + TILE / 2) / span.w) * cols, r: ((z + TILE / 2) / span.h) * rows };
  }

  private cellCenter(c: number, r: number, cols: number, rows: number): { x: number; z: number } {
    if (this.world === GLOBE_WORLD) {
      return {
        x: ((c + 0.5) / cols) * Math.PI * 2,
        z: ((r + 0.5) / rows - 0.5) * 2.3,
      };
    }
    const span = boardSpan(this.world);
    return { x: ((c + 0.5) / cols) * span.w - TILE / 2, z: ((r + 0.5) / rows) * span.h - TILE / 2 };
  }

  private gap(x: number, z: number, cx: number, cz: number): number {
    if (this.world !== GLOBE_WORLD) return Math.hypot(x - cx, z - cz);
    let dLon = Math.abs(x - cx);
    dLon = Math.min(dLon, Math.PI * 2 - dLon);
    return Math.hypot(dLon, z - cz);
  }

  private hillIndex(c: number, r: number, maskCols: number, maskRows: number): number {
    const { cols, rows } = gridOf(this.world);
    const col = Math.max(0, Math.min(cols - 1, Math.floor((c / maskCols) * cols)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((r / maskRows) * rows)));
    return row * cols + col;
  }

  private considerHill(index: number): void {
    if (this.green[index]) return;
    const { cols, rows } = gridOf(this.world);
    const { cols: maskCols, rows: maskRows } = maskOf(this.world);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const c0 = Math.floor((col / cols) * maskCols);
    const c1 = Math.floor(((col + 1) / cols) * maskCols);
    const r0 = Math.floor((row / rows) * maskRows);
    const r1 = Math.floor(((row + 1) / rows) * maskRows);
    const hp = cellHp(this.world);
    let seen = 0;
    let done = 0;
    for (let r = r0; r < r1; r += 1) {
      for (let c = c0; c < c1; c += 1) {
        if (!this.isLand(c, r)) continue;
        seen += 1;
        if ((this.progress[r * maskCols + c] ?? 0) >= hp) done += 1;
      }
    }
    if (seen === 0 || done / seen < 0.62) return;
    this.green[index] = true;
    const tile = this.tiles[this.world]?.[index];
    if (tile) {
      tile.hp = 0;
      tile.pond = 1;
      tile.cracked = true;
    }
    // Ponds and the mega flora feed the achievements that were unreachable.
    const kind = tileSpec(this.world, index, this.tiles[this.world]?.length ?? 0).kind;
    if (this.phase !== 'finale') {
      if (kind === 'pond') this.stats.ponds += 1;
      if (kind === 'seed') this.stats.blooms += 1;
    }
    this.justGreen.push(index);
    this.spawnHillWave(index);
  }

  private spawnHillWave(tileIndex: number): void {
    const { cols, rows } = gridOf(this.world);
    const { cols: mc, rows: mr } = maskOf(this.world);
    const col = tileIndex % cols;
    const row = Math.floor(tileIndex / cols);
    const c = Math.floor(((col + 0.5) / cols) * mc);
    const r = Math.floor(((row + 0.5) / rows) * mr);
    this.waves.push({
      c,
      r,
      radius: 0,
      maxRadius: Math.max(mc, mr) * 0.42,
      speed: WAVE_SPEED * 1.15,
    });
    this.maskDirty = true;
    this.pulseDirty = true;
  }

  private addDew(amount: number): number {
    this.dew += amount;
    this.runDew += amount;
    this.stats.dewEarned += amount;
    return amount;
  }

  private captureRunPeak(): void {
    const ratio = this.ratio();
    if (ratio > this.runReached) this.runReached = ratio;
  }

  /**
   * Keep the best share of green each island has reached. The island
   * milestones watch this, so it has to move while the rain falls and not
   * only when the bottle is empty.
   */
  private trackProgress(): void {
    const ratio = Math.min(1, Math.max(this.ratio(), this.runReached));
    if (ratio > (this.best[this.world] ?? 0)) this.best[this.world] = ratio;
  }

  private noteBest(): void {
    const ratio = Math.min(1, Math.max(this.ratio(), this.runReached));
    const before = this.best[this.world] ?? 0;
    this.newBest = ratio > before + 0.0005;
    if (ratio > before) this.best[this.world] = ratio;
    if ((this.best[this.world] ?? 0) > 1) this.best[this.world] = 1;
  }

  private achievementTrack(id: string): { current: number; goal: number } {
    const milestone = milestoneIsland(id);
    if (milestone) {
      // How much of that island has been green at its best.
      return { current: this.best[milestone.island] ?? 0, goal: milestone.goal };
    }
    switch (id) {
      case 'gardener':
        return { current: this.stats.tiles, goal: 80 };
      case 'koi':
        return { current: this.stats.ponds, goal: 1 };
      case 'money':
        return { current: this.stats.blooms, goal: 1 };
      case 'friend':
        return { current: this.stats.animals, goal: 10 };
      case 'forest':
        return { current: this.best[0] ?? 0, goal: 1 };
      case 'frost':
        return { current: this.best[1] ?? 0, goal: 1 };
      case 'oasis':
        return { current: this.best[2] ?? 0, goal: 1 };
      case 'clean':
        return { current: this.best[3] ?? 0, goal: 1 };
      case 'band':
        return { current: Math.floor(this.stats.dewEarned), goal: 1000 };
      case 'mogul':
        return { current: Math.floor(this.stats.dewEarned), goal: 50000 };
      case 'drip-check':
        return { current: this.ranks.puff, goal: 4 };
      default:
        return { current: this.stats.tiles > 0 && this.runTiles > 0 ? 1 : 0, goal: 1 };
    }
  }

  /** Island hit the clear threshold — start the victory beat (or recover from a dry bottle on the same pour). */
  tryCompleteIsland(): void {
    if (this.phase === 'finale' || this.phase === 'clear') return;
    if (!this.islandRestored()) return;
    if (this.phase === 'dry') {
      this.phase = 'play';
      this.screen = 'play';
    }
    this.beginFinale();
  }

  private finishIfDone(): void {
    this.tryCompleteIsland();
  }

  beginFinale(): void {
    if (this.phase !== 'play') return;
    this.captureRunPeak();
    this.logRun();
    this.phase = 'finale';
    this.screen = 'play';
    this.finaleProgress = 0;
    this.revivalGlow = 0.45;
    this.toast = '';
    this.dryCache = null;
  }

  /**
   * During the 100% spectacle, a wave of life sweeps across whatever dry land
   * is still left so the island reads fully restored, not “mostly green.”
   */
  applyFinaleWave(originX: number, originZ: number, radius: number): number {
    if (this.phase !== 'finale' || radius <= 0) return 0;
    const hp = cellHp(this.world);
    const { cols, rows } = maskOf(this.world);
    const bounds = this.cellBounds(originX, originZ, radius, cols, rows);
    let changed = 0;
    for (let r = bounds.minR; r <= bounds.maxR; r += 1) {
      for (let c = bounds.minC; c <= bounds.maxC; c += 1) {
        if (!this.isLand(c, r)) {
          if (this.paintFinaleFringe(c, r, cols, rows, originX, originZ, radius)) changed += 1;
          continue;
        }
        const at = this.cellCenter(c, r, cols, rows);
        const d = this.gap(originX, originZ, at.x, at.z);
        if (d > radius) continue;
        const i = r * cols + c;
        const was = this.progress[i] ?? 0;
        if (was >= hp) continue;
        const edge = 1 - (d / Math.max(0.001, radius));
        const target = hp * (0.12 + 0.88 * edge * edge);
        const next = Math.min(hp, Math.max(was, target));
        if (next <= was + 0.002) continue;
        this.setProgress(i, next);
        const now = this.progress[i] ?? 0;
        const pixel = i * 4;
        if (now >= hp) {
          this.pixels[pixel] = 255;
          this.pixels[pixel + 1] = 255;
          this.pulse[i] = 255;
          if (was < hp) this.filled += 1;
          this.splashRipple(i);
          const hill = this.hillIndex(c, r, cols, rows);
          if (hill >= 0) this.syncHillFromMask(hill);
        } else {
          this.pixels[pixel] = Math.min(254, Math.floor((now / hp) * 254));
        }
        changed += 1;
      }
    }
    if (changed > 0) {
      this.dryCache = null;
      this.maskDirty = true;
      this.pulseDirty = true;
    }
    return changed;
  }

  /**
   * Rim columns the cloud can never water (shore just outside the counted
   * land). Paint the mask only — they must not push the island past 100%.
   */
  private paintFinaleFringe(
    c: number,
    r: number,
    cols: number,
    rows: number,
    originX: number,
    originZ: number,
    radius: number,
  ): boolean {
    const shore = this.cellShore(c, r, cols, rows);
    if (shore < 0 || shore > 0.16) return false;
    const at = this.cellCenter(c, r, cols, rows);
    const d = this.gap(originX, originZ, at.x, at.z);
    if (d > radius) return false;
    const edge = 1 - d / Math.max(0.001, radius);
    const wet = Math.min(1, 0.2 + 0.8 * edge * edge);
    return this.writeMaskWet(r * cols + c, wet);
  }

  private cellShore(c: number, r: number, cols: number, rows: number): number {
    const { cols: gcols, rows: grows } = gridOf(this.world);
    const w = gcols * TILE;
    const h = grows * TILE;
    const radius = islandRadius(this.world, w, h);
    const centerX = -TILE / 2 + w * 0.5;
    const centerZ = -TILE / 2 + h * 0.5;
    const x = ((c + 0.5) / cols) * w - TILE / 2;
    const z = ((r + 0.5) / rows) * h - TILE / 2;
    return islandShore(this.world, x - centerX, z - centerZ, radius);
  }

  /** Mask green for the cinematic. Does not touch the scored land total. */
  private writeMaskWet(index: number, wet: number): boolean {
    const pixel = index * 4;
    const next = wet >= 0.995 ? 255 : Math.min(254, Math.floor(Math.max(0, wet) * 254));
    if ((this.pixels[pixel] ?? 0) >= next) return false;
    this.pixels[pixel] = next;
    if (next >= 255) this.pixels[pixel + 1] = 255;
    return true;
  }

  /** Snap any stragglers to full green before the results screen. */
  sealFinaleLandscape(): void {
    if (this.phase !== 'finale') return;
    const hp = cellHp(this.world);
    const { cols, rows } = maskOf(this.world);
    let changed = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!this.isLand(c, r)) {
          if (this.writeMaskWet(r * cols + c, this.cellShore(c, r, cols, rows) <= 0.16 ? 1 : 0)) changed += 1;
          continue;
        }
        const i = r * cols + c;
        const was = this.progress[i] ?? 0;
        if (was >= hp) continue;
        this.setProgress(i, hp);
        const pixel = i * 4;
        this.pixels[pixel] = 255;
        this.pixels[pixel + 1] = 255;
        this.pulse[i] = 255;
        if (was < hp) this.filled += 1;
        this.splashRipple(i);
        const hill = this.hillIndex(c, r, cols, rows);
        if (hill >= 0) {
          this.syncHillFromMask(hill);
          this.considerHill(hill);
        }
        changed += 1;
      }
    }
    this.trackProgress();
    if (changed > 0) {
      this.dryCache = null;
      this.maskDirty = true;
      this.pulseDirty = true;
    }
  }

  endFinale(): void {
    if (this.phase !== 'finale') return;
    this.sealFinaleLandscape();
    this.phase = 'clear';
    this.finaleProgress = 1;
    this.noteBest();
    if (this.world < GLOBE_WORLD && this.unlocked < this.world + 1) this.unlocked = this.world + 1;
    this.toast = `${worldDef(this.world).name} is green again.`;
    this.claim();
    this.screen = this.world < GLOBE_WORLD ? 'worlds' : 'results';
  }

  private claim(): void {
    for (let guard = 0; guard < 16; guard += 1) {
      const next = ACHIEVEMENTS.find((a) => !this.achievements.includes(a.id) && this.meets(a.id));
      if (!next) break;
      this.achievements.push(next.id);
      if (next.reward > 0) this.addDew(next.reward);
      this.pendingAchievements.push(next.id);
      this.toast = `Achievement · ${next.name}`;
    }
  }

  private meets(id: string): boolean {
    const milestone = milestoneIsland(id);
    if (milestone) {
      return (this.best[milestone.island] ?? 0) >= milestone.goal;
    }
    switch (id) {
      case 'first-drop':
        return this.stats.tiles >= 1 && this.runTiles >= 1;
      case 'gardener':
        return this.stats.tiles >= 80;
      case 'koi':
        return this.stats.ponds >= 1;
      case 'money':
        return this.stats.blooms >= 1;
      case 'friend':
        return this.stats.animals >= 10;
      case 'forest':
        return (this.best[0] ?? 0) >= 1;
      case 'frost':
        return (this.best[1] ?? 0) >= 1;
      case 'oasis':
        return (this.best[2] ?? 0) >= 1;
      case 'clean':
        return (this.best[3] ?? 0) >= 1;
      case 'band':
        return this.stats.dewEarned >= 1000;
      case 'mogul':
        return this.stats.dewEarned >= 50000;
      case 'drip-check':
        return this.ranks.puff >= 4;
      default:
        return false;
    }
  }
}

function makeTiles(world: number): TileState[] {
  const count = worldDef(world).tiles;
  const tiles: TileState[] = [];
  for (let i = 0; i < count; i += 1) {
    tiles.push({ hp: 1, pond: 0, cracked: true });
  }
  return tiles;
}

export function formatDew(n: number): string {
  const whole = walletDew(n);
  if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M`;
  if (whole >= 10_000) return `${(whole / 1000).toFixed(1)}K`;
  return whole.toLocaleString();
}

export function formatLiters(n: number): string {
  return `${Math.round(n).toLocaleString()}L`;
}
