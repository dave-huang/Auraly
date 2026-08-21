import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark } from '@/components/aperture-mark';
import { ThemedText } from '@/components/themed-text';
import {
  Font,
  Gutter,
  Lamplight,
  RISK_TO_VERDICT,
  Radius,
  Space,
  Type,
  VerdictDark,
} from '@/constants/design';
import { goBackOrHome } from '@/lib/navigation';
import { useTranslation } from '@/lib/i18n';
import { getActiveProfileId, listProfiles, setActiveProfileId } from '@/lib/profiles';
import { getLastProfile, getLastResult, personalizeAnalysis, replaceLastVerdict } from '@/lib/scan';
import type { Profile } from '@/lib/types';
import { localizeAllergen } from '@/lib/verdict';

// Screen 10 — Multi-profile · profile switcher.
//
// On ink ground in both themes, because this is the one screen that is about
// *whose* body the next answer is for. The weight of the dark surface is the
// point: it stops the tap being mistaken for a filter.
//
// Switching re-evaluates the scan already on screen rather than sending the
// user back to the camera — the label read is done, and only the matching
// changes.

export default function ProfileSwitcherScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  // Reloaded on focus, not once on mount: the edit sheet is presented over this
  // screen, so a rename or a deletion has to be visible the moment it closes.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([listProfiles(), getActiveProfileId()])
        .then(([list, stored]) => {
          if (!live) return;
          setProfiles(list);
          setActiveId(
            (stored && list.some((p) => p.id === stored) ? stored : null) ??
              list.find((p) => p.isDefault)?.id ??
              list[0]?.id ??
              null,
          );
        })
        .catch(() => live && setProfiles([]));
      return () => {
        live = false;
      };
    }, []),
  );

  async function choose(profile: Profile) {
    if (profile.id === activeId) {
      goBackOrHome();
      return;
    }
    setSwitchingTo(profile.id);
    setActiveId(profile.id);
    await setActiveProfileId(profile.id);

    const held = getLastResult();
    const scanProfile = {
      id: profile.id,
      name: profile.name,
      allergens: profile.allergens.map((a) => a.allergen),
    };

    if (!held) {
      setSwitchingTo(null);
      goBackOrHome();
      return;
    }

    try {
      const rescored = await personalizeAnalysis(held, profile.id);
      replaceLastVerdict(rescored, scanProfile);
      goBackOrHome();
    } catch (e: any) {
      // The old verdict belongs to the old person, so it cannot be left
      // standing under a new name. Keep the previous profile attached and say
      // the switch didn't take.
      setActiveId(getLastProfile()?.id ?? activeId);
      Alert.alert(t('profiles.switchFailed'), e?.message ?? t('common.tryAgain'));
    } finally {
      setSwitchingTo(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={goBackOrHome} hitSlop={12}>
          <ThemedText style={[Type.meta, { color: Lamplight.inkFaint }]}>
            ‹ {t('common.back')}
          </ThemedText>
        </Pressable>
        <ThemedText style={[Type.title, styles.title]}>{t('profiles.title')}</ThemedText>
        <ThemedText style={[Type.meta, { color: Lamplight.inkMuted }]}>
          {t('profiles.subtitle')}
        </ThemedText>
      </View>

      {profiles === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Lamplight.ink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {profiles.map((profile) => {
            const active = profile.id === activeId;
            // Localized, not the raw matcher keys: "tree_nuts" is what the
            // matcher calls it, not what a person calls it.
            const allergens = profile.allergens.map((a) => localizeAllergen(t, a.allergen));
            // The worst severity a profile carries is the closest thing to a
            // colour it is allowed — and only as a hairline on the row edge.
            // Severity buckets match the server matcher: an intolerance or a
            // preference reads moderate, an allergy or anaphylaxis reads high.
            const worst = profile.allergens.some(
              (a) => a.severity !== 'intolerance' && a.severity !== 'avoid',
            )
              ? VerdictDark[RISK_TO_VERDICT.high]
              : profile.allergens.length > 0
                ? VerdictDark[RISK_TO_VERDICT.moderate]
                : null;

            return (
              <Pressable
                key={profile.id}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => void choose(profile)}
                disabled={switchingTo !== null}
              >
                {worst ? <View style={[styles.rowEdge, { backgroundColor: worst.ink }]} /> : null}
                <ApertureMark
                  size={22}
                  color={active ? Lamplight.ink : Lamplight.inkMuted}
                  style={styles.rowMark}
                />
                <View style={styles.rowText}>
                  <ThemedText style={[Type.label, { color: Lamplight.ink }]}>
                    {profile.name}
                  </ThemedText>
                  <ThemedText style={styles.rowMeta} numberOfLines={2}>
                    {allergens.join(' · ') || t('verdict.noAllergens')}
                  </ThemedText>
                </View>
                {switchingTo === profile.id ? (
                  <ActivityIndicator size="small" color={Lamplight.ink} />
                ) : active ? (
                  <ThemedText style={styles.check}>✓</ThemedText>
                ) : null}

                {/* Editing is its own target inside the row. Tapping the row
                    means "check the next scan against this person"; tapping
                    here means "these rules have changed" — two different
                    intentions that must not share one hit area. */}
                <Pressable
                  onPress={() => router.push({ pathname: '/profile-edit', params: { id: profile.id } })}
                  disabled={switchingTo !== null}
                  hitSlop={10}
                  accessibilityLabel={t('profiles.editLabel', { name: profile.name })}
                  style={styles.editButton}
                >
                  <ThemedText style={styles.editText}>{t('profiles.edit')}</ThemedText>
                </Pressable>
              </Pressable>
            );
          })}

          <Pressable style={styles.addRow} onPress={() => router.push('/onboarding')}>
            <ThemedText style={[Type.label, { color: Lamplight.ink }]}>
              {t('profiles.add')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Lamplight.paper },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: Gutter, paddingTop: Space.sm, paddingBottom: Space.lg, gap: Space.xs },
  title: { color: Lamplight.ink },
  list: { paddingHorizontal: Gutter, paddingBottom: Space.xxl, gap: Space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Lamplight.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Lamplight.rule,
    borderRadius: Radius.flat,
    padding: Space.lg,
    paddingLeft: Space.lg + 3,
    overflow: 'hidden',
  },
  rowActive: { borderColor: Lamplight.inkMuted },
  rowEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  rowMark: { opacity: 0.9 },
  rowText: { flex: 1, gap: 2 },
  rowMeta: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15, color: Lamplight.inkMuted },
  check: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20, color: Lamplight.ink },
  editButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Lamplight.rule,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  editText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15, color: Lamplight.inkMuted },
  addRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Lamplight.rule,
    borderStyle: 'dashed',
    padding: Space.lg,
    alignItems: 'center',
  },
});
