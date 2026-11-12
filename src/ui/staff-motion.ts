import type { StaffTransition } from './lesson';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const EASE_OUT = 'cubic-bezier(.22, .72, .18, 1)';
const EASE_IN = 'cubic-bezier(.5, 0, .75, .4)';
const SLIDE = 36;

function tokens(tab: HTMLElement): HTMLElement[] {
  return [...tab.querySelectorAll<HTMLElement>('.tok[data-note-index]')];
}

/** Keep a non-interactive copy of the outgoing notes so they can leave the staff. */
function leavingCopies(tab: HTMLElement): HTMLElement[] {
  return tokens(tab).map(token => {
    const copy = token.cloneNode(true) as HTMLElement;
    copy.classList.add('tok-leaving');
    copy.removeAttribute('data-note-index');
    copy.removeAttribute('aria-current');
    copy.removeAttribute('aria-label');
    copy.setAttribute('aria-hidden', 'true');
    copy.setAttribute('tabindex', '-1');
    copy.inert = true;
    return copy;
  });
}

/**
 * Re-render the staff, then animate from the previous window to the new one.
 * Motion uses the independent `translate`, `scale` and `opacity` properties, so it
 * never fights the token's centering transform or its state styling.
 */
export function swapStaff(tab: HTMLElement, transition: StaffTransition, render: () => void): void {
  const sliding = transition === 'forward' || transition === 'backward';
  const before = new Map(tokens(tab).map(token => [token.dataset.noteIndex!, token.getBoundingClientRect().left]));
  const copies = sliding && !reduceMotion.matches ? leavingCopies(tab) : [];
  render();
  const entering = tokens(tab);
  if (typeof entering[0]?.animate !== 'function') return;

  if (reduceMotion.matches) {
    if (transition !== 'reflow') for (const token of entering) token.animate({ opacity: [0, 1] }, { duration: 140, easing: 'linear' });
    return;
  }

  if (transition === 'reflow') {
    for (const token of entering) {
      const left = before.get(token.dataset.noteIndex!);
      if (left === undefined) {
        token.animate({ opacity: [0, 1], scale: ['.6', '1'] }, { duration: 220, easing: EASE_OUT });
      } else {
        const dx = left - token.getBoundingClientRect().left;
        if (Math.abs(dx) > .5) token.animate({ translate: [`${dx}px 0`, '0 0'] }, { duration: 240, easing: EASE_OUT });
      }
    }
    return;
  }

  if (transition === 'enter') {
    entering.forEach((token, slot) => token.animate(
      { opacity: [0, 1], translate: ['0 6px', '0 0'] },
      { duration: 260, delay: slot * 35, easing: EASE_OUT, fill: 'backwards' },
    ));
    return;
  }

  const direction = transition === 'forward' ? 1 : -1;
  tab.append(...copies);
  for (const copy of copies) {
    copy.animate(
      { opacity: [1, 0], translate: ['0 0', `${-direction * SLIDE}px 0`] },
      { duration: 160, easing: EASE_IN, fill: 'forwards' },
    ).finished.then(() => copy.remove(), () => copy.remove());
  }
  const ordered = direction > 0 ? entering : [...entering].reverse();
  ordered.forEach((token, slot) => token.animate(
    { opacity: [0, 1], translate: [`${direction * SLIDE}px 0`, '0 0'] },
    { duration: 280, delay: 110 + slot * 30, easing: EASE_OUT, fill: 'backwards' },
  ));
}
