import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark, RevelyLockup } from '@/components/aperture-mark';
import { ApertureReveal } from '@/components/aperture-reveal';
import { LanguagePicker } from '@/components/language-picker';
import { ThemedText } from '@/components/themed-text';
import {
  Font, Gutter, Radius, Space, Type, useSurface, useVerdictColors,
} from '@/constants/design';
import { useTranslation } from '@/lib/i18n';

// Screen 00 — Welcome.
//
// The first screen anyone sees, and it exists because of what used to be here:
// a sign-in wall. Cold start went straight to "Continue with Apple" — hand over
// an identity to an app that had not yet done anything, said anything, or shown
// a single verdict. Everything past that screen was invisible to someone who
// had not already decided to trust it.
//
// SHOW THE PRODUCT, DO NOT DESCRIBE IT
//
// So this screen is one specimen card: a real ingredient, a real verdict, and
// the authority underneath it. Not a carousel — three swipeable slides of
// promises get skipped by everyone and remembered by nobody.
//
// The citation line is the part that matters. Every competitor gives a score;
// the thing this app does that they do not is say WHO SAYS SO, and that has to
// be visible before the first ask, not discovered later by someone who stayed.
//
// The specimen is fixed and honest — an evidence record the app really holds,
// worded as the results screen would word it. It is not a fabricated screenshot
// of a verdict we cannot produce.
//
// THE REVEAL
//
// The card arrives through the aperture: unresolved, then read, then clear.
// Reading a label is the first thing the app does and the only thing it claims
// to do, so the entrance demonstrates the product rather than decorating it —
// and it is built from the mark, so it introduces no new vocabulary.
//
// Curiosity, not fear. The sweep invites a look; it withholds nothing. It runs
// once and leaves the card fully legible, which is also what someone with
// reduced motion sees from the very first frame.

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const verdict = useVerdictColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          {/* Language sits on the FIRST screen, not only on sign-in.

              A cold start lands here, and sign-in is behind "Already have an
              account?" — so putting the control only there still stranded
              anyone who cannot read this page. It shares the lockup's row
              rather than floating above it: this screen scrolls, and a pinned
              pill would drift over the specimen card on a small phone. */}
          <View style={styles.headTop}>
            <RevelyLockup size={30} color={surface.ink} />
            <LanguagePicker />
          </View>
          {/* Full ink at title weight, now that it is a sentence rather than
              a paragraph. The screen's job is to be understood in one glance
              and then got past; the specimen card below is the argument, and
              it cannot land while a wall of prose is competing with it. */}
          <ThemedText style={[Type.title, { color: surface.ink }]}>
            {t('welcome.tagline')}
          </ThemedText>
        </View>

        {/* The specimen. Same flat card, same seal, same citation rule the
            results screen uses — this is a sample of the product, not an
            illustration of it. */}
        <ApertureReveal>
          <View style={[styles.specimen, { backgroundColor: surface.card, borderColor: surface.rule }]}>
            <View style={styles.specimenHead}>
              <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
                {t('welcome.specimenLabel')}
              </ThemedText>
              <View style={[styles.seal, { backgroundColor: verdict.caution.wash }]}>
                <ThemedText style={[styles.sealText, { color: verdict.caution.ink }]}>
                  {t('welcome.specimenVerdict')}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={[Type.title, { color: surface.ink }]}>
              {t('welcome.specimenIngredient')}
            </ThemedText>
            <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
              {t('welcome.specimenReason')}
            </ThemedText>

            <View style={[styles.citation, { borderTopColor: surface.rule }]}>
              <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                {t('welcome.specimenSource')}
              </ThemedText>
            </View>
          </View>
        </ApertureReveal>

        <View style={styles.points}>
          <Point icon text={t('welcome.pointPersonal')} />
          <Point text={t('welcome.pointSources')} />
          <Point text={t('welcome.pointLanguages')} />
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: surface.rule }]}>
        <Pressable
          style={[styles.primary, { backgroundColor: surface.ink }]}
          onPress={() => router.push('/onboarding')}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.primaryLabel, { color: surface.card }]}>
            {t('welcome.start')}
          </ThemedText>
        </Pressable>

        {/* Present, but quiet. Someone reinstalling needs it immediately;
            someone new must not read it as the expected next step. */}
        <Pressable onPress={() => router.push('/sign-in')} hitSlop={12} style={styles.secondary}>
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            {t('welcome.haveAccount')}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Point({ text, icon = false }: { text: string; icon?: boolean }) {
  const surface = useSurface();
  return (
    <View style={styles.point}>
      {icon ? (
        <ApertureMark size={14} color={surface.inkFaint} />
      ) : (
        <View style={[styles.dot, { backgroundColor: surface.inkFaint }]} />
      )}
      <ThemedText style={[Type.body, styles.pointText, { color: surface.inkMuted }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xxl,
    paddingBottom: Space.xl,
    gap: Space.xl,
  },
  head: { gap: Space.md },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  specimen: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.sm,
  },
  specimenHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.xs,
  },
  seal: { paddingHorizontal: Space.sm, paddingVertical: 3, borderRadius: Radius.tile },
  sealText: { fontFamily: Font.sansSemi, fontSize: 11, lineHeight: 15, letterSpacing: 0.6 },
  citation: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Space.sm,
    marginTop: Space.xs,
  },

  points: { gap: Space.md },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 9, marginHorizontal: 5 },
  pointText: { flex: 1 },

  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Space.md,
  },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  secondary: { alignItems: 'center', paddingVertical: Space.sm },
});
