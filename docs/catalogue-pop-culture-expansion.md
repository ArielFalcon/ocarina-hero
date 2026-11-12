# Pop culture catalogue expansion — incremental delivery

The first 22 arrangements are integrated. The curated catalogue grows from 44 to 66 songs, plus 7 built-in demos (73 selectable entries). Source evidence work continues on 13 candidates;7 complete phrases are rejected for range. This is a progress snapshot, not completion of the 42-item request.

## Integrated arrangements

| Song | Context | Notes | Span |
| --- | --- | ---: | ---: |
| The Mandalorian | The Mandalorian | 22 | 10 |
| Cornfield Chase | Interstellar | 17 | 7 |
| Mission: Impossible Theme | Mission: Impossible | 8 | 7 |
| The Raiders March | Indiana Jones | 16 | 15 |
| James Bond Theme | James Bond | 16 | 3 |
| The Pink Panther Theme | The Pink Panther | 19 | 10 |
| The X-Files Theme | The X-Files | 12 | 12 |
| Gonna Fly Now | Rocky | 12 | 7 |
| Chariots of Fire | Chariots of Fire | 22 | 9 |
| Seven Nation Army | The White Stripes | 7 | 8 |
| Blinding Lights | The Weeknd | 23 | 10 |
| Another One Bites the Dust | Queen | 11 | 5 |
| Sandstorm | Darude | 56 | 7 |
| Astronomia / Coffin Dance | Tony Igy | 25 | 15 |
| Children | Robert Miles | 10 | 12 |
| World Clear / Castle Clear | Super Mario Bros. (NES) | 25 | 15 |
| Game Over | Super Mario Bros. (NES) | 10 | 8 |
| Wild Pokémon Caught | Pokémon Red / Blue / Yellow | 11 | 12 |
| Gym Battle Victory | Pokémon Gold / Silver | 55 | 16 |
| Extra Life / 1 UP | Sonic the Hedgehog | 9 | 5 |
| Act Complete | Sonic the Hedgehog 3 | 13 | 12 |
| Item Acquisition | Super Metroid | 13 | 12 |

All 22 arrangements retain their frozen source events under a single uniform transposition. Metadata makes them searchable in their existing Games, Film or Pop categories. No new UI components or styles were introduced; visual appearance is NOT visually verified.

## Verification

- Replayed the frozen pop, gaming, film and root NES/Pokémon recipes successfully.
- Independent source review found no blocking defects in the 13 pop/gaming selections; the parallel film review cleared the 9 frozen film selections.
- Re-ran the independent parent checker: source hashes, monophony, exact uniform mapping and PPQ 9600 roundtrips pass.
- All 44 previous curated arrangements compare exactly with the captured baseline. Pitch calibration and grouping code hashes are unchanged.
- Sixteen focused catalogue/songbook/grouping/playback tests pass; production build passes.
- Twenty-two calibrated synthesized WAV previews have 0 notes flagged off-pitch, maximum measured error 0.04 cents relative to configured frequencies, and no clipping (maximum peak−4.8 dBFS). This verifies the approximate software renderer, not original recordings or physical gameplay.
- The universe aggregation test formerly assumed the entire growing Pop catalogue contained 7 songs. It now uses a fixed, deliberately unsorted fixture with two Pop entries and mixed icon/category cases, preserving the rule being tested as the catalogue grows.

## Rejected and pending

| Song | Status |
| --- | --- |
| Concerning Hobbits | pending-evidence |
| Rohan Theme | rejected-range |
| Evenstar | pending-evidence |
| May It Be | pending-evidence |
| Now We Are Free | pending-evidence |
| Succession Main Title | rejected-range |
| Theme from Jurassic Park | pending-evidence |
| Knight Rider Main Theme | pending-evidence |
| The Simpsons Theme | pending-evidence |
| Smooth Criminal | pending-evidence |
| Axel F | rejected-range |
| Eye of the Tiger | pending-evidence |
| Toxic | pending-evidence |
| Gimme! Gimme! Gimme! | pending-evidence |
| Everybody Wants to Rule the World | pending-evidence |
| Stage Clear / Flagpole | rejected-range |
| Course Clear | rejected-range |
| Koopa Kids Victory | rejected-range |
| Level Clear / Kirby Dance | rejected-range |
| Bonus Win | pending-evidence |

Exact source-level reasons, selection records and checks remain external at `out/catalogue-pop-culture-42/ASSESSMENT.json`, the batch findings, `parallel-validation/REVIEW.md` and `incremental-audio-checks.json`.

## Rebuild and exports

`scripts/catalogue-pop-culture-manifest.json` is the integrated source selection list for this expansion. `scripts/build-catalogue.ts` loads it alongside the existing cohorts. Run `npx --no-install tsx scripts/build-catalogue.ts --audio` and then `npx --no-install tsx scripts/build-corpus-index.ts`.

Each integrated song has `arrangement.json`, `source.mid`, `ocarina.mid`, `tab.txt`, `ocarina.wav` and `audio-check.txt` under external `out/catalogue/delivery/<id>/`. Synthesized previews are separate from originals. Two matching bounded original-event candidates are retained for SMB Castle Clear and Game Over; no new audio pair is a validated extraction label.

Reference onset deviations in the legacy builder use tick-derived beat coordinates. Different tempo maps or global performance tempi can produce nonzero differences without a melodic rhythm error; consult the source-specific real-time/metrical comparison rather than interpreting that one summary field as a fidelity score.
