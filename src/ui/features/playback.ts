// Listening: plays the melody or the current passage and follows it on the staff.
import { Playback } from '../playback';
import { FREE_PLAY_TEMPO_BPM, playbackSelection } from '../lesson';
import { threadIcon } from '../thread-icons';
import { readPreferences } from '../preferences';
import { engine, playButton, playbackRate, practiceStatus, recorded, repeatPassage, state } from './state';
import { clearActive, controls } from './pad';
import { renderTab } from './staff';
import { savePreferences } from './settings';

function highlight(index: number | null): void {
  const next = index === null ? null : state.playbackIndices[index] ?? null;
  if (next === state.activeNote) return;
  state.activeNote = next;
  if (state.activeNote !== null) {
    state.playbackCursor = state.activeNote + 1;
    const nextPassage = state.passages.findIndex(indices => indices.includes(state.activeNote!));
    if (nextPassage >= 0) state.passageIndex = nextPassage;
  }
  renderTab();
}

export const playback = new Playback(engine, {
  highlight,
  status: (playing) => {
    state.isPlaying = playing;
    setPlayLabel(playing ? 'Stop' : 'Play');
  },
  complete: () => {
    if (repeatPassage.checked && state.view === 'lesson' && state.current) {
      setPlayLabel('Stop');
      state.playbackCursor = state.passages[state.passageIndex]?.[0] ?? 0;
      state.practiceCursor = state.playbackCursor;
      state.repeatingTimer = window.setTimeout(() => { state.repeatingTimer = undefined; void replay(); }, 200);
    }
  },
  error: (error) => { practiceStatus.textContent = `Playback failed: ${error instanceof Error ? error.message : 'unknown error'}`; },
});

export function stopPlayback(): void {
  window.clearTimeout(state.repeatingTimer);
  state.repeatingTimer = undefined;
  playback.stop();
}

function setPlayLabel(label: string): void {
  playButton.querySelector('.stitched-label')!.textContent = label;
  playButton.querySelector('.play-icon')!.innerHTML = threadIcon(label === 'Stop' ? 'stop' : 'play');
}

export function replay(): void {
  state.editor?.stopPreview();
  controls.reset();
  clearActive();
  const arrangement = state.songArrangement ?? (recorded.length ? { title: 'live', tempoBpm: FREE_PLAY_TEMPO_BPM, notes: recorded } : null);
  if (!arrangement) { stopPlayback(); return; }
  const cursor = state.practiceMode ? state.practiceCursor : state.playbackCursor;
  const selection = playbackSelection(arrangement, state.passages[state.passageIndex] ?? [], cursor, !!state.current && repeatPassage.checked);
  state.playbackIndices = selection.indices;
  if (!state.playbackIndices.length) return;
  state.playbackBeatMs = 60000 / (selection.arrangement.tempoBpm * Number(playbackRate.value));
  void playback.start(selection.arrangement, Number(playbackRate.value));
}

export function bindPlayback(): void {
  playButton.addEventListener('click', () => {
    if (playback.playing || state.repeatingTimer !== undefined) stopPlayback();
    else replay();
  });

  playbackRate.addEventListener('change', () => {
    savePreferences({ ...state.preferences, rate: readPreferences({ rate: playbackRate.value }).rate });
    const speed = playbackRate.selectedOptions[0]?.text ?? playbackRate.value;
    if (playback.playing) {
      replay();
      practiceStatus.textContent = `Playing at ${speed} speed.`;
    } else {
      practiceStatus.textContent = `Next play at ${speed} speed.`;
    }
  });
}
