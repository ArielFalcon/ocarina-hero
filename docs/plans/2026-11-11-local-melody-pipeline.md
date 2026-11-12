# Local main-melody pipeline implementation plan

**Goal:** Analyze the first ten seconds of an uploaded audio file into an inspectable predominant-pitch track, source-note events and the existing calibrated ocarina TAB.

**Authorization:** The user explicitly requests autonomous execution. Routine implementation choices are delegated to the lead. No paid service, external audio upload, public deployment or fragment-selection UI is authorized by this plan.

**Architecture:** A local Python process runs the pinned Melodic SegNet melody checkpoint. A small Vite middleware invokes that process per request; there is no separate permanent analysis service. Browser code retains the decoded clip, receives timestamped model frames and uses one shared TypeScript segmentation rule for both model contours and the existing isolated-note detector. Source analysis remains separate from playable projection.

**Evidence:** `out/predominant-melody-evaluation/REPORT.md` and `contour-segmentation/REPORT.md` establish promising original-source anchor coverage, not complete musical fidelity. The Essentia decoder is rejected. `out/extraction-root-diagnosis/REPORT.md` documents timing and stale-upload risks. Segmentation prerequisite plan: `2026-11-11-source-note-segmentation.md`.

## Scope and limitations

- Provide an explicit main-melody mode using the local model and retain isolated-instrument mode using the existing detector. The existing isolated mode remains the default until the release gate below is satisfied; main-melody mode is labeled experimental while that gate is pending. This containment is not completion of the requested fidelity goal. No hidden fallback or song recognition.
- Analyze at most the first 10.0 seconds. State that limit in the interface; decoding may still read the entire selected file. A visual clip selector and production hosting are deferred.
- Keep MIDI import, fixed Lullaby/demo notes, calibration, controls, playback and projection contracts intact.
- Preserve source pitches and octaves; adaptation remains `prepareMelody` with `preserveTiming: true`. Do not constrain model/source extraction to ocarina range.
- Retain raw contour and raw candidate events, including support metadata. Brief/unstable candidates are explicitly marked; counts and model scores must never be labeled accuracy or confidence in musical correctness.
- No complete fidelity claim is supported by sparse reference anchors. Integration can be technically verified without declaring the model universally accurate. A reference failure or destructive decoder regression blocks making that path the default.
- Use local pinned code/checkpoint, verify digest before deserialization, never accept user checkpoint/model paths. MIT source notice stays with downloaded upstream code. Do not redistribute checkpoints as part of the web bundle; document the unresolved separate weight terms before any future distribution.

## Data contract

The Python process emits JSON only on stdout: `{ schemaVersion: 1, engine: { id, revision, checkpointSha256 }, sampleRate: 44100, durationSeconds, hopSeconds, frames: [{ timeSeconds, frequencyHz, modelScore }] }`. Zero Hz is unvoiced. Scores are raw selected model scores, not calibrated probabilities of correctness. Frequencies come from full bin centers, not integer-Hz upstream text conversion. Diagnostics go to stderr. All numbers must be finite, frames ordered and bounded by the input clock; missing first-hop evidence remains missing.

Shared TypeScript grouping consumes explicit frame times, voicing, hop duration and source bounds. It returns source events with start/duration seconds, median fractional MIDI, integer MIDI, representative Hz and stable-support duration derived from the same event median. Model voicing and custom detector confidence remain separate input policies; the custom acoustic short-note guard is not blindly applied to neural scores. Store unmodified frames alongside grouped candidates so filtering decisions remain inspectable.

The audio-source result includes algorithm provenance, duration, source events, contour, voiced-frame fraction and warnings. A thin conversion maps every finite, positive-duration grouped candidate to existing `MelodyNote` at 60 BPM, including candidates marked as having insufficient support. Those candidates are present in the initial TAB and remain flagged in the source analysis; they are not confined to the download. The UI warns that uncertain candidates are included. There is no automatic exclusion based solely on brevity or model score. Any future exclusion policy must be explicit, tested on short-note controls and logged in the analysis; no silent merging, filling, octave folding or sequence matching.

## Task 1: Share fractional source segmentation

**Files:** new `src/core/pitch-track.ts`, `scripts/pitch-track.test.ts`; modify `src/core/transcribe.ts` and `docs/transcription.md` only after the prerequisite owner finishes.

- Snapshot current owned files and hashes before edits; preserve the completed prerequisite changes.
- Extract existing fractional median/continuity grouping into a pure function. Pass explicit time-based lookback/lookahead/evidence settings; custom transcription uses settings equivalent to its current frame windows, model settings use the already tested physical durations. Do not copy a second production decoder.
- Keep custom voicing, acoustic evidence filtering and supported reattack processing in their owning stages. Share reattack processing with the model only if its input assumptions are actually satisfied by retained PCM; otherwise mark that limitation rather than fabricating attacks.
- Test stable detuning, rounding-boundary vibrato, real semitone changes, 30/80 ms candidates, zero/unvoiced gaps, recording boundaries, two hop sizes and positive non-overlapping intervals. Re-run current custom regression tests to prove extraction did not change its accepted behavior.
- Test conversion to existing `MelodyNote` without changing event times or pitch. Raw and excluded candidates must remain available in the source analysis.

## Task 2: Package trusted local inference and bridge

