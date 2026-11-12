import type { ThreadIcon } from './thread-icons';
import type { DemoTrack } from '../core/demo';

export type SongCategory = 'All' | 'Games' | 'Anime' | 'Film' | 'Pop' | 'Classics' | 'Other';
type EntryCategory = Exclude<SongCategory, 'All'>;

export interface SongbookEntry {
  track: DemoTrack;
  id: string;
  title: string;
  universe: string;
  categories: readonly EntryCategory[];
  icon: ThreadIcon;
  /** The universe's own mark; `icon` may vary per song. */
  universeIcon: ThreadIcon;
  version?: string;
  artist?: string;
  aliases: readonly string[];
}

type Metadata = Omit<SongbookEntry, 'track' | 'id'>;
const metadata = new Map<string, Metadata>();

function group(universe: string, categories: readonly EntryCategory[], icon: ThreadIcon,
  songs: readonly (readonly [id: string, title: string, extra?: Partial<Pick<Metadata, 'version' | 'artist' | 'aliases' | 'icon'>>])[]): void {
  for (const [id, title, extra] of songs) {
    metadata.set(id, { universe, categories, icon, universeIcon: icon, title, aliases: [], ...extra });
  }
}

// Display rules: `title` is the song name only; the card shows `universe · version`.
// `artist` is displayed only in the generic Pop and Classics collections; composers of a
// franchise are kept searchable as aliases instead.

// Games
group('The Legend of Zelda', ['Games'], 'triforce', [
  ['lullaby-game', 'Zelda’s Lullaby', { version: 'Complete, adapted', aliases: ['Lullaby'] }],
  ['lullaby-trigger', 'Zelda’s Lullaby', { version: 'Manual trigger', aliases: ['Lullaby'] }],
  ['catalogue-gerudo-valley', 'Gerudo Valley'],
  ['catalogue-fairy-fountain', 'Great Fairy Fountain'],
]);
group('Pokémon', ['Games'], 'pokeball', [
  ['catalogue-pokemon-route1', 'Route 1'],
  ['catalogue-pallet-town', 'Pallet Town'],
  ['catalogue-lavender-town', 'Lavender Town'],
  ['littleroot', 'Littleroot Town'],
  ['catalogue-pokemon-caught', 'Wild Pokémon Caught', { version: 'Red / Blue / Yellow', aliases: ['Capture fanfare'] }],
  ['catalogue-pokemon-gym-victory', 'Gym Battle Victory', { version: 'Gold / Silver' }],
]);
group('Undertale', ['Games'], 'heart', [
  ['catalogue-megalovania', 'Megalovania'],
  ['catalogue-once-upon-a-time', 'Once Upon a Time'],
  ['catalogue-fallen-down', 'Fallen Down'],
]);
group('Tetris', ['Games'], 'tetromino', [['catalogue-tetris', 'Music A', { aliases: ['Korobeiniki'] }]]);
group('Sonic', ['Games'], 'ring', [
  ['catalogue-green-hill', 'Green Hill Zone', { version: 'Sonic the Hedgehog' }],
  ['catalogue-sonic-extra-life', 'Extra Life', { version: 'Sonic the Hedgehog', aliases: ['1UP'] }],
  ['catalogue-sonic3-act-complete', 'Act Complete', { version: 'Sonic the Hedgehog 3' }],
]);
group('Super Mario', ['Games'], 'mushroom', [
  ['catalogue-dire-dire-docks', 'Dire, Dire Docks', { version: 'Super Mario 64' }],
  ['catalogue-smb-world-clear', 'Castle Clear', { version: 'Super Mario Bros.', aliases: ['World Clear'] }],
  ['catalogue-smb-game-over', 'Game Over', { version: 'Super Mario Bros.' }],
]);
group('Metroid', ['Games'], 'gamepad', [['catalogue-super-metroid-item', 'Item Acquisition', { version: 'Super Metroid' }]]);
group('Donkey Kong Country', ['Games'], 'gamepad', [
  ['catalogue-dkc-bonus-win', 'Bonus Win', { aliases: ['Boss Defeated', 'Bonus Victory'] }],
]);
group('Final Fantasy VII', ['Games'], 'meteor', [['catalogue-ff7-victory', 'Victory Fanfare', { aliases: ['FF7'] }]]);
group('Chrono Trigger', ['Games'], 'clock', [['catalogue-wind-scene', 'Wind Scene']]);
group('Minecraft', ['Games'], 'grassBlock', [
  ['catalogue-wet-hands', 'Wet Hands', { aliases: ['C418'] }],
  ['catalogue-sweden', 'Sweden', { aliases: ['C418'] }],
]);
group('Wii', ['Games'], 'remote', [['catalogue-mii-channel', 'Mii Channel']]);

