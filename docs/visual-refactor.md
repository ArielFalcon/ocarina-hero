# Songbook visual refactor

The app now uses the search-first Songbook layout and the approved embroidered
component treatment. Catalogue discovery, learning, free play, experimental imports,
and instrument settings are separate views of the existing application.

## Behavior

| Area | Implementation |
| --- | --- |
| Catalogue | Normalized multiword search across title, original title, artist, aliases, and universe; category and universe filters intersect with saved songs |
| Categories | Responsive category tiles with counts; nonexclusive tags; collapsible filter group that makes room for search results on mobile |
| Icons | Semantic woven SVGs for categories and typed franchise/song motifs shared by catalogue badges and lesson headings; icons remain visible in narrow category tiles |
| Growth | Six initial results, load more, explicit stable-ID metadata, and a searchable Other fallback for new IDs |
| Saved songs | Local browser storage; a visible session-only notice when storage is unavailable |
| Learning | Existing arrangements displayed as a five-line button staff, bounded to at most five original instructions at once |
| Passages | Explicit source boundaries where available, otherwise existing rest groups; larger groups split for display without rewriting music |
| Practice | Advances for the expected button and modifier together; repeats an optional passage; position is not a timing or proficiency score |
| Playback | Existing OcarinaEngine and Playback lifecycle; continuous playback through display windows, selected-note start, explicit passage loop, preserved durations/rests, and existing 100/90/75% speeds |
| Free play | Existing keyboard, pointer, and multi-touch ownership; original controller SVGs; recorded notes remain when returning to Free play |
| Workshop | Existing MIDI import, audio region editor, analysis modes, 15-second audio limit, analysis download, and result reopening |
| Settings | Existing measured tuning, adjustment, recording calibration, and tuning storage |
| Keyboard | Desktop-only physical-key reassignment for five notes and four modifiers; unique assignments, local persistence, capture cancellation and defaults reset; controller labels reflect the mapping |

The SVGs in `public/icons/controller/` remain unchanged. Decorative assets and
embroidery do not replace interactive DOM elements. Main melody extraction remains
experimental; the refactor does not claim better transcription accuracy.

## Ownership

- `src/ui/songbook.ts` owns explicit display metadata and filter matching.
- `src/ui/songbook-view.ts` owns catalogue DOM, filter state, paging, and favorites.
- `src/ui/lesson.ts` owns display-window grouping, exact practice matching, and
  passage timing rebasing, reusing existing core rules.
- `src/ui/main.ts` integrates these views with the existing engine, controls,
  importer, editor, and calibration. DOM sections stay mounted so route changes do
  not replace the audio editor or duplicate input listeners.
- `src/ui/styles.css` applies the shared cloth, cord, typography, and component tokens;
  the audio editor retains its own scoped stylesheet and reads the shared colors.

Selecting a staff note preserves its native focus and sets the playback start.
Playback note highlighting follows original indices even when only a passage is
visible. Repetition is scheduled only after natural completion and is cancelled
when playback stops or the user navigates away.

## Art

The shared `.menu-footer` anchors `public/art/sword-triforce-v2.webp` immediately
above the navigation. This is the revised 1920 × 819 embroidery exported with
alpha preserved; its [prompt](design-system/assets/sword-triforce-v2-prompt.txt)
records the source. It scales up to 640px wide and 84% on narrow screens, uses
the shared cloth underneath, and stays behind controls without intercepting
pointer input or taking additional vertical space. Browser checks at 390px and
1440px verify image loading, full horizontal bounds, its lower edge touching the
menu, fixed anchoring across routes/scroll, and click-through behavior.

`public/art/tree-desktop.webp` (2172 × 724, about 381 KiB) and
`public/art/tree-mobile.webp` (1536 × 1024, about 368 KiB) are transparent
embroidered overlays. A shared decorative `<picture>` selects the panoramic
desktop asset at 800px and above, and the compact mobile composition below it.
Only the embroidery contains visible pixels; the negative space exposes the
same cloth used by the rest of the app. This removes the earlier weave-density
and resolution seam caused by scaling a green-backed tapestry over a different
cloth tile. Both variants preserve the tree face and complete ocarina, use a soft
lower mask and remain static behind every view. There is no sidebar duplicate.

