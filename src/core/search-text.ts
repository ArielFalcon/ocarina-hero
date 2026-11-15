/** Lowercase, accent-free, single-spaced text: the form searches are compared and stored in. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export const MISSED_SEARCH_MIN_LENGTH = 3;
export const MISSED_SEARCH_MAX_LENGTH = 60;
const SETTLE_MS = 1500;

/**
 * Reports a search that found nothing, once the player stops typing and once per text, so
 * "zel", "zeld" and "zelda" never count as three searches. Call it after every render of the results.
 */
export function missedSearchNoter(send: (query: string) => void, settleMs = SETTLE_MS): (query: string, foundNothing: boolean) => void {
  const sent = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (query, foundNothing) => {
    clearTimeout(timer);
    const text = normalizeSearch(query);
    if (!foundNothing || text.length < MISSED_SEARCH_MIN_LENGTH || text.length > MISSED_SEARCH_MAX_LENGTH || sent.has(text)) return;
    timer = setTimeout(() => { sent.add(text); send(text); }, settleMs);
  };
}

/** True when `a` becomes `b` with one inserted, deleted, replaced or swapped-neighbour letter (equal texts too). */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  const [rest, other] = [a.slice(i), b.slice(i)];
  return rest.slice(1) === other.slice(1) // replaced letter
    || rest.slice(1) === other // letter missing from b
    || rest === other.slice(1) // extra letter in b
    || (rest[0] === other[1] && rest[1] === other[0] && rest.slice(2) === other.slice(2)); // swapped neighbours
}

/** Shortest search word that may be spelled loosely: shorter ones would match unrelated titles. */
export const LOOSE_WORD_MIN_LENGTH = 5;

/**
 * Whether every search word is in `searchable` (already normalized): as plain text, or, for long
 * enough words, ignoring the spaces between title words ("dragonball" finds "Dragon Ball Z").
 * With `typos`, a long word may also be one letter off a whole word ("zelsa" finds "Zelda").
 */
export function matchesSearch(searchable: string, words: readonly string[], typos = false): boolean {
  const compact = searchable.replace(/ /g, '');
  const tokens = typos ? searchable.split(' ') : [];
  return words.every((word) => {
    if (searchable.includes(word)) return true;
    if (word.length < LOOSE_WORD_MIN_LENGTH) return false;
    return compact.includes(word) || tokens.some((token) => withinOneEdit(word, token));
  });
}
