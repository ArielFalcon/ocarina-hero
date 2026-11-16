import { createHangingLink } from '../hanging-link';
import { clearGone, goneThisSession, markGone } from '../rope';
import { setPracticeFeedback } from '../practice-fx';
import { refreshThreadIcons } from '../thread-icons';
import { onPlatformChange, platform, setPlatform, syncStaticArt } from '../platform';
import { LOCAL_DATA_KEYS, parseSavedExport, savedExport } from '../local-data';
import { readPreferences } from '../preferences';
import { APP_BASE, bendsInput, playbackRate, preferences, simplifyInput, state, tab } from './state';
import { downloadJson, must } from './dom';
import { applyBend, buildPad, renderGamepadStatus, updateHint } from './pad';
import { renderBindings } from './keyboard';
import { refreshPracticeStatus, renderSource, renderTab, updateProgress } from './staff';
import { catalogue, miniPlayer } from './songbook';

const themePicker = must<HTMLFieldSetElement>('#theme-picker');

function syncThemePicker(): void {
  for (const option of themePicker.querySelectorAll<HTMLInputElement>('input[name="theme"]')) option.checked = option.value === platform().id;
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
  if (preferences.get().link) hangingLink.show(goneThisSession(session) ? 'snapped' : 'hanging');
  else hangingLink.hide();
}

/** Every input that shows a preference, in Settings and in the lesson options, reflects the store. */
function showPreferences(): void {
  const current = preferences.get();
  bendsInput.checked = preferenceInputs.bends.checked = current.bends;
  simplifyInput.checked = preferenceInputs.simplify.checked = current.simplify;
  playbackRate.value = preferenceInputs.rate.value = current.rate;
  preferenceInputs.effects.checked = current.effects;
  preferenceInputs.haptics.checked = current.haptics;
  preferenceInputs.link.checked = current.link && !goneThisSession(session);
  setPracticeFeedback(current);
}

const dataStatus = must<HTMLParagraphElement>('#data-status');

export function bindSettings(): void {
  syncStaticArt();

  syncThemePicker();

  themePicker.addEventListener('change', event => setPlatform((event.target as HTMLInputElement).value));

  onPlatformChange(() => {
    syncThemePicker();
    refreshThreadIcons();
    buildPad();
    must('#keyboard-bindings').replaceChildren();
    renderBindings();
    delete tab.dataset.notes;
    state.renderedWindow = null;
    if (state.current) renderSource(state.current);
    else renderTab();
    updateProgress();
    applyBend(state.bend);
    updateHint();
    refreshPracticeStatus();
    renderGamepadStatus();
    miniPlayer.refreshPlatform();
  });

  showPreferences();

  preferences.subscribe((_next, _previous, persisted) => {
    showPreferences();
    if (!persisted) preferenceStatus.textContent = 'Preferences apply for this session; browser storage is unavailable.';
  });

  preferenceInputs.haptics.closest('label')!.hidden = !('vibrate' in navigator);

  preferenceInputs.bends.addEventListener('change', () => preferences.update({ bends: preferenceInputs.bends.checked }));

  preferenceInputs.simplify.addEventListener('change', () => preferences.update({ simplify: preferenceInputs.simplify.checked }));

  preferenceInputs.rate.addEventListener('change', () => preferences.update({ rate: readPreferences({ rate: preferenceInputs.rate.value }).rate }));

  preferenceInputs.effects.addEventListener('change', () => preferences.update({ effects: preferenceInputs.effects.checked }));

  preferenceInputs.haptics.addEventListener('change', () => preferences.update({ haptics: preferenceInputs.haptics.checked }));

  preferenceInputs.link.addEventListener('change', () => {
    if (preferenceInputs.link.checked) clearGone(session);
    preferences.update({ link: preferenceInputs.link.checked });
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
