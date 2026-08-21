import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Font } from '@/constants/design';
import { ThemedText } from '@/components/themed-text';

/**
 * The Aperture — Revely's mark.
 *
 * Four detached corner brackets (the scan reticle) over two text bars (a label
 * caught in the frame). It says "read", not "healthy"; the leaf went with the
 * old name. Geometry is transcribed from `assets/images/revely-mark.svg`, which
 * remains the source of truth for exported rasters.
 *
 * Drawn from Views rather than SVG on purpose: the mark is four L-shapes and
 * two rectangles, so it needs no renderer, and the app carries no svg
 * dependency for it.
 *
 * Two optical sizes, not one scaled shape — strokes thicken as the mark
 * shrinks. At and above 44pt it is the full two-bar mark at the 100-grid
 * weights; below that the second bar drops and the strokes go heavier, or the
 * whole thing turns to mush at icon sizes.
 */

// Both variants share an outer bracket edge at 11.5% and a top bar spanning
// 27%–73%, so the mark keeps its silhouette across the size break.
const LARGE = { bracket: 25, stroke: 5, bar: 6, barTop: 41, secondBarTop: 55, barWidth: 46, shortBarWidth: 32 };
const SMALL = { bracket: 29, stroke: 9, bar: 10, barTop: 45, barWidth: 46 };

export const APERTURE_BAR_BREAK = 44;

export function ApertureMark({
  size = 24,
  color,
  style,
}: {
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const u = size / 100;
  const twoBars = size >= APERTURE_BAR_BREAK;
  const g = twoBars ? LARGE : SMALL;

  const arm: ViewStyle = {
    position: 'absolute',
    width: g.bracket * u,
    height: g.bracket * u,
    borderColor: color,
  };
  const w = g.stroke * u;
  const edge = 11.5 * u;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View style={[arm, { top: edge, left: edge, borderTopWidth: w, borderLeftWidth: w }]} />
      <View style={[arm, { top: edge, right: edge, borderTopWidth: w, borderRightWidth: w }]} />
      <View style={[arm, { bottom: edge, right: edge, borderBottomWidth: w, borderRightWidth: w }]} />
      <View style={[arm, { bottom: edge, left: edge, borderBottomWidth: w, borderLeftWidth: w }]} />

      <View
        style={{
          position: 'absolute',
          left: 27 * u,
          top: g.barTop * u,
          width: g.barWidth * u,
          height: g.bar * u,
          backgroundColor: color,
        }}
      />
      {twoBars ? (
        <View
          style={{
            position: 'absolute',
            left: 27 * u,
            top: LARGE.secondBarTop * u,
            width: LARGE.shortBarWidth * u,
            height: LARGE.bar * u,
            backgroundColor: color,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Mark plus wordmark, horizontal.
 *
 * The wordmark is Instrument Sans 600 at −0.02em, never Newsreader — the serif
 * belongs to verdicts alone. Lockup gap is 0.42× the cap height, and cap height
 * for Instrument Sans runs about 0.72 of the font size.
 */
export function RevelyLockup({
  size = 22,
  color,
  markSize,
  style,
}: {
  size?: number;
  color: string;
  markSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const cap = size * 0.72;
  const mark = markSize ?? Math.round(size * 1.15);

  return (
    <View style={[styles.lockup, { gap: cap * 0.42 }, style]}>
      <ApertureMark size={mark} color={color} />
      <ThemedText
        style={{
          fontFamily: Font.sansSemi,
          fontSize: size,
          // lineHeight must clear fontSize or React Native shears the glyphs.
          lineHeight: size * 1.25,
          letterSpacing: size * -0.02,
          color,
        }}
      >
        Revely
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center' },
});
