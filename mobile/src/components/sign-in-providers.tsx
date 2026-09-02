import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { GoogleMark } from '@/components/google-mark';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import {
  isAppleAuthAvailable,
  signInAsDeveloper,
  signInWithApple,
  signInWithGoogle,
  SignInCancelledError,
} from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { ALLOW_DEV_LOGIN, GOOGLE_SIGN_IN_ENABLED } from '@/lib/config';
import { refreshEntitlement } from '@/lib/entitlement';
import { deviceLanguage, translate, useTranslation } from '@/lib/i18n';
import { syncLocalProfile } from '@/lib/profiles';
import { identifyPurchaser } from '@/lib/purchases';

// The two sign-in buttons, and everything that has to happen the moment one of
// them succeeds.
//
// This used to live inside the sign-in screen, which was fine while that screen
// was the only place anyone signed in. It is not any more: the welcome screen
// now offers sign-in in a drawer without leaving the page, the way most first
// screens do, and two copies of an auth handler is how one of them quietly
// stops syncing the local profile.
//
// So the sequence lives here once, and the callers only decide what happens
// afterwards.

/**
 * Both buttons speak the DEVICE's language, not the app's.
 *
 * Apple's is their own native component and has no locale prop; its text comes
 * from the device and cannot be changed at runtime. Rather than have one button
 * follow the language picker and the other refuse, both follow the device, so
 * the pair always agrees.
 *
 * It is the less obvious half that is worth stating: this deliberately ignores
 * the language picker sitting a few points above it. A row of sign-in buttons
 * is platform chrome, since the account being reached belongs to Apple or to
 * Google rather than to Revely, and chrome that disagrees with itself looks
 * broken in a way that chrome in the "wrong" language does not.
 */
export function ProviderButtons({
  onSignedIn,
  recovering = false,
}: {
  onSignedIn: () => void;
  /**
   * Sent here by someone whose Apple ID already holds a subscription. Their
   * entitlement is pulled before we hand back, so the next screen already
   * knows, rather than bouncing them off a paywall one tap later.
   */
  recovering?: boolean;
}) {
  const { setUser } = useAuth();
  const { t } = useTranslation();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  const platformLanguage = deviceLanguage();

  async function handle(method: string, signIn: () => Promise<any>) {
    setBusy(method);
    try {
      const user = await signIn();
      setUser(user);

      // Upload the profile built during onboarding, and make the server copy
      // active. Its id changes at this moment, and a viewfinder still holding
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

      if (recovering) await refreshEntitlement().catch(() => null);

      onSignedIn();
    } catch (error: any) {
      if (!(error instanceof SignInCancelledError)) {
        Alert.alert(t('signIn.failed'), error?.message ?? t('common.tryAgain'));
      }
    } finally {
      setBusy(null);
    }
  }

  if (busy) {
    return (
      <View style={styles.busy}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.buttons}>
      {/* Apple's own button, not a copy of it: it carries the mark, the wording
          and the localisation Apple requires, and review checks this one
          specifically. Its geometry is what the Google button below is built to
          match: same height, same corner. */}
      {appleAvailable && Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={BUTTON_RADIUS}
          style={styles.providerButton}
          onPress={() => handle('apple', signInWithApple)}
        />
      )}

      {/* Built to sit beside Apple's, in the colours Google publishes. */}
      {GOOGLE_SIGN_IN_ENABLED && (
        <Pressable
          style={[styles.providerButton, styles.googleButton, { backgroundColor: '#131314' }]}
          onPress={() => handle('google', signInWithGoogle)}
          accessibilityRole="button"
          accessibilityLabel={translate(platformLanguage, 'signIn.google')}
        >
          <GoogleMark size={18} />
          <ThemedText style={[styles.googleLabel, { color: '#FFFFFF' }]}>
            {translate(platformLanguage, 'signIn.google')}
          </ThemedText>
        </Pressable>
      )}

      {ALLOW_DEV_LOGIN && <DevButton onPress={() => handle('dev', signInAsDeveloper)} />}
    </View>
  );
}

function DevButton({ onPress }: { onPress: () => void }) {
  const surface = useSurface();
  const { t } = useTranslation();
  return (
    <Pressable style={styles.quiet} onPress={onPress}>
      <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>{t('signIn.dev')}</ThemedText>
    </Pressable>
  );
}

/**
 * Sign-in as a drawer, on the page you were already on.
 *
 * The welcome screen's job is to get somebody into the flow. Sending a
 * returning user to a whole separate screen to type nothing and press one
 * button was a page transition doing the work of a sheet, and it made "already
 * have an account" look like a bigger decision than it is.
 *
 * The backdrop dismisses, and so does the close control. A sheet whose only
 * exit is a small mark in the corner is the thing that traps people.
 */
export function SignInSheet({
  visible,
  onClose,
  onSignedIn,
}: {
  visible: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const surface = useSurface();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')}>
        <Pressable
          style={[styles.sheet, { backgroundColor: surface.card, borderTopColor: surface.rule }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHead}>
            <ThemedText style={[Type.title, { color: surface.ink }]}>
              {t('signIn.sheetTitle')}
            </ThemedText>
            <Pressable
              onPress={onClose}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={[styles.close, { borderColor: surface.rule, backgroundColor: surface.paper }]}
            >
              <ThemedText style={[styles.closeGlyph, { color: surface.ink }]}>✕</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
            {t('signIn.sheetBody')}
          </ThemedText>

          <ProviderButtons onSignedIn={onSignedIn} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Apple's button takes its corner as a prop; Google's takes it from styles. */
export const BUTTON_RADIUS = 12;

const styles = StyleSheet.create({
  buttons: { gap: Space.md },
  // Holds the row's height while a provider is working, so the sheet does not
  // collapse and jump under the thumb that just pressed it.
  busy: { minHeight: 116, alignItems: 'center', justifyContent: 'center' },
  providerButton: { height: 52 },
  googleButton: {
    borderRadius: BUTTON_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // Apple sets its button's label in the system font at ~19pt semibold, so the
  // Google label matches it rather than the app's own type scale. Two sign-in
  // buttons with different type sizes is the same mismatch in another channel.
  googleLabel: { fontFamily: Font.sansSemi, fontSize: 17, lineHeight: 22 },
  quiet: { alignItems: 'center', paddingVertical: Space.md, opacity: 0.6 },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22,19,15,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Gutter,
    paddingTop: Space.xl,
    paddingBottom: Space.xxl + Space.xl,
    gap: Space.md,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontFamily: Font.sansMedium, fontSize: 15, lineHeight: 18 },
});
