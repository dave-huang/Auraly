"""
Build the web assets for revely.life from the app's own source art.

    python3 scripts/build-web-assets.py

Nothing here is authored. Every output is derived from a file the iOS app
already ships, so the site cannot drift away from the product it advertises:

  * PLATES come from mobile/assets/images/inkwash/*.png. Those ship as
    coverage only -- the alpha IS the ink and the colour channels were thrown
    away -- which is what lets one file serve any ground the app paints. The
    web has no runtime tint, so the colour is baked here instead, once per
    ground the site actually uses. See mobile/src/components/inkwash-plate.tsx
    for where the per-plate opacities below come from: they are not taste,
    they are measured, and re-deriving them by eye would undo that work.

  * SCREENS come from docs/appstore/captures/*.png, the same simulator
    captures the App Store plates are cut from. Same build, same clock, same
    profile name, so the site and the store listing show one sitting.

  * FONTS come from the exact @expo-google-fonts packages the app loads, cut
    to Latin and converted to woff2. They are self-hosted rather than pulled
    from fonts.googleapis.com because this is the marketing site for an app
    whose pitch is that it does not hand you to third parties, and a page that
    phones Google on load to render its own headline argues the other way.

  * The OG CARD is composed here rather than exported by hand, so it cannot
    fall out of step with the headline it is supposed to preview.

  * The APP STORE BADGES are downloaded from Apple's own marketing tools API
    and written to disk byte for byte. Apple's guidelines require their
    artwork used unmodified, so it is never redrawn, recoloured or traced,
    and this script exists partly so nobody is tempted to.

Output lands in server/web/media/, which the server mounts at /media and the
Dockerfile copies into the image.

Needs Pillow, plus fonttools and brotli for the font step:

    pip3 install --user fonttools brotli
"""
import os
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INK   = os.path.join(ROOT, 'mobile', 'assets', 'images', 'inkwash')
CAPS  = os.path.join(ROOT, 'docs', 'appstore', 'captures')
FONTS = os.path.join(ROOT, 'mobile', 'node_modules', '@expo-google-fonts')
BRAND = os.path.join(ROOT, 'design_handoff_revely', 'assets', 'revely')
OUT   = os.path.join(ROOT, 'server', 'web', 'media')

PAPER = (0x16, 0x13, 0x0F)   # ink drawn on a paper ground
LAMP  = (0xF6, 0xF1, 0xE7)   # the same drawing on the ink band

# name -> (opacity, longest edge). The opacity is lifted verbatim from PLATES
# in inkwash-plate.tsx; the size is roughly 2x the largest the site ever
# displays that plate, so it stays sharp on a retina screen and no sharper.
PLATES = {
    'scanning':  (1.00, 1200),
    'milk':      (1.00,  760),
    'language':  (0.83,  760),
    'tag':       (1.00,  760),
    'sources':   (0.90,  760),
    'bowls':     (0.90,  760),
    'privacy':   (1.00,  760),
    'allergens': (1.00,  760),
    'basket':    (0.72,  900),
    'specimen':  (1.00,  560),
}

# Plates that also appear on the ink band at the foot of the page.
ON_INK = {'basket'}


def bake(src, rgb, opacity, edge):
    im = Image.open(src)
    alpha = im.getchannel('A')
    if opacity < 1:
        alpha = alpha.point(lambda a: int(a * opacity + 0.5))
    out = Image.new('RGBA', im.size, rgb + (0,))
    out.putalpha(alpha)
    if max(out.size) > edge:
        s = edge / max(out.size)
        out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
    return out



# The five faces the site actually sets. Instrument Sans is everything;
# IBM Plex Mono is the machine voice (eyebrows, figures, source names), the
# same division of labour the app keeps. Newsreader is deliberately absent:
# in this system the serif belongs to the verdict word alone, and the only
# verdict word on the site is inside a screenshot.
FACES = [
    ('instrument-sans', '400Regular',  'InstrumentSans_400Regular',  'instrument-sans-400'),
    ('instrument-sans', '500Medium',   'InstrumentSans_500Medium',   'instrument-sans-500'),
    ('instrument-sans', '600SemiBold', 'InstrumentSans_600SemiBold', 'instrument-sans-600'),
    ('ibm-plex-mono',   '400Regular',  'IBMPlexMono_400Regular',     'ibm-plex-mono-400'),
    ('ibm-plex-mono',   '500Medium',   'IBMPlexMono_500Medium',      'ibm-plex-mono-500'),
]

# Google's own "latin" cut. Everything on this page is English; carrying the
# other 3,000 glyphs would multiply the download for nothing.
LATIN = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,'
         'U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')


def build_fonts():
    from fontTools import subset
    out = os.path.join(OUT, 'fonts')
    os.makedirs(out, exist_ok=True)
    total = 0
    for pkg, weight, stem, name in FACES:
        src = os.path.join(FONTS, pkg, weight, stem + '.ttf')
        dst = os.path.join(out, name + '.woff2')
        subset.main([
            src, f'--unicodes={LATIN}', '--flavor=woff2',
            '--layout-features=kern,liga,calt,tnum,frac',
            f'--output-file={dst}',
        ])
        total += os.path.getsize(dst)
        print(f'  fonts/{name}.woff2  {os.path.getsize(dst) // 1024}K')
    return total


