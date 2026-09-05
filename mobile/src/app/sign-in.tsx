import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevelyLockup } from '@/components/aperture-mark';
import { LanguagePicker } from '@/components/language-picker';
import { ProviderButtons } from '@/components/sign-in-providers';
import { ThemedText } from '@/components/themed-text';
import { Space, Type, useSurface } from '@/constants/design';
import { isPlaceholderName, useTranslation } from '@/lib/i18n';
import { goHome } from '@/lib/navigation';

/**
 * Sign in, when it is a destination rather than a drawer.
 *
 * The common case is no longer this screen. Welcome offers sign-in in a sheet
 * without leaving the page, which is what somebody reinstalling actually wants.
 * What is left here are the two moments that deserve their own page because
 * they carry their own argument:
 *
 *   mode=save   reached from the first verdict, once a profile exists and they
 *               have seen it work. The honest framing is not "sign in to
 *               continue" but "keep this", and the profile name is passed so
 *               the sentence can name the person whose allergies are about to
 *               be preserved.
 *
 *   recover=1   sent from the subscription screen, by someone whose Apple ID
 *               already holds a subscription. They did not come to make an
 *               account; they came to get back something they already pay for.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const params = useLocalSearchParams<{ mode?: string; name?: string; recover?: string; then?: string }>();
  const saving = params.mode === 'save';
  // Whose profile this is, grammatically. See isPlaceholderName.
  const named = !isPlaceholderName(params.name);
  const recovering = params.recover === '1';

  function done(subscribed: boolean) {
    // ALREADY PAYING BEATS EVERY OTHER DESTINATION.
    //
    // The account this person just signed into holds a live subscription —
    // the server was asked outright before we got here, so this is not a
    // guess. Sending them anywhere but the camera means showing a price to
    // somebody who has already paid it, which is the one thing this screen
    // must never do.
    if (subscribed) return goHome();

    // Otherwise: sent here mid-purchase by the paywall, because an anonymous
    // purchase cannot be granted. Going to '/' would bounce off the
    // viewfinder's gate and land back on the paywall anyway, but by way of a
    // screen that exists to turn people around, which flickers.
    //
    // BACK TO THE PAYWALL THAT SENT THEM, not a fresh one.
    //
    // This used to replace with '/paywall?gate=1', and the paywall it replaced
    // was the sign-in screen — which the FIRST paywall had pushed. So choosing
    // a plan, tapping Continue and signing in produced a second subscription
    // screen stacked on the first, visibly so, and it was the second one that
    // took the money. Going back returns to the live screen instead, with the
    // plan they picked still selected. The fallback only matters if this was
    // somehow reached cold, where there is nothing behind us to go back to.
    if (params.then === 'paywall') {
      if (router.canGoBack()) return router.back();
      return router.replace('/paywall?gate=1');
    }

    goHome();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      {/* Language, before an account exists. The full setting lives on Account,
          which is behind a sign-in, so somebody who cannot read this screen
          could not otherwise reach the control that would fix it. */}
      <View style={styles.topBar}>
        <LanguagePicker />
      </View>

      <View style={styles.hero}>
        {/* The lockup, not a serif wordmark: Newsreader belongs to the verdict
            word alone, so the app's own name is set in Instrument Sans. */}
        <RevelyLockup size={38} color={surface.ink} />
        {recovering ? (
          <>
            <ThemedText style={[Type.title, styles.tagline, { color: surface.ink }]}>
              {t('signIn.recoverTitle')}
            </ThemedText>
            <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
              {t('signIn.recoverBody')}
            </ThemedText>
          </>
        ) : saving ? (
          <>
            <ThemedText style={[Type.title, styles.tagline, { color: surface.ink }]}>
              {t('signIn.saveTitle')}
            </ThemedText>
            <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
              {named
                ? t('signIn.saveBody', { name: params.name as string })
                : t('signIn.saveBodyYours')}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
            {t('signIn.tagline')}
          </ThemedText>
        )}
      </View>

      <View style={styles.actions}>
        <ProviderButtons onSignedIn={done} />

        {/* Only when this is an offer rather than a gate. Someone who came here
            to get their account back has nothing to defer. */}
        {saving && (
          <Pressable style={styles.later} onPress={() => router.back()} accessibilityRole="button">
            <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
              {t('signIn.later')}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: Space.xl },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  tagline: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: 12, paddingBottom: 24, minHeight: 140, justifyContent: 'flex-end' },
  later: { alignItems: 'center', paddingVertical: 12, opacity: 0.6 },
});
