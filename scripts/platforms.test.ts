import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { PITCHES } from '../src/core/pitches';
import { DEFAULT_PLATFORM, PLATFORM_STORAGE, PLATFORMS, patchIconPath, themeInitScript } from '../src/ui/platforms';
import { THREAD_ICONS } from '../src/ui/thread-icons';

/** Runs the generated pre-paint script against a stored value and returns the `data-theme` it leaves. */
function themeAfterInit(stored: string | null | Error): string | undefined {
  const dataset: Record<string, string> = {};
  const localStorage = {
    getItem(key: string) {
      if (stored instanceof Error) throw stored;
      return key === PLATFORM_STORAGE ? stored : null;
    },
  };
  new Function('localStorage', 'document', themeInitScript())(localStorage, { documentElement: { dataset } });
  return dataset.theme;
}

test('the pre-paint script applies only a saved console other than the default', () => {
  for (const platform of PLATFORMS) {
    assert.equal(themeAfterInit(platform.id), platform === DEFAULT_PLATFORM ? undefined : platform.id);
  }
  assert.equal(themeAfterInit(null), undefined);
  assert.equal(themeAfterInit('unknown'), undefined);
  assert.equal(themeAfterInit(new Error('storage blocked')), undefined);
});

test('every console profile points at art that exists for every glyph, icon and image it can draw', () => {
  const remakeGlyphs = [...PITCHES.map(pitch => pitch.button.toLowerCase()), 'dpad-up', 'dpad-down', 'stick-up', 'stick-down', 'plus'];
  for (const platform of PLATFORMS) {
    const files = [
      ...remakeGlyphs.map(name => `${platform.assets.controller}${platform.glyphs[name] ?? name}.svg`),
      ...THREAD_ICONS.map(name => patchIconPath(platform, name)),
      platform.assets.clef,
      ...Object.values(platform.art),
      platform.picker.art,
    ];
    assert.deepEqual(files.filter(file => !existsSync(`public/${file}`)), [], platform.id);
  }
});

test('every console offers each note exactly once on its on-screen pad', () => {
  const buttons = PITCHES.map(pitch => pitch.button).sort();
  for (const platform of PLATFORMS) {
    const shown = [...platform.pad.shoulders, ...platform.pad.diamond].filter((slot): slot is typeof buttons[number] => typeof slot === 'string' && slot !== 'cell');
    assert.deepEqual(shown.sort(), buttons, platform.id);
  }
});
