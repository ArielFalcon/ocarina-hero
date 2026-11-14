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
