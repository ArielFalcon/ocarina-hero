"""Main melody decoding: fuses Melodic SegNet salience with Basic Pitch note activations.

Both models give per-frame pitch evidence. The decoder pools SegNet bins by semitone, mixes in
Basic Pitch note posteriors as absolute probabilities (with a mild preference for higher voices), finds one monophonic
path with a Viterbi pass that penalizes pitch changes and voicing switches, then removes notes
shorter than a minimum duration that follows the fragment's onset rate (shorter for fast passages). Parameters were chosen on the corpus benchmark
(scripts/melody-benchmark.ts) and held up on held-out clips; see docs/local-melody.md.
"""
import numpy as np
import scipy.signal

MIDI_LOW = 36
MIDI_HIGH = 96
MIDIS = np.arange(MIDI_LOW, MIDI_HIGH + 1)

# Fusion and path parameters.
BASIC_PITCH_WEIGHT = 0.4
BASIC_PITCH_SCALE = 2.0     # Basic Pitch posteriors are probabilities; never normalized per clip
HEIGHT_BIAS = 0.04          # relative Basic Pitch boost per semitone above MIDI 60, floored at zero
CHANGE_PENALTY = 9.0        # log-score cost of any pitch change
DISTANCE_PENALTY = 0.05     # extra cost per semitone of the change
VOICING_PENALTY = 4.0       # cost of switching between voiced and unvoiced
SCORE_FLOOR = 1e-4
MIN_NOTE_SECONDS = 0.09     # default and upper bound of the minimum note duration
MIN_NOTE_FLOOR_SECONDS = 0.04
ONSET_SPACING_FRACTION = 0.5  # minimum duration = this fraction of the mean onset spacing
ONSET_THRESHOLD = 0.5
ONSET_MIN_SPACING_SECONDS = 0.05
ACTIVE_NOTE_THRESHOLD = 0.3

# Basic Pitch ICASSP 2022 model framing (spotify/basic-pitch v0.4.0 constants).
BP_RATE = 22050
BP_HOP = 256
BP_FPS = BP_RATE // BP_HOP
BP_WINDOW_SAMPLES = BP_RATE * 2 - BP_HOP
BP_WINDOW_FRAMES = BP_FPS * 2
BP_OVERLAP_FRAMES = 30
BP_LOWEST_MIDI = 21


def _nearest_semitones(centers):
    return np.rint(69 + 12 * np.log2(np.maximum(centers[1:], 1e-9) / 440.0)).astype(int)


def semitone_salience(scores, centers):
    """Returns (unvoiced score per frame, per-semitone sum of the SegNet bins nearest that semitone)."""
    nearest = _nearest_semitones(centers)
    pooled = np.zeros((len(MIDIS), scores.shape[1]))
    for i, midi in enumerate(MIDIS):
        rows = np.where(nearest == midi)[0]
        if len(rows):
            pooled[i] = scores[1:][rows].sum(0)
    return scores[0].astype(float), pooled


def path_scores(scores, centers, path):
    """Per frame: the unvoiced score, or the strongest SegNet bin within the decoded semitone, clipped to 0..1."""
    nearest = _nearest_semitones(centers)
    out = scores[0].astype(float).copy()
    for midi in np.unique(path[path >= 0]):
        frames = np.where(path == midi)[0]
        rows = np.where(nearest == midi)[0]
        out[frames] = scores[1:][rows][:, frames].max(0) if len(rows) else 0.0
    return np.clip(out, 0.0, 1.0)


