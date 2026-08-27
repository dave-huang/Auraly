import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevelyLockup } from '@/components/aperture-mark';
import { ThemedText } from '@/components/themed-text';
import { ALLOW_DEV_LOGIN, GOOGLE_SIGN_IN_ENABLED } from '@/lib/config';
import { Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import {
  isAppleAuthAvailable,
  signInAsDeveloper,
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
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
  const params = useLocalSearchParams<{ mode?: string; name?: string }>();
  const saving = params.mode === 'save';
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
        {saving ? (
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
            {appleAvailable && Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={() => handle('apple', signInWithApple)}
              />
            )}

            {GOOGLE_SIGN_IN_ENABLED && (
              <Pressable
                style={[styles.googleButton, { backgroundColor: surface.ink }]}
                onPress={() => handle('google', signInWithGoogle)}
              >
                <ThemedText style={[Type.label, { color: surface.card }]}>{t('signIn.google')}</ThemedText>
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

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: Space.xl },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  tagline: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: 12, paddingBottom: 24, minHeight: 140, justifyContent: 'flex-end' },
  appleButton: { height: 52 },
  googleButton: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  devButton: { alignItems: 'center', paddingVertical: 12, opacity: 0.6 },
});
