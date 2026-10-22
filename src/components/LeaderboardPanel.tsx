import { useCallback, useEffect, useState } from 'react';
import {
  fetchLeaderboardPage,
  fetchMyRank,
  LEADERBOARD_MODES,
  type LeaderboardEntryView,
  type LeaderboardModeId,
} from '../game/leaderboard';
import { leaderboardDisplayName } from '../game/leaderboardNames';

const MEDALS = ['🥇', '🥈', '🥉'] as const;

export function LeaderboardPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<LeaderboardModeId>('dew');
  const [entries, setEntries] = useState<LeaderboardEntryView[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next: LeaderboardModeId) => {
    setLoading(true);
    setError(null);
    const page = await fetchLeaderboardPage(next, 24);
    setEntries(page.entries);
    setTotal(page.totalEntries);
    if (page.error) setError(page.error);
    const rank = page.playerRank ?? (await fetchMyRank(next));
    setPlayerRank(rank);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load(mode);
  }, [open, mode, load]);

  if (!open) return null;

  return (
    <div className="lb-veil pointer-events-auto" role="dialog" aria-label="Leaderboards" onClick={onClose}>
      <div
        className="menu-card menu-card--pop lb-card text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lb-card__head">
          <div>
            <div className="menu-card__title lb-card__title">Rainkeepers</div>
            <p className="menu-card__sub lb-card__sub">Who’s growing the most life?</p>
          </div>
          <button type="button" className="lb-close pixel" aria-label="Close leaderboards" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="lb-tabs" role="tablist" aria-label="Leaderboard category">
          {LEADERBOARD_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`lb-tab pixel${mode === m.id ? ' lb-tab--on' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.short}
            </button>
          ))}
        </div>

        {playerRank != null && (
          <p className="lb-you pixel tabular-nums" aria-live="polite">
            Your rank · #{playerRank}
            {total > 0 ? ` of ${total}` : ''}
          </p>
        )}

        {loading && <p className="menu-card__sub lb-status">Gathering clouds…</p>}
        {error && !loading && entries.length === 0 && (
          <p className="menu-card__sub lb-status lb-status--warn">
            Rankings need RUN.app — play on device to see the board. ({error})
          </p>
        )}

        <ol className="lb-list" aria-busy={loading}>
          {entries.map((row) => (
            <li key={`${row.profileId}-${row.rank}`} className="lb-row pixel">
              <span className="lb-row__rank tabular-nums" aria-hidden>
                {row.rank <= 3 ? MEDALS[row.rank - 1] : `#${row.rank}`}
              </span>
              <span className="lb-row__name">{leaderboardDisplayName(row)}</span>
              <span className="lb-row__score tabular-nums">{row.displayScore}</span>
            </li>
          ))}
        </ol>

        {!loading && entries.length === 0 && !error && (
          <p className="menu-card__sub lb-status">No scores yet — be the first shower!</p>
        )}
      </div>
    </div>
  );
}

export function LeaderboardIcon() {
  return (
    <svg className="lb-icon-svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.2l1.4 3.1 3.4.5-2.4 2.3.6 3.4-3-1.6-3 1.6.6-3.4-2.4-2.3 3.4-.5L12 2.2Z"
        opacity="0.95"
      />
      <path
        fill="#7ee8ff"
        d="M8.5 14.2c.6 1.8 2 3 3.5 3s2.9-1.2 3.5-3c.3-.9-.2-1.4-1-.9-.8.6-1.4 1-2.5 1s-1.7-.4-2.5-1c-.8-.5-1.3 0-1 .9Z"
      />
      <path
        fill="currentColor"
        d="M6 17.2h12v2.2H6v-2.2Zm1.2 2.8h9.6l.5 1.4H6.7l.5-1.4Z"
        opacity="0.88"
      />
    </svg>
  );
}
