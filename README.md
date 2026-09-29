# sr.xp — speedrun events & drops (v3 prototype)

A gated, single-page prototype: an email gate ("Exclusive Events and Drops, As They Happen.") leading to an **Index** of speedrun events. Visitors request access per event, get approved, and unlock the venue with a password. Built as plain HTML/CSS/JS — no build step, no framework, no dependencies to install.

Live preview: https://ngevorgyan-sr.github.io/srxp/

## Run it

- **Quickest:** double-click `index.html`. Everything, including the WebGL paint, works from `file://`.
- **Local server (recommended while developing):** `python3 tools/serve.py` → http://localhost:8141. It sends no-cache headers so every reload shows your latest edits.
- **Deploy:** any static host (GitHub Pages, Netlify, S3, Vercel static). Upload the folder as-is.

Testing switches (append to the URL): `?fx=lite` forces the still/low-end mode, `?fx=full` forces all effects, `?fx=auto` returns to automatic detection.

## Files

| Path | What it is |
|---|---|
| `index.html` | The whole page: design tokens and CSS, markup, the `CONTENT` data block, and the app script (gate, Index list/grid, event sheet, access flow). |
| `js/fx-tier.js` | Decides full effects vs. still "lite" mode (see *Performance tiers*). Loaded first, in `<head>`. |
| `js/paint-text.js` | SR008 interactive fluid paint masked into "As They Happen." |
| `js/gloss.js` | "Grey Gloss" button finish layers + the light that travels round the stroke. |
| `js/glass-preset.js` | **Locked button settings** (exported from Glass Studio). |
| `js/glass-buttons.js` | Mounts the refractive glass ripple on every `.sr-btn`, including buttons added later. |
| `js/bar-ripple.js` | Dark shimmer ripple across the Index top bar (hover from any edge, or click). |
| `js/apply-paint.js` | Live paint fill inside the "Start your SR008 App" button (fluid runtime on a layer under the label; hover sweeps and stirs it). |
| `vendor/fluid/fluid-header.js` | SR008 banner fluid runtime (WebGL2). Readable copy with two sr.xp patches, marked `sr.xp patch`: a live `set()` method, and mirrored texture edges. |
| `vendor/glass/` | speedrun website glass-effects kit (unmodified build). |
| `assets/` | Event photo, marble fallback, headline paint texture, `apply-paint.png` (button fill: 308×107, the 226×47 art centred with warp headroom around it). The `*.data.js` files are the same images as embedded data, only fetched when opened from `file://`. |
| `fonts/` | Messina Sans cuts used by the page. |
| `tools/serve.py` | No-cache local preview server. |

## Content

