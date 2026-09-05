import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

import { useSurface } from '@/constants/design';

// An ink wash plate.
//
// WHAT THESE ARE
//
// Brush studies. A naturalist's wash drawing of one object, the kind of thing
// pressed between the pages of a field guide. They replaced a set of halftone
// plates, which were photographs screened down to a dot pattern. Halftone is a
// printing artefact: the trick a newspaper used because it could not print
// grey. A wash is what somebody actually does with a brush when they are
// looking closely at a thing, which is nearer to what this app is for.
//
// WHY THEY CARRY NO COLOUR
//
// Each asset ships as coverage only: a transparent PNG whose alpha IS the ink,
// with the colour channels thrown away. The tint is applied here, from the
// theme, which is what lets one file serve any ground the app ever paints.
//
// It is also the reason these can never become a brand colour by accident.
// There is no colour in the file to leak. The sources were warm, nearly sepia,
// and none of that survives the conversion.
//
// TWO PLACEMENTS, TWO STRENGTHS
//
// The first version of this had one number per plate and put every plate at
// full bleed, behind the whole screen. That is the wrong home for a drawing.
// Behind text it has to be faint enough to read through, and at that strength
// it is not an illustration any more, just a smudge. Worse, the parts worth
// looking at ended up under a title or under the button.
//
// So a plate now has two strengths and the caller says which job it is doing:
//
//   PLATE (the default) — the drawing sits in its own empty space, usually the
//   gap between the end of the content and the footer, and nothing is printed
//   over it. Because nothing has to be read through it, it can be dark enough
//   to actually look like a drawing.
//
//   WASH (`wash`) — genuinely behind content, holding a page together. Kept
//   faint on purpose, because the text on top of it has to win.
//
// HOW THE TWO NUMBERS WERE ARRIVED AT
//
// Not by eye, and not by one rule for all fourteen. Each file was measured on
// two things: its MEAN alpha over the whole canvas, which is how heavy the
// drawing feels, and the alpha of its darkest strokes, which is how black its
// darkest line will go. Those pull in opposite directions. A drawing can be
// mostly empty paper and still have one near-solid stroke in it.
//
// So each number is the smaller of two ceilings: enough opacity to bring the
// mean up to a target weight, and no more opacity than keeps the darkest
// stroke short of solid black. The plate target is a drawing you are meant to
// look at; the wash target is roughly a third of that, because text has to win.
//
// The measured means run from 1.2% (the paper tag, which is mostly outline) to
// 7.6% (the basket, a dense weave), six to one. That spread is why one number
// could never have fitted all fourteen, and it is also why most of these land
// near the top of the range: these are pale wash drawings, and the first
// version of this component was quietly holding them at a fifth of their
// strength.
//
// Decorative by definition, so it is hidden from assistive technology and
// takes no touches. A screen reader announcing "image" over a texture is
// noise, and a plate that swallowed a tap would be a bug.

interface Plate {
  source: ReturnType<typeof require>;
  /** In its own space, with nothing printed over it. */
  plate: number;
  /** Behind content that has to stay readable. */
  wash: number;
}

