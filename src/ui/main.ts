import { OcarinaEngine } from '../audio/engine';
import { DEMOS, type DemoTrack } from '../core/demo';
import type { Arrangement, Note } from '../core/ir';
import {
  frequencyOf,
  pitchForButton,
  pitchById,
  type ControllerButton,
  type PitchSpec,
} from '../core/pitches';
import type { MelodyNote, Projection } from '../core/project';
import { prepareMelody } from '../core/prepare';
import { bendLabel, noteInstruction } from '../core/tab';
import { buttonIcon, modifierIcon } from './controller-icons';
import { SourceImporter, type AudioImportMode, type AudioSourceAnalysis, type PreparedAudio } from './import';
import { AudioFragmentEditor } from './audio-editor';
import { Controls } from './input';
import { Playback } from './playback';
import { createPassages, advancePractice, playbackSelection, staffTransition } from './lesson';
import { swapStaff } from './staff-motion';
import { actionForCode, assignKey, BEND_ACTIONS, DEFAULT_BINDINGS, KEY_BINDINGS_STORAGE, KEYBOARD_ACTIONS, keyLabel, readBindings, handleKeyDown, type KeyboardAction } from './keyboard';
import { threadIcon, type ThreadIcon } from './thread-icons';
import { SongbookView } from './songbook-view';
import type { SongbookEntry } from './songbook';

const engine = new OcarinaEngine();
let bindings = (() => {
  try { return readBindings(JSON.parse(localStorage.getItem(KEY_BINDINGS_STORAGE) ?? 'null')); }
  catch { return { ...DEFAULT_BINDINGS }; }
})();
let bindingTarget: KeyboardAction | null = null;
const desktop = window.matchMedia('(min-width: 800px)');
const recorded: Note[] = [];
let bend = 0;
let songArrangement: Arrangement | null = null;

interface Source {
  readonly title: string;
  readonly subtitle: string;
  readonly tempoBpm: number;
  readonly beatsPerBar: number;
  readonly melody: readonly MelodyNote[];
  readonly fixedNotes?: readonly Note[];
  readonly preserveTiming?: boolean;
  readonly phraseStarts?: readonly number[];
  readonly analysis?: AudioSourceAnalysis;
}

let current: Source | null = null;

const pad = must<HTMLDivElement>('#pad');
const bends = must<HTMLDivElement>('#bend-pad');
const tab = must<HTMLDivElement>('#tab');
const hint = must<HTMLParagraphElement>('#hint');
const songHint = must<HTMLParagraphElement>('#song-hint');
const fileName = must<HTMLSpanElement>('#file-name');
const fileInput = must<HTMLInputElement>('#file');
const audioMode = must<HTMLSelectElement>('#audio-mode');
if (!__MELODY_SERVER__) {
  audioMode.querySelector('option[value="main-melody"]')?.remove();
  audioMode.value = 'isolated';
  // One remaining mode is not a choice: show the explanation instead of the control.
  for (const element of audioMode.closest('.field')!.children) (element as HTMLElement).hidden = element.id !== 'audio-mode-note';
}
const playbackRate = must<HTMLSelectElement>('#playback-rate');
const analysisDownload = must<HTMLButtonElement>('#analysis-download');
const bendsInput = must<HTMLInputElement>('#bends');
const simplifyInput = must<HTMLInputElement>('#simplify');
const playButton = must<HTMLButtonElement>('#play');
type AppView = 'catalog' | 'lesson' | 'workshop';
let view: AppView = 'catalog';
let selectedEntry: SongbookEntry | null = null;
let practiceMode = false;
let practiceCursor = 0;
let playbackCursor = 0;
let activeNote: number | null = null;
let passageIndex = 0;
let passages: number[][] = [];
let playbackIndices: number[] = [];
let playbackBeatMs = 625;
let renderedWindow: { song: unknown; indices: readonly number[] } | null = null;
let repeatingTimer: number | undefined;
let isPlaying = false;
const practiceStatus = must<HTMLParagraphElement>('#practice-status');
const passageSelect = must<HTMLSelectElement>('#passage');
const repeatPassage = must<HTMLInputElement>('#repeat-passage');
let selectedAudio: PreparedAudio | null = null;
let audioLoadVersion = 0;
const importer = new SourceImporter({
  onSource(source) {
    selectedEntry = null;
    practiceMode = false;
    fileName.textContent = source.title;
    renderSource(source);
    must<HTMLButtonElement>('#open-import').disabled = false;
    updateLessonHeading();
    showView('lesson');
    if (source.analysis) setWorkshopStatus(`TAB ready: ${source.melody.length} notes. Open the melody to play or practise it.`);
  },
  onStatus(message) {
    songHint.textContent = message;
    setWorkshopStatus(message);
  },
  onPending(pending) {
    editor.setBusy(pending);
    showAnalysisProgress(pending);
    updateAnalyzeButton();
    playButton.disabled = pending || recorded.length === 0;
    analysisDownload.disabled = pending || !current?.analysis;
    simplifyInput.disabled = pending || current?.fixedNotes !== undefined || !!current?.preserveTiming;
    bendsInput.disabled = pending || current?.fixedNotes !== undefined;
    must<HTMLButtonElement>('#open-import').disabled = pending || current === null || selectedEntry !== null;
  },
});
const editor = new AudioFragmentEditor(must<HTMLElement>('#audio-editor'), {
  onSelectionChange() { invalidateAudioResult('Fragment changed. Choose Analyze fragment to generate its TAB.'); },
  onSelectionReady() { updateAnalyzeButton(); },
  onPreviewStart() {
    stopPlayback();
    controls.reset();
    clearActive();
  },
  onEditingFocus() {
    controls.reset();
    clearActive();
  },
});

