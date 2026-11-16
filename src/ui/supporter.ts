/**
 * A visitor who came back from a completed Stripe checkout: the support visuals thank them and the tip card stops
 * asking for `SUPPORTER_DAYS`. Only that return counts; pressing a tip button proves nothing.
 */
export const SUPPORTER_STORAGE = 'ocarina.supporter.v1';
export const SUPPORTER_DAYS = 365;

const DAY_MS = 86_400_000;
/** Set by the Payment Links' redirect after a completed payment. */
const RETURN_PARAM = 'thanks';

/** When the visitor's tip was confirmed, or null. */
export function readSupporter(stored: unknown): number | null {
  const since = (stored as { since?: unknown } | null)?.since;
  return typeof since === 'number' && Number.isFinite(since) && since >= 0 ? since : null;
}

export function isSupporter(since: number | null, now: number): boolean {
  return since !== null && now >= since && now - since < SUPPORTER_DAYS * DAY_MS;
}

/**
 * The visit that ends a Stripe checkout, with the tip button it started from (the `utm_content` the link carried)
 * and the address without the checkout's parameters; null for any other visit.
 */
export function checkoutReturn(url: URL): { placement: string | null; clean: string } | null {
  if (!url.searchParams.has(RETURN_PARAM)) return null;
  const placement = url.searchParams.get('utm_content');
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) if (key === RETURN_PARAM || key.startsWith('utm_')) params.delete(key);
  const query = params.toString();
  return { placement, clean: `${url.pathname}${query ? `?${query}` : ''}${url.hash}` };
}
