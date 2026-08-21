import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnalysisView } from '@/components/analysis-view';
import { ThemedText } from '@/components/themed-text';
import { goBackOrHome } from '@/lib/navigation';
import { apiFetch } from '@/lib/api';
import { deleteScan, scanToAnalysisResult } from '@/lib/history';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { getActiveProfileId, listProfiles } from '@/lib/profiles';
import type { AnalysisResult, PersonalFlag, ScanHistory } from '@/lib/types';

// A stored scan, optionally re-personalized server-side against the currently
// active profile (see the ?profileId= handling in GET /api/history/:scanId).
type StoredScan = ScanHistory & {
  personalFlags?: PersonalFlag[];
  appliedProfile?: { id: string; name: string };
  checked?: AnalysisResult['checked'];
  closestCall?: AnalysisResult['closestCall'];
  settle?: AnalysisResult['settle'];
};

export default function ScanDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name: string; allergens: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    (async () => {
      try {
        // Re-apply the ACTIVE profile so flags reflect today's allergens rather
        // than whatever was active at scan time.
        //
        // This used to take the DEFAULT profile and ignore the active one
        // entirely, which quietly broke the switcher's own promise — its sheet
        // says "Switching re-checks this scan", and on a replayed scan it did
        // nothing at all. Someone could switch to the family member with the
        // peanut allergy, reopen a scan, and read a card scored for somebody
        // else. The default is still the fallback, for a cold start where
        // nothing has been chosen yet.
        const [profiles, activeId] = await Promise.all([
          listProfiles().catch(() => []),
          getActiveProfileId().catch(() => null),
        ]);
        const active =
          profiles.find((p) => p.id === activeId) ??
          profiles.find((p) => p.isDefault) ??
          profiles[0];
        const profileId = active?.id;
        if (active) {
          setProfile({
            name: active.name,
            allergens: active.allergens.map((a) => a.allergen),
          });
        }
        const query = profileId ? `?profileId=${profileId}` : '';
        const scan = await apiFetch<StoredScan>(`/api/history/${id}${query}`);

        const analysis = scanToAnalysisResult(scan);
        setResult({
          ...analysis,
          personalFlags: scan.personalFlags,
          appliedProfile: scan.appliedProfile,
          // Carried through explicitly: the card's evidence blocks are
          // re-derived server-side per request, and dropping them here would
          // silently strip the reasoning from every replayed scan.
          checked: scan.checked,
          closestCall: scan.closestCall,
          settle: scan.settle,
        });
        setScannedAt(new Date(scan.createdAt).toLocaleDateString());
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [id]);

  // On focus, not on mount. A card scored for the wrong person is the failure
  // this screen has to avoid, and the active profile can change while this
  // screen sits in the stack behind the switcher.
  useFocusEffect(load);

  function confirmDelete() {
    Alert.alert(t('history.deleteTitle'), t('history.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteScan(id);
            goBackOrHome();
          } catch (e: any) {
            Alert.alert(t('history.deleteFailed'), e.message);
          }
        },
      },
    ]);
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: surface.paper }]}>
        <ThemedText style={[Type.body, styles.center, { color: surface.ink }]}>{error}</ThemedText>
        <Pressable onPress={goBackOrHome}>
          <ThemedText style={[Type.label, { color: surface.ink }]}>{t('common.back')}</ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!result) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: surface.paper }]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable onPress={goBackOrHome} hitSlop={12}>
            <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
              ‹ {t('history.title')}
            </ThemedText>
          </Pressable>
          {/* Destructive, but still ink: the three saturated inks mean a
              verdict, and a red Delete would be the app's only other colour. */}
          <Pressable onPress={confirmDelete} hitSlop={12}>
            <ThemedText style={[Type.meta, styles.delete, { color: surface.inkMuted }]}>
              {t('common.delete')}
            </ThemedText>
          </Pressable>
        </View>

        <AnalysisView
          result={result}
          subtitle={scannedAt ? t('history.scannedOn', { date: scannedAt }) : undefined}
          profileName={profile?.name}
          profileAllergens={profile?.allergens}
          controls={
            <Pressable
              style={[styles.primary, { backgroundColor: surface.ink }]}
              onPress={() => router.replace('/')}
            >
              <ThemedText style={[styles.primaryLabel, { color: surface.card }]}>
                {t('results.scanAnother')}
              </ThemedText>
            </Pressable>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
    padding: Gutter,
  },
  center: { textAlign: 'center' },
  content: { padding: Gutter, gap: Space.xl, paddingBottom: Space.xxl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  delete: { textDecorationLine: 'underline' },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
});
