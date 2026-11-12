# Curated ocarina fragments

## Scope and quality contract

The successful catalogue is a symbolic curation workflow. It reads existing MIDI note events, uses human/agent judgement to identify the recognizable melodic voice, corroborates it against another transcription or score, and maps it deterministically to the configured instrument. It does not extract those notes from a mixed original recording. Agents research and adjudicate; executable scripts preserve and validate the events.

A candidate is not accepted merely because it is familiar or a MIDI exists. Keep the full agreed phrase; a source or range failure must be visible. Do not swap the agreed hook for an easier intro, remove a high note, fold octaves per note, insert artificial repeats, or claim an independent source if it is demonstrably a copy. Keep raw sources immutable and identify any prepared derivative explicitly.

## 1. Freeze the fragment

Record catalogue ID, title, franchise/artist, exact version, hook description and natural phrase boundaries. Prefer a complete recognizable theme statement rather than an arbitrary duration. The previous delivery includes useful hooks between about 6 and 14 seconds; duration is a preference, not permission to cut a phrase. A shorter complete riff is valid.

Check the existing catalogue and the current user-approved batch before proposing duplicates. Use the latest request and its inventory (for the 2026 expansion, `out/catalogue-2026/request.json`); historical inventories do not restrict later approvals. Processing approval does not establish musical suitability.

## 2. Preserve source evidence

Use source repository or transcription pages and verify downloaded bytes parse as MIDI. Archive URL, page URL, SHA-256, retrieval information, track names/counts, PPQ and tempo events. Keep these artifacts in the external media directory. A source index is a discovery aid, not a quality certificate.

Inspect all relevant tracks and simultaneous events. Identify melody versus bass, harmony, octave doubling, accompaniment, pickup and ornaments. Select explicit sorted event indices from one voice. For a polyphonic track, use corroborating evidence to choose events; do not infer the melody solely from maximum pitch. Preserve the selected notes and raw source bytes so the recipe can be replayed.

## 3. Extract exact timing

Use `scripts/catalogue-tools.ts:selectPhrase(midi, trackIndex, indices)`.

- Resolve every onset and note end through `midi.header.ticksToSeconds` using the full tempo map.
- Subtract the first selected onset to place the phrase at zero.
- Choose the tempo active at that onset as the arrangement time base. Divide elapsed seconds by its seconds-per-beat; this retains real timing even across subsequent tempo changes.
- Keep source start tick, end tick and source-start seconds for provenance.
- Require positive durations and a monophonic non-overlapping prepared sequence. Diagnose overlapping notes before selecting a voice. For a score-confirmed voice with a short legato tail (at most 50 ms), create a separately named derivative that ends that tail at the next attack. Retain every pitch and onset, preserve the raw MIDI, and record each original/new duration and the evidence. Never apply this to ambiguous chord voices or hide it in the strict selector.
- If the MIDI omits or mis-encodes tempo, confirm the intended metrical unit against a score before applying one documented global time scaling to a derived source. Preserve all relative rhythmic values and show raw versus prepared tempo. Do not relabel this as untouched source timing.
- A direct score transcription is allowed when a MIDI is incomplete or cannot establish the melodic voice or sustained releases. Identify the score as the primary source instead of silently patching MIDI note-offs. Retain the score or frame hashes, measure numbers, pitches, onset grid, merged ties, durations and transcription method. Compare the original MIDI explicitly, including release differences. A MIDI generated from a score is one source, not independent corroboration of that same score.

Do not reuse older inspection/export utilities that apply only the first BPM when building a final phrase with tempo changes. Preserve pickup rhythm, articulation, ties and terminal holds.

## 4. Corroborate before accepting

Find a score, game sequence, or second MIDI covering the same complete phrase. Inspect the actual content, not only a page title or metadata. Store the source and a reproducible pitch/rhythm comparison:

- MIDI: explicit reference track/indices, any constant pitch shift, all pitches, relative onsets and durations. Explain tempo, articulation and ornament differences.
- Score: render and inspect the relevant measures, record measure numbers, pitch sequence, rhythmic values, pickups and ties. A pitch-only transcription cannot establish rhythmic equivalence.
- Game source: decode the melody channel and account for octave convention, note length, rests and tempo commands. Compare the game sequence with the selected events.

A freely displayed notation video can supply the missing score evidence without acquiring a complete video or recording. Verify its title, arranger, key, meter and section; use chapters as discovery anchors, then inspect the actual phrase entrance and ending, including pickups across section labels. Extract only the relevant score frames externally with bounded `ffmpeg` requests. Record frame timestamps/hashes and manually transcribe the separate melodic staff, merging ties and distinguishing them from slurs. Compare every pitch, attack and release against the existing source. A piano roll and notation generated by that same video are one reference, not two. Do not infer voice identity from its highest simultaneous pitch or equate a chapter boundary with the final melody offset. When references use different beat units (such as 90 versus 180 BPM), compare real times and record the exact conversion.

Two mirrors of the same MIDI are one transcription. Distinct filenames or track counts alone do not prove independent authorship. Report source-family uncertainty. A contour-only comparison that collapses repeated notes is weaker than event-level corroboration and must remain labelled as such. Keep disagreements in the evidence record; do not average notes.

