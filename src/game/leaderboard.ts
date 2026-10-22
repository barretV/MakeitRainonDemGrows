import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import type { SaveState } from './state';
import { formatDew } from './state';

export type LeaderboardModeId = 'dew' | 'blooms' | 'tiles' | 'skytime' | 'islands';

export const LEADERBOARD_MODES: {
  id: LeaderboardModeId;
  label: string;
  short: string;
}[] = [
  { id: 'dew', label: 'Dew collected', short: 'Dew' },
  { id: 'blooms', label: 'Blooms earned', short: 'Blooms' },
  { id: 'tiles', label: 'Patches restored', short: 'Land' },
  { id: 'skytime', label: 'Time in the rain', short: 'Sky time' },
  { id: 'islands', label: 'Islands unlocked', short: 'Islands' },
];

export type LeaderboardEntryView = {
  rank: number;
  profileId: string;
  username: string;
  score: number;
  displayScore: string;
};

export type LeaderboardPage = {
  entries: LeaderboardEntryView[];
  playerRank: number | null;
  totalEntries: number;
  error?: string;
};

const SUBMIT_COOLDOWN_MS = 75_000;
let lastSubmitAt = 0;
const lastScores: Partial<Record<LeaderboardModeId, number>> = {};

function scoreForMode(state: SaveState, mode: LeaderboardModeId): number {
  switch (mode) {
    case 'dew':
      return Math.max(0, Math.floor(state.stats.dewEarned));
    case 'blooms':
      return Math.max(0, Math.floor(state.blooms));
    case 'tiles':
      return Math.max(0, Math.floor(state.stats.tiles));
    case 'skytime':
      return Math.max(1, Math.floor(state.stats.playSeconds));
    case 'islands':
      return Math.max(1, state.unlocked + 1);
    default:
      return 0;
  }
}

function formatScore(mode: LeaderboardModeId, score: number): string {
  switch (mode) {
    case 'dew':
      return formatDew(score);
    case 'blooms':
      return `${score} bloom${score === 1 ? '' : 's'}`;
    case 'tiles':
      return `${score} patch${score === 1 ? '' : 'es'}`;
    case 'skytime': {
      const m = Math.floor(score / 60);
      const s = Math.floor(score % 60);
      if (m < 60) return m > 0 ? `${m}m ${s}s` : `${s}s`;
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m`;
    }
    case 'islands':
      return `${score} island${score === 1 ? '' : 's'}`;
    default:
      return String(score);
  }
}

/** Push keep-best scores when progress meaningfully changes (respects server rate limits). */
export function syncLeaderboardScores(state: SaveState): void {
  const now = Date.now();
  const duration = Math.max(1, Math.min(864000, Math.floor(state.stats.playSeconds)));
  let dirty = now - lastSubmitAt >= SUBMIT_COOLDOWN_MS;

  if (!dirty) {
    for (const { id } of LEADERBOARD_MODES) {
      const next = scoreForMode(state, id);
      const prev = lastScores[id];
      if (prev === undefined || next > prev) {
        dirty = true;
        break;
      }
    }
  }
  if (!dirty) return;

  lastSubmitAt = now;
  void (async () => {
    for (const { id } of LEADERBOARD_MODES) {
      const score = scoreForMode(state, id);
      if (score <= 0 && id !== 'skytime' && id !== 'islands') continue;
      try {
        const result = await RundotGameAPI.leaderboard.submitScore({
          score,
          duration,
          mode: id,
          metadata: { v: 1 },
        });
        if (result.accepted) lastScores[id] = score;
      } catch {
        /* offline / playground without leaderboards */
      }
    }
  })();
}

export async function fetchLeaderboardPage(
  mode: LeaderboardModeId,
  limit = 20,
): Promise<LeaderboardPage> {
  try {
    const page = await RundotGameAPI.leaderboard.getPagedScores({ mode, limit, period: 'alltime' });
    const entries: LeaderboardEntryView[] = page.entries
      .filter((e) => e.rank != null && !e.isShadowBanned)
      .map((e) => ({
        rank: e.rank as number,
        profileId: e.profileId,
        username: e.username,
        score: e.score,
        displayScore: formatScore(mode, e.score),
      }));
    return {
      entries,
      playerRank: page.playerRank,
      totalEntries: page.totalEntries,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load rankings';
    return { entries: [], playerRank: null, totalEntries: 0, error: message };
  }
}

export async function fetchMyRank(mode: LeaderboardModeId): Promise<number | null> {
  try {
    const me = await RundotGameAPI.leaderboard.getMyRank({ mode, period: 'alltime' });
    return me.rank;
  } catch {
    return null;
  }
}
