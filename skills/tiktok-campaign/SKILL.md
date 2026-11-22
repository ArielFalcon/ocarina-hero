---
name: tiktok-campaign
description: "Trigger: TikTok videos, plan de vídeos TikTok, programar TikTok. Plan promo films with the owner, produce them with review gates, schedule them optimised."
license: Apache-2.0
metadata:
  author: "ariel"
  version: "1.0"
---

## Activation Contract

Use when the owner asks for new TikTok videos for @ocarinahero.app, a content plan, or to upload or schedule videos. The lead plans, delegates and schedules; film builders follow the global `promo-film` skill.

## Hard Rules

- Never build or post before the owner approves the plan; never schedule a video the owner has not approved in motion.
- Every film obeys `references/owner-rules.md`. Check each delivery against it before showing it.
- Show every still, draft and final with a clickable `out/...` path. The owner listens; sound is measured, never claimed as heard.
- Songs come from the live catalogue. A song that is missing, or a section a film needs, goes through `skills/ocarina-catalogue` and is deployed before the film captures it; capture from a clean worktree of origin/main or the live site, never from a checkout on another branch.
- Captions and hashtags follow `references/captions-hashtags.md`: one short line, exactly 5 tags, the account's proven set first.
- Schedule only through TikTok Studio as described in `references/tiktok-studio.md`. Scheduled posts cannot be edited: replace by scheduling the new copy first, then deleting the old one, identified by its caption.
- Never write into a builder's folder; verify its files read-only (`ffmpeg -v error -i f -f null -`, `ffprobe`, loudness).
- No em or en dashes in any visible text or caption.

## Decision Gates

| Situation | Action |
| --- | --- |
| No approved plan | Plan with `references/planning.md`; one question with a recommendation; stop |
| Film with new characters or sets | Builder stops at composition stills; owner approves; then the draft |
| Pack or format reusing approved systems | Builder renders the draft directly |
| Owner feedback on a draft | Relay it verbatim to the same builder thread; record new general rules in `references/owner-rules.md` |
| Film needs a song or section the catalogue lacks | Catalogue agent first (worktree, push to main, deploy), then the builder recaptures |
| Video approved | Schedule it at its slot with caption, tags and cover |

## Execution Steps

1. Read `references/planning.md`; check analytics and the opener ledger; propose the plan (`assets/plan-template.md`) and stop for approval.
2. Write the shared brief from `assets/brief-template.md`; launch one builder per film (`references/production.md`).
3. Relay each gate to the owner: stills, then the draft in motion, with links and what was verified.
4. Loop feedback until the owner approves each film.
5. Schedule every approved film (`references/tiktok-studio.md`); verify the content list shows caption and Madrid time.
6. Record what changed in the plan, memory and Engram.

## Output Contract

Per film: status, link to the file and cover, length, what was verified and what was not, open decisions. After scheduling: a table of date and time (Madrid), video, caption and hashtags, read back from the TikTok Studio content list.

## References

`references/planning.md` (data, formats, openers, slots, proposal), `references/owner-rules.md` (on-screen and story rules), `references/production.md` (builders, gates, verification), `references/captions-hashtags.md` (caption formula, tag criterion), `references/tiktok-studio.md` (upload, cover, schedule, replace). `assets/plan-template.md`, `assets/brief-template.md`.
