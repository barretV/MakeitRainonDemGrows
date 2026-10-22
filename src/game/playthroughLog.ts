import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { worldDef } from './balance';
import type { RunLogEntry } from './state';
import { NODE_IDS, type Ranks } from './tree';

const STORAGE_KEY = 'makeitrain_playthrough_v1';

/** Balance ledger + `balance/playthrough-log.json` sync — dev only; stripped from production builds. */
const DEV_LEDGER = import.meta.env.DEV;

export type BottleEndReason = 'dry' | 'cleared';

/** One poured bottle plus wallet / upgrade context for balance tuning. */
export interface PlaythroughBottleRecord extends RunLogEntry {
  at: string;
  /** 1-based count across the whole campaign. */
  globalBottle: number;
  worldName: string;
  /** Peak revival % reached during this bottle. */
  peak: number;
  /** Island best after this bottle. */
  best: number;
  /** Dew wallet (whole drops) right after the bottle closes. */
  dewWallet: number;
  /** Total upgrade ranks owned after post-bottle shopping (snapshot at log time). */
  rankTotal: number;
  /** How many workshop purchases are attributed to this gap (see `buys`). */
  upgradeBuys: number;
  reason: BottleEndReason;
  unlocked: number;
  /** Full rank snapshot for diffing between bottles. */
  ranks: Partial<Ranks>;
}

export interface PlaythroughMilestone {
  at: string;
  kind: 'session_start' | 'world_cleared' | 'world_unlocked' | 'reset';
  world?: number;
  detail?: string;
}

export interface PlaythroughWorldSummary {
  bottles: number;
  dewEarned: number;
  cells: number;
  upgradePurchases: number;
  cleared: boolean;
}

export interface PlaythroughLogFile {
  version: 1;
  note: string;
  startedAt: string | null;
  updatedAt: string | null;
  bottles: PlaythroughBottleRecord[];
  milestones: PlaythroughMilestone[];
  summary: {
    totalBottles: number;
    byWorld: Record<string, PlaythroughWorldSummary>;
  };
}

let memory: PlaythroughLogFile | null = null;

function emptyLog(): PlaythroughLogFile {
  return {
    version: 1,
    note: 'Live play ledger for balance tuning. In dev, also mirrored to balance/playthrough-log.json.',
    startedAt: null,
    updatedAt: null,
    bottles: [],
    milestones: [],
    summary: { totalBottles: 0, byWorld: {} },
  };
}

function parseLog(raw: string): PlaythroughLogFile | null {
  try {
    const data = JSON.parse(raw) as PlaythroughLogFile;
    if (!data || data.version !== 1 || !Array.isArray(data.bottles)) return null;
    data.milestones = Array.isArray(data.milestones) ? data.milestones : [];
    recomputeSummary(data);
    return data;
  } catch {
    return null;
  }
}

function rankTotal(ranks: Ranks): number {
  return NODE_IDS.reduce((sum, id) => sum + ranks[id], 0);
}

function rankSnapshot(ranks: Ranks): Partial<Ranks> {
  const out: Partial<Ranks> = {};
  for (const id of NODE_IDS) out[id] = ranks[id];
  return out;
}

function recomputeSummary(log: PlaythroughLogFile): void {
  const byWorld: Record<string, PlaythroughWorldSummary> = {};
  for (const b of log.bottles) {
    const key = String(b.world);
    const row = byWorld[key] ?? {
      bottles: 0,
      dewEarned: 0,
      cells: 0,
      upgradePurchases: 0,
      cleared: false,
    };
    row.bottles += 1;
    row.dewEarned += b.dew;
    row.cells += b.cells;
    row.upgradePurchases += b.upgradeBuys;
    if (b.reason === 'cleared') row.cleared = true;
    byWorld[key] = row;
  }
  log.summary = { totalBottles: log.bottles.length, byWorld };
}

/** Load from RUN storage once per session (call from game boot). Dev only. */
export async function hydratePlaythroughLog(): Promise<PlaythroughLogFile> {
  if (!DEV_LEDGER) {
    memory = emptyLog();
    return memory;
  }
  if (memory) return memory;
  let loaded: PlaythroughLogFile | null = null;
  try {
    const raw = await RundotGameAPI.appStorage.getItem(STORAGE_KEY);
    if (raw) loaded = parseLog(raw);
  } catch {
    /* ignore */
  }
  if (!loaded) {
    try {
      const raw = await RundotGameAPI.deviceCache.getItem(STORAGE_KEY);
      if (raw) loaded = parseLog(raw);
    } catch {
      /* ignore */
    }
  }
  memory = loaded ?? emptyLog();
  return memory;
}

export function loadPlaythroughLog(): PlaythroughLogFile {
  if (!DEV_LEDGER) return emptyLog();
  return memory ?? emptyLog();
}

async function persistPlaythroughLog(log: PlaythroughLogFile): Promise<void> {
  if (!DEV_LEDGER) return;
  log.updatedAt = new Date().toISOString();
  recomputeSummary(log);
  memory = log;
  const raw = JSON.stringify(log, null, 2);
  try {
    await RundotGameAPI.deviceCache.setItem(STORAGE_KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    await RundotGameAPI.appStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    await fetch('/__playbook-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch {
    /* dev server not running */
  }
}

export function clearPlaythroughLog(reason = 'progress reset'): PlaythroughLogFile {
  if (!DEV_LEDGER) return emptyLog();
  const log = emptyLog();
  log.startedAt = new Date().toISOString();
  log.milestones.push({ at: log.startedAt, kind: 'reset', detail: reason });
  memory = log;
  void persistPlaythroughLog(log);
  return log;
}

export function recordPlaythroughMilestone(
  kind: PlaythroughMilestone['kind'],
  world?: number,
  detail?: string,
): void {
  if (!DEV_LEDGER) return;
  const log = loadPlaythroughLog();
  if (!log.startedAt) log.startedAt = new Date().toISOString();
  log.milestones.push({ at: new Date().toISOString(), kind, world, detail });
  void persistPlaythroughLog(log);
}

export function recordPlaythroughBottle(
  base: RunLogEntry,
  extra: {
    peak: number;
    best: number;
    dewWallet: number;
    ranks: Ranks;
    unlocked: number;
    reason: BottleEndReason;
  },
): PlaythroughLogFile {
  if (!DEV_LEDGER) return emptyLog();
  const log = loadPlaythroughLog();
  if (!log.startedAt) {
    log.startedAt = new Date().toISOString();
    log.milestones.push({ at: log.startedAt, kind: 'session_start' });
  }
  const record: PlaythroughBottleRecord = {
    ...base,
    at: new Date().toISOString(),
    globalBottle: log.bottles.length + 1,
    worldName: worldDef(base.world).name,
    peak: Math.round(extra.peak * 1000) / 1000,
    best: Math.round(extra.best * 1000) / 1000,
    dewWallet: extra.dewWallet,
    rankTotal: rankTotal(extra.ranks),
    upgradeBuys: base.buys.length,
    reason: extra.reason,
    unlocked: extra.unlocked,
    ranks: rankSnapshot(extra.ranks),
  };
  log.bottles.push(record);
  void persistPlaythroughLog(log);
  return log;
}

/** Trigger a JSON download (works on RUN and local). */
export function downloadPlaythroughLog(log: PlaythroughLogFile): void {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `playthrough-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
