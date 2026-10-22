/** RUN leaderboard row — only fields we need for display. */
export interface LeaderboardRow {
  profileId: string;
  username: string;
}

const ANONYMOUS_RE = /anonymous/i;

const PREFIXES = [
  'Drizzle',
  'Moss',
  'Nimbus',
  'Dewdrop',
  'Sprout',
  'Puddle',
  'Fern',
  'Mist',
  'Cloud',
  'Petrichor',
] as const;

const SUFFIXES = [
  'Scout',
  'Keeper',
  'Walker',
  'Gardener',
  'Puff',
  'Wanderer',
  'Friend',
  'Shower',
  'Sprite',
  'Bottle',
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function anonymousTag(username: string, profileId: string): string {
  const tail = username.includes('_') ? username.split('_').pop() ?? '' : '';
  const fromTail = tail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
  if (fromTail.length >= 2) return fromTail.toLowerCase();
  return profileId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase() || 'rain';
}

/** Friendly cloud-garden name when the platform username is anonymous. */
export function leaderboardDisplayName(entry: LeaderboardRow): string {
  const raw = entry.username?.trim() ?? '';
  if (raw && !ANONYMOUS_RE.test(raw)) return raw;

  const h = hashId(entry.profileId);
  const name = `${PREFIXES[h % PREFIXES.length]} ${SUFFIXES[(h >> 4) % SUFFIXES.length]}`;
  const tag = anonymousTag(raw || `Anonymous_${entry.profileId}`, entry.profileId);
  return `${name} · ${tag}`;
}
