/**
 * Showpiece landmarks. They stay buried until the ground under them
 * is actually watered, then come up in layers: a glimmer, the ruin,
 * the missing pieces, the color, and a celebration when that patch is whole.
 * `unlockPct` is only a hint for which one tends to be found first.
 */

export type LandmarkKind = 'billboard' | 'ribbon' | 'disc' | 'group';

export type LandmarkArt =
  | 'stream'
  | 'oak'
  | 'mill'
  | 'lake'
  | 'aurora'
  | 'igloo'
  | 'icefall'
  | 'bears'
  | 'dunes'
  | 'gate'
  | 'oasis'
  | 'tents'
  | 'mesa'
  | 'sundial'
  | 'barrels'
  | 'reactor'
  | 'pipes'
  | 'shrooms'
  | 'cascade'
  | 'moths'
  | 'peaks'
  | 'reef'
  | 'lantern'
  | 'bridge'
  | 'cairns'
  | 'lights'
  | 'worldtree';

export interface LandmarkDef {
  id: string;
  title: string;
  unlockPct: number;
  /** 0–1 across the island, or longitude on the globe. */
  u: number;
  /** 0–1 across the island, or latitude on the globe. */
  v: number;
  /** Extra size on top of the world's scale. */
  scale: number;
  kind: LandmarkKind;
  art: LandmarkArt;
  /** Multiply color while the landmark is still a ruin. */
  ruin: string;
  /** Multiply color once it has awakened. Usually white so the painting shows. */
  live: string;
}

/**
 * Bigger islands get bigger props. The globe stays closer to 1: the shell
 * is only a few units across, so grandeur there comes from the larger
 * planet, the cloud sitting farther out, and the Worldheart itself.
 */
export const LANDMARK_WORLD_SCALE: readonly number[] = [1, 1.3, 1.42, 1.52, 1.12];

const forest = '#6e675f';
const frost = '#8ea0b0';
const sand = '#a89878';
const sludge = '#6d7358';
const orbit = '#7d8aa4';
const full = '#ffffff';

/** The light a landmark carries. Brighter than the sun on the trees around it. */
const LAMPS: Record<string, string> = {
  [forest]: '#ffd27a',
  [frost]: '#9aefff',
  [sand]: '#ffb15a',
  [sludge]: '#c6ff6a',
  [orbit]: '#ffe39a',
};

export function landmarkLamp(ruin: string): string {
  return LAMPS[ruin] ?? '#ffe7a0';
}

export const LANDMARKS_BY_WORLD: readonly (readonly LandmarkDef[])[] = [
  [
    { id: 'mossbrook', title: 'Mossbrook', unlockPct: 25, u: 0.4, v: 0.62, scale: 1.08, kind: 'ribbon', art: 'stream', ruin: forest, live: full },
    { id: 'hollowheart', title: 'Hollowheart Oak', unlockPct: 50, u: 0.62, v: 0.4, scale: 1.12, kind: 'billboard', art: 'oak', ruin: forest, live: full },
    { id: 'windbreak', title: 'Windbreak Mill', unlockPct: 100, u: 0.44, v: 0.34, scale: 1.16, kind: 'group', art: 'mill', ruin: forest, live: full },
  ],
  [
    { id: 'glassmere', title: 'Glassmere', unlockPct: 10, u: 0.36, v: 0.58, scale: 1.12, kind: 'disc', art: 'lake', ruin: frost, live: full },
    { id: 'aurora', title: 'Aurora Arch', unlockPct: 25, u: 0.58, v: 0.34, scale: 1.18, kind: 'billboard', art: 'aurora', ruin: frost, live: full },
    { id: 'snowhearth', title: 'Snowhearth', unlockPct: 50, u: 0.48, v: 0.68, scale: 1.05, kind: 'group', art: 'igloo', ruin: frost, live: full },
    { id: 'permafrost', title: 'Permafrost Falls', unlockPct: 75, u: 0.68, v: 0.46, scale: 1.1, kind: 'billboard', art: 'icefall', ruin: frost, live: full },
    { id: 'floe', title: 'Floe Watch', unlockPct: 100, u: 0.32, v: 0.4, scale: 1.16, kind: 'group', art: 'bears', ruin: frost, live: full },
  ],
  [
    { id: 'dunes', title: 'Dune Spine', unlockPct: 10, u: 0.34, v: 0.62, scale: 1.22, kind: 'billboard', art: 'dunes', ruin: sand, live: full },
    { id: 'sunflame', title: 'Sunflame Gate', unlockPct: 25, u: 0.64, v: 0.4, scale: 1.14, kind: 'group', art: 'gate', ruin: sand, live: full },
    { id: 'mirage', title: 'Mirage Well', unlockPct: 50, u: 0.48, v: 0.54, scale: 1.1, kind: 'group', art: 'oasis', ruin: sand, live: full },
    { id: 'caravan', title: "Caravan's Rest", unlockPct: 75, u: 0.38, v: 0.36, scale: 1.05, kind: 'group', art: 'tents', ruin: sand, live: full },
    { id: 'mesa', title: 'Crystal Mesa', unlockPct: 90, u: 0.7, v: 0.58, scale: 1.18, kind: 'billboard', art: 'mesa', ruin: sand, live: full },
    { id: 'sundial', title: 'Brass Sundial', unlockPct: 100, u: 0.54, v: 0.3, scale: 1.12, kind: 'disc', art: 'sundial', ruin: sand, live: full },
  ],
  [
    { id: 'barrels', title: 'Barrel Bloom Row', unlockPct: 10, u: 0.36, v: 0.58, scale: 1.06, kind: 'group', art: 'barrels', ruin: sludge, live: full },
    { id: 'reactor', title: 'Reactor Garden', unlockPct: 25, u: 0.58, v: 0.4, scale: 1.18, kind: 'billboard', art: 'reactor', ruin: sludge, live: full },
    { id: 'pipes', title: 'Pipe Cathedral', unlockPct: 50, u: 0.46, v: 0.68, scale: 1.14, kind: 'billboard', art: 'pipes', ruin: sludge, live: full },
    { id: 'mycelium', title: 'Mycelium Ring', unlockPct: 75, u: 0.66, v: 0.56, scale: 1.1, kind: 'group', art: 'shrooms', ruin: sludge, live: full },
    { id: 'purifier', title: 'Purifier Falls', unlockPct: 90, u: 0.32, v: 0.4, scale: 1.12, kind: 'billboard', art: 'cascade', ruin: sludge, live: full },
    { id: 'moths', title: 'Moth Chimney', unlockPct: 100, u: 0.52, v: 0.32, scale: 1.16, kind: 'group', art: 'moths', ruin: sludge, live: full },
  ],
  [
    { id: 'fault', title: 'Emerald Fault', unlockPct: 10, u: 0.06, v: 0.62, scale: 1.2, kind: 'group', art: 'peaks', ruin: orbit, live: full },
    { id: 'reef', title: 'Reef Belt', unlockPct: 25, u: 0.18, v: 0.4, scale: 1.16, kind: 'disc', art: 'reef', ruin: orbit, live: full },
    { id: 'lantern', title: 'Storm Lantern', unlockPct: 40, u: 0.3, v: 0.7, scale: 1.22, kind: 'group', art: 'lantern', ruin: orbit, live: full },
    { id: 'bridge', title: 'Atmos Bridge', unlockPct: 55, u: 0.46, v: 0.5, scale: 1.28, kind: 'group', art: 'bridge', ruin: orbit, live: full },
    { id: 'cairns', title: 'Memory Cairns', unlockPct: 70, u: 0.62, v: 0.36, scale: 1.2, kind: 'group', art: 'cairns', ruin: orbit, live: full },
    { id: 'coast', title: 'Coastline Lights', unlockPct: 85, u: 0.76, v: 0.58, scale: 1.18, kind: 'group', art: 'lights', ruin: orbit, live: full },
    { id: 'worldheart', title: 'Worldheart Tree', unlockPct: 100, u: 0.9, v: 0.66, scale: 1.32, kind: 'billboard', art: 'worldtree', ruin: orbit, live: full },
  ],
];

