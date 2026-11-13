import type { ControlScheme } from '../core/tab';

/** Tapestry evokes the 2026 remake; retro evokes the 1998 N64 original. */
export type Theme = 'tapestry' | 'retro';

/** Read before first paint by public/theme-init.js; keep both in sync. */
export const THEME_STORAGE = 'ocarina-hero:theme';

const THEME_COLORS: Record<Theme, string> = { tapestry: '#293529', retro: '#14120d' };

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'retro' ? 'retro' : 'tapestry';
}

export function controlScheme(): ControlScheme {
  return currentTheme() === 'retro' ? 'n64' : 'switch';
}

/** Base path of an asset set for a theme; retro files mirror the tapestry names. */
export function assetDir(set: 'icons' | 'controller'): string {
  const base = import.meta.env.BASE_URL;
  const theme = currentTheme();
  if (set === 'icons') return `${base}art/${theme === 'retro' ? 'icons-retro' : 'icons'}/`;
  return `${base}icons/${theme === 'retro' ? 'controller-retro' : 'controller'}/`;
}

/**
 * Switch theme in place. Static images swap through `data-retro-src`;
 * rendered views listen for `themechange` and re-render their own labels and icons.
 */
export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  try { localStorage.setItem(THEME_STORAGE, theme); } catch { /* storage unavailable: the choice lasts for this session */ }
  syncStaticArt();
  document.dispatchEvent(new Event('themechange'));
}

/** Point static markup images (`data-retro-src`) and the browser theme color at the active theme. */
export function syncStaticArt(): void {
  const theme = currentTheme();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  for (const image of document.querySelectorAll<HTMLImageElement>('img[data-retro-src]')) {
    image.dataset.tapestrySrc ??= image.getAttribute('src') ?? '';
    image.setAttribute('src', theme === 'retro' ? image.dataset.retroSrc! : image.dataset.tapestrySrc);
  }
}
