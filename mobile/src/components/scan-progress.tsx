import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Font, Motion, Space } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/reduced-motion';

// The frozen frame. On capture the photo freezes full-bleed and a scan line
// sweeps it exactly ONCE — the design is explicit that a looping scanner
// reads as "still trying". When the sweep is done but analysis is still
// running, the frame simply holds with a mono status line, which is the
// honest signal that work continues without implying repeated attempts.
//
// That holding state used to be completely motionless: the sweep ended after
// 1.1s and the status text often never changed, so a wait of ten seconds or
// more was indistinguishable from a crash. Two things fix it without
// reintroducing a loop over the photo:
//
//   - a caret blinking after the status text — one small element, borrowing
//     the terminal idiom the mono line already speaks, so it says "alive"
//     rather than "scanning again"
//   - the text itself changing to "Still working…" once the wait gets long
//
// Deliberately NOT a determinate progress bar. Neither OCR nor model latency
// can be estimated per label, so any percentage would be invented — and a bar
// that stalls at 80% and jumps reads as broken, which is worse than an
// honest indeterminate state.

/** How long a phase may run before the copy admits the wait is unusual. */
const STILL_WORKING_AFTER_MS = 12_000;

export function ScanProgress({
  imageUri,
  phase,
  ingredientCount,
}: {
  imageUri?: string;
  phase: 'reading' | 'analyzing';
  ingredientCount?: number;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sweep.value = 0;
    sweep.value = withTiming(1, {
      duration: Motion.sweep.ms,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    // No repeat: the sweep is a single pass, by design.
  }, [reduced, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * height }],
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
  }));

  // The caret keeps blinking for as long as the frame is up. Unlike the sweep
  // it carries no claim about the work — it only says the app is still here.
  const caret = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    caret.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 40, easing: Easing.linear }),
        withTiming(0, { duration: 460, easing: Easing.linear }),
        withTiming(1, { duration: 40, easing: Easing.linear }),
        withTiming(1, { duration: 460, easing: Easing.linear }),
      ),
      -1,
      false,
    );
  }, [reduced, caret]);

  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  // Elapsed time is its own signal. The phase can legitimately sit on
  // 'analyzing' for a while, and a status line that has not moved in fifteen
  // seconds reads as a hang whether or not it is one.
  // Stores WHICH phase ran long, rather than a boolean plus a reset. Reaching
  // a new phase is fresh evidence of progress and should clear the message —
  // and comparing against the current phase does that for free, with no
  // synchronous setState in the effect to cascade a render.
  const [longWaitPhase, setLongWaitPhase] = useState<typeof phase | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLongWaitPhase(phase), STILL_WORKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const longWait = longWaitPhase === phase;

  const phaseStatus =
    phase === 'analyzing'
      ? ingredientCount
        ? t('scan.foundIngredients', { count: ingredientCount })
        : t('scan.analyzing')
      : t('scan.reading');

  // The count is the most informative thing we can say, so a long wait never
  // overwrites it — "Found 14 ingredients" outranks "Still working…".
  const keepPhaseText = phase === 'analyzing' && !!ingredientCount;
  const status = longWait && !keepPhaseText ? t('scan.stillWorking') : phaseStatus;

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={styles.scrim} />

      {!reduced ? <Animated.View style={[styles.sweepLine, sweepStyle]} /> : null}

      <View style={styles.statusWrap}>
        <View style={styles.statusRow}>
          <ThemedText style={styles.status}>{status}</ThemedText>
          {!reduced ? (
            <Animated.View style={[styles.caret, caretStyle]} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#16130F' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(22,19,15,0.55)' },
  sweepLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: '#F6F1E7',
    shadowColor: '#F6F1E7',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  statusWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Space.xxl * 2,
    alignItems: 'center',
  },
  // The chip moved from the text to the row so the caret sits inside it,
  // reading as part of the same status line rather than a stray mark.
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,19,15,0.72)',
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    overflow: 'hidden',
  },
  status: {
    fontFamily: Font.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#F6F1E7',
  },
  caret: {
    width: 6,
    height: 12,
    marginLeft: Space.sm,
    backgroundColor: '#F6F1E7',
  },
});
