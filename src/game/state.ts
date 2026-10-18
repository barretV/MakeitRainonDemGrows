import {
  ACHIEVEMENTS,
  GLOBE_WORLD,
  TILE,
  type AchievementDef,
  type TileSpec,
  gridOf,
  tileSpec,
  worldDef,
} from './balance';
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
  nodeCost,
  patchFraction,
  prereqMet,
  rainRadius,
  soakPerTick,
  upgradeNode,
  worldCount,
  type NodeId,
  type Ranks,
  type TreeNodeView,
} from './tree';

export interface TileState {
  hp: number;
  pond: number;
  cracked: boolean;
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

export type RunPhase = 'play' | 'dry' | 'clear';
export type Screen = 'play' | 'results' | 'workshop' | 'worlds';

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
  toast: string;
  boost: boolean;
  pond: number | null;
  phase: RunPhase;
  screen: Screen;
  runDew: number;
  /** Mask cells completed this bottle. */
  runTiles: number;
  /** Peak revival % this run (survives until Rain again). */
  runReached: number;
  best: number;
  cleared: boolean;
  tree: TreeNodeView[];
  worlds: WorldChip[];
  stats: Stats;
  achievements: Array<AchievementDef & { done: boolean }>;
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

export class SaveState {
  dew = 0;
  ranks: Ranks = emptyRanks();
  world = 0;
  unlocked = 0;
  tank = 1;
  tiles: TileState[][] = [];
  stats: Stats = emptyStats();
  achievements: string[] = [];
  sfx = true;
  music = false;
  lastSave = Date.now();
  toast = '';
  boostUntil = 0;
  lightningCd = 8;
  tornadoCd = 14;
  spinCd = 5;
  phase: RunPhase = 'play';
  screen: Screen = 'play';
  runDew = 0;
  runTiles = 0;
  runReached = 0;
  best: number[] = [0, 0, 0, 0, 0];

  progress = new Float32Array(0);
  pixels = new Uint8Array(0);
  maskDirty = false;
  private filled = 0;
  private green: boolean[] = [];
  private justGreen: number[] = [];
  private ripples = 0;

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
    s.resetLand();
    return s;
  }

  static fromJSON(raw: string): SaveState | null {
    try {
      const data = JSON.parse(raw) as PersistedV2 | PersistedV1;
      if (!data || (data.v !== 1 && data.v !== 2)) return null;
      const s = new SaveState();
      s.sfx = data.sfx !== false;
      s.music = data.music === true;
      if (data.v === 1) {
        s.dew = 0;
        s.ranks = emptyRanks();
        s.world = 0;
        s.unlocked = 0;
        s.stats = emptyStats();
        s.achievements = [];
        s.best = [0, 0, 0, 0, 0];
      } else if (data.v === 2) {
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
      }
      s.screen = 'play';
      s.phase = 'play';
      s.resetLand();
      s.lastSave = Date.now();
      return s;
    } catch {
      return null;
    }
  }

  toJSON(): string {
    const data: PersistedV2 = {
      v: 2,
      dew: this.dew,
      ranks: this.ranks,
      world: this.world,
      unlocked: this.unlocked,
      best: this.best,
      stats: this.stats,
      achievements: this.achievements,
      sfx: this.sfx,
      music: this.music,
      lastSave: Date.now(),
    };
    this.lastSave = data.lastSave;
    return JSON.stringify(data);
  }

  maxLiters(): number {
    return maxLiters(this.ranks);
  }

  scale(): number {
    return cloudScale(this.ranks);
  }

  liters(): number {
    return this.tank * this.maxLiters();
  }

  reach(): number {
    return this.world === GLOBE_WORLD ? rainRadius(this.ranks) * 0.085 : rainRadius(this.ranks);
  }

  patch(): number {
    return patchFraction(this.ranks);
  }

  bottleTime(): number {
    return bottleSeconds(this.ranks);
  }

  dropEvery(): number {
    return 0.18 / (1 + this.ranks.specks * 0.55 + this.ranks.mist * 0.25);
  }

