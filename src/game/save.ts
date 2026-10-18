import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

const KEY = 'progress';

export async function readProgress(): Promise<string | null> {
  try {
    return await RundotGameAPI.appStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function writeProgress(value: string): Promise<void> {
  try {
    await RundotGameAPI.appStorage.setItem(KEY, value);
  } catch {
    /* Host storage can reject while offline. The next checkpoint retries. */
  }
}

export async function clearProgress(): Promise<void> {
  try {
    await RundotGameAPI.appStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
