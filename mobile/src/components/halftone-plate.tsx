import { Image } from 'expo-image';
import { StyleSheet, useColorScheme, type ImageStyle, type StyleProp } from 'react-native';

import { useSurface } from '@/constants/design';

// A halftone plate, sitting behind content.
//
// WHAT THESE ARE
//
// Photographs screened down to a dot pattern, with a contour line drawn over
// the screen — a halftone alone carries TONE, not FORM, and without the
// contour the subject fragments into grey mush the moment it is scaled down.
// They are the same trick a newspaper used to print a photograph, which is why
// they belong in a system built out of paper and ink and nothing else.
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
// there is no colour in the file to leak.
//
// HOW LOUD
//
// Measured on both grounds: 6% is a rumour, 10% is right for a plate behind
// live text, 16% is the ceiling before it starts competing with the words. The
// default is 10 and the exceptions should be arguments, not preferences.
//
// By lamplight it is dialled back. The two grounds are numerically symmetric —
// the same distance between ink and paper either way — but light ink on a dark
// ground blooms and reads louder than the arithmetic says, so the same number
// that is a whisper on paper is a presence at night.
//
// Decorative by definition, so it is hidden from assistive technology and
// takes no touches — a screen reader announcing "image" over a texture is
// noise, and a plate that swallowed a tap would be a bug.

export const PLATES = {
  // The passport pillar: four packets, four writing systems. Belongs wherever
  // the promise is "a label you cannot read".
  packets: require('@/assets/images/halftone/packets.png'),
  // Loose almonds and sesame in raking light. Scatter, so it fills a page that
  // has nothing on it without pretending to be content.
  almonds: require('@/assets/images/halftone/almonds.png'),
  // A single split pod, shot like a specimen plate. Vertical, and quiet enough
  // to sit under a first impression.
  vanillaPod: require('@/assets/images/halftone/vanilla-pod.png'),
} as const;

export type PlateName = keyof typeof PLATES;

/** See "how loud" above. Measured, not guessed at. */
const DARK_SCALE = 0.8;

export function HalftonePlate({
  name,
  opacity = 0.1,
  style,
  contentFit = 'cover',
}: {
  name: PlateName;
  opacity?: number;
  /** Where it sits. Defaults to filling its parent. */
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
}) {
  const surface = useSurface();
  const dark = useColorScheme() === 'dark';

  return (
    <Image
      source={PLATES[name]}
      style={[StyleSheet.absoluteFill, style, { opacity: dark ? opacity * DARK_SCALE : opacity }]}
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