  tick(dt: number, mode: { raining: boolean; moving: boolean }): void {
    void mode.moving;
    if (this.phase !== 'play') return;
    this.stats.playSeconds += dt;
    if (abilityOn(this.ranks, 'lightning')) this.lightningCd = Math.max(0, this.lightningCd - dt);
    if (abilityOn(this.ranks, 'tornado')) this.tornadoCd = Math.max(0, this.tornadoCd - dt);
    if (abilityOn(this.ranks, 'sprinkler')) this.spinCd = Math.max(0, this.spinCd - dt);
    if (mode.raining && this.tank > 0) {
      const max = this.maxLiters();
      this.tank = Math.max(0, this.tank - (drainPerSec(this.ranks) / max) * dt);
      if (this.tank <= 0.001) {
        this.tank = 0;
        this.captureRunPeak();
        this.phase = 'dry';
        this.screen = 'results';
        this.noteBest();
        this.toast = 'The bottle is empty.';
      }
    }
    this.finishIfDone();
  }

  resetLand(): void {
    const { cols, rows } = maskOf(this.world);
    this.progress = new Float32Array(cols * rows);
    this.pixels = new Uint8Array(cols * rows * 4);
    this.filled = 0;
    this.maskDirty = true;
    this.ripples = 0;
    this.tiles[this.world] = makeTiles(this.world);
    this.green = this.tiles[this.world]?.map(() => false) ?? [];
    this.justGreen = [];
    this.tank = 1;
    this.phase = 'play';
    this.lightningCd = abilityOn(this.ranks, 'lightning') ? 6 : LIGHTNING_CD;
    this.tornadoCd = abilityOn(this.ranks, 'tornado') ? 10 : TORNADO_CD;
    this.spinCd = abilityOn(this.ranks, 'sprinkler') ? 4 : SPIN_CD;
  }

  retryRun(): void {
    this.runDew = 0;
    this.runTiles = 0;
    this.runReached = 0;
    this.screen = 'play';
    this.resetLand();
    this.toast = worldDef(this.world).name;
  }

  openWorkshop(): void {
    if (this.phase === 'play') return;
    this.screen = 'workshop';
  }

  openWorlds(): void {
    if (this.phase !== 'clear') return;
    this.screen = 'worlds';
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
    this.world = world;
    this.retryRun();
    return true;
  }

