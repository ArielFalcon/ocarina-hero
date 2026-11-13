---
name: ocarina-catalogue
description: "Trigger: curate songs, ocarina catalogue, MIDI hooks, audio corpus. Extract, corroborate and faithfully adapt playable melody fragments."
license: Apache-2.0
metadata:
  author: "ariel"
  version: "1.0"
---

## Activation Contract

Use for curated song fragments, catalogue expansion, source corroboration, or aligned audio/melody corpus preparation in this project. Read [the pipeline](references/pipeline.md) before selecting notes.

## Hard Rules

- Read the actual pitch configuration; preserve calibration and playback envelopes.
- Preserve the complete agreed phrase and every melodic interval. Freeze an evidenced source, record any preparation edits, then preserve its events under one uniform transposition; reject incompatible phrases.
- Select the melodic voice explicitly. Never use an automatic highest-note filter as evidence.
- Corroborate notes and rhythm with a second source; report ancestry uncertainty and discrepancies.
- Never equate mapping fit, synthesized pitch checks, source corroboration, listening feedback and original-recording validation.
- Keep media outside the project via `ensureExternalMedia()`. Retain matching original audio clips only, never whole recordings. Label synthesized previews separately.
- Do not enable model training or change the upload extractor as part of curation.

## Decision Gates

| Condition | Action |
| --- | --- |
| Full agreed phrase exceeds configured range | Reject; do not shorten it to pass |
| Polyphonic or ambiguous source | Inspect a score or separate voice; keep explicit event indices |
| Corroboration unavailable or disagrees | Mark pending with the precise missing check |
| Vocal hook has little pitch movement, or selection ends before the recognizable section resolves | Review standalone recognizability and phrase boundaries before accepting; range fit is insufficient |
| Original clip unavailable or unaligned | Preserve catalogue evidence; exclude from validated audio corpus |

## Execution Steps

1. Freeze title, version and recognizable phrase boundaries.
2. Archive source URLs, hashes, track and event indices externally.
3. Use `selectPhrase` for tempo-map-aware extraction; resolve ambiguity without altering source events.
4. Compare the complete selected sequence and rhythm against corroborating evidence. When a MIDI leaves voice or holds ambiguous, inspect an actual score or the relevant frames of a freely displayed notation video; see the pipeline for provenance and beat-unit conversion.
5. Use `projectFaithfully`; inspect actual configured notes, bends and uniform shift.
6. Build fixed arrangements with `scripts/build-catalogue.ts`; group through `toTabRestGroups` at source tempo.
7. Obtain only the corresponding original clip; retain provenance and alignment state separately from adapted notes.
8. Audit previews, source fidelity and corpus alignment independently. Run focused checks, then final tests/build once.

## Songbook Metadata

Every bundled song gets an explicit entry in `src/ui/songbook.ts`; none may fall back to `Other melodies`. The card shows `title`, then `universe · version`.

| Field | Rule | Example |
| --- | --- | --- |
| `title` | Song name only: no franchise, artist, dash or `·` | `Cornfield Chase`, not `Cornfield Chase — Hans Zimmer` |
| `universe` | The franchise for games, anime, film and TV; `Pop` or `Classics` when there is none. Reuse an existing universe before creating one | `Super Mario`, not `Super Mario 64` |
| `version` | Specific game, film, season or arrangement inside the universe | `Super Mario 64`, `Spirited Away`, `Season 2 opening` |
| `artist` | Only in `Pop` and `Classics`; join performers with `&` | `PinkPantheress & Zara Larsson` |
| `aliases` | Composers and performers of franchise songs, alternate and original titles, so they stay searchable | `['Hans Zimmer']`, `['On The Way']` |
| `categories` | Primary first: `Games`, `Anime`, `Film` (includes TV), `Pop`, `Classics`. Add a second only when the song genuinely belongs to both | Studio Ghibli: `['Anime', 'Film']` |
| `icon` | Optional per-song patch. Never another franchise's emblem; emblem icons are named after what they depict, so look at the SVG, not the name | Greensleeves: `flower`, not `konohaLeaf` |

- A franchise theme without a proper name is titled `Main Theme`; keep the full name as an alias.
- Verify the franchise of a new song from a primary source; manifest categories such as `Anime / 2026` are not enough.
- The generated title in `src/core/songs/catalogue-index.ts` never replaces this entry. `scripts/songbook.test.ts` enforces these rules for every bundled song.

## Output Contract

Return accepted/rejected/pending status per approved fragment, evidence, deviations, exact source selection, adaptation, exports and verification limits. Never describe pending material as validated. Follow the acceptance checklist and corpus fields in the pipeline.

## References

- [Detailed pipeline, provenance and regression lessons](references/pipeline.md)
