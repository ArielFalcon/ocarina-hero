/** The twelve songs Ocarina of Time teaches, in the order the adventure presents them. */
export const GAME_SONG_IDS: readonly string[] = [
  'lullaby-trigger',
  'catalogue-oot-eponas-song',
  'catalogue-oot-sarias-song',
  'catalogue-oot-suns-song',
  'catalogue-oot-song-of-time',
  'catalogue-oot-song-of-storms',
  'catalogue-oot-minuet-of-forest',
  'catalogue-oot-bolero-of-fire',
  'catalogue-oot-serenade-of-water',
  'catalogue-oot-requiem-of-spirit',
  'catalogue-oot-nocturne-of-shadow',
  'catalogue-oot-prelude-of-light',
];

interface Song { readonly id: string; readonly difficulty: { readonly level: string } }

export function gameSongs<T extends { readonly id: string }>(entries: readonly T[]): T[] {
  return GAME_SONG_IDS.flatMap(id => entries.find(entry => entry.id === id) ?? []);
}

/**
 * The song to suggest after finishing one: the next not yet completed song of its collection,
 * wrapping around. In-game songs form one collection; every other song belongs to its difficulty tier.
 */
export function nextSong<T extends Song>(entries: readonly T[], currentId: string, completed: ReadonlySet<string>): T | null {
  const current = entries.find(entry => entry.id === currentId);
  if (!current) return null;
  const collection = GAME_SONG_IDS.includes(currentId)
    ? gameSongs(entries)
    : entries.filter(entry => entry.difficulty.level === current.difficulty.level);
  const position = collection.indexOf(current);
  const following = [...collection.slice(position + 1), ...collection.slice(0, position)];
  return following.find(entry => !completed.has(entry.id)) ?? null;
}