**Files:** new `scripts/setup-melody.py`, `scripts/melody-inference.py`, `scripts/melody-requirements.txt`, `server/melody.ts`, `scripts/melody-server.test.ts`, `docs/local-melody.md`; lead integrates `vite.config.ts` and package commands.

- Setup downloads the exact official repository revision `6d9d758f167d5fd2b56aa26da0618c4d451896b2` and verifies checkpoint SHA-256 `d56d10ede86aaf2053fca10047e0120ccb75b05f7e55f4dcaba90a0b2be159cb`. Use a project-local ignored runtime directory and isolated Python environment. Record versions and license notices. Setup is explicit and local; no audio upload or automatic model download during analysis.
- Reuse tested official CFP/model code, with the documented integer linspace compatibility fix. Wrapper resolves application-owned model paths independent of cwd, loads only the verified checkpoint on CPU, uses eval/no-grad, decodes finite PCM and performs real resampling to 44.1 kHz. Do not retain the research instrumentation's global `/tmp` output file.
- Pin compatible tested runtime dependencies; verify a clean isolated setup. Avoid system/global installs. If existing runtime is reused for local validation, keep documented fresh setup verification separate.
- Middleware route `POST /api/melody` accepts only bounded mono float32 PCM and a validated numeric sample rate. No shell, browser-provided executable paths, URLs or filesystem paths. Validate content type, sample count, finite values and maximum ten-second duration. Cap body size before allocation and process wall time.
- This middleware runs inside existing Vite dev/preview lifecycle, not an independent public server. Require matching Origin/Host for browser analysis requests and do not enable permissive CORS. Check Vite host policy remains intact. One active inference per server; additional requests return a clear busy error. Cancel and reap the child and delete per-job temporary files on completion, error, disconnect, timeout and shutdown.
- Return actionable missing-runtime/model errors. Never silently fall back to an unrelated extractor. Bound stderr/stdout capture; reject malformed or oversized model output.
- Unit tests inject the process runner and fake timers: request validation, same-origin boundary, busy behavior, timeout/disconnect exactly-once cleanup and output validation. Do not run Python/models/network in regular unit tests. Real local inference is a separate integration check.

## Task 3: Integrate upload lifecycle and inspectable analysis

**Files owned by lead:** `src/ui/main.ts`, `index.html`, `src/ui/styles.css`, `vite.config.ts`, `package.json`, README. New focused helpers/tests may be assigned to a worker with disjoint ownership.

- Add an explicit audio-analysis mode control and communicate the first-ten-second limit. Main melody is selectable as experimental while its release gate is pending; the existing isolated mode stays selected by default. Unavailable local runtime produces its setup error, not fake success. Marking a candidate experimental does not satisfy the fidelity goal.
- A single source-job generation/AbortController guards all asynchronous audio and MIDI file reads, decoding, model requests and state writes. Invalidate on newer file, demo, clear and analysis-mode changes. Ignore stale successes, failures and status updates. Ordinary blur/controls reset must not clear the selected source.
- Always close temporary AudioContexts in `finally`, including decode errors. Mix all decoded channels consistently, then retain only the bounded clip. Use the actual sample rate in requests and preserve its duration after resampling.
- Keep analysis separate from projection. Render current TAB through existing preparation/playback. Show a concise uncertainty warning and allow downloading the source analysis JSON with contour, events, provenance and support flags; do not expose implementation details in the normal play flow.
- Test the lifecycle owner with deferred file/model results: older audio after MIDI/demo/clear/newer audio cannot change current source; stale errors cannot replace current status; cancellation/disposal occurs once.
- UI changes require desktop/mobile browser proof only when browser work is authorized; otherwise report `NOT visually verified`. Do not invoke preview tools unasked.

## Verification and release gate

- Focused tests fail on realistic root regressions before production edits, then pass. Keep regular tests deterministic and independent of downloaded weights, ffmpeg and `out/` files.
- Actual inference on original Blue Bird first ten seconds must preserve all independently frozen source pitch centers within that interval after grouping and projection preparation must preserve event order/timing. Compare source octave before adaptation. Inspect dense-transition candidates explicitly; do not turn point coverage into an accuracy score.
- Enabling the model by default requires an independent event-order audit in addition to anchor coverage: every candidate pitch outside the paired reference's locally aligned sequence must be supported as a distinct source note, or remain unresolved. In particular, audit the short intervening MIDI 79, 80 and 66 candidates around 9.69–9.79 s. A missing established note, false octave, unsupported extra pitch, or unresolved candidate in that audit is a failed gate. A point match or merely finding harmonic energy in the mix cannot validate a new melody note. Record the audit windows/evidence and their limitations. The existing research has not passed this gate; do not activate the model by default or claim fidelity until it does.
- Run digital silence and controlled audio with stable detuning, genuine semitone/octave changes, short notes and repeated attacks. Record upstream model misses separately from segmentation losses. Neural failure on isolated audio does not license a hidden fallback; the isolated mode must retain existing verified behavior.
- The production wrapper must reproduce the approved experimental contour within bin/time tolerance. Actual decoded source JSON must remain finite, ordered, bounded and internally consistent; changing preparation options must not rewrite it.
- A fresh independent reviewer checks process/resource security, source-job ordering, time units, core regressions and actual reference evidence. Address confirmed blockers in one batch and perform one scoped recheck.
- Run cleanup over the final changed scope, then run full `npm test` and `npm run build` once at final integration. Report failed/pending gates honestly; do not call a technically running but musically unsupported pipeline complete.
