import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AnalysisView } from '@/components/analysis-view';
import { RisingSheet } from '@/components/rising-sheet';
import { ScanProgress } from '@/components/scan-progress';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Paper, Radius, Space } from '@/constants/design';
import { fetchDemoScan, type DemoScan } from '@/lib/demo';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/reduced-motion';

// The example scan, shown once, between onboarding and the paywall.
//
// WHY IT IS A SCREEN AND NOT A FLAG ON /results
//
// Threading an `isDemo` boolean through the results screen would put a branch
// in the one place in this app that must never lie, and would make "is this
// verdict real?" a question you answer by reading code. Here the answer is the
// route: /results is always a scan of something the person photographed, and
// /demo is always the example. The card itself is the same component, because
// showing a different card would defeat the point.
//
// WHAT IS REAL
//
// The label is a fixture. The verdict is not — it comes back from the same
// matcher, run against the profile they finished building thirty seconds ago.
// So the allergens it finds are genuinely in that list, and a profile the
// label does not touch gets a clean verdict rather than a manufactured scare.
// The screen says all of this in one line rather than making anyone infer it.
//
// WHY IT EXISTS AT ALL
//
// FREE_SCAN_GRANT is 0. Without this screen the app's order of events is: ask
// a stranger for their child's allergies, then ask them for money, having
// never once done the thing it is for.

/**
 * The frame drawn around the example packet.
 *
 * Deliberately the viewfinder's own numbers, scaled to a card rather than a
 * screen: 2pt strokes, detached corners, never a closed box. Somebody who has
 * just watched this meets the same shape over their own camera a tap later.
 */
const RETICLE = { bracket: 26, stroke: 2, gap: Space.md };

/** How much of the card to leave above the list once it is scrolled to. */
const LIST_HEADROOM = 96;
/** After the sheet has risen, before the teaching ring is drawn on the list. */
const RISE_SETTLE_MS = 620;

/**
 * When the way out appears, measured from the card landing.
 *
 * Late enough that it does not race the sheet rising or the screen scrolling
 * itself down to the list, early enough that nobody has time to wonder whether
 * this screen has an exit. It then stays for good; a control that comes and
 * goes is worse than one that was never there.
 */
const FOOTER_IN_MS = 800;

/** Height of that footer, which the scroll has to be able to clear. */
const FOOTER_CLEARANCE = 80;

/**
 * The lens finding the packet, before anything is read.
 *
 * A demo that opens mid-sweep skips the part of the real experience that
 * people are actually unsure about: what am I supposed to point this at. So
 * the reticle arrives the way it does over a live frame — dropping in, a
 * little too large, and settling onto the label — and only then does the read
 * begin. Nothing is being scanned during it, which is exactly the point: this
 * is the beat where a person aims.
 */
const FRAME_MS = 900;

/**
 * Long enough for the scan to read as a scan.
 *
 * It used to be measured against the sweep's single round trip. The sweep now
 * loops for as long as the frame is up, so there is no round trip to wait for
 * and this is simply the beat the example holds: two lines of the status
 * script, which is as much of the wait as an onboarding screen should spend
 * imitating. A real scan runs long enough to reach all four.
 */
const FLOOR_MS = 2600;
/** When the reader "finishes" — cosmetic, and only ever inside the floor. */
const READ_MS = 1300;

