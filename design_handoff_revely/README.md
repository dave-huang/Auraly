# Handoff: Revely — camera-first allergen scanner

## Overview
Revely (formerly Auraly) scans a product's ingredient list with the camera and returns one of three verdicts against the active person's allergen profile: **Safe**, **Caution**, **Avoid** — plus a fourth, colourless **uncertain** state when the label can't be read. The product is the two seconds between shutter and verdict; everything else in the app exists to make that moment fast, legible, and trustworthy.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy. The task is to **recreate these designs in the target codebase's environment** (React Native / Expo assumed, per the token file paths) using its established patterns and libraries. If no environment exists yet, pick the appropriate stack and implement there.

Open `Revely Design System.dc.html` in a browser to see all 14 screens plus a live scan-flow prototype at the top. Open `Revely Icon & Splash.dc.html` for the app icon, splash, and lockup.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, motion timings and haptics are decided. Recreate pixel-accurately at 393 × 852 pt (iPhone 15/16). Android uses identical spacing with system back and 16dp side gutters.

## Design language, in one paragraph
Warm paper and ink, no chrome. Ground is `#F6F1E7`, cards `#FFFCF6`, rules are 1px `#DDD4C2`. Almost everything is flat — `Radius.flat = 0` for cards and rows, `28` for bottom sheets, `999` for pills. Three typefaces with strict jobs: **Newsreader** (light, serif) for the verdict word *only*; **Instrument Sans** for all UI copy; **IBM Plex Mono** as the machine voice — profile chips, OCR readouts, confidence meters, eyebrows. The three verdict colours are the only saturated colour anywhere in the app; using them for a button, a tab, a link, or a chart is a bug.

## Screens

All screens 393 × 852. Light theme unless noted.

**01 · Launch — Viewfinder.** Cold start lands here. No splash beyond the held frame, no home tab. Full-bleed camera; vignette `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.5))`. Top: status bar, then a profile chip pill (`rgba(14,12,10,.6)` fill, `1px rgba(246,241,231,.18)` border) showing the aperture mark, the profile name, and their allergens in mono. Centre: reticle — four 30px corner brackets, 2px `#F6F1E7`, inset 44px from the sides, 290px tall, top 250px. Bottom stack: Food / Skin & hair segmented pill, hint text "Fill the frame with the ingredient list", then the control row — 46px gallery tile (left), 78px shutter (3px ring + 62px `#F6F1E7` fill), 46px menu circle (right).

**02 · Anchor screen — Avoid verdict.** The screen the whole system is designed around. Frozen frame at top, verdict card risen over it.

**03 · Verdict — Safe.** Same card, safe ink `#3F6B4C`, wash `#E4EBE1`.

**04 · Verdict — Caution.** Caution ink `#A96C12`, wash `#F3E6CE`.

**05 · Honest failure — uncertain.** No verdict colour and no verdict word. Dashed card edge, the OCR block shown redacted, and three retake affordances (better light / flatten the label / type it in). This state must never be dressed up as a soft "Safe".

**06 · Onboarding 2 of 4 — allergen picking.** Paper ground.

**07 · Onboarding 4 of 4 — profile confirmation.** Paper ground.

**08 · Retention — History grid.** Scanned products as a grid of tiles, each tile carrying its verdict seal.

**09 · Drill-down — Ingredient detail.** One ingredient, why it flagged, sources, and its aliases.

**10 · Multi-profile — profile switcher.** Ink ground; switching profile re-runs the verdict on the current scan.

**11 · Monetisation — paywall.** Ink ground.

**12–14 · Lamplight (dark mode).** Viewfinder, avoid verdict, and history in the `Lamplight` palette. Dark mode is not a grey inversion — it's the same paper-and-ink logic read by lamp: ground `#16130F`, surface `#1E1A15`, ink `#F6F1E7`, and the verdict inks lift to `VerdictDark`.

## The verdict card
One component carries the product. Build it as a self-contained object with a fixed internal order so every screenshot of it looks like the same thing:

