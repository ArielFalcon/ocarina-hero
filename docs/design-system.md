# Tapestry design system

This is the approved visual identity for Ocarina Hero, established on November 12,
2026. All UI styling work must follow it. The interface should appear woven into
an aged forest-green tapestry, with matte ochre cord, cream embroidered lettering,
and restrained rust-red emphasis. Preserve real text and native controls.

**Status:** implemented in the app's Songbook, lesson, free-play, and Workshop
views. The standalone specimen remains the reference for material and
component treatment. See [implementation and verification](visual-refactor.md)
for the delivered behavior and its verification limits. This guide does not
authorize a redesign of unrelated functionality.

## Start here

1. Open the [interactive reference](design-system/reference.html) in a browser.
   It can be opened directly as a file; its font faces require an internet connection.
2. Reuse the reference's tokens and effects in the existing component that owns the
   behavior. Inspect current app code before editing it.
3. Check the changed states at mobile and desktop widths against the reference,
   then complete the [delivery checklist](#delivery-checklist).

This guide defines the rules; the reference contains the exact gradients, masks,
filter definitions, and working examples. Keep them consistent when updating the
design system. Do not copy the specimen's demo logic into the app.

## Visual contract

| Area | Required direction | Avoid |
| --- | --- | --- |
| Material | Fine horizontal weft, subtle warp, low-contrast irregular fibers | A conspicuous square grid, scanlines, smooth plastic |
| Thread | Matte twisted cord, small variations in edge and tone | Chrome, luminous gold, beveled metallic frames |
| Lettering | Cream stitches, slight edge irregularity and shallow relief | Flat system-font labels, deep extrusion, blurred or distressed illegibility |
| Ornament | Sparse botanical scrolls, leaves, diamonds, rust/ochre bands | Unrelated fantasy motifs, ornamental clutter around every label |
| Structure | Calm spacing; rectangular controls with gently softened corners | Pill-shaped controls, glossy cards, large drop shadows |
| Interaction | Clear active, focus, pressed, and disabled states in the same material | Glows, color-only state changes, texture layers intercepting input |

The original inspiration is a Zelda tapestry supplied by the user. Generated
mockups established the direction, but the **final interactive DOM specimen** is
the implementation reference. A picture of a button is not an acceptable button.
Do not introduce characters or new illustrations merely to fill empty space.

## Tokens

Use these semantic roles; do not substitute a new palette per component.

| Reference token | Value | Role |
| --- | --- | --- |
| `--forest` | `#293529` | Main cloth surface |
| `--forest-deep` | `#202b20` | Input and secondary-control cloth |
| `--cream` | `#e5c993` | Primary embroidered text |
| `--ochre` | `#c19845` | Active thread and cord emphasis |
| `--rust` | `#7b3925` | Primary action cloth |
| `--thread` | `#9c7332` | Fine seams and subdued dividers |
| `--cord` | Reference gradient | Twisted edge thread; reuse the exact stops |
| `--satin` | Reference gradients | Small stitch highlights and thread fill |
| `--weave` | Reference gradients | Low-contrast fabric underneath content |
| `--story-font` | `'IM Fell English', Georgia, serif` | Secondary text and field typography |

The reference scopes its final tokens to `#tapestry-samples`; those values take
precedence over its earlier base declarations. In production, consolidate the
approved values into the existing style tokens rather than copying both layers.

Use a 4px spacing increment. The specimen uses 32px section padding at desktop
and 23px at mobile to accommodate its inset seams; 12–18px gaps separate controls.
Rectangular control corners are approximately 6px, with a 4px cord frame and a
subtle seam inset by 6px. These dimensions describe the material, not a requirement
to reproduce the specimen's page layout.

## Typography and thread effects

| Text role | Family and treatment | Reference size |
| --- | --- | --- |
| Main heading | Georgia serif, weight 600, cream stitch fill | Responsive 39–68px |
| Section heading | Georgia serif, weight 600, cream stitch fill | Responsive 28–38px |
| Subtitle | IM Fell English, real italic, weight 400 | 23px desktop, 21px mobile |
| Field labels and values | IM Fell English regular | 19px |
| Supporting text, status, time | IM Fell English regular, gentle texture | 16px; time row 15px at mobile |
| Small section labels and badges | IM Fell English regular, restrained tracking | 14px |
| Action labels | Existing serif with stitched fill | Approximately 20–22px |

IM Fell English is by Igino Marini and is distributed under the SIL Open Font
License. Use its real regular and italic faces, not a synthetic slant. Sources:
[Google Fonts metadata](https://github.com/google/fonts/blob/main/ofl/imfellenglish/METADATA.pb)
and [license](https://github.com/google/fonts/blob/main/ofl/imfellenglish/OFL.txt).
The reference loads pinned font URLs from `fonts.gstatic.com`; retain license
information if the fonts are later self-hosted. Do not make text disappear if a
font cannot load; keep the serif fallback and `font-display: swap`.

### Embroidery recipe

- Keep headings and labels as selectable HTML text. Apply `--satin` through
  `background-clip: text`, with the reference's 2.8px stitch pattern.
- Use shallow relief: approximately 0.2–0.35px horizontal and 0.7–0.8px vertical
  shadow displacement. A subtle stroke gives thread body without a shiny outline.
- Use `satin-edge` for large lettering, `cord-edge` for cord contours, and the
  gentler `soft-thread` for subtitles and supporting text. Their displacement
  scales are 1.15, 1.8, and 0.45 respectively. Copy the filter definitions rather
  than improvising stronger noise.
- Roughening must not impair reading at the actual rendered size. Small text
  needs less displacement than headings. Use solid readable text as the fallback
  when clipping or filters are unavailable, and in forced-colors mode.
- Apply fabric grain with a pointer-transparent overlay. Keep it low contrast and
  consistent in scale across the page; avoid a different thread size per control.

Text in a button belongs inside a styled span:

```html
<button class="thread-button primary" type="button">
  <span class="stitched-label">Play</span>
</button>
```

State changes must update that span, preserving its styling and the button's
accessible name. Replacing the entire button's `textContent` removes the span.
For dynamic status/results, style the containing element so updates keep the finish.

## Components

### Buttons, tabs, and notes

Buttons use cloth fill and a continuous twisted-cord ring. The ring is a masked
pseudo-element with the shared `--cord` gradient; it must resize with content.
The rust fill identifies a primary action. Hover lightens the cloth slightly;
pressed states move by at most 1px; disabled states remain recognizable but muted.
Provide an explicit focus ring outside the cord.

Tabs use a stitched underline and an explicit selected state. Note controls use
thread circles, with an additional ochre ring and cloth fill for the active note.
Retain the app's existing controller SVGs, note mappings, timing, and semantics.
The specimen's six-note sequence and song metadata are illustrative, not validated
musical arrangements or a replacement for production data.

### Slots, selection and dividers

Grid controls (category cards, controller keys, bends, song seals) read as slots
sunk into the cloth: `--slot-recess` adds a soft inner shadow. One shared selected
state marks the chosen slot everywhere (active category, Listen/Practise, pressed
or expected controller key, keyboard binding being assigned): `--selected-cloth`
ochre weft, the full cord ring, `--slot-raised` relief and a cream dashed seam
inset 6px. It replaces brighter fills and never uses a glow. Keep cream text on it
at 4.5:1 or better; the current gradient starts at #6e5224 for that reason.

The current bottom-navigation tab uses the same selected slot (ochre cloth, cord
ring, cream seam) with its thread icon. Labels must not wrap; narrow phones use
smaller type. Category cards are a single row: icon, name (never wrapped; ellipsis
only as a last resort) and a rust count badge with an ochre edge; the noun stays
visually hidden for assistive technology. Use 2 columns on phones, 4 up to 1399px
and 8 from 1400px so names fit.
Section breaks use `--thread-rule`, a fine thread with diamond ends drawn on a
10px pseudo-element, instead of dashed borders. A soft inset vignette on the app
shell keeps attention on the centre; it is removed in forced-colors mode, where
selected slots use a `Highlight` outline.

### Universe chips

The Songbook universe filter is a row of native radio inputs styled as slots, not
a `<select>`: grouping by category and universe icons are the reason, not arrow
styling. Show only the selected category's universes (all, with inline group
labels, for All songs and Saved). Folded, a single field-like toggle
(`aria-expanded`, chevron) shows the chosen universe with its icon and count; it
never uses the selected cloth, which belongs to the checked chip inside. Opening
grows the panel downward in place (`grid-template-rows: 0fr → 1fr`, no measuring)
and scrolls only as much as needed to show it below the toggle. Chips sit in a
uniform grid (two columns on phones, ≥210px columns on desktop) and long names
wrap to two lines instead of truncating; never scroll the chips sideways. The
folded panel is `inert`. Choosing a chip or pressing Escape folds it and returns
focus to the toggle. A universe outside a newly chosen category resets to Every
universe.

### Text inputs and select

Keep native `<input>` and `<select>` elements inside a decorative `.input-frame`.
The wrapper owns the 4px cord; its decorative layers use `pointer-events: none`.
The field stays editable, focusable, and fully clickable. Reference field height
is 58px, with approximately 18px horizontal text inset.

For selects, suppress the native arrow with `appearance: none` and reserve **56px
right padding** for a decorative stitched chevron. Center the chevron vertically,
inset it **21px from the right edge**, and keep its hit testing disabled. It must
not touch the cord or overlap the longest option. Use the actual native select
for the menu and keyboard interaction; the operating system may render its popup
menu differently. Do not introduce a custom listbox solely to style the arrow.

### Checkbox

Use a real labelled `input[type="checkbox"]`, approximately 27px square. With
`appearance: none`, the **unchecked state still has dark woven cloth and a cord
frame**, rather than a gray native square. The checked state adds a darker ochre
cloth fill and cream stitched checkmark. Both states retain the same dimensions.

The input owns toggling, keyboard focus, disabled state, and checked semantics;
pseudo-elements only paint it. Make the full label a comfortable click target.
Restore native appearance and system colors in forced-colors mode.

### Range and progress

Keep a native range input. The reference uses a 5px cord track and a woven diamond
thumb: stitch fill, braided edge, and shallow thread relief. The WebKit thumb is
23px square before rotation; the Firefox thumb uses a 17px content box plus its
3px border. Keep both browser rules synchronized and check the rendered result.

Center the thumb on the track and keep its corners clear of surrounding content.
Provide a label, current value, visible focus, and a generous interactive area.
The thumb must look textile, not like a flat metal or gem marker.

If fractional animation writes position into a range, preserve that precision:
the specimen uses `step="any"`. A coarse step can round away every frame's small
increment. This does not require changing production step semantics when a range
represents a genuinely discrete value.

## Assets and integration

The [ornament reference](design-system/assets/tapestry-ornament-reference.png) is a
generated mockup retained to make the approved specimen portable. It is displayed
only as a clipped decorative band. It is not the original game artwork and must
not be used to rasterize text or controls. Its full image is reference material,
not an optimized production border asset.

For production, reuse or prepare appropriately sized decorative assets; do not
load a full mockup for a narrow band. Keep downloaded media outside this repository
as required by `AGENTS.md`. Never depend on `.codex/generated_images`, a user home
directory, or an external `out` file for a shipped UI asset.

Integrate styles into existing components and shared tokens. The standalone
reference deliberately contains its own page styles and demo state; do not import
it as a production stylesheet or replace application logic with its script. Scope
styles to their owning components and give SVG filter IDs collision-free names
when more than one instance can exist. Do not add libraries or services merely to
recreate these effects.

The app uses a transparent embroidered tree over one continuous green cloth
surface. Never bake a second green substrate into the tree asset: resizing it
would change the weave scale and create a visible seam against `--cloth`.
The shared `<picture>` selects `tree-desktop.webp` (2172 × 724) from 800px upward
and `tree-mobile.webp` (1536 × 1024) below that width. Preserve alpha, proportions,
the whole ocarina and the quiet left text region. Its position stays unchanged
across navigation and content scrolling. Avoid `cover` crops or duplicate sidebar
motifs. The cloth uses `--cloth` and `--cloth-size` at the same scale everywhere;
controls retain their embroidery treatment.

The revised sword/Triforce scene is a shared decorative ornament immediately
above the menu. Anchor it to `.menu-footer`, preserve its complete proportions
and transparency, and keep it behind the interactive content with pointer events
disabled. It must not consume the instrument's viewport space or move with the
main scroll region. Use the WebP delivery asset; the PNG remains the source.

The shared app shell fills `100dvh`, with a `100vh` fallback. Keep the header and
bottom navigation outside the flexible, internally scrolling `main` region.
The document does not scroll, content never overlaps navigation, and short views
must not move the footer upward. Reset the main region's scroll on navigation.

Desktop uses the full viewport width without a centered maximum-width shell.
Scrollbars use dark green tracks and matte ochre cord thumbs, with system colors
restored in forced-colors mode. Keep the fixed footer clear of the scroll region.

The lesson staff uses five fine thread lines on quiet dark cloth. Its windows
follow continuous playback automatically; a passage boundary does not stop audio.
Only the explicit passage-repeat option limits playback to a window. Use the
shared SVG cord/stitch treatment from `src/ui/thread-icons.ts` for navigation,
playback and universe marks; preserve original controller SVG assets.

Catalogue categories use recognizable semantic SVGs: songbook, gamepad, manga
eye, clapperboard, microphone, lyre and collection folder. Keep them visible on
phones; narrow category tiles stack the icon above their title and count.
Song metadata owns a typed `icon` name from `thread-icons.ts`, shared by the
catalogue badge and lesson heading. Prefer a franchise motif (Triforce, Poké Ball,
mushroom, glasses/lightning, etc.) or an appropriate song motif to generic
diamonds and stars. Use `music` as the fallback for unclassified future tracks.
Retain thin ochre cord and cream running stitches at compact sizes.

Desktop controller labels show the current physical keyboard assignment. The
desktop-only keyboard mapping section assigns all five notes and four modifiers,
rejects duplicate or reserved keys, saves locally and restores defaults. Do not
show key labels or keyboard configuration below the desktop breakpoint.

## Delivery checklist

- [ ] Real selectable text and native controls remain intact; decorative layers
      do not intercept clicks, selection, dragging, or focus.
- [ ] The changed component matches the approved cloth, cord, lettering, and
      material scale in its surrounding screen, not just in isolation.
- [ ] Default, hover, focus, active/selected, disabled, and relevant error states
      are inspected. Checkbox checked and unchecked states both look woven.
- [ ] Select text clears the centered chevron; range thumb clears its track and
      container at both endpoints. Focus remains visible beyond ornament.
- [ ] Inspect mobile and desktop browser screenshots, at least around 390px and
      728px for the specimen, and representative real app widths for integration.
      Check 320px when changing layout that could become constrained.
- [ ] Text wraps without clipping or overlap, including longer labels and values.
      Preserve readable contrast over texture and aim for 44px touch targets.
- [ ] Verify native keyboard interaction, associated labels, accessible names,
      selected/checked semantics, and announced dynamic results. Do not announce
      animation frames or hover changes.
- [ ] Check reduced motion, forced colors, font failure, and a solid-text fallback.
      Decorative effects must degrade gracefully without hiding essential content.
- [ ] Confirm filters do not make interaction or playback visibly sluggish. Reduce
      decorative filtering before sacrificing responsiveness or text readability.
- [ ] Compare reference and output side by side at equivalent component scale;
      fix visible mismatches and recheck affected behavior after styling changes.
- [ ] Report the widths/states actually verified. Without browser evidence, state
      `NOT visually verified`; do not claim a match from screenshots of mockups alone.

The approved specimen was visually checked in Chromium at 390px and 728px with
focused interaction assertions. It is not a completed cross-browser, accessibility,
contrast, or performance audit. Each app integration needs its own proportionate
verification; build success alone does not establish visual fidelity.