export default function DemoScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  // No `useSurface` here: every colour on this screen is fixed chrome over a
  // dark stage, the way the viewfinder's is, rather than the theme's paper.
  const reduced = useReducedMotion();
  const [scan, setScan] = useState<DemoScan | null>(null);
  const [seated, setSeated] = useState(false);
  /** True until the reticle has settled. Nothing sweeps while it is. */
  const [aiming, setAiming] = useState(true);

  // Owned HERE rather than inside DemoLabel, and this is the whole reason the
  // reticle animation lives on a shared value at all: DemoLabel is rendered
  // bare while aiming and inside ScanProgress afterwards, so it remounts at
  // the handover. A value held by the parent survives that; one held by the
  // child would restart the drop-in halfway through the scan.
  const framing = useSharedValue(0);
  /** 0 while the card is still arriving, 1 once the way out is offered. */
  const footerIn = useSharedValue(0);
  const [phase, setPhase] = useState<'reading' | 'analyzing'>('reading');
  // Survives the unmount race: the fetch and two timers all resolve after the
  // person may already have tapped Skip.
  const alive = useRef(true);

  // SCROLLING THE LESSON INTO VIEW.
  //
  // The card seats at the verdict, and the ingredient list — the thing the
  // teaching ring points at — starts below the fold. Left alone, the ring
  // draws itself, waits, and disappears on a part of the screen nobody has
  // looked at yet. So once the card has risen, the screen scrolls down to the
  // list itself, and the ring arrives on something already in front of them.
  //
  // Both numbers are measured rather than assumed: the banner's height and
  // where the list starts inside the card both depend on how much text the
  // current language needed.
  const scroller = useRef<ScrollView>(null);
  const bannerHeight = useRef(0);
  const listOffset = useRef<number | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!seated) return;
    footerIn.value = reduced
      ? 1
      : withDelay(FOOTER_IN_MS, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
  }, [seated, reduced, footerIn]);

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerIn.value,
    transform: [{ translateY: 26 * (1 - footerIn.value) }],
  }));

  const revealList = useCallback(() => {
    if (scrolled.current || listOffset.current === null) return;
    scrolled.current = true;
    // Leaves the card's headline partly visible above the list, so the move
    // reads as scrolling down a card rather than as jumping to a new screen.
    const y = bannerHeight.current + Space.lg + listOffset.current - LIST_HEADROOM;
    scroller.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, []);

  // Onward, from every exit this screen has: Continue, Skip, and the network
  // failure. /trial names what a subscription includes and that nothing is
  // charged today, /reminder promises the warning before billing starts, and
  // then the paywall shows the price.
  function next() {
    router.replace('/trial');
  }

  useEffect(() => {
    alive.current = true;
    const started = Date.now();

    // With reduced motion there is no pre-roll to wait out: the reticle is
    // simply already on the packet. Expressed as a zero-length phase rather
    // than as a branch, so every timing below stays one expression and cannot
    // drift out of agreement with the others.
    const preroll = reduced ? 0 : FRAME_MS;

    framing.value = reduced
      ? 1
      : withTiming(1, {
          duration: FRAME_MS,
          // Arrives the way a hand arrives: quickly, then settling.
          easing: Easing.out(Easing.cubic),
        });

    const aimTimer = setTimeout(() => {
      if (alive.current) setAiming(false);
    }, preroll);

    const readTimer = setTimeout(() => {
      if (alive.current) setPhase('analyzing');
    }, preroll + READ_MS);

    let seatTimer: ReturnType<typeof setTimeout> | undefined;

    fetchDemoScan(language)
      .then((next) => {
        if (!alive.current) return;
        setScan(next);
        // Hold the frame for whatever is left of the floor. The fetch is a
        // fixture lookup and usually beats the animation, so without this the
        // sweep would be cut off mid-travel by its own result.
        seatTimer = setTimeout(
          () => {
            if (alive.current) setSeated(true);
          },
          Math.max(0, preroll + FLOOR_MS - (Date.now() - started)),
        );
      })
      .catch((error: any) => {
        // No network, no example. Degrade to the flow that existed before this
        // screen did rather than stranding someone on a frozen scan line.
        console.warn('[DEMO] could not build the example scan:', error?.message);
        if (alive.current) next();
      });

    return () => {
      alive.current = false;
      clearTimeout(aimTimer);
      clearTimeout(readTimer);
      if (seatTimer) clearTimeout(seatTimer);
    };
    // language is read once, at mount: switching it mid-animation would restart
    // the scan someone is already watching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!seated || !scan) {
    return (
      <View style={styles.root}>
        {/* Aiming first, then reading. ScanProgress sweeps the moment it
            mounts, so holding it back IS the pre-roll — there is no way to
            ask it to wait, and no reason it should have to know. */}
        {aiming ? (
          <DemoLabel scan={scan} framing={framing} />
        ) : (
          <ScanProgress
            phase={phase}
            ingredientCount={phase === 'analyzing' ? scan?.result.ingredients.length : undefined}
            backdrop={<DemoLabel scan={scan} framing={framing} />}
          />
        )}
        <SafeAreaView style={styles.safe} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="box-none">
            <Pressable onPress={next} hitSlop={12} style={styles.skip} accessibilityRole="button">
              <ThemedText style={styles.skipLabel}>{t('demo.skip')}</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <DemoLabel scan={scan} framing={framing} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <ScrollView
          ref={scroller}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Said plainly, above the card, before anyone reads a verdict off
              it. The card's own footer repeats it in small type, but the
              claim belongs here where it cannot be missed or cropped out. */}
          <View
            style={styles.banner}
            onLayout={(e) => {
              bannerHeight.current = e.nativeEvent.layout.height;
            }}
          >
            <ThemedText style={styles.bannerEyebrow}>{t('demo.eyebrow')}</ThemedText>
            <ThemedText style={styles.bannerBody}>{t('demo.note')}</ThemedText>
          </View>

          <RisingSheet>
            <AnalysisView
              result={scan.result}
              subtitle={t('demo.footer')}
              // The one card in the app that gets a highlight. See TeachRing:
              // it rings the row that set the verdict, says so, and leaves,
              // so what is left is the same card a real scan produces.
              teach={t('demo.teachCaption')}
              onIngredientsLayout={(y) => {
                listOffset.current = y;
                // The rise is 420ms and the ring waits 1400ms after that, so
                // this lands in the gap between the card settling and the ring
                // being drawn on it.
                setTimeout(() => {
                  if (alive.current) revealList();
                }, RISE_SETTLE_MS);
              }}
              profileName={scan.profileName}
              profileAllergens={scan.profileAllergens}
              // No `controls` here on purpose. See the pinned footer below.
            />
          </RisingSheet>
        </ScrollView>

        {/* THE WAY OUT, ALWAYS ON SCREEN.
            
            This used to be the analysis card's own footer control, which is
            the right home for it on a real result — you have read the verdict,
            you scroll to the end, and the actions are waiting there. It is the
            wrong home for it here. The card is long, the screen auto-scrolls
            into the middle of it to show the teaching ring, and the only way
            onward was buried under an ingredient list somebody has no reason
            to finish. An onboarding step whose exit has to be discovered is an
            onboarding step people leave.
            
            Paper on dark rather than ink on paper: it floats over the frame
            with the rest of this screen's chrome, not on the card. */}
        <Animated.View style={[styles.footer, footerStyle]}>
          <Pressable
            style={styles.footerButton}
            onPress={next}
            accessibilityRole="button"
          >
            <ThemedText style={styles.footerLabel}>{t('demo.continue')}</ThemedText>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/**
 * The label itself, set as type rather than photographed.
 *
 * There is no photograph of a product that does not exist, and a stock image
 * of somebody else's packet would be both a lie and a trademark problem. Type
 * is also simply better here: the sweep passes over words a person can read,
 * in a language most of them cannot, which is the entire argument for the app
 * made without a sentence of marketing.
 *
 * Rendered from the result's own `originalIngredients`, so the printed list and
 * the analysed list are the same list by construction and cannot drift.
 *
 * And it is FRAMED. The reticle around it is the same four detached brackets
 * the viewfinder draws over a live camera, screen-aligned while the packet
 * underneath sits a degree off square — which is the honest geometry, since
 * one of them is the camera and the other is an object on a table.
 */
function DemoLabel({ scan, framing }: { scan: DemoScan | null; framing: SharedValue<number> }) {
  const { t } = useTranslation();
  const printed = scan?.result.originalIngredients ?? [];
  const stampWord = t('demo.stamp');

  // Drops in slightly too large and settles, the way a phone does when
  // somebody raises it to a packet and the frame catches up with the hand.
  const reticleStyle = useAnimatedStyle(() => ({
    opacity: framing.value,
    transform: [
      { translateY: -34 * (1 - framing.value) },
      { scale: 1 + 0.12 * (1 - framing.value) },
    ],
  }));

  return (
    <View style={styles.labelStage}>
      <View style={styles.labelFrame}>
      <View style={styles.labelCard}>
        <ThemedText style={styles.labelHead}>
          {scan?.result.productName ?? ''}
        </ThemedText>
        <View style={styles.labelRule} />
        <ThemedText style={styles.labelEyebrow}>INGREDIENTES</ThemedText>
        <ThemedText style={styles.labelBody}>
          {printed.join(', ')}
          {printed.length ? '.' : ''}
        </ThemedText>

        {/* The stamp.
            The verdict on this label is real — it comes back from the same
            matcher a paid scan uses — but the PACKET is ours, and at a glance
            a card mid-sweep looks exactly like a card from the camera. A line
            of small type under the card is not enough to carry that: it is
            the first thing cropped out of a screenshot and the last thing read
            on a screen someone is watching animate.
            An archive stamp rather than a tiled watermark. It belongs to the
            document, the way "SPECIMEN" belongs to a banknote, and it leaves
            the ingredient list legible — which matters, because that list
            being readable IS the argument this screen makes. */}
        <View style={styles.stamp} pointerEvents="none">
          <ThemedText style={styles.stampText}>{stampWord}</ThemedText>
        </View>
      </View>

        {/* Outside the card, so it frames the packet rather than sitting on
            it. Paper-coloured, because this is chrome floating over a dark
            stage — the same colour the real reticle takes over a camera. */}
        <Animated.View style={[styles.reticle, reticleStyle]} pointerEvents="none">
          <View style={[styles.bracket, styles.tl]} />
          <View style={[styles.bracket, styles.tr]} />
          <View style={[styles.bracket, styles.bl]} />
          <View style={[styles.bracket, styles.br]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16130F' },
  scrim: { backgroundColor: 'rgba(22,19,15,0.72)' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  // The bottom padding clears the pinned footer as well as the usual gutter,
  // so the end of the card can still be scrolled out from under it.
  content: {
    padding: Gutter,
    gap: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.xxl + FOOTER_CLEARANCE,
  },

  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Gutter, paddingTop: Space.sm },
  skip: {
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    backgroundColor: 'rgba(14,12,10,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(246,241,231,0.18)',
  },
  skipLabel: { fontFamily: Font.sansSemi, fontSize: 13, lineHeight: 18, color: Paper.paper },

  banner: { gap: Space.xs, paddingHorizontal: Space.xs },
  bannerEyebrow: {
    fontFamily: Font.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(246,241,231,0.62)',
  },
  bannerBody: { fontFamily: Font.sans, fontSize: 14, lineHeight: 20, color: 'rgba(246,241,231,0.86)' },

  // The label is chrome over the camera's world, so it takes the fixed paper
  // ink the viewfinder uses rather than the theme's — it sits on a dark stage
  // in both themes.
  labelStage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Gutter,
  },
  // Holds the card and the reticle in one box, so the brackets can be pinned
  // to the card's own edges rather than guessed against the screen.
  labelFrame: { width: '100%', maxWidth: 340 },
  labelCard: {
    width: '100%',
    backgroundColor: Paper.paper,
    padding: Space.lg,
    gap: Space.sm,
    // A packet photographed on a table is never square to the frame. One
    // degree is enough to read as an object rather than a dialog.
    transform: [{ rotate: '-1.2deg' }],
  },
  labelHead: { fontFamily: Font.display, fontSize: 19, lineHeight: 25, color: '#16130F' },
  labelRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(22,19,15,0.28)' },
  labelEyebrow: {
    fontFamily: Font.mono,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    color: 'rgba(22,19,15,0.55)',
  },
  labelBody: { fontFamily: Font.mono, fontSize: 12, lineHeight: 19, color: '#16130F' },
  stamp: {
    position: 'absolute',
    right: -4,
    // TOP right, not bottom right. Bottom right is where the ingredient list
    // ends, and a stamp sitting on the last line made both harder to read —
    // which defeats the point, since that list being legible is the argument
    // this screen makes. The head row is short in all three languages, so the
    // top corner is reliably empty.
    top: 12,
    borderWidth: 2,
    borderColor: 'rgba(22,19,15,0.30)',
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    transform: [{ rotate: '-9deg' }],
  },
  stampText: {
    fontFamily: Font.monoMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.4,
    // Uppercased here rather than in the catalogue, so the translations stay
    // ordinary words a translator can read. A no-op in Chinese, which is fine —
    // the box and the angle carry the stamp there.
    textTransform: 'uppercase',
    color: 'rgba(22,19,15,0.30)',
  },

  reticle: {
    position: 'absolute',
    top: -RETICLE.gap,
    left: -RETICLE.gap,
    right: -RETICLE.gap,
    bottom: -RETICLE.gap,
  },
  bracket: {
    position: 'absolute',
    width: RETICLE.bracket,
    height: RETICLE.bracket,
    borderColor: Paper.paper,
  },
  tl: { top: 0, left: 0, borderTopWidth: RETICLE.stroke, borderLeftWidth: RETICLE.stroke },
  tr: { top: 0, right: 0, borderTopWidth: RETICLE.stroke, borderRightWidth: RETICLE.stroke },
  bl: { bottom: 0, left: 0, borderBottomWidth: RETICLE.stroke, borderLeftWidth: RETICLE.stroke },
  br: { bottom: 0, right: 0, borderBottomWidth: RETICLE.stroke, borderRightWidth: RETICLE.stroke },

  // Sits over the scroll rather than in it, on a band of the stage's own dark
  // so whatever is passing underneath cannot make the label unreadable.
  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    backgroundColor: 'rgba(22,19,15,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(246,241,231,0.14)',
  },
  footerButton: {
    borderRadius: Radius.pill,
    paddingVertical: Space.lg,
    alignItems: 'center',
    backgroundColor: Paper.paper,
  },
  footerLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20, color: '#16130F' },
});