const analyzeButton = must<HTMLButtonElement>('#analyze');
const analysisProgress = must<HTMLElement>('#analysis-progress');
const analysisElapsed = must<HTMLElement>('#analysis-elapsed');
let analysisPhase: 'decoding' | 'analysing' | 'importing' = 'analysing';
let analysisTimer: number | undefined;

function setWorkshopStatus(message: string): void {
  must('#workshop-status').textContent = message;
}

function updateAnalyzeButton(): void {
  analyzeButton.disabled = importer.pending || !selectedAudio || !editor.selection;
}

/** Show a determinate-looking but honest loader: a woven spinner plus elapsed time. */
function showAnalysisProgress(pending: boolean): void {
  window.clearInterval(analysisTimer);
  analysisTimer = undefined;
  analysisProgress.hidden = !pending;
  analyzeButton.hidden = pending;
  if (!pending) return;
  const seconds = editor.selection && selectedAudio ? (editor.selection.endIndex - editor.selection.startIndex) / selectedAudio.buffer.sampleRate : 0;
  must('#analysis-progress-label').textContent = analysisPhase === 'decoding'
    ? 'Reading the recording…'
    : analysisPhase === 'importing' ? 'Importing the MIDI melody…' : `Finding the melody in ${seconds.toFixed(1)} s of audio…`;
  const started = performance.now();
  analysisElapsed.textContent = '0 s';
  analysisTimer = window.setInterval(() => { analysisElapsed.textContent = `${Math.floor((performance.now() - started) / 1000)} s`; }, 1000);
}

function invalidateAudioResult(message: string): void {
  importer.invalidate();
  stopPlayback();
  current = null;
  selectedEntry = null;
  songArrangement = null;
  recorded.length = 0;
  analysisDownload.disabled = true;
  renderTab();
  songHint.textContent = message;
  must('#workshop-status').textContent = message;
  must<HTMLButtonElement>('#open-import').disabled = true;
  updateAnalyzeButton();
}

function closeAudioEditor(): void {
  audioLoadVersion++;
  selectedAudio = null;
  importer.releaseAudio();
  editor.clear();
}

function must<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

function keyHtml(pitch: PitchSpec): string {
  return `
    <button class="key" type="button" data-button="${pitch.button}"
      aria-label="Play ${pitch.button}, keyboard ${keyLabel(bindings[pitch.button])}"
      title="${pitch.id} · keyboard ${keyLabel(bindings[pitch.button])}">
      ${buttonIcon(pitch.button)}
      <kbd class="key-ref">${keyLabel(bindings[pitch.button])}</kbd>
    </button>`;
}

function buildPad(): void {
  pad.innerHTML = `
    <div class="shoulders">
      ${keyHtml(pitchForButton('L'))}
      ${keyHtml(pitchForButton('R'))}
    </div>
    <div class="diamond">
      <span class="cell" aria-hidden="true"></span>
      ${keyHtml(pitchForButton('X'))}
      <span class="cell" aria-hidden="true"></span>
      ${keyHtml(pitchForButton('Y'))}
      <span class="ghost" aria-hidden="true">B</span>
      ${keyHtml(pitchForButton('A'))}
    </div>`;
  bends.innerHTML = [1, -1, 2, -2].map(value => `
    <button class="bend-key" type="button" data-bend="${value}" aria-label="${bendLabel(value)}" title="${bendLabel(value)}">
      ${modifierIcon(value)}
      <kbd class="key-ref" data-bend-label="${value}">${keyLabel(bindings[KEYBOARD_ACTIONS.find(action => BEND_ACTIONS[action as keyof typeof BEND_ACTIONS] === value)!])}</kbd>
    </button>`).join('');
}

