import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ResolveIn } from '@/components/aperture-reveal';
import { ThemedText } from '@/components/themed-text';
import { Font, Motion, Space } from '@/constants/design';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/reduced-motion';

// The frozen frame: the photo held behind a scan line, while the label is read
// and the verdict is worked out.
//
// TWO THINGS MOVE, AND BOTH OF THEM USED TO STOP.
//
// The line swept the frame exactly once and then held still, and the status
// text usually changed at most once. That was a deliberate rule — a looping
// scanner was held to read as "still trying" — and the rule was answering the
// wrong complaint. A model call can run ten seconds or more, and for nine of
// them the screen was a motionless photograph with one unchanged line of mono
// type on it, which does not read as confidence. It reads as a hang.
//
// So the line now travels for as long as the frame is up, and the status text
// walks a written script on a 1.5-second clock:
//
//   Reading the label…
//   Translating into plain English…
//   Checking against your safety shield…
//
// Each line is true when it is shown, and none of them claims a stage has
// FINISHED. None of them carries a number either: a fourth line used to
// report the ingredients found, and it is gone. See SCRIPT below.
//
// The script runs on a clock rather than on the pipeline's own two phases
// because the phases are the problem. OCR can take five seconds by itself, and
// a status line pinned to it sits unchanged for all five.
//
// The photo is CONTAINED, not cropped to fill. A library photo is rarely the
// screen's aspect ratio, so filling the frame cut the top and bottom off the
// label — and the reader had no way to tell whether the ingredients that fell
// outside the screen were being read. They always were: prepareImage() only
// scales the image to 1600px wide, and the picker takes no crop. Showing the
// whole photo makes the screen agree with what was actually sent.
//
// Deliberately NOT a determinate progress bar. Neither OCR nor model latency
// can be estimated per label, so any percentage would be invented — and a bar
// that stalls at 80% and jumps reads as broken, which is worse than an
// honest indeterminate state.

/** How long each line of the script holds before the next one takes over. */
const STEP_MS = 1500;

/** How long a phase may run before the copy admits the wait is unusual. */
const STILL_WORKING_AFTER_MS = 12_000;

/**
 * The written script, in order.
 *
 * It used to end on a count: "Found 14 ingredients…". That number counted the
 * label's printed entries, while the results screen lists every ingredient
 * analysed, sub-ingredients included, so a bracketed label promised 3 and then
 * showed 5 rows. Both numbers were right and the pair read as a bug.
 *
 * Saying nothing is better than saying two true things that appear to
 * disagree. The progress line describes what is happening; the results screen
 * is where counting belongs, beside the list being counted.
 */
const SCRIPT: readonly TranslationKey[] = [
  'scan.reading',
  'scan.translating',
  'scan.checking',
];

export function ScanProgress({
  imageUri,
  backdrop,
  phase,
  ingredients,
  ingredientsOriginal,
}: {
  imageUri?: string;
  /** Anything to sweep over instead of a photo. The onboarding example passes
   *  the label as type, because there is no photograph of a label that does
   *  not exist — and a rendered list is more legible under the sweep than a
   *  stock photo would be. */
  backdrop?: ReactNode;
  phase: 'reading' | 'analyzing';
  /**
   * The label's ingredients, once the reader has them, which is about fifteen
   * seconds before the first verdict. Shown as they are: no levels, no
   * colours, nothing claimed about them yet. The reading is finished and this
   * is what it found, which is the one honest thing to put on screen while the
   * analysis runs.
   */
  ingredients?: string[];
  /** The label's own words, shown under the English where they differ. */
  ingredientsOriginal?: string[];
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sweep.value = 0;
    // Down and back, for as long as the frame is up.
    //
    // `reverse`, not a two-step sequence. A repeating withSequence is the
    // obvious way to write this and it is the one that has bitten this
    // codebase before, so the shape that cannot stall is the one used here —
    // and it costs nothing, because the return is now the same speed as the
    // pass anyway. The easing is applied per leg, so the line eases out of
    // each end rather than snapping round.
    sweep.value = withRepeat(
      withTiming(1, { duration: Motion.sweep.ms, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      true,
    );
  }, [reduced, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * height }],
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

  // THE CLOCK, AND ONLY THE CLOCK.
  //
  // The timer never restarts, and stops itself at the last step, where React
  // drops the identical state and stops re-rendering.
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setBeat((n) => (n >= SCRIPT.length ? n : n + 1)),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, []);

  // The script's last line is where it rests.
  const step = Math.min(beat, SCRIPT.length - 1);

  // Elapsed time is its own signal, and it outranks the script's last line.
  // The script parks on "Checking against your safety shield…", and a line
  // that has not moved in twelve seconds reads as a hang whether or not it
  // is one.
  //
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

  const status = longWait ? t('scan.stillWorking') : t(SCRIPT[step]);

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : null}
      {backdrop ? <View style={StyleSheet.absoluteFill}>{backdrop}</View> : null}
      <View style={[styles.scrim, ingredients?.length ? styles.scrimDeep : null]} />

      {!reduced ? <Animated.View style={[styles.sweepLine, sweepStyle]} /> : null}

      {/* The label, as read, while the verdicts are still being worked out.
          Rows arrive staggered, in the order the label prints them, and carry
          no dot and no level: nothing here has been judged yet, and colouring
          a row before it has been would be the app guessing out loud. */}
      {ingredients?.length ? (
        <ScrollView
          style={styles.readList}
          contentContainerStyle={styles.readListContent}
          showsVerticalScrollIndicator={false}
        >
          {ingredients.map((name, i) => {
            const original = ingredientsOriginal?.[i];
            const showOriginal = original && original.toLowerCase() !== name.toLowerCase();
            return (
              <ResolveIn key={`${name}-${i}`} index={i}>
                <View style={styles.readRow}>
                  <ThemedText style={styles.readName}>{name}</ThemedText>
                  {showOriginal ? (
                    <ThemedText style={styles.readOriginal}>{original}</ThemedText>
                  ) : null}
                </View>
              </ResolveIn>
            );
          })}
        </ScrollView>
      ) : null}

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
  // Once the list is up, the photo is context rather than the subject, and
  // sixteen-point type over a lit supermarket label needs the ground quieter
  // than a single status line did.
  scrimDeep: { backgroundColor: 'rgba(22,19,15,0.82)' },
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
  // Sits above the status chip and below the top of the frame. The photo
  // stays visible behind it: the list is what was read OFF that picture, and
  // covering the picture entirely would break the connection.
  readList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: Space.xxl * 2,
    bottom: Space.xxl * 3.5,
  },
  readListContent: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xl,
  },
  readRow: {
    paddingVertical: Space.xs,
  },
  readName: {
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 22,
    color: '#F6F1E7',
  },
  readOriginal: {
    fontFamily: Font.mono,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(246,241,231,0.62)',
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
