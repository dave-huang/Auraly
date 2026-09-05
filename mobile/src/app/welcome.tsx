import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevelyLockup } from '@/components/aperture-mark';
import { LanguagePicker } from '@/components/language-picker';
import { SignInSheet } from '@/components/sign-in-providers';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';

// Screen 00 — Welcome. The first thing anybody without an account sees, every
// time, including the moment after they sign out.
//
// ONE DECISION, TWO DOORS
//
// This screen has been talked out of doing anything else twice now. It once
// carried a worked example — a real ingredient, a real verdict, the regulator
// underneath it — and three supporting points, on the theory that showing the
// product beats describing it. The theory is right and the placement was wrong:
// all of it landed on somebody who had been in the app for two seconds and had
// not yet decided to care. Then it carried a drawing, which was quieter but
// still an answer to a question nobody had asked yet.
//
// What is left is the name, one line saying what the app is for, and the two
// doors. That is the whole job of a first screen:
//
//   Get started  — into onboarding, which ends at the subscription.
//   Sign in      — a drawer on this same page, not another screen. Somebody
//                  reinstalling wants their account back in one tap. If they
//                  turn out to have no profile yet, the gate sends them into
//                  onboarding anyway, so the two doors meet.
//
// The argument for the product lives in onboarding, one idea at a time, where
// there is room for it and where somebody has already agreed to look.

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

      {/* Centred in what is left after the bar and the buttons, so the mark
          sits at the optical middle of the screen rather than being pushed up
          by whatever else wanted the space. */}
      <View style={styles.hero}>
        {/* The lockup, not a serif wordmark: Newsreader belongs to the verdict
            word alone, so the app's own name is set in Instrument Sans. */}
        <RevelyLockup size={44} color={surface.ink} />
        {/* Deliberately smaller than the name. This line is a subtitle to the
            mark, not a headline competing with it. */}
        <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
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

  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Gutter,
    gap: Space.md,
    // Pulls the pair up off the true centre by a little. An optical centre sits
    // slightly above a geometric one, and the buttons below weigh the bottom.
    paddingBottom: Space.xxl,
  },
  tagline: { textAlign: 'center', maxWidth: 300 },

  footer: { paddingHorizontal: Gutter, paddingBottom: Space.md, gap: Space.sm },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 16, lineHeight: 21 },
  secondary: { alignItems: 'center', paddingVertical: Space.md },
  signIn: { fontFamily: Font.sansSemi },
});
