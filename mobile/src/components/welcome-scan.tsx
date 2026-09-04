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
 * A Spanish snack packet sits on the page with the thing this app is actually
 * pointed at printed on it: a real ingredient list, one dense unbroken run of
 * commas, the way it is set on the back of a bag. The app's own reticle drifts
 * down onto it and settles, a read passes over the label, the whole list turns
 * over into the reader's language, and three rows arrive underneath naming
 * what in it is worth knowing about. Then it goes back and does it again.
 *
 * WHY THE PACKET IS A PARAGRAPH AND NOT A TIDY LIST.
 *
 * It was three neat rows first, and three neat rows is not what a label looks
 * like. The unreadability IS the product's premise — a wall of set-solid type
 * in a language you do not have, with two things in it that matter — and a
 * cleanly stacked list quietly concedes the argument before the animation
 * starts. So the printed side is a paragraph, and the tidy rows are what the
 * app hands back.
 *
 * WHY SPANISH.
 *
 * Foreign to two of our three display languages, on half the shelves in the
 * United States, and the same pairing the example scan already uses. It also
 * fixes a typographic problem: everything quoted off a label in this app is
 * set in IBM Plex Mono, and that face carries no kana — DecodeLoop is in
 * French for exactly this reason. Spanish needs nothing the face lacks.
 *
 * WHAT A SPANISH READER SEES. Nothing turns over, because there is nothing to
 * turn: the label is already in their language. The paragraph holds and the
 * three rows still arrive, which is the honest version of what the app does
 * for them. See LABEL_LANGUAGE.
 *
 * THE PAIRS ARE REAL, as they are everywhere else in this flow. Rojo 3 is Red
 * 3, which the FDA pulled from food in January 2025. Sulfito de sodio is a
 * genuine moderate and the sulphite that sets off asthma. Ácido cítrico is
 * fine. Inventing chemistry to make a nicer animation would be the wrong first
 * impression for an app whose whole claim is that it quotes people.
 */

/** One cycle. The brief said three seconds; the tail is the reset. */
const CYCLE_MS = 3400;

// Phases, as fractions of the cycle. The master value runs linearly across the
// whole thing and each phase eases itself, which keeps the timeline readable
// here rather than buried in a nested sequence.
const LENS_IN_END = 0.16;
const SWEEP_START = 0.16;
const SWEEP_END = 0.34;
const READ_START = 0.28;
const READ_SPAN = 0.18;
const ROWS_START = 0.4;
const ROW_STAGGER = 0.05;
const ROW_SPAN = 0.1;
const OUT_START = 0.88;

/**
 * The language the packet is printed in.
 *
 * Read to decide whether the paragraph turns over at all. Somebody using the
 * app in Spanish would otherwise watch one Spanish sentence cross-fade into
 * very nearly the same Spanish sentence, which reads as a rendering fault
 * rather than as a translation.
 */
const LABEL_LANGUAGE = 'es';

/**
 * As printed on the pack, and deliberately not in the catalogue: this half is
 * the label somebody cannot read, so translating it deletes the point.
 *
 * Composed rather than transcribed. It is a plausible bag of crisps and not
 * anybody's actual product, because putting a real manufacturer's declared
 * ingredients on our welcome screen is a trademark problem and a factual claim
 * we would then owe them.
 */
const PRINTED_NAME = 'Papas Onduladas · Sabor Queso';
const PRINTED =
  'INGREDIENTES: Papas, Aceite Vegetal, Sal, Maltodextrina de Maíz, ' +
  'Suero de Leche, Cebolla en Polvo, Ácido Cítrico, Glutamato Monosódico, ' +
  'Colorante Artificial [Rojo 3], Sulfito de Sodio, Saborizante Natural.';

interface Line {
  name: 'welcome.scanColour' | 'welcome.scanSulphite' | 'welcome.scanCitric';
  what: 'welcome.scanColourWhat' | 'welcome.scanSulphiteWhat' | 'welcome.scanCitricWhat';
  level: RiskLevel;
}

// Worst first, the way a real result is ordered. Somebody seeing this before
// they have ever opened the app is learning where to look on the screen that
// matters.
const LINES: Line[] = [
  { name: 'welcome.scanColour', what: 'welcome.scanColourWhat', level: 'high' },
  { name: 'welcome.scanSulphite', what: 'welcome.scanSulphiteWhat', level: 'moderate' },
  { name: 'welcome.scanCitric', what: 'welcome.scanCitricWhat', level: 'low' },
];

