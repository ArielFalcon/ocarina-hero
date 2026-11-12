# Projection-register plan review

## Initial independent reviews

Both reviewers completed read-only reviews of the frozen initial plan.

- Comprehension: medium ambiguity in translating the source median into 36 shifts; medium ambiguity in choosing a weighted median at an exact half-weight boundary.
- Readiness: medium inconsistency between count-based all-zero fallback and unconditional fragmentation invariance. A zero-duration prototype reproduction changed shift when an event was duplicated.

## Batched corrections

The plan now specifies the lower weighted median, existing sounding center 80, exact octave-centering formula and inclusive search endpoints. Fragmentation invariance applies to positive durations; the all-zero fallback explicitly counts events and can change when events are duplicated. Verification includes these boundaries. The declared limitation for unreachable-note approximation remains unchanged.

## Scoped recheck

Completed by a fresh read-only reviewer. All three prior findings are resolved; no material additional blocker identified in the corrected scope. No tests or code review were performed in this document-only recheck. Production implementation follows under the user's existing autonomous authorization.
