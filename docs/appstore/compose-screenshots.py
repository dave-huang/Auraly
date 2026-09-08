from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, sys

"""
Build the App Store screenshot plates from raw simulator captures.

    python3 docs/appstore/compose-screenshots.py ink

Captures live in ./captures and come off an iPhone 17 Pro Max simulator
(1320x2868) with the clock pinned so the set reads as one sitting:

    xcrun simctl status_bar <udid> override --time "1:32"

Output goes to ./out-<theme>/01..07.png at 1284x2778, the 6.5" canvas App
Store Connect accepts for every iPhone size.
"""
import os as _os

ROOT  = _os.path.dirname(_os.path.abspath(__file__))
SHOTS = f'{ROOT}/captures'
FD    = _os.path.join(ROOT, '..', '..', 'mobile', 'node_modules',
                      '@expo-google-fonts', 'instrument-sans')
SEMI  = f'{FD}/600SemiBold/InstrumentSans_600SemiBold.ttf'
REG   = f'{FD}/400Regular/InstrumentSans_400Regular.ttf'

# 6.5" App Store canvas.
W, H = 1284, 2778

# The app's own tokens, for reference (constants/design.ts):
#   paper F6F1E7   card FFFCF6   ink 16130F   inkMuted 5C554A   rule DDD4C2
#
# The ground can no longer BE paper: the device screen is paper, and the two
# dissolved into each other. Each theme below is a different answer to "what
# does paper sit on".
# `shadows` is a list of (dy, blur, alpha) layers painted under the device,
# furthest first. Two layers, not one: a wide ambient pool that gives the plate
# depth, and a tight contact shadow just under the bottom edge that stops the
# phone from floating. A single mid-blur shadow reads as a grey smudge at
# carousel size and does neither job.
THEMES = {
    # The shipping look. On white the ground cannot separate itself from the
    # app (every screen in Revely is paper, 4% off white), so the shadow does
    # the whole job and has to be genuinely dark to manage it.
    'white': dict(ground=(0xFF,0xFF,0xFF), head=(0x16,0x13,0x0F), sub=(0x5C,0x55,0x4A),
                  edge=(0xD5,0xCB,0xB8),
                  shadows=[(0, 52, 44), (26, 28, 60), (10, 12, 80)]),
    # Paper laid on board. Same hue family as the app, three stops down.
    'clay':  dict(ground=(0x9C,0x8F,0x79), head=(0x16,0x13,0x0F), sub=(0x2E,0x28,0x1F),
                  edge=(0xF6,0xF1,0xE7),
                  shadows=[(28, 46, 72)]),
    # The inversion: the app is ink on paper, the store page is paper on ink.
    # No shadow -- a shadow on a dark ground is invisible; the hairline defines
    # the silhouette instead.
    'ink':   dict(ground=(0x2A,0x23,0x1A), head=(0xF6,0xF1,0xE7), sub=(0xB8,0xAD,0x99),
                  edge=(0xF6,0xF1,0xE7),
                  shadows=[]),
}

# Order is a conversion decision, not a narrative one. The first three are
# what the App Store shows in search results without a tap, and drop-off past
# them is steady, so the run is strongest to weakest.
#
# Two constraints shape this particular run. The first three must each carry
# an ink-wash illustration: a plate that is nothing but a screenshot of text
# is unreadable at search-result size, where the image is the only thing that
# survives. And the verdict plate is held back to last -- it is the app's
# actual payoff, but it is the densest plate in the set (a bilingual
# ingredient list that turns to grey mush in a thumbnail) and the only one
# that opens on alarm red, which reads as a warning rather than an invitation
# to someone who has not yet been told what the app is for. It closes the
# carousel instead, where anyone who has swiped that far is already sold and
# the colour makes it the plate they remember.
#
# Of the seven, five carry illustrations; decode and verdict do not.
PLATES = [
 # The mechanic, and the differentiator, in one image: a hand holding a phone
 # up to a pouch. Shows what you DO with the app, and opens on an invitation.
 ('02-begin.png',    'Any label. Any language.',
                     'Point the camera. We read it and translate it.'),
 # Three bare nouns with no verb -- but the illustration underneath is a milk
 # jug, butter and cheese, so the image lands the headline the words do not.
 # That is exactly what a search-result thumbnail needs.
 ('07-aliases.png',  'Whey. Casein. Lactose.',
                     'One ingredient wears a dozen names. We know them all.'),
 # Closes the triple with the personalisation promise, which is what makes
 # every other plate mean something. Wheat, peanut and scallop shell.
 ('05-allergens.png','Tell us once what to watch for.',
                     'Allergies, conditions, and the diets you keep to.'),
 # First plate past the fold, so it takes the general-population health angle:
 # traffic lights and plain-English additive copy, no allergy framing.
 ('03-decode.png',   'Additives, in plain English.',
                     'What it is, who looked at it, and what they found.'),
 # Widens the audience to parents and carers.
 ('04-who.png',      'For you, and anyone you shop for.',
                     'A profile each. Switch, and the scan is rechecked.'),
 # A competitive counter-argument rather than a benefit, and the most
 # text-dense of the illustrated plates.
 ('08-barcode.png',  'We read the label, not the barcode.',
                     'The pack in your hand, not a database from 2019.'),
 # The payoff, saved for the end. See the note above on why it is not first.
 ('01-verdict.png',  'One word, and the reason under it.',
                     'Checked against your list, not a generic score.'),
]

