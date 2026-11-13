import audioLimits from '../core/audio-limits.json';
import type { AudioSelection, SourceWindow } from '../core/audio-window';
import * as toneMidi from '@tonejs/midi';
const Midi = (toneMidi as unknown as { default?: typeof toneMidi }).default?.Midi ?? toneMidi.Midi;
import { extractMelody } from '../core/midi-import';
import type { MelodyNote } from '../core/project';
import { transcribeAudio, type Transcription } from '../core/transcribe';
import { transcribeWithBasicPitch, type BasicPitchModel, type BasicPitchTranscription } from '../core/basic-pitch';
import { BASIC_PITCH_MODEL_SHA256, loadBrowserBasicPitch } from '../audio/basic-pitch-model';

/** Identifies the Basic Pitch decoding rules in src/core/melody-decoder.ts; change it when they change. */
export const BASIC_PITCH_DECODER = 'basic-pitch-viterbi-v2';

export interface PreparedAudio { readonly file: File; readonly buffer: AudioBuffer }
/** The downloadable record of one audio analysis; times are seconds from the start of the analysed fragment. */
export interface AudioSourceAnalysis {
  sourceWindow?: SourceWindow;
  schemaVersion: 1;
  /** `basic-pitch` is the melody model; `isolated-periodicity` is the fallback detector when the model cannot load or run. */
  engine: { id: 'basic-pitch'; modelSha256: string; decoder: string } | { id: 'isolated-periodicity' };
  sampleRate: number;
  durationSeconds: number;
  notes: readonly MelodyNote[];
  tempoBpm: 60;
  voicedFrameFraction: number;
  contourAvailable: false;
  warnings: string[];
}
export interface ImportedSource {
  title: string;
  subtitle: string;
  tempoBpm: number;
  beatsPerBar: number;
  melody: readonly MelodyNote[];
  preserveTiming?: boolean;
  analysis?: AudioSourceAnalysis;
}
type Context = Pick<AudioContext, 'decodeAudioData' | 'close'>;
interface Dependencies {
  createContext?: () => Context;
  transcribe?: (samples: Float32Array, sampleRate: number) => Transcription | null;
  basicPitch?: () => Promise<BasicPitchModel>;
}

export class SourceImporter {
  private generation = 0;
  private busy = false;
  private prepared: PreparedAudio | undefined;
  constructor(private callbacks: { onSource(source: ImportedSource): void; onStatus(message: string): void; onPending?(pending: boolean): void }, private dependencies: Dependencies = {}) {}

  get pending(): boolean { return this.busy; }

  private setPending(pending: boolean): void {
    if (this.busy === pending) return;
    this.busy = pending;
    this.callbacks.onPending?.(pending);
  }

  invalidate(): void {
    this.generation++;
    this.setPending(false);
  }

  releaseAudio(): void {
    this.invalidate();
    this.prepared = undefined;
  }

