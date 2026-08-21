import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface, useVerdictColors } from '@/constants/design';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
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
// No verdict ink except on the delete control. Those three colours mean a
// verdict about food, and spending one on a settings row would cheapen the only
// signal the app has — but a permanent deletion is the one place a warning
// colour is telling the truth.

interface AccountDetails {
  email: string | null;
  firstName: string | null;
  createdAt: string | null;
  totalScansAvailable: number;
  purchasedScanBalance: number;
}

export default function AccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
      </ScrollView>
    </SafeAreaView>
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
  rowValue: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18 },

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
