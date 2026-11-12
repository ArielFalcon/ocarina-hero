# Scheduled playback

Each scheduled note starts at its calibrated target frequency, including its
fixed bend. Playback does not infer pitch slides between adjacent notes.

Attack and decay endpoints are bounded by the scheduled voice duration. This
keeps the decay endpoint from landing inside the release of a short note.
The previous ordering prolonged earlier pitches into following notes; native
Web Audio diagnostics reproduced that effect in Littleroot's short passages.
The existing release and room delay remain. Live held-note transitions and
modifier behavior use their existing separate lifecycle.

With Simplify off, source notes, durations and rests pass directly to playable
projection. Simplify is an explicit lossy arrangement option. The saved
Littleroot MIDI and the supplied game performance differ in rhythm and some
notes; the latter does not replace the former.

The native investigation, controlled variants, exact schedules and captured
samples are documented in
`out/littleroot-investigation/native-playback/REPORT.md`. The handwritten
`scripts/measure.ts` renderer is approximate and is not proof of the native
engine's output.

The section-1 Y−2 event starts directly at its bent target, approximately
892.07 Hz. The native investigation did not reproduce a base-Y oscillator
event for that token. It did reproduce overlap from the preceding note,
which the envelope correction reduces. The reported two-tone perception
remains unverified without a matching capture of the web playback.
