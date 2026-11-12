# Playable-register integration verification

Verified on 2026-11-11 in the shared local checkout. No Git metadata, commits or dependency changes were involved.

## Result

The projection now chooses a placement by directly playable source duration and protects calibrated playable states from octave folding. The saved Littleroot main-melody analysis selects shift zero and restores its opening to approximately 531 Hz. Its brief unsupported source candidate remains present. In the End in both modes and isolated Littleroot retain their previous arrangements. Blue Bird selects shift zero rather than six; all 35 adapted sounds change, without changing its extracted source events or timing. These comparisons establish the implemented projection policy, not subjective musical superiority.

The root cause was the extrema-centered search excluding a useful register, followed by capped octave costs allowing a playable note to fold. Duration coverage, a weighted lower median and the calibrated half-semitone state restriction address those mechanisms in the shared projection owner. Roundoff-aware comparisons prevent the reproduced 0.3 versus 0.1 + 0.2 placement discrepancy. Unreachable notes retain the existing approximation behavior.

## Evidence

- Lead final `npm test`: 83 tests passed, zero failures, skips or TODOs.
- Lead final `npm run build`: TypeScript and Vite passed; 42 modules transformed. Existing Vite future-native-config-loader compatibility warnings remain nonblocking.
- Lead independently reran 19 focused projection, calibration and fixed-Lullaby tests before the full suite.
- A fresh independent code and cleanup review reported no concrete findings; its focused checks passed.
- Baseline reproductions, decisive mutation failures and saved real-song preparation comparisons are retained under `out/projection-register-integration/`. The original evidence files remain intact.
- The calibration alias regression now tests the same source MIDI 76 at shift zero under two tuning values, rather than depending on the prior global transposition of another melody.
- Dev server restarted at `http://localhost:5173/`; a subsequent HTTP request returned 200.

## Practical limits

This change improves adaptation, not the model's ability to identify every main-melody event. The saved main-melody Littleroot output still contains one unreachable candidate, and Blue Bird contains three. Such events can require large approximations. Source analysis remains downloadable and separate from the playable arrangement. Confidence is a DP fit score, not transcription accuracy.

The 15-second cap and playback-rate selector remain in place. The complete 13-second Blue Bird source auditions are retained under `out/fifteen-second-checks/lead-blue-bird/`. The first 15 seconds of the two supplied cross-song clips exclude their independently bounded TikTok outros; no generic jingle detector is implemented.

No listening or browser interaction was performed for this projection change. Existing UI: **NOT visually verified** at desktop or mobile widths.

## Fragment selection research

The separate research recommends WaveSurfer.js with Regions for waveform and local region editing. It was not installed or implemented. The integration must crop the existing full-quality decoded buffer, not the library's display waveform data. Touch interaction, accessibility and long-file memory need a browser prototype. Details and primary sources are in `out/audio-fragment-selection-research/REPORT.md`.
