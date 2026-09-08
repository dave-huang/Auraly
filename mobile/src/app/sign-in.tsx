import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevelyLockup } from '@/components/aperture-mark';
import { LanguagePicker } from '@/components/language-picker';
import { ProviderButtons } from '@/components/sign-in-providers';
import { ThemedText } from '@/components/themed-text';
import { Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { goHome } from '@/lib/navigation';

/**
 * Sign in, when it is a destination rather than a drawer.
 *
 * ONE ARRIVAL IS LEFT, and it is nobody's choice: a claimed device that has
 * been signed out, sent here by the viewfinder when the server refuses a scan.
 * The person has an account and simply has to be back in it. There is no "Not
 * now" and no back control, because there is nothing here to defer.
 *
 * TWO VARIANTS USED TO LIVE HERE, and both were screens standing in front of
 * these same two buttons.
 *
 *   then=paywall  reached mid-purchase, because an anonymous purchase cannot
 *               be granted. The paywall opens a drawer over itself now.
 *
 *   recover=1   sent by someone whose Apple ID already holds a subscription.
 *               The paywall's own recovery screen had already made the whole
 *               argument and then handed off to this one, which made it a
 *               second time above an identical pair of buttons. It carries
 *               the buttons itself now — see RecoverView — and finishes the
 *               restore where it starts it.
 *
 * A third, mode=save, was deleted earlier for rendering to nobody at all.
 */
export default function SignInScreen() {
  const { t } = useTranslation();
  const surface = useSurface();

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
        <ThemedText style={[Type.reason, styles.tagline, { color: surface.inkMuted }]}>
          {t('signIn.tagline')}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <ProviderButtons onSignedIn={goHome} />
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
});
