import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface, useVerdictColors } from '@/constants/design';
import { apiFetch } from '@/lib/api';
import { HEALTH_DATA_URL, PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth-context';
import { trialDaysRemaining, type Entitlement } from '@/lib/entitlement';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, useTranslation } from '@/lib/i18n';
import { goBackOrHome } from '@/lib/navigation';

// Screen 12 — Account.
//
// Exists for one required thing and one honest thing. The required thing is
// in-app account deletion: App Store guideline 5.1.1(v) says an app that lets
// you make an account must let you unmake it here, not by emailing support.
//
// The honest thing is telling you what deletion actually removes before you
// tap it. A confirmation dialog that only says "are you sure?" makes someone
// guess whether their scan history survives; this screen lists it.
//
// It also holds display language. That control used to live in the footer of
// the history screen, where it was invisible to anyone not already browsing
// past scans — and it is not a scanning control, it is a setting about the
// reader. It changes the analysis language too, so the row says so.
//
// No verdict ink except on the delete control. Those three colours mean a
// verdict about food, and spending one on a settings row would cheapen the only
// signal the app has — but a permanent deletion is the one place a warning
// colour is telling the truth.

interface AccountDetails extends Entitlement {
  email: string | null;
  firstName: string | null;
  createdAt: string | null;
}

