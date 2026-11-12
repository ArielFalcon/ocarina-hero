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
| T1 | S2 S4 | inline (dependency: item 5) | done | onnxruntime-web 1.31.1 exact (MIT, published 2026-10-26); public/models/basic-pitch-nmp.onnx sha256 2c3c1d14… + LICENSE/NOTICE; digest test |
| T2 | S2 | inline | done | src/core/melody-decoder.ts, src/core/basic-pitch.ts; 12 tests (written after code: no strict RED); weak-floor test caught height-bias voicing defect RED→GREEN (bias normalized) |
| T3 | S3 S6 | inline | done | 768+432 combos; chosen scale 2, silence 0.5, change 2, voicing 2, min 0.06 s, repeat onset 0.7; full 0.775, held-out 0.748 |
| T4 | S2 S4 S5 | inline | done | src/ui/import.ts engine basic-pitch / isolated-periodicity fallback with warning; 2 new import tests; npm test 131/131, tsc OK |
| T5 | S3 | inline | done | out/instrument-benchmark/basic-pitch-v1.json: corpus 0.20→0.61 (Main 0.68), flute 0.67→0.71, violin 0.60→0.83, mix 0.25→0.59, refs 0.87→0.98, synth 0.97→0.93, controls 0 notes |
| T6 | S4 | inline | done | static build emits wasm (3.9 MB gz, lazy) + models; Chrome dev and static: 15 s in 1.1 s, mp3 UI flow OK; note layout 375/1440 px no overflow (geometry; screenshots unavailable); docs updated |
| T7 | S1–S6 | delegated verifier (item 5) | done | No blockers. Python parity confirmed (framing max diff 2.8e-4, identical decoded paths); edge cases 8–96 kHz and 0–15 s OK; stale-generation probes OK; static lazy chunk OK; docs match JSON; 13/27 mutants survived (advisory: framing and penalty tests weak) |

## Log

- **L1** (2026-11-12) "Adelante con todo, no te detengas hasta tenerlo mejorado y probado con todos los audios disponibles"
- Prior analysis (2026-11-12, F1 of notes): flute isolated 0.66 / melody 0.70 / Basic Pitch-only 0.64; violin 0.60 / 0.80 / 0.74; mix 0.25 / 0.60 / 0.56; corpus isolated 0.20 vs melody 0.685.
