# Ink wash sources

The originals. One brush study per plate, kept here out of the app
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

One further exception: `watch` came back on textured watercolour paper with a
vignette, paper running 250 at the top left down to 239 at the bottom right and
grain overlapping the lightest washes. No single white point separates that
paper from the drawing, so this one source is flat-fielded first and then
converted at the standard 246:

    small = g.resize((W//24, H//24)).filter(MaxFilter(5)).filter(GaussianBlur(3))
    bg    = small.resize((W, H), BICUBIC)          # the paper, estimated locally
    flat  = clip(g / bg * 252, 0, 255)

Dividing by a local estimate of the paper removes the gradient and the grain
together. After it, the four corners of the shipped PNG measure alpha 1, 5, 10
and 7 out of 255, which is nothing. Ask any future render for plain white paper
and this step is not needed.

## Then crop to the drawing

Every source came back with the subject in the lower half of a portrait frame
and a great deal of empty paper above it. That was fine while the plates sat at
full bleed behind a screen, and wrong the moment they became drawings placed in
their own space: `contentFit: contain` fits the CANVAS, so the empty half was
being fitted too and the drawing came out small and floating.

So the shipped PNGs are cropped to the alpha bounding box, with a 3% margin,
after the conversion:

    box = alpha.point(lambda v: 255 if v > 12 else 0).getbbox()

The `> 12` floor matters: without it the box catches the faintest halo of the
wash and the crop does almost nothing. Aspect ratios stop being uniform after
this, which is the point — most of these are landscape once cropped, and that
is the shape of the band a drawing lands in under an onboarding step.

## What the generation actually got wrong

Almost nothing. Three things worth recording, because they were not what was
predicted:

- **No red seals.** The prompt sheet called this the most likely failure. Every
  file came back clean. The chroma that shows up under analysis is a warm cast
  in the ink plus JPEG noise, and it does not survive the conversion anyway —
  only luminance is kept.
- **Bottom-weighting worked exactly.** Every plate has effectively zero ink in
  the top 40% of the frame. That was read at the time as a feature, because it
  let one full-bleed asset sit behind a screen without per-screen cropping. It
  was actually the problem: see the crop step above.
- **Coverage varies six to one** — 1.2% for the tag, 7.6% for the basket. That
  is the real difference from halftone, where screening spread ink evenly and
  one opacity fitted every plate. See the opacity note in
  `mobile/src/components/inkwash-plate.tsx`.
- **They are paler than they look.** Measured, the darkest strokes on most of
  these top out around alpha 200 of 255, and the mean over the whole drawing is
  a few per cent. The first component held them at a fifth of that on top, which
  is how fourteen finished drawings ended up invisible.

## Naming

Sources are `NAME.source.jpeg`, matching the plate key in `PLATES`. Rejects, if
any, get `NAME.REJECTED.jpeg` — the way `../halftone-sources/` keeps the label
macro that never worked. Knowing what failed is worth as much as the file that
did.
