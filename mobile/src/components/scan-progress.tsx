import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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
// So the line now travels for as long as the frame is up. While the label is
// being read, the status text walks a short script on a 1.5-second clock,
// because reading is one long model call with nothing to report partway:
//
//   Reading the label…
//   Translating into plain English…
//
// Once reading is done the status follows the work itself, since from there
// the work reports its own progress:
//
//   Checking each ingredient…              rows are being ticked off
//   Checking against your safety shield…   every row is back
//
// Each line is true when it is shown, and none of them carries a number: a
// line used to report the ingredients found, and it disagreed with the
// results list. See READING_SCRIPT below.
//
// THE LEDGER. The label's ingredients sit on the frame as a checklist. A row
// arrives faint beside an empty square: found, not yet checked. When the
// server's analysis of that ingredient returns, the row comes up to full ink,
// a check draws into the square, and the mark's four corner brackets catch
// the row for a moment. Rows are ticked in the order the work finished, not
// the order printed, because that is the order it happened in: ingredients
// the cache already knows come back in a burst, and unusual ones take longer.
// Ticking top to bottom would be a performance of progress rather than a
// report of it.
//
// No row carries a colour, before or after its check. A row's own risk is not
// the verdict (milk is harmless until it meets a milk allergy), and a green
// row under an Avoid card is the honest-signal bug this design has been
// bitten by before. Checked means checked. The verdict is where colour lives.
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
const READING_SCRIPT: readonly TranslationKey[] = [
  'scan.reading',
  'scan.translating',
];

/** How faint a row is while it is found but not yet checked. */
const PENDING_OPACITY = 0.42;
/** Rows that tick together ripple rather than land as one block. */
const CHECK_RIPPLE_MS = 40;
const CHECK_RIPPLE_CAP = 6;
/** How long the corner brackets hold on a row as it is checked. */
const CATCH_HOLD_MS = 260;

