# Ocarina Tabs

Turn an external song into a button sequence playable on the ocarina of *The Legend of Zelda: Ocarina of Time* (Nintendo Switch 2, 2026 remake).
Delivery: local MVP, phase by phase. No git repository yet, so no work-unit commits.
Test runner: vitest.

## Specs

**S1 — Five fixed pitches, monophonic.**
The instrument reproduces exactly the remake's five pitches, with no transposition and one voice at a time.

| Pitch | Hz | Switch 2 button | N64 equivalent |
| --- | --- | --- | --- |
| D4 | 293.66 | L | A |
| F4 | 349.23 | R | C-Down |
| A4 | 440.00 | A | C-Right |
| B4 | 493.88 | Y | C-Left |
| D5 | 587.33 | X | C-Up |

Source: Nintendo Support (mic input page), Nintendo Life, and button sequences cross-checked against five known N64 melodies.

**S1b — Pitch bend is part of the instrument.**
User requirement verbatim: "en el moderno se puede usar tanto el joystick izquierdo hacia arriba y abajo como las flechas de arriba y abajo para alterar las notas actuales que se tocan".
Verified: the stick bends continuously up to a whole tone in either direction; the D-pad moves the pitch by a semitone. So the reachable set is five buttons plus ±2 semitones, which covers every chromatic step from C4 to E5. Keyboard mapping: Arrow Up/Down for the stick, Shift + Arrow for the D-pad.

This changes the arrangement problem: the full Zelda's Lullaby needs notes outside the five buttons, and bends make it playable, so tabs carry a bend per note and the projection searches 25 reachable positions instead of five.

**S2 — Keyboard mapping for the MVP.**
Literal letters `L R A Y X` map 1:1 to the Switch 2 ocarina buttons, using `KeyboardEvent.code` so the physical key is stable across layouts.

**S3 — No microphone anywhere.**
User requirement verbatim: "nada de microfono". No `getUserMedia`, no pitch detection, no audio input.

**S4 — Visible controller reference.**
User requirement verbatim: "con referencia de cada tecla a la original del mando de nintendo". Every on-screen key shows its Switch 2 button, its N64 equivalent, its pitch and its frequency.

**S5 — The 12 in-game songs are the calibration ground truth.**
User requirement verbatim: "Para todas las decisiones referentes al juego se usara como referencia el remake actual de Ocarina of Time de noviembre de 2026". The in-game songbook (ZL) is the authority for the 12 taught melodies.

**S6 — No runtime AI.**
User requirement verbatim: "como que modelo de inferencia local eso es carisimo, claro que no". Only deterministic code at runtime.

**S7 — No full-mix mp3.**
User requirement verbatim: "la ocarina no va a reproducir instrumentos como bateria, bajo, etc". Mix-level audio input is out of scope unless a measured benchmark clears the threshold.

**S8 — Output artifact.**
Given a melody, the system produces a button tab plus an audio preview of the five pitches, so the arrangement can be judged before learning it.

## Tasks

| ID | Task | Specs | Route | Status |
| --- | --- | --- | --- | --- |
| T1 | Pitch model, keyboard mapping, controller reference | S1, S2, S4 | inline | done |
| T2 | Audio engine: five pitches, monophonic, sample-accurate scheduling | S1, S8 | inline | done |
| T3 | Tab renderer: pitches to button bars | S8 | inline | done |
| T4 | Minimal page and demo melody | S4, S8 | inline | done |
| T5 | Unit tests for mapping, scheduling and tab | S1, S2, S8 | inline | done |
| T6 | Projection to the five pitches (Viterbi, twelve transpositions) | S1, S8 | inline | done |
| T7 | MIDI ingest: melody track selection and monophonic flattening | S8 | inline | done |
| T8 | Upload path in the page, plus projected preview | S8 | inline | done |
| T9 | MusicXML ingest | S8 | — | pending |
| T10 | Pitch bend: instrument, tab notation and projection states | S1b | inline | done |
| T11 | Ocarina timbre: breath noise, reverb, legato glide, longer release | S8 | inline | done |
| T12 | Demo set: full Lullaby theme, Ode to Joy, Happy Birthday, Twinkle | S8 | inline | done |

