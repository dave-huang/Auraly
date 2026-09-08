import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { RiskMark } from '@/components/risk-mark';
import { ThemedText } from '@/components/themed-text';
import { Font, Radius, Space, Type, useSurface } from '@/constants/design';
import { LANGUAGE_CODES, useTranslation } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/reduced-motion';
import type { RiskLevel } from '@/lib/types';

/**
 * The opening loop: a foreign label turning into your language, over and over.
 *
 * The first onboarding screen used to carry a still drawing of an empty
 * basket, which is pleasant and says nothing. This says the entire product in
 * about three seconds and without a word of copy: four printed names in a
 * language you do not read, each one becoming a name you do, each one picking
 * up a green or amber mark as it lands.
 *
 * WHY FRENCH AND NOT JAPANESE. The proposal this came from used a Japanese
 * snack packet, which is the better story and the wrong typography: IBM Plex
 * Mono carries no kana or kanji, so every line would silently fall back to a
 * system face and the one block on screen that is meant to look photographed
 * would look like a rendering bug instead. French is foreign to all three of
 * our display languages, it is on half the shelves in a European supermarket,
 * and the mono face actually has the glyphs.
 *
 * WHY IT LOOPS, WHEN THE SCAN LINE DOES NOT. The design's rule is that a
 * repeating scan line reads as "still trying", and it holds — on the progress
 * screen, where somebody is waiting for an answer. Nobody is waiting here. And
 * this is not a scan line: there is no travelling aperture, only unresolved
 * becoming resolved, which is the same language ResolveIn speaks on the
 * results list.
 *
 * WORST FIRST, which is the order a real result list uses. This is somebody's
 * first sight of the thing the app produces, and teaching them to read it
 * top-down for the worst news is worth more than a pleasing gradient. It also
 * puts the red mark on the row that resolves first.
 *
 * THE PAIRS ARE REAL. Érythrosine (E127) is Red 3, which the FDA revoked for
 * use in food in January 2025. Anhydride sulfureux is sulphur dioxide, a
 * genuine moderate and the sulphite that sets off asthma. Sirop de glucose and
 * lécithine de soja carry no concern and are green because they are green. A
 * teaching animation that invented its own chemistry would be the wrong first
 * impression for an app whose entire claim is that it quotes people.
 */

/** One full cycle: the four rows resolving, a beat to read them, then back. */
const RESOLVE_MS = 1500;
const HOLD_MS = 1600;
const RESET_MS = 420;
/** A beat on the untranslated pack, so the loop has a visible starting point. */
const PAUSE_MS = 420;

/** Where each row's own crossfade sits inside the 0..1 progress value. */
const ROW_OFFSET = 0.18;
const ROW_SPAN = 0.32;

interface Line {
  /** As printed on the pack. Constant: this side is the foreign one. */
  printed: string;
  /** What we turn it into, in whichever language the app is set to. */
  key: 'teach.loopRed3' | 'teach.loopSulphite' | 'teach.loopGlucose' | 'teach.loopLecithin';
  level: RiskLevel;
}

const LINES: Line[] = [
  { printed: 'Érythrosine (E127)', key: 'teach.loopRed3', level: 'high' },
  { printed: 'Anhydride sulfureux', key: 'teach.loopSulphite', level: 'moderate' },
  { printed: 'Sirop de glucose', key: 'teach.loopGlucose', level: 'low' },
  { printed: 'Lécithine de soja', key: 'teach.loopLecithin', level: 'low' },
];

export function DecodeLoop() {
  const { t, language } = useTranslation();
  const surface = useSurface();
  const reduced = useReducedMotion();

  // 0 is the pack as printed, 1 is the pack as read. One value drives all four
  // rows, so they cannot drift out of step with each other.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    // Holds are written as timings to the value the sequence is already on,
    // not as withDelay. Nesting withDelay inside a repeating sequence stalls
    // the loop after its first pass, and the caret in ScanProgress already
    // takes this shape for the same reason.
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: RESOLVE_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        withTiming(1, { duration: HOLD_MS, easing: Easing.linear }),
        withTiming(0, { duration: RESET_MS, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: PAUSE_MS, easing: Easing.linear }),
      ),
      -1,
      false,
    );
  }, [reduced, progress]);

  return (
    <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
      {/* The same eyebrow the real verdict card uses, with the same shape of
          language pair, so the thing being promised here is recognisably the
          thing that arrives later. */}
      <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
        {t('verdict.readFromLabel')} · FR→{LANGUAGE_CODES[language]}
      </ThemedText>

      {LINES.map((line, index) => (
        <LoopRow key={line.printed} line={line} index={index} progress={progress} />
      ))}
    </View>
  );
}

function LoopRow({
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

  const start = index * ROW_OFFSET;

  // Each worklet reads `progress.value` ITSELF rather than calling a shared
  // helper that reads it. Reanimated works out what a style depends on by
  // looking for shared-value reads in the worklet's own body; hide the read
  // one call deep and the plugin finds nothing to subscribe to, so the style
  // is computed once at mount and never again. It renders, it just never
  // moves, which is a maddening thing to debug and worth the repetition here.
  // A HANDOFF, NOT A CROSS-DISSOLVE.
  //
  // Both halves fading through each other at once looked like a rendering
  // fault on the device: two strings of different lengths, each at half ink,
  // occupying the same line and interleaving their letters. So the first half
  // of the row's span empties the French out, and the second half brings the
  // translation in. There is a moment with neither, which is exactly right —
  // it is the beat where the app is doing the work.
  const printedStyle = useAnimatedStyle(() => {
    const raw = (progress.value - start) / ROW_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const out = f * 2 > 1 ? 1 : f * 2;
    return { opacity: 1 - out };
  });
  const readStyle = useAnimatedStyle(() => {
    const raw = (progress.value - start) / ROW_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const inn = f * 2 - 1;
    return { opacity: inn < 0 ? 0 : inn };
  });
  const markStyle = useAnimatedStyle(() => {
    const raw = (progress.value - start) / ROW_SPAN;
    const f = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    // Arrives with the translation, not with the gap before it: the mark is a
    // verdict on a name, so it should not appear next to nothing.
    const inn = f * 2 - 1;
    const g = inn < 0 ? 0 : inn;
    return { opacity: g, transform: [{ scale: 0.6 + 0.4 * g }] };
  });

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.mark, markStyle]}>
        <RiskMark level={line.level} />
      </Animated.View>

      {/* Both names occupy one slot, stacked. The row has a fixed height so
          the card never changes size mid-cycle, which would make the whole
          screen twitch four times a loop. */}
      <View style={styles.slot}>
        <Animated.View style={[styles.stacked, printedStyle]}>
          <ThemedText style={[styles.printed, { color: surface.inkFaint }]} numberOfLines={1}>
            {line.printed}
          </ThemedText>
        </Animated.View>
        <Animated.View style={[styles.stacked, readStyle]}>
          <ThemedText style={[styles.read, { color: surface.ink }]} numberOfLines={1}>
            {t(line.key)}
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
}

const ROW_HEIGHT = 22;

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, height: ROW_HEIGHT },
  mark: { width: 12, alignItems: 'center' },
  slot: { flex: 1, height: ROW_HEIGHT, justifyContent: 'center' },
  stacked: { position: 'absolute', left: 0, right: 0 },
  // Mono for the printed side, the way the results card sets a transcription:
  // this half is quoted off a packet.
  printed: { fontFamily: Font.mono, fontSize: 13, lineHeight: 20 },
  // Sans for our side, because that half is us talking.
  read: { fontFamily: Font.sansMedium, fontSize: 14, lineHeight: 20 },
});
