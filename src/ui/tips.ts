import type { StaticArt } from './platforms';

/**
 * The tip amounts, each a Stripe Payment Link in euros with its rupee. The links redirect to `/?thanks` after a
 * completed payment (see supporter.ts); the button a tip started from travels as `utm_content`.
 */
export interface Tip { readonly euros: number; readonly art: StaticArt; readonly url: string }

export const TIPS: readonly Tip[] = [
  { euros: 3, art: 'rupeeGreen', url: 'https://buy.stripe.com/28E3cp3FwdmC9pNe042kw03' },
  { euros: 5, art: 'rupeeBlue', url: 'https://buy.stripe.com/3cIbIV1xobeufOb9JO2kw04' },
  { euros: 10, art: 'rupeeRed', url: 'https://buy.stripe.com/14A4gt1xo3M21XlbRW2kw05' },
];

/** Where the tip card was opened from: the header button, or the session prompt. */
export type TipPlacement = 'header' | 'prompt';

export function tipUrl(tip: Tip, placement: TipPlacement): string {
  return `${tip.url}?utm_content=${placement}`;
}