// Anime
group('Naruto', ['Anime'], 'leaf', [
  ['catalogue-naruto', 'Sadness and Sorrow'],
  ['catalogue-blue-bird', 'Blue Bird', { version: 'Shippuden', aliases: ['Ikimono-gakari'] }],
]);
group('Neon Genesis Evangelion', ['Anime'], 'unit', [['catalogue-evangelion', 'A Cruel Angel’s Thesis', { aliases: ['Evangelion'] }]]);
group('Elfen Lied', ['Anime'], 'lily', [['catalogue-lilium', 'Lilium']]);
group('Death Note', ['Anime'], 'notebook', [['catalogue-l-theme', 'L’s Theme']]);
group('Sailor Moon', ['Anime'], 'moon', [['catalogue-moonlight', 'Moonlight Densetsu']]);
group('Dragon Ball Z', ['Anime'], 'dragonball', [['catalogue-tapion', 'Tapion’s Theme']]);
group('Attack on Titan', ['Anime'], 'wings', [['catalogue-shinzou', 'Shinzou wo Sasageyo!']]);
group('Jujutsu Kaisen', ['Anime'], 'anime', [['catalogue-aizo', 'AIZO', { version: 'Culling Game opening', aliases: ['King Gnu'] }]]);
group('Dandadan', ['Anime'], 'anime', [['catalogue-kakumei-douchuu', 'Kakumei Douchuu', { version: 'Season 2 opening', aliases: ['On The Way', 'AiNA THE END'] }]]);
group('Chainsaw Man', ['Anime', 'Film'], 'anime', [['catalogue-iris-out', 'IRIS OUT', { version: 'The Movie: Reze Arc', aliases: ['Kenshi Yonezu'] }]]);
group('Orb: On the Movements of the Earth', ['Anime'], 'anime', [['catalogue-kaiju', 'Kaiju', { version: 'Opening', aliases: ['Sakanaction', 'Chi'] }]]);
group('Studio Ghibli', ['Anime', 'Film'], 'forestSpirit', [
  ['catalogue-laputa', 'Main Theme', { version: 'Castle in the Sky', aliases: ['Laputa'] }],
  ['catalogue-always-with-me', 'Always With Me', { version: 'Spirited Away' }],
  ['catalogue-merry-go-round', 'Merry-Go-Round of Life', { version: 'Howl’s Moving Castle' }],
  ['catalogue-totoro', 'Tonari no Totoro', { version: 'My Neighbor Totoro' }],
]);