Edit the `CONTENT` object near the bottom of `index.html`: `applyUrl`, `items` (events) and `includes` ("What's there"). Adding an item automatically adds it to the list, grid, filter counts and the scrolling ticker. A venue written as `"TBD: …"` renders as TBD. `redacted: true` hides an unannounced event (it's also kept out of the ticker).

## Design system notes

- speedrun brand: Messina Sans (Black 900 for headlines, Condensed Regular uppercase for labels, VF for body). The brand name is always written lowercase in source (`speedrun`); Condensed labels uppercase it via CSS.
- Colours and spacing are tokens in `:root` (`--sr-*`). Background `#F3F3F3`; ink `--sr-text-primary` `#1A1A1A`; success/“live” green `--sr-success` `#89FC72`. Page margin `--gutter` is a fixed 32px at every size.
- **Gate headline compositions** (fixed line breaks, font sized to the largest that fits):
  - **A, ≥1200px:** 5 lines, form beside the title.
  - **B, 720–1199px:** 3 lines, title anchored to the top, form below.
  - **C, 450–719px:** 5 lines, 65% scale, never below 78px.
  - **D, <450px:** 6 lines at 78px; shrinks below 78px only when a single line can't fit.
- Form width is a fixed 400px at every breakpoint (capped to the screen on phones).
- "Index" heading: scales with the window, never below 96px above the mobile break (720px). Its intro text sits on the Index baseline until mobile, then stacks full width.

## Effects

- **Fluid paint** (`js/paint-text.js`): an aria-hidden clone of the headline shows only the painted words, and `-webkit-mask-clip:text` clips the WebGL canvas to those glyphs. The real headline stays selectable, accessible text. Locked framing: `{zoom 1.2, x 0.444, y 0.586}`. Locked fluid: curl 10, brush 0.08, warp depth 0.16 (other banner values commented inline). Firefox lacks mask-clip:text and shows the static marble fill.
- **Buttons**: SR glass ripple (`js/glass-preset.js`) under the Grey Gloss finish (`js/gloss.js`). Buttons inside the dark "Unlocked" card get the dark variant (SR "03 Flat Black" tuning: iridescence ×1.6875, ring highlight ×4/3).
- **Top bar**: the same dark tuning, with stretch capped to ~2px at any width.
- **"Start your SR008 App"** (`js/apply-paint.js`): same glass shell, silver gloss edge and ripple as the other buttons, but with the glass ripple and the white face sweep turned off (ripple optics zeroed in `js/glass-buttons.js`; `srxpGloss.decorate(el, {reflection:false})`); the hover lift and the travelling edge light stay. The fill is a second instance of the fluid runtime showing the middle of `assets/apply-paint.png`; hovering sweeps a brush across it from the entry side and pointer movement stirs it. White semi-bold label, unaffected by the warp. Lite tier and no-JS show the still texture via CSS.

## Performance tiers (`js/fx-tier.js`)

Capable devices always get full effects. Lite (static paint and static gloss, no WebGL, no ripples) is used only for unambiguous signals: reduced-motion, data-saver, a 2g connection, ≤2 GB memory, ≤2 CPU cores, or no real GPU. Otherwise it measures real frame times after the paint starts, and downgrades only below ~25 fps median (iOS Low Power Mode's 30 fps stays full). The decision is cached for 7 days in `localStorage` (`srxp:fx`).

## Prototype controls — REMOVE before production

The black **Prototype** chip in the centre of the Index footer opens a tooltip on hover (click pins it open; tap on touch screens) that fakes the access flow: per event, pick **Open / Requested / Approved / Unlocked**, or **Reset all to Open**. It exists only so reviewers can see every state without emails or passwords. It writes the same `localStorage` flags the real flow uses (`srxp:req:*`, `srxp:approve:*`, `srxp:un:*`) plus its own `srxp:deny:*` for the Requested state.

To remove it, delete the three blocks marked `PROTOTYPE ONLY` in `index.html`:
1. the CSS block (`.proto-fab` … `/* end PROTOTYPE ONLY */`),
2. the markup inside `<footer>` (`<div class="proto-fab" id="proto">` … `<!-- end PROTOTYPE ONLY -->`),
3. the script block (`const proto = $("#proto");` … `/* end PROTOTYPE ONLY */`),
4. the one-line `deny:` check at the top of `onList` (marked `PROTOTYPE ONLY`), which lets the tool simulate a visitor who isn't on the approved list.

Nothing else references them; the page runs unchanged without them. (`js/glass-buttons.js` skips `.proto-fab` when mounting button effects; that selector can stay or go.)

## Before production — read this

This is a **front-end prototype**. The access flow is simulated in the browser:

- Event **passwords and approved-email lists live in `CONTENT`**, in client-side JavaScript, visible to anyone who views source. Anything with an `@a16z.com` email is auto-approved (`testApprovedDomains`, marked TEST ONLY).
- Requests, approvals and unlocks are stored in `localStorage`; the "email" is an on-page simulation.
- **To ship:** move approval, passwords and venue details to a server/API. Only return a venue after the server confirms the visitor is approved. Send real emails. Remove `testApprovedDomains` and all passwords from the client.
- Not yet verified: physical low-end phones/tablets, and Firefox and Safari end-to-end (Chrome was used throughout).
- **Messina Sans is a licensed commercial typeface (Luzi Type).** Confirm the web licence covers self-hosting the font files on the production domain.

## Provenance

- Paint effect: SR008 interactive banner (`fluid-header`).
- Glass ripple: speedrun website glass-effects kit (Glass Studio preset exported 2026-09-29).
- Grey Gloss finish: speedrun website button comparison, design "02".
