# Audio transcription

The extractor estimates a single fundamental in each overlapping analysis frame,
then converts the detected frequency to chromatic MIDI. It does not consult the
instrument's pitches, fine tuning, playable range, or projection policy. The
consumer projects the extracted notes separately. `startBeat` and
`durationBeats` are seconds on the input clock because `tempoBpm` is 60.
`quality` is the fraction of analyzed frames with a pitch-confident voiced
candidate; it is not a measure of correct notes.

The source detector searches approximately 50–4000 Hz (limited by Nyquist),
with interior autocorrelation peaks to avoid treating a search boundary as a
period. The shared detector's default range remains unchanged for calibration.
Input above the analysis rate is averaged and decimated; frame and hop sizes
are approximately 43 and 11 ms at 24 kHz. Candidates need stable pitch
support. Short candidates also need measurable energy near their detected
fundamental, to reject spurious autocorrelation periods during overlapping
tones. A short sound with a weak or missing fundamental may therefore be
omitted even if its harmonics imply a pitch. Same-pitch segments separated by a deep local
energy valley have their boundaries refined from a shorter energy envelope.
The initial energy threshold is relative to the 90th percentile of frame RMS,
rather than a single sample peak. Between the first and last pitch-confident
frames, a second pass can recover quieter notes using twice the 10th-percentile
RMS as a background threshold, capped by the initial threshold. Digital silence
participates in the estimate. If background gaps occupy too little of the clip,
this estimate can include the quiet source note and recovery can still fail.
A uniformly sustained signal retains
the initial threshold. Recovery does not extend the detected phrase boundaries.
Newly recovered events require the same fundamental-energy evidence as short
events, regardless of duration; this rejects unsupported subharmonic periods.
These heuristics cannot identify every rearticulation or separate a foreground
melody from a mix. Quiet leading/trailing notes and notes masked by background
sound can still be lost.

The independent benchmark at `out/transcription-benchmark/REPORT.md` describes
its annotations and acceptance tolerances. On the isolated 1998 reference the
extractor recovered all 11 annotated MIDI pitches, including A6 and G6, without
extra events. The final note's annotated end is uncertain; the extractor does
not extend the event into an unvoiced decay to match it. Controlled tests cover
C2, short notes, quiet input, noise, a loud impulse, repeats and multiple sample
rates. Unit tests use deterministic synthetic audio and do not require ffmpeg
or reference files; the independent benchmark evaluates the supplied recordings
separately. The accompanied 2026 excerpt still produces extra events around its high
ending, where the input is polyphonic. No claim of source separation follows
from the isolated result.

Source segmentation groups voiced fractional pitch before rounding the event's median to MIDI. Stability is measured around that median rather than an equal-tempered pitch. A sustained pitch change needs evidence in adjacent frames; brief candidates still require fundamental energy. The fixed analysis window and hop limit temporal resolution, and closely spaced notes or rapid pitch changes may merge or fragment. A continuous voiced pitch with repeated attacks is not yet reliably split: envelope dips can also arise from low-frequency waveform cycles or ordinary amplitude changes. No general onset-resolution guarantee is established.

Amplitude modulation alone is deliberately not interpreted as a new note. A
cycle-covering envelope removed low-frequency false valleys, but still split a
single annotated A5 in the 1998 reference. The rejected implementation and its
failing reference check are recorded in `out/source-segmentation-checks/`.
Repeated same-pitch notes separated by detectable unvoiced gaps remain supported;
continuous reattacks require additional articulation evidence and remain open.

The model contour and isolated detector use the same fractional-pitch grouping
rule with windows expressed in seconds. Model scores are raw scores, not measured
accuracy. Model analysis retains its original contour and every positive-duration
candidate, including candidates marked as having insufficient stable support;
notes are a separate 60 BPM projection of those candidates. Unvoiced frames
break events and are never filled. The model path has no amplitude-based onset
splitting or isolated-detector acoustic filtering. Its contour is the decoded
semitone path from the fused SegNet and Basic Pitch decoder, not the raw model
argmax; see [local melody decoding](local-melody.md#decoding).
