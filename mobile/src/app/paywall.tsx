import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark } from '@/components/aperture-mark';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Lamplight, Radius, Space, Type } from '@/constants/design';
import { goBackOrHome } from '@/lib/navigation';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

// Screen 11 — Monetisation · paywall.
//
// Ink ground, and no verdict colour anywhere: the three inks mean a verdict,
// and a green "recommended" badge on a price would spend the app's only
// trusted signal on selling something.
//
// The screen leads with what is actually left today rather than with a price.
// Someone who hits this has just been stopped mid-scan, and the honest thing
// to show first is the number that stopped them.
//
// NOT WIRED TO PURCHASING. Taking money needs RevenueCat and IAP products
// configured in App Store Connect; until those exist this screen is
// deliberately a dead end rather than a button that fails silently.

interface Balance {
  dailyFreeScansUsed: number;
  dailyFreeScansLimit: number;
  dailyFreeScansRemaining: number;
  purchasedScanBalance: number;
  totalScansAvailable: number;
  nextDailyReset: string | null;
}

const PLANS = [
  { id: 'pack20', scans: 20, key: 'paywall.pack20' },
  { id: 'pack100', scans: 100, key: 'paywall.pack100' },
] as const;

export default function PaywallScreen() {
  const { t } = useTranslation();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [selected, setSelected] = useState<string>(PLANS[0].id);

  useEffect(() => {
    apiFetch<Balance>('/api/account/scan-balance')
      .then(setBalance)
      .catch(() => setBalance(null));
  }, []);

  function purchase() {
    // Deliberately explicit rather than a spinner that goes nowhere: an app
    // that appears to take a payment and doesn't is worse than one that says
    // the shop isn't open.
    Alert.alert(t('paywall.unavailableTitle'), t('paywall.unavailableBody'));
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={goBackOrHome} hitSlop={12}>
          <ThemedText style={[Type.meta, { color: Lamplight.inkFaint }]}>
            ✕ {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.head}>
          <ApertureMark size={44} color={Lamplight.ink} />
          <ThemedText style={[Type.title, { color: Lamplight.ink }]}>
            {t('paywall.title')}
          </ThemedText>
          <ThemedText style={[Type.reason, { color: Lamplight.inkMuted }]}>
            {t('paywall.body')}
          </ThemedText>
        </View>

        {/* What's left today — the machine reporting a count, so mono. */}
        <View style={[styles.balance, { borderColor: Lamplight.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: Lamplight.inkFaint }]}>
            {t('paywall.remaining')}
          </ThemedText>
          {balance === null ? (
            <ActivityIndicator size="small" color={Lamplight.ink} />
          ) : (
            <>
              <ThemedText style={styles.count}>{balance.totalScansAvailable}</ThemedText>
              <ThemedText style={[Type.meta, { color: Lamplight.inkMuted }]}>
                {t('paywall.breakdown', {
                  free: balance.dailyFreeScansRemaining,
                  limit: balance.dailyFreeScansLimit,
                  purchased: balance.purchasedScanBalance,
                })}
              </ThemedText>
            </>
          )}
        </View>

        <View style={styles.plans}>
          {PLANS.map((plan) => {
            const active = plan.id === selected;
            return (
              <Pressable
                key={plan.id}
                onPress={() => setSelected(plan.id)}
                style={[
                  styles.plan,
                  { borderColor: active ? Lamplight.ink : Lamplight.rule },
                  active && { backgroundColor: Lamplight.card },
                ]}
              >
                <View style={styles.planText}>
                  <ThemedText style={[Type.label, { color: Lamplight.ink }]}>
                    {t(plan.key)}
                  </ThemedText>
                  <ThemedText style={[Type.meta, { color: Lamplight.inkMuted }]}>
                    {t('paywall.scanCount', { count: plan.scans })}
                  </ThemedText>
                </View>
                {/* Selection is a mono mark, not a coloured tick. */}
                <ThemedText style={styles.tick}>{active ? '✓' : ''}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.primary, { backgroundColor: Lamplight.ink }]} onPress={purchase}>
          <ThemedText style={[styles.primaryLabel, { color: Lamplight.paper }]}>
            {t('paywall.cta')}
          </ThemedText>
        </Pressable>

        <ThemedText style={[Type.meta, styles.fine, { color: Lamplight.inkFaint }]}>
          {t('paywall.fine')}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Lamplight.paper },
  content: { padding: Gutter, gap: Space.xl, paddingBottom: Space.xxl },
  head: { gap: Space.md, marginTop: Space.lg },

  balance: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.xs,
  },
  // The count is set in mono, not the display serif: Newsreader belongs to the
  // verdict word alone, and a big serif number here would read as one.
  count: { fontFamily: Font.monoMedium, fontSize: 40, lineHeight: 50, color: Lamplight.ink },

  plans: { gap: Space.md },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.flat,
    padding: Space.lg,
  },
  planText: { flex: 1, gap: 2 },
  tick: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20, color: Lamplight.ink },

  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  fine: { textAlign: 'center' },
});