function setActive(button: ControllerButton, active: boolean): void {
  pad.querySelector(`[data-button="${button}"]`)?.classList.toggle('is-active', active);
}

function clearActive(): void {
  for (const element of pad.querySelectorAll('.key.is-active')) {
    element.classList.remove('is-active');
  }
}

let lastNoteLabel = '';

function updateHint(): void {
  const parts: string[] = [];
  if (lastNoteLabel) parts.push(lastNoteLabel);
  parts.push(bend ? `bend ${bendLabel(bend)}` : 'no bend');
  hint.textContent = parts.join(' · ');
}

function press(pitch: PitchSpec): void {
  editor.stopPreview();
  if (isPlaying || repeatingTimer !== undefined) stopPlayback();
  engine.noteOn(pitch, bend);
  lastNoteLabel = `${pitch.button} · ${pitch.id} · ${frequencyOf(pitch.id, bend).toFixed(1)} Hz`;
  updateHint();

  if (songArrangement) {
    if (practiceMode && !isPlaying) practise(pitch.button);
    return;
  }

  recorded.push({
    pitch: pitch.id,
    bend,
    startBeat: recorded.length,
    durationBeats: 1,
  });
  passageIndex = Math.floor((recorded.length - 1) / 5);
  renderTab();
}

function renderTab(): void {
  playButton.disabled = importer.pending || recorded.length === 0;
  passages = createPassages(recorded, current?.tempoBpm ?? 96, current?.phraseStarts);
  bends.hidden = current !== null && !recorded.some(note => !!note.bend);
  passageIndex = Math.max(0, Math.min(passageIndex, passages.length - 1));
  // Keep the staff and its passage controls at a stable size: free play can add a bend at any time.
  tab.classList.toggle('has-modifiers', current === null || recorded.some(note => !!note.bend));
  passageSelect.disabled = passages.length === 0;
  if (recorded.length === 0) {
    delete tab.dataset.notes;
    renderedWindow = null;
    passageSelect.replaceChildren(new Option('1 of 1', '0'));
    must<HTMLButtonElement>('#previous-passage').disabled = true;
    must<HTMLButtonElement>('#next-passage').disabled = true;
    tab.innerHTML = `<span class="staff-clef">${threadIcon('music')}</span><p class="empty">Your notes will appear on this staff.</p>`;
    updateProgress();
    return;
  }
  if (passageSelect.options.length !== passages.length || passageSelect.options[0]?.text !== `1 of ${passages.length}`) {
    passageSelect.replaceChildren(...passages.map((_, index) => new Option(`${index + 1} of ${passages.length}`, String(index))));
  }
  passageSelect.value = String(passageIndex);
  must<HTMLButtonElement>('#previous-passage').disabled = passageIndex === 0;
  must<HTMLButtonElement>('#next-passage').disabled = passageIndex === passages.length - 1;
  const indices = passages[passageIndex]!;
  const levels: Record<ControllerButton, number> = { L: 96, R: 78, A: 60, Y: 42, X: 24 };
  const signature = indices.map(index => `${index}:${recorded[index]!.pitch}:${recorded[index]!.bend ?? 0}`).join('|');
  if (tab.dataset.notes !== signature) {
    const focused = tab.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.noteIndex : undefined;
    const nextWindow = { song: songArrangement, indices };
    swapStaff(tab, staffTransition(renderedWindow, nextWindow), () => { tab.innerHTML = `<span class="staff-clef">${threadIcon('music')}</span>` + indices.map((index, slot) => {
    const note = recorded[index]!;
    const spec = pitchById(note.pitch);
    const expected = practiceMode && !isPlaying && practiceCursor === index;
    return `<button type="button" class="tok${activeNote === index ? ' is-playing' : ''}${expected ? ' is-expected' : ''}${practiceMode && index < practiceCursor ? ' is-played' : ''}" data-note-index="${index}" style="--staff-x:calc(42px + (100% - 64px) * ${(slot + .5) / indices.length});--staff-y:${levels[spec.button]}px" aria-label="Note ${index + 1}: ${noteInstruction(spec.button, note.bend ?? 0)}"${activeNote === index || expected ? ' aria-current="true"' : ''}>${buttonIcon(spec.button)}<span class="note-order" aria-hidden="true">${index + 1}</span>${note.bend ? `<span class="staff-modifier">${modifierIcon(note.bend)}</span>` : ''}</button>`;
    }).join(''); });
    renderedWindow = nextWindow;
    tab.dataset.notes = signature;
    if (focused !== undefined) {
      (tab.querySelector<HTMLButtonElement>(`[data-note-index="${focused}"]`) ?? tab.querySelector<HTMLButtonElement>('.tok'))?.focus({ preventScroll: true });
    }
  }
  for (const token of tab.querySelectorAll<HTMLElement>('[data-note-index]')) {
    const index = Number(token.dataset.noteIndex);
    const expected = practiceMode && !isPlaying && practiceCursor === index;
    token.classList.toggle('is-playing', activeNote === index);
    token.classList.toggle('is-expected', expected);
    token.classList.toggle('is-played', practiceMode && index < practiceCursor);
    token.classList.toggle('is-past', !practiceMode && activeNote !== null && index < activeNote);
    if (activeNote === index && !token.style.getPropertyValue('--note-ms')) {
      token.style.setProperty('--note-ms', `${Math.max(120, (recorded[index]!.durationBeats || 1) * playbackBeatMs)}ms`);
    } else if (activeNote !== index) token.style.removeProperty('--note-ms');
    if (activeNote === index || expected) token.setAttribute('aria-current', 'true');
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
  songArrangement = arrangement;
  practiceCursor = 0;
  playbackCursor = 0;
  passageIndex = 0;
  activeNote = null;
  recorded.length = 0;
  recorded.push(...arrangement.notes);
  renderTab();
  if (play) void replay();
  songHint.textContent = label;
  updateLessonHeading();
}

function renderSource(source: Source, play = false): void {
  if (importer.pending) return;
  stopPlayback();
  current = source;
  analysisDownload.disabled = !source.analysis;

  const fixed = source.fixedNotes !== undefined;
  simplifyInput.disabled = fixed || !!source.preserveTiming;
  simplifyInput.title = fixed ? 'Fixed arrangements preserve their notes and timing.' : source.preserveTiming ? 'Audio preserves detected notes and timing.' : '';
  bendsInput.disabled = fixed;
  bendsInput.title = fixed ? 'Fixed arrangements preserve their notes and timing.' : '';
  const prepared = prepareMelody(source, {
    simplify: simplifyInput.checked,
    maxBend: bendsInput.checked ? 2 : 0,
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

function runDemo(demo: DemoTrack): void {
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

buildPad();
renderTab();

function applyBend(value: number, glide = 0): void {
  bend = value;
  engine.setBend(value, glide);

  for (const element of bends.querySelectorAll<HTMLElement>('.bend-key')) {
    element.classList.toggle('is-active', Number(element.dataset.bend) === value);
  }

  updateHint();
}

const controls = new Controls(
  (button) => {
    setActive(button, true);
    press(pitchForButton(button));
  },
  (button) => {
    setActive(button, false);
    engine.noteOff();
  },
  applyBend,
  (button) => setActive(button, false),
);

const touchCapable = 'ontouchstart' in window;
if (touchCapable) {
  const hit = (x: number, y: number): HTMLElement | null => {
    const element = document.elementFromPoint(x, y);
    return element instanceof Element
      ? element.closest<HTMLElement>('[data-bend], [data-button]')
      : null;
  };
  document.addEventListener('touchstart', (event) => {
    for (const touch of Array.from(event.changedTouches)) {
      const element = hit(touch.clientX, touch.clientY);
      if (!element) continue;
      event.preventDefault();
      const source = `touch:${touch.identifier}`;
      if (element.dataset.bend !== undefined) {
        controls.bendDown(source, Number(element.dataset.bend));
      } else if (element.dataset.button) {
        controls.noteDown(source, element.dataset.button as ControllerButton);
      }
    }
  }, { passive: false });
  const releaseTouch = (event: TouchEvent): void => {
    for (const touch of Array.from(event.changedTouches)) {
      const source = `touch:${touch.identifier}`;
      controls.bendUp(source);
      controls.noteUp(source);
    }
  };
  document.addEventListener('touchend', releaseTouch);
  document.addEventListener('touchcancel', releaseTouch);
} else {
  for (const element of document.querySelectorAll<HTMLElement>('#pad .key, #bend-pad .bend-key')) {
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const source = `pointer:${event.pointerId}`;
      if (element.dataset.bend !== undefined) {
        controls.bendDown(source, Number(element.dataset.bend));
      } else if (element.dataset.button) {
        controls.noteDown(source, element.dataset.button as ControllerButton);
      }
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      element.addEventListener(type, (event) => {
        const source = `pointer:${event.pointerId}`;
        controls.bendUp(source);
        controls.noteUp(source);
      });
    }
  }
}


for (const container of [pad, bends]) {
  container.addEventListener('contextmenu', (event) => event.preventDefault());
}

function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('#audio-editor, #keyboard-settings, input, select, textarea, [contenteditable]') !== null;
}

function actionLabel(action: KeyboardAction): string {
  if (!(action in BEND_ACTIONS)) return `Button ${action}`;
  return bendLabel(BEND_ACTIONS[action as keyof typeof BEND_ACTIONS]);
}

function renderBindings(): void {
  const list = must('#keyboard-bindings');
  if (!list.childElementCount) list.innerHTML = KEYBOARD_ACTIONS.map(action =>
    `<div class="binding-row"><span class="binding-control">${action in BEND_ACTIONS ? modifierIcon(BEND_ACTIONS[action as keyof typeof BEND_ACTIONS]) : buttonIcon(action as ControllerButton)}<span>${actionLabel(action)}</span></span><button class="action binding-key" type="button" data-binding="${action}" aria-label="Change ${actionLabel(action)} key"><kbd></kbd></button></div>`).join('');
  for (const button of list.querySelectorAll<HTMLButtonElement>('[data-binding]')) {
    const action = button.dataset.binding as KeyboardAction;
    button.querySelector('kbd')!.textContent = bindingTarget === action ? '…' : keyLabel(bindings[action]);
    button.setAttribute('aria-pressed', String(bindingTarget === action));
  }
  for (const key of pad.querySelectorAll<HTMLElement>('[data-button]')) {
    const button = key.dataset.button as ControllerButton;
    key.querySelector('kbd')!.textContent = keyLabel(bindings[button]);
    key.setAttribute('aria-label', `Play ${button}, keyboard ${keyLabel(bindings[button])}`);
    key.title = `${pitchForButton(button).id} · keyboard ${keyLabel(bindings[button])}`;
  }
  for (const label of bends.querySelectorAll<HTMLElement>('[data-bend-label]')) {
    const action = KEYBOARD_ACTIONS.find(action => BEND_ACTIONS[action as keyof typeof BEND_ACTIONS] === Number(label.dataset.bendLabel))!;
    label.textContent = keyLabel(bindings[action]);
  }
}

function saveBindings(): void {
  try {
    localStorage.setItem(KEY_BINDINGS_STORAGE, JSON.stringify(bindings));
    must('#keyboard-status').textContent = 'Keyboard mapping saved.';
  } catch { must('#keyboard-status').textContent = 'Mapping applies for this session; browser storage is unavailable.'; }
}

function cancelBinding(): void {
  if (!bindingTarget) return;
  bindingTarget = null;
  renderBindings();
  must('#keyboard-status').textContent = 'Key assignment cancelled.';
}

must('#keyboard-bindings').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-binding]');
  if (!button || !desktop.matches) return;
  stopPlayback();
  controls.reset();
  clearActive();
  bindingTarget = button.dataset.binding as KeyboardAction;
  renderBindings();
  must('#keyboard-status').textContent = `Press a key for ${actionLabel(bindingTarget)}. Escape cancels.`;
});
must('#reset-bindings').addEventListener('click', () => {
  controls.reset();
  clearActive();
  bindingTarget = null;
  bindings = { ...DEFAULT_BINDINGS };
  saveBindings();
  renderBindings();
});
must<HTMLDetailsElement>('#keyboard-settings').addEventListener('toggle', event => {
  if (!(event.target as HTMLDetailsElement).open) cancelBinding();
});
document.addEventListener('pointerdown', event => {
  if (!(event.target as Element).closest('#keyboard-settings')) cancelBinding();
});
desktop.addEventListener('change', () => { cancelBinding(); controls.reset(); clearActive(); });
renderBindings();

