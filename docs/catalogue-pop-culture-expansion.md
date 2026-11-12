# Pop culture catalogue expansion

The approved 42-item batch is complete: **33 integrated arrangements, 9 range rejections, 0 pending source decisions**. The curated catalogue grows from 44 to 77 songs, plus 7 built-in demos: **84 selectable entries**. No paid resources were used.

## Integrated arrangements

| Song | Context | Notes | Span |
| --- | --- | ---: | ---: |
| The Mandalorian | The Mandalorian | 22 | 10 |
| Concerning Hobbits | The Lord of the Rings | 40 | 12 |
| Evenstar | The Lord of the Rings | 45 | 10 |
| May It Be | Enya / The Lord of the Rings | 35 | 10 |
| Cornfield Chase | Interstellar | 17 | 7 |
| Mission: Impossible Theme | Mission: Impossible | 8 | 7 |
| Theme from Jurassic Park | Jurassic Park | 26 | 12 |
| The Raiders March | Indiana Jones | 16 | 15 |
| James Bond Theme | James Bond | 16 | 3 |
| The Pink Panther Theme | The Pink Panther | 19 | 10 |
| The X-Files Theme | The X-Files | 12 | 12 |
| Knight Rider Main Theme | Knight Rider | 14 | 13 |
| The Simpsons Theme | The Simpsons | 18 | 15 |
| Gonna Fly Now | Rocky | 12 | 7 |
| Chariots of Fire | Chariots of Fire | 22 | 9 |
| Seven Nation Army | The White Stripes | 7 | 8 |
| Blinding Lights | The Weeknd | 23 | 10 |
| Smooth Criminal | Michael Jackson | 16 | 8 |
| Eye of the Tiger | Survivor | 50 | 9 |
| Another One Bites the Dust | Queen | 11 | 5 |
| Sandstorm | Darude | 56 | 7 |
| Astronomia / Coffin Dance | Tony Igy | 25 | 15 |
| Gimme! Gimme! Gimme! | ABBA | 36 | 15 |
| Children | Robert Miles | 10 | 12 |
| Everybody Wants to Rule the World | Tears for Fears | 26 | 16 |
| World Clear / Castle Clear | Super Mario Bros. (NES) | 25 | 15 |
| Game Over | Super Mario Bros. (NES) | 10 | 8 |
| Wild Pokémon Caught | Pokémon Red / Blue / Yellow | 11 | 12 |
| Gym Battle Victory | Pokémon Gold / Silver | 55 | 16 |
| Extra Life / 1UP | Sonic the Hedgehog | 9 | 5 |
| Act Complete | Sonic the Hedgehog 3 | 13 | 12 |
| Item Acquisition | Super Metroid | 13 | 12 |
| Bonus Win | Donkey Kong Country | 19 | 9 |

Each arrangement retains the frozen, explicitly selected source events under a single uniform transposition. Preparation edits resolve documented source discrepancies before freezing; no per-note octave folding or range compression is applied. Existing category, universe and artist metadata makes all 33 searchable. No new UI components or styles were introduced; appearance is **NOT visually verified**.

## Range rejections

| Song | Span |
| --- | ---: |
| Rohan Theme | 17 |
| Now We Are Free | 17 |
| Succession Main Title | 20 |
| Axel F | 17 |
| Toxic | 30 |
| Stage Clear / Flagpole | 27 |
| Course Clear | 17 |
| Koopa Kids Victory | 26 |
| Level Clear / Kirby Dance | 20 |

The configured instrument covers 16 semitones. These complete phrases exceed it; they remain excluded rather than shortening the hook or moving isolated notes into another octave.

## Verification

- Full JavaScript/TypeScript suite: **115 passed, 0 failed**. Production build passes. The build retains an existing warning about future Vite native-config compatibility.
- Replayed the source recipes, the parallel film consolidation and pop adjudication. Hashes, explicit voice/event selections, monophony, uniform mapping and PPQ 9600 roundtrips pass.
- Previous 44, first-increment 66 and second-increment 70 curated arrangements compare exactly with their captured snapshots. The three existing manifests, pitch calibration and grouping code hashes are unchanged.
- All 33 synthesized WAV previews have 0 off-pitch notes, maximum measured error **0.07 cents** against configured frequencies, and maximum peak **−4.8 dBFS**. This checks the approximate software renderer; it does not validate the original recording or physical console.
- Exactly one categorized songbook entry exists for each new arrangement; the complete songbook contains 84 entries.
- Corpus index: 37 original-recording candidates, **0 validated extraction pairs**. Original-recording audit, validated alignment, training eligibility and physical gameplay flags remain false.

## Source decisions that matter

- Sonic Extra Life uses the game’s FM1 lead; the initial FM2 harmony selection was corrected before integration. NES and DKC event voices were decoded from the game sequence and compared with separately authored transcriptions.
- Jurassic Park is **quarter = 108**, not half = 108. Native score inspection corrected a doubled-speed preparation; its 26 pitches and beat grids were preserved. An independent tempo-unit guard rejects both 216 and 54 BPM.
- The final pop adjudication compares every event and records pitch/rhythm variants. Everybody and Smooth Criminal use a collapsed contour only for the legacy builder reference; Gimme uses a same-file doubling there. Those builder checks are not independent corroboration. The separate pinned full-event comparisons and bounded spectral tie-breaks supply the source evidence.
- The film vocal arrangements retain documented edition, ornament and register variants. Source agreement does not establish which instrument or voice plays each passage in the original performance.

## Rebuild and evidence

`scripts/catalogue-pop-culture-manifest.json` stores the integrated selections. `scripts/build-catalogue.ts` loads it alongside the existing cohorts. Run `npx --no-install tsx scripts/build-catalogue.ts --audio` and `npx --no-install tsx scripts/build-corpus-index.ts` to rebuild the exports.

Every integrated song has `arrangement.json`, `tab.txt`, `source.mid`, `ocarina.mid`, `ocarina.wav` and `audio-check.txt` under external `out/catalogue/delivery/<id>/`. Original excerpts remain separate from synthesized previews. Only corresponding excerpts are retained, never complete original recordings.

The ignored `out` symlink points outside the project. Detailed decisions and replayable recipes live at `out/catalogue-pop-culture-42/ASSESSMENT.json`, `parallel-film/`, `parallel-pop/`, `parallel-dkc/`, `root-gaming/`, `final-integration-checks.json` and `final-audio-checks.json`. Unvalidated audio candidates must not be used as extraction labels.

Reference onset deviations in the legacy builder use tick-derived beat coordinates. Different tempo maps or global performance tempi can produce nonzero differences; use the source-specific real-time or metrical comparisons when assessing rhythm.