Built-in ImageGen produced both variants from the original tapestry; the
[responsive tree prompts](design-system/assets/responsive-tree-prompts.txt)
record the constraints. WebP export preserves alpha at the generated dimensions;
there is no artificial upscaling. `public/art/tapestry-band.jpg` is a lossless crop of
the source tapestry (`design-system/assets/sources/tapestry.jpg`) to the upper
ornamental band, the only part displayed. Its [original prompt](design-system/assets/tapestry-prompt.txt)
remains recorded. Production assets do not depend on generated-image cache paths.

`public/art/cloth.jpg` continues the source's plain green woven material across the
page, other views and navigation. It is a seamless ImageGen texture derived from
the tapestry's unadorned left half, exported at 768px for delivery. Its
[generation prompt](design-system/assets/cloth-prompt.txt) records the constraints.
The catalogue artwork is decorative and pointer-transparent; it does not clip or
intercept the search input. Browser captures at 390px and 1100px verify the single
tree, visible ocarina and soft transition into the cloth.

The shared shell fills the visible viewport (`100dvh`, falling back to `100vh`).
Only `#main-content` scrolls. Header and bottom navigation retain their positions
across catalogue, lesson/free play, Workshop and settings; the decorative image
stays attached to the shell rather than the scrollable content. Route changes
reset that region's scroll position. Desktop fills the viewport width, and
scrollbars use the same green cloth and ochre cord palette.
Browser assertions at 390px and 1100px cover equal shell height, footer bounds,
internal catalogue scrolling, keyboard focus, consistent background and scroll
reset across every route. The independent capture surface substitutes 800px for
viewport units to match its 800px browser viewport.

Typography uses the pinned IM Fell English regular and italic faces documented in
the [design system](design-system.md), with a serif fallback if they cannot load.

## Verification record

Implementation checks cover the catalogue/filter model, passage grouping without
lost indices, exact button/modifier matching, preserved timing, and the playback
completion/cancellation lifecycle. The browser integration check uses the real app
and an eight-note MIDI fixture. A separate 1.1-second synthetic WAV exercises the
real waveform editor and isolated-instrument analysis; it produces a playable
result and enables analysis download. This is a UI regression check, not an
evaluation of accompanied-song extraction quality.

Browser checks also cover focus preservation, starting playback at a selected
note, route changes, free-play recording, saved state, tuning controls, and
responsive control bounds. Visual QA covers mobile and desktop layouts.

Recorded checks: `npm run build` succeeds and `npm test` passes all 112 tests.
Live Vite browser checks pass at 320px, 390px, and 1100px; compiled-bundle visual
captures cover mobile and desktop. Staff, category, and favorite controls retain
keyboard focus across state changes. Existing Vite warnings about a future native
config loader remain outside this UI change.

The lesson update adds deterministic production-bundle browser checks at 320px,
390px, 1100px and 1440px. They exercise continuous scheduling across windows,
automatic staff following, passage seek/resume, explicit looping and desktop key
assignment, conflict rejection, modifier combinations, saved state and reset.
The engine boundary is stubbed for deterministic browser checks; the helper and
playback tests guard selection, timing and lifecycle behavior. New SVG cord/stitch
icons are shared between catalogue universe marks and lesson headings/actions.
Mobile hides the keyboard editor and assignment labels. The redundant arrangement
panel and decorative tagline have been removed.

Responsive tree captures at 390px and 1440px use the full-resolution production
WebP files, with their alpha intact, over the actual shared cloth tile. Browser
assertions verify the expected native dimensions for the selected source and a
stationary picture across route changes and internal scrolling. The tree carries
no second cloth texture, so resizing it cannot change the green weave density.

The connected browser's snapshot operation timed out. Visual captures therefore
use the same compiled production bundle in the independent HTML preview browser,
with original SVG bytes embedded, a reduced-resolution copy of the same decorative
image, and `min-height: 100vh` fixed to 844px for that capture surface. Live browser
interactions run against the Vite app. This is not a cross-browser or full
accessibility certification; the main melody model and physical game execution
are not newly validated by this refactor.