def basic_pitch_frames(session, audio):
    """Runs Basic Pitch over overlapping windows of 22.05 kHz mono audio.

    `session(window)` takes a (1, samples, 1) float32 array and returns (frames, 88) posteriors
    (note or onset). Returns frame times (seconds, including Basic Pitch's per-window offset correction) and posteriors.
    """
    overlap = BP_OVERLAP_FRAMES * BP_HOP
    step = BP_WINDOW_SAMPLES - overlap
    padded = np.concatenate([np.zeros(overlap // 2, np.float32), audio.astype(np.float32)])
    half = BP_OVERLAP_FRAMES // 2
    parts = []
    for start in range(0, len(padded), step):
        window = padded[start:start + BP_WINDOW_SAMPLES]
        window = np.pad(window, (0, BP_WINDOW_SAMPLES - len(window)))[None, :, None]
        parts.append(np.asarray(session(window))[half:-half])
    count = int(np.floor(len(audio) * BP_FPS / BP_RATE))
    notes = np.concatenate(parts)[:count] if parts else np.zeros((0, 88))
    index = np.arange(len(notes))
    offset = (BP_HOP / BP_RATE) * (BP_WINDOW_FRAMES - BP_WINDOW_SAMPLES / BP_HOP) + 0.0018
    return index * BP_HOP / BP_RATE - offset * np.floor(index / BP_WINDOW_FRAMES), notes


def to_semitone_grid(times, bp_times, bp_notes):
    """Interpolates Basic Pitch posteriors onto the SegNet frame clock and semitone rows."""
    grid = np.zeros((len(MIDIS), len(times)))
    for i, midi in enumerate(MIDIS):
        key = midi - BP_LOWEST_MIDI
        if 0 <= key < bp_notes.shape[1] and len(bp_times):
            grid[i] = np.interp(times, bp_times, bp_notes[:, key], left=0, right=0)
    return grid


def _viterbi(unvoiced, pitched):
    emission = np.log(np.vstack([unvoiced[None], pitched]) + SCORE_FLOOR)
    states, frames = emission.shape
    distance = np.abs(MIDIS[:, None] - MIDIS[None, :]).astype(float)
    transition = np.zeros((states, states))
    transition[1:, 1:] = -CHANGE_PENALTY * (distance > 0) - DISTANCE_PENALTY * distance
    transition[0, 1:] = transition[1:, 0] = -VOICING_PENALTY
    total = emission[:, 0].copy()
    back = np.zeros((states, frames), dtype=np.int64)
    for j in range(1, frames):
        candidates = total[:, None] + transition
        back[:, j] = candidates.argmax(0)
        total = candidates.max(0) + emission[:, j]
    path = np.zeros(frames, dtype=np.int64)
    path[-1] = total.argmax()
    for j in range(frames - 1, 0, -1):
        path[j - 1] = back[path[j], j]
    return path - 1


def _runs(path):
    runs, start = [], 0
    for i in range(1, len(path) + 1):
        if i == len(path) or path[i] != path[start]:
            runs.append([int(path[start]), start, i])
            start = i
    return runs


def _enforce_minimum(path, min_frames):
    """Absorbs voiced runs shorter than min_frames into the longer touching voiced neighbour, else unvoices them."""
    path = path.copy()
    while True:
        runs = [r for r in _runs(path)]
        short = [i for i, r in enumerate(runs) if r[0] >= 0 and r[2] - r[1] < min_frames]
        if not short:
            return path
        i = min(short, key=lambda k: runs[k][2] - runs[k][1])
        state, start, end = runs[i]
        neighbours = [runs[k] for k in (i - 1, i + 1) if 0 <= k < len(runs) and runs[k][0] >= 0]
        path[start:end] = max(neighbours, key=lambda r: r[2] - r[1])[0] if neighbours else -1


def minimum_note_seconds(onsets, notes, hop_seconds):
    """Minimum note duration for a fragment: half the mean spacing of Basic Pitch onsets while a note sounds.

    Fast passages (many onsets per sounding second) keep shorter notes; the result stays within
    MIN_NOTE_FLOOR_SECONDS..MIN_NOTE_SECONDS. Inputs are semitone-by-frame grids on the decoder clock.
    """
    if onsets.size == 0:
        return MIN_NOTE_SECONDS
    peaks, _ = scipy.signal.find_peaks(onsets.max(0), height=ONSET_THRESHOLD,
                                       distance=max(1, int(ONSET_MIN_SPACING_SECONDS / hop_seconds)))
    sounding = max(1.0, float((notes.max(0) > ACTIVE_NOTE_THRESHOLD).sum()) * hop_seconds)
    rate = len(peaks) / sounding
    if rate <= 0:
        return MIN_NOTE_SECONDS
    return float(np.clip(ONSET_SPACING_FRACTION / rate, MIN_NOTE_FLOOR_SECONDS, MIN_NOTE_SECONDS))


def decode(unvoiced, pooled, basic_pitch, hop_seconds, min_note_seconds=MIN_NOTE_SECONDS):
    """Returns the MIDI number per frame, or -1 for unvoiced frames."""
    if pooled.shape[1] == 0:
        return np.zeros(0, dtype=np.int64)
    pitched, silent = pooled, unvoiced
    if basic_pitch is not None:
        # Absolute scaling: a clip whose strongest Basic Pitch activation is only noise must not be promoted to certainty.
        bias = np.maximum(0.0, 1 + HEIGHT_BIAS * (MIDIS[:, None] - 60))
        pitched = (1 - BASIC_PITCH_WEIGHT) * pooled + BASIC_PITCH_WEIGHT * BASIC_PITCH_SCALE * bias * basic_pitch
        silent = (1 - BASIC_PITCH_WEIGHT) * unvoiced + BASIC_PITCH_WEIGHT * np.clip(1 - basic_pitch.max(0), 0, 1)
    path = _enforce_minimum(_viterbi(silent, pitched), max(1, int(round(min_note_seconds / hop_seconds))))
    return np.where(path >= 0, MIDIS[np.maximum(path, 0)], -1)
