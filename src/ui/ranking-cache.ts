/**
 * A list fetched at most once per `maxAge`, unless forced. A failed fetch keeps the last good list (or none) until `maxAge`;
 * a forced fetch that fails also rejects, so its caller can report it.
 */
export function createRankingCache<T>(fetchList: () => Promise<T[]>, maxAge: number) {
  let latest: { at: number; list: T[] } | null = null;
  return async ({ force = false, now = Date.now() }: { force?: boolean; now?: number } = {}): Promise<T[]> => {
    if (!force && latest && now - latest.at < maxAge) return latest.list;
    try {
      latest = { at: now, list: await fetchList() };
    } catch (error) {
      latest = { at: now, list: latest?.list ?? [] };
      if (force) throw error;
    }
    return latest.list;
  };
}
