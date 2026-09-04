import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { RiskMark } from '@/components/risk-mark';
import { ThemedText } from '@/components/themed-text';
import { Font, Paper, Radius, Space, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/reduced-motion';
import type { RiskLevel } from '@/lib/types';

/**
 * The welcome screen's argument, made in about three seconds and no copy.
 *
 * A Japanese snack packet sits on the page. The app's own reticle drifts down
 * onto it and settles, a read passes over the label, and three printed names
 * nobody in our three languages can parse become three names they can, each
 * landing with a mark that says whether it matters. Then it goes back and does
 * it again.
 *
 * WHY THE RETICLE AND NOT A DRAWING OF A PHONE.
 *
 * The brief said "a smartphone scanning a packet", and a phone bezel drawn
 * inside a phone screen is the one image guaranteed to look like clip art. The
 * reticle says the same sentence — something is looking at this — and it is
 * not an illustration of the product, it IS the product: four detached
 * brackets at 30pt with a 2pt stroke, the same geometry the viewfinder draws
 * over a live frame. Somebody who taps Get started meets it again ninety
 * seconds later, already knowing what it means.
 *
 * WHY THE JAPANESE IS NOT IN MONO.
 *
 * Everything quoted off a label in this app is set in IBM Plex Mono, and that
 * face carries no kana or kanji — DecodeLoop is in French for exactly this
 * reason. Here the packet is the brief, so the printed side takes the system
 * face instead and the packet itself does the work mono usually does: a card
 * of paper stock, a rule, a heading, tilted a degree off square. The resolved
 * side stays in our sans, because that half is us talking.
 *
 * THE PAIRS ARE REAL, as they are everywhere else in this flow. 赤色３号 is
 * Red 3, which the FDA pulled from food in January 2025. 亜硫酸塩 is sulphites,
 * a genuine moderate and the thing that sets off asthma. トコフェロール is
 * vitamin E, and is fine. Inventing chemistry to make a nicer animation would
 * be the wrong first impression for an app whose whole claim is that it
 * quotes people.
 */

/** One cycle. The brief said three seconds; the tail is the reset. */
const CYCLE_MS = 3200;

// Phases, as fractions of the cycle. The master value runs linearly across the
// whole thing and each phase eases itself, which keeps the timeline readable
// here rather than buried in a nested sequence.
const LENS_IN_END = 0.2;
const SWEEP_START = 0.2;
const SWEEP_END = 0.38;
const ROWS_START = 0.31;
const ROW_STAGGER = 0.07;
const ROW_SPAN = 0.17;
const OUT_START = 0.87;

interface Line {
  /** As printed on the pack. Constant: this side is the one you cannot read. */
  printed: string;
  name: 'welcome.scanColour' | 'welcome.scanSulphite' | 'welcome.scanTocopherol';
  what: 'welcome.scanColourWhat' | 'welcome.scanSulphiteWhat' | 'welcome.scanTocopherolWhat';
  level: RiskLevel;
}

// Worst first, the way a real result is ordered. Somebody seeing this before
// they have ever opened the app is learning where to look on the screen that
// matters.
const LINES: Line[] = [
  { printed: '赤色３号', name: 'welcome.scanColour', what: 'welcome.scanColourWhat', level: 'high' },
  { printed: '亜硫酸塩', name: 'welcome.scanSulphite', what: 'welcome.scanSulphiteWhat', level: 'moderate' },
  { printed: 'トコフェロール', name: 'welcome.scanTocopherol', what: 'welcome.scanTocopherolWhat', level: 'low' },
];

export function WelcomeScan() {
  const surface = useSurface();
  const reduced = useReducedMotion();

  // 0 is the untouched pack, 1 is the end of the cycle — which returns to the
  // untouched pack, so the repeat's snap back to 0 is invisible.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      // Parked mid-hold: reticle seated, label read. The still frame says the
      // same thing the loop does, which is the point of the still frame.
      progress.value = 0.75;
      return;
    }
    // A single linear timing, repeated. Not a sequence of eased segments: a
    // withDelay or a hold nested inside a repeating sequence stalls the loop
    // after one pass, which is documented the hard way in DecodeLoop.
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduced, progress]);

  // The reticle drops onto the packet and settles, then lifts again at the end.
  const reticleStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = p / LENS_IN_END;
    const inn = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    // Ease-out cubic, so it arrives the way a hand arrives: fast, then settling.
    const eased = 1 - Math.pow(1 - inn, 3);
    const outRaw = (p - OUT_START) / (1 - OUT_START);
    const out = outRaw < 0 ? 0 : outRaw > 1 ? 1 : outRaw;
    return {
      opacity: eased * (1 - out),
      transform: [
        { translateY: -26 * (1 - eased) - 12 * out },
        { scale: 1 + 0.09 * (1 - eased) },
      ],
    };
  });

  // The read itself: one line crossing the label once, not a shuttling scanner.
  // The design's rule is that a repeating sweep reads as "still trying".
  const sweepStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = (p - SWEEP_START) / (SWEEP_END - SWEEP_START);
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    // Full ink in the middle of the pass, nothing at either end.
    const fade = f <= 0 || f >= 1 ? 0 : 1 - Math.abs(f * 2 - 1);
    return { opacity: fade, transform: [{ translateY: SWEEP_TRAVEL * f }] };
  });

  return (
    <View style={styles.stage}>
      <View style={[styles.packet, { borderColor: 'rgba(22,19,15,0.14)' }]}>
        <ThemedText style={styles.packetName}>のりしお せんべい</ThemedText>
        <View style={styles.packetRule} />
        <ThemedText style={styles.packetEyebrow}>原材料名</ThemedText>

        {LINES.map((line, index) => (
          <ScanRow key={line.printed} line={line} index={index} progress={progress} />
        ))}

        {/* Inside the packet and clipped to it, so the read passes over the
            label rather than across the screen. */}
        <Animated.View
          style={[styles.sweep, { backgroundColor: surface.ink }, sweepStyle]}
          pointerEvents="none"
        />
      </View>

      {/* Four detached brackets, never a closed box: it frames without
          fencing, which is the same reason the viewfinder draws it this way. */}
      <Animated.View style={[styles.reticle, reticleStyle]} pointerEvents="none">
        <View style={[styles.bracket, styles.tl, { borderColor: surface.ink }]} />
        <View style={[styles.bracket, styles.tr, { borderColor: surface.ink }]} />
        <View style={[styles.bracket, styles.bl, { borderColor: surface.ink }]} />
        <View style={[styles.bracket, styles.br, { borderColor: surface.ink }]} />
      </Animated.View>
    </View>
  );
}

