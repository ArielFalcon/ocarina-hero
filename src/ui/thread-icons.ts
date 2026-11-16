import { patchIconUrl } from './platform';

/** Patch icons, one file per name in each console's set (see `assets.patchIcons` in platforms.ts); the tapestry WebP files are rendered from their SVG by scripts/rasterize-icons.ts. */
export const THREAD_ICONS = [
  'anime',
  'back',
  'cake',
  'cassette',
  'clock',
  'close',
  'collection',
  'dragonball',
  'empire',
  'expand',
  'film',
  'flower',
  'forestSpirit',
  'gamepad',
  'grassBlock',
  'heart-empty',
  'heart-filled',
  'heart',
  'hourglass',
  'hunter',
  'keyboard',
  'konohaLeaf',
  'lily',
  'lyre',
  'meteor',
  'microphone',
  'moon',
  'mushroom',
  'music',
  'next',
  'notebook',
  'palette',
  'pause',
  'pirate',
  'play',
  'pokeball',
  'previous',
  'remote',
  'repeat',
  'reset',
  'ring',
  'settings',
  'rocket',
  'share',
  'songbook',
  'speed',
  'star',
  'stop',
  'tetromino',
  'triforce',
  'unit',
  'waveform',
  'wingsOfFreedom',
  'wizard',
] as const;

export type ThreadIcon = typeof THREAD_ICONS[number];

/**
 * A decorative embroidered patch. Each SVG keeps its own pattern ids, so it is
 * referenced as an image instead of inlined; buttons keep their accessible names.
 */
export function patchIconHtml(name: string, src: string, extraClass = ''): string {
  return `<img class="thread-icon${extraClass ? ` ${extraClass}` : ''}" src="${src}" data-icon="${name}" alt="" aria-hidden="true" draggable="false" decoding="async" />`;
}

/** The patch icon of the active console. */
export function threadIcon(name: ThreadIcon, extraClass = ''): string {
  return patchIconHtml(name, patchIconUrl(name), extraClass);
}

/** Point every rendered patch icon at the active console's set. */
export function refreshThreadIcons(): void {
  for (const image of document.querySelectorAll<HTMLImageElement>('img.thread-icon[data-icon]')) {
    image.src = patchIconUrl(image.dataset.icon!);
  }
}
