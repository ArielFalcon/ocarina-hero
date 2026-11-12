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

group('The Legend of Zelda', ['Games'], 'triforce', [
  ['lullaby-game', 'Lullaby', { version: 'Complete, adapted', aliases: ["Zelda's Lullaby"] }],
  ['lullaby-trigger', 'Lullaby', { version: 'Manual trigger', aliases: ["Zelda's Lullaby"] }],
  ['catalogue-gerudo-valley', 'Gerudo Valley'], ['catalogue-fairy-fountain', 'Great Fairy Fountain'],
]);
group('Pokémon', ['Games'], 'pokeball', [
  ['catalogue-pokemon-route1', 'Route 1'], ['catalogue-pallet-town', 'Pallet Town'],
  ['catalogue-lavender-town', 'Lavender Town'], ['littleroot', 'Littleroot Town'],
  ['catalogue-pokemon-caught', 'Pokémon Caught', { version: 'Red / Blue / Yellow', aliases: ['Capture fanfare'] }],
  ['catalogue-pokemon-gym-victory', 'Gym Battle Victory', { version: 'Gold / Silver' }],
]);
group('Undertale', ['Games'], 'heart', [
  ['catalogue-megalovania', 'Megalovania'], ['catalogue-once-upon-a-time', 'Once Upon a Time'],
  ['catalogue-fallen-down', 'Fallen Down'],
]);
group('Tetris', ['Games'], 'tetromino', [['catalogue-tetris', 'Music A']]);
group('Sonic', ['Games'], 'ring', [
  ['catalogue-green-hill', 'Green Hill Zone'],
  ['catalogue-sonic-extra-life', 'Extra Life / 1UP', { version: 'Sonic the Hedgehog' }],
  ['catalogue-sonic3-act-complete', 'Act Complete', { version: 'Sonic the Hedgehog 3' }],
]);
group('Final Fantasy VII', ['Games'], 'meteor', [['catalogue-ff7-victory', 'Victory Fanfare', { aliases: ['FF7'] }]]);
group('Chrono Trigger', ['Games'], 'clock', [['catalogue-wind-scene', 'Wind Scene']]);
group('Wii', ['Games'], 'remote', [['catalogue-mii-channel', 'Mii Channel']]);
group('Super Mario 64', ['Games'], 'mushroom', [['catalogue-dire-dire-docks', 'Dire, Dire Docks']]);
group('Super Mario Bros.', ['Games'], 'mushroom', [
  ['catalogue-smb-world-clear', 'Castle Clear', { version: 'NES', aliases: ['World Clear'] }],
  ['catalogue-smb-game-over', 'Game Over', { version: 'NES' }],
]);
group('Metroid', ['Games'], 'gamepad', [
  ['catalogue-super-metroid-item', 'Item Acquisition', { version: 'Super Metroid' }],
]);
group('Minecraft', ['Games'], 'grassBlock', [['catalogue-wet-hands', 'Wet Hands'], ['catalogue-sweden', 'Sweden']]);
group('Naruto', ['Anime'], 'leaf', [['catalogue-naruto', 'Sadness and Sorrow'], ['catalogue-blue-bird', 'Blue Bird', { aliases: ['Naruto Shippuden'] }]]);
group('Neon Genesis Evangelion', ['Anime'], 'unit', [['catalogue-evangelion', 'A Cruel Angel’s Thesis', { aliases: ['Evangelion'] }]]);
group('Elfen Lied', ['Anime'], 'lily', [['catalogue-lilium', 'Lilium']]);
group('Death Note', ['Anime'], 'notebook', [['catalogue-l-theme', 'L’s Theme']]);
group('Sailor Moon', ['Anime'], 'moon', [['catalogue-moonlight', 'Moonlight Densetsu']]);
group('Dragon Ball Z', ['Anime'], 'dragonball', [['catalogue-tapion', 'Tapion’s Theme']]);
group('Attack on Titan', ['Anime'], 'wings', [['catalogue-shinzou', 'Shinzou wo Sasageyo!']]);
group('Studio Ghibli', ['Anime', 'Film'], 'forestSpirit', [
  ['catalogue-laputa', 'Main Theme', { aliases: ['Castle in the Sky', 'Laputa'] }],
  ['catalogue-always-with-me', 'Always With Me', { aliases: ['Spirited Away'] }],
  ['catalogue-merry-go-round', 'Merry-Go-Round of Life', { aliases: ['Howl’s Moving Castle'] }],
  ['catalogue-totoro', 'Tonari no Totoro', { aliases: ['My Neighbor Totoro'] }],
]);
group('KPop Demon Hunters', ['Film', 'Pop'], 'hunter', [['catalogue-golden', 'Golden', { artist: 'HUNTR/X' }]]);
group('Star Wars', ['Film'], 'empire', [
  ['catalogue-imperial-march', 'Imperial March'],
  ['catalogue-mandalorian', 'The Mandalorian', { artist: 'Ludwig Göransson', icon: 'film' }],
]);
group('Pirates of the Caribbean', ['Film'], 'pirate', [['catalogue-pirate', 'He’s a Pirate']]);
group('Harry Potter', ['Film'], 'wizard', [['catalogue-hedwig', 'Hedwig’s Theme']]);
group('The X-Files', ['Film'], 'film', [['catalogue-x-files', 'The X-Files Theme', { artist: 'Mark Snow' }]]);
group('Mission: Impossible', ['Film'], 'film', [['catalogue-mission-impossible', 'Main Theme', { artist: 'Lalo Schifrin' }]]);
group('The Pink Panther', ['Film'], 'film', [['catalogue-pink-panther', 'Main Theme', { artist: 'Henry Mancini' }]]);
group('Chariots of Fire', ['Film'], 'film', [['catalogue-chariots-of-fire', 'Main Theme', { artist: 'Vangelis' }]]);
group('James Bond', ['Film'], 'film', [['catalogue-james-bond', 'James Bond Theme', { artist: 'Monty Norman' }]]);
group('Indiana Jones', ['Film'], 'film', [['catalogue-raiders-march', 'The Raiders March', { artist: 'John Williams' }]]);
group('Rocky', ['Film'], 'film', [['catalogue-gonna-fly-now', 'Gonna Fly Now', { artist: 'Bill Conti' }]]);
group('Interstellar', ['Film'], 'film', [['catalogue-cornfield-chase', 'Cornfield Chase', { artist: 'Hans Zimmer' }]]);
group('Jurassic Park', ['Film'], 'film', [['catalogue-jurassic-park', 'Main Theme', { artist: 'John Williams' }]]);
group('Knight Rider', ['Film'], 'film', [['catalogue-knight-rider', 'Main Theme']]);
group('The Simpsons', ['Film'], 'film', [['catalogue-simpsons', 'Main Theme', { artist: 'Danny Elfman' }]]);
group('Pop', ['Pop'], 'microphone', [
  ['catalogue-never-gonna', 'Never Gonna Give You Up', { artist: 'Rick Astley', icon: 'heart' }],
  ['catalogue-take-on-me', 'Take On Me', { artist: 'a-ha', icon: 'cassette' }],
  ['catalogue-final-countdown', 'The Final Countdown', { artist: 'Europe', icon: 'rocket' }],
  ['catalogue-numb', 'Numb', { artist: 'Linkin Park', icon: 'waveform' }],
  ['catalogue-all-star', 'All Star', { artist: 'Smash Mouth', icon: 'star' }],
  ['catalogue-fate-of-ophelia', 'The Fate of Ophelia', { artist: 'Taylor Swift', icon: 'flower' }],
  ['catalogue-seven-nation-army', 'Seven Nation Army', { artist: 'The White Stripes', icon: 'waveform' }],
  ['catalogue-another-one-bites-the-dust', 'Another One Bites the Dust', { artist: 'Queen', icon: 'waveform' }],
  ['catalogue-blinding-lights', 'Blinding Lights', { artist: 'The Weeknd', icon: 'cassette' }],
  ['catalogue-sandstorm', 'Sandstorm', { artist: 'Darude', icon: 'waveform' }],
  ['catalogue-astronomia', 'Astronomia', { artist: 'Vicetone / Tony Igy', aliases: ['Coffin Dance'], icon: 'cassette' }],
  ['catalogue-children', 'Children', { artist: 'Robert Miles', icon: 'cassette' }],
  ['v1', 'In the End', { artist: 'Linkin Park', icon: 'hourglass' }],
]);
group('Classics', ['Classics'], 'lyre', [
  ['ode', 'Ode to Joy', { artist: 'Ludwig van Beethoven', aliases: ['Beethoven'] }],
  ['birthday', 'Happy Birthday', { icon: 'cake' }], ['twinkle', 'Twinkle Twinkle', { aliases: ['Twinkle Twinkle Little Star'], icon: 'star' }],
]);

export function createSongbookEntries(tracks: readonly DemoTrack[]): SongbookEntry[] {
  return tracks.map((track) => ({
    track, id: track.id,
    ...(metadata.get(track.id) ?? { title: track.title, universe: 'Other melodies', categories: ['Other'] as const, icon: 'music', universeIcon: 'music', aliases: [] }),
  }));
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