export const PLATES = {
  /**
   * A hand holding a phone at the back of a snack pouch. How to use the app,
   * shown rather than described.
   *
   * THE ONE PLATE WITH A PERSON IN IT, and the exception is deliberate: this
   * one exists to show a gesture, and no arrangement of objects performs a
   * gesture. It is a bare hand and nothing else — no face, no arm, no sleeve —
   * so it still never depicts whose child this is.
   *
   * The lettering on the pouch is abstract on purpose. The drawing came back
   * with invented words on it ("Nutrition Facst", "MAGAEINE VABES"), which is
   * the one thing on a picture a reader can catch us getting wrong and the
   * exact fault that retired the halftone packets plate. Every word legible at
   * the size this is delivered has been replaced with the dash runs the
   * drawing already used elsewhere.
   */
  scanning: { source: require('@/assets/images/inkwash/scanning.png'), plate: 1.00, wash: 0.40 },
  /** Three graduated bowls. A household, without depicting anybody in it. */
  bowls: { source: require('@/assets/images/inkwash/bowls.png'), plate: 0.90, wash: 0.30 },
  /** A blank paper tag: the object that exists to carry a name. */
  tag: { source: require('@/assets/images/inkwash/tag.png'), plate: 1.00, wash: 0.69 },
  /** Wheat, peanuts and a scallop shell, laid out for study. */
  allergens: { source: require('@/assets/images/inkwash/allergens.png'), plate: 1.00, wash: 0.49 },
  /** A balance and its weights. The instrument for the judgement being asked. */
  balance: { source: require('@/assets/images/inkwash/balance.png'), plate: 0.93, wash: 0.42 },
  /** Jug, butter, cheese: three things that look different and are one thing. */
  milk: { source: require('@/assets/images/inkwash/milk.png'), plate: 1.00, wash: 0.47 },
  /** Herbs and pulses, which is what most dietary rules leave you eating. */
  dietary: { source: require('@/assets/images/inkwash/dietary.png'), plate: 1.00, wash: 0.48 },
  /** Apothecary bottle and mortar. Not a hospital; this is not a diagnosis. */
  conditions: { source: require('@/assets/images/inkwash/conditions.png'), plate: 0.90, wash: 0.35 },
  /** Bound reports, covers blank. The documents the verdicts quote. */
  sources: { source: require('@/assets/images/inkwash/sources.png'), plate: 0.90, wash: 0.32 },
  /**
   * A desk globe in its meridian ring. Elsewhere, without words.
   *
   * It replaced a folded contour map, which drew the right idea and the wrong
   * object: a map is a place, and the question this screen asks is which
   * language to answer in. Its numbers are not the map's — a globe is a much
   * denser drawing, and inheriting 1.00/0.80 would have landed it at nearly
   * twice the weight of anything else in the set.
   */
  language: { source: require('@/assets/images/inkwash/language.png'), plate: 0.83, wash: 0.31 },
  /** A sheet caught mid-fall, read and then dropped. Not a padlock. */
  privacy: { source: require('@/assets/images/inkwash/privacy.png'), plate: 1.00, wash: 0.51 },
  /** A pressed sprig on a mounting card. The profile as a finished thing. */
  specimen: { source: require('@/assets/images/inkwash/specimen.png'), plate: 1.00, wash: 0.45 },
  /** A split pod. Looking closely at what a thing is actually made of. */
  // Currently unplaced: welcome used to carry it, and welcome is now the mark
  // and two doors with no artwork at all. Kept because the plate itself is
  // good and the next screen that needs one will want a portrait.
  vanillaPod: { source: require('@/assets/images/inkwash/vanilla-pod.png'), plate: 0.80, wash: 0.27 },
  /** Blank tins. Every product on the shelf, before you know anything about it. */
  packets: { source: require('@/assets/images/inkwash/packets.png'), plate: 0.95, wash: 0.36 },
  /** An empty basket. Nothing scanned yet. */
  basket: { source: require('@/assets/images/inkwash/basket.png'), plate: 0.72, wash: 0.24 },
} as const satisfies Record<string, Plate>;

export type PlateName = keyof typeof PLATES;

export function InkWashPlate({
  name,
  wash = false,
  opacity,
  style,
  contentFit = 'contain',
}: {
  name: PlateName;
  /** Behind content that has to be read through it. Quieter, by design. */
  wash?: boolean;
  /** Override the plate's own measured value. Should be an argument, not a preference. */
  opacity?: number;
  /** Where it sits. Defaults to filling its parent. */
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}) {
  const surface = useSurface();
  const plate = PLATES[name];

  return (
    <Image
      source={plate.source}
      style={[
        StyleSheet.absoluteFill,
        style,
        { opacity: opacity ?? (wash ? plate.wash : plate.plate) },
      ]}
      contentFit={contentFit}
      // The alpha channel is the artwork; this is what colours it.
      tintColor={surface.ink}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Bundled and unchanging, so the transition is pure cost.
      transition={0}
    />
  );
}
