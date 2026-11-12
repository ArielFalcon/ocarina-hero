# Fifteen-second audio and playback-rate plan

**Goal:** Extend analysis to fifteen seconds, let playback run slower without altering source data, and validate the unchanged model on the supplied In the End and Littleroot captures.

**Authorization:** The user accepts the actual Blue Bird ten-second transcription as very good, requests the missing ending and a slightly slower experience, and authorizes continuing cross-song validation. Earlier autonomous authorization remains active. No clip-selection UI, song-specific model tuning, automatic TikTok filter, new model, public deployment or paid service.

## Evidence and decisions

The current cap is ten seconds in the browser, model parser, server and Python wrapper. The accepted source-note audition lasts exactly ten seconds; the requested original motif lasts approximately thirteen. This establishes truncation, not a tempo-estimation error. Source events remain on the original audio clock.

Playback speed is a transport preference. Keep native 100% as the initial speed, add 90% and 75% options, and allow returning to 100%. Changing speed during playback restarts from the beginning using the existing stop/start cancellation. No extraction is repeated and no source event, pitch, TAB note or downloaded analysis is rewritten. A new full-motif audition at 90% will demonstrate the slower option.

The prior Littleroot video and new attachment have identical hashes. Its performance is not identical to the stored MIDI. The stored demos are comparison material, not automatic gold annotations. Independently measured pitch, order, attacks and silences control any quality finding; sparse anchors are not full accuracy.

## Unit 1: One duration policy at every boundary

**Ownership:** new `src/core/audio-limits.json`; modify `src/ui/import.ts`, `src/core/melody-analysis.ts`, `server/melody.ts`, `scripts/melody-inference.py`, their focused tests, README and `docs/local-melody.md`. Main/index integration belongs to the lead.

- [ ] Write boundary regressions that fail against the ten-second policy: browser input beyond fifteen seconds retains exactly the first fifteen; the parser accepts fifteen and rejects fifteen plus one sample; maximum supported 192 kHz PCM fits fifteen seconds and one extra sample is rejected.
- [ ] Store `{ "maxDurationSeconds": 15 }` in the shared JSON policy. TypeScript imports it; Python reads the same application-owned file. Keep the existing supported sample-rate range and finite/sample-clock checks.
- [ ] Derive maximum PCM bytes and duration checks from fifteen seconds at the maximum supported rate, rather than retaining the old 8 MiB input cap. Keep model stdout independently bounded at 8 MiB and stderr at 64 KiB. Do not loosen process timeout, same-origin, output schema or concurrency limits.
- [ ] Update first-N-seconds copy and runtime documentation. Do not rewrite historical ten-second verification results as if they had used fifteen seconds.
- [ ] Run focused import/model/server tests and typecheck. Verify an actual thirteen- or fifteen-second request through the local route succeeds, remains bounded, preserves the source clock and passes direct reference checks; reject an over-limit request before spawning.

## Unit 2: Playback-only speed

**Ownership:** `src/ui/playback.ts`, `scripts/playback-follow.test.ts`; lead owns `src/ui/main.ts` and `index.html` wiring.

- [ ] Extend existing `Playback.start(arrangement, rate = 1)` to validate a finite positive rate and pass a copied arrangement with `tempoBpm * rate` to the existing engine. Retain the same notes and all original source values. Keep cancellation and audio-clock following unchanged.
- [ ] A behavioral test proves 90% playback changes the engine tempo, does not mutate the supplied arrangement or its notes, and still follows the engine's original note indices. Invalid rates must not start audio. Existing stale-start and resume behavior remains covered.
- [ ] Add an accessible speed selector using the existing form styling. Initial 100%, options 90% and 75%; change restarts only an active playback. It applies equally to imported songs and demos, independently of analysis mode.

## Unit 3: Independent cross-song evaluation

**Ownership:** new reference and evaluation artifacts only. Production models and settings remain unchanged.

- [ ] Preserve full extracted audio and hashes. Establish the TikTok outro interval from audio/video evidence, with uncertainty if necessary; preserve a conservative music-only evaluation crop. Confirm that first-fifteen-second trials do not overlap the outro. Do not add a universal jingle classifier or hardcode attachment times in production.
- [ ] Preserve the original reference observations frozen before the first inference. The existing first-ten-second model results have already been inspected: any new or refined annotations of that span must be labeled prediction-exposed, not blind. Freeze observations for the previously unevaluated 10–15 s span before its first inference and record that ordering; if the annotator has already seen predictions for a span, record that exposure instead of claiming independence. Compare the capture with stored song data and distinguish performance differences, extraction errors and instrument projection loss.
- [ ] Run the same actual wrapper, grouping and adaptation on Blue Bird and both new music-only excerpts. If a song is longer than fifteen seconds, report that only its opening was tested. Save raw contours, source events, prepared TAB and neutral note auditions.
- [ ] Report missing stable regions, octave mistakes, extra candidates and supported repeated attacks separately. No song-dependent thresholds, sequence repair, inferred accuracy from note counts, or hidden fallback.
- [ ] Source timing audit compares original and rendered event boundaries; a slowed audition scales transport only. The user acceptance covers Blue Bird's previous excerpt, not the new ending or other songs.

## Verification and completion

- [ ] Lead repeats a focused check; a fresh independent reviewer checks duration consistency, input/output resource bounds, playback pitch/time separation and integration wiring.
- [ ] Resolve confirmed blockers in one batch and perform one fresh scoped recheck if needed. Run cleanup over changed scope, then full suite and build once at the final pass.
- [ ] Keep main-melody mode experimental unless cross-song evidence supports promotion; do not silently change the default. UI remains `NOT visually verified` unless browser work is explicitly authorized.
- [ ] Report what worked and unresolved musical errors. A playable file or matching sparse centers does not alone establish complete transcription fidelity.
