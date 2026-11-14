// Offline snapshot cache — the last successful fetch per surface, stored in
// AsyncStorage. The API stays the source of truth; this is a stale-read
// fallback so the feed and watchlist still render when the network is down.
// Envelopes carry `at` so the UI can label the snapshot's age honestly.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'bargain.cache.';

export interface CacheEnvelope<T> {
  at: number;
  data: T;
}

export async function cacheWrite<T>(key: string, data: T): Promise<void> {
  await AsyncStorage.setItem(
    PREFIX + key,
    JSON.stringify({ at: Date.now(), data } satisfies CacheEnvelope<T>),
  ).catch(() => {});
}

export async function cacheRead<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    return env && typeof env.at === 'number' ? env : null;
  } catch {
    return null;
  }
}

/** Drop cached surfaces (e.g. user-scoped keys on sign-out). No prefix = all. */
export async function cacheClear(prefix?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const hit = keys.filter((k) => k.startsWith(PREFIX + (prefix ?? '')));
    if (hit.length) await AsyncStorage.multiRemove(hit);
  } catch {
    /* non-fatal */
  }
}

/** "5m ago" — honest age label for a stale snapshot. */
export function staleLabel(at: number): string {
  const s = Math.max(1, Math.floor((Date.now() - at) / 1000));
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
