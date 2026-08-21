import { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/design';
import { useReducedMotion } from '@/lib/reduced-motion';

/**
 * The verdict card rises into place over the frozen frame.
 *
 * Deliberately NOT a fade: the design's rule is that the spatial move is what
 * makes the card read as an object you could pick up rather than a screen
 * that changed. Opacity is only used to hide the pre-roll frame, never as the
 * entrance itself.
 *
 * With reduced motion the sheet is simply already seated.
 */
export function RisingSheet({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: Motion.rise.ms,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [reduced, progress]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * Motion.rise.dy }],
    opacity: progress.value === 0 ? 0 : 1,
    shadowOpacity: 0.18 * progress.value,
  }));

  return <Animated.View style={[styles.sheet, style, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#16130F',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
});
