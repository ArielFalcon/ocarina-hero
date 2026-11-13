/** Embroidered patch icons served from public/art/icons; one file per name. */
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
  return `<img class="thread-icon${extraClass ? ` ${extraClass}` : ''}" src="${import.meta.env.BASE_URL}art/icons/${name}.svg" alt="" aria-hidden="true" draggable="false" decoding="async" />`;
}