  async prepareAudio(file: File): Promise<PreparedAudio | null> {
    this.releaseAudio();
    const generation = this.generation;
    this.setPending(true);
    try {
      const bytes = await file.arrayBuffer();
      if (this.generation !== generation) return null;
      const context = (this.dependencies.createContext ?? (() => new AudioContext()))();
      let buffer: AudioBuffer;
      try { buffer = await context.decodeAudioData(bytes); }
      finally { await context.close(); }
      if (this.generation !== generation) return null;
      return this.prepared = { file, buffer };
    } catch (error) {
      if (this.generation === generation) this.callbacks.onStatus(`Could not decode that audio file: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    } finally {
      if (this.generation === generation) this.setPending(false);
    }
  }

  async analyzeAudio(audio: PreparedAudio, selection: AudioSelection): Promise<void> {
    if (audio !== this.prepared) return;
    const { buffer, file } = audio;
    const { startIndex, endIndex } = selection;
    if (!Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0 || !Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex > buffer.length || endIndex <= startIndex || endIndex - startIndex > Math.floor(audioLimits.maxDurationSeconds * buffer.sampleRate)) {
      this.callbacks.onStatus('Invalid audio window.');
      return;
    }
    await this.runAnalysis(file, buffer, startIndex, endIndex);
  }

  async load(file: File): Promise<void> {
    if (!/\.midi?$/i.test(file.name)) {
      const audio = await this.prepareAudio(file);
      if (audio) await this.analyzeAudio(audio, { startIndex: 0, endIndex: Math.min(audio.buffer.length, Math.floor(audio.buffer.sampleRate * audioLimits.maxDurationSeconds)) });
      return;
    }
    this.releaseAudio();
    await this.runAnalysis(file);
  }

  private async runAnalysis(file: File, buffer?: AudioBuffer, startIndex = 0, endIndex = 0): Promise<void> {
    this.invalidate();
    const generation = this.generation;
    this.setPending(true);
    const current = () => this.generation === generation;
    const status = (message: string) => { if (current()) this.callbacks.onStatus(message); };
    const publish = (source: ImportedSource) => {
      if (!current()) return;
      this.setPending(false);
      this.callbacks.onSource(source);
    };
    try {
      if (/\.midi?$/i.test(file.name)) {
        const midi = new Midi(await file.arrayBuffer());
        if (!current()) return;
        const result = extractMelody(midi);
        if (!result) { status('No melodic track found in that file.'); return; }
        publish({ title: file.name, subtitle: `${result.trackName} · track ${result.trackIndex + 1}/${result.trackCount} · ${result.notes.length} notes`, tempoBpm: midi.header.tempos[0]?.bpm ?? 120, beatsPerBar: 4, melody: result.notes });
        return;
      }
      if (!buffer) return;
      status('Analysing audio…');
      const length = endIndex - startIndex;
      const samples = new Float32Array(length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) samples[i] = samples[i]! + data[startIndex + i]! / buffer.numberOfChannels;
      }
      const duration = length / buffer.sampleRate;
      const common = { schemaVersion: 1 as const, sampleRate: buffer.sampleRate, durationSeconds: duration, tempoBpm: 60 as const, contourAvailable: false as const };
      let result: BasicPitchTranscription | undefined;
      let modelFailure = '';
      try {
        const model = await (this.dependencies.basicPitch ?? loadBrowserBasicPitch)();
        if (!current()) return;
        result = await transcribeWithBasicPitch(samples, buffer.sampleRate, model);
      } catch (error) { modelFailure = error instanceof Error ? error.message : 'unknown error'; }
      if (!current()) return;
      let analysis: AudioSourceAnalysis;
      if (result) {
        if (!result.notes.length) { status('No melody found.'); return; }
        analysis = { ...common, engine: { id: 'basic-pitch', modelSha256: BASIC_PITCH_MODEL_SHA256, decoder: BASIC_PITCH_DECODER }, notes: result.notes.map(note => ({ ...note })), voicedFrameFraction: result.voicedFrameFraction, warnings: [] };
      } else {
        // The periodicity detector reads only clear single-instrument recordings; say why it was used.
        const fallback = (this.dependencies.transcribe ?? transcribeAudio)(samples, buffer.sampleRate);
        if (!fallback?.notes.length) { status(`No melody found. The melody model could not load (${modelFailure}), so the basic detector was used.`); return; }
        analysis = { ...common, engine: { id: 'isolated-periodicity' }, notes: fallback.notes.map(note => ({ ...note })), voicedFrameFraction: fallback.quality, warnings: [`Melody model unavailable (${modelFailure}); used the basic detector.`, 'Continuous reattacks may be unresolved.'] };
      }
      analysis.sourceWindow = { startSeconds: startIndex / buffer.sampleRate, endSeconds: endIndex / buffer.sampleRate, sourceDurationSeconds: buffer.length / buffer.sampleRate };
      const clip = `${(startIndex / buffer.sampleRate).toFixed(2)}–${(endIndex / buffer.sampleRate).toFixed(2)}s selected`;
      const warning = analysis.warnings.length ? ` · ${analysis.warnings.join(' ')}` : '';
      publish({ title: file.name, subtitle: `${analysis.notes.length} source notes · ${Math.round(analysis.voicedFrameFraction * 100)}% voiced frames · ${clip}${warning}`, tempoBpm: 60, beatsPerBar: 4, melody: analysis.notes, preserveTiming: true, analysis });
    } catch (error) {
      status(`Could not read that file: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      if (current()) this.setPending(false);
    }
  }
}
