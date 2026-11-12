# Source-note segmentation implementation plan

> For agentic workers: execute as one owned implementation unit followed by an independent review. No commits: this workspace has no Git metadata.

**Goal:** Preserve confidently detected detuned notes and acoustically supported repeated attacks before instrument adaptation.

**Architecture:** Keep the existing monophonic detector and `Transcription` / `MelodyNote` interfaces. Fix source-event segmentation in `transcribeAudio`; keep calibration, source frequency detection, projection and playback unchanged. This unit improves isolated input and is not a solution to selecting a foreground instrument in a mixture.

**Tech stack:** Existing TypeScript, node:test and tsx; no dependencies.

**Spec and authorization:** The user requests autonomous development of a faithful original-audio-to-main-melody-to-ocarina pipeline for roughly ten-second excerpts. This is one prerequisite unit; no new browser/backend contract or clip-selection UI is included. Confirmed mechanism and frozen measurements: `out/extraction-root-diagnosis/REPORT.md` and `out/blue-bird-reference-quality/REPORT.md`.

## Constraints

- Preserve original source pitch, octave and timing independently of playable ocarina limits.
- Do not infer a new note from a quantization fluctuation, normal vibrato or a sustained constant-pitch tone.
- Do not hardcode this song, its register, expected sequence or timestamps in production.
- Keep public signatures, default pitch detector behavior and audio calibration unchanged.
- Do not relax voicing confidence globally or remove the brief-candidate fundamental-energy guard.
- Existing deterministic tests must remain independent of ffmpeg, downloaded models and `out/` files.
- Keep reference-driven evaluations separate from regular synthetic regression tests. Frozen anchors diagnose pitch coverage; they are not a complete event transcription or accuracy score.

## Confirmed causes

The G5 region around 16.81 s has 22 voiced frames near MIDI 79.32 with confidence about 0.99. It is discarded because zero frames fall within 0.3 semitones of an equal-tempered integer. Stability currently measures tuning error instead of temporal consistency. A stable offset inside a semitone must not make a source note disappear.

The later A5 region is a single same-MIDI segment despite independent energy drops and rises. Existing gap refinement can only move boundaries between already separate candidates; it cannot produce a repeated attack within a voiced segment.

## Review focus

- Stable detuning on both sides of a MIDI center must survive; genuine unstable transitions must still be rejected.
- A single continuous pitch vibrating across the rounding boundary between two semitones must remain one event; a deliberate sustained semitone change must remain two events.
- A repeated pitch with an energy dip and renewed attack must split even if the pitch detector stays voiced.
- A steady tone or mild vibrato with smooth gain drift must remain one event.
- All output events must have positive durations and ordered, non-overlapping intervals at supported sample rates.
- Existing short real notes and transition-artifact rejection must continue to pass.

## Task 1: Repair source segmentation and prove the rules

**Ownership:** `src/core/transcribe.ts`, `scripts/transcription.test.ts`, `docs/transcription.md`. Research artifacts may be added only under `out/source-segmentation-checks/`. Do not edit `pitch-detect.ts`, UI, projection or other workers' files.

**Consumes:** `detectPitch(frame, rate, { minHz: 50, maxHz: 4000 })`, current PCM and effective sample clock.

**Produces:** Existing `Transcription | null`, with source `MelodyNote` events and unchanged confidence/coverage meaning.

- [ ] Snapshot owned production/test/doc files before changes under the check directory; record hashes because Git is unavailable.
- [ ] Add sharp synthetic regressions for stable offsets of both signs between 31 and 45 cents and a sustained pitch with repeated amplitude attacks separated by a nonzero valley. Include a steady/vibrato/smooth-gain negative control and a continuous tone centered near MIDI 69.5 with vibrato crossing that rounding boundary, asserting one event. Add the decisive opposite control: deliberate sustained MIDI 69 then MIDI 70 must remain two events. Run new rules against baseline and capture actual failures before editing production.
- [ ] Replace integer-centered stability evidence with within-event temporal pitch consistency, including frame grouping before final event quantization. Do not retain immediate per-frame integer changes as sufficient evidence of a note boundary. Use fractional-pitch continuity and robust local statistics to tolerate rounding-boundary jitter while preserving actual sustained semitone changes. Quantize the event's representative pitch only after grouping; retain voicing and brief-candidate support rules. Do not use a song-specific offset or simply increase the absolute tuning threshold.
- [ ] Introduce amplitude-onset boundary detection inside same-pitch regions, using energy dips followed by renewed attack. Reuse the existing signal and envelope calculations; use scale-relative evidence so gain does not determine articulation. Document measured onset-resolution limits. Do not split on pitch motion alone. Threshold details may be settled using the stated synthetic controls and acoustic diagnostics, not a template of the target notes.
- [ ] Keep event intervals positive and non-overlapping, preserving detected rests rather than reflowing them. Verify at 24, 44.1 and 48 kHz and at two signal gains.
- [ ] Run `./node_modules/.bin/tsx --test scripts/transcription.test.ts scripts/calibration-integration.test.ts scripts/audio-preparation.test.ts` and `npx tsc --noEmit`. Fix only regressions in this ownership.
- [ ] Run a separate actual-reference check using the full frozen isolated ocarina: a MIDI 79 event must cover 16.8103 s; the MIDI 79 events covering 16.3105 and 16.8103 must be distinct; the MIDI 81 events covering 17.4100 and 17.7099 must be distinct. Preserve all other already matching frozen stable centers. These centers establish event identity at known locations, not exact onset/offset accuracy.
- [ ] Re-run original Blue Bird diagnostic and the isolated 1998 Lullaby benchmark when available. Report any degradation explicitly; do not claim this change repairs the mixed violin. A new loss on independently established isolated-reference notes is a blocker.
- [ ] Update `docs/transcription.md` with the actual general rules and remaining limitations. Return focused results and reproducible evidence.

## Task 2: Independent integration review

- [ ] Lead inspects the owned changes and independently repeats a focused check.
- [ ] A fresh read-only reviewer checks generalization, false reattacks, tuning invariance, interval validity, sample-clock handling and scope. Fix all confirmed blockers in one batch, then perform one scoped recheck if needed.
- [ ] Run the global cleanup skill before any future commit/merge; no commit or merge is part of this unit. Final full suite and build occur once after all pipeline units are integrated, rather than after every research unit.

## Acceptance and remaining work

Accept this unit only if synthetic rules and the independently supported isolated reference events pass, without the existing isolated-note regressions returning. If the reference attack criterion cannot be met without false splits, keep the stable-detuning fix separate, document the unresolved articulation mechanism and return to diagnosis rather than tuning repeatedly. Selection of the violin inside an accompanied source remains the responsibility of the parallel pretrained-model evaluation and a subsequent reviewed integration plan.
