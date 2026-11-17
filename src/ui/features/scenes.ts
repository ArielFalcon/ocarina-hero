import { onPlatformChange, platform } from '../platform';
import { celebrationsEnabled } from '../practice-fx';
import { practiceCue } from '../scenes/scene';
import { sceneLoaderFor } from '../scenes/registry';
import { cueScene, recastScene, setSceneMood, showScene } from '../scenes/stage';
import { state } from './state';

/** Shows the open song's universe scene; called whenever the lesson heading changes. */
export function syncScene(): void {
  const entry = state.selectedEntry;
  showScene(sceneLoaderFor(entry?.id ?? null, entry?.universe, platform().scenes));
  syncSceneMood();
}

function syncSceneMood(): void {
  setSceneMood(state.isPlaying ? 'playing' : state.practiceMode && state.current ? 'practice' : 'idle', state.playbackBeatMs);
}

/** Play and Stop: the puppets perk up when a song starts and settle when it stops. */
export function sceneOnPlayback(wasPlaying: boolean, playing: boolean): void {
  syncSceneMood();
  if (playing && !wasPlaying) cueScene('play');
  else if (!playing && wasPlaying) cueScene('stop');
}

/** A song heard to its end is applauded like a practice milestone. */
export function sceneOnListenEnd(): void {
  if (celebrationsEnabled()) cueScene('cheer');
}

/** Reset: the puppets leave and a new draw of the cast comes in. */
export function sceneOnRestart(): void {
  recastScene();
}

/** A practised note: the puppets react like the other practice rewards, which Settings can turn off. */
export function sceneOnPracticeNote(result: Parameters<typeof practiceCue>[0]): void {
  if (celebrationsEnabled()) cueScene(practiceCue(result));
}

export function bindScenes(): void {
  onPlatformChange(syncScene);
}