/** Local wetness where a buried landmark first breaks the surface. */
export const LANDMARK_BURIED = 0.14;
/** Second layer: the missing pieces pop in. */
export const LANDMARK_FORM = 0.45;
/** Third layer: color returns. */
export const LANDMARK_BLOOM = 0.72;
/** The patch under the landmark is restored. This is the celebration. */
export const LANDMARK_DONE = 0.9;

export function landmarksForWorld(world: number): readonly LandmarkDef[] {
  return LANDMARKS_BY_WORLD[world] ?? [];
}

/** 0 buried, 1 rising ruin, 2 pieces, 3 color, 4 fully restored. */
export function landmarkStage(wet: number): number {
  if (wet < LANDMARK_BURIED) return 0;
  if (wet < LANDMARK_FORM) return 1;
  if (wet < LANDMARK_BLOOM) return 2;
  if (wet < LANDMARK_DONE) return 3;
  return 4;
}

/**
 * The landmark the player is uncovering right now: the wettest patch that
 * has started and is not finished. Distant buried ones stay a secret.
 */
export function risingLandmarkTitle(
  world: number,
  pixels: Uint8Array,
  cols: number,
  rows: number,
): string | null {
  let best: { title: string; wet: number } | null = null;
  for (const mark of landmarksForWorld(world)) {
    const wet = landmarkLocalWet(pixels, cols, rows, mark.u, mark.v);
    if (wet < 0.06 || wet >= LANDMARK_DONE) continue;
    if (!best || wet > best.wet) best = { title: mark.title, wet };
  }
  return best?.title ?? null;
}

/** Mean mask wetness around a landmark, so rain nearby starts to warm the ruin. */
export function landmarkLocalWet(
  pixels: Uint8Array,
  cols: number,
  rows: number,
  u: number,
  v: number,
): number {
  if (cols < 1 || rows < 1 || pixels.length < 4) return 0;
  const cx = Math.min(cols - 1, Math.max(0, Math.floor(u * cols)));
  const cy = Math.min(rows - 1, Math.max(0, Math.floor(v * rows)));
  const rad = Math.max(4, Math.round(Math.min(cols, rows) * 0.06));
  let sum = 0;
  let n = 0;
  for (let y = cy - rad; y <= cy + rad; y += 1) {
    if (y < 0 || y >= rows) continue;
    for (let x = cx - rad; x <= cx + rad; x += 1) {
      if (x < 0 || x >= cols) continue;
      const i = (y * cols + x) * 4;
      if (i >= pixels.length) continue;
      sum += (pixels[i] ?? 0) / 255;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}
