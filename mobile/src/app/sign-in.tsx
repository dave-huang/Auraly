import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevelyLockup } from '@/components/aperture-mark';
import { GoogleMark } from '@/components/google-mark';
import { ThemedText } from '@/components/themed-text';
import { ALLOW_DEV_LOGIN, GOOGLE_SIGN_IN_ENABLED } from '@/lib/config';
import { Font, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import {
  isAppleAuthAvailable,
  signInAsDeveloper,
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { refreshEntitlement } from '@/lib/entitlement';
import { syncLocalProfile } from '@/lib/profiles';
import { identifyPurchaser } from '@/lib/purchases';

/**
 * Sign in — which is now mostly an offer to SAVE something, not a gate.
 *
 * This screen used to be the first thing anyone saw. It asked for an Apple ID
 * before the app had read a label, said anything, or produced a single verdict,
 * and everything behind it was invisible to someone who had not already decided
 * to trust it.
 *
 * It is now reached in two ways. From welcome, by someone reinstalling who
 * simply wants their account back. And — the common path — from the first
 * verdict, once they have built a profile and seen it work, where the honest
 * framing is not "sign in to continue" but "keep this". The `mode=save` param
 * is what switches the wording, and the profile name is passed so the sentence
 * can name the person whose allergies are about to be preserved.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { t } = useTranslation();
  const surface = useSurface();
  /**
   * Both buttons have to contrast with the page, not with each other.
   *
   * Apple's button was pinned to BLACK, which is correct on paper and nearly
   * invisible on the dark ground — while the Google button next to it took its
   * colour from `surface.ink`, which flips to cream. So by lamplight the two
   * sign-in options looked like two different controls from two different
   * apps. They now flip together: dark buttons on the light page, light
   * buttons on the dark one, which is what both Apple and Google publish their
   * buttons in pairs for.
   */
  const dark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ mode?: string; name?: string; recover?: string }>();
  const saving = params.mode === 'save';
  /**
   * Sent here from the subscription screen by someone whose Apple ID already
   * holds a subscription.
   *
   * They did not come to make an account; they came to get back something they
   * are already paying for, and being shown the generic "Save this?" pitch
   * would read as being asked to sign up all over again. It changes the words,
   * and it changes what happens the moment sign-in succeeds.
   */
  const recovering = params.recover === '1';
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  async function handle(method: string, signIn: () => Promise<any>) {
    setBusy(method);
    try {
      const user = await signIn();
      setUser(user);

      // Upload the profile built during onboarding, and make the server copy
      // active — its id changes at this moment, and a viewfinder still holding
      // `local:profile` would scan against nothing.
      //
      // Never fatal. Someone who has just signed in successfully must not be
      // shown a failure; the local copy survives an error here and the next
      // sign-in retries it.
      try {
        await syncLocalProfile();
      } catch (syncError) {
        console.warn('[SIGN-IN] profile sync failed', syncError);
      }

      // Tell RevenueCat who this is, so a purchase made before sign-in is
      // attributed to the account rather than to an anonymous store id.
      await identifyPurchaser(user.id);

      // The account now exists AND the store knows about it, which is the
      // first moment the subscription can actually be attached. Asking now is
      // what puts them on the camera instead of back on the paywall, one tap
      // later, wondering what the sign-in was for.
      //
      // Awaited, not fired and forgotten: the whole point is that the next
      // screen already knows. Failures are ignored — the account is real
      // either way, and the paywall pulls again on open.
      if (recovering) await refreshEntitlement().catch(() => null);

      router.replace('/');
    } catch (error: any) {
      if (!(error instanceof SignInCancelledError)) {
        Alert.alert(t('signIn.failed'), error?.message ?? t('common.tryAgain'));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
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
              {t('signIn.saveBody', { name: params.name || t('onboarding.namePlaceholder') })}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
            {t('signIn.tagline')}
          </ThemedText>
        )}
      </View>

      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator />
        ) : (
          <>
            {/* Apple's own button, not a copy of it: it carries the mark, the
                wording and the localisation Apple requires, and review checks
                this one specifically. Its geometry is what the Google button
                below is built to match — same height, same corner. */}
            {appleAvailable && Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={
                  dark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={BUTTON_RADIUS}
                style={styles.providerButton}
                onPress={() => handle('apple', signInWithApple)}
              />
            )}

            {/* Built to sit beside Apple's, in the colours Google publishes:
                #131314 on white text, or white on #1F1F1F text, with the
                four-colour G untouched in both. The pill it used to be, in
                theme ink with no mark on it at all, read as this app's own
                button rather than as Google's — and the word was "Continue"
                while the button above it said "Sign in". */}
            {GOOGLE_SIGN_IN_ENABLED && (
              <Pressable
                style={[
                  styles.providerButton,
                  styles.googleButton,
                  { backgroundColor: dark ? '#FFFFFF' : '#131314' },
                ]}
                onPress={() => handle('google', signInWithGoogle)}
                accessibilityRole="button"
                accessibilityLabel={t('signIn.google')}
              >
                <GoogleMark size={18} />
                <ThemedText
                  style={[styles.googleLabel, { color: dark ? '#1F1F1F' : '#FFFFFF' }]}
                >
                  {t('signIn.google')}
                </ThemedText>
              </Pressable>
            )}

            {ALLOW_DEV_LOGIN && (
              <Pressable style={styles.devButton} onPress={() => handle('dev', signInAsDeveloper)}>
                <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>{t('signIn.dev')}</ThemedText>
              </Pressable>
            )}

            {/* Only when this is an offer rather than a gate. Someone who came
                here to get their account back has nothing to defer. */}
            {saving && (
              <Pressable
                style={styles.devButton}
                onPress={() => router.back()}
                accessibilityRole="button"
              >
                <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                  {t('signIn.later')}
                </ThemedText>
              </Pressable>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Apple's button takes its corner as a prop; Google's takes it from styles. */
const BUTTON_RADIUS = 12;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: Space.xl },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  tagline: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: 12, paddingBottom: 24, minHeight: 140, justifyContent: 'flex-end' },
  // One geometry, used by both providers. Apple's native button takes the
  // radius as a prop rather than from styles, so the constant is shared.
  providerButton: { height: 52 },
  googleButton: {
    borderRadius: BUTTON_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // Apple sets its button's label in the system font at ~19pt semibold, so the
  // Google label matches it rather than the app's own type scale — two sign-in
  // buttons with different type sizes is the same mismatch in another channel.
  googleLabel: {
    fontFamily: Font.sansSemi,
    fontSize: 17,
    lineHeight: 22,
  },

  devButton: { alignItems: 'center', paddingVertical: 12, opacity: 0.6 },
});