export function WelcomeScan() {
  const { t, language } = useTranslation();
  const surface = useSurface();
  const reduced = useReducedMotion();

  // 0 is the untouched pack, 1 is the end of the cycle — which returns to the
  // untouched pack, so the repeat's snap back to 0 is invisible.
  const progress = useSharedValue(0);

  // Captured as a plain number so the worklets can multiply by it. A worklet
  // may close over an ordinary value; it may only *subscribe* to shared ones.
  const turns = language === LABEL_LANGUAGE ? 0 : 1;

  useEffect(() => {
    if (reduced) {
      // Parked mid-hold: reticle seated, label read, rows in. The still frame
      // says the same thing the loop does, which is the point of the still.
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

  // A HANDOFF, NOT A CROSS-DISSOLVE. The printed list empties out over the
  // first half of the read and the translation arrives over the second. Two
  // paragraphs of different lengths at half ink on the same lines interleave
  // their letters and look like a rendering fault; the beat with neither is
  // the app doing the work.
  const printedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = (p - READ_START) / READ_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const gone = f * 2 > 1 ? 1 : f * 2;
    const outRaw = (p - OUT_START) / (1 - OUT_START);
    const o = outRaw < 0 ? 0 : outRaw > 1 ? 1 : outRaw;
    const back = o * 2 - 1 < 0 ? 0 : o * 2 - 1;
    return { opacity: 1 - turns * gone * (1 - back) };
  });

  const readStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = (p - READ_START) / READ_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const inn = f * 2 - 1;
    const g = inn < 0 ? 0 : inn;
    const outRaw = (p - OUT_START) / (1 - OUT_START);
    const o = outRaw < 0 ? 0 : outRaw > 1 ? 1 : outRaw;
    const back = o * 2 > 1 ? 1 : o * 2;
    return { opacity: turns * g * (1 - back) };
  });

  return (
    <View style={styles.stage}>
      {/* The packet, and the frame around it. The verdict rows below are
          deliberately OUTSIDE both: the camera is looking at the object, and
          what the app has to say about it is not part of the object. */}
      <View style={styles.framed}>
        <View style={styles.packet}>
          <ThemedText style={styles.packetName}>{PRINTED_NAME}</ThemedText>
          <View style={styles.packetRule} />

          {/* Both languages share one slot of fixed height, so the packet
              never changes size mid-cycle and the whole screen never twitches.
              Six lines, and both sides clamped to it: a label that runs past
              the end of the pack is what labels do. */}
          <View style={styles.slot}>
            <Animated.View style={[styles.stacked, printedStyle]}>
              <ThemedText style={styles.printed} numberOfLines={SLOT_LINES}>
                {PRINTED}
              </ThemedText>
            </Animated.View>
            <Animated.View style={[styles.stacked, readStyle]}>
              <ThemedText style={styles.read} numberOfLines={SLOT_LINES}>
                {t('welcome.scanRead')}
              </ThemedText>
            </Animated.View>
          </View>

          {/* Inside the packet and clipped to it, so the read passes over the
              label rather than across the screen. */}
          <Animated.View
            style={[styles.sweep, { backgroundColor: surface.ink }, sweepStyle]}
            pointerEvents="none"
          />
        </View>

        {/* Four detached brackets, never a closed box: it frames without
            fencing, which is the same reason the viewfinder draws it this
            way. Screen-aligned while the packet under it sits a degree off
            square, because one of them is the camera and the other is an
            object on a table. */}
        <Animated.View style={[styles.reticle, reticleStyle]} pointerEvents="none">
          <View style={[styles.bracket, styles.tl, { borderColor: surface.ink }]} />
          <View style={[styles.bracket, styles.tr, { borderColor: surface.ink }]} />
          <View style={[styles.bracket, styles.bl, { borderColor: surface.ink }]} />
          <View style={[styles.bracket, styles.br, { borderColor: surface.ink }]} />
        </Animated.View>
      </View>

      <View style={styles.findings}>
        {LINES.map((line, index) => (
          <FindingRow key={line.name} line={line} index={index} progress={progress} />
        ))}
      </View>
    </View>
  );
}

