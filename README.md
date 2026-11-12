# Ocarina Hero

Turn a song into a button tab playable on the ocarina of
*The Legend of Zelda: Ocarina of Time* (Switch 2, 2026 remake).

Product objective, fidelity model and design decisions: **[`docs/objetivo.md`](docs/objetivo.md)**.
Feature log and change history: [`odd/tasks/ocarina-tabs.md`](odd/tasks/ocarina-tabs.md).

Approved visual identity and styling contract: **[tapestry design system](docs/design-system.md)**,
with an [interactive component reference](docs/design-system/reference.html).

## What it does

- Search the Songbook by title, artist, or universe; combine category and franchise
  filters. Mark songs with ♡ and find them again under the Saved card; saves stay in
  this browser. Category counts include songs with more than one tag.
- Learn a song through short button-staff passages, listen with the existing audio
  engine continuously across passages, or practise matching its buttons and modifiers. Use Free play for an
  independent recording; audio imports live in the experimental Workshop.
- Load a song from **MIDI** (`.mid`) or **audio** (mp3, wav, m4a, ogg).
- Select and preview an audio fragment, then choose **Analyze** to generate its playable button TAB. Use **Play** to hear the adapted notes or practise them on the controller without clearing the TAB.
- Show the tab without playing, then play/stop it.
- Practise on the on-screen pad: the tab stays visible while you play.
- Five buttons (`L R A Y X`) with reusable SVG icons. Modified notes show the button + D-pad or Stick icon with an up/down arrow.
- Desktop keyboard defaults: Q = L, E = R, D = A, A = Y, W = X; hold → / ← for D-pad up/down or ↑ / ↓ for Stick up/down. Remap notes and modifiers in Keyboard mapping; assignments are saved in this browser.
- Per-note tuning calibrated from real recordings; to measure another recording's offset, use `scripts/calibrate.ts`. See [calibration evidence and limits](docs/calibration.md).
- Scheduled playback and its verified limits are described in [the playback notes](docs/playback.md).
- The tapestry visual refactor and its checks are recorded in [the UI delivery notes](docs/visual-refactor.md).
- Complete Lullaby plays the unbent Y X A trigger twice, followed by the automatic melody uniformly transposed down five semitones to preserve its intervals. The manual trigger is also available separately. See [reference and timing limitations](docs/lullaby-reference.md).

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

## Limits

- Source note timing and rests are preserved by default during projection. Simplify is an opt-in, lossy arrangement that may remove notes and change durations. Fixed arrangements and audio timing retain priority.
- Monophonic only: the instrument cannot play chords.
- Audio analysis accepts a selected fragment of **up to 15 seconds**, including later passages. The Workshop guides three steps: choose a recording, drag the waveform band (or type start/end seconds, with zoom for precision) and preview it, then pick the recording type and choose **Analyze fragment**. A progress indicator shows elapsed time and can cancel the analysis. Changing the selection or recording type invalidates the previous TAB until you analyze again. Decoding still reads the complete file, so long recordings can use substantial browser memory.
- **Playback speed** offers 100%, 75% and 50%. Slowing playback preserves pitch and the original source analysis; changing speed restarts active playback from the beginning.
- **Main melody** (shown as *Song with accompaniment*) is the default for songs and accompanied audio. It fuses the local Melodic SegNet and Basic Pitch models into one monophonic line; individual notes can still be missed or taken from an accompanying voice, and repeated same-pitch notes without a gap merge. **Isolated instrument** (*Single instrument or voice*) remains available for clear single-note recordings. Install the local model runtime with `npm run setup:melody`, then run the app through `npm run dev` or `npm run preview`. See [local model setup and limits](docs/local-melody.md).
- Use **Load file**, choose a fragment and select **Analyze** to transcribe audio. MIDI imports directly. Source pitches are independent of the ocarina's register, and adaptation preserves detected timing and rests. Continuous same-pitch attacks can still merge.
- **Download analysis** saves the source notes, provenance and available pitch contour as JSON. Optional `sourceWindow` records the original file's selected bounds; events remain relative to the fragment. Low-support model candidates remain included and flagged; model scores and voiced-frame coverage are not accuracy scores. The downloaded source analysis is separate from the playable arrangement.

## Curated fragments

The song selector contains 31 curated fragments. The latest expansion assessed 24 proposals:
22 fit faithfully, while the complete Pokémon Center opening and Green Greens phrase each
span 17 semitones and are rejected. The earlier Mario proposal remains rejected for the
same range limit. Each fixed arrangement preserves its prepared source under one uniform
transposition. Raw sources and explicit preparation records retain any score-based tempo
correction or short legato-tail closure; no per-note octave folding is applied.

Consecutive notes share a visual group until a silence lasts both at least one beat and
500 ms at the source tempo. Sustained notes and short articulation gaps do not create
extra groups; playback slowdown does not change the grouping.

The local delivery is `out/catalogue/delivery/`: each accepted song has a button TAB with
timings, arrangement JSON, source/adapted MIDI, an approximate calibrated WAV preview
and its audio measurement. `report.json` records source hashes, exact selections,
corroboration and limitations. Full original-recording fidelity and physical-game
execution have not been verified. The current UI layout has
[visual verification](docs/visual-refactor.md); this does not constitute a
song-by-song visual review or physical-game validation of the catalogue.

Downloaded media lives outside the project in `../ocarina-tabs-media`; `out` is its ignored
relative symlink. New recording downloads retain only the corresponding excerpts. Original
recording candidates, source annotations and synthesized previews are distinct artifacts.
The corpus inventory does not certify pitch/time alignment or provide validated extraction labels.

Regenerate with `npx tsx scripts/build-catalogue.ts --audio`, then run
`npx tsx scripts/build-corpus-index.ts`. Selection recipes and source URLs are in
`scripts/catalogue-manifest.json` and `scripts/catalogue-next-manifest.json`.
Follow the [curation skill](skills/ocarina-catalogue/SKILL.md) and its detailed pipeline
before expanding the catalogue. External `catalogue-next/ASSESSMENT.md` records all 24
expansion outcomes and evidence limits, including weaker corroboration for Africa and Totoro.
Scheduled release tails respect the following onset; offline exports reserve headroom.

## Verification

```bash
npm test                              # focused calibration and bend regressions
npx tsx scripts/measure.ts lullaby-game   # approximate WAV analysis; no native delay or engine-equivalence guarantee
npx tsx scripts/calibrate.ts <audio>      # measure tuning offset in cents
npx tsx scripts/corpus.ts check           # compare extraction against existing benchmark fixtures
npx tsx scripts/melody-benchmark.ts       # Main melody notes and adapted TABs on the 29 corpus recordings
npm run test:melody                       # Main melody decoder tests (local Python runtime)
```

## Deployment

The public site is a static build: `npm run build:static` sets `MELODY_SERVER=off`, which removes the server-only *Song with accompaniment* mode. Pushing to `main` runs `.github/workflows/pages.yml`, which tests, builds with `BASE_PATH=/<repo>/` and publishes `dist` to GitHub Pages at https://arielfalcon.github.io/ocarina-hero/. `vercel.json` holds the equivalent Vercel configuration (root base path).
