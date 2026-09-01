import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Motion, useSurface } from '@/constants/design';
import { useReducedMotion } from '@/lib/reduced-motion';

/**
 * The Reveal — the app's imagery language, expressed as a mechanic.
 *
 * An aperture travels once down a block of content. Ahead of it the content is
 * present but unresolved; inside it the content is full ink on a lifted
 * ground. It is the mark's own geometry — four detached corner brackets — doing
 * the thing the mark depicts, and it says what Revely does without a picture
 * of anything.
 *
 * CURIOSITY, NOT FEAR. The reveal invites a look. It never gates, never
 * obscures a verdict, and carries no colour of its own — the one saturated ink
 * on screen stays wherever the verdict put it.
 *
 * IT ALWAYS ENDS RESOLVED.
 *
 * This is the load-bearing rule. A permanent aperture is a permanent mask, and
 * a permanent mask makes real content unreadable for as long as it is on
 * screen — a beautiful poster and a broken interface. So the sweep is a
 * TRANSITION INTO CLARITY: it runs once, hands over to `settle`, and leaves
 * the block at full opacity with the brackets gone. Reduced motion skips
 * straight to that end state, which is why the resolved state has to be the
 * real one rather than a fallback.
 *
 * Children are rendered twice — once as the base layer, once inside the
 * window. Keep them presentational: this is the wrong wrapper for anything
 * that fetches, counts, or otherwise minds being mounted in duplicate. The
 * duplicate is hidden from assistive technology so the block is not announced
 * twice.
 */

/** How present the content is before the aperture reaches it. */
const UNRESOLVED_OPACITY = 0.24;

const BRACKET = 26;
const BRACKET_STROKE = 2;

/** One definition of the four brackets, so the frame and the reveal cannot drift apart. */
function Corners({ color }: { color: string }) {
  return (
    <>
      <View style={[styles.corner, styles.tl, { borderColor: color }]} />
      <View style={[styles.corner, styles.tr, { borderColor: color }]} />
      <View style={[styles.corner, styles.br, { borderColor: color }]} />
      <View style={[styles.corner, styles.bl, { borderColor: color }]} />
    </>
  );
}

/**
 * The aperture, standing still.
 *
 * Four corner brackets around a region, with no sweep and nothing to resolve.
 * It marks a place rather than performing on it — "this is where we looked",
 * or "this is where the first one goes".
 *
 * Deliberately a separate export from the reveal. Most places that want the
 * aperture want the FRAME, not the animation, and reaching for the animated one
 * everywhere is how a motif turns into a tic.
 */
export function ApertureFrame({
  children,
  style,
  color,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Defaults to the theme's ink; pass inkFaint for a waiting, unfilled slot. */
  color?: string;
}) {
  const surface = useSurface();
  const stroke = color ?? surface.ink;

  return (
    <View style={style}>
      {children}
      <Corners color={stroke} />
    </View>
  );
}

export function ApertureReveal({
  children,
  style,
  windowHeight = Motion.reveal.window,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Height of the travelling aperture. Defaults to the design's window. */
  windowHeight?: number;
}) {
  const surface = useSurface();
  const reduced = useReducedMotion();

  // Measured, not assumed: the sweep's distance is the content's own height,
  // so a card that grows with translated copy still reveals end to end.
  const [height, setHeight] = useState(0);

  const travel = useSharedValue(0);
  const settled = useSharedValue(0);

  useEffect(() => {
    if (reduced || height <= 0) {
      // The resolved state IS the content. Anyone who has asked the OS for
      // less motion gets it immediately rather than a lesser version of it.
      settled.value = 1;
      return;
    }
    travel.value = 0;
    settled.value = 0;
    travel.value = withTiming(
      1,
      { duration: Motion.reveal.ms, easing: Easing.bezier(0.16, 1, 0.3, 1) },
      (finished) => {
        'worklet';
        if (finished) {
          settled.value = withTiming(1, { duration: Motion.reveal.settle });
        }
      },
    );
  }, [reduced, height, travel, settled]);

  const distance = Math.max(0, height - windowHeight);

  const baseStyle = useAnimatedStyle(
    () => ({
      opacity: UNRESOLVED_OPACITY + (1 - UNRESOLVED_OPACITY) * settled.value,
    }),
    [],
  );

  const windowStyle = useAnimatedStyle(
    () => ({
      opacity: 1 - settled.value,
      transform: [{ translateY: travel.value * distance }],
    }),
    [distance],
  );

  // The inner copy moves opposite the window by exactly the same amount, so
  // the content appears to stand still while the aperture slides over it.
  const innerStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: -travel.value * distance }] }),
    [distance],
  );

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.height);
    setHeight((current) => (current === next ? current : next));
  }

  return (
    <View style={style} onLayout={onLayout}>
      <Animated.View style={baseStyle}>{children}</Animated.View>

      <Animated.View
        style={[
          styles.window,
          { height: windowHeight, backgroundColor: surface.lift },
          windowStyle,
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={innerStyle}>{children}</Animated.View>
        <Corners color={surface.ink} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
  },
  tl: { top: 0, left: 0, borderLeftWidth: BRACKET_STROKE, borderTopWidth: BRACKET_STROKE },
  tr: { top: 0, right: 0, borderRightWidth: BRACKET_STROKE, borderTopWidth: BRACKET_STROKE },
  br: { bottom: 0, right: 0, borderRightWidth: BRACKET_STROKE, borderBottomWidth: BRACKET_STROKE },
  bl: { bottom: 0, left: 0, borderLeftWidth: BRACKET_STROKE, borderBottomWidth: BRACKET_STROKE },
});

/**
 * The resolve, without the aperture.
 *
 * The same unresolved-to-clear move the reveal performs, applied down a list so
 * its items come into focus one after another. It is what the app is doing said
 * as motion — reading a label line by line — and it belongs on the ingredient
 * list, which is the densest and most-read thing in the product.
 *
 * No brackets here on purpose. An aperture over every row would be the motif
 * shouting; the language is unresolved becoming resolved, and the frame is only
 * one way of saying it.
 *
 * THE STAGGER IS CAPPED.
 *
 * A label with forty ingredients is completely normal, and an uncapped stagger
 * would take well over a second to finish — turning a flourish into a wait, on
 * the screen where somebody is trying to find out whether they can eat
 * something. After CAP items the remainder land together: the effect reads at
 * the top of the list, which is the only place it is looked at.
 *
 * Ends fully resolved, always, for the same reason the reveal does.
 */
const STAGGER_MS = 34;
const STAGGER_CAP = 12;
const RESOLVE_MS = 260;
const LIFT_PX = 6;

export function ResolveIn({
  index = 0,
  children,
  style,
}: {
  /** Position in the list. Delay is capped, so large values are safe. */
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const resolved = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      resolved.value = 1;
      return;
    }
    resolved.value = withDelay(
      Math.min(index, STAGGER_CAP) * STAGGER_MS,
      withTiming(1, { duration: RESOLVE_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, [reduced, index, resolved]);

  const animated = useAnimatedStyle(() => ({
    opacity: UNRESOLVED_OPACITY + (1 - UNRESOLVED_OPACITY) * resolved.value,
    transform: [{ translateY: (1 - resolved.value) * LIFT_PX }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
