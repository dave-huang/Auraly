import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { RevelyLockup } from '@/components/aperture-mark';
import { LanguagePicker } from '@/components/language-picker';
import { SignInSheet } from '@/components/sign-in-providers';
import { ThemedText } from '@/components/themed-text';
import { WelcomeScan } from '@/components/welcome-scan';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/reduced-motion';

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
//
// EXCEPT FOR THE ONE SENTENCE THE SCREEN CAN SHOW RATHER THAN WRITE
//
// The hero now opens on the name and hands over to WelcomeScan: a Japanese
// packet, the app's own reticle settling onto it, three unreadable names
// becoming readable ones. It is the same claim the tagline makes, made in the
// medium the product actually works in, and it takes no reading.
//
// The lockup does not simply vanish for it. It rises out of the hero as the
// packet rises in, and a small one fades into the top bar at the same moment,
// so the app's name is on screen the whole time — a first screen that ends up
// unnamed is a worse trade than any animation is worth.

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const reduced = useReducedMotion();
  const [signingIn, setSigningIn] = useState(false);

  // 0 is the lockup alone, 1 is the packet. One value drives all three parts
  // of the handoff, so the name cannot leave before the mark arrives to
  // replace it, whatever the frame rate does.
  const handoff = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      handoff.value = 1;
      return;
    }
    // A beat on the name first. Landing straight into an animation reads as a
    // splash screen somebody forgot to dismiss; a moment of stillness makes
    // the move afterwards feel like an answer to a question the name asked.
    handoff.value = withDelay(
      1100,
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
    );
  }, [reduced, handoff]);

  const lockupStyle = useAnimatedStyle(() => ({
    opacity: 1 - handoff.value,
    transform: [{ translateY: -14 * handoff.value }],
  }));
  const scanStyle = useAnimatedStyle(() => ({
    opacity: handoff.value,
    transform: [{ translateY: 20 * (1 - handoff.value) }],
  }));
  const topMarkStyle = useAnimatedStyle(() => ({ opacity: handoff.value }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      {/* Language sits on the FIRST screen, not only behind sign-in. A cold
          start lands here, so putting the control anywhere else strands anyone
          who cannot read this page. */}
      <View style={styles.topBar}>
        {/* Arrives exactly as the big one leaves. Small, and never the thing
            being read — it is here so the screen is never anonymous. */}
        <Animated.View style={topMarkStyle} pointerEvents="none">
          <RevelyLockup size={19} color={surface.ink} />
        </Animated.View>
        <LanguagePicker />
      </View>

      {/* Centred in what is left after the bar and the buttons, so whatever is
          showing sits at the optical middle of the screen rather than being
          pushed up by something else that wanted the space.

          The two states are STACKED AND ABSOLUTE rather than swapped. A
          conditional render would relayout the hero mid-transition and make
          the buttons below it jump, which is the one thing a first screen
          cannot do. */}
      <View style={styles.hero}>
        {/* The lockup, not a serif wordmark: Newsreader belongs to the verdict
            word alone, so the app's own name is set in Instrument Sans.

            It keeps the accessibility of this screen even at zero opacity:
            VoiceOver reads the name and the tagline, which is the right thing
            to hear, and the loop below is marked away so it cannot interrupt
            with three ingredient names four times a minute. */}
        <Animated.View style={[styles.heroLayer, lockupStyle]} pointerEvents="none">
          <RevelyLockup size={44} color={surface.ink} />
          {/* Deliberately smaller than the name. This line is a subtitle to
              the mark, not a headline competing with it. */}
          <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
            {t('welcome.tagline')}
          </ThemedText>
        </Animated.View>

        <Animated.View
          style={[styles.heroLayer, scanStyle]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <WelcomeScan />
        </Animated.View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Gutter,
  },

  hero: { flex: 1 },
  // Both states fill the hero and centre themselves in it, so neither can move
  // the other. The bottom padding pulls the contents up off the true centre by
  // a little: an optical centre sits slightly above a geometric one, and the
  // buttons below weigh the bottom of the screen.
  heroLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Gutter,
    gap: Space.md,
    paddingBottom: Space.xxl,
  },
  tagline: { textAlign: 'center', maxWidth: 300 },

  footer: { paddingHorizontal: Gutter, paddingBottom: Space.md, gap: Space.sm },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 16, lineHeight: 21 },
  secondary: { alignItems: 'center', paddingVertical: Space.md },
  signIn: { fontFamily: Font.sansSemi },
});
