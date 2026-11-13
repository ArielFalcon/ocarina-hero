/**
 * Transient practice rewards: embroidered sparks, stitched ripples and banners.
 * Every effect is decorative (aria-hidden, pointer-transparent) and removes itself;
 * the practice status line remains the accessible source of truth.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Restart a one-shot CSS animation class on an element that may still carry it. */
export function retrigger(element: Element | null, className: string): void {
  if (!element) return;
  element.classList.remove(className);
  void (element as HTMLElement).offsetWidth;
  element.classList.add(className);
}

function fxLayer(tab: HTMLElement): HTMLElement {
  let layer = tab.querySelector<HTMLElement>(':scope > .staff-fx');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'staff-fx';
    layer.setAttribute('aria-hidden', 'true');
    tab.append(layer);
  }
  return layer;
}

function removeAfter(element: Element, ms: number): void {
  window.setTimeout(() => element.remove(), ms);
}

/** Centre of an element in its container's coordinates. */
export function centreIn(container: HTMLElement, element: Element | null): { x: number; y: number } | null {
  if (!element) return null;
  const outer = container.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return { x: inner.left + inner.width / 2 - outer.left, y: inner.top + inner.height / 2 - outer.top };
}

/** Thread sparks that burst from a correctly played note; denser at higher tiers. */
export function sparkBurst(tab: HTMLElement, point: { x: number; y: number }, tier: number): void {
  if (reduceMotion.matches) return;
  const burst = document.createElement('span');
  burst.className = 'hit-burst';
  burst.dataset.tier = String(tier);
  burst.style.setProperty('--x', `${point.x}px`);
  burst.style.setProperty('--y', `${point.y}px`);
  const sparks = 6 + Math.min(tier, 5) * 2;
  const reach = 30 + Math.min(tier, 5) * 5;
  const offset = Math.random() * 360;
  for (let index = 0; index < sparks; index++) {
    const spark = document.createElement('i');
    spark.style.setProperty('--a', `${offset + index * 360 / sparks}deg`);
    spark.style.setProperty('--d', `${reach * (.75 + Math.random() * .4)}px`);
    burst.append(spark);
  }
  fxLayer(tab).append(burst);
  removeAfter(burst, 750);
}

/**
 * A rust ribbon unrolled over the practice status for milestones, passages and the
 * final note, replacing any ribbon still inside `line`. It repeats what the status
 * announces, so it never covers the staff or the controller.
 */
export function ribbon(line: HTMLElement, title: string, detail: string, kind: 'combo' | 'passage' | 'song'): void {
  line.querySelector('.combo-ribbon')?.remove();
  const banner = document.createElement('div');
  banner.className = `combo-ribbon is-${kind}`;
  banner.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('span');
  heading.className = 'ribbon-title embroidered';
  heading.textContent = title;
  banner.append(heading);
  if (detail) {
    const small = document.createElement('span');
    small.className = 'ribbon-detail stitched-label';
    small.textContent = detail;
    banner.append(small);
  }
  line.append(banner);
  removeAfter(banner, kind === 'song' ? 2200 : 1250);
}

/** A cream running stitch that ripples outward from a pressed control. */
export function stitchRipple(control: Element | null): void {
  if (!control || reduceMotion.matches) return;
  const ripple = document.createElement('span');
  ripple.className = 'key-ripple';
  ripple.setAttribute('aria-hidden', 'true');
  control.append(ripple);
  removeAfter(ripple, 500);
}

export function haptic(pattern: number | number[]): void {
  navigator.vibrate?.(pattern);
}
