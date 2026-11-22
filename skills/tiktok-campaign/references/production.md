# Producing the films

## Builders

- One builder per film, launched with `delegate_task` (implementation role) and the shared brief from `assets/brief-template.md`. Builders follow the global `promo-film` skill; new art comes from image agents (`codex`, `gpt-6.1-sol`, `reasoningEffort: high`, role `design`), one per character kit or camera position, in parallel.
- Each builder owns one folder `out/promo-source/<film>/` and one dev-server port. Deliveries go to `out/ocarina-hero-art/scenes/library/ocarina-hero/videos/<film>/` with the MP4, the cover JPG and `caption.md`. Earlier versions keep a `-vN` suffix.
- Feedback goes to the same builder thread with `t3_thread_send`, quoting the owner verbatim. A builder may report "completed" while its background jobs still run: wait for its delivery message, never re-run its render.
- Children never commit, push or post. The lead owns git, deploys and TikTok.

## Gates

1. Stills (new characters or sets only): one vertical still per scene or camera position plus a storyboard with timings. Read every still yourself before relaying: owner rules, Navi, props, text, URL.
2. Draft in motion: full render. Check the contact sheet, decode, duration, loudness (-14 LUFS, true peak under -1 dBTP).
3. Final: same checks on the file you will upload. Show it with its cover and caption.

## Songs the film needs

- The film may only play what the live catalogue has. If a song or section is missing, launch a catalogue agent under `skills/ocarina-catalogue` in a worktree from origin/main; it pushes to main and confirms the deploy and the live page.
- Range limits are real: the instrument covers written C4 to E5. When a section does not fit, render synthesized previews of the options for the owner before deciding; exceptions to the catalogue rules are the owner's and are recorded verbatim.
- After the deploy, the builder captures from a clean worktree of origin/main (or the live site) and asserts the note count before rendering.

## Verification commands

```sh
ffmpeg -v error -i film.mp4 -f null - && echo DECODE_OK
ffprobe -v error -show_entries format=duration -of csv=p=0 film.mp4
ffmpeg -nostats -i film.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12
```

Give the owner `out/...` paths (the `ocarina-tabs-media` paths do not open in the viewer). Remove every worktree as soon as its branch is merged.
