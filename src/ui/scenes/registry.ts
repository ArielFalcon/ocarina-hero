import type { SceneLoader } from './scene';

/**
 * Which scene a song gets. Keys are the universe names of src/ui/songbook.ts, the owner of a
 * song's universe. Each scene is its own module: the app bundle holds only these loaders, and a
 * scene's data and art load when a song of it opens. Pieces shared by several universes belong
 * in a shared module that the scene modules import.
 */
export const SCENES_BY_UNIVERSE: Readonly<Record<string, SceneLoader>> = {
  'Animal Crossing': () => import('./universes/animal-crossing'),
  'Doom': () => import('./universes/doom'),
  'Dragon Ball Z': () => import('./universes/dragon-ball-z'),
  'Game of Thrones': () => import('./universes/game-of-thrones'),
  'James Bond': () => import('./universes/james-bond'),
  'Jujutsu Kaisen': () => import('./universes/jujutsu-kaisen'),
  'Jurassic Park': () => import('./universes/jurassic-park'),
  'Mission: Impossible': () => import('./universes/mission-impossible'),
  'Naruto': () => import('./universes/naruto'),
  'Neon Genesis Evangelion': () => import('./universes/evangelion'),
  'One Piece': () => import('./universes/one-piece'),
  'Pirates of the Caribbean': () => import('./universes/pirates'),
  'Pokémon': () => import('./universes/pokemon'),
  'Tetris': () => import('./universes/tetris'),
  'The Legend of Zelda': () => import('./universes/zelda'),
  'The Simpsons': () => import('./universes/simpsons'),
  'Undertale': () => import('./universes/undertale'),
  'Wii': () => import('./universes/wii'),
};

/** A song whose scene differs from its universe's: Pop and Classics group real artists, so their scenes go per song. */
export const SCENES_BY_SONG: Readonly<Record<string, SceneLoader>> = {
  'catalogue-aqua-barbie-girl-verse': () => import('./universes/barbie-girl'),
  'catalogue-beat-it-bass-riff': () => import('./universes/beat-it'),
  'catalogue-lambada': () => import('./universes/lambada'),
  'catalogue-never-gonna': () => import('./universes/never-gonna'),
};

/** The scene of an open song: its own, else its universe's; none in free play or on a console without scenes. */
export function sceneLoaderFor(songId: string | null, universe: string | undefined, consoleHasScenes: boolean,
  bySong: Readonly<Record<string, SceneLoader>> = SCENES_BY_SONG): SceneLoader | null {
  if (!consoleHasScenes || songId === null) return null;
  return bySong[songId] ?? (universe === undefined ? undefined : SCENES_BY_UNIVERSE[universe]) ?? null;
}
