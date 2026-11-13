import { KEY_BINDINGS_STORAGE } from './keyboard';
import { PREFERENCES_STORAGE } from './preferences';
import { PROGRESS_STORAGE } from './progress';
import { THEME_STORAGE } from './theme';

export const SAVED_STORAGE = 'ocarina.saved.v1';

/** Every key the app writes to browser storage; "Clear local data" removes exactly these. */
export const LOCAL_DATA_KEYS = [SAVED_STORAGE, PROGRESS_STORAGE, KEY_BINDINGS_STORAGE, PREFERENCES_STORAGE, THEME_STORAGE] as const;

const EXPORT_APP = 'ocarina-hero';

export function savedExport(ids: readonly string[]): string {
  return JSON.stringify({ app: EXPORT_APP, version: 1, saved: ids }, null, 2);
}

/** Song ids from an export file, limited to songs this catalogue knows; throws on a file that is not an export. */
export function parseSavedExport(text: string, knownIds: ReadonlySet<string>): string[] {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || (value as { app?: unknown }).app !== EXPORT_APP) throw new Error('Not an Ocarina Hero export');
  const saved = (value as { saved?: unknown }).saved;
  if (!Array.isArray(saved)) throw new Error('Not an Ocarina Hero export');
  return [...new Set(saved.filter((id): id is string => typeof id === 'string' && knownIds.has(id)))];
}
