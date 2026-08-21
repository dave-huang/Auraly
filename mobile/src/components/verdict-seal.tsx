import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Font, Motion, Radius } from '@/constants/design';
import { useReducedMotion } from '@/lib/reduced-motion';

/**
 * Double-ruled circle, mono caps, settling at −4°. Names the profile so a
 * screenshot carries the personalisation.
 *
 * This is the ONLY thing that animates after the card arrives — "one
 * flourish, not five". It stamps in after a 200ms delay so the verdict word
 * is read first; the word itself never animates.
 */
export function VerdictSeal({
  lines,
  color,
  size = 84,
  still,
}: {
  lines: [string, string];
  color: string;
  size?: number;
  /** Already stamped. History tiles carry seals too, and twenty of them
   *  landing at once turns one flourish into a fireworks display. */
  still?: boolean;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced || still ? 1 : 0);

  useEffect(() => {
    if (reduced || still) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      Motion.seal.delay,
      withTiming(1, { duration: Motion.seal.ms, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, [reduced, still, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      // Overshoots slightly larger, then settles — a stamp coming down.
      { scale: 1.5 - 0.5 * progress.value },
      { rotate: `${Motion.seal.rotate * progress.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.outer,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    >
      <Animated.View
        style={[styles.inner, { borderRadius: (size - 8) / 2, borderColor: color, paddingHorizontal: size * 0.1 }]}
      >
        {/* Text scales with the seal and never wraps. At tile sizes a fixed
            10pt broke "Caution" into "CAUTI / ON" — a verdict word split in
            half is the one thing a seal must not do. */}
        {lines.filter(Boolean).map((line, i) => (
          <ThemedText
            key={i}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.text,
              { color, fontSize: size * 0.145, lineHeight: size * 0.2 },
            ]}
          >
            {line}
          </ThemedText>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { borderWidth: 1.5, padding: 3 },
  inner: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  text: {
    fontFamily: Font.monoMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