window.addEventListener('focusin', (event) => {
  if (!isEditingTarget(event.target)) return;
  controls.reset();
  clearActive();
});

window.addEventListener('keydown', (event) => {
  if (bindingTarget && desktop.matches) {
    if (event.code === 'Escape' || event.code === 'Tab') {
      if (event.code === 'Escape') event.preventDefault();
      cancelBinding();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    if (event.repeat) return;
    const updated = assignKey(bindings, bindingTarget, event.code);
    if (!updated) {
      must('#keyboard-status').textContent = 'Choose an unused letter, number, arrow or punctuation key.';
      return;
    }
    bindings = updated;
    bindingTarget = null;
    saveBindings();
    renderBindings();
    return;
  }
  if (view !== 'lesson' || isEditingTarget(event.target)) return;
  handleKeyDown(event, controls, bindings);
});

window.addEventListener('keyup', (event) => {
  if (isEditingTarget(event.target)) return;
  const action = actionForCode(bindings, event.code);
  if (action && action in BEND_ACTIONS) {
    event.preventDefault();
    controls.bendUp(`key:${event.code}`);
  } else if (action) {
    controls.noteUp(`key:${event.code}`);
  }
});

window.addEventListener('blur', () => {
  cancelBinding();
  controls.reset();
  clearActive();
});

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
  current = null;
  selectedEntry = null;
  practiceMode = false;
  practiceCursor = 0;
  playbackCursor = 0;
  songArrangement = null;
  renderTab();
  updateLessonHeading();
  showView('lesson');
  practiceStatus.textContent = 'Play any note to start a melody.';
  songHint.textContent = 'Free play recording.';
});

