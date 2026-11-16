/** The part of `Storage` the app's persisted state uses. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's local storage, or null where the browser blocks it. */
function local(): StorageLike | null {
  try { return window.localStorage; } catch { return null; }
}

/**
 * One persisted JSON value. Each key's owner passes the parser that validates it; a missing value
 * reaches the parser as null, and an unreadable one (bad JSON, blocked storage) does too, flagged.
 */
export function readStored<T>(key: string, parse: (stored: unknown) => T, storage: StorageLike | null = local()): { value: T; readable: boolean } {
  try {
    if (!storage) throw new Error('Storage unavailable');
    return { value: parse(JSON.parse(storage.getItem(key) ?? 'null')), readable: true };
  } catch {
    return { value: parse(null), readable: false };
  }
}

/** Persist a value as JSON; false when storage is blocked or full, so the caller can say it lasts this session only. */
export function writeStored(key: string, value: unknown, storage: StorageLike | null = local()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