## 5. Adapt to this project's instrument

Read `src/core/pitches.ts`, `src/core/project.ts` and `src/core/prepare.ts` each time instrument configuration changes. Current written notes are D4/F4/A4/B4/D5, sounding one octave higher, with integer bends from -2 to +2. The nominal sounding union is C5 through E6 (MIDI 72–88): 16 semitones, 17 chromatic pitches. Per-note calibration affects frequencies; do not reset it to equal temperament.

Use `projectFaithfully`, which calls the existing calibrated projection and then requires for every note:

`pitchById(output.pitch).midi + 12 + output.bend === source.midi + oneUniformShift`

After preparing and freezing the source phrase, require identical note count, onsets and durations between that prepared source and the adapted arrangement. Report preparation edits independently. A projection confidence value is arrangement fit, not source accuracy. Reject when the equality gate fails. Preserve the complete rejected phrase and the reason. Do not use modulo/octave equivalence as a substitute for pitch equality.

Store curated arrangements as `fixedNotes`. This bypasses optional simplification and prevents ornaments or timing from being removed when the user changes settings. Record shift, bends and actual configured tuning deviation separately.

## 6. Group consecutive notes

Use `src/core/tab.ts:toTabRestGroups` for UI and exports. Split only when the silence since all preceding sound ended is both at least one source beat and at least 500 ms. In arrangement beats the threshold is `max(1, sourceTempoBpm / 120)`, with a numerical tolerance only.

A sustained note is not silence. Short articulation gaps stay inside their group. Preserve chronological order and original indices for playback highlighting. Evaluate at the source tempo; playback slowdown must not regroup the phrase. Responsive wrapping is presentation, not a new musical boundary. Do not add a `rest` badge for every staccato gap. Retain timestamps/durations in exports so omitted visual micro-rests remain playable.

## 7. Export and verify

Run `npx tsx scripts/build-catalogue.ts --audio` from the project root. The builder verifies source hashes and reference checks, selects phrases, rejects incompatible mappings, emits generated catalogue entries, and creates per-song arrangement JSON, source MIDI, adapted MIDI, tab and synthesized ocarina WAV with measurement output.

The synthesized WAV uses the shared voice model, short-note envelope and gap-limited release; preserve those fixes. Apply only uniform output gain to avoid clipping. A synthesized pitch check compares playback with configured frequencies, including calibration; it does not compare against an original recording. An equal-tempered adapted MIDI is a symbolic interchange artifact and does not encode calibrated in-game tuning.

Run focused grouping and catalogue tests during development. At final integration run `npm test` and `npm run build` once. Review generated data for accidental source changes. For UI changes obtain desktop/mobile browser evidence when supported, otherwise say `NOT visually verified`. Do not claim physical game verification without actually doing it.

## 8. Store original clips and future extraction labels

`out` is an ignored relative symlink to `../ocarina-tabs-media`. `ensureExternalMedia()` refuses an in-project media directory for catalogue and audio rendering. Keep source MIDI, original clips, annotations and synthesized previews in clearly named subfolders. Do not commit media or local absolute paths into catalogue definitions when a stable external-relative reference is sufficient.

Use `scripts/fetch-audio-clip.ts <id> <source-page> <start-seconds> <end-seconds> [--direct]` to resolve a stream and save only the chosen time window, with provenance. Do not retain a full recording or mislabel a MIDI rendering/cover as the commercial/game recording. Downloaded duration and sample rate must be checked. If an endpoint fails, log it; do not substitute a different version silently.

For each future corpus item retain:

| Artifact | Required fields |
| --- | --- |
| Original clip | ID, recording title/version, page and media source, requested bounds, decoded duration/sample rate, SHA-256, retrieval date, source type |
| Source melody | MIDI/score provenance, source pitch events, onsets/offsets in clip seconds, annotator and validation state |
| Alignment | Recording-to-MIDI offset and any tempo transformation, checked landmarks across the entire phrase, measured timing error, disagreements |
| Adaptation | Separate shifted notes, instrument configuration/calibration version, transposition and bends |
| Quality | Independent flags for phrase corroboration, original-recording audit, timing alignment, synthesized playback check and physical-game verification |

A MIDI timestamp is not automatically a timestamp in an original recording. Match the exact recording version and align across the entire phrase, not just the first note. Until checked, set `alignmentValidated: false` and exclude the pair from extraction evaluation/training. Transposed pitches and synthesized audio are useful arrangement artifacts but are not original-audio transcription labels. Keep related recordings/arrangements of one song in the same dataset split later to avoid leakage. No training is part of this curation task.

After rebuilding the delivery, run `npx tsx scripts/build-corpus-index.ts` to index the clips with their source selections and adapted arrangements. This inventory intentionally keeps all pairs in an unvalidated state; a spectral localization candidate does not promote a pair to a validated label.