function ScanRow({
  line,
  index,
  progress,
}: {
  line: Line;
  index: number;
  progress: SharedValue<number>;
}) {
  const { t } = useTranslation();
  // No `useSurface` here on purpose: everything inside the packet is fixed
  // paper ink, because the packet is an object being looked at rather than a
  // piece of the app's chrome.
  const start = ROWS_START + index * ROW_STAGGER;

  // Every worklet below reads `progress.value` in its OWN body. Reanimated
  // finds a style's dependencies by looking for shared-value reads in the
  // worklet itself; move the read one call deep into a helper and it
  // subscribes to nothing, so the style computes once at mount and never
  // again. It renders, it simply never moves.
  //
  // A HANDOFF, NOT A CROSS-DISSOLVE: the printed name empties out over the
  // first half of the row's span and the reading arrives over the second. Two
  // strings of different lengths at half ink on one line interleave their
  // letters and look like a rendering fault. The beat with neither is the app
  // doing the work.
  const printedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = (p - start) / ROW_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const gone = f * 2 > 1 ? 1 : f * 2;
    // Back to the printed pack at the end of the cycle, so the loop closes —
    // and a handoff on the way back too, for the reason it is one on the way
    // out. The printed name only starts returning once the reading has fully
    // gone, so the two are never both half-inked on the same line.
    const outRaw = (p - OUT_START) / (1 - OUT_START);
    const o = outRaw < 0 ? 0 : outRaw > 1 ? 1 : outRaw;
    const back = o * 2 - 1 < 0 ? 0 : o * 2 - 1;
    return { opacity: (1 - gone) + gone * back };
  });

  const readStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = (p - start) / ROW_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const inn = f * 2 - 1;
    const g = inn < 0 ? 0 : inn;
    // Leaves over the FIRST half of the out window; the printed name arrives
    // over the second. See printedStyle.
    const outRaw = (p - OUT_START) / (1 - OUT_START);
    const o = outRaw < 0 ? 0 : outRaw > 1 ? 1 : outRaw;
    const back = o * 2 > 1 ? 1 : o * 2;
    return { opacity: g * (1 - back) };
  });

  const markStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = (p - start) / ROW_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const inn = f * 2 - 1;
    const g = inn < 0 ? 0 : inn;
    const outRaw = (p - OUT_START) / (1 - OUT_START);
    const o = outRaw < 0 ? 0 : outRaw > 1 ? 1 : outRaw;
    const back = o * 2 > 1 ? 1 : o * 2;
    // Arrives with the name rather than with the gap before it, and leaves
    // with it: a mark is a verdict on something, and it should never be on
    // screen next to nothing.
    const shown = g * (1 - back);
    return { opacity: shown, transform: [{ scale: 0.6 + 0.4 * shown }] };
  });

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.mark, markStyle]}>
        <RiskMark level={line.level} />
      </Animated.View>

      {/* Both states share one slot of fixed height, so the packet never
          changes size mid-cycle and the whole screen never twitches. */}
      <View style={styles.slot}>
        <Animated.View style={[styles.stacked, printedStyle]}>
          <ThemedText style={styles.printed} numberOfLines={1}>
            {line.printed}
          </ThemedText>
        </Animated.View>

        <Animated.View style={[styles.stacked, readStyle]}>
          <ThemedText style={styles.readName} numberOfLines={1}>
            {t(line.name)}
          </ThemedText>
          <ThemedText style={styles.readWhat} numberOfLines={2}>
            {t(line.what)}
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
}