/**
 * Where Apple lets someone cancel.
 *
 * We cannot cancel a subscription from inside the app — StoreKit does not allow
 * it, and neither does any wrapper around it. The only honest thing an app can
 * do is hand the person straight to the place that can, which is this deep
 * link. Hiding it, or making them hunt through Settings, is the pattern that
 * produces refund requests and one-star reviews.
 */
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export default function AccountScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();
  const surface = useSurface();
  const verdictColors = useVerdictColors();
  const { user, signOut, deleteAccount } = useAuth();

  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Best effort: the screen's job is deletion and sign-out, and neither
    // depends on the balance loading.
    apiFetch<AccountDetails>('/api/account/scan-balance')
      .then(setDetails)
      .catch(() => setDetails(null));
  }, []);

  if (!user) return <Redirect href="/sign-in" />;

  function confirmDelete() {
    Alert.alert(t('account.deleteConfirmTitle'), t('account.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.deleteConfirmAction'), style: 'destructive', onPress: () => void remove() },
    ]);
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteAccount();
      // Replace, not push: there is no account left to come back to.
      router.replace('/sign-in');
    } catch (error: any) {
      // Still signed in, and honest about it — the account was not deleted.
      Alert.alert(t('account.deleteFailed'), error?.message ?? t('common.tryAgain'));
    } finally {
      setDeleting(false);
    }
  }

  const purchased = details?.purchasedScanBalance ?? 0;
  const sub = details?.subscription;
  const trialDays = details ? trialDaysRemaining(details) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={goBackOrHome} hitSlop={12}>
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            ‹ {t('common.back')}
          </ThemedText>
        </Pressable>

        <ThemedText style={[Type.title, { color: surface.ink }]}>{t('account.title')}</ThemedText>

        {/* Who is signed in. Mono, because it is a record rather than a claim. */}
        <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
          <Row label={t('account.signedInAs')} value={user.email ?? t('account.noEmail')} />
          {user.firstName ? <Row label={t('account.name')} value={user.firstName} /> : null}
          {details?.createdAt ? (
            <Row
              label={t('account.memberSince')}
              value={new Date(details.createdAt).toLocaleDateString()}
            />
          ) : null}
        </View>

        {/* Subscription.
            Status first, then the way out. Someone opening this screen mid-trial
            is usually here to work out when they get charged or how to stop it,
            and both answers are on the card rather than a tap away. */}
        <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
          <View style={styles.row}>
            <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
              {t('account.subscriptionLabel')}
            </ThemedText>
            <ThemedText style={[Type.body, { color: surface.ink }]}>
              {sub?.status === 'trialing'
                ? t('account.subTrialing', { days: trialDays })
                : sub?.status === 'grace'
                  ? t('account.subGrace')
                  : sub?.active
                    ? t(sub.plan === 'annual' ? 'account.subAnnual' : 'account.subMonthly')
                    : t('account.subFree', {
                        count: details?.freeScansRemaining ?? 0,
                      })}
            </ThemedText>
            {sub?.expiresAt && sub.active ? (
              <ThemedText style={[Type.meta, { color: surface.inkMuted }]}>
                {t(sub.status === 'trialing' ? 'account.subChargeOn' : 'account.subRenewsOn', {
                  date: new Date(sub.expiresAt).toLocaleDateString(),
                })}
              </ThemedText>
            ) : null}
          </View>

          <Pressable
            style={[styles.action, { borderColor: surface.rule }]}
            onPress={() =>
              sub?.active
                ? void Linking.openURL(APPLE_SUBSCRIPTIONS_URL)
                : router.push('/paywall')
            }
            accessibilityRole="button"
          >
            <ThemedText style={[Type.label, { color: surface.ink }]}>
              {sub?.active ? t('account.manageSubscription') : t('account.seePlans')}
            </ThemedText>
          </Pressable>
        </View>

        {/* Display language. Pills rather than a picker: three options fit on
            one line, and seeing all three beats tapping to discover them. */}
        <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
          <View style={styles.row}>
            <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
              {t('account.languageLabel')}
            </ThemedText>
            <ThemedText style={[Type.meta, { color: surface.inkMuted }]}>
              {t('account.languageNote')}
            </ThemedText>
          </View>
          <View style={styles.languageRow}>
            {SUPPORTED_LANGUAGES.map((code) => {
              const active = code === language;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLanguage(code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.pill,
                    { borderColor: surface.rule },
                    active && { backgroundColor: surface.ink, borderColor: surface.ink },
                  ]}
                >
                  <ThemedText
                    style={[styles.pillText, { color: active ? surface.card : surface.inkMuted }]}
                  >
                    {LANGUAGE_NAMES[code]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[styles.action, { borderColor: surface.rule }]}
          onPress={() => void signOut().then(() => router.replace('/sign-in'))}
        >
          <ThemedText style={[Type.label, { color: surface.ink }]}>
            {t('home.signOut')}
          </ThemedText>
        </Pressable>

        {/* Deletion, stated in full before it is offered. */}
        <View style={[styles.danger, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('account.dangerLabel')}
          </ThemedText>
          <ThemedText style={[Type.body, { color: surface.ink }]}>
            {t('account.deleteExplain')}
          </ThemedText>
          {(
            [
              'account.deleteItemProfiles',
              'account.deleteItemHistory',
              'account.deleteItemAccount',
            ] as const
          ).map((key) => (
            <ThemedText key={key} style={[styles.bullet, { color: surface.inkMuted }]}>
              — {t(key)}
            </ThemedText>
          ))}
          {purchased > 0 ? (
            <ThemedText style={[Type.meta, { color: surface.inkMuted }]}>
              {t('account.deleteScansWarning', { count: purchased })}
            </ThemedText>
          ) : null}
          {/* The one thing deletion does NOT do. Apple owns the subscription,
              so removing the account leaves it billing — and someone who
              deleted their account and then kept being charged has a refund
              request and a fair grievance. */}
          {sub?.active ? (
            <ThemedText style={[Type.meta, { color: surface.inkMuted }]}>
              {t('account.deleteSubWarning')}
            </ThemedText>
          ) : null}
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            {t('account.deleteIrreversible')}
          </ThemedText>

          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={[styles.deleteButton, { borderColor: verdictColors.avoid.ink }]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={verdictColors.avoid.ink} />
            ) : (
              <ThemedText style={[styles.deleteLabel, { color: verdictColors.avoid.ink }]}>
                {t('account.delete')}
              </ThemedText>
            )}
          </Pressable>
        </View>

        {/* The legal documents, reachable from inside the app rather than only
            from the App Store listing. The health-data policy is a peer link
            rather than a line inside the privacy policy, because Washington's
            My Health My Data Act requires it to be linked distinctly. */}
        <View style={styles.legal}>
          <LegalLink label={t('account.privacy')} url={PRIVACY_URL} />
          <LegalLink label={t('account.terms')} url={TERMS_URL} />
          <LegalLink label={t('account.healthData')} url={HEALTH_DATA_URL} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A link out to a legal document. hitSlop because the label is small. */
function LegalLink({ label, url }: { label: string; url: string }) {
  const surface = useSurface();
  return (
    <Pressable onPress={() => void Linking.openURL(url)} hitSlop={10} accessibilityRole="link">
      <ThemedText style={[Type.meta, styles.legalLabel, { color: surface.inkFaint }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const surface = useSurface();
  return (
    <View style={styles.row}>
      <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>{label}</ThemedText>
      <ThemedText style={[styles.rowValue, { color: surface.ink }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Gutter, gap: Space.lg, paddingBottom: Space.xxl },

  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.md,
  },
  row: { gap: 2 },
  legal: { alignItems: 'center', gap: Space.sm, paddingTop: Space.md },
  legalLabel: { textDecorationLine: 'underline' },
  rowValue: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18 },

  languageRow: { flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 32,
    justifyContent: 'center',
  },
  pillText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },

  action: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    alignItems: 'center',
  },

  danger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Space.lg,
    marginTop: Space.md,
    gap: Space.sm,
  },
  bullet: { fontFamily: Font.mono, fontSize: 12, lineHeight: 18 },
  deleteButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    alignItems: 'center',
    marginTop: Space.sm,
  },
  deleteLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
});