def build_icons():
    """Favicon and touch icon, cut from the app's own 1024pt icon."""
    icon = Image.open(os.path.join(BRAND, 'icon.png')).convert('RGBA')
    total = 0
    for size, name in ((180, 'apple-touch-icon.png'), (48, 'favicon.png')):
        dst = os.path.join(OUT, name)
        icon.resize((size, size), Image.LANCZOS).save(dst, optimize=True)
        total += os.path.getsize(dst)
        print(f'  {name}  {os.path.getsize(dst) // 1024}K')
    return total


def build_og_card(headline, wordmark='Revely'):
    """The 1200x630 link preview: paper, the headline, and the scanning plate."""
    from PIL import ImageDraw, ImageFont
    W, H, M = 1200, 630, 72
    card = Image.new('RGB', (W, H), (0xF6, 0xF1, 0xE7))
    d = ImageDraw.Draw(card)

    plate = bake(os.path.join(INK, 'scanning.png'), PAPER, 1.00, 520)
    card.paste(plate, (W - plate.width - 30, H - plate.height - 44), plate)

    def face(pkg, weight, stem, size):
        return ImageFont.truetype(os.path.join(FONTS, pkg, weight, stem + '.ttf'), size)

    fw = face('instrument-sans', '600SemiBold', 'InstrumentSans_600SemiBold', 30)
    fh = face('instrument-sans', '600SemiBold', 'InstrumentSans_600SemiBold', 56)
    fm = face('ibm-plex-mono', '400Regular', 'IBMPlexMono_400Regular', 20)

    # The mark, drawn from the same geometry as the inline SVG on the page.
    x, y, s = M, M - 6, 40
    ink, r = (0x16, 0x13, 0x0F), 2.0
    def bar(x0, y0, x1, y1, w=r):
        d.rectangle([x + x0 * s / 100, y + y0 * s / 100,
                     x + x1 * s / 100 + w, y + y1 * s / 100 + w], fill=ink)
    bar(14, 14, 34, 14); bar(14, 14, 14, 34)
    bar(66, 14, 86, 14); bar(86, 14, 86, 34)
    bar(66, 86, 86, 86); bar(86, 66, 86, 86)
    bar(14, 86, 34, 86); bar(14, 66, 14, 86)
    bar(30, 44, 70, 44, r * 1.2); bar(30, 58, 56, 58, r * 1.2)
    d.text((x + s + 16, y + 3), wordmark, font=fw, fill=ink)

    yy = 262
    for line in headline:
        d.text((M, yy), line, font=fh, fill=ink)
        yy += 70
    d.text((M, H - M - 8), 'revely.life', font=fm, fill=(0x8A, 0x81, 0x75))

    dst = os.path.join(OUT, 'og-card.png')
    card.save(dst, optimize=True)
    print(f'  og-card.png  {os.path.getsize(dst) // 1024}K')
    return os.path.getsize(dst)


# Apple serves the current artwork per locale and colour. Black sits on the
# paper ground, white on the ink band; those are the two grounds the two cuts
# are made for, and using either on the other leaves it fenced in by its own
# grey keyline.
BADGE_API = ('https://toolbox.marketingtools.apple.com/api/v2/badges/'
             'download-on-the-app-store/{colour}/en-us')


def build_badges():
    total = 0
    for colour in ('black', 'white'):
        dst = os.path.join(OUT, f'appstore-badge-{colour}.svg')
        with urllib.request.urlopen(BADGE_API.format(colour=colour), timeout=30) as r:
            body = r.read()
        if not body.lstrip().startswith(b'<svg'):
            raise SystemExit(f'{colour} badge did not come back as SVG')
        with open(dst, 'wb') as f:
            f.write(body)
        total += len(body)
        print(f'  appstore-badge-{colour}.svg  {len(body) // 1024}K')
    return total


def main():
    os.makedirs(os.path.join(OUT, 'plates'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'screens'), exist_ok=True)
    total = 0

    for name, (opacity, edge) in PLATES.items():
        src = os.path.join(INK, f'{name}.png')
        for suffix, rgb in (('', PAPER), ('-lift', LAMP)):
            if suffix and name not in ON_INK:
                continue
            dst = os.path.join(OUT, 'plates', f'{name}{suffix}.webp')
            bake(src, rgb, opacity, edge).save(dst, 'WEBP', quality=88, method=6)
            total += os.path.getsize(dst)
            print(f'  plates/{name}{suffix}.webp  {os.path.getsize(dst)//1024}K')

    # The phone screens. 660px is 2x the 330px column they sit in.
    for name in ('04-who', '05-allergens', '01-verdict'):
        im = Image.open(os.path.join(CAPS, f'{name}.png')).convert('RGB')
        im.thumbnail((660, 10000), Image.LANCZOS)
        dst = os.path.join(OUT, 'screens', f'{name}.webp')
        im.save(dst, 'WEBP', quality=86, method=6)
        total += os.path.getsize(dst)
        print(f'  screens/{name}.webp  {os.path.getsize(dst)//1024}K')

    total += build_fonts()
    total += build_icons()
    total += build_badges()
    total += build_og_card(["Shop anywhere.", "Know what you\u2019re eating."])

    print(f'\n{total//1024}K total')


if __name__ == '__main__':
    main()
