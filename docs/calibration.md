# Instrument calibration

## Current-game investigation — 2026-11-12

User playback feedback reports a substantial mismatch between the app's tabs
and the current game. The root cause has not been reproduced or established.
The measured model below remains provisional; a synthesized preview matching
that same model is not an independent game calibration check.

Nintendo's [current update history](https://en-americas-support.nintendo.com/app/answers/detail/a_id/71859/~/how-to-update-the-legend-of-zelda:-ocarina-of-time)
lists Switch 2 version 1.1.1, released November 4, 2026. Its published notes do
not specify an ocarina tuning change. Nintendo's [ocarina input support](https://www.nintendo.com/en-gb/Support/Purchases-Subscriptions/Games/Using-Mic-Input-to-Play-the-Ocarina-The-Legend-of-Zelda-Ocarina-of-Time--3235370.html)
confirms two controller layouts selectable with Swap Ocarina-Playing Controls.
It provides no complete frequency or modifier table.

A [post-release controls guide](https://vulkk.com/2026/11/06/the-legend-of-zelda-ocarina-of-time-controls-guide/)
documents ascending buttons L/R/A/Y/X for Normal and R/B/A/Y/X for Classic.
The user confirms Normal/Standard; Classic is outside the requested scope.
The earlier layout-mismatch hypothesis is therefore excluded. Do not substitute
tables from the N64 or 3DS releases as
evidence of the remake's frequencies or bend behavior.

The retained gameplay measurements support dominant components near
595.49/700.20/894.03/1001.31/1190.58 Hz for L/R/A/Y/X. They do not justify an
unconditional octave-down correction. Reproduce
an exact failing button/modifier sequence against gameplay audio before changing
the frequency model, projection or generated arrangements. Distinguish absolute
octave, interval errors, modifier operation and timbre in that comparison.

## Retained measurement model

The fresh audio-only audit is retained externally in
`out/references/2026-11-12/analysis/REPORT.md`, with scripts, fixed measurement
windows, individual repeats and all 25 comparisons in `hold-measurements.json`.
The user confirmed nine states per button: base/up/base/up/base/down/base/down/base.
No filtering or normalization was applied. Compared with the current model at
zero fine tuning, base-tone medians differ by at most 1.1 cents and all 25
medians by less than 9 cents. Downward joystick holds vary by approximately
21–45 cents within their selected windows, so these recordings do not establish
an exact fixed endpoint for each of those gestures. These findings do not
explain the reported large song-level discrepancy. Subsequent user playback
feedback identified the numeric-control naming ambiguity described below.
The investigation did not justify changing the measured static pitch table.

The audit also found that the note-button tooltip displayed written
`PitchSpec.hz` rather than the calibrated sounding frequency. The controller-icon
update corrects that tooltip; it was a display inconsistency, not a playback
multiplier. Production tuning and playback remain unchanged.

## Modifier instruction correction

The user reports that songs sound correct when the numeric modifier instructions
are interpreted with the intended physical controls. The app's old numbers meant
semitones, while the user's recording labels identified gestures in the opposite
order. The measured joystick intervals are approximately two semitones and the
direct D-pad intervals approximately one. This explains the instruction ambiguity;
it does not establish a frequency-table inversion.

UI tabs now use independently reusable button, plus, joystick/D-pad and direction
SVG icons based on the supplied in-game reference. Accessible labels and plain
text exports name the physical gesture, such as `R + D-pad up` or `R + Stick down`.
`src/core/tab.ts:modifierForBend` owns the mapping used by both visual and text
instructions. Internal `bend` values and exported `bend_semitones` retain their
musical meaning; the UI no longer uses those numbers as gesture names.

The provisional base model comes from the isolated five-note recording in
`out/references/2026-11-11/analysis/calibration-candidate.json`. Stable spectral
windows give L/D4 595.49 Hz, R/F4 700.20 Hz, A/A4 894.03 Hz, Y/B4
1001.31 Hz and X/D5 1190.58 Hz. These are sounding pitches, approximately an
octave above the written names. The base sample is one decoded AAC gameplay
take; within-window variation does not establish repeatability across takes.

The fifth recording repeats X D-pad changes with returns to base: up +113.7 and
+114.1 cents, down -117.8 and -120.0 cents. The model uses rounded corrections
of +14 and -19 cents relative to equal-tempered one-semitone bends for X only.
Other D-pad offsets were not independently repeated. Stick endpoints remain
nominal two semitones: measured X up varied from +180.5 to +197.4 cents, and
down was approximately -200.5 cents. Gesture travel and modulation are not
established. Physical control labels follow the user's description; the numeric
labels in the source recordings do not denote the measured semitone distances.

Projection retains all 25 button/bend combinations and scores their calibrated
sounding frequencies. Sharing a nominal MIDI pitch no longer discards an
alternative with a different tuning. Unmeasured bends retain their nominal
semitone multiplier on top of each button's measured base tuning.

Calibration selects frames against the measured base model with a fixed
50-cent acceptance window, independent of the user's fine tuning. Residual
median and quartiles subtract the setting used during measurement;
`tuningCents` is the absolute recommended fine tuning. Recalibrating the same
recording therefore keeps the same frame selection and absolute result.
The detector accepts up to 1600 Hz, covering the approximately 1336 Hz highest
bent tone. Calibration
matches the five base notes across octaves, not arbitrary bent notes; use clean,
sustained unbent notes. See `REPORT.md` and `05-X-REPORT.md` in the analysis
directory for methodology, controls and limitations.
