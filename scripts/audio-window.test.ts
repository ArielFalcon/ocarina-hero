import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAudioWindow } from '../src/core/audio-window';

test('selects sample boundaries and rejects invalid windows', () => {
  const buffer = { sampleRate: 10, length: 200, duration: 20 };
  assert.deepEqual(selectAudioWindow(buffer, 1.19, 2.09), { startIndex: 11, endIndex: 20 });
  for (const [start, end] of [[-1, 1], [1, 1], [0, 15.1], [0, 21], [NaN, 1], [1, 1.01]]) {
    assert.throws(() => selectAudioWindow(buffer, start!, end!));
  }
  assert.deepEqual(selectAudioWindow(buffer, 5, 20), { startIndex: 50, endIndex: 200 });
});

test('accepts decimal fifteen-second windows but rejects one extra sample', () => {
  for (const sampleRate of [44100, 48000]) {
    const buffer = { sampleRate, length: sampleRate * 30, duration: 30 };
    const selection = selectAudioWindow(buffer, 1.01, 16.01);
    assert.equal(selection.endIndex - selection.startIndex, sampleRate * 15);
    assert.throws(() => selectAudioWindow(buffer, 1.01, 16.01 + 1 / sampleRate));
  }
});

test('sample-boundary round trips do not move the untouched crop edge', () => {
  for (const sampleRate of [44100, 48000]) {
    const buffer = { sampleRate, length: sampleRate * 4, duration: 4 };
    const original = selectAudioWindow(buffer, 0.00058, 1.5);
    const changedEnd = selectAudioWindow(buffer, original.startIndex / sampleRate, 2);
    assert.equal(changedEnd.startIndex, original.startIndex);
    const changedStart = selectAudioWindow(buffer, 0, original.endIndex / sampleRate);
    assert.equal(changedStart.endIndex, original.endIndex);
    assert.equal(selectAudioWindow(buffer, (27 - 0.000001) / sampleRate, 2).startIndex, 26);
  }
});
