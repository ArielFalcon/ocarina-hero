# Explicit uploaded-audio fragment analysis

## Goal

Make uploaded audio understandable and actionable: select a fragment of up to 15 seconds, preview it, explicitly analyze it and see an adapted TAB or a visible error.

## Current behavior and evidence

`src/ui/main.ts` immediately calls `SourceImporter.load` on file selection or audio-mode changes. The importer decodes the entire file and analyzes its first 15 seconds. `index.html` has no waveform, selection controls or Analyze action. The default mode is isolated instrument. Fragment selection was researched, never implemented. The report under `out/audio-fragment-selection-research/REPORT.md` recommends WaveSurfer Regions, separating display peaks from full-quality analysis PCM.

## Proposed behavior

1. Selecting an audio file opens an editor with its filename, duration, waveform and exactly one draggable/resizable region. Initial selection is `[0, min(duration, 15)]`. Add labeled start/end numeric time inputs for keyboard and precise edits, preview play/stop, and an explicit Analyze button. Mobile controls must remain reachable. Basic horizontal navigation/zoom permits selection beyond the first 15 seconds; gapless looping and an exact Instagram visual clone are excluded.
   The region, fields, preview and analysis share one accepted sample-index selection. Reject nonfinite, negative, reversed, empty, beyond-file or over-limit edits with visible feedback and restore the previous accepted region and field values. Configure the region's resize limit too, but independently validate every edit and Analyze request. Do not silently shorten an oversized selection only when sending it for analysis. Synchronize valid edits to the actual sample boundaries used by the importer.
2. Keep the existing isolated and experimental main-melody choices; explain which is suitable for a solo line versus accompaniment. Do not silently change modes or model settings. File selection and mode/region changes do not automatically analyze. Analyze runs the chosen mode on the selected PCM, then shows the existing calibrated TAB. Keep processing, empty-result and failure feedback next to the editor; expose progress via a live status region. Disable Analyze until a valid decoded selection exists and while its job is pending.
3. Changing file, mode, region, demo or clear invalidates/aborts old analysis. A stale TAB and downloadable analysis must not be usable as if they describe the new selection. Demo/clear close the editor and release its media resources; MIDI retains the existing direct import. Stop competing source-preview and TAB playback before starting either transport or a new selection.

## Technical approach

- Pin the researched WaveSurfer.js package and Regions plugin as the only new dependency. Validate its published API before installation. Use existing vanilla TypeScript/Vite components, no new service. Decode once using the existing AudioContext path, close its context, retain the decoded buffer while editing, and compute display-only peaks for WaveSurfer `loadBlob(file, peaks, duration)`. Verify this pinned API path; if single-decode integration fails, report the blocker rather than feeding display-decoded data into transcription.
- Extend `SourceImporter` minimally with guarded audio preparation and selected-buffer analysis; preserve current MIDI loading and its `load` compatibility where needed. Reuse existing generation/abort/pending ownership, server endpoint and all-channel mono averaging. Define clear resource ownership so decoded buffers, object URLs, event handlers and waveform instances are released on replacement and teardown. A canceled non-cancellable decode may finish but cannot publish.
- Reject invalid time bounds before indexing: both must be finite, `0 <= startSeconds < endSeconds <= buffer.duration`, with duration no greater than the shared limit. Convert valid bounds to clamped sample indices: `startIndex = max(0, min(buffer.length, floor(startSeconds * sampleRate)))`, `endIndex = max(0, min(buffer.length, floor(endSeconds * sampleRate)))`. Require `0 < endIndex - startIndex <= floor(limit * sampleRate)`; otherwise reject the edit instead of silently truncating. Store the indices as the canonical selection and derive displayed/preview bounds and metadata from those actual indices. Requests use the decoded buffer's actual sample rate. The source frequencies and event clocks remain fragment-relative; adaptation is unchanged.
- Add optional `sourceWindow: { startSeconds, endSeconds, sourceDurationSeconds }` to both audio source-analysis variants. Schema version 1 permits this additive optional provenance; existing consumers continue accepting documents without it. Do not add the original offset to notes or model frames.
- Implementation correction from code review: apply representation-error snapping only at integer sample boundaries before flooring, so displaying `index / sampleRate` and editing the other edge does not change the original index. Keep the integer-sample duration limit strict; use a scale-aware roundoff allowance in the decimal duration check.
- Gate global ocarina keydown and keyup while an editor input/control owns keyboard interaction; release held notes/modifiers on entering editing or shifting focus. Keep game controls functional elsewhere. The editor must not revive the arrow-scroll bug or leave a held note stuck.
- Whole-file browser decode remains a memory limitation. This change does not claim streaming/chunked decode. Reject decode failures visibly and document the limit; no arbitrary file-size policy without measurements.

## Work boundaries

In scope: selected-buffer lifecycle, sample cropping, waveform/editor controls, explicit analysis and feedback, source-window provenance, docs and focused tests. Out of scope: model accuracy changes, projection changes, calibration, fixed songs, storage/publishing, generic TikTok-outro recognition and long-file streaming. No uploads to external services.

## Verification and delivery

- Cropping tests use distinguishable stereo samples at a non-44.1kHz clock, nonzero start, maximum-length/end-of-file bounds and invalid selections, including negative bounds and one sample beyond the maximum. Assert actual PCM, request rate, local timing and provenance at the owning layer. Editor tests verify invalid/over-limit field and region edits restore the accepted selection and cannot submit a different hidden crop.
- Lifecycle tests cover selection/mode/file/demo/clear changes across deferred decode and model work, stale successes/errors, resource release and disabled/stale results. Preserve MIDI behavior once, avoiding duplicated importer tests.
- Editor wiring tests cover explicit analysis only, selected region synchronization and keyboard focus lifecycle. Do not test WaveSurfer internals through mocks. Existing extraction/projection tests remain authoritative for melody behavior.
- Exercise the real editor through browser tooling at desktop and mobile widths, using a supplied local audio reference: upload, adjust a nonzero window, preview, run actual model analysis and inspect TAB/status. Verify no request on mere adjustment, keyboard input safety, replacement/clear and cleanup. Explicitly compare media preview boundaries/clock with the decoded PCM selection using non-initial windows and identifiable attacks for WAV and the supplied MP3 reference. A mismatch must be reported and corrected or the affected codec blocked visibly; it cannot be delivered as a matching preview. Document exactly which codecs, touch and screen-reader behavior remain unverified.
- Obtain independent review of the shared importer/lifecycle contracts. Run focused checks while working; full suite and build once after integration. Confirm the Tailscale page and real same-origin analysis endpoint still work. No commit or public publication.

## Review and authorization

The user approved this reviewed plan: "Implementalo. Y que de cómo resultado cuando se analice el fragmento las notas del tab para reproducir y tocar". Implementation and the pinned dependency are authorized. Successful analysis must feed the existing playable, highlighted TAB and its calibrated ocarina playback and live controls.
