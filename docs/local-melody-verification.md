# Local melody pipeline verification

## Technical result

The first-ten-second local pipeline is integrated: browser decode and channel mixing, bounded same-origin PCM request, trusted CPU model inference, timestamped contour, shared source-note grouping, existing calibrated projection, TAB playback and source-analysis JSON download. Isolated-instrument mode remains the default. Main-melody mode is explicitly experimental.

Final checks observed on 2026-11-11:

- `npm test`: 69 passed, zero failed, skipped or TODO.
- `npm run build`: TypeScript and Vite passed; 41 client modules. Vite emitted a non-blocking future native-config-loader warning about extensionless imports.
- Actual ten-second HTTP analysis: status 200, 1,722 model frames; the 21 frozen source pitch centers before ten seconds were preserved, including octave. This is sparse diagnostic coverage, not complete note accuracy.
- All source event times and order remained unchanged through preparation with bends 0, 1 and 2 and Simplify on/off.
- An HTTPS-Origin/same-Host request over the internal HTTP connection succeeded. Three-second 48 kHz silence was resampled to 44.1 kHz and yielded 516 frames with no voiced pitches. This simulates the proxy request shape; no real Tailscale browser connection was verified.
- Independent reviews and scoped rechecks covered core validation, upload lifecycle and local process/resource handling. The reported clock/frequency-validation, pending-upload UI and TLS-proxy-origin defects were corrected with focused red/green checks.

The cleanup pass read the global cleanup bar, inspected the changed source/runtime/UI scope and searched for debug statements and untracked TODO markers. No additional in-scope bar violations were identified. Repository cleanup extensions were absent. No commit, branch or merge was created; the workspace has no Git metadata.

UI changes are **NOT visually verified** at desktop or mobile widths. No subjective listening claim is made.

## Musical result and remaining gate

The source-event pipeline is inspectable and reproducible, but the requested fidelity goal is not complete. The independent audit could not assign the short MIDI 79, 80 and 66 candidates near 9.7 s to the foreground melody with sufficient certainty. A single prespecified Viterbi experiment also removed a genuinely supported synthetic jump and was rejected. No temporal decoder from that experiment was adopted.

The adapted ocarina performance helps establish phrase order and stable pitches, but its transposition and nonuniform timing do not provide exact source-note ground truth for these transitions. Full default activation needs an independently established original-melody reference, such as the same violin line isolated from its accompaniment or a source-specific timed MIDI annotation. Missing source notes, false octaves, unsupported extra notes or unresolved candidates continue to block that activation.

Continuous same-pitch attacks also remain unresolved when the only available evidence is an amplitude dip. The attempted amplitude-based splitter added an extra note to the isolated 1998 Lullaby and was removed. Stable detuned notes are retained; detectable unvoiced gaps still separate repeats.

## Reproducible artifacts

- `out/local-melody-integration/REPORT.md`: clean setup and equal-input official/wrapper equivalence.
- `out/local-melody-integration/lead-e2e/response.json`: actual local API output.
- `out/local-melody-integration/lead-e2e/source-analysis.json`: structured contour and source notes.
- `out/local-melody-integration/lead-e2e/anchors.json`: direct independent-center diagnostic.
- `out/local-melody-integration/lead-e2e/detected-source-notes.wav`: neutral sine rendering of actual API event frequencies and times, not game timbre or a verified musical reference.
- `out/melody-transition-audit/REPORT.md`: frozen independent acoustic evidence and rejected temporal-decoding control.
