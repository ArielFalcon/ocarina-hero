# Improve the existing SegNet melody decoder in one bounded iteration

Status: approved and evaluated; the single candidate was rejected and was not activated. Results: `out/segnet-decoder-iteration/REPORT.md`.

## Goal

Reduce unsupported pitch/octave excursions in Main melody while preserving real short notes, legitimate leaps, source timing and the currently successful passages. This is a decoder improvement, not model retraining or a promise to recover every missing melody note.

## Confirmed baseline and hypothesis

The existing Python runtime computes a full pitch-score matrix but emits the maximum-scoring class independently at each frame. TypeScript groups the resulting fractional-pitch contour into timed events; every positive event currently reaches adaptation, including low-support fragments. Projection is a separate operation.

Confirmed research already locates some errors before grouping. Hypothesis: a conservative, evidence-aware temporal decoder can correct a subset of isolated pitch excursions. This does not establish that every short excursion is an error or that temporal decoding can resolve sustained selection of the wrong instrument.

The previous Gaussian/Viterbi configuration was rejected because it suppressed a strong single-frame leap. It will not be reapplied unchanged. Duration-only deletion and octave folding are excluded.

## Scope and single candidate

Keep the current checkpoint, CFP features, normalization, frequency range, sample clock, grouping and calibrated projection. Test one temporal decoder of the existing score matrix inside the local Python runtime. It will compare competing pitch hypotheses across adjacent frames, retain the unvoiced class and keep transitions possible across the entire existing register. Strong direct frame evidence must be able to override continuity; genuine leaps must not be forbidden by a speed limit.

Before candidate evaluation, freeze one decoder specification, its parameters and the strong-evidence rule. Do not tune a grid, change normalization, add another decoder or switch to another model if it fails. Raw argmax output remains available as the immutable baseline and audit artifact. Corrected output must record the decoder specification used. No complete score matrix is added to the public HTTP response.

Likely edit surfaces are the inference wrapper, one local decoding helper, its focused Python/NumPy tests and local-model documentation. The existing response clock, parser, importer, playback and TAB projection remain compatible. No new dependencies, service, UI, Isolated changes or authored-song repairs.

## Existing resources

- Exact retained original Blue Bird 0–13 s and Mario 0–12.6 s PCM, their saved contours and neutral auditions.
- In the End and Littleroot 0–15 s excerpts, ending before the known TikTok outros.
- Phoenix mixture 15–30 s for diagnosis and 30–45 s for a separate temporal validation interval, with the existing frozen f0 reference.
- Existing synthetic paired controls: a weak isolated octave excursion versus a strong real leap, 30/80 ms notes, detuning, vibrato, rests, repeated notes, silence and noise.

Phoenix intervals belong to one recording; prior results have already been inspected. They are not a blind, independent-song or training holdout. Mario sheet music and sparse anchors are diagnostics, not a complete note-level gold. An annotated unpitched frame is not automatically acoustic silence. No new material is required for this iteration.

## Execution budget

One implementation iteration, with a 45-minute execution cap after approval: approximately 10 minutes to freeze identical-input baselines and the decoder specification, 20 minutes to implement the one candidate and regressions, and 15 minutes for the fixed evaluation and delivery. If the cap is reached, stop and report the exact unfinished item; no automatic extension or new research branch. No implementation occurs during plan approval.

## Acceptance

1. On the pooled Phoenix reference-voiced frames, target at least 20% fewer octave disagreements than unchanged SegNet. Correct-pitch agreement within 50 cents must not decrease; wrong non-octave and missed/unvoiced frame counts must not increase. Publish each interval separately so improvement in one cannot conceal a regression in the other. The criterion must hold separately in each interval; the pooled target is descriptive only if either interval fails its guardrails.
2. Preserve paired strong-leap, 30/80 ms, rest, detuning/vibrato and repeated-note decoder controls. Preserve silence/noise rejection in controlled audio inference. A score is evidence from the model, not calibrated accuracy.
3. Preserve every currently matched frozen pitch center in Blue Bird and the cross-song references. Do not call this complete melody accuracy. For each changed passage, report changed source pitches, boundaries and reasons; an unverified change remains unverified.
4. Source timestamps remain finite, positive-duration and nonoverlapping; no tempo changes, closing gaps, compression or playable-range restriction during extraction. Unchanged source events retain their times through projection.
5. Produce equal-duration/equal-gain before/after neutral source auditions for Mario and Blue Bird, changed-note/timestamp lists, and the resulting playable TAB data. These are source-note renditions, not source-separated audio or a game-timbre verification. Preserve Mario's user-approved second display section as an explicit listening check; no automatic claim of perceptual preservation follows from anchors.

If objective checks fail, do not activate the candidate. If they pass, present the concrete comparison for the user's final musical judgment before replacing the currently accepted path. No additional model or threshold search is authorized by this plan. A failed candidate produces a bounded failure report, not an indefinite continuation.

## Delivery

A small reviewed patch if accepted, focused decoder regressions, one final full test/build run, and a compact report stating what improved, what stayed unchanged and what remains unresolved. Source extraction and ocarina adaptation are reported separately. No claim of universal fidelity or improvement of every supplied song.
