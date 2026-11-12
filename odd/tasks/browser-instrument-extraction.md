# Browser extraction for Isolated instrument mode

Objective: replace the periodicity detector behind Isolated instrument mode with Basic Pitch running in the browser (onnxruntime-web) and a TypeScript port of the melody decoder, measured on every available recording.
Branch: none (no git repository); delivery inline, verified per task. Strategy: exception-ok (no commits possible). Forecast: ~900 authored lines.
Test runner: `npm test` (tsx --test); benchmark scripts with tsx.

## Specs

- **S1** User request, verbatim: "Adelante con todo, no te detengas hasta tenerlo mejorado y probado con todos los audios disponibles"
- **S2** Recommended option the user approved: "Basic Pitch en el navegador, más el decodificador portado a TypeScript" (in the earlier Spanish reply).
- **S3** (assumption) "Todos los audios disponibles": the 30 corpus and benchmark clips, the Phoenix_ScotchMorris flute, violin and mix with f0 gold, the 1998 isolated ocarina and 2026 transcription-benchmark references, and synthetic silence, noise and click controls. Each one is scored for the old and new Isolated engines and for Main melody.
- **S4** (assumption) Main melody mode, MIDI import, and the `/api/melody` contract keep their behavior. Isolated mode stays client-side and works on the static build. Silence, noise, and clicks produce no notes.
- **S5** (assumption) If the model or WebAssembly runtime cannot load, the analysis falls back to the previous detector and says so in its warnings.
- **S6** (assumption) Parameters are chosen on the benchmark and must hold on held-out clips, not only on the full set.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S2 S4 | inline (dependency: item 5) | pending | onnxruntime-web pinned; model asset with checksum and license |
| T2 | S2 | inline | pending | TS resampler, Basic Pitch framing, decoder with unit tests (RED→GREEN) |
| T3 | S3 S6 | inline | pending | Cached posteriors; decoder parameters tuned with cross-validation |
| T4 | S2 S4 S5 | inline | pending | Import wiring, engine provenance, fallback, tests |
| T5 | S3 | inline | pending | Benchmark over every recording, old vs new vs Main melody |
| T6 | S4 | inline | pending | Static build, browser check at mobile and desktop widths, docs |
| T7 | S1–S6 | delegated verifier (item 5) | pending | Independent verification |

## Log

- **L1** (2026-11-12) "Adelante con todo, no te detengas hasta tenerlo mejorado y probado con todos los audios disponibles"
- Prior analysis (2026-11-12, F1 of notes): flute isolated 0.66 / melody 0.70 / Basic Pitch-only 0.64; violin 0.60 / 0.80 / 0.74; mix 0.25 / 0.60 / 0.56; corpus isolated 0.20 vs melody 0.685.
