import type { DemoTrack } from '../../core/demo';
import type { Arrangement } from '../../core/ir';
import { pitchById } from '../../core/pitches';
import type { Projection } from '../../core/project';
import { prepareMelody } from '../../core/prepare';
import { createPassages, FREE_PLAY_TEMPO_BPM, lessonDetails, staffTransition } from '../lesson';
import { swapStaff, timeNoteThread } from '../staff-motion';
import { staffClef, staffTokenHtml } from '../staff';
import { threadIcon } from '../thread-icons';
import { instruction, platform, tabInstructions } from '../platform';
import type { SongbookEntry } from '../songbook';
import { songArticleHtml } from '../../site/song-article';
import { relatedSongs, songGroups, type SongGroup } from '../../site/song-pages';
import { APP_BASE, type Source, analysisDownload, bends, bendsInput, fileName, pad, passageSelect, playButton, practiceStatus, preferences, progressTrack, recorded, simplifyInput, songComplete, songHint, state, tab } from './state';
import { must } from './dom';
import { closeAudioEditor, isImporting } from './workshop';
import { renderCombo } from './practice';
import { syncScene } from './scenes';
import { replay, stopPlayback } from './playback';
import { catalogue } from './songbook';

/** The tab line of the song article; absent on pages that open without a song until one is opened. */
let tabText = document.querySelector<HTMLParagraphElement>('#tab-text');

function currentTabText(): string {
  return state.current ? tabInstructions(recorded, undefined, state.current.tempoBpm, ', ') : '';
}

export function renderTab(): void {
  playButton.disabled = isImporting() || recorded.length === 0;
  state.passages = createPassages(recorded, state.current?.tempoBpm ?? FREE_PLAY_TEMPO_BPM, state.current?.phraseStarts);
  if (tabText) tabText.textContent = currentTabText();
  bends.hidden = state.current !== null && !recorded.some(note => !!note.bend);
  state.passageIndex = Math.max(0, Math.min(state.passageIndex, state.passages.length - 1));
  // Keep the staff and its passage controls at a stable size: free play can add a bend at any time.
  tab.classList.toggle('has-modifiers', state.current === null || recorded.some(note => !!note.bend));
  passageSelect.disabled = state.passages.length === 0;
  if (recorded.length === 0) {
    delete tab.dataset.notes;
    state.renderedWindow = null;
    passageSelect.replaceChildren(new Option('1 of 1', '0'));
    must<HTMLButtonElement>('#previous-passage').disabled = true;
    must<HTMLButtonElement>('#next-passage').disabled = true;
    tab.innerHTML = `${staffClef()}<p class="empty">Your notes will appear on this staff.</p>`;
    updateProgress();
    return;
  }
  if (passageSelect.options.length !== state.passages.length || passageSelect.options[0]?.text !== `1 of ${state.passages.length}`) {
    passageSelect.replaceChildren(...state.passages.map((_, index) => new Option(`${index + 1} of ${state.passages.length}`, String(index))));
  }
  passageSelect.value = String(state.passageIndex);
  must<HTMLButtonElement>('#previous-passage').disabled = state.passageIndex === 0;
  must<HTMLButtonElement>('#next-passage').disabled = state.passageIndex === state.passages.length - 1;
  const indices = state.passages[state.passageIndex]!;
  const signature = indices.map(index => `${index}:${recorded[index]!.pitch}:${recorded[index]!.bend ?? 0}`).join('|');
  if (tab.dataset.notes !== signature) {
    const focused = tab.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.noteIndex : undefined;
    const nextWindow = { song: state.songArrangement, indices };
    swapStaff(tab, staffTransition(state.renderedWindow, nextWindow), () => { tab.innerHTML = staffClef() + indices.map((index, slot) => {
    const expected = state.practiceMode && !state.isPlaying && state.practiceCursor === index;
    const classes = [state.activeNote === index && 'is-playing', expected && 'is-expected', state.practiceMode && index < state.practiceCursor && 'is-played'].filter(Boolean).join(' ');
    return staffTokenHtml(recorded[index]!, index, slot, indices.length, classes, state.activeNote === index || expected);
    }).join(''); });
    state.renderedWindow = nextWindow;
    tab.dataset.notes = signature;
    if (focused !== undefined) {
      (tab.querySelector<HTMLButtonElement>(`[data-note-index="${focused}"]`) ?? tab.querySelector<HTMLButtonElement>('.tok'))?.focus({ preventScroll: true });
    }
  }
  for (const token of tab.querySelectorAll<HTMLElement>('[data-note-index]')) {
    const index = Number(token.dataset.noteIndex);
    const expected = state.practiceMode && !state.isPlaying && state.practiceCursor === index;
    token.classList.toggle('is-playing', state.activeNote === index);
    token.classList.toggle('is-expected', expected);
    token.classList.toggle('is-played', state.practiceMode && index < state.practiceCursor);
    token.classList.toggle('is-past', !state.practiceMode && state.activeNote !== null && index < state.activeNote);
    timeNoteThread(token, state.activeNote === index, (recorded[index]!.durationBeats || 1) * state.playbackBeatMs);
    if (state.activeNote === index || expected) token.setAttribute('aria-current', 'true');
    else token.removeAttribute('aria-current');
  }
  updateProgress();
}

