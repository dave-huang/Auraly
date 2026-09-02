import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevelyLockup } from '@/components/aperture-mark';
import { InkWashPlate } from '@/components/inkwash-plate';
import { LanguagePicker } from '@/components/language-picker';
import { SignInSheet } from '@/components/sign-in-providers';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';

// Screen 00 — Welcome.
//
// ONE DECISION, TWO DOORS
//
// This screen used to argue. It carried a worked example (a real ingredient, a
// real verdict, the regulator underneath it) and three supporting points, on
// the theory that showing the product beats describing it. The theory is right
// and the placement was wrong: all of it landed on somebody who had been in the
// app for two seconds and had not yet decided to care. It read as dense, and
// dense on a first screen reads as work.
//
// So the argument moved into the flow behind the button, where there is room to
// make it one idea at a time, and this screen went back to doing the only job a
// first screen can actually do: name the app, and offer the two doors.
//
//   Get started  — into onboarding, which ends at the subscription.
//   Sign in      — a drawer on this same page, not another screen. Somebody
//                  reinstalling wants their account back in one tap. If they
//                  turn out to have no profile yet, the gate sends them into
//                  onboarding anyway, so the two doors meet.
//
// The drawing is the whole upper half and carries no text over it, which is the
// rule everywhere in the app now: a plate is either a picture with its own
// space or it is not worth having.

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const [signingIn, setSigningIn] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      {/* Language sits on the FIRST screen, not only behind sign-in. A cold
          start lands here, so putting the control anywhere else strands anyone
          who cannot read this page. */}
      <View style={styles.topBar}>
        <LanguagePicker />
      </View>

      {/* A split pod: looking closely at what a thing is actually made of,
          which is the entire product in one drawing. Portrait, because this
          band is tall and narrow, and a landscape drawing would letterbox into
          a strip with dead space above and below it. */}
      <View style={styles.art}>
        <InkWashPlate name="vanillaPod" />
      </View>

      <View style={styles.head}>
        {/* The lockup, not a serif wordmark: Newsreader belongs to the verdict
            word alone, so the app's own name is set in Instrument Sans. */}
        <RevelyLockup size={40} color={surface.ink} />
        <ThemedText style={[styles.tagline, { color: surface.ink }]}>
          {t('welcome.tagline')}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primary, { backgroundColor: surface.ink }]}
          onPress={() => router.push('/onboarding')}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.primaryLabel, { color: surface.card }]}>
            {t('welcome.start')}
          </ThemedText>
        </Pressable>

        {/* Present, and readable, but not the expected next step. */}
        <Pressable
          onPress={() => setSigningIn(true)}
          hitSlop={12}
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel={`${t('welcome.haveAccount')} ${t('welcome.signIn')}`}
        >
          <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
            {t('welcome.haveAccount')}{' '}
            <ThemedText style={[styles.signIn, { color: surface.ink }]}>
              {t('welcome.signIn')}
            </ThemedText>
          </ThemedText>
        </Pressable>
      </View>

      {/* The gate decides where they land: straight to the camera if they have
          a profile and a subscription, into onboarding if they do not. */}
      <SignInSheet
        visible={signingIn}
        onClose={() => setSigningIn(false)}
        onSignedIn={() => {
          setSigningIn(false);
          router.replace('/');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Gutter },

  // Takes whatever height is left once the name, the tagline and the buttons
  // have theirs, which on a small phone is less and on a large one is more.
  // The drawing is contained rather than cropped, so it simply gets smaller
  // instead of losing its edges.
  art: { flex: 1, marginHorizontal: Gutter, marginTop: Space.sm, minHeight: 140 },

  head: { paddingHorizontal: Gutter, paddingTop: Space.xl, alignItems: 'center', gap: Space.lg },
  // Bigger than Type.title and set centred: this is the one sentence the screen
  // exists to say, and at 22 it looked like a caption for the drawing above it.
  tagline: {
    fontFamily: Font.sansSemi,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.5,
    textAlign: 'center',
  },

  footer: { paddingHorizontal: Gutter, paddingTop: Space.xl, paddingBottom: Space.md, gap: Space.sm },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 16, lineHeight: 21 },
  secondary: { alignItems: 'center', paddingVertical: Space.md },
  signIn: { fontFamily: Font.sansSemi },
});
