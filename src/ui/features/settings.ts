import { createHangingLink } from '../hanging-link';
import { clearGone, goneThisSession, markGone } from '../rope';
import { setPracticeFeedback } from '../practice-fx';
import { refreshThreadIcons } from '../thread-icons';
import { currentTheme, setTheme, syncStaticArt } from '../theme';
import { PREFERENCES_STORAGE, type Preferences } from '../preferences';
import { LOCAL_DATA_KEYS, parseSavedExport, savedExport } from '../local-data';
import { APP_BASE, bendsInput, playbackRate, simplifyInput, state, tab } from './state';
import { downloadJson, must } from './dom';
import { applyBend, buildPad, renderGamepadStatus, updateHint } from './pad';
import { renderBindings } from './keyboard';
import { refreshPracticeStatus, renderTab, updateProgress } from './staff';
import { catalogue, miniPlayer } from './songbook';

const themePicker = must<HTMLFieldSetElement>('#theme-picker');

function syncThemePicker(): void {
  for (const option of themePicker.querySelectorAll<HTMLInputElement>('input[name="theme"]')) option.checked = option.value === currentTheme();
}

const preferenceStatus = must<HTMLParagraphElement>('#preferences-status');

const preferenceInputs = {
  bends: must<HTMLInputElement>('#pref-bends'),
  simplify: must<HTMLInputElement>('#pref-simplify'),
  rate: must<HTMLSelectElement>('#pref-rate'),
  effects: must<HTMLInputElement>('#pref-effects'),
  haptics: must<HTMLInputElement>('#pref-haptics'),
  link: must<HTMLInputElement>('#pref-link'),
};

/** Session storage can be blocked; without it the figure simply returns on every load. */
const session: Storage | undefined = (() => { try { return window.sessionStorage; } catch { return undefined; } })();

const hangingLink = createHangingLink(must('.app'), {
  src: `${APP_BASE}art/link-hanging.webp`,
  onGone() { markGone(session); preferenceInputs.link.checked = false; },
  onRestore() { clearGone(session); preferenceInputs.link.checked = true; },
});

export function syncLink(): void {
  if (state.preferences.link) hangingLink.show(goneThisSession(session) ? 'snapped' : 'hanging');
  else hangingLink.hide();
}

function showPreferences(): void {
  bendsInput.checked = preferenceInputs.bends.checked = state.preferences.bends;
  simplifyInput.checked = preferenceInputs.simplify.checked = state.preferences.simplify;
  playbackRate.value = preferenceInputs.rate.value = state.preferences.rate;
  preferenceInputs.effects.checked = state.preferences.effects;
  preferenceInputs.haptics.checked = state.preferences.haptics;
  preferenceInputs.link.checked = state.preferences.link && !goneThisSession(session);
  setPracticeFeedback(state.preferences);
}

export function savePreferences(next: Preferences): void {
  state.preferences = next;
  showPreferences();
  try { localStorage.setItem(PREFERENCES_STORAGE, JSON.stringify(state.preferences)); }
  catch { preferenceStatus.textContent = 'Preferences apply for this session; browser storage is unavailable.'; }
}

const dataStatus = must<HTMLParagraphElement>('#data-status');

export function bindSettings(): void {
  syncStaticArt();

  syncThemePicker();

  themePicker.addEventListener('change', event => setTheme((event.target as HTMLInputElement).value === 'retro' ? 'retro' : 'tapestry'));

  document.addEventListener('themechange', () => {
    syncThemePicker();
    refreshThreadIcons();
    buildPad();
    must('#keyboard-bindings').replaceChildren();
    renderBindings();
    delete tab.dataset.notes;
    state.renderedWindow = null;
    renderTab();
    updateProgress();
    applyBend(state.bend);
    updateHint();
    refreshPracticeStatus();
    renderGamepadStatus();
    miniPlayer.refreshTheme();
  });

  showPreferences();

  preferenceInputs.haptics.closest('label')!.hidden = !('vibrate' in navigator);

  for (const [preference, lessonInput] of [[preferenceInputs.bends, bendsInput], [preferenceInputs.simplify, simplifyInput], [preferenceInputs.rate, playbackRate]] as const) {
    preference.addEventListener('change', () => {
      if (preference instanceof HTMLInputElement) (lessonInput as HTMLInputElement).checked = preference.checked;
      else lessonInput.value = preference.value;
      lessonInput.dispatchEvent(new Event('change'));
    });
  }

  preferenceInputs.effects.addEventListener('change', () => savePreferences({ ...state.preferences, effects: preferenceInputs.effects.checked }));

  preferenceInputs.haptics.addEventListener('change', () => savePreferences({ ...state.preferences, haptics: preferenceInputs.haptics.checked }));

  preferenceInputs.link.addEventListener('change', () => {
    if (preferenceInputs.link.checked) clearGone(session);
    savePreferences({ ...state.preferences, link: preferenceInputs.link.checked });
    syncLink();
  });

  must('#export-saved').addEventListener('click', () => {
    const ids = catalogue.savedIds();
    if (!ids.length) { dataStatus.textContent = 'There are no saved songs to export yet.'; return; }
    downloadJson('ocarina-hero-saved-songs.json', savedExport(ids));
    dataStatus.textContent = `Exported ${ids.length} saved ${ids.length === 1 ? 'song' : 'songs'}.`;
  });

  must<HTMLInputElement>('#import-saved').addEventListener('change', async event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const ids = parseSavedExport(await file.text(), new Set(catalogue.entries.map(entry => entry.id)));
      const added = catalogue.importSaved(ids);
      dataStatus.textContent = added ? `Added ${added} ${added === 1 ? 'song' : 'songs'} to Saved.` : 'Every song in that file is already saved.';
    } catch {
      dataStatus.textContent = 'That file is not an Ocarina Hero saved-songs export.';
    }
  });

  must('#clear-data').addEventListener('click', () => {
    if (!window.confirm('Remove saved songs, progress, keyboard keys, preferences and the chosen look from this browser?')) return;
    try { for (const key of LOCAL_DATA_KEYS) localStorage.removeItem(key); }
    catch { dataStatus.textContent = 'Browser storage is unavailable, so there is nothing stored to clear.'; return; }
    location.reload();
  });
}
