# Audio window lifecycle

`prepareAudio` decodes a file once and retains its identity until `releaseAudio` or a replacement. It does not transcribe. `invalidate` cancels pending work while retaining the decoded buffer for another selection or mode. `load` remains available for MIDI and the legacy first-fragment audio path.

`selectAudioWindow` validates time bounds and returns canonical, clamped sample indices. `analyzeAudio` independently validates those indices and accepts only the active prepared object. It averages all channels in the selected range and sends samples at the decoded rate. Notes and model frames remain relative to the selected fragment; `sourceWindow` records its original sample-derived bounds and source duration.

Time-to-sample conversion floors fractional samples, with an allowance limited to floating-point representation error at integer sample boundaries. This keeps `index / sampleRate` round trips stable when the other selection edge changes. The decimal duration check also allows representation roundoff; the integer-sample maximum remains strict. Negative, empty, reversed and out-of-file selections are rejected.
