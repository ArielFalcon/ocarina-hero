# Main melody extraction from recorded audio

Objective: maximize how faithfully Main melody mode extracts the lead melody from uploaded recordings (mp3, wav, m4a, ogg) and how correctly it is adapted to the ocarina TAB.
Branch: none (no git repository); delivery inline, verified per task. Strategy: exception-ok (no commits possible).
Test runner: `npm test` (tsx --test); Python decoder tests run with the local runtime (`.runtime-melody/venv/bin/python -m unittest`).

## Specs

- **S1** User request, verbatim: "afinarlo y mejorarlo todo lo que se pueda hasta que extraiga las canciones de audios con las melodías bien y las adapte correctamente. No solo MIDI que es más fácil, sino audios mp3 etc"
- **S2** Priority, verbatim from the earlier request: "La prioridad es el modo melodia, no el modo instrumento."
- **S3** (assumption) Progress is measured on a reproducible benchmark of the 29 corpus recordings against their curated source melodies: note F1 (exact pitch, ±100 ms onset), frame pitch accuracy, sequence similarity, and TAB-level agreement after projection. Parameter choices must hold on held-out clips (cross-validation), not only on the full set.
- **S4** (assumption) Keep existing contracts and limits: local inference only, 15 s fragment limit, `/api/melody` request format, SourceAnalysis schema version 1 remains readable; silence/noise controls must not produce notes.
- **S5** (assumption) Isolated instrument mode and MIDI import keep their current behavior.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S3 | inline | done | `scripts/melody-benchmark.ts` + `scripts/melody-metrics.ts`; baseline reproduces harness (F1 0.424); `out/melody-benchmark/baseline-production.json` |
| T2 | S1 S3 S4 | inline | done | `scripts/melody_decoder.py`; RED (missing module) → GREEN 7 tests; server/parser provenance RED → GREEN |
| T3 | S1 S3 S4 | inline (dependency: item 5) | done | onnxruntime 1.23.2 pinned, nmp.onnx sha256 2c3c1d14… via git at v0.4.0; F1 0.669, TAB 0.657 (`fused-v1.json`) |
| T4 | S1 S3 | inline | done | Measured and rejected: Demucs, onset/energy repeat splitting, octave correction, RMVPE (see docs/local-melody.md) |
| T5 | S1 S3 | inline | done | Sounding-pitch TAB metric; references adapt with fidelity 1.00; remaining TAB loss comes from extraction voice errors; no projection change |
| T6 | S1 S4 S5 | inline | done | Docs updated; real `/api/melody` with mp3-decoded PCM (numb exact, golden) and silence/noise → 0 notes; no UI change, NOT visually verified in browser |
| T8 | S1 S3 | inline | done | Coconut Mall regression (user clip): rhythm-adaptive minimum + voicing 4; corpus F1 0.669→0.685 (`fused-v2.json`), Coconut 0.55→0.63; smoothing rejected; decoder id v2 |
| T7 | S1–S5 | delegated verifier (high risk item 5) | done | Found noise/click false notes (fixed: absolute Basic Pitch scaling, RED→GREEN) and test gaps (7 tests added); recheck: all noise/click cases 0 notes, 30/36 mutants killed (6 minor survivors), docs match JSON |

## Log

- **L1** (2026-11-12) "Prepara el plan y encárgate de todo de forma autónoma. El objetivo es afinarlo y mejorarlo todo lo que se pueda hasta que extraiga las canciones de audios con las melodías bien y las adapte correctamente. No solo MIDI que es más fácil, sino audios mp3 etc"
- Prior analysis: `../ocarina-tabs-media/main-melody-viability-2026-11-12/REPORT.md` (production note F1 0.42; SegNet+Viterbi 0.58; fusion 0.65, held-out 0.64).
- **L2** (2026-11-12) "lo probé con este audio. El fragmento inicial de 12.6 segundo y el resultado fue mediocre. No se entiende la melodía generada, pierde muchísimas notas y no tiene mucha precisión. Busca referencia del motivo principal de coconut mall theme o analizalo tu para que veas que genera. Es un ejemplo para mejorar de forma transversal y afinar mejor el extractor no para sacar esa canción y ya"
- **L3** (2026-11-12) "Recuerda medir como afectan estos cambios en los demás audios. La idea es mejorar la extracción en general, no adaptarla a este caso"
