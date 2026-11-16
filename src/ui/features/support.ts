import { BROWSE_POINTS, createListenClock, createSupportMeter, LISTEN_POINTS, readSupportSession, SUPPORT_SESSION_STORAGE, type ListenSource } from '../support-meter';
import { checkoutReturn, isSupporter, readSupporter, SUPPORTER_STORAGE } from '../supporter';
import { TIPS, tipUrl, type TipPlacement } from '../tips';
import { readStored, sessionStore, writeStored } from '../storage';
import { must } from './dom';

const session = sessionStore() ?? null;

const card = must('#support-card');
const backdrop = must('#support-backdrop');
const ask = must('#support-card .support-ask');
const thanks = must('#support-card .support-thanks');
const status = must('#support-status');
const button = must<HTMLButtonElement>('#support-button');
const threadHeart = must('#support-button .support-thread-heart');
const artHeart = must('#support-button .support-art-heart');
const label = must('#support-button .support-label');

let supporterSince = readStored(SUPPORTER_STORAGE, readSupporter).value;
const supporter = () => isSupporter(supporterSince, Date.now());

const meter = createSupportMeter({
  load: () => readStored(SUPPORT_SESSION_STORAGE, readSupportSession, session).value,
  save: next => { writeStored(SUPPORT_SESSION_STORAGE, next, session); },
  random: Math.random,
  suppressed: supporter,
  ask: () => open('prompt', false),
});

const listens = createListenClock({
  now: () => performance.now(),
  setTimer: (run, ms) => window.setTimeout(run, ms),
  clearTimer: id => window.clearTimeout(id),
  heard: (song, source) => meter.credit(song, source === 'lesson' ? LISTEN_POINTS : BROWSE_POINTS),
});

/** A song view opened: half a point towards the tip card. */
export function songOpened(song: string): void {
  meter.credit(song, BROWSE_POINTS);
}

/** A song started or stopped sounding in the lesson or the quick-play preview. */
export function songPlaying(source: ListenSource, song: string | null, playing: boolean): void {
  listens.playing(source, song, playing);
}

/** The header button and every support visual: a request for tips, or thanks once a tip is confirmed. */
function render(): void {
  const thanked = supporter();
  label.textContent = thanked ? 'Thanks' : 'Support';
  threadHeart.hidden = thanked;
  artHeart.hidden = !thanked;
  button.classList.toggle('is-thanked', thanked);
  ask.hidden = thanked;
  thanks.hidden = !thanked;
  card.setAttribute('aria-labelledby', thanked ? 'support-thanks-title' : 'support-ask-title');
}

function open(placement: TipPlacement, focus: boolean): void {
  render();
  card.querySelectorAll<HTMLAnchorElement>('.support-amount').forEach((link, index) => { link.href = tipUrl(TIPS[index]!, placement); });
  card.hidden = false;
  backdrop.hidden = false;
  card.classList.remove('is-celebrating');
  button.setAttribute('aria-expanded', 'true');
  if (focus) (card.querySelector<HTMLElement>(supporter() ? '.support-close' : '.support-amount'))?.focus();
}

function close(): void {
  if (card.hidden) return;
  const hadFocus = card.contains(document.activeElement);
  card.hidden = true;
  backdrop.hidden = true;
  card.classList.remove('is-celebrating');
  button.setAttribute('aria-expanded', 'false');
  if (hadFocus) button.focus();
}

/** Back from a completed Stripe checkout: remember the supporter, drop the checkout's parameters and celebrate. */
function welcomeBack(): void {
  const back = checkoutReturn(new URL(location.href));
  if (!back) return;
  supporterSince = Date.now();
  writeStored(SUPPORTER_STORAGE, { since: supporterSince });
  history.replaceState(history.state, '', back.clean);
  open('header', false);
  card.classList.add('is-celebrating');
  button.classList.add('is-celebrating');
  status.textContent = 'Thank you for your tip!';
}

export function bindSupport(): void {
  render();
  welcomeBack();
  button.addEventListener('click', () => { if (card.hidden) open('header', true); else close(); });
  must('#support-close').addEventListener('click', close);
  must('#support-later').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  card.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  button.addEventListener('animationend', () => button.classList.remove('is-celebrating'));
}