function FindingRow({
  line,
  index,
  progress,
}: {
  line: Line;
  index: number;
  progress: SharedValue<number>;
}) {
  const { t } = useTranslation();
  const surface = useSurface();

  const start = ROWS_START + index * ROW_STAGGER;

  // Every worklet below reads `progress.value` in its OWN body. Reanimated
  // finds a style's dependencies by looking for shared-value reads in the
  // worklet itself; move the read one call deep into a helper and it
  // subscribes to nothing, so the style computes once at mount and never
  // again. It renders, it simply never moves.
  const rowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const raw = (p - start) / ROW_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const outRaw = (p - OUT_START) / (1 - OUT_START);
    const o = outRaw < 0 ? 0 : outRaw > 1 ? 1 : outRaw;
    const shown = f * (1 - o);
    // Rises the short distance the results sheet does, so the two moves are
    // recognisably the same move.
    return { opacity: shown, transform: [{ translateY: 10 * (1 - shown) }] };
  });

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <View style={styles.mark}>
        <RiskMark level={line.level} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={[styles.rowName, { color: surface.ink }]} numberOfLines={1}>
          {t(line.name)}
        </ThemedText>
        <ThemedText style={[styles.rowWhat, { color: surface.inkMuted }]} numberOfLines={2}>
          {t(line.what)}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

/** Lines of the ingredient run the pack has room for. Both languages clamp here. */
const SLOT_LINES = 6;
const SLOT_LINE_HEIGHT = 17;
const SLOT_HEIGHT = SLOT_LINES * SLOT_LINE_HEIGHT;
/** How far the read travels: the packet's inner height, near enough. */
const SWEEP_TRAVEL = 150;
const BRACKET = 26;
const BRACKET_STROKE = 2;

const styles = StyleSheet.create({
  // ONLY THE PACKET IS IN FLOW, which is what makes the composition hold.
  //
  // The findings are absent for the first half of every cycle, and while they
  // were laid out below the packet they still took their height — so the hero
  // centred on packet-plus-nothing and the packet floated in the top half with
  // a hole under it for two seconds out of three. Taking the rows out of flow
  // anchors the centre on the object being looked at, which is the right
  // anchor anyway: the packet is the subject, the rows are what we say about
  // it. They hang into space the hero already had.
  stage: { width: '100%', maxWidth: 320, alignItems: 'stretch' },
  // Holds the packet and its reticle together, so the brackets can be pinned
  // to the packet's own edges rather than guessed against the screen.
  framed: { alignSelf: 'stretch' },

  // Fixed paper ink, not the theme's: this is an object being photographed,
  // and a packet that changes colour with the app is not an object.
  packet: {
    backgroundColor: Paper.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22,19,15,0.14)',
    borderRadius: Radius.flat,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    gap: Space.sm,
    overflow: 'hidden',
    // A packet on a table is never square to the frame. One degree is enough
    // to read as a thing rather than as a dialog — the example scan's label is
    // set at the same angle for the same reason.
    transform: [{ rotate: '-1.2deg' }],
  },
  packetName: { fontFamily: Font.display, fontSize: 15, lineHeight: 21, color: '#16130F' },
  packetRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(22,19,15,0.24)' },

  slot: { height: SLOT_HEIGHT },
  stacked: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Mono for both halves: this is a transcription either way, and mono is what
  // this app sets quoted label text in. Set solid, with no list formatting,
  // because that is how it is printed on the bag.
  printed: {
    fontFamily: Font.mono,
    fontSize: 11,
    lineHeight: SLOT_LINE_HEIGHT,
    color: 'rgba(22,19,15,0.78)',
  },
  read: { fontFamily: Font.mono, fontSize: 11, lineHeight: SLOT_LINE_HEIGHT, color: '#16130F' },

  sweep: { position: 'absolute', left: 0, right: 0, top: 0, height: 1.5, opacity: 0 },

  // Sits OUTSIDE the packet by Space.md on every side, so the brackets frame
  // the object rather than sitting on its edges.
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

  // On the page rather than on the packet, and so in the theme's ink: this
  // half is the app talking.
  //
  // Space.xl of clearance because the reticle's bottom brackets already hang
  // Space.md below the packet, and a row tucked under a bracket reads as part
  // of the frame. The block is kept short on purpose: out of flow it can
  // overrun the footer, and 4.5in is the shortest screen this has to sit on.
  findings: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    paddingTop: Space.xl,
    gap: Space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  // Nudged onto the first line of type rather than the top of the block, the
  // same offset the decode card uses.
  mark: { width: 12, alignItems: 'center', paddingTop: 5 },
  rowText: { flex: 1, gap: 1 },
  rowName: { fontFamily: Font.sansMedium, fontSize: 14, lineHeight: 19 },
  rowWhat: { fontFamily: Font.sans, fontSize: 12, lineHeight: 16 },
});