function arrangementLabel(projection: Projection): string {
  const percent = Math.round(projection.confidence * 100);
  const shift = projection.transpositionSemitones;
  return `${percent}% arrangement fit · transposition ${shift > 0 ? '+' : ''}${shift} semitones · ${projection.shiftedNotes}/${projection.notes.length} notes moved · ${projection.bentNotes} bent`;
}

function show(arrangement: Arrangement, label: string, play = false): void {
  state.songArrangement = arrangement;
  songComplete.hidden = true;
  state.practiceCursor = 0;
  state.combo = { streak: 0, best: 0 };
  state.playbackCursor = 0;
  state.passageIndex = 0;
  state.activeNote = null;
  recorded.length = 0;
  recorded.push(...arrangement.notes);
  renderTab();
  if (play) void replay();
  songHint.textContent = label;
  updateLessonHeading();
}

export function renderSource(source: Source, play = false): void {
  if (isImporting()) return;
  stopPlayback();
  state.current = source;
  analysisDownload.disabled = !source.analysis;

  const fixed = source.fixedNotes !== undefined;
  simplifyInput.disabled = fixed || !!source.preserveTiming;
  simplifyInput.title = fixed ? 'Fixed arrangements preserve their notes and timing.' : source.preserveTiming ? 'Audio preserves detected notes and timing.' : '';
  bendsInput.disabled = fixed;
  bendsInput.title = fixed ? 'Fixed arrangements preserve their notes and timing.' : '';
  const prepared = prepareMelody(source, {
    simplify: preferences.get().simplify,
    maxBend: preferences.get().bends ? 2 : 0,
    tuning: platform().tuning,
  });

  const removed = prepared.removed ? ` · ${prepared.removed} ornaments removed` : '';
  const label = prepared.projection
    ? `${source.subtitle}${removed} · ${arrangementLabel(prepared.projection)}`
    : source.subtitle;

  show(
    { title: source.title, tempoBpm: source.tempoBpm, notes: prepared.notes },
    label,
    play,
  );
}

export function runDemo(demo: DemoTrack): void {
  closeAudioEditor();
  fileName.textContent = demo.title;
  stopPlayback();
  renderSource({
    title: demo.title,
    subtitle: demo.subtitle,
    tempoBpm: demo.tempoBpm,
    beatsPerBar: demo.beatsPerBar ?? 4,
    melody: demo.melody,
    fixedNotes: demo.fixedNotes,
    phraseStarts: demo.phraseStarts,
  });
}

export function updateProgress(): void {
  const progressBar = must<HTMLProgressElement>('#progress');
  const position = Math.min(recorded.length, state.practiceMode ? state.practiceCursor : state.playbackCursor);
  progressBar.max = Math.max(1, recorded.length);
  progressBar.value = position;
  progressTrack.style.setProperty('--progress-ratio', String(position / Math.max(1, recorded.length)));
  must('#song-progress').hidden = state.current === null || recorded.length === 0;
  must('#progress-label').textContent = `${position} / ${recorded.length} notes`;
  must('#progress-percent').textContent = `${Math.round(position / Math.max(1, recorded.length) * 100)}%`;
  must('#progress-caption').textContent = state.practiceMode ? 'Practice progress' : 'Song progress';
  if (!state.practiceMode) renderCombo();
  const expected = state.practiceMode && !state.isPlaying ? recorded[state.practiceCursor] : undefined;
  for (const key of pad.querySelectorAll<HTMLElement>('[data-button]')) {
    key.classList.toggle('is-expected', !!expected && key.dataset.button === pitchById(expected.pitch).button);
  }
  for (const key of bends.querySelectorAll<HTMLElement>('[data-bend]')) {
    key.classList.toggle('is-expected', !!expected?.bend && Number(key.dataset.bend) === expected.bend);
  }
}

