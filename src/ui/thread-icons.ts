import { assetDir } from './theme';

/** Patch icons: public/art/icons (tapestry) and public/art/icons-retro (retro), one file per name in each. */
const ICONS = [
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

export type ThreadIcon = typeof ICONS[number];

/**
 * A decorative embroidered patch. Each SVG keeps its own pattern ids, so it is
 * referenced as an image instead of inlined; buttons keep their accessible names.
 */
export function threadIcon(name: ThreadIcon, extraClass = ''): string {
  return `<img class="thread-icon${extraClass ? ` ${extraClass}` : ''}" src="${assetDir('icons')}${name}.svg" data-icon="${name}" alt="" aria-hidden="true" draggable="false" decoding="async" />`;
}

/** Point every rendered patch icon at the active theme's set. */
export function refreshThreadIcons(): void {
  for (const image of document.querySelectorAll<HTMLImageElement>('img.thread-icon[data-icon]')) {
    image.src = `${assetDir('icons')}${image.dataset.icon}.svg`;
  }
}
