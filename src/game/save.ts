import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

const KEY = 'progress';

export async function readProgress(): Promise<string | null> {
  try {
    return await RundotGameAPI.appStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function writeProgress(value: string): Promise<boolean> {
  try {
    await RundotGameAPI.appStorage.setItem(KEY, value);
    return true;
  } catch {
    /* Host storage can reject while offline. The next checkpoint retries. */
    return false;
  }
}

export async function clearProgress(): Promise<void> {
  try {
    await RundotGameAPI.appStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    await RundotGameAPI.deviceCache.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Wipe cloud save and replace with a fresh campaign (reset must call this, not only removeItem). */
export async function replaceProgress(value: string): Promise<boolean> {
  await clearProgress();
  return writeProgress(value);
}