bendsInput.addEventListener('change', () => {
  if (current) renderSource(current);
});

simplifyInput.addEventListener('change', () => {
  if (current) renderSource(current);
});

function highlight(index: number | null): void {
  const next = index === null ? null : playbackIndices[index] ?? null;
  if (next === activeNote) return;
  activeNote = next;
  if (activeNote !== null) {
    playbackCursor = activeNote + 1;
    const nextPassage = passages.findIndex(indices => indices.includes(activeNote!));
    if (nextPassage >= 0) passageIndex = nextPassage;
  }
  renderTab();
}

const playback = new Playback(engine, {
  highlight,
  status: (playing) => {
    isPlaying = playing;
    setPlayLabel(playing ? 'Stop' : 'Play');
  },
  complete: () => {
    if (repeatPassage.checked && view === 'lesson' && current) {
      setPlayLabel('Stop');
      playbackCursor = passages[passageIndex]?.[0] ?? 0;
      practiceCursor = playbackCursor;
      repeatingTimer = window.setTimeout(() => { repeatingTimer = undefined; void replay(); }, 200);
    }
  },
  error: (error) => { practiceStatus.textContent = `Playback failed: ${error instanceof Error ? error.message : 'unknown error'}`; },
});

function stopPlayback(): void {
  window.clearTimeout(repeatingTimer);
  repeatingTimer = undefined;
  playback.stop();
}

