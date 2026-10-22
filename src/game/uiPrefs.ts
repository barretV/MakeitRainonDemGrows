import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

const KEY = 'ui.controls';

export type ControlPrefs = { dismissed: boolean; bottlesEnded: number };

const defaultPrefs = (): ControlPrefs => ({ dismissed: false, bottlesEnded: 0 });

export async function loadControlPrefs(): Promise<ControlPrefs> {
  try {
    const raw = await RundotGameAPI.deviceCache.getItem(KEY);
    if (!raw) return defaultPrefs();
    const p = JSON.parse(raw) as Partial<ControlPrefs>;
    return {
      dismissed: !!p.dismissed,
      bottlesEnded: typeof p.bottlesEnded === 'number' ? Math.max(0, p.bottlesEnded) : 0,
    };
  } catch {
    return defaultPrefs();
  }
}

async function saveControlPrefs(p: ControlPrefs): Promise<void> {
  try {
    await RundotGameAPI.deviceCache.setItem(KEY, JSON.stringify(p));
  } catch {
    /* offline / cache unavailable */
  }
}

/** Call once when a bottle ends (results screen). Auto-hides hints after 3 bottles on touch. */
export async function noteBottleEnded(): Promise<ControlPrefs> {
  const p = await loadControlPrefs();
  p.bottlesEnded += 1;
  if (p.bottlesEnded >= 3) p.dismissed = true;
  await saveControlPrefs(p);
  return p;
}

export async function dismissControlHints(): Promise<ControlPrefs> {
  const p = await loadControlPrefs();
  p.dismissed = true;
  await saveControlPrefs(p);
  return p;
}