## Log

**L1 — Original request (verbatim).**
"debes plantear si es viable hacer una web donde se pueda tocar la ocarina de Zelda Ocarina of Time con las mismas notas y de la misma forma que se puede hacer en la version remake del juego lanzada en noviembre de 2026. El objetivo es hacer una web que tenga instrucciones para tocar canciones conocidas adaptadas a las limitaciones y controles del Zelda, para poder reproducirlas en el juego. Es decir seria una especie de tutorial. Hay dos formas de hacerlo segun las limitaciones tecnicas: 1. Buscar la forma de recopilar un grupo importante de canciones populares que tengan ritmos conocidos y con acordes publicados en alguna base donde recopiarlos. 2. Permitir subir una cancion y sacar las notas con alguna herramienta opensource que permita mapear sonido a una estructura similar a una partitura o al menos una tabla de acordes, de forma que se pueda mapear luego a los sonidos disponibles en el Zelda y mostrar como tocarlo. Cualquiera de estas dos alternativas debe poder ejecutarse sin IA cuando el usuario entra. En caso de ser justificado, se podria ejecutar son el modelo Jev, que permite sacar respuestas estructuradas predefinidas, en caso de que fuera viable para la alternativa 2, que es la deseable pero solo si se puede lograr sin complejidad muy alta. Para todas las decisiones referentes al juego se usara como referencia el remake actual de Ocarina of Time de noviembre de 2026, no el original. A menos que el sistema de tocar musica en la ocarina sea el mismo y el antiguo tenga mas documetacion. No me interesa indagar ahora en la UI de la web, solo que planifiques bien el sistema de funcionamiento interno para que sea fiable y funcional, fiel al videojuego y a la experiencia original."

**L2 — Scope correction.**
"no hace falta microfono, el objetivo es transformar la cancion externa en una cancion que se pueda tocar con los botones de la ocarina, nada de microfono."

**L3 — Rejection of text input, MVP scope.**
"entrada de texto por acordes no sirve."
Two alternatives to analyse; upload only if melody extraction is proven viable; otherwise build a scanned catalog starting with a few dozen songs.

**L4 — Keyboard mapping and go-ahead.**
"El instrumento debe estar mapeado a teclas del teclado inicialmente, para el mvp, con referencia de cada tecla a la original del mando de nintendo." Then: "adelante".

**L5 — Verified instrument facts (research).**
Remake released 2026-11-05 on Switch 2. Five pitches unchanged. Audio input exists but is out of scope. Practice Mode validates pitch and duration. 12 taught songs plus Scarecrow's Song. A "Swap Ocarina-Playing Controls" setting implies a second button scheme that is still undocumented and must be captured from the game later.

**L6 — Phase 0 decision.**
No framework. Vanilla TypeScript plus Vite, with the audio engine, the pitch model and the tab renderer separated from the page so the later projection phase can reuse them. Live input is recorded as fixed one-beat notes; real rhythmic capture belongs to practice mode.

**L7 — Phase 0 evidence.**
`npm test`: 3 files, 16 tests passed. `npm run build`: `tsc --noEmit` clean, Vite bundle 6.62 kB JS / 3.06 kB CSS. Dev server serves `http://localhost:5173/` with HTTP 200 and transforms `/src/ui/main.ts`.
Not verified: audio output and visual rendering. No desktop browser was connected to the session, and sound cannot be asserted from a terminal. The first acceptance run has to be manual: press `L R A Y X`, confirm each pitch, confirm the tab shows the matching button and the `N64` reference.
No git repository exists, so nothing was committed.

