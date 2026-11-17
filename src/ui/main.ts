import { threadIcon, type ThreadIcon } from './thread-icons';
import { bindPad, buildPad } from './features/pad';
import { bindKeyboard } from './features/keyboard';
import { bindLesson } from './features/lesson';
import { bindPlayback } from './features/playback';
import { bindWorkshop } from './features/workshop';
import { bindSongbook } from './features/songbook';
import { bindNavigation, restoreView } from './features/navigation';
import { bindSettings, syncLink } from './features/settings';
import { bindSupport } from './features/support';
import { renderTab } from './features/staff';
import { bindScenes } from './features/scenes';

/** The app's entry: the features own their parts of the page; this wires them in order. */
buildPad();
renderTab();
bindPad();
bindKeyboard();
bindLesson();
bindPlayback();
bindWorkshop();
bindSongbook();
bindNavigation();
for (const icon of document.querySelectorAll<HTMLElement>('[data-thread-icon]')) {
  icon.innerHTML = threadIcon(icon.dataset.threadIcon as ThreadIcon);
}
bindSettings();
bindSupport();
bindScenes();

restoreView();
// After the page has loaded and gone idle, so the first paint and the song lists never wait for the drop.
const startLink = (): void => { if ('requestIdleCallback' in window) window.requestIdleCallback(syncLink); else setTimeout(syncLink, 200); };
if (document.readyState === 'complete') startLink(); else window.addEventListener('load', startLink, { once: true });
