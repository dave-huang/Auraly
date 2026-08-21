import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
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

export default function SignInScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { t } = useTranslation();
  const surface = useSurface();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  async function handle(method: string, signIn: () => Promise<any>) {
    setBusy(method);
    try {
      setUser(await signIn());
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
        <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>{t('signIn.tagline')}</ThemedText>
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
