import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutReturn, isSupporter, readSupporter, SUPPORTER_DAYS } from '../src/ui/supporter';

const DAY = 86_400_000;

test(`a confirmed tip counts for ${SUPPORTER_DAYS} days`, () => {
  const since = Date.UTC(2026, 10, 17);
  assert.equal(isSupporter(since, since), true);
  assert.equal(isSupporter(since, since + SUPPORTER_DAYS * DAY - 1), true);
  assert.equal(isSupporter(since, since + SUPPORTER_DAYS * DAY), false);
  assert.equal(isSupporter(since, since - DAY), false, 'a date in the future is not trusted');
  assert.equal(isSupporter(null, since), false);
});

test('only a stored timestamp reads as a supporter', () => {
  assert.equal(readSupporter({ since: 1_794_870_000_000 }), 1_794_870_000_000);
  for (const stored of [null, {}, { since: 'yesterday' }, { since: -1 }, { since: Number.NaN }, 5]) assert.equal(readSupporter(stored), null);
});

test('the return from Stripe is recognised and its parameters are dropped from the address', () => {
  const back = checkoutReturn(new URL('https://ocarinahero.app/?thanks&utm_content=prompt&utm_source=x#catalog'));
  assert.equal(back?.placement, 'prompt');
  assert.equal(back?.clean, '/#catalog');
  assert.equal(checkoutReturn(new URL('https://ocarinahero.app/song/a/?thanks&q=1'))?.clean, '/song/a/?q=1', 'other parameters stay');
  assert.equal(checkoutReturn(new URL('https://ocarinahero.app/?q=thanks')), null);
  assert.equal(checkoutReturn(new URL('https://ocarinahero.app/')), null);
});