**L8 — Projection and MIDI ingest (agile pass).**
`npx tsx scripts/preview.ts`: feeding the six Lullaby pitches back into the projector returns `Y X A Y | X A` with confidence 100% and 0 moved notes, so the reducer does not damage an input that is already valid. Ode to Joy (C major) projects to `Y Y Y X | X Y Y A | R R A Y | Y A A`, confidence 91%, 4 of 15 notes moved, best transposition +7.
`npx tsx scripts/smoke.ts`: builds a three-track MIDI (lead, bass, drums), writes `out/smoke.mid`, reads it back, and correctly picks `Lead` while excluding channel 9 and losing the bass on register.
`npm run build`: 27 modules, 42.15 kB JS. Dev server HTTP 200.
Still unverified: audio output and visual layout. Not adding further automated tests, per instruction.

**L9 — Bend, timbre and full melody (corrections).**
User feedback: the bend was missing, notes were cut abruptly and sounded electronic, the Lullaby example was only the opening phrase, and there were no easy songs to play.
Verified on the remake: stick bends continuously up to a whole tone, D-pad moves a semitone.
Implemented: `Note.bend` in the IR; 25 projection states (5 buttons × -2..+2) with a cost for using and changing the bend; tab notation `X-1` / `Y+2`; Arrow Up/Down and Shift + Arrow in the page; engine bends the sounding voice.
Timbre: filtered noise breath layer, generated reverb impulse, 220 ms release, and legato glide between adjacent notes.
Demos: in-game six-note Lullaby, full Lullaby theme (71 notes, 3/4), Ode to Joy, Happy Birthday, Twinkle Twinkle. A "Use bends" toggle re-arranges the current song with 0 or 2 semitones.
Measured: in-game Lullaby 100% confidence, 0 moved. Full theme 89%, 17/71 moved, 23 bent. Ode 92%, 2/15 moved, 6 bent. Happy Birthday 92%, 4/25 moved, 5 bent. Twinkle 90%, 3/42 moved, 21 bent.
The full theme comes from a letter-note transcription; octaves are reconstructed by nearest motion, so it is an arrangement, not an official score. The exact in-game trigger melody is still the six-note version, kept separately.
Removed the test suite and vitest, per the user's instruction. `tsc --noEmit`, the Vite build and `scripts/smoke.ts` still pass.

**L10 — Full review after three reported defects.**
1. Bend matrix: confirmed, the projection runs over 25 states (5 buttons × -2..+2 semitones). The full Lullaby uses 7 bent notes, so the matrix is active in the output, not just in the instrument.
2. Static noise: two causes. The voice had a 5% white-noise "breath" layer and the reverb was a convolution against a white-noise impulse response, so every note fed noise into a 1.3 s noisy tail. Both removed: the voice is now three harmonics (f, 2f, 3f) and the room is a short damped feedback delay with no broadband noise.
3. Wrong full Lullaby: the previous 71-note version came from a piano "right hand" letter list that includes accompaniment, and octaves were reconstructed by nearest motion, which collapsed the register and destroyed the intervals. Replaced with a real OTI MIDI transcription (`out/lullaby.mid`, 4 tracks), melody track extracted by the project's own `extractMelody`, real octaves preserved and exported to `src/core/songs/lullaby.json` by `scripts/export-melody.ts`.
Evidence: full theme 49 notes, 90% confidence, 9/49 moved, 7 bent, transposition 0. In-game Lullaby still 100% and exact. Also fixed: pressing a key after playing a song now starts a fresh take instead of appending to the song's tab.
`scripts/inspect.ts` added to audit any MIDI (track list, chosen melody, timings, tab).