  buy(id: NodeId): boolean {
    if (this.screen !== 'workshop') return false;
    if (!prereqMet(id, this.ranks)) return false;
    const node = upgradeNode(id);
    const level = this.ranks[id];
    if (level >= node.max) return false;
    const cost = nodeCost(id, level);
    if (this.dew < cost) return false;
    this.dew -= cost;
    this.ranks[id] += 1;
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

  ratio(world = this.world): number {
    if (world !== this.world) return this.best[world] ?? 0;
    const count = this.progress.length;
    if (count === 0) return 0;
    const hp = cellHp(this.world);
    let sum = 0;
    for (let i = 0; i < count; i += 1) sum += Math.min(hp, this.progress[i] ?? 0);
    return sum / (count * hp);
  }

  isRestored(index: number, world = this.world): boolean {
    if (world !== this.world) return (this.best[world] ?? 0) >= 1;
    return this.green[index] === true;
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

  current(): TileState[] {
    return this.tiles[this.world] ?? [];
  }

  animalCount(): number {
    const ratio = this.ratio();
    if (ratio < 0.08) return 0;
    return Math.min(6, Math.floor(ratio * 10));
  }

  helperCount(): number {
    return Math.min(4, Math.floor(this.ranks.puff / 2));
  }

  boomboxIndexes(): number[] {
    return [];
  }

  trySpin(): boolean {
    if (!abilityOn(this.ranks, 'sprinkler') || this.spinCd > 0) return false;
    this.spinCd = SPIN_CD;
    return true;
  }

  startTornado(): boolean {
    if (!abilityOn(this.ranks, 'tornado') || this.tornadoCd > 0) return false;
    this.tornadoCd = TORNADO_CD;
    return true;
  }

  armLightning(): boolean {
    if (!abilityOn(this.ranks, 'lightning') || this.lightningCd > 0) return false;
    this.lightningCd = LIGHTNING_CD;
    return true;
  }

  pet(): number {
    this.stats.animals += 1;
    const dew = this.addDew(8 * worldDef(this.world).pay);
    this.toast = `+${formatDew(dew)} · a little heart`;
    this.claim();
    return dew;
  }

  snapshot(extra: { raining: boolean; sleepy: boolean; slosh: number; music: boolean; pond: number | null }): HudModel {
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
      music: extra.music,
      toast: this.toast,
      boost: false,
      pond: extra.pond,
      phase: this.phase,
      screen: this.phase === 'play' ? 'play' : this.screen,
      runDew: this.runDew,
      runTiles: this.runTiles,
      runReached: this.runReached,
      best: this.best[this.world] ?? 0,
      cleared: this.phase === 'clear',
      tree: buildTree(this.ranks, this.dew),
      worlds: [0, 1, 2, 3, 4].map((index) => ({
        index,
        name: worldDef(index).name,
        locked: index > this.unlocked,
        current: index === this.world,
        best: this.best[index] ?? 0,
      })),
      stats: { ...this.stats },
      achievements: ACHIEVEMENTS.map((a) => ({ ...a, done: this.achievements.includes(a.id) })),
    };
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
    for (let r = bounds.minR; r <= bounds.maxR && used < limit; r += 1) {
      for (let c = bounds.minC; c <= bounds.maxC && used < limit; c += 1) {
        const at = this.cellCenter(c, r, cols, rows);
        if (this.gap(x, z, at.x, at.z) > radius) continue;
        if (respectPatches && hash01(c, r) < gate) continue;
        const edge = 1 - this.gap(x, z, at.x, at.z) / Math.max(0.001, radius);
        if (respectPatches && this.ranks.specks >= 2 && hash01(c + 19, r + 3) > gate + edge * 0.28) continue;
        const index = r * cols + c;
        if ((this.progress[index] ?? 0) >= hp) continue;
        const was = this.progress[index] ?? 0;
        let crit = false;
        if (was <= 0 && Math.random() < critChance(this.ranks)) {
          this.progress[index] = hp;
          crit = true;
          crits += 1;
        } else {
          // Full soak on every speck in the disc. The rim hash already keeps early rain to a few cells, and a bottle has to finish those cells or the run banks nothing.
          this.progress[index] = Math.min(hp, was + amount);
        }
        const now = this.progress[index] ?? 0;
        if (now > was) {
          this.splashRipple(index);
          this.bleedMask(c, r, cols, rows, (now - was) * 0.14, hp, respectPatches, gate);
        }
        const done = now >= hp;
        const byte = done ? 255 : Math.min(254, Math.floor((now / hp) * 254));
        const pixel = index * 4;
        this.pixels[pixel] = byte;
        if (now > was && !done) {
          const pay = cellDew(this.world, this.ranks);
          const drip = pay * ((now - was) / hp) * 0.15;
          if (drip >= 0.01) {
            const gain = this.addDew(drip);
            dew += gain;
          }
        }
        if (done) {
          this.pixels[pixel + 1] = 255;
          this.ripples += 1;
          this.filled += 1;
          filled += 1;
          used += 1;
          const gain = this.addDew(cellDew(this.world, this.ranks) * (crit ? 3 : 1));
          dew += gain;
          this.stats.tiles += 1;
          this.runTiles += 1;
          hills.add(this.hillIndex(c, r, cols, rows));
        }
        this.maskDirty = true;
      }
    }
    for (const hill of hills) this.considerHill(hill);
    if (filled > 0) {
      this.claim();
      this.finishIfDone();
    }
    if (this.phase === 'play') this.captureRunPeak();
    return { dew, filled, crits };
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
      if (respectPatches && hash01(nc, nr) < gate) continue;
      const i = nr * cols + nc;
      const was = this.progress[i] ?? 0;
      if (was >= hp) continue;
      const cap = hp * 0.94;
      const next = Math.min(cap, was + amount);
      if (next <= was) continue;
      this.progress[i] = next;
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
    this.justGreen.push(index);
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

  private noteBest(): void {
    const ratio = Math.max(this.ratio(), this.runReached);
    if (ratio > (this.best[this.world] ?? 0)) this.best[this.world] = ratio;
  }

  private finishIfDone(): void {
    if (this.phase !== 'play') return;
    if (this.ratio() < 1) return;
    this.captureRunPeak();
    this.phase = 'clear';
    this.screen = 'results';
    this.noteBest();
    if (this.world < GLOBE_WORLD && this.unlocked < this.world + 1) this.unlocked = this.world + 1;
    this.toast = `${worldDef(this.world).name} is green again.`;
    this.claim();
  }

  private claim(): void {
    for (let guard = 0; guard < 16; guard += 1) {
      const next = ACHIEVEMENTS.find((a) => !this.achievements.includes(a.id) && this.meets(a.id));
      if (!next) break;
      this.achievements.push(next.id);
      if (next.reward > 0) this.addDew(next.reward);
      this.toast = `Achievement · ${next.name}`;
    }
  }

  private meets(id: string): boolean {
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
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return Math.floor(n).toLocaleString();
}

export function formatLiters(n: number): string {
  return `${Math.round(n).toLocaleString()}L`;
}
