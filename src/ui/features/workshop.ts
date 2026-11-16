import type { PreparedAudio, SourceImporter } from '../import';
import type { AudioFragmentEditor } from '../audio-editor';
import { analysisDownload, bendsInput, fileInput, fileName, playButton, recorded, simplifyInput, songHint, state } from './state';
import { downloadJson, must } from './dom';
import { clearActive, controls } from './pad';
import { renderSource, renderTab, updateLessonHeading } from './staff';
import { stopPlayback } from './playback';
import { showView } from './navigation';

let selectedAudio: PreparedAudio | null = null;

let workshopTools: Promise<{ importer: SourceImporter; editor: AudioFragmentEditor }> | undefined;

/** The Workshop's importer and waveform editor (MIDI parser, audio model, wavesurfer) load on first use, not with every page. */
export function loadWorkshopTools(): Promise<{ importer: SourceImporter; editor: AudioFragmentEditor }> {
  workshopTools ??= Promise.all([import('../import'), import('../audio-editor')]).then(([{ SourceImporter }, { AudioFragmentEditor }]) => {
    state.importer = createImporter(SourceImporter);
    state.editor = createEditor(AudioFragmentEditor);
    return { importer: state.importer, editor: state.editor };
  });
  return workshopTools;
}

const createImporter = (Importer: typeof SourceImporter) => new Importer({
  onSource(source) {
    state.selectedEntry = null;
    state.practiceMode = false;
    fileName.textContent = source.title;
    renderSource(source);
    must<HTMLButtonElement>('#open-import').disabled = false;
    updateLessonHeading();
    showView('lesson');
    if (source.analysis) setWorkshopStatus(`TAB ready: ${source.melody.length} notes. Open the melody to play or practice it.`);
  },
  onStatus(message) {
    songHint.textContent = message;
    setWorkshopStatus(message);
  },
  onPending(pending) {
    state.editor?.setBusy(pending);
    showAnalysisProgress(pending);
    updateAnalyzeButton();
    playButton.disabled = pending || recorded.length === 0;
    analysisDownload.disabled = pending || !state.current?.analysis;
    simplifyInput.disabled = pending || state.current?.fixedNotes !== undefined || !!state.current?.preserveTiming;
    bendsInput.disabled = pending || state.current?.fixedNotes !== undefined;
    must<HTMLButtonElement>('#open-import').disabled = pending || state.current === null || state.selectedEntry !== null;
  },
});

const createEditor = (Editor: typeof AudioFragmentEditor) => new Editor(must<HTMLElement>('#audio-editor'), {
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

export function isImporting(): boolean {
  return state.importer?.pending ?? false;
}

export function setWorkshopStatus(message: string): void {
  must('#workshop-status').textContent = message;
}

function updateAnalyzeButton(): void {
  analyzeButton.disabled = isImporting() || !selectedAudio || !state.editor?.selection;
}

/** Show a determinate-looking but honest loader: a woven spinner plus elapsed time. */
function showAnalysisProgress(pending: boolean): void {
  window.clearInterval(analysisTimer);
  analysisTimer = undefined;
  analysisProgress.hidden = !pending;
  analyzeButton.hidden = pending;
  if (!pending) return;
  const selection = state.editor?.selection;
  const seconds = selection && selectedAudio ? (selection.endIndex - selection.startIndex) / selectedAudio.buffer.sampleRate : 0;
  must('#analysis-progress-label').textContent = analysisPhase === 'decoding'
    ? 'Reading the recording…'
    : analysisPhase === 'importing' ? 'Importing the MIDI melody…' : `Finding the melody in ${seconds.toFixed(1)} s of audio…`;
  const started = performance.now();
  analysisElapsed.textContent = '0 s';
  analysisTimer = window.setInterval(() => { analysisElapsed.textContent = `${Math.floor((performance.now() - started) / 1000)} s`; }, 1000);
}

function invalidateAudioResult(message: string): void {
  state.importer?.invalidate();
  stopPlayback();
  state.current = null;
  state.selectedEntry = null;
  state.songArrangement = null;
  recorded.length = 0;
  analysisDownload.disabled = true;
  renderTab();
  songHint.textContent = message;
  must('#workshop-status').textContent = message;
  must<HTMLButtonElement>('#open-import').disabled = true;
  updateAnalyzeButton();
}

export function closeAudioEditor(): void {
  state.audioLoadVersion++;
  selectedAudio = null;
  state.importer?.releaseAudio();
  state.editor?.clear();
}

async function openAudioFile(file: File): Promise<void> {
  const version = state.audioLoadVersion;
  songHint.textContent = 'Reading the recording…';
  setWorkshopStatus('');
  analysisPhase = 'decoding';
  const { importer, editor } = await loadWorkshopTools();
  if (version !== state.audioLoadVersion) return;
  const audio = await importer.prepareAudio(file);
  if (!audio || version !== state.audioLoadVersion) return;
  selectedAudio = audio;
  try {
    await editor.setAudio(audio);
    if (version === state.audioLoadVersion) {
      const message = 'Fragment ready. Preview it if you like, then choose Analyze fragment.';
      songHint.textContent = message;
      setWorkshopStatus(message);
      updateAnalyzeButton();
    }
  } catch (error) {
    if (version !== state.audioLoadVersion) return;
    closeAudioEditor();
    songHint.textContent = `Could not open the audio editor: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
}

export function bindWorkshop(): void {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    closeAudioEditor();
    invalidateAudioResult('Preparing file…');
    controls.reset();
    clearActive();
    fileName.textContent = file.name;
    if (/\.midi?$/i.test(file.name)) { analysisPhase = 'importing'; void loadWorkshopTools().then(tools => tools.importer.load(file)); }
    else void openAudioFile(file);
    fileInput.value = '';
  });

  analyzeButton.addEventListener('click', () => {
    const selection = state.editor?.selection;
    if (!state.importer || !selectedAudio || !selection || isImporting()) return;
    state.editor?.stopPreview();
    invalidateAudioResult('');
    analysisPhase = 'analysing';
    void state.importer.analyzeAudio(selectedAudio, selection);
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
    if (isImporting() || !state.current?.analysis) return;
    downloadJson(`${state.current.title.replace(/\.[^.]+$/, '')}-analysis.json`, JSON.stringify(state.current.analysis, null, 2));
  });
}
