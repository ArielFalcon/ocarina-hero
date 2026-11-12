# Lullaby reference and adaptation

The source melody, independently compared between the 1998 and 2026 recordings, is B5 D6 A5 / B5 D6 A5 / B5 D6 A6 G6 D6. The complete demo first plays the manual Y X A trigger twice, without bends, then plays the eleven automatic notes uniformly transposed down five semitones. This restores the playable automatic arrangement's intervals, including its high ending, while keeping the trigger in the game's original key. The two sections therefore use different keys. The unmodified source pitches remain in the reference data for transcription validation. Fixed notes bypass simplification, reflow and projection; the calibrated instrument tuning still applies. The manual trigger is also available as a separate demo. Only one manual trigger occurs in the 2026 capture; the second repetition follows the requested gameplay instruction.

The source sequence and approximate timing live in `src/core/songs/lullaby-reference.json`. Times are seconds at 60 BPM. An 8192-sample Hann FFT of the 48 kHz 2026 WAV, sampled every 0.05 s, found dominant-pitch transitions near 5.20, 6.10, 6.50, 7.80, 8.75, 9.15, 10.40, 11.25, 11.70, 12.45 and 12.90 seconds. The FFT window spans 0.171 s, so these are approximate attacks rather than exact note-on times.

For each of the eleven automatic and three captured manual notes, `node out/lullaby-adaptation-checks/envelopes.cjs` decodes the source WAV to 24 kHz mono and measures 40 ms Hann-window quadrature amplitude at the observed source frequency, plus 40 ms RMS, at 10 ms hops. The baseline is the median band amplitude 0.10–0.35 s after the approximate attack. An operational release is the first drop below 25% of that baseline persisting for five frames; the analysis also records 50% and 10% thresholds in `out/lullaby-adaptation-checks/envelopes.json`. This is a band-envelope measurement, not an exact performer note-off: reverb, vibrato, nearby pitches and background sound affect it.

| Segment | Persistent 50% / 25% / 10% drops (s) | Interpretation |
| --- | --- | --- |
| Manual B | 1.65 / 1.67 / 1.68 | Gap before D around 1.95 |
| Manual D | 3.14 / 3.15 / 3.16 | Gap before A around 3.50 |
| Manual A | 4.72 / 4.74 / 4.74 | Release before automatic playback |
| Automatic B1 | 6.05 / 6.06 / — | Transition into D1 |
| Automatic D1 | 6.46 / 6.46 / — | Transition into A1 |
| Automatic A1 | 7.37 / 7.38 / 7.42 | Clear gap before B2 at 7.80 |
| Automatic B2 | 8.70 / 8.71 / — | Transition into D2 |
| Automatic D2 | — / — / — | No separate release established before A2 |
| Automatic A2 | 10.16 / 10.17 / 10.23 | Clear gap before B3 at 10.40 |
| Automatic B3 | — / — / — | No separate release established before D3 |
| Automatic D3 | 11.63 / 11.64 / 11.64 | Close to high A attack; gap uncertain |
| Automatic high A | — / — / — | No separate release established before high G |
| Automatic high G | — / — / — | No separate release established before final D |
| Automatic final D | 14.47 / 14.48 / 14.49 | Release estimate; acoustic tail may continue |

A dash means no persistent crossing was detected before the next approximate attack, not that the sound continued unchanged. The two clear automatic phrase gaps use the 25% values; transitions without evidence of an independent gap remain adjacent. Manual starts are normalized from 0.50, 1.95 and 3.50 seconds, with releases at the measured 25% crossings. The second manual repetition is not present in the capture; its 0.28 s inter-repetition gap is a default based on the first observed manual gap. The complete demo leaves 0.46 s after the second trigger's release before the automatic section, matching the measured 4.74–5.20 s gap after the captured trigger. The automatic section starts at 9.22 s and retains its original relative timing. The last automatic note and close transitions remain approximate. No subjective listening comparison is claimed.

The FFT and independent pitch evidence are documented in `out/lullaby-reference-analysis/1998-reference/analysis/REPORT.md`. Neither the source recording nor measurements are bundled for playback.
