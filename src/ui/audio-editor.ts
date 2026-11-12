/// <reference types="vite/client" />
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import { selectAudioWindow, type AudioSelection } from '../core/audio-window';
import audioLimits from '../core/audio-limits.json';
import type { PreparedAudio } from './import';
import { threadIcon } from './thread-icons';
import './audio-editor.css';

type EditorCallbacks = {
  onSelectionChange(selection: AudioSelection): void;
  onSelectionReady(selection: AudioSelection | null): void;
  onPreviewStart(): void;
  onEditingFocus(): void;
};

const ZOOM_STEP = 20;
const ZOOM_MAX = 200;

/** Format seconds as m:ss.s for selection labels. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** Owns fragment selection only; analysis is started by the Workshop view. */
export class AudioFragmentEditor {
  private wave: WaveSurfer | null = null;
  private region: Region | null = null;
  private audio: PreparedAudio | null = null;
  private selected: AudioSelection | null = null;
  private generation = 0;
  private busy = false;
  private readonly abort = new AbortController();
  private readonly root: HTMLElement;
  private readonly filename: HTMLElement;
  private readonly duration: HTMLElement;
  private readonly waveform: HTMLElement;
  private readonly start: HTMLInputElement;
  private readonly end: HTMLInputElement;
  private readonly summary: HTMLElement;
  private readonly meter: HTMLElement;
  private readonly preview: HTMLButtonElement;
  private readonly previewIcon: HTMLElement;
  private readonly previewLabel: HTMLSpanElement;
  private readonly zoom: HTMLInputElement;
  private readonly zoomOut: HTMLButtonElement;
  private readonly zoomIn: HTMLButtonElement;
  private readonly status: HTMLElement;

  constructor(private readonly container: HTMLElement, private readonly callbacks: EditorCallbacks) {
    const max = audioLimits.maxDurationSeconds;
    container.innerHTML = `<section class="audio-editor" aria-label="Audio fragment editor" hidden>
      <div class="audio-editor-head">
        <p class="audio-editor-file"><span class="audio-editor-name"></span> <span class="audio-editor-duration"></span></p>
        <div class="audio-editor-zoom" role="group" aria-label="Waveform zoom">
          <button type="button" class="step audio-editor-zoom-out" aria-label="Zoom out">−</button>
          <input type="range" min="0" max="${ZOOM_MAX}" step="10" value="0" aria-label="Waveform zoom">
          <button type="button" class="step audio-editor-zoom-in" aria-label="Zoom in">+</button>
        </div>
      </div>
      <div class="audio-editor-wave-frame"><div class="audio-editor-wave" aria-label="Audio waveform"></div></div>
      <p class="audio-editor-hint">Drag the highlighted band to move it, or drag its edges to resize it (up to ${max} seconds).</p>
      <div class="audio-editor-selection">
        <div class="audio-editor-bounds">
          <div class="field"><label for="audio-editor-start">Start (s)</label><span class="input-frame"><input id="audio-editor-start" class="audio-editor-start" type="number" min="0" step="0.1" inputmode="decimal"></span></div>
          <div class="field"><label for="audio-editor-end">End (s)</label><span class="input-frame"><input id="audio-editor-end" class="audio-editor-end" type="number" min="0" step="0.1" inputmode="decimal"></span></div>
        </div>
        <div class="audio-editor-length">
          <p class="audio-editor-summary"></p>
          <div class="audio-editor-meter" aria-hidden="true"><span></span></div>
        </div>
        <button type="button" class="audio-editor-preview action"><span class="audio-editor-preview-icon"></span><span class="stitched-label">Play selection</span></button>
      </div>
      <p class="audio-editor-status" role="status" aria-live="polite"></p>
    </section>`;
    const find = <T extends HTMLElement>(selector: string): T => container.querySelector<T>(selector)!;
    this.root = find('.audio-editor');
    this.filename = find('.audio-editor-name');
    this.duration = find('.audio-editor-duration');
    this.waveform = find('.audio-editor-wave');
    this.start = find('.audio-editor-start');
    this.end = find('.audio-editor-end');
    this.summary = find('.audio-editor-summary');
    this.meter = find('.audio-editor-meter span');
    this.preview = find('.audio-editor-preview');
    this.previewIcon = find('.audio-editor-preview-icon');
    this.previewLabel = this.preview.querySelector('.stitched-label')!;
    this.zoom = find('.audio-editor-zoom input');
    this.zoomOut = find('.audio-editor-zoom-out');
    this.zoomIn = find('.audio-editor-zoom-in');
    this.status = find('.audio-editor-status');
    this.setPreviewing(false);
    const signal = this.abort.signal;
    container.addEventListener('focusin', () => callbacks.onEditingFocus(), { signal });
    for (const field of [this.start, this.end]) field.addEventListener('change', () => this.acceptFields(), { signal });
    this.preview.addEventListener('click', () => {
      if (!this.wave || !this.region) return;
      if (this.wave.isPlaying()) { this.stopPreview(); return; }
      callbacks.onPreviewStart();
      const generation = this.generation;
      void this.wave.play(this.region.start, this.region.end).catch(() => {
        if (generation === this.generation) this.setStatus('Unable to play this selection.');
      });
    }, { signal });
    const applyZoom = () => this.wave?.zoom(Number(this.zoom.value));
    this.zoom.addEventListener('input', () => { applyZoom(); this.updateControls(); }, { signal });
    const stepZoom = (delta: number) => {
      this.zoom.value = String(Math.max(0, Math.min(ZOOM_MAX, Number(this.zoom.value) + delta)));
      applyZoom();
      this.updateControls();
    };
    this.zoomOut.addEventListener('click', () => stepZoom(-ZOOM_STEP), { signal });
    this.zoomIn.addEventListener('click', () => stepZoom(ZOOM_STEP), { signal });
    this.updateControls();
  }

