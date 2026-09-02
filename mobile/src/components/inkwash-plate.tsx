import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

import { useSurface } from '@/constants/design';

// An ink wash plate, sitting behind content.
//
// WHAT THESE ARE
//
// Brush studies — a naturalist's wash drawing of one object, the kind of thing
// pressed between the pages of a field guide. They replaced a set of halftone
// plates, which were photographs screened down to a dot pattern. Halftone is a
// printing artefact: the trick a newspaper used because it could not print
// grey. A wash is what somebody actually does with a brush when they are
// looking closely at a thing, which is nearer to what this app is for.
//
// WHY THEY CARRY NO COLOUR
//
// Each asset ships as coverage only — a transparent PNG whose alpha IS the
// ink, with the colour channels thrown away. The tint is applied here, from
// the live theme, which is what lets ONE file sit over cream in light mode and
// over near-black by lamplight. Shipping two baked versions would double the
// bundle and guarantee they drift.
//
// It is also the reason these can never become a brand colour by accident:
// there is no colour in the file to leak. The sources were warm, nearly sepia,
// and none of that survives the conversion.
//
// HOW LOUD, AND WHY IT IS PER PLATE
//
// The halftone component took an opacity at every call site and defaulted to
// 10%. That worked because screening spreads ink evenly, so every plate had
// roughly the same coverage and one number fitted them all.
//
// A wash does not spread. It puts real black in one place and leaves the rest
// of the sheet empty, so measured coverage across this set runs from 1.2% (the
// paper tag, mostly outline) to 7.6% (the basket, a dense weave) — six to one.
// At a single opacity the tag is invisible and the basket is shouting.
//
// So the number lives with the file, normalised against measured coverage, and
// no screen passes one. That is the right home for it: how loud a plate is
// belongs to how much ink is in it, not to the page it lands on. `opacity`
// stays available to override, but an override should be an argument.
//
// ON THE DARK GROUND
//
// The halftone plates were dialled to 0.8 by lamplight, because fine dots on a
// dark ground bloom and read louder than the arithmetic says. Washes do the
// opposite — large soft areas at low alpha lose contrast against near-black
// and read FAINTER. Measured on both grounds at the same numbers: no scaling.
//
// Decorative by definition, so it is hidden from assistive technology and
// takes no touches — a screen reader announcing "image" over a texture is
// noise, and a plate that swallowed a tap would be a bug.

interface Plate {
  source: ReturnType<typeof require>;
  /** Normalised against measured ink coverage. See "how loud" above. */
  opacity: number;
}

export const PLATES = {
  /** Three graduated bowls. A household, without depicting anybody in it. */
  bowls: { source: require('@/assets/images/inkwash/bowls.png'), opacity: 0.067 },
  /** A blank paper tag — the object that exists to carry a name. */
  tag: { source: require('@/assets/images/inkwash/tag.png'), opacity: 0.224 },
  /** Wheat, peanuts and a scallop shell, laid out for study. */
  allergens: { source: require('@/assets/images/inkwash/allergens.png'), opacity: 0.123 },
  /** A balance and its weights. The instrument for the judgement being asked. */
  balance: { source: require('@/assets/images/inkwash/balance.png'), opacity: 0.102 },
  /** Jug, butter, cheese: three things that look different and are one thing. */
  milk: { source: require('@/assets/images/inkwash/milk.png'), opacity: 0.111 },
  /** Herbs and pulses — what most dietary rules leave you eating. */
  dietary: { source: require('@/assets/images/inkwash/dietary.png'), opacity: 0.107 },
  /** Apothecary bottle and mortar. Not a hospital; this is not a diagnosis. */
  conditions: { source: require('@/assets/images/inkwash/conditions.png'), opacity: 0.076 },
  /** Bound reports, covers blank. The documents the verdicts quote. */
  sources: { source: require('@/assets/images/inkwash/sources.png'), opacity: 0.071 },
  /** A folded map: contour lines, no place names. Elsewhere, without words. */
  language: { source: require('@/assets/images/inkwash/language.png'), opacity: 0.155 },
  /** A sheet caught mid-fall — read, then dropped. Not a padlock. */
  privacy: { source: require('@/assets/images/inkwash/privacy.png'), opacity: 0.154 },
  /** A pressed sprig on a mounting card. The profile as a finished thing. */
  specimen: { source: require('@/assets/images/inkwash/specimen.png'), opacity: 0.115 },
  /** A split pod, the specimen plate. Quiet enough to sit under a first impression. */
  vanillaPod: { source: require('@/assets/images/inkwash/vanilla-pod.png'), opacity: 0.062 },
  /** Blank tins. The only landscape plate — it is clipped to a band. */
  packets: { source: require('@/assets/images/inkwash/packets.png'), opacity: 0.077 },
  /** An empty basket. Nothing scanned yet. */
  basket: { source: require('@/assets/images/inkwash/basket.png'), opacity: 0.056 },
} as const satisfies Record<string, Plate>;

export type PlateName = keyof typeof PLATES;

export function InkWashPlate({
  name,
  opacity,
  style,
  contentFit = 'cover',
}: {
  name: PlateName;
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
      style={[StyleSheet.absoluteFill, style, { opacity: opacity ?? plate.opacity }]}
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