function setPlayLabel(label: string): void {
  playButton.querySelector('.stitched-label')!.textContent = label;
  playButton.querySelector('.play-icon')!.innerHTML = threadIcon(label === 'Stop' ? 'stop' : 'play');
}

function replay(): void {
  editor.stopPreview();
  controls.reset();
  clearActive();
  const arrangement = songArrangement ?? (recorded.length ? { title: 'live', tempoBpm: 96, notes: recorded } : null);
  if (!arrangement) { stopPlayback(); return; }
  const cursor = practiceMode ? practiceCursor : playbackCursor;
  const selection = playbackSelection(arrangement, passages[passageIndex] ?? [], cursor, !!current && repeatPassage.checked);
  playbackIndices = selection.indices;
  if (!playbackIndices.length) return;
  playbackBeatMs = 60000 / (selection.arrangement.tempoBpm * Number(playbackRate.value));
  void playback.start(selection.arrangement, Number(playbackRate.value));
}

playButton.addEventListener('click', () => {
  if (playback.playing || repeatingTimer !== undefined) stopPlayback();
  else replay();
});

playbackRate.addEventListener('change', () => {
  const speed = playbackRate.selectedOptions[0]?.text ?? playbackRate.value;
  if (playback.playing) {
    replay();
    practiceStatus.textContent = `Playing at ${speed} speed.`;
  } else {
    practiceStatus.textContent = `Next play at ${speed} speed.`;
  }
});