export function renderLessonMeta(): void {
  const songProgress = state.selectedEntry ? state.progress[state.selectedEntry.id] : undefined;
  must('#lesson-meta').textContent = state.current
    ? [...lessonDetails(state.selectedEntry?.version, recorded.length, state.passages.length), songProgress?.completed && 'Completed', songProgress && songProgress.bestCombo > 1 && `Best combo ×${songProgress.bestCombo}`].filter(Boolean).join(' · ')
    : 'Make a little music.';
}

let songGroupsCache: { entries: readonly SongbookEntry[]; groups: SongGroup[] } | undefined;

let articleHtml = '';

/** The text under the player (summary, tab, related songs): written by the same renderer the page is built with, only for a song of the songbook. */
function renderSongArticle(): void {
  const article = must('#song-article');
  article.hidden = !state.selectedEntry || !state.current;
  if (!state.selectedEntry || !state.current) return;
  if (songGroupsCache?.entries !== catalogue.entries) songGroupsCache = { entries: catalogue.entries, groups: songGroups(catalogue.entries) };
  const html = songArticleHtml({
    title: state.selectedEntry.title, universe: state.selectedEntry.universe, version: state.selectedEntry.version,
    noteCount: recorded.length, passageCount: state.passages.length, difficulty: state.selectedEntry.difficulty.level, tab: currentTabText(),
  }, relatedSongs(songGroupsCache.groups, { id: state.selectedEntry.id, universe: state.selectedEntry.universe }), APP_BASE);
  if (html === articleHtml) return;
  articleHtml = html;
  // A new arrangement rewrites the text; the disclosures the player opened stay open.
  const opened = [...article.querySelectorAll('details')].map(details => details.open);
  article.innerHTML = html;
  article.querySelectorAll('details').forEach((details, index) => { details.open = opened[index] ?? false; });
  tabText = must<HTMLParagraphElement>('#tab-text');
}

export function updateLessonHeading(): void {
  must('#lesson-title').textContent = state.selectedEntry?.title ?? state.current?.title ?? 'Free play';
  const universe = must('#lesson-universe');
  universe.innerHTML = threadIcon(state.selectedEntry?.icon ?? 'music');
  universe.append(document.createTextNode(state.selectedEntry?.universe ?? (state.current ? 'Your melody' : 'Your instrument')));
  renderLessonMeta();
  const save = must<HTMLButtonElement>('#save-song');
  const saved = !!state.selectedEntry && catalogue.isSaved(state.selectedEntry.id);
  save.hidden = state.selectedEntry === null;
  save.innerHTML = `${threadIcon(saved ? 'heart-filled' : 'heart-empty')}<span>${saved ? 'Saved' : 'Save'}</span>`;
  save.setAttribute('aria-pressed', String(saved));
  save.setAttribute('aria-label', saved ? 'Remove from saved songs' : 'Save song');
  must('#share-song').hidden = state.selectedEntry === null;
  must('#song-modes').hidden = state.current === null;
  must('.app').classList.toggle('has-song', state.current !== null);
  must('#listen-mode').setAttribute('aria-pressed', String(!state.practiceMode));
  must('#practice-mode').setAttribute('aria-pressed', String(state.practiceMode));
  must<HTMLButtonElement>('#open-import').disabled = state.current === null || state.selectedEntry !== null || isImporting();
  renderSongArticle();
  syncScene();
  refreshPracticeStatus();
}

export function refreshPracticeStatus(lead = ''): void {
  if (!state.current) {
    practiceStatus.textContent = recorded.length ? 'Your melody is ready to play.' : 'Play any note to start a melody.';
  } else if (!state.practiceMode) {
    practiceStatus.textContent = 'Listen and follow the highlighted button.';
  } else {
    const expected = recorded[state.practiceCursor];
    practiceStatus.textContent = lead + (expected
      ? `Next: ${instruction(pitchById(expected.pitch).button, expected.bend ?? 0)}`
      : `You reached the end${state.combo.best > 1 ? ` with a best combo of ${state.combo.best}` : ''}.`);
  }
}