  get selection(): AudioSelection | null { return this.selected; }

  async setAudio(audio: PreparedAudio): Promise<void> {
    this.clear();
    const generation = this.generation;
    this.audio = audio;
    this.root.hidden = false;
    this.filename.textContent = audio.file.name;
    this.duration.textContent = `· ${formatClock(audio.buffer.duration)} total`;
    this.setStatus('Loading waveform…');
    const colors = getComputedStyle(this.container);
    const cream = colors.getPropertyValue('--text').trim();
    const regions = RegionsPlugin.create();
    const timeline = TimelinePlugin.create({ height: 18, timeInterval: 1, primaryLabelInterval: 5, secondaryLabelOpacity: 0, style: { color: cream, fontSize: '12px', fontFamily: 'Georgia, serif' } });
    const wave = WaveSurfer.create({ container: this.waveform, height: 104, waveColor: colors.getPropertyValue('--accent').trim(), progressColor: cream, cursorColor: cream, cursorWidth: 1, barWidth: 2, barGap: 1, barRadius: 1, plugins: [regions, timeline] });
    this.wave = wave;
    wave.on('play', () => this.setPreviewing(true));
    wave.on('pause', () => this.setPreviewing(false));
    wave.on('finish', () => this.setPreviewing(false));
    regions.on('region-update', region => { this.stopPreview(); this.renderSummary(region.start, region.end); });
    regions.on('region-updated', region => this.acceptBounds(region.start, region.end));
    const { buffer } = audio;
    const count = Math.min(buffer.length, Math.max(1, Math.min(20000, Math.ceil(buffer.duration * 100))));
    const peaks = new Float32Array(count);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < count; i++) {
        const end = Math.floor((i + 1) * data.length / count);
        for (let j = Math.floor(i * data.length / count); j < end; j++) peaks[i] = Math.max(peaks[i]!, Math.abs(data[j]!));
      }
    }
    try {
      await wave.loadBlob(audio.file, [peaks], buffer.duration);
      if (generation !== this.generation) return;
      this.selected = selectAudioWindow(buffer, 0, Math.min(audioLimits.maxDurationSeconds, buffer.duration));
      this.region = regions.addRegion({ start: this.selected.startIndex / buffer.sampleRate, end: this.selected.endIndex / buffer.sampleRate, drag: true, resize: true, maxLength: audioLimits.maxDurationSeconds, color: colors.getPropertyValue('--accent-soft').trim() });
      this.syncSelection();
      this.setStatus('');
      this.updateControls();
      this.callbacks.onSelectionReady(this.selected);
    } catch (error) {
      if (generation !== this.generation) return;
      wave.destroy();
      this.wave = null;
      this.audio = null;
      this.setStatus('Unable to load the audio waveform.');
      this.updateControls();
      throw error;
    }
  }

  /** Lock editing while the selected fragment is being analysed. */
  setBusy(busy: boolean): void {
    this.busy = busy;
    this.region?.setOptions({ drag: !busy, resize: !busy });
    this.root.classList.toggle('is-busy', busy);
    this.updateControls();
  }

  setStatus(message: string): void { this.status.textContent = message; }
  stopPreview(): void { this.wave?.pause(); this.setPreviewing(false); }

  clear(): void {
    const hadSelection = this.selected !== null;
    this.generation++;
    this.stopPreview();
    this.wave?.destroy();
    this.wave = null;
    this.region = null;
    this.audio = null;
    this.selected = null;
    this.busy = false;
    this.root.classList.remove('is-busy');
    this.zoom.value = '0';
    this.root.hidden = true;
    this.setStatus('');
    this.updateControls();
    if (hadSelection) this.callbacks.onSelectionReady(null);
  }

  destroy(): void { this.clear(); this.abort.abort(); this.container.replaceChildren(); }

  private setPreviewing(playing: boolean): void {
    this.previewLabel.textContent = playing ? 'Stop preview' : 'Play selection';
    this.previewIcon.innerHTML = threadIcon(playing ? 'stop' : 'play');
  }

  private acceptFields(): void {
    if (!this.start.value || !this.end.value) { this.rejectBounds(); return; }
    this.acceptBounds(Number(this.start.value), Number(this.end.value));
  }

  private acceptBounds(start: number, end: number): void {
    if (!this.audio || !this.selected) return;
    let next: AudioSelection;
    try { next = selectAudioWindow(this.audio.buffer, start, end); }
    catch { this.rejectBounds(); return; }
    const changed = next.startIndex !== this.selected.startIndex || next.endIndex !== this.selected.endIndex;
    this.stopPreview();
    this.selected = next;
    this.syncSelection();
    this.setStatus('');
    if (changed) this.callbacks.onSelectionChange(next);
  }

  private rejectBounds(): void {
    this.stopPreview();
    this.syncSelection();
    this.setStatus(`Enter a fragment inside the recording, up to ${audioLimits.maxDurationSeconds} seconds long.`);
  }

  private renderSummary(start: number, end: number): void {
    const max = audioLimits.maxDurationSeconds;
    const length = Math.max(0, end - start);
    this.summary.textContent = `${formatClock(start)} – ${formatClock(end)} · ${length.toFixed(1)} of ${max} s`;
    this.meter.style.width = `${Math.min(100, length / max * 100)}%`;
  }

  private syncSelection(): void {
    if (!this.selected || !this.audio) return;
    const { startIndex, endIndex } = this.selected;
    const rate = this.audio.buffer.sampleRate;
    const start = startIndex / rate;
    const end = endIndex / rate;
    this.start.value = String(Math.round(start * 100) / 100);
    this.end.value = String(Math.round(end * 100) / 100);
    this.start.max = String(this.audio.buffer.duration);
    this.end.max = String(this.audio.buffer.duration);
    this.renderSummary(start, end);
    this.region?.setOptions({ start, end });
  }

  private updateControls(): void {
    const disabled = !this.selected || this.busy;
    this.start.disabled = disabled;
    this.end.disabled = disabled;
    this.preview.disabled = disabled;
    this.zoom.disabled = disabled;
    this.zoomOut.disabled = disabled || Number(this.zoom.value) <= 0;
    this.zoomIn.disabled = disabled || Number(this.zoom.value) >= ZOOM_MAX;
  }
}
