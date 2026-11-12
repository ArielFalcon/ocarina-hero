# Essentia melody extraction

## Current decision: quality gate failed

The user reviewed the unadapted candidate audition and rated it approximately
5/10: it loses upper-register notes and does not transcribe the whole audible
melody. This does not approve the candidate or the proposed app integration.
Production code and dependencies remain unchanged. Follow the stop condition
below; further alternative-library evaluation is research, not authorization to
adopt a different pipeline.

The follow-up sparse-anchor diagnostic in
`out/essentia-integration-research/feedback-diagnosis.json` confirms that several
missing events already have no voiced pitch in Melodia's contour. The candidate
can represent C#6 elsewhere, so the observed losses are not explained by a
simple upper-register ceiling or by ocarina adaptation. These sparse anchors
still do not constitute full instrument-identity or note-level ground truth.

## Goal and recommended decision

Implement the complete browser pipeline from uploaded audio to predominant melody, note events and the existing playable ocarina TAB. Recommend an explicit additional audio mode rather than replacing the proven isolated-melody extractor. Keep the current isolated mode as the default until the user approves a different default based on evidence.

This is a proposed implementation plan, not approval to change production. The user authorized the overall feature and supplied its reference; the concrete mode/default decision remains for approval.

## Evidence

Published `essentia.js@0.1.3` includes working `PredominantPitchMelodia` and `PitchContourSegmentation` bindings. A Node probe executes EqualLoudness → Melodia → segmentation. Browser Worker initialization remains unproven and is the first implementation gate.

The default package on Blue Bird 0–13 s returns 22 candidate events. Neither event count nor voiced-frame coverage establishes correct violin melody selection. The independent reference has 27 sparse spectral-family anchors over the clip; foreground ownership, event boundaries and complete note accuracy remain unverified.

The actual defaults lose low-register and short notes and some final notes in controlled fixtures. Missing final events are already absent from Melodia's contour; the segmenter closes an isolated final island. Silence padding does not recover them. `guessUnvoiced=true` exposes some rejected contours with negative confidence. Reducing both duration minima to 40 ms recovers only three of five 80 ms notes and increases noise/vibrato fragmentation. The tested configuration matrix therefore does not justify replacing the existing extractor or enabling inferred unvoiced pitches.

Evidence is frozen separately in `out/essentia-integration-research/` and `out/references/blue-bird/`. Candidate output must never become expected reference notes.

## Scope and user behavior

- Add two understandable audio input modes: **Isolated melody** and **Melody with accompaniment**. Do not expose library names as a user-facing engine selector. Isolated uses the current extractor; accompaniment uses the complete Essentia pipeline. The latter is an explicit choice with documented short/quiet-note limitations. No hidden engine fallback or automatic mode inference.
- Add one generic **Analyse first … seconds** field, default 30 and limited to the current 30-second maximum. This lets the user choose 13 for the supplied motif without a Blue Bird filename exception. Validate the duration before analysis. Starts remain at input time zero; a waveform editor or arbitrary start-offset selector is out of scope.
- A mode or duration change reanalyses the currently selected audio file and invalidates its earlier job. MIDI, a demo or Clear ends that audio ownership so a later setting change cannot unexpectedly reload an old file. MIDI parsing, fixed demos, calibrated playback and fine-tuning behavior otherwise remain intact.
- Reuse existing source projection, `preserveTiming`, TAB rendering, highlighting and playback. Do not change source pitches to fit the instrument before extraction. Keep Lullaby's approved 17-note arrangement unchanged.

## Required motif acceptance before app integration

Before production edits, the user or an independent musical reviewer must listen to both the source 0–13 s clip and the neutral rendering of the candidate's actual MIDI/onset/duration events. The review files are `out/essentia-integration-research/audition/blue-bird-original-0-13.wav` and `blue-bird-detected-notes.wav`; the manifest identifies the exact candidate events. The neutral rendering applies no ocarina adaptation, pitch repair or timing reflow.

Acceptance requires an explicit confirmation that the extracted line follows the intended violin motif sufficiently to use as the basis for the proposed accompaniment mode: correct recognizable phrase and note order, rhythm and pauses, without an identified missing passage or wrong melodic line. Record the reviewer and verdict; do not infer approval from silence or from sparse spectral matches. This is qualitative product acceptance, not a complete note-level precision/recall annotation.

If the reviewer finds the candidate unusable or cannot establish that correspondence, stop this implementation before changing the app, report the failed or unavailable quality gate, and retain the current extractor unchanged. Do not ship a technically working accompaniment mode as a completed quality improvement. A different model or additional separation stage requires a new evidence-backed proposal, not an automatic expansion of this plan.

## Implementation

