import type { Note } from '../core/ir';
import type { ControllerButton } from '../core/pitches';
import { buttonLabel, noteInstruction, schemeBendLabel, toTabText } from '../core/tab';
import { DEFAULT_PLATFORM, PLATFORM_STORAGE, patchIconPath, platformById, type Platform } from './platforms';

/**
 * The single owner of the active console. It holds the choice in memory, persists it, mirrors it
 * to `<html data-theme>` for the stylesheets and announces every change once. Views read what they
 * need from the active profile, or from the helpers below, and re-render on `onPlatformChange`.
 */

const base = (): string => import.meta.env.BASE_URL;
const CHANGE = 'platformchange';

let active: Platform | undefined;

/** The active console; the first read adopts what theme-init.js applied before first paint. */
export function platform(): Platform {
  return active ??= platformById(document.documentElement.dataset.theme) ?? DEFAULT_PLATFORM;
}

/** Switch console in place; an unknown id falls back to the default. */
export function setPlatform(id: string): void {
  active = platformById(id) ?? DEFAULT_PLATFORM;
  document.documentElement.dataset.theme = active.id;
  try { localStorage.setItem(PLATFORM_STORAGE, active.id); } catch { /* storage unavailable: the choice lasts for this session */ }
  syncStaticArt();
  document.dispatchEvent(new Event(CHANGE));
}

export function onPlatformChange(listener: () => void): void {
  document.addEventListener(CHANGE, listener);
}

/** Point static markup images (`data-art`) and the browser theme color at the active console. */
export function syncStaticArt(): void {
  const { art, themeColor } = platform();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  for (const image of document.querySelectorAll<HTMLImageElement>('img[data-art]')) {
    image.setAttribute('src', base() + art[image.dataset.art as keyof typeof art]);
  }
}

export function buttonName(button: ControllerButton): string {
  return buttonLabel(button, platform().controls);
}

export function bendName(bend: number): string {
  return schemeBendLabel(bend, platform().controls);
}

export function instruction(button: ControllerButton, bend = 0): string {
  return noteInstruction(button, bend, platform().controls);
}

export function tabInstructions(notes: readonly Note[], beatsPerBar: number | undefined, sourceTempoBpm: number | undefined, noteSeparator?: string): string {
  return toTabText(notes, beatsPerBar, sourceTempoBpm, { scheme: platform().controls, noteSeparator });
}

/** URL of a controller glyph file of the active console. */
export function controllerIconUrl(file: string): string {
  return `${base()}${platform().assets.controller}${file}.svg`;
}

export function patchIconUrl(name: string): string {
  return base() + patchIconPath(platform(), name);
}

export function clefUrl(): string {
  return base() + platform().assets.clef;
}