export function ScanProgress({
  imageUri,
  backdrop,
  phase,
  ingredients,
  ingredientsOriginal,
  checked,
  allChecked,
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
  /** Names whose analysis has returned, in the order they finished. */
  checked?: string[];
  /** The whole analysis is back, so every row is checked. */
  allChecked?: boolean;
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
      () => setBeat((n) => (n >= READING_SCRIPT.length ? n : n + 1)),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, []);

  // The script's last line is where it rests.
  const step = Math.min(beat, READING_SCRIPT.length - 1);

  // Which rows are checked, and in what order they finished: each row's
  // position in `checked`, then any rows ticked only because the whole
  // analysis came back, in label order.
  const finishOrder = useMemo(() => {
    const order = new Map<number, number>();
    const rows = (ingredients ?? []).map((n) => n.toLowerCase());
    for (const name of checked ?? []) {
      const lower = name.toLowerCase();
      rows.forEach((row, i) => {
        if (row === lower && !order.has(i)) order.set(i, order.size);
      });
    }
    if (allChecked) rows.forEach((_, i) => { if (!order.has(i)) order.set(i, order.size); });
    return order;
  }, [ingredients, checked, allChecked]);

  const rowCount = ingredients?.length ?? 0;
  const checkedCount = finishOrder.size;
  const everyRowChecked = rowCount > 0 && checkedCount === rowCount;

  // A burst of rows checked in one poll fans out rather than landing as one
  // block. A row's place in the ripple is its finish position counted from
  // where the previous burst ended, tracked by adjusting state during render
  // when the count moves, which is React's own pattern for "what changed".
  const [ripple, setRipple] = useState({ count: 0, base: 0 });
  if (ripple.count !== checkedCount) setRipple({ count: checkedCount, base: ripple.count });
  const checkDelayFor = (i: number) =>
    Math.min(Math.max((finishOrder.get(i) ?? 0) - ripple.base, 0), CHECK_RIPPLE_CAP) * CHECK_RIPPLE_MS;

  // Elapsed time is its own signal, and it outranks the script's last line.
  // A line that has not moved in twelve seconds reads as a hang whether or
  // not it is one.
  //
  // Stores WHICH moment ran long, rather than a boolean plus a reset. A new
  // phase, or another row checked, is fresh evidence of progress and should
  // clear the message, and comparing against the current moment does that
  // for free, with no synchronous setState in the effect to cascade a render.
  const moment = `${phase}:${checkedCount}`;
  const [longWaitMoment, setLongWaitMoment] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLongWaitMoment(moment), STILL_WORKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [moment]);

  const longWait = longWaitMoment === moment;

  const workingKey: TranslationKey =
    phase === 'reading'
      ? READING_SCRIPT[step]
      : rowCount > 0 && !everyRowChecked
        ? 'scan.checkingEach'
        : 'scan.checking';
  const status = longWait ? t('scan.stillWorking') : t(workingKey);

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : null}
      {backdrop ? <View style={StyleSheet.absoluteFill}>{backdrop}</View> : null}
      <View style={[styles.scrim, ingredients?.length ? styles.scrimDeep : null]} />

      {!reduced ? <Animated.View style={[styles.sweepLine, sweepStyle]} /> : null}

      {/* The label, as read, as a checklist. Rows arrive in the order the
          label prints them and are ticked in the order the work finishes.
          See THE LEDGER above. */}
      {ingredients?.length ? (
        <ScrollView
          style={styles.readList}
          contentContainerStyle={styles.readListContent}
          showsVerticalScrollIndicator={false}
        >
          {ingredients.map((name, i) => {
            const original = ingredientsOriginal?.[i];
            // Keyed by name and which occurrence of it this is, NOT by
            // position. While the label is read the list streams top-level
            // names only; when reading finishes the full list lands with
            // sub-ingredients inserted under their parents. Keyed by
            // position, every row below an insertion remounted and faded in
            // a second time. Keyed by name, they stay put and only the
            // inserted rows arrive.
            const occurrence = ingredients.slice(0, i).filter((n) => n === name).length;
            const showOriginal = original && original.toLowerCase() !== name.toLowerCase();
            return (
              <LedgerRow
                key={`${name}#${occurrence}`}
                index={i}
                name={name}
                original={showOriginal ? original : undefined}
                checked={finishOrder.has(i)}
                checkDelay={checkDelayFor(i)}
                reduced={reduced}
                checkedLabel={t('scan.rowChecked')}
              />
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

/**
 * One line of the ledger. Faint beside an empty square until its analysis is
 * back, then full ink, a check drawn in, and the corner brackets catching it.
 *
 * The brackets are the Aperture's own corners, the mark doing what it depicts:
 * the reticle closes on the thing it has just finished looking at. They hold
 * for a beat and go. A row stays caught only for the moment of the check,
 * because a permanent bracket is a permanent mask (see aperture-reveal).
 */
function LedgerRow({
  index,
  name,
  original,
  checked,
  checkDelay,
  reduced,
  checkedLabel,
}: {
  index: number;
  name: string;
  original?: string;
  checked: boolean;
  checkDelay: number;
  reduced: boolean;
  checkedLabel: string;
}) {
  // Arrival: up from nothing to PENDING, lifted a few points, staggered by
  // position when a list lands at once. Checked: PENDING to full ink.
  const arrive = useSharedValue(reduced ? 1 : 0);
  const done = useSharedValue(checked ? 1 : 0);
  const tick = useSharedValue(checked ? 1 : 0);
  const caught = useSharedValue(0);
  // The check plays once. Later renders can hand this row a different ripple
  // delay, and replaying the catch on a row already ticked would read as a
  // second, different event.
  const ticked = useRef(checked);

  useEffect(() => {
    if (reduced) return;
    arrive.value = withDelay(
      Math.min(index, 12) * 34,
      withTiming(1, { duration: 260, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, [reduced, index, arrive]);

  useEffect(() => {
    if (!checked) return;
    const firstTick = !ticked.current;
    ticked.current = true;
    if (reduced || !firstTick) {
      done.value = 1;
      tick.value = 1;
      return;
    }
    done.value = withDelay(checkDelay, withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    tick.value = withDelay(checkDelay, withSpring(1, { damping: 11, stiffness: 260, mass: 0.6 }));
    caught.value = withDelay(
      checkDelay,
      withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(1, { duration: CATCH_HOLD_MS }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [checked, reduced, checkDelay, done, tick, caught]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: arrive.value * (PENDING_OPACITY + (1 - PENDING_OPACITY) * done.value),
    transform: [{ translateY: (1 - arrive.value) * 6 }],
  }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity: tick.value > 0.01 ? 1 : 0,
    transform: [{ rotate: '45deg' }, { scale: tick.value }],
  }));
  const catchStyle = useAnimatedStyle(() => ({ opacity: caught.value }));

  return (
    <Animated.View
      style={[styles.readRow, rowStyle]}
      accessible
      accessibilityLabel={checked ? `${name}, ${checkedLabel}` : name}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, catchStyle]}>
        <View style={[styles.catch, styles.catchTL]} />
        <View style={[styles.catch, styles.catchTR]} />
        <View style={[styles.catch, styles.catchBL]} />
        <View style={[styles.catch, styles.catchBR]} />
      </Animated.View>
      <View style={styles.box}>
        <Animated.View style={[styles.tick, tickStyle]} />
      </View>
      <View style={styles.readText}>
        <ThemedText style={styles.readName}>{name}</ThemedText>
        {original ? <ThemedText style={styles.readOriginal}>{original}</ThemedText> : null}
      </View>
    </Animated.View>
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
  // Padded sideways and pulled back by the same amount, so the corner
  // brackets have room to sit outside the text without shifting the column.
  readRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    paddingVertical: Space.xs + 2,
    paddingHorizontal: Space.sm,
    marginHorizontal: -Space.sm,
  },
  readText: { flex: 1 },
  // Square, like everything else in this system. Sits on the name's first
  // line, whatever the original beneath it wraps to.
  box: {
    width: 11,
    height: 11,
    marginTop: 5,
    borderWidth: 1.2,
    borderColor: 'rgba(246,241,231,0.7)',
  },
  // A check drawn as two sides of a rotated rectangle, so no icon font and no
  // SVG: a short stroke and a long one, meeting at the bottom corner.
  tick: {
    position: 'absolute',
    left: 2.6,
    top: -1.5,
    width: 4,
    height: 8,
    borderRightWidth: 1.6,
    borderBottomWidth: 1.6,
    borderColor: '#F6F1E7',
  },
  catch: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderColor: '#F6F1E7',
  },
  catchTL: { left: 0, top: 0, borderLeftWidth: 1.5, borderTopWidth: 1.5 },
  catchTR: { right: 0, top: 0, borderRightWidth: 1.5, borderTopWidth: 1.5 },
  catchBL: { left: 0, bottom: 0, borderLeftWidth: 1.5, borderBottomWidth: 1.5 },
  catchBR: { right: 0, bottom: 0, borderRightWidth: 1.5, borderBottomWidth: 1.5 },
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