// Film and TV
group('KPop Demon Hunters', ['Film', 'Pop'], 'hunter', [['catalogue-golden', 'Golden', { aliases: ['HUNTR/X'] }]]);
group('Star Wars', ['Film'], 'empire', [
  ['catalogue-imperial-march', 'The Imperial March', { aliases: ['John Williams'] }],
  ['catalogue-mandalorian', 'Main Theme', { version: 'The Mandalorian', aliases: ['Ludwig Göransson'], icon: 'film' }],
]);
group('Pirates of the Caribbean', ['Film'], 'pirate', [['catalogue-pirate', 'He’s a Pirate', { aliases: ['Hans Zimmer', 'Klaus Badelt'] }]]);
group('Harry Potter', ['Film'], 'wizard', [['catalogue-hedwig', 'Hedwig’s Theme', { aliases: ['John Williams'] }]]);
group('The Lord of the Rings', ['Film'], 'film', [
  ['catalogue-concerning-hobbits', 'Concerning Hobbits', { aliases: ['Howard Shore'] }],
  ['catalogue-evenstar', 'Evenstar', { aliases: ['Howard Shore'] }],
  ['catalogue-may-it-be', 'May It Be', { aliases: ['Enya'] }],
]);
group('Indiana Jones', ['Film'], 'film', [['catalogue-raiders-march', 'The Raiders March', { aliases: ['John Williams'] }]]);
group('Jurassic Park', ['Film'], 'film', [['catalogue-jurassic-park', 'Main Theme', { aliases: ['John Williams'] }]]);
group('James Bond', ['Film'], 'film', [['catalogue-james-bond', 'Main Theme', { aliases: ['James Bond Theme', 'Monty Norman'] }]]);
group('Mission: Impossible', ['Film'], 'film', [['catalogue-mission-impossible', 'Main Theme', { aliases: ['Lalo Schifrin'] }]]);
group('The Pink Panther', ['Film'], 'film', [['catalogue-pink-panther', 'Main Theme', { aliases: ['Henry Mancini'] }]]);
group('Chariots of Fire', ['Film'], 'film', [['catalogue-chariots-of-fire', 'Main Theme', { aliases: ['Vangelis'] }]]);
group('Rocky', ['Film'], 'film', [['catalogue-gonna-fly-now', 'Gonna Fly Now', { aliases: ['Bill Conti'] }]]);
group('Interstellar', ['Film'], 'film', [['catalogue-cornfield-chase', 'Cornfield Chase', { aliases: ['Hans Zimmer'] }]]);
group('The X-Files', ['Film'], 'film', [['catalogue-x-files', 'Main Theme', { aliases: ['Mark Snow'] }]]);
group('Knight Rider', ['Film'], 'film', [['catalogue-knight-rider', 'Main Theme', { aliases: ['Stu Phillips'] }]]);
group('The Simpsons', ['Film'], 'film', [['catalogue-simpsons', 'Main Theme', { aliases: ['Danny Elfman'] }]]);

// Pop: no franchise, so the artist is the context shown with each song.
group('Pop', ['Pop'], 'microphone', [
  ['catalogue-never-gonna', 'Never Gonna Give You Up', { artist: 'Rick Astley', icon: 'heart' }],
  ['catalogue-take-on-me', 'Take On Me', { artist: 'a-ha', icon: 'cassette' }],
  ['catalogue-final-countdown', 'The Final Countdown', { artist: 'Europe', icon: 'rocket' }],
  ['catalogue-numb', 'Numb', { artist: 'Linkin Park', icon: 'waveform' }],
  ['v1', 'In the End', { artist: 'Linkin Park', icon: 'hourglass' }],
  ['catalogue-all-star', 'All Star', { artist: 'Smash Mouth', icon: 'star' }],
  ['catalogue-eye-of-the-tiger', 'Eye of the Tiger', { artist: 'Survivor' }],
  ['catalogue-everybody-wants-to-rule-the-world', 'Everybody Wants to Rule the World', { artist: 'Tears for Fears' }],
  ['catalogue-smooth-criminal', 'Smooth Criminal', { artist: 'Michael Jackson' }],
  ['catalogue-gimme-gimme-gimme', 'Gimme! Gimme! Gimme!', { artist: 'ABBA' }],
  ['catalogue-another-one-bites-the-dust', 'Another One Bites the Dust', { artist: 'Queen', icon: 'waveform' }],
  ['catalogue-seven-nation-army', 'Seven Nation Army', { artist: 'The White Stripes', icon: 'waveform' }],
  ['catalogue-children', 'Children', { artist: 'Robert Miles', icon: 'cassette' }],
  ['catalogue-sandstorm', 'Sandstorm', { artist: 'Darude', icon: 'waveform' }],
  ['catalogue-astronomia', 'Astronomia', { artist: 'Vicetone & Tony Igy', aliases: ['Coffin Dance'], icon: 'cassette' }],
  ['catalogue-blinding-lights', 'Blinding Lights', { artist: 'The Weeknd', icon: 'cassette' }],
  ['catalogue-fate-of-ophelia', 'The Fate of Ophelia', { artist: 'Taylor Swift', icon: 'flower' }],
  ['catalogue-stateside', 'Stateside', { artist: 'PinkPantheress & Zara Larsson' }],
  ['catalogue-man-i-need', 'Man I Need', { artist: 'Olivia Dean' }],
]);