1. **Pinned package and bootstrap gate.** Add exact `essentia.js@0.1.3` to package.json and the existing lockfile. Prove the shipped ES/WASM entrypoint in a real Vite browser Worker, both development and production builds, before wiring it into imports. Keep assets local; add no CDN, backend or new model. If the published loader cannot run, stop this integration and report the concrete blocker before changing architecture.
2. **Analysis adapter.** Keep the existing synchronous isolated extractor available. Add a small typed adapter around the package's weak declarations. Run EqualLoudness on the input for Melodia; provide its pitch contour and original mono signal to the segmenter. Use one documented global parameter set based on published defaults, with `guessUnvoiced=false`; do not tune to Blue Bird anchors. Explicitly match sample rate and hop size across calls. The accompaniment path receives real resampled 44,100 Hz mono audio, preserving seconds; never reinterpret samples by changing only a rate value.
3. **Result and resource contract.** Convert finite, positive-duration events into the existing source-note representation at tempo 60, retaining input-clock onset and duration. Bound accepted events to the actual analysed clip and handle silence/empty vectors explicitly. Reject malformed non-empty results rather than inventing notes. Coverage is the share of analyzed frames with a voiced pitch, not note accuracy or per-note confidence. Preserve original Hz/confidence traces in diagnostic artifacts for validation; no new pitch-curve playback IR in this task. Delete owned C++ vectors in success/error paths and shut down the instance. Terminate the per-job Worker after completion, cancellation or failure; do not add a persistent pool.
4. **Async import ownership.** Use one monotonically changing import generation and cancellation owner for file selection, MIDI/audio decode, mode/duration changes, demos and Clear. Check it after every async boundary, including before assigning filenames, errors or source results. Transfer a dedicated copy of the capped audio buffer; do not detach an AudioBuffer-owned channel array. Keep the isolated mode's existing decode/sample-rate behavior. Use native offline resampling/decode for the accompaniment path. Separate decode, initialization, analysis, empty-result and cancellation outcomes. A cancelled job must not publish a stale error, and a genuine failure must remain visible. Provide indeterminate phase status; do not invent progress percentages.
5. **Reference and regression integration.** Add reproducible evaluators for the actual new pipeline and its source adapter. Keep sparse Blue Bird anchor comparisons diagnostic, not full melody precision/recall. Compare raw pitches and source timing before playable adaptation. Record the known failing default fixtures as limitations of the new mode rather than falsely treating legacy tests as proof that Essentia passes them. Existing isolated-mode fixtures remain unchanged and must pass. Do not add the candidate's 22 events as a golden transcription.

## Tests and acceptance

- A real published-package smoke test must execute the two algorithms on a controlled stable tone, and silence must yield no source notes. No test-time network calls. Keep deterministic input and distinguish algorithm integration from mocked lifecycle tests.
- Cheap adapter tests cover empty vectors, invalid event values, clip boundaries, seconds/MIDI conversion and cleanup after an algorithm error. Verify that sample-rate/hop arguments agree rather than merely forwarding a mock's output.
- Import lifecycle tests cover an older audio decode/Worker result or error arriving after a newer MIDI selection, demo or Clear, cancellation, and worker cleanup. Include an old error after a successful newer import.
- Actual browser checks at desktop and mobile widths: mode/default and duration inputs, responsive analysis, 13-second cropped reference, silence, file changes during decode/analysis, MIDI/demo/Clear invalidation, a forced worker failure, and playback/highlight of the resulting TAB. Test real production Worker assets as well as development mode. Close diagnostic tabs and temporary preview server afterward, keeping the normal development server available.
- Compare the new pipeline with independent Blue Bird anchors and preserve exact before/after inputs and parameters. Report unmatched/ambiguous anchors and timing uncertainty. The required pre-integration auditory gate must already have passed. Verify in the browser that the same 0–13 s input produces the accepted candidate's source-note sequence and timing within documented decoder/analysis tolerances, before ocarina adaptation. A materially different or unusable browser result blocks completion and requires diagnosis; passing sparse anchors or technical checks does not override that block. No full-song accuracy score is implied.
- Obtain an independent code/integration review and run focused tests while implementing. Run the full suite and build once after blocker fixes and review. Inspect source-timing and approved-song regressions as part of final verification.

## Ownership and boundaries

Use two implementation units: package/typed analysis adapter/Worker and their tests; import lifecycle/UI integration and their tests/docs. Freeze a shared typed request/result contract before parallel writes. The lead owns package/lockfile changes, main.ts, index.html and other shared integration files; workers return exact wiring changes. Use the current shared checkout with disjoint writable files because it has no git repository; preserve existing work. No commits or publication.

Basic Pitch, Demucs, additional services, ensembles, automatic fallback, rewriting the existing detector and dynamic bend notation/playback are out of scope. If library limitations make the explicitly approved mode misleading or unusable, report that evidence instead of changing tools or broadening scope silently.

## License and remaining risks

The package declares AGPL-3.0 and its files describe v3-or-later; no separate pretrained ML model is needed for this chain. Record upstream notices and the researched package/asset inventory. This work is local implementation/evaluation, not approval for public or commercial distribution; unverified bundled-component licensing remains explicitly documented for any later distribution decision. Do not select a new project license on the user's behalf.

The primary product tradeoff is explicit: retaining the isolated default preserves known short-note behavior but requires choosing the new mode for mixed music. Replacing the default would simplify that choice while introducing demonstrated regressions, so replacement is not recommended. WASM initialization, mobile CPU/memory and accompaniment-induced segmentation errors require actual runtime checks; library availability is not a quality guarantee.
