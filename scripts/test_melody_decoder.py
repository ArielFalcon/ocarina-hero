"""Decoder rules for Main melody. Run: .runtime-melody/venv/bin/python -m unittest discover -s scripts -p 'test_*.py'"""
import pathlib
import sys
import unittest

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import melody_decoder as md

HOP = 256 / 44100
LO = md.MIDI_LOW


def salience(frames, notes, base=0.9):
    """Unvoiced-dominant salience with (midi, first, last, score) islands."""
    p = np.full((md.MIDI_HIGH - LO + 1, frames), 1e-4)
    u = np.full(frames, base)
    for midi, first, last, score in notes:
        p[midi - LO, first:last] = score
        u[first:last] = 1 - score
    return u, p


def runs(path):
    out, start = [], 0
    for i in range(1, len(path) + 1):
        if i == len(path) or path[i] != path[start]:
            if path[start] >= 0:
                out.append((int(path[start]), start, i))
            start = i
    return out


class DecoderTest(unittest.TestCase):
    def test_absorbs_one_frame_excursion_inside_sustained_note(self):
        u, p = salience(200, [(72, 20, 180, 0.8)])
        p[72 - LO, 100] = 0.05
        p[79 - LO, 100] = 0.9
        self.assertEqual(runs(md.decode(u, p, None, HOP)), [(72, 20, 180)])

    def test_drops_isolated_blip_shorter_than_minimum_and_keeps_longer_note(self):
        blip = int(0.05 / HOP)
        note = int(0.15 / HOP)
        u, p = salience(200, [(70, 20, 20 + blip, 0.9), (74, 100, 100 + note, 0.9)])
        self.assertEqual(runs(md.decode(u, p, None, HOP)), [(74, 100, 100 + note)])

    def test_keeps_real_pitch_change_at_its_boundary(self):
        change = 60 + int(0.15 / HOP)
        u, p = salience(200, [(72, 60, change, 0.8), (76, change, 160, 0.8)])
        got = runs(md.decode(u, p, None, HOP))
        self.assertEqual([r[0] for r in got], [72, 76])
        self.assertLessEqual(abs(got[0][2] - change), 2)

    def test_basic_pitch_evidence_selects_the_melody_over_a_stronger_accompaniment_bin(self):
        u, p = salience(200, [(60, 20, 180, 0.6)])
        p[72 - LO, 20:180] = 0.4
        b = np.zeros_like(p)
        b[72 - LO, 20:180] = 0.9
        self.assertEqual([r[0] for r in runs(md.decode(u, p, None, HOP))], [60])
        self.assertEqual([r[0] for r in runs(md.decode(u, p, b, HOP))], [72])

    def test_silence_stays_unvoiced_with_or_without_basic_pitch(self):
        u, p = salience(150, [])
        self.assertTrue((md.decode(u, p, None, HOP) < 0).all())
        self.assertTrue((md.decode(u, p, np.zeros_like(p), HOP) < 0).all())

    def test_weak_basic_pitch_floor_without_melody_stays_unvoiced_even_after_a_click(self):
        u, p = salience(300, [], base=0.5)
        p[60 - LO, 150] = 0.8  # one loud click frame raises the clip's SegNet maximum
        floor = np.full_like(p, 0.2)
        self.assertTrue((md.decode(u, p, floor, HOP) < 0).all())

    def test_one_confident_basic_pitch_note_voices_frames_segnet_calls_unvoiced(self):
        u, p = salience(300, [], base=0.6)
        p[72 - LO, 40:260] = 0.05
        b = np.zeros_like(p)
        b[72 - LO, 40:260] = 0.5
        self.assertEqual(runs(md.decode(u, p, b, HOP)), [(72, 40, 260)])

    def test_slightly_stronger_short_excursion_does_not_fragment_a_held_note(self):
        u, p = salience(300, [(72, 20, 280, 0.8)])
        excursion = int(0.12 / HOP)
        p[72 - LO, 140:140 + excursion] = 0.75
        p[74 - LO, 140:140 + excursion] = 0.8
        self.assertEqual(runs(md.decode(u, p, None, HOP)), [(72, 20, 280)])

    def test_short_run_is_absorbed_by_the_longer_touching_neighbour(self):
        a, x, b = int(0.3 / HOP), int(0.05 / HOP), int(0.15 / HOP)
        u, p = salience(400, [(70, 10, 10 + a, 0.9), (80, 10 + a, 10 + a + x, 0.9), (74, 10 + a + x, 10 + a + x + b, 0.9)])
        self.assertEqual(runs(md.decode(u, p, None, HOP)), [(70, 10, 10 + a + x), (74, 10 + a + x, 10 + a + x + b)])

    def test_basic_pitch_grid_maps_piano_keys_to_midi_on_the_segnet_clock(self):
        bp_times = np.arange(100) / md.BP_FPS
        notes = np.zeros((100, 88))
        notes[50, 69 - md.BP_LOWEST_MIDI] = 0.7
        grid = md.to_semitone_grid(np.array([bp_times[50], bp_times[99] + 1]), bp_times, notes)
        self.assertAlmostEqual(grid[69 - LO, 0], 0.7)
        self.assertEqual(grid[70 - LO, 0], 0)
        self.assertEqual(grid[69 - LO, 1], 0)

    def test_basic_pitch_frame_times_apply_the_per_window_offset(self):
        audio = np.zeros(int(md.BP_RATE * 5), np.float32)
        times, _ = md.basic_pitch_frames(lambda w: np.zeros((md.BP_WINDOW_FRAMES, 88)), audio)
        hop = md.BP_HOP / md.BP_RATE
        offset = hop * (md.BP_WINDOW_FRAMES - md.BP_WINDOW_SAMPLES / md.BP_HOP) + 0.0018
        self.assertAlmostEqual(times[md.BP_WINDOW_FRAMES - 1], (md.BP_WINDOW_FRAMES - 1) * hop)
        self.assertAlmostEqual(times[md.BP_WINDOW_FRAMES], md.BP_WINDOW_FRAMES * hop - offset)

    def test_path_scores_report_the_supporting_segnet_score(self):
        centers = np.array([0.0, 440.0, 440 * 2 ** (0.3 / 12), 880.0])
        scores = np.array([[0.7, 0.1, 0.2], [0.2, 0.3, 0.1], [0.1, 0.6, 0.1], [0.0, 0.0, 1.5]])
        np.testing.assert_allclose(md.path_scores(scores, centers, np.array([-1, 69, 81])), [0.7, 0.6, 1.0])

    def test_minimum_note_duration_follows_the_onset_rate_within_bounds(self):
        frames = int(4 / HOP)
        notes = np.zeros((md.MIDI_HIGH - LO + 1, frames))
        notes[72 - LO] = 0.9
        def onsets(rate):
            grid = np.zeros_like(notes)
            grid[72 - LO, (np.arange(0, 4, 1 / rate) / HOP).astype(int)] = 0.9
            return grid
        self.assertAlmostEqual(md.minimum_note_seconds(onsets(10), notes, HOP), 0.05, places=2)
        self.assertEqual(md.minimum_note_seconds(onsets(3), notes, HOP), md.MIN_NOTE_SECONDS)
        self.assertEqual(md.minimum_note_seconds(onsets(40), notes, HOP), md.MIN_NOTE_FLOOR_SECONDS)
        self.assertEqual(md.minimum_note_seconds(np.zeros_like(notes), np.zeros_like(notes), HOP), md.MIN_NOTE_SECONDS)

    def test_fast_passage_keeps_sixteenth_notes_that_the_default_minimum_drops(self):
        step = int(0.07 / HOP)
        u, p = salience(300, [(72 + 2 * (k % 2), 20 + k * step, 20 + (k + 1) * step, 0.9) for k in range(6)])
        self.assertLess(len(runs(md.decode(u, p, None, HOP))), 6)
        self.assertEqual(len(runs(md.decode(u, p, None, HOP, min_note_seconds=0.05))), 6)

    def test_pools_model_bins_by_nearest_semitone(self):
        centers = np.array([0.0, 440.0, 440 * 2 ** (0.4 / 12), 440 * 2 ** (0.6 / 12)])
        scores = np.array([[0.1, 0.2], [0.3, 0.0], [0.2, 0.0], [0.0, 0.5]])
        unvoiced, pooled = md.semitone_salience(scores, centers)
        np.testing.assert_allclose(unvoiced, [0.1, 0.2])
        np.testing.assert_allclose(pooled[69 - LO], [0.5, 0.0])
        np.testing.assert_allclose(pooled[70 - LO], [0.0, 0.5])

    def test_basic_pitch_windows_stitch_in_order_without_overlap_duplicates(self):
        calls = []

        def session(window):
            calls.append(window)
            first = len(calls) - 1
            frames = np.arange(md.BP_WINDOW_FRAMES, dtype=np.float32) + first * 1000
            return np.repeat(frames[:, None], 88, 1)

        audio = np.zeros(int(md.BP_RATE * 5), np.float32)
        times, notes = md.basic_pitch_frames(session, audio)
        expected = int(np.floor(len(audio) * md.BP_FPS / md.BP_RATE))
        self.assertEqual(notes.shape, (expected, 88))
        self.assertEqual(len(times), expected)
        half = md.BP_OVERLAP_FRAMES // 2
        np.testing.assert_array_equal(notes[: md.BP_WINDOW_FRAMES - 2 * half, 0], np.arange(half, md.BP_WINDOW_FRAMES - half))
        self.assertEqual(notes[md.BP_WINDOW_FRAMES - 2 * half, 0], 1000 + half)
        self.assertTrue(np.all(np.diff(times) > 0))
        self.assertTrue(all(w.shape == (1, md.BP_WINDOW_SAMPLES, 1) for w in calls))


if __name__ == '__main__':
    unittest.main()
