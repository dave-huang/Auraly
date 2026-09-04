import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Space, Type, useSurface } from '@/constants/design';
import { useReducedMotion } from '@/lib/reduced-motion';

/**
 * A ring that draws itself around one row, says why, and goes away.
 *
 * Used on the example scan and nowhere else. The first verdict card somebody
 * sees has thirty things on it and no way of knowing which one mattered; the
 * ring answers that once, on the row that actually set the verdict, and then
 * leaves the card looking exactly like every real one that follows.
 *
 * IT MUST END GONE. Same rule the aperture reveal lives under, for the same
 * reason: a highlight that stays is a permanent annotation on a card that is
 * meant to be read on its own terms, and the demo would stop being a preview
 * of the real screen and become a different screen. So the sequence is in,
 * hold, out, once, and the resting state is no ring at all.
 *
 * THE RING TAKES THE ROW'S OWN COLOUR, not red. The proposal this came from
 * said red, and red here would be a lie in the ordinary case: the row that
 * sets a Caution verdict is amber, and ringing it in red would put a colour on
 * the card that the verdict never assigned. The ring points at a mark, so it
 * agrees with the mark.
 */

// THE HOLD IS LONG ON PURPOSE, and it was three seconds until the simulator
// showed why that was wrong. The ring is on the ingredient list, and the
// ingredient list starts below the fold: the card seats at the verdict, and
// somebody reads the word, the reason and the seal before they ever scroll far
// enough to see the row being pointed at. A three second window had closed
// before the teaching could be seen, which is the worst of both worlds — the
// work of an animation and none of the benefit.
//
// Ten seconds covers reading the top of the card and scrolling down. It costs
// nothing to be generous here because the whole thing removes itself when it
// is done, so a long hold cannot become clutter.
/** Long enough for the list's own stagger to finish before anything is rung. */
const IN_DELAY = 1400;
const IN_MS = 420;
const HOLD_MS = 9000;
const OUT_MS = 520;

export function TeachRing({
  tone,
  caption,
  children,
}: {
  /** The ink of the mark this ring is pointing at. */
  tone: string;
  caption: string;
  children: React.ReactNode;
}) {
  const surface = useSurface();
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);
  // Fading the caption to zero is not enough: an invisible caption still takes
  // up a line, and the card was left with a permanent empty band under its
  // first row. So the wrapper takes itself out of the tree once it is done,
  // and the card goes back to being exactly the card a real scan draws.
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduced) {
      // Not "skip to the end state" this time, because the end state is
      // nothing. Reduced motion gets the caption without the animation: the
      // teaching still happens, it just does not move, and it stays.
      shown.value = 1;
      return;
    }
    // Waits and holds are timings to the value already held, not withDelay.
    // Same reason as DecodeLoop: withDelay nested inside a sequence is where
    // these animations go to die.
    shown.value = withSequence(
      withTiming(0, { duration: IN_DELAY, easing: Easing.linear }),
      withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: HOLD_MS, easing: Easing.linear }),
      withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        'worklet';
        if (finished) runOnJS(setDone)(true);
      }),
    );
  }, [reduced, shown]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    // Rises the last few points as it arrives, so it reads as arriving rather
    // than as having been there all along, unnoticed.
    transform: [{ translateY: (1 - shown.value) * 4 }],
  }));

  // AFTER the hooks, never before them. An early return above useAnimatedStyle
  // changes how many hooks this component calls between renders, which React
  // reports as "Rendered fewer hooks than expected" and which is a red screen
  // rather than a subtle bug. The animation is finished by the time this is
  // true, so there is nothing left for those hooks to drive.
  if (done) return <>{children}</>;

  return (
    <View>
      <View>
        {children}
        {/* Over the row, not around it: an absolutely positioned border cannot
            change the row's height, so nothing below it moves when the ring
            arrives or leaves. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: tone }, ringStyle]}
        />
      </View>
      <Animated.View style={captionStyle}>
        <ThemedText style={[Type.meta, styles.caption, { color: surface.inkMuted }]}>
          {caption}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    left: -Space.sm,
    right: -Space.sm,
    top: -2,
    bottom: 2,
    borderWidth: 2,
  },
  caption: { paddingTop: Space.sm, paddingBottom: Space.xs },
});
