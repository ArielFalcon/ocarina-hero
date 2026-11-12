# Melody projection

Projection uses calibrated sounding frequencies and retains the source event order and timing. Positive finite durations weight the lower median and playable coverage; when every duration is zero or invalid, events have equal weight. The median centers a search over 36 semitone shifts. Coverage takes priority, followed by pitch-class preservation, absolute shift and signed shift. Roundoff allowances scale with total weight and event count.

A shifted note within half a semitone of a calibrated instrument state is restricted to such states. Other notes are approximated by the existing dynamic programming costs and can differ by an octave or more. Confidence is a fit score from that dynamic program, not a measure of transcription accuracy or coverage. Fixed arrangements bypass projection.
