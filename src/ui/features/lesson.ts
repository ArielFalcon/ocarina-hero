import { shareUrl } from '../route';
import { resetPassage } from '../lesson';
import { APP_BASE, analysisDownload, bendsInput, fileInput, fileName, nextSongButton, passageSelect, practiceStatus, recorded, preferences, repeatPassage, simplifyInput, songComplete, songHint, state, tab, take } from './state';
import { must } from './dom';
import { closeAudioEditor } from './workshop';
import { clearActive, controls } from './pad';
import { refreshPracticeStatus, renderSource, renderTab, updateLessonHeading } from './staff';
import { resetCombo, selectPassage } from './practice';
import { playback, replay, stopPlayback } from './playback';
import { catalogue } from './songbook';
import { openSong, showView } from './navigation';
import { sceneOnRestart } from './scenes';

let shareResetTimer: number | undefined;

function switchLessonMode(practice: boolean): void {
  if (state.practiceMode === practice) return;
  stopPlayback();
  state.practiceMode = practice;
  selectPassage(0);
  updateLessonHeading();
}

export function bindLesson(): void {
  must<HTMLButtonElement>('#clear').addEventListener('click', () => {
    closeAudioEditor();
    fileInput.value = '';
    fileName.textContent = 'No file loaded';
    analysisDownload.disabled = true;
    for (const input of [simplifyInput, bendsInput]) {
      input.disabled = false;
      input.title = '';
    }
    controls.reset();
    clearActive();
    stopPlayback();
    recorded.length = 0;
    state.current = null;
    state.selectedEntry = null;
    state.practiceMode = false;
    state.practiceCursor = 0;
    state.playbackCursor = 0;
    state.songArrangement = null;
    renderTab();
    updateLessonHeading();
    showView('lesson');
    practiceStatus.textContent = 'Play any note to start a melody.';
    songHint.textContent = 'Free play recording.';
  });

  bendsInput.addEventListener('change', () => preferences.update({ bends: bendsInput.checked }));

  simplifyInput.addEventListener('change', () => preferences.update({ simplify: simplifyInput.checked }));

  preferences.subscribe((next, previous) => {
    if ((next.bends !== previous.bends || next.simplify !== previous.simplify) && state.current) renderSource(state.current);
  });

  must('#save-song').addEventListener('click', () => {
    if (state.selectedEntry) catalogue.toggleSaved(state.selectedEntry.id);
  });

  must('#share-song').addEventListener('click', async () => {
    if (!state.selectedEntry) return;
    const button = must('#share-song .share-label');
    const url = shareUrl(location.href, APP_BASE, state.selectedEntry.id);
    const title = `${state.selectedEntry.title} · Ocarina Hero`;
    let label = 'Copied!';
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return;
      label = 'Copy failed';
    }
    button.textContent = label;
    window.clearTimeout(shareResetTimer);
    shareResetTimer = window.setTimeout(() => { button.textContent = 'Share'; }, 1800);
  });

  must('#practice-mode').addEventListener('click', () => switchLessonMode(true));

  must('#listen-mode').addEventListener('click', () => switchLessonMode(false));

  must('#practice-again').addEventListener('click', () => selectPassage(0));

  nextSongButton.addEventListener('click', () => {
    const entry = catalogue.entries.find(item => item.id === nextSongButton.dataset.song);
    if (entry) openSong(entry);
  });

  passageSelect.addEventListener('change', () => selectPassage(Number(passageSelect.value)));

  must('#previous-passage').addEventListener('click', () => selectPassage(state.passageIndex - 1));

  must('#next-passage').addEventListener('click', () => selectPassage(state.passageIndex + 1));

  must('#restart').addEventListener('click', () => {
    sceneOnRestart();
    // Free play has nothing to rewind to: reset discards the take.
    if (!state.songArrangement) {
      take.clear();
      selectPassage(0);
      return;
    }
    selectPassage(resetPassage(state.passageIndex, { practice: state.practiceMode, repeating: repeatPassage.checked }));
  });

  tab.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-note-index]');
    if (!target) return;
    stopPlayback();
    songComplete.hidden = true;
    state.practiceCursor = Number(target.dataset.noteIndex);
    state.playbackCursor = state.practiceCursor;
    resetCombo();
    renderTab();
    refreshPracticeStatus();
  });

  repeatPassage.addEventListener('change', () => {
    if (playback.playing) replay();
    if (!repeatPassage.checked && state.repeatingTimer !== undefined) stopPlayback();
  });

  must('#open-import').addEventListener('click', () => showView('lesson'));

  /** A related song of the article opens in the app; a modified click keeps the browser's own link behavior. */
  must('#song-article').addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLElement>('[data-song-link]');
    const entry = link && catalogue.entries.find(item => item.id === link.dataset.songLink);
    if (!entry || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openSong(entry);
  });
}