**L11 — Root cause of the note errors: ornaments.**
The melody track writes ornaments as 16th notes: 0.489 beats against neighbours of 1.75 and 0.833. They are the G-A before the repeated B-D-A, the C-B that slides into A, and three trills (C-B-C-B, B-A-B-A, C-B-C-B). The pipeline had no model for them, so it emitted every one as a structural note.
Fix: `src/core/simplify.ts`, a reduction stage with three shape rules, independent of the song:
1. a run of two contiguous short notes before a longer one is a slide and is dropped;
2. a short run alternating between two pitches is a trill and collapses to one note over the run's span;
3. any other short run (three or more distinct pitches) is a real fast passage and is kept.
Measured: full theme 49 -> 37 notes, 12 removed, confidence 92%. Tab now begins `Y X A Y X A`, the repeated B-D-A the user expected. The six-note in-game song and every other demo are unchanged (0 removed).
Tradeoff: the C-B that descends into A has the same 0.489 duration and is removed by rule 1. If it is structural in the theme, rule 1 needs one more condition.
Pitch: the five frequencies were theoretical equal temperament at A4 = 440 and were never measured from the console. Added `setTuning(cents)` in the pitch model plus a persisted tuning slider in the page, so the reference can be calibrated by ear instead of guessed.

**L12 — Root cause of the wrong notes and the pauses.**
1. The cost function was inverted. A one-semitone pitch error cost 0.12, while a one-semitone bend cost 0.17, so the search preferred a wrong note over a correct bent one: G became F instead of F+2. Rebalanced: bend costs are now 0.004 + 0.02, well below any semitone error, and pitch weight dominates the octave term. Result: full theme 99% confidence, **0/39 notes moved**, 12 bent. The phrase after the motif now reads G D C B A with exact pitches.
2. `reflowMelody` measured the gap from the note's start instead of its end, so the holes left by removed ornaments were never filled. That was the "mucha pausa". Fixed: the gap is now measured from the end, notes sustain into the next one leaving only 0.06 beats of articulation, and only gaps over 1.5 beats stay silent as phrase breaks.
3. Robotic feel: besides the holes, every note had identical level and timing. Added deterministic micro-variation (±4 ms, ±5% level).
Tradeoff: accuracy now wins over playability, so tabs use bends more often. The "Use bends" toggle still shows the no-bend version.
Limitation to state plainly: the pipeline is exact to the source MIDI. It cannot correct a wrong source; if the transcription's line differs from the game, another source is needed.

**L13 — Measurement harness.**
`src/audio/voice-model.ts` is now the single source of truth for the voice, shared by the Web Audio engine and the offline renderer, so the measurement cannot drift from what the browser plays.
`scripts/measure.ts` renders an arrangement to `out/<id>.wav`, then measures per-note pitch by autocorrelation, silence and longest gap, and peak level.
Observed on all five demos: mean pitch error 0.00 ¢, max 0.03 ¢, 0 notes off, 0.0% silence, longest gap 0 ms, peak between -11 and -6.8 dBFS (no clipping).
`scripts/calibrate.ts` decodes any audio with ffmpeg, detects pitch per frame and reports the median cents offset against the five pitches. Self-test on our own render returns +0.0 ¢ (IQR 0.0..0.0), so the chain is verified.
What this cannot measure: whether the melody matches the game (that is the source, not the renderer) and whether the timbre reads as an ocarina (perceptual). Both need a reference recording; the calibrator can produce the exact tuning value from one.

**L14 — Calibration moved into the page, level calibrated.**
`src/core/pitch-detect.ts` and `src/core/calibration.ts` are now shared by the page and the scripts, so the measurement the user runs is the same one the scripts run.
The Controller panel has a Calibrate control: upload a recording of the game, the page decodes it with `decodeAudioData`, measures the median cents offset and applies it to the tuning (persisted).
Level calibrated with the harness: master gain 0.4 -> 0.7 raises the peak from -10.9 to -6.0 dBFS, with the densest demo (Happy Birthday) at -2.0 dBFS. No clipping on any demo.
Re-measured after the change: 0.00 ¢ mean pitch error, 0 notes off, 0.0% silence. Calibration self-test on the app's own render: -0.0 ¢ (IQR -0.0..0.0), 127 frames.
Without a recording of the real instrument the tuning cannot be measured, only estimated. The control exists so the number comes from evidence when the recording arrives.

