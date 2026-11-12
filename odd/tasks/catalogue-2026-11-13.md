Objective: curate and integrate the 15 approved Tier A melodies at full catalogue quality, and explore 30–40 more quality proposals.
Branch: master (no commits unless asked). Delivery: single integration after curation; root of this thread owns shared files. Test runner: vitest (`npm test`), focused `scripts/catalogue.test.ts`, `scripts/songbook.test.ts`.

## Specs

- S1: "Agrega las 15 usando subagentes y sigueindo todos el proceso de calidad establecidos." The 15 are the Tier A ids in `out/catalogue-2026-11-13/request.json`; the quality process is `skills/ocarina-catalogue` (pipeline + Songbook Metadata).
- S2: "Manda otros agentes a seguir explorando y trae al menos 30-40 propuesta de calidad" — new proposals not in `out/catalogue-research-next/2026-11-13-round2/exclusions.json`.
- Assumption: integration appends to `scripts/catalogue-pop-culture-manifest.json` (no generator change) plus `src/ui/songbook.ts` entries; all existing arrangements must stay byte-identical.

## Tasks

- T1 (S1) curate pop 7 — delegated (independent lens, parallel) — pending
- T2 (S1) curate film-tv 5 — delegated — pending
- T3 (S1) curate gaming 3 — delegated — pending
- T4 (S1) consolidate + source review sample — inline — pending
- T5 (S1) integrate manifest + songbook, build --audio, corpus index, focused tests, full suite, build — inline — pending
- T6 (S2) exploration round 2 (3 explorers) — delegated — pending

## Log

- L1 (2026-11-13): "Agrega las 15 usando subagentes y sigueindo todos el proceso de calidad establecidos. Manda otros agentes a seguir explorando y trae al menos 30-40 propuesta de calidad"