/** Tall enough for the two-line reading, so the one-line printed name fits too. */
const ROW_HEIGHT = 46;
/** How far the read travels: the packet's inner height, near enough. */
const SWEEP_TRAVEL = 214;
const BRACKET = 26;
const BRACKET_STROKE = 2;

const styles = StyleSheet.create({
  stage: { width: '100%', maxWidth: 320, alignItems: 'stretch' },

  // Fixed paper ink, not the theme's: this is an object being photographed,
  // and a packet that changes colour with the app is not an object.
  packet: {
    backgroundColor: Paper.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    gap: Space.sm,
    overflow: 'hidden',
    // A packet on a table is never square to the frame. One degree is enough
    // to read as a thing rather than as a dialog — the demo label is set at
    // the same angle for the same reason.
    transform: [{ rotate: '-1.2deg' }],
  },
  // The system face, deliberately: Instrument Sans has no kana either, and a
  // named family that lacks the glyphs falls back silently and inconsistently.
  packetName: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: '#16130F' },
  packetRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(22,19,15,0.24)' },
  packetEyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, color: 'rgba(22,19,15,0.5)' },

  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, height: ROW_HEIGHT },
  mark: { width: 12, alignItems: 'center' },
  slot: { flex: 1, height: ROW_HEIGHT, justifyContent: 'center' },
  stacked: { position: 'absolute', left: 0, right: 0, gap: 1 },

  printed: { fontSize: 14, lineHeight: 20, color: 'rgba(22,19,15,0.62)' },
  readName: { fontFamily: Font.sansMedium, fontSize: 14, lineHeight: 19, color: '#16130F' },
  readWhat: { fontFamily: Font.sans, fontSize: 11, lineHeight: 15, color: 'rgba(22,19,15,0.6)' },

  sweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1.5,
    opacity: 0,
  },

  // Sits OUTSIDE the packet by Space.md on every side, so the brackets
  // frame the object rather than sitting on its edges.
  reticle: {
    position: 'absolute',
    top: -Space.md,
    left: -Space.md,
    right: -Space.md,
    bottom: -Space.md,
  },
  bracket: { position: 'absolute', width: BRACKET, height: BRACKET },
  tl: { top: 0, left: 0, borderTopWidth: BRACKET_STROKE, borderLeftWidth: BRACKET_STROKE },
  tr: { top: 0, right: 0, borderTopWidth: BRACKET_STROKE, borderRightWidth: BRACKET_STROKE },
  bl: { bottom: 0, left: 0, borderBottomWidth: BRACKET_STROKE, borderLeftWidth: BRACKET_STROKE },
  br: { bottom: 0, right: 0, borderBottomWidth: BRACKET_STROKE, borderRightWidth: BRACKET_STROKE },
});