**L15 — Per-note tuning and reverse-test corpus.**
Measured on four gameplay recordings plus the first reference, aggregating confident frames per note: **D +22.1 ¢ · F +3.4 ¢ · A +24.7 ¢ · B +18.0 ¢ · D5 +21.3 ¢**. A single global offset was the wrong model, so `frequencyOf` now applies a per-note table plus an optional fine offset (the slider). Frames: 157 / 219 / 224 / 51 / 127.
`scripts/corpus.ts` builds `odd/corpus/v1..v4.json` from the videos and compares extraction against them by **interval sequence**, which is invariant to key and octave. v1 (In the End) is verified against the known riff: 100%.
The corpus exposed a real defect: the detector was free to output any semitone, producing ±19-semitone leaps that the instrument cannot play. It is now constrained to the 25 reachable positions (5 buttons × ±2 bend), which removed the octave errors.
Honest scoring: v1 is verified correctness; v2-v4 are **regression baselines**, not verified. Their 100% is self-comparison against their own first extraction. Their contours do not obviously match the known riffs, so they should not be read as correctness.
Verdict: the videos are excellent for tuning and timbre calibration, and usable as regression baselines. They are not yet enough to validate song identification.

**L16 — Real cause of "the notes are different".**
The projection folded **each note** into a central octave. A phrase spanning G4..G5 was wrapped into alternating octaves (+12, +12, 0, +12), which is what the user heard. Fixed: the melody is shifted as a whole, by octaves, and the search runs in **sounding** pitch against the 25 reachable positions, trying twelve placements around the range centre.
Verified note by note (sounding output vs source + shift): Happy Birthday 0 errors / 25, Twinkle 0/42, Ode to Joy 0/15, in-game Lullaby 0/6. The full theme keeps 3/39 deviations and its source is unverified, so its demo was removed.
Tab notation now uses the D-pad direction: `R↑2` means bend up a whole tone and play R. On-screen bend buttons (↓2, ↓1, 0, ↑1, ↑2) were added so the pad is playable on a phone.

**L17 — Tab persistence, playback separated, unverified demos removed.**
Pressing a note key no longer clears the loaded song: `press` only records live notes when no song is loaded, so the tab stays visible as a guide.
Demos now **show without playing**; a separate ▶ Play button plays the loaded song. This is the "see the notes, then practise" flow.
The three captures that did not hold up (Never Gonna Give You Up, Axel F, Littleroot Town) were removed from the demos. Only In the End, which is verified against the riff, remains from that set. They should be transcribed from the actual melody, not from gameplay audio.
Fine tuning gained −, + and 0 buttons; dragging the slider by hand on a phone could not land on zero.

**L18 — Bend buttons as momentary, play toggle, third-party melodies.**
The bend controls are now momentary and multi-touch: pointer capture per finger, mapped like the game (D-pad up/down = ±1, stick up/down = ±2), so a bend can be held while notes are tapped.
Play is a toggle: it stops playback without clearing the tab.
Melody sourcing for the three discarded songs: search returned fragmentary letter notes and paywalled scores. MIDIs were downloaded (`out/axel*.mid`, `out/never.mid`, `out/littleroot.mid`), but they are full arrangements (up to 17 tracks, 541-note vocal lines, polyphonic piano), so choosing the melody section requires verification that cannot be done by ear here. Nothing was shipped for them.

**L19 — Sections cut from MIDI.**
With the sections named by the user, `scripts/export-sections.ts` cuts bar ranges out of the MIDI tracks and writes `src/core/songs/{never,littleroot,axel}.json`: Never Gonna chorus (track MELODY, bars 68-80, 74 notes), Littleroot opening (top voice above C4, bars 1-16, 73 notes), Axel F opening (bars 1-16, 38 notes). All three are in the demos with the subtitle "from MIDI".
Not verified against the recordings: the sections are cut by bar position and the melody is the track's top voice, so they may include harmony notes. They are a first pass, not a verified transcription.

