import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnalysisView } from '@/components/analysis-view';
import { RisingSheet } from '@/components/rising-sheet';
import { ScanProgress } from '@/components/scan-progress';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Paper, Radius, Space, Type, useSurface } from '@/constants/design';
import { fetchDemoScan, type DemoScan } from '@/lib/demo';
import { useTranslation } from '@/lib/i18n';

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

/** Long enough for the sweep to finish its round trip and settle. */
const FLOOR_MS = 2600;
/** When the reader "finishes" — cosmetic, and only ever inside the floor. */
const READ_MS = 1300;

export default function DemoScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const surface = useSurface();

  const [scan, setScan] = useState<DemoScan | null>(null);
  const [seated, setSeated] = useState(false);
  const [phase, setPhase] = useState<'reading' | 'analyzing'>('reading');
  // Survives the unmount race: the fetch and two timers all resolve after the
  // person may already have tapped Skip.
  const alive = useRef(true);

  // Onward, from every exit this screen has: Continue, Skip, and the network
  // failure. /reminder states the trial promise, then hands to the paywall.
  function next() {
    router.replace('/reminder');
  }

  useEffect(() => {
    alive.current = true;
    const started = Date.now();

    const readTimer = setTimeout(() => {
      if (alive.current) setPhase('analyzing');
    }, READ_MS);

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
          Math.max(0, FLOOR_MS - (Date.now() - started)),
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
        <ScanProgress
          phase={phase}
          ingredientCount={phase === 'analyzing' ? scan?.result.ingredients.length : undefined}
          backdrop={<DemoLabel scan={scan} />}
        />
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
      <DemoLabel scan={scan} />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Said plainly, above the card, before anyone reads a verdict off
              it. The card's own footer repeats it in small type, but the
              claim belongs here where it cannot be missed or cropped out. */}
          <View style={styles.banner}>
            <ThemedText style={styles.bannerEyebrow}>{t('demo.eyebrow')}</ThemedText>
            <ThemedText style={styles.bannerBody}>{t('demo.note')}</ThemedText>
          </View>

          <RisingSheet>
            <AnalysisView
              result={scan.result}
              subtitle={t('demo.footer')}
              profileName={scan.profileName}
              profileAllergens={scan.profileAllergens}
              controls={
                <Pressable
                  style={[styles.inkButton, { backgroundColor: surface.ink }]}
                  onPress={next}
                  accessibilityRole="button"
                >
                  <ThemedText style={[Type.label, styles.inkLabel, { color: surface.card }]}>
                    {t('demo.continue')}
                  </ThemedText>
                </Pressable>
              }
            />
          </RisingSheet>
        </ScrollView>
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
 */
function DemoLabel({ scan }: { scan: DemoScan | null }) {
  const { t } = useTranslation();
  const printed = scan?.result.originalIngredients ?? [];
  const stampWord = t('demo.stamp');

  return (
    <View style={styles.labelStage}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16130F' },
  scrim: { backgroundColor: 'rgba(22,19,15,0.72)' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Gutter, gap: Space.lg, paddingTop: Space.lg, paddingBottom: Space.xxl },

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
  labelCard: {
    width: '100%',
    maxWidth: 340,
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

  inkButton: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  inkLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
});
