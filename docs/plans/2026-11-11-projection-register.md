# Preserve playable register during melody adaptation

## Goal

Prevent a brief source-pitch outlier from moving an otherwise playable melody into another octave, without deleting or repairing source events.

## Confirmed mechanism

`projectMelody` centers its twelve-placement search on the source minimum/maximum. A brief MIDI 60 candidate in Littleroot excludes shift zero. Independently, the capped octave emission cost lets interval smoothing fold a playable MIDI 72 into another octave. Research reproduces both mechanisms. A coverage-first prototype restores the opening, but exact floating-point coverage equality changes the chosen shift when duration 0.3 is split into 0.1 and 0.2.

## Scope and policy

1. Retain calibrated states from `frequencyOf`. A shifted source note is directly playable when a state is within 0.5 semitones. For such a note, restrict the existing DP to those states. If none exists, retain the existing approximation costs and all states. This is a containment for directly playable notes; approximation of unreachable notes remains imperfect.
2. Use positive finite durations as weights; if all weights are zero, use event count. Sort by source MIDI and select the lower weighted median: the first pitch whose accumulated weight reaches half the total, including equality within the roundoff allowance below. Convert it to `octaveShift = 12 * Math.round((80 - medianMidi) / 12)`, retaining the existing sounding-MIDI center 80 and JavaScript rounding semantics. Search exactly the 36 integer shifts from `octaveShift - 18` through `octaveShift + 17`, inclusive. Do not discard source events with zero duration.
3. Rank placements first by total directly playable duration, then prefer pitch-class-preserving shifts (multiples of twelve), then the smallest absolute shift. Resolve any remaining sign tie deterministically by the smaller signed shift, independent of event-count DP cost.
4. Compare coverage and weighted-median boundaries using a roundoff allowance derived from `Number.EPSILON`, total weight and accumulated term count. For positive durations, numerically equivalent fragmentation and uniform positive time scaling must not change the chosen shift. The all-zero-duration fallback counts events, so duplicating or fragmenting zero-duration events can change its median, coverage and chosen shift; it carries no fragmentation-invariance guarantee. Do not introduce a fixed musical-time tolerance or song-specific threshold.
5. Run the current DP only for the selected placement. Keep its weights, output shape, timing, event order and source data unchanged. `confidence` remains a DP fit score, not transcription accuracy or duration coverage; update misleading comments in the edited scope.

## Exclusions and risks

No changes to the model, detector, pitch segmentation, playback, tuning, fixed arrangements or fragment-selection UI. No candidate deletion or expected-song lookup. Out-of-range notes can still fold under the existing approximation. Coverage priority can change transposition for other arrangements, including Blue Bird; report those changes without claiming subjective improvement. Lullaby's 17 fixed notes must remain unchanged and bypass projection.

## Implementation and verification

- Preserve the production baseline before edits. Add portable deterministic regression tests at the projection owner, reproducing the opening MIDI 72 / brief MIDI 60 case and a high-outlier variant across registers and bend allowances. Assert calibrated sounding register, source immutability and timing.
- Cover duration 0.3 versus 0.1 + 0.2, uniform duration scaling, exact-half lower-median selection, the specified search endpoints, empty/all-zero inputs with the event-count fallback, opposite-sign placement ties, calibrated feasibility boundaries, a playable octave leap and adaptation of an unreachable high note. Avoid assertions that demand exact reproduction of unreachable pitches.
- Demonstrate the new regression fails against the baseline. Verify the coverage-comparison regression also fails with exact equality restored; verify the playable-state regression fails without the state restriction.
- Re-run the saved In the End, Littleroot and Blue Bird source analyses through production preparation without rerunning inference. Store new outputs beside, rather than replacing, previous evidence. Inspect every changed arrangement, distinguish source fidelity from playable adaptation and report remaining approximation errors.
- Obtain an independent code review after focused checks. Run the full suite and build once at completion. No UI changes; existing UI remains NOT visually verified.

## Authorization

This is within the user's existing autonomous audio-to-TAB work and latest instruction to continue. Fragment-selection work remains research only.
