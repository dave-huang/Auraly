# Ink wash sources

The originals. Fourteen brush studies, one per plate, kept here out of the app
bundle. What ships is in `mobile/assets/images/inkwash/` — transparent PNGs
whose alpha is the ink, colour channels discarded, tinted live from the theme.

## The conversion

    lut   = [0 if v >= WHITE_POINT else round(255 - v * 255 / WHITE_POINT)
             for v in range(256)]
    alpha = grayscale.point(lut)
    png   = Image.merge('LA', (Image.new('L', size, 0), alpha))

`WHITE_POINT` is 246 — where paper stops and ink starts — and `MAX_EDGE` is
1200. One exception: `specimen` came back with a flat #E9E9E9 panel behind the
sprig, which at 246 converts to a solid grey slab. Its white point is 231, just
under the panel, so the panel drops out and every stroke survives.

## What the generation actually got wrong

Almost nothing. Three things worth recording, because they were not what was
predicted:

- **No red seals.** The prompt sheet called this the most likely failure. Every
  file came back clean. The chroma that shows up under analysis is a warm cast
  in the ink plus JPEG noise, and it does not survive the conversion anyway —
  only luminance is kept.
- **Bottom-weighting worked exactly.** Every plate has effectively zero ink in
  the top 40% of the frame, which is what lets one full-bleed asset sit behind
  eleven different screens without per-screen cropping.
- **Coverage varies six to one** — 1.2% for the tag, 7.6% for the basket. That
  is the real difference from halftone, where screening spread ink evenly and
  one opacity fitted every plate. See the opacity note in
  `mobile/src/components/inkwash-plate.tsx`.

## Naming

Sources are `NAME.source.jpeg`, matching the plate key in `PLATES`. Rejects, if
any, get `NAME.REJECTED.jpeg` — the way `../halftone-sources/` keeps the label
macro that never worked. Knowing what failed is worth as much as the file that
did.
