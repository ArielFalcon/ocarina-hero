import { N64_CONTROLS, SWITCH_CONTROLS, THREEDS_CONTROLS, type ControlScheme } from '../core/control-schemes';
import { N64_TUNING, SWITCH2_TUNING, THREEDS_TUNING, type ControllerButton, type TuningProfile } from '../core/pitches';
import type { PadLayout } from './gamepad';

/**
 * Every console the app can imitate, as data. Adding a console means adding one profile here
 * (plus its stylesheet and art); consumers read the active profile and never ask which one it is.
 * Pure data: the server build, the theme-init script and the tests import it without a DOM.
 */

/** A slot of the on-screen diamond: a playable button, an empty cell, or an unplayable button shown greyed. */
export type PadSlot = ControllerButton | 'cell' | { readonly ghost: string };

/** Static markup images that change with the console; markup marks them with `data-art`. */
export type StaticArt = 'brand' | 'ornament';

export interface Platform {
  /** Stored in browser storage and set as `<html data-theme>`; never compared by consumers. */
  readonly id: string;
  readonly controls: ControlScheme;
  readonly tuning: TuningProfile;
  readonly gamepad: { readonly layout: PadLayout; readonly help: string };
  /** On-screen pad: the shoulder row, then the diamond read left to right, top to bottom. */
  readonly pad: { readonly shoulders: readonly ControllerButton[]; readonly diamond: readonly PadSlot[] };
  /** Controller glyph file per remake glyph name; a missing name keeps the remake's file. */
  readonly glyphs: Readonly<Record<string, string>>;
  /** Whether shoulder buttons draw as shoulders or as round face buttons. */
  readonly shoulderKind: 'shoulder' | 'button';
  /** Asset paths relative to the site base. */
  readonly assets: {
    readonly controller: string;
    readonly patchIcons: string;
    readonly patchIconExtension: 'webp' | 'svg';
    readonly clef: string;
    /** The figure hanging from the top of the app. */
    readonly hangingFigure: string;
  };
  readonly art: Readonly<Record<StaticArt, string>>;
  /** Browser UI colour (`<meta name="theme-color">`). */
  readonly themeColor: string;
  /** The card that offers this console in Settings. */
  readonly picker: { readonly title: string; readonly detail: string; readonly art: string };
}

/** The 2026 remake on Switch 2: the woven tapestry look. */
const TAPESTRY: Platform = {
  id: 'tapestry',
  controls: SWITCH_CONTROLS,
  tuning: SWITCH2_TUNING,
  gamepad: {
    /** By position: a Nintendo pad labels the right face button A, the left one Y and the top one X; the D-pad bends a semitone. */
    layout: { noteButtons: [[4, 'L'], [5, 'R'], [1, 'A'], [2, 'Y'], [3, 'X']], bendButtons: [[12, 1], [13, -1]], bendAxes: [1, 3] },
    help: 'Controller connected: the shoulder and face buttons play; the D-pad and the sticks bend.',
  },
  pad: { shoulders: ['L', 'R'], diamond: ['cell', 'X', 'cell', 'Y', { ghost: 'B' }, 'A'] },
  glyphs: {},
  shoulderKind: 'shoulder',
  assets: { controller: 'icons/controller/', patchIcons: 'art/icons/', patchIconExtension: 'webp', clef: 'icons/app/icon-192.png', hangingFigure: 'art/link-hanging.webp' },
  art: { brand: 'icons/app/icon-192.png', ornament: 'art/sword-triforce-v2.webp' },
  themeColor: '#293529',
  picker: { title: '2026 remake', detail: 'Woven tapestry with Switch 2 controls', art: 'art/theme/keycard-large.svg' },
};

/** The 2011 3DS release: the glossy touch-screen look. */
const THREEDS: Platform = {
  id: '3ds',
  controls: THREEDS_CONTROLS,
  tuning: THREEDS_TUNING,
  gamepad: TAPESTRY.gamepad,
  pad: TAPESTRY.pad,
  glyphs: {},
  shoulderKind: 'shoulder',
  assets: { controller: 'icons/controller-3ds/', patchIcons: 'art/icons-3ds/', patchIconExtension: 'svg', clef: 'art/3ds/clef.svg', hangingFigure: 'art/3ds/link-hanging.svg' },
  art: { brand: 'art/3ds/ocarina.svg', ornament: 'art/3ds/sword-triforce.svg' },
  themeColor: '#141a1d',
  picker: { title: '2011 handheld', detail: 'Touch-screen subscreen with 3DS controls', art: 'art/theme/handheld-large.svg' },
};

/** The 1998 N64 original: the stone subscreen look. */
const RETRO: Platform = {
  id: 'retro',
  controls: N64_CONTROLS,
  tuning: N64_TUNING,
  gamepad: {
    /** A is either lower face button, the right stick is the C buttons, and both right and both left shoulders are R and Z. */
    layout: { noteButtons: [[0, 'L'], [1, 'L']], bendButtons: [[5, 1], [7, 1], [4, -1], [6, -1]], bendAxes: [1], noteStick: [2, 3, 'A', 'Y', 'X', 'R'] },
    help: 'Controller connected: A and the right stick, as the C buttons, play; R, Z and the left stick bend.',
  },
  pad: { shoulders: ['L'], diamond: ['cell', 'X', 'cell', 'Y', 'R', 'A'] },
  /** Notes become A and C-buttons, the D-pad becomes R and Z. */
  glyphs: { l: 'a', r: 'c-down', a: 'c-right', y: 'c-left', x: 'c-up', 'dpad-up': 'r', 'dpad-down': 'z' },
  shoulderKind: 'button',
  assets: { controller: 'icons/controller-retro/', patchIcons: 'art/icons-retro/', patchIconExtension: 'svg', clef: 'art/retro/clef.svg', hangingFigure: 'art/retro/link-hanging.svg' },
  art: { brand: 'art/retro/ocarina.svg', ornament: 'art/retro/sword-triforce.svg' },
  themeColor: '#14120d',
  picker: { title: '1998 original', detail: 'Stone subscreen with N64 controls', art: 'art/theme/cartridge-large.svg' },
};

/** In the order Settings offers them; the first is the default. */
export const PLATFORMS: readonly Platform[] = [TAPESTRY, THREEDS, RETRO];

export const DEFAULT_PLATFORM: Platform = PLATFORMS[0]!;

/** Read before first paint by the generated theme-init.js. */
export const PLATFORM_STORAGE = 'ocarina-hero:theme';

export function platformById(id: string | null | undefined): Platform | undefined {
  return PLATFORMS.find(platform => platform.id === id);
}

/** Path of a patch icon, relative to the site base. */
export function patchIconPath(platform: Platform, name: string): string {
  return `${platform.assets.patchIcons}${name}.${platform.assets.patchIconExtension}`;
}

/**
 * Applies the saved console before first paint (CSP forbids inline scripts). Only a known,
 * non-default console sets `data-theme`, as the app's store does on boot.
 */
export function themeInitScript(): string {
  const ids = PLATFORMS.filter(platform => platform !== DEFAULT_PLATFORM).map(platform => platform.id);
  return `// Applies the saved theme before first paint (CSP forbids inline scripts). Generated from src/ui/platforms.ts.
try { var theme = localStorage.getItem(${JSON.stringify(PLATFORM_STORAGE)}); if (${JSON.stringify(ids)}.indexOf(theme) >= 0) document.documentElement.dataset.theme = theme; } catch {}
`;
}
