import { pitchById, type ControllerButton } from '../../core/pitches';
import { noteInstruction } from '../../core/tab';
import { advancePractice, comboTier, scoreCombo, type ComboMilestone } from '../lesson';
import { centreIn, haptic, retrigger, ribbon, sparkBurst, stitchRipple } from '../practice-fx';
import { controlScheme } from '../theme';
import { nextSong } from '../featured';
import { completedIds, markPractice, PROGRESS_STORAGE, type Progress } from '../progress';
import { bends, comboBadge, nextSongButton, pad, practiceLine, practiceStatus, progressTrack, recorded, repeatPassage, songComplete, state, statusSlot, tab } from './state';
import { clearActive, controls } from './pad';
import { refreshPracticeStatus, renderLessonMeta, renderTab } from './staff';
import { playback, replay, stopPlayback } from './playback';
import { catalogue } from './songbook';

let comboHideTimer: number | undefined;

/** One-shot motions of the combo slot; only one plays at a time. */
function moveCombo(motion: 'is-entering' | 'is-bumped' | 'is-raised' | 'is-broken'): void {
  comboBadge.classList.remove('is-entering', 'is-bumped', 'is-raised', 'is-broken');
  retrigger(comboBadge, motion);
}

/**
 * Show the running streak from the second hit: the slot is sewn in, each hit rolls the
 * count, a new tier stamps the slot and a broken streak drops away.
 */
export function renderCombo(broken = false): void {
  window.clearTimeout(comboHideTimer);
  comboBadge.classList.remove('is-broken');
  if (broken && !comboBadge.hidden) {
    moveCombo('is-broken');
    comboHideTimer = window.setTimeout(() => { comboBadge.hidden = true; comboBadge.classList.remove('is-broken'); }, 500);
    return;
  }
  const visible = state.practiceMode && state.combo.streak >= 2;
  const count = comboBadge.querySelector('.combo-count')!;
  const entering = comboBadge.hidden;
  comboBadge.hidden = !visible;
  if (!visible) { count.textContent = ''; return; }
  if (count.textContent === `×${state.combo.streak}`) return;
  const tier = String(comboTier(state.combo.streak));
  const raised = !entering && comboBadge.dataset.tier !== tier;
  comboBadge.dataset.tier = tier;
  count.textContent = `×${state.combo.streak}`;
  retrigger(count, 'is-rolled');
  moveCombo(entering ? 'is-entering' : raised ? 'is-raised' : 'is-bumped');
  if (raised) stitchRipple(comboBadge);
}

export function resetCombo(): void {
  state.combo = { streak: 0, best: state.combo.best };
  renderCombo();
}

/** Reward a correct note: sparks on the staff, a ripple on the pressed controls, ribbons at milestones. */
function rewardHit(point: { x: number; y: number } | null, button: ControllerButton, noteBend: number, milestone: ComboMilestone | null, cleared: boolean, finished: boolean): void {
  const tier = comboTier(state.combo.streak);
  if (point) sparkBurst(tab, point, tier);
  stitchRipple(pad.querySelector(`[data-button="${button}"]`));
  if (noteBend) stitchRipple(bends.querySelector(`[data-bend="${noteBend}"]`));
  retrigger(progressTrack, 'is-hit');
  if (cleared || finished) retrigger(progressTrack, 'is-swept');
  if (finished) {
    ribbon(practiceLine, 'Song complete', state.combo.best > 1 ? `Best combo ×${state.combo.best}` : '', 'song');
    haptic([18, 50, 18, 50, 40]);
  } else if (milestone) {
    ribbon(statusSlot, `${milestone.label}!`, '', 'combo');
    haptic([14, 40, 22]);
  } else if (cleared) {
    ribbon(statusSlot, 'Passage clear', '', 'passage');
    haptic([10, 30, 10]);
  } else {
    haptic(8);
  }
}

export function saveProgress(next: Progress): void {
  state.progress = next;
  try { localStorage.setItem(PROGRESS_STORAGE, JSON.stringify(state.progress)); }
  catch { catalogue.noteSessionOnly(); }
}

function recordPractice(finished: boolean): void {
  if (!state.selectedEntry) return;
  const next = markPractice(state.progress, state.selectedEntry.id, { finished, bestCombo: state.combo.best });
  if (next === state.progress) return;
  saveProgress(next);
  renderLessonMeta();
}

/** After the last note, offer another run and the next song of the same collection. */
function offerNextStep(): void {
  const upcoming = state.selectedEntry && nextSong(catalogue.entries, state.selectedEntry.id, completedIds(state.progress));
  nextSongButton.hidden = !upcoming;
  if (upcoming) {
    nextSongButton.querySelector('.stitched-label')!.textContent = upcoming.title;
    nextSongButton.setAttribute('aria-label', `Next song: ${upcoming.title}`);
    nextSongButton.dataset.song = upcoming.id;
  }
  songComplete.hidden = false;
}

export function practiceNote(button: ControllerButton): void {
  const expected = recorded[state.practiceCursor];
  if (!expected) return;
  const next = advancePractice(recorded, state.practiceCursor, button, state.bend);
  const result = scoreCombo(state.combo, next !== state.practiceCursor);
  state.combo = result.combo;
  if (next === state.practiceCursor) {
    retrigger(pad.querySelector(`[data-button="${button}"]`), 'is-miss');
    if (result.broken) haptic(24);
    renderCombo(result.broken);
    practiceStatus.textContent = `${result.broken ? 'Combo broken · try' : 'Keep your place. Try'} ${noteInstruction(pitchById(expected.pitch).button, expected.bend ?? 0, controlScheme())}.`;
    return;
  }
  const hitIndex = state.practiceCursor;
  const passage = state.passages[state.passageIndex]!;
  const cleared = next > passage[passage.length - 1]!;
  const finished = next >= recorded.length;
  state.practiceCursor = repeatPassage.checked && cleared ? passage[0]! : next;
  const nextPassage = state.passages.findIndex(indices => indices.includes(state.practiceCursor));
  if (nextPassage >= 0) state.passageIndex = nextPassage;
  renderTab();
  renderCombo();
  const stillDrawnHit = centreIn(tab, tab.querySelector(`[data-note-index="${hitIndex}"]`));
  const songFinished = finished && !repeatPassage.checked;
  rewardHit(stillDrawnHit, button, expected.bend ?? 0, result.milestone, cleared, songFinished);
  refreshPracticeStatus(result.milestone ? `${result.milestone.label}! ` : '');
  recordPractice(songFinished);
  if (songFinished) offerNextStep();
}

export function selectPassage(index: number): void {
  const resume = playback.playing || state.repeatingTimer !== undefined;
  stopPlayback();
  controls.reset();
  clearActive();
  state.passageIndex = Math.max(0, Math.min(state.passages.length - 1, index));
  songComplete.hidden = true;
  state.practiceCursor = state.passages[state.passageIndex]?.[0] ?? 0;
  state.playbackCursor = state.practiceCursor;
  state.activeNote = null;
  resetCombo();
  renderTab();
  refreshPracticeStatus();
  if (resume) replay();
}