// Classics
group('Classics', ['Classics'], 'lyre', [
  ['ode', 'Ode to Joy', { artist: 'Ludwig van Beethoven', aliases: ['Beethoven'] }],
  ['birthday', 'Happy Birthday', { artist: 'Traditional', icon: 'cake' }],
  ['twinkle', 'Twinkle, Twinkle, Little Star', { artist: 'Traditional', aliases: ['Twinkle Twinkle'], icon: 'star' }],
]);

export function createSongbookEntries(tracks: readonly DemoTrack[]): SongbookEntry[] {
  return tracks.map((track) => ({
    track, id: track.id,
    ...(metadata.get(track.id) ?? { title: track.title, universe: 'Other melodies', categories: ['Other'] as const, icon: 'music', universeIcon: 'music', aliases: [] }),
  }));
}

export interface LetterAnchor { letter: string; id: string }

/** Index letter of a title: its first letter or digit, accents folded; digits and non-Latin letters become '#'. */
function indexLetter(title: string): string {
  const first = title.normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? '';
  return /^[A-Z]$/.test(first) ? first : '#';
}

/** The first entry of each run of index letters, in list order, for the letter rail. */
export function letterAnchors(entries: readonly SongbookEntry[]): LetterAnchor[] {
  const anchors: LetterAnchor[] = [];
  for (const entry of entries) {
    const letter = indexLetter(entry.title);
    if (anchors.at(-1)?.letter !== letter) anchors.push({ letter, id: entry.id });
  }
  return anchors;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function filterSongbook(entries: readonly SongbookEntry[], options: {
  query?: string; category?: SongCategory; universe?: string; savedIds?: ReadonlySet<string>; onlySaved?: boolean;
}): SongbookEntry[] {
  const words = normalize(options.query ?? '').split(' ').filter(Boolean);
  return entries.filter((entry) => {
    if (options.category && options.category !== 'All' && !entry.categories.includes(options.category)) return false;
    if (options.universe && entry.universe !== options.universe) return false;
    if (options.onlySaved && !options.savedIds?.has(entry.id)) return false;
    const searchable = normalize([entry.title, entry.track.title, entry.universe, entry.artist ?? '', entry.version ?? '', ...entry.aliases].join(' '));
    return words.every((word) => searchable.includes(word));
  });
}

export interface UniverseOption { name: string; icon: ThreadIcon; count: number }
export interface UniverseGroup { category: EntryCategory; universes: UniverseOption[] }

const CATEGORY_ORDER: readonly EntryCategory[] = ['Games', 'Anime', 'Film', 'Pop', 'Classics', 'Other'];

/**
 * Universes grouped by category. Without a category each universe appears once, under
 * its primary (first) category; with one, only that category's universes are listed.
 */
export function listUniverses(entries: readonly SongbookEntry[], category: SongCategory = 'All'): UniverseGroup[] {
  const groups = new Map<EntryCategory, Map<string, UniverseOption>>();
  for (const entry of entries) {
    const home = category === 'All' ? entry.categories[0] : entry.categories.includes(category) ? category : undefined;
    if (!home) continue;
    const universes = groups.get(home) ?? new Map<string, UniverseOption>();
    groups.set(home, universes);
    const option = universes.get(entry.universe) ?? { name: entry.universe, icon: entry.universeIcon, count: 0 };
    option.count++;
    universes.set(entry.universe, option);
  }
  return CATEGORY_ORDER.filter(name => groups.has(name)).map(name => ({
    category: name,
    universes: [...groups.get(name)!.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')),
  }));
}
