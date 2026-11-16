import { type KeyBindings, KEY_BINDINGS_STORAGE, readBindings, type KeyboardAction } from '../keyboard';
import { OcarinaEngine } from '../../audio/engine';
import { platform } from '../platform';
import type { Arrangement, Note } from '../../core/ir';
import type { MelodyNote } from '../../core/project';
import type { AudioSourceAnalysis, SourceImporter } from '../import';
import type { AudioFragmentEditor } from '../audio-editor';
import { FreePlayTake, type Combo } from '../lesson';
import type { SongbookEntry } from '../songbook';
import { PROGRESS_STORAGE, readProgress, type Progress } from '../progress';
import { createPreferenceStore, PREFERENCES_STORAGE, readPreferences } from '../preferences';
import { readStored, writeStored } from '../storage';
import { must } from './dom';

export interface Source {
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

export type AppView = 'catalog' | 'popular' | 'lesson' | 'workshop' | 'settings';

export const APP_BASE = import.meta.env.BASE_URL;

export const engine = new OcarinaEngine(() => platform().tuning);

/** Lesson and practice choices; the lesson options and Settings both edit them through this store. */
export const preferences = createPreferenceStore(readStored(PREFERENCES_STORAGE, readPreferences).value, value => writeStored(PREFERENCES_STORAGE, value));

export const recorded: Note[] = [];

export const take = new FreePlayTake(recorded);

export const pad = must<HTMLDivElement>('#pad');

export const bends = must<HTMLDivElement>('#bend-pad');

export const tab = must<HTMLDivElement>('#tab');

export const hint = must<HTMLParagraphElement>('#hint');

export const songHint = must<HTMLParagraphElement>('#song-hint');

export const fileName = must<HTMLSpanElement>('#file-name');

export const fileInput = must<HTMLInputElement>('#file');

export const playbackRate = must<HTMLSelectElement>('#playback-rate');

export const analysisDownload = must<HTMLButtonElement>('#analysis-download');

export const bendsInput = must<HTMLInputElement>('#bends');

export const simplifyInput = must<HTMLInputElement>('#simplify');

export const playButton = must<HTMLButtonElement>('#play');

export const practiceStatus = must<HTMLParagraphElement>('#practice-status');

export const comboBadge = must<HTMLParagraphElement>('#combo');

export const practiceLine = must<HTMLDivElement>('.practice-line');

export const statusSlot = must<HTMLDivElement>('.status-slot');

export const progressTrack = must<HTMLDivElement>('.progress-track');

export const songComplete = must<HTMLDivElement>('#song-complete');

export const nextSongButton = must<HTMLButtonElement>('#next-song');

export const passageSelect = must<HTMLSelectElement>('#passage');

export const repeatPassage = must<HTMLInputElement>('#repeat-passage');

/** What the app's features share while it runs: the view on screen, the song or melody open in the lesson and the practice run over it. */
interface AppState {
  view: AppView;
  /** The Songbook song the lesson shows; null for free play and imported melodies. */
  selectedEntry: SongbookEntry | null;
  current: Source | null;
  songArrangement: Arrangement | null;
  practiceMode: boolean;
  practiceCursor: number;
  combo: Combo;
  playbackCursor: number;
  activeNote: number | null;
  passageIndex: number;
  passages: number[][];
  playbackIndices: number[];
  playbackBeatMs: number;
  renderedWindow: { song: unknown; indices: readonly number[] } | null;
  repeatingTimer: number | undefined;
  isPlaying: boolean;
  /** The bend held on the controller. */
  bend: number;
  progress: Progress;
  bindings: KeyBindings;
  bindingTarget: KeyboardAction | null;
  /** Bumped whenever a loading recording is abandoned, so a slower earlier load drops its result. */
  audioLoadVersion: number;
  importer: SourceImporter | undefined;
  editor: AudioFragmentEditor | undefined;
}

export const state: AppState = {
  view: 'catalog',
  selectedEntry: null,
  current: null,
  songArrangement: null,
  practiceMode: false,
  practiceCursor: 0,
  combo: { streak: 0, best: 0 },
  playbackCursor: 0,
  activeNote: null,
  passageIndex: 0,
  passages: [],
  playbackIndices: [],
  playbackBeatMs: 625,
  renderedWindow: null,
  repeatingTimer: undefined,
  isPlaying: false,
  bend: 0,
  progress: readStored(PROGRESS_STORAGE, readProgress).value,
  bindings: readStored(KEY_BINDINGS_STORAGE, readBindings).value,
  bindingTarget: null,
  audioLoadVersion: 0,
  importer: undefined,
  editor: undefined,
};

