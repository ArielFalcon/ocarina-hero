# Source segmentation plan review

The initial comprehension review found no material ambiguity. The independent readiness review identified one medium finding: per-frame rounding could create false notes near a semitone boundary even after changing the stability measure.

The plan now explicitly requires fractional-pitch grouping before final event quantization, a boundary-crossing vibrato control that must remain one event, and a deliberate sustained semitone transition that must remain two events. This is a general segmentation rule, not a correction fitted to Blue Bird. The fresh scoped recheck confirmed that the finding is resolved and identified no new material blocker. Both initial reviews and the one scoped recheck are complete. User authorization is the standing instruction to continue autonomously; review itself is not delivery approval. Production implementation follows next.

## Implementation ledger

The first implementation completed relative-pitch grouping and event-median quantization. An independent code review found no new confirmed regression in that partial change. The lead reproduced the focused transcription/preparation checks: 11 passed, with the explicitly unfinished repeated-attack test failing as TODO.

The initial attack detector was removed after false splits. Read-only diagnosis reproduced two causes: a 3 ms energy window was shorter than a fundamental cycle for low tones, and recursive first-minimum splitting counted one valley twice. A single correction batch is authorized using a cycle-covering envelope and unique valley boundaries, with low-tone and single-valley negative controls. This remains within the reviewed segmentation scope. Repeated attacks are not yet complete.

The correction batch fixed those mechanisms but failed the isolated 1998 reference by adding a twelfth event. It was removed: amplitude recovery is not sufficient evidence of a distinct articulation. The plan's explicit fallback is applied: retain the independently reviewed stable-detuning change, leave continuous reattack detection unresolved, and preserve the failed experiment as evidence. The synthetic nonzero-valley test previously assumed two physical notes from amplitude alone; that unsupported assumption is replaced with a conservative must-not-infer-a-note rule. This is a documented scope containment, not a claim that repeated attacks are solved or a hidden relaxation of the fidelity goal.