1. **Verdict seal** — circle, 2px verdict ink, rotated −5°, with an inner ring.
2. **Verdict word** — Newsreader, 56/50, tracking −1.7, in the verdict ink.
3. **Reason line** — 17/24, one sentence, plain language.
4. **Read from the label** — the bilingual OCR block: source-language text beside its translation, mono eyebrow `READ FROM THE LABEL`, on `#F6F1E7` with a `#DDD4C2` border.
5. **Ingredients** — rows separated by 1px `#EDE6D8`, each with a 6px verdict dot, the ingredient name, and its match reason.
6. **Confidence meter** — mono label / value pair over a segmented bar (`LABEL READ · clear`).
7. **Controls** — "Scan another" (pill, ink `#16130F` fill, `#F6F1E7` text, 600/15) then secondary actions.

**Screenshot rule:** the card must stay legible cropped to its top 40% — the region a thumb leaves visible when someone films a scan. Seal, word, and reason all live in that band.

## Motion & haptics
Budget from shutter to legible verdict: **under 2 seconds.**

- `sweep` — the scan line crosses the frozen frame **once**, 1100ms, `cubic-bezier(.4,0,.2,1)`. Never loops. A looping scan line reads as "still thinking".
- `rise` — the card rises 46px into place, 420ms, `cubic-bezier(.16,1,.3,1)`.
- `seal` — stamps at 450ms with a 200ms delay and a −4° rotate.
- `press` — 120ms.
- Haptics: safe `impactLight`; caution `impactMedium` → 90ms → `impactLight`; avoid `impactHeavy` → 60ms → `impactHeavy`; uncertain has **no** haptic.

## Share object
Verdict cards export as self-contained share images, **always light theme**, always on the paper ground — they have to survive being posted anywhere. Feed 1080 × 1350, story 1080 × 1920, `pixelRatio: 3`. Implementation: `react-native-view-shot` on an off-screen `<ShareCard size="feed" | "story" />`.

## State
- `activeProfile` — id; drives every verdict. Switching re-evaluates the current scan without a re-scan.
- `profiles[]` — name, allergen list, colour-free avatar.
- `scan` — `idle | capturing | reading | verdict | uncertain`.
- `ocr` — source text, translation, per-line confidence.
- `verdict` — `safe | caution | avoid | uncertain`, reason string, matched ingredients with the rule that matched.
- `history[]` — persisted scans with thumbnail, verdict, timestamp, profile id.

## Design tokens
See `design.ts` in this folder — drop it in at `mobile/src/constants/design.ts`.

## Delete on sight
- `Brand.primary #208AEF` — there is no brand blue any more. Buttons are ink.
- Any leaf glyph — the leaf went with the old name.
- Verdict colours used anywhere that isn't a verdict surface.
- Looping scan animations, spinners on the splash.

## Build order
1. Swap tokens in `constants/design.ts` (file included here).
2. Make `/scan` the launch route — viewfinder, reticle, profile chip, shutter.
3. Rebuild the verdict card as one component with the fixed internal order above; wire the three verdicts plus uncertain.
4. Reveal choreography: freeze → sweep → rise → seal, with haptics.
5. History grid, ingredient drill-down, multi-profile switching.
6. Lamplight palette, then the share export.

## Assets
`assets/revely/` — all generated from the Aperture mark (four detached corner brackets over two text bars):
- `icon.png`, `icon-dark.png`, `icon-tinted.png`, `icon-fg.png` — iOS/Android app icon set
- `splash-mark.png`, `splash-mark-light.png` — splash marks
- `revely-lockup.svg` — horizontal mark + wordmark
- `revely-mark.svg`, `revely-mark-24.svg`, `revely-mark-small.svg` — mark at three optical sizes; strokes thicken as it shrinks, never scale linearly
- `favicon.png`

The SVG is the source of truth — regenerate rasters from it rather than upscaling PNGs.

## Files in this bundle
- `Revely Design System.dc.html` — foundations, graphic kit, verdict card anatomy, 14 screens, motion & haptics, tokens
- `Revely Icon & Splash.dc.html` — app icon, size tests, homescreen in-situ, splash, export set
- `design.ts` — tokens, ready to paste
- `assets/revely/*` — icon and mark exports
