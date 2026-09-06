import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevelyLockup } from '@/components/aperture-mark';
import { LanguagePicker } from '@/components/language-picker';
import { ProviderButtons } from '@/components/sign-in-providers';
import { ThemedText } from '@/components/themed-text';
import { Space, Type, useSurface } from '@/constants/design';
import { restoreAndGrant } from '@/lib/entitlement';
import { useTranslation } from '@/lib/i18n';
import { goHome } from '@/lib/navigation';
import { ReceiptInUseError } from '@/lib/purchases';

/**
 * Sign in, when it is a destination rather than a drawer.
 *
 * The common case is no longer this screen. Welcome offers sign-in in a sheet
 * without leaving the page, which is what somebody reinstalling actually wants.
 * What is left here are the two moments that deserve their own page because
 * they carry their own argument:
 *
 *   then=paywall  reached mid-purchase, because an anonymous purchase cannot
 *               be granted. The one case that is over in seconds: signing in
 *               returns to the paywall, which picks the purchase back up on
 *               its own, so this screen exists to say WHY it interrupted and
 *               that nothing has been charged.
 *
 *   recover=1   sent from the subscription screen, by someone whose Apple ID
 *               already holds a subscription. They did not come to make an
 *               account; they came to get back something they already pay for.
 *               So this screen FINISHES that job rather than handing them
 *               back — see finishRecovery.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const params = useLocalSearchParams<{ recover?: string; then?: string }>();
  const purchasing = params.then === 'paywall';
  const recovering = params.recover === '1';

  // A THIRD VARIANT USED TO LIVE HERE, mode=save: "keep this", offered over a
  // verdict or beside the add-a-profile row. Both of those sit behind the
  // camera and the camera is behind an account, so it was written for a
  // version of the app where you could scan without one and it rendered for
  // nobody. Somebody anonymous still has a way to make an account: the drawer
  // on Welcome, which is where "I already have one" was always going to look.
  /** The restore this screen runs for itself, once the account exists. */
  const [restoring, setRestoring] = useState(false);

  function done(subscribed: boolean) {
    // ALREADY PAYING BEATS EVERY OTHER DESTINATION.
    //
    // The account this person just signed into holds a live subscription —
    // the server was asked outright before we got here, so this is not a
    // guess. Sending them anywhere but the camera means showing a price to
    // somebody who has already paid it, which is the one thing this screen
    // must never do.
    if (subscribed) return goHome();

    // THEY CAME HERE TO GET SOMETHING BACK. FINISH GETTING IT BACK.
    //
    // Signing in was never the point of this screen; it was the missing half
    // of a restore that had already found the subscription. This used to end
    // by returning them to the paywall, which then had no idea a restore was
    // half-done and simply showed the plans again — so the only way in was to
    // tap Restore a second time, with nothing on screen saying so. Whether
    // one tap or two was needed came down to a webhook race nobody can see.
    if (recovering) return void finishRecovery();

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

  /**
   * The second half of the restore, run without being asked.
   *
   * Signing in tells RevenueCat who this is; it does not hand it the receipt
   * again, and the receipt was synced under the anonymous id the first restore
   * ran on. So the restore is genuinely run twice, and the second one is this.
   *
   * Failure lands on the paywall rather than in the app, because the paywall
   * is the screen that can explain the state and offer another try. Nothing
   * here may ever suggest buying again: the money has already moved.
   */
  async function finishRecovery() {
    setRestoring(true);
    try {
      switch (await restoreAndGrant(true)) {
        case 'granted':
          goHome();
          return;
        case 'stuck':
          Alert.alert(t('paywall.foundTitle'), t('paywall.foundStuckBody'));
          break;
        // 'noAccount' cannot happen — we have just made one — and it is
        // handled with 'nothing' rather than left to fall through silently.
        case 'noAccount':
        case 'nothing':
          Alert.alert(t('paywall.restoreNoneTitle'), t('paywall.restoreNoneBody'));
          break;
      }
    } catch (error: any) {
      if (error instanceof ReceiptInUseError) {
        Alert.alert(t('paywall.receiptInUseTitle'), t('paywall.receiptInUseBody'));
      } else {
        Alert.alert(t('paywall.failedTitle'), error?.message ?? t('common.tryAgain'));
      }
    } finally {
      setRestoring(false);
    }
    router.replace('/paywall?gate=1');
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
        ) : purchasing ? (
          /* The ask on its own. Everything that used to sit under it was
             explanation, and this is the last screen before somebody pays. */
          <ThemedText style={[Type.title, styles.tagline, { color: surface.ink }]}>
            {t('signIn.buyTitle')}
          </ThemedText>
        ) : (
          <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
            {t('signIn.tagline')}
          </ThemedText>
        )}
      </View>

      <View style={styles.actions}>
        {restoring ? (
          /* Holds the row's height, exactly as ProviderButtons does while a
             provider is working, so the block does not collapse and jump
             under the thumb that just pressed it. */
          <View style={styles.working}>
            <ActivityIndicator color={surface.ink} />
            <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
              {t('signIn.restoring')}
            </ThemedText>
          </View>
        ) : (
          <>
            <ProviderButtons onSignedIn={done} />

            {/* Mid-purchase only, and it is their only way out: this screen
                has no other back control. Somebody who came here to get their
                account back has nothing to defer. */}
            {purchasing && (
              <Pressable
                style={styles.later}
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
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  tagline: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: 12, paddingBottom: 24, minHeight: 140, justifyContent: 'flex-end' },
  later: { alignItems: 'center', paddingVertical: 12, opacity: 0.6 },
  working: { minHeight: 116, alignItems: 'center', justifyContent: 'center', gap: Space.md },
});