Recording-version checks matter: the unsuffixed Undertale Bandcamp track URLs point to the 2013 demo, while the 2015 soundtrack uses `-2`. The Numb official video has environmental audio before the keyboard pickup. Localize the phrase in the recording rather than using MIDI timestamps as crop bounds. Original soundtrack tempo can also differ from a transcription (Fallen Down is approximately 110 BPM versus the selected MIDI 100 BPM).

## 9. Audio extraction without model training

MIDI parsing, tempo conversion, range validation, mapping, grouping, export and audio cropping are deterministic and reusable in the app/tooling. A clean monophonic recording can also support classical pitch tracking and onset segmentation; this project already has a DSP path. A mixed pop/anime recording adds source separation and lead-voice selection, which those utilities do not solve reliably. The current catalogue does not demonstrate automatic mixed-audio extraction. Preserve aligned originals for a later honest benchmark of the upload flow.

## Regression lessons from the first delivery

- Naruto's first MIDI notes were an instrumental intro, not the agreed main phrase. The corrected selected phrase begins at event 10 and has 14 notes.
- Take On Me uses the lower voice of 24 octave pairs. A 25th event incorrectly started the next repetition.
- Pokémon Route 1 needed the Johnnyz source, corroborated against the game sequence; another arrangement added ornaments.
- Evangelion's source is polyphonic. Manual selection and contour corroboration do not resolve every repeated-note articulation.
- Mario's complete proposed phrase spans 17 semitones and was rejected; a tiny recognizable intro is not an authorized replacement.
- MIDI previews initially exposed short-note envelope and release-tail overlap defects. Preserve the shared voice fixes; clipping checks alone cannot detect harmonic pitch contamination.

## Acceptance checklist

For every approved candidate report a terminal curation result or an explicit pending blocker. An accepted symbolic arrangement needs an identifiable complete phrase, reproducible event selection, stated corroboration level, monophony, faithful uniform mapping and playback verification. An accepted audio-corpus pair additionally needs the matching original clip and validated source-pitch/time alignment. Report these two acceptance levels independently.

## Expansion regression lessons

- Pokémon Center's complete opening includes the low A/E response after the initial call. E4 through A5 spans 17 semitones and is rejected.
- Green Greens' complete first phrase includes a low G pickup and a high C, also 17 semitones. Reject instead of dropping the pickup.
- Mii, Tapion and Totoro required transparent closure of 21–27 ms legato tails, with raw bytes and edit records preserved.
- Always With Me's tempo-less MIDI encoded the score at half the beat resolution. A documented derivative restores the 130 BPM, 3/4 metrical time base.
- Africa was withdrawn after user playback review: its 13-attack vocal line contains eleven A4 attacks followed by two G-sharp4 attacks. The mapping preserves that source contour; it did not collapse a varied melody. Correct pitches and range fit did not establish a recognizable unaccompanied instrumental hook. Repeated-pitch share, longest repeated run, distinct pitches and span can flag candidates for review, but are not universal rejection thresholds. Compare the complete phrase as a melody alone; never simulate listening evidence. See [the quality review](../../../docs/catalogue-quality-review.md).
- Blue Bird's first six notes (3.2 seconds) cover one vocal line, not the recognizable chorus requested by the user. A local cadence is insufficient evidence for the requested section boundary. Extend and corroborate the agreed chorus, then check its complete range; do not repeat the short fragment to manufacture length.
- Keep exported MIDI PPQ within its supported positive 15-bit range. Use the existing 9600 PPQ convention and assert it survives parse/write round-trip; 96000 overflows the file header and stretches playback.

## Replaying the retained expansion

From the project root, the archived research recipes can be replayed with:

```bash
npx tsx out/catalogue-next/batches/mixed/extract.cjs
npx tsx out/catalogue-next/curate.cjs
npx tsx scripts/build-catalogue.ts --audio
npx tsx scripts/build-corpus-index.ts
```

The app manifests are the integrated source of truth; historical per-cohort preliminary findings are superseded by `out/catalogue-next/ASSESSMENT.md`. Research recipe changes require deliberate integration into `scripts/catalogue-next-manifest.json` before rebuilding the app.

For recording localization, preserve the recording page, version, source window and spectral candidate separately. A known-melody spectral template search can locate the selected motif in a partial stream; it does not recover an unknown melody and must not validate itself. Keep short endpoint margins and review boundary candidates manually. Only final phrase excerpts are retained in the corpus; partial analysis windows are replaced after cropping. Re-download a fresh analysis window before replaying a localization/crop sequence. The crop script rejects an already-applied localization to prevent a second trim against stale bounds.

Some reference recordings are later performances or reissues rather than the first soundtrack release. Record the edition explicitly and leave identity/alignment unvalidated until checked. Never describe an attributed upload as a verified original mix.

- Kaiju was pending because short polyphonic piano note-offs did not establish vocal holds. Public Saori8Piano notation frames supplied the complete separate upper-staff F chorus (bars67–82beat2), confirming all40 guide pitches/attacks and exposing ten release variants. A direct score source preserves its ties and rests; the G pickup begins before the next full bar and belongs to the next phrase. This resolves symbolic curation without claiming listening or validated original-audio alignment.