async function openAudioFile(file: File): Promise<void> {
  const version = audioLoadVersion;
  songHint.textContent = 'Reading the recording…';
  setWorkshopStatus('');
  analysisPhase = 'decoding';
  const audio = await importer.prepareAudio(file);
  if (!audio || version !== audioLoadVersion) return;
  selectedAudio = audio;
  try {
    await editor.setAudio(audio);
    if (version === audioLoadVersion) {
      const message = 'Fragment ready. Preview it if you like, then choose Analyze fragment.';
      songHint.textContent = message;
      setWorkshopStatus(message);
      updateAnalyzeButton();
    }
  } catch (error) {
    if (version !== audioLoadVersion) return;
    closeAudioEditor();
    songHint.textContent = `Could not open the audio editor: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  closeAudioEditor();
  invalidateAudioResult('Preparing file…');
  controls.reset();
  clearActive();
  fileName.textContent = file.name;
  if (/\.midi?$/i.test(file.name)) { analysisPhase = 'importing'; void importer.load(file, audioMode.value as AudioImportMode); }
  else void openAudioFile(file);
  fileInput.value = '';
});

audioMode.addEventListener('change', () => {
  if (selectedAudio) {
    editor.stopPreview();
    invalidateAudioResult('Recording type changed. Choose Analyze fragment to generate a new TAB.');
  }
});

analyzeButton.addEventListener('click', () => {
  const selection = editor.selection;
  if (!selectedAudio || !selection || importer.pending) return;
  editor.stopPreview();
  invalidateAudioResult('');
  analysisPhase = 'analysing';
  void importer.analyzeAudio(selectedAudio, audioMode.value as AudioImportMode, selection);
});

must('#cancel-analysis').addEventListener('click', () => {
  if (analysisPhase === 'analysing') {
    invalidateAudioResult('Analysis cancelled. Adjust the fragment or choose Analyze fragment again.');
  } else {
    closeAudioEditor();
    fileName.textContent = 'No file selected';
    setWorkshopStatus('Loading cancelled. Choose a recording to begin.');
  }
  analyzeButton.focus();
});

analysisDownload.addEventListener('click', () => {
  if (importer.pending || !current?.analysis) return;
  const blob = new Blob([JSON.stringify(current.analysis, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${current.title.replace(/\.[^.]+$/, '')}-analysis.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

function updateProgress(): void {
  const progress = must<HTMLProgressElement>('#progress');
  const position = Math.min(recorded.length, practiceMode ? practiceCursor : playbackCursor);
  progress.max = Math.max(1, recorded.length);
  progress.value = position;
  must('.progress-track').style.setProperty('--progress-position', `${position / Math.max(1, recorded.length) * 100}%`);
  must('#song-progress').hidden = current === null || recorded.length === 0;
  must('#progress-label').textContent = `${position} / ${recorded.length} notes`;
  must('#progress-percent').textContent = `${Math.round(position / Math.max(1, recorded.length) * 100)}%`;
  must('#progress-caption').textContent = practiceMode ? 'Practice progress' : 'Song progress';
  const expected = practiceMode && !isPlaying ? recorded[practiceCursor] : undefined;
  for (const key of pad.querySelectorAll<HTMLElement>('[data-button]')) {
    key.classList.toggle('is-expected', !!expected && key.dataset.button === pitchById(expected.pitch).button);
  }
}

function updateLessonHeading(): void {
  must('#lesson-title').textContent = selectedEntry?.title ?? current?.title ?? 'Free play';
  const universe = must('#lesson-universe');
  universe.innerHTML = threadIcon(selectedEntry?.icon ?? 'music');
  universe.append(document.createTextNode(selectedEntry?.universe ?? (current ? 'Your melody' : 'Your instrument')));
  must('#lesson-meta').textContent = current
    ? [selectedEntry?.version, `${recorded.length} notes`, `${passages.length} ${passages.length === 1 ? 'passage' : 'passages'}`].filter(Boolean).join(' · ')
    : 'Make a little music.';
  const save = must<HTMLButtonElement>('#save-song');
  const saved = !!selectedEntry && catalogue.isSaved(selectedEntry.id);
  save.hidden = selectedEntry === null;
  save.textContent = saved ? '♥ Saved' : '♡ Save';
  save.setAttribute('aria-pressed', String(saved));
  save.setAttribute('aria-label', saved ? 'Remove from saved songs' : 'Save song');
  must('#song-modes').hidden = current === null;
  must('.app').classList.toggle('has-song', current !== null);
  must('#listen-mode').setAttribute('aria-pressed', String(!practiceMode));
  must('#practice-mode').setAttribute('aria-pressed', String(practiceMode));
  must<HTMLButtonElement>('#open-import').disabled = current === null || selectedEntry !== null || importer.pending;
  refreshPracticeStatus();
}

function refreshPracticeStatus(): void {
  if (!current) {
    practiceStatus.textContent = recorded.length ? 'Your melody is ready to play.' : 'Play any note to start a melody.';
  } else if (!practiceMode) {
    practiceStatus.textContent = 'Listen and follow the highlighted button.';
  } else {
    const expected = recorded[practiceCursor];
    practiceStatus.textContent = expected
      ? `Next: ${noteInstruction(pitchById(expected.pitch).button, expected.bend ?? 0)}`
      : 'You reached the end. Choose a passage to practise again.';
  }
}

function practise(button: ControllerButton): void {
  const next = advancePractice(recorded, practiceCursor, button, bend);
  if (next === practiceCursor) {
    const expected = recorded[practiceCursor];
    if (expected) practiceStatus.textContent = `Keep your place. Try ${noteInstruction(pitchById(expected.pitch).button, expected.bend ?? 0)}.`;
    return;
  }
  const passage = passages[passageIndex]!;
  practiceCursor = repeatPassage.checked && next > passage[passage.length - 1]! ? passage[0]! : next;
  const nextPassage = passages.findIndex(indices => indices.includes(practiceCursor));
  if (nextPassage >= 0) passageIndex = nextPassage;
  renderTab();
  refreshPracticeStatus();
}

function selectPassage(index: number): void {
  const resume = playback.playing || repeatingTimer !== undefined;
  stopPlayback();
  controls.reset();
  clearActive();
  passageIndex = Math.max(0, Math.min(passages.length - 1, index));
  practiceCursor = passages[passageIndex]?.[0] ?? 0;
  playbackCursor = practiceCursor;
  activeNote = null;
  renderTab();
  refreshPracticeStatus();
  if (resume) replay();
}

function showView(next: AppView, pushHistory = true): void {
  cancelBinding();
  if (view !== next) {
    stopPlayback();
    controls.reset();
    clearActive();
    editor.stopPreview();
    if (view === 'workshop' && importer.pending) {
      audioLoadVersion++;
      importer.invalidate();
      setWorkshopStatus('Analysis cancelled. Choose Analyze fragment to try again.');
    }
  }
  view = next;
  must('.app').classList.toggle('is-lesson', next === 'lesson');
  for (const name of ['catalog', 'lesson', 'workshop'] as const) {
    must(`#${name}-view`).hidden = next !== name;
  }
  const route = next === 'lesson' && !current ? 'free' : next;
  for (const link of document.querySelectorAll<HTMLElement>('.app-nav [data-view-link]')) {
    if (link.dataset.viewLink === route || next === 'lesson' && current && link.dataset.viewLink === 'catalog') link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (pushHistory && location.hash !== `#${route}`) history.pushState(null, '', `#${route}`);
  if (next === 'lesson') updateLessonHeading();
  document.title = next === 'lesson' && current ? `${selectedEntry?.title ?? current.title} · Ocarina Hero` : 'Ocarina Hero';
  must('#main-content').scrollTop = 0;
}

const catalogue = new SongbookView(must('#catalog-view'), DEMOS, {
  select(entry) {
    selectedEntry = entry;
    practiceMode = false;
    runDemo(entry.track);
    showView('lesson');
  },
  savedChanged: updateLessonHeading,
});

must('#save-song').addEventListener('click', () => {
  if (selectedEntry) catalogue.toggleSaved(selectedEntry.id);
});

must('#practice-mode').addEventListener('click', () => {
  stopPlayback();
  practiceMode = true;
  selectPassage(passageIndex);
  updateLessonHeading();
});
must('#listen-mode').addEventListener('click', () => {
  stopPlayback();
  practiceMode = false;
  renderTab();
  updateLessonHeading();
});
passageSelect.addEventListener('change', () => selectPassage(Number(passageSelect.value)));
must('#previous-passage').addEventListener('click', () => selectPassage(passageIndex - 1));
must('#next-passage').addEventListener('click', () => selectPassage(passageIndex + 1));
must('#restart').addEventListener('click', () => selectPassage(passageIndex));
tab.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('[data-note-index]');
  if (!target) return;
  stopPlayback();
  practiceCursor = Number(target.dataset.noteIndex);
  playbackCursor = practiceCursor;
  renderTab();
  refreshPracticeStatus();
});
repeatPassage.addEventListener('change', () => {
  if (playback.playing) replay();
  if (!repeatPassage.checked && repeatingTimer !== undefined) stopPlayback();
});
must('#open-import').addEventListener('click', () => showView('lesson'));

document.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLElement>('[data-view-link], .brand');
  if (!link) return;
  event.preventDefault();
  const next = link.dataset.viewLink ?? 'catalog';
  if (next === 'free') openFreePlay();
  else if (['catalog', 'lesson', 'workshop'].includes(next)) showView(next as AppView);
});

function openFreePlay(): void {
  if (current) must<HTMLButtonElement>('#clear').click();
  else { practiceMode = false; showView('lesson'); }
}

function restoreView(): void {
  const route = location.hash.slice(1);
  if (route === 'free') openFreePlay();
  else showView(['lesson', 'workshop'].includes(route) ? route as AppView : 'catalog', false);
}
window.addEventListener('popstate', restoreView);
window.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopPlayback(); controls.reset(); clearActive(); editor.stopPreview(); }
});
for (const icon of document.querySelectorAll<HTMLElement>('[data-thread-icon]')) {
  icon.innerHTML = threadIcon(icon.dataset.threadIcon as ThreadIcon);
}
restoreView();