def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def build(src, head, sub, path, th):
    c = Image.new('RGB', (W, H), th['ground'])
    d = ImageDraw.Draw(c)
    fh = ImageFont.truetype(SEMI, 86)
    fs = ImageFont.truetype(REG, 46)
    M  = 96

    # The device is pinned, not flowed. Headlines here run to one line or two,
    # and letting the type push the phone down meant every plate framed the
    # device at a slightly different size and height. In a carousel you see
    # that as a wobble. So the type block hangs from a fixed baseline and the
    # phone occupies the same rectangle on all seven.
    BASE = 560           # the type block's bottom edge
    TOP  = BASE + 96     # the device's top edge, identical on every plate

    hl = wrap(d, head, fh, W - 2*M)
    sl = wrap(d, sub,  fs, W - 2*M)
    y  = BASE - (len(sl)*62) - 18 - (len(hl)*104)
    for ln in hl:
        d.text((M, y), ln, font=fh, fill=th['head']); y += 104
    y += 18
    for ln in sl:
        d.text((M, y), ln, font=fs, fill=th['sub']); y += 62

    shot = Image.open(f'{SHOTS}/{src}').convert('RGB')
    top  = TOP
    availh = H - top - 70
    availw = W - 2*M
    s = min(availw/shot.width, availh/shot.height)
    nw, nh = int(shot.width*s), int(shot.height*s)
    shot = shot.resize((nw, nh), Image.LANCZOS)

    r = int(nw * 0.055)
    x = (W - nw)//2

    # A shadow, so the device is an object sitting ON the ground rather than a
    # rectangle cut into it. This is what actually separates screen from page;
    # the ground colour alone never will, because every screen is light.
    for dy, blur, alpha in th['shadows']:
        pad = int(blur * 2.5) + abs(dy)
        sh = Image.new('L', (nw + 2*pad, nh + 2*pad), 0)
        ImageDraw.Draw(sh).rounded_rectangle(
            [pad, pad + dy, pad + nw, pad + nh + dy], radius=r, fill=alpha)
        sh = sh.filter(ImageFilter.GaussianBlur(blur))
        c.paste(Image.new('RGB', sh.size, (0x16,0x13,0x0F)), (x - pad, top - pad), sh)

    mask = Image.new('L', (nw, nh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, nw-1, nh-1], radius=r, fill=255)
    c.paste(shot, (x, top), mask)

    # A hairline that is actually visible against THIS ground.
    ImageDraw.Draw(c).rounded_rectangle([x, top, x+nw-1, top+nh-1], radius=r,
                                        outline=th['edge'], width=2)
    c.save(path, 'PNG')
    return path

if __name__ == '__main__':
    name = sys.argv[1]
    out  = f'{ROOT}/out-{name}'
    os.makedirs(out, exist_ok=True)
    for i, (src, head, sub) in enumerate(PLATES, 1):
        p = build(src, head, sub, f'{out}/{i:02d}.png', THEMES[name])
        print(os.path.basename(p), Image.open(p).size)
