import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark } from '@/components/aperture-mark';
import { ThemedText } from '@/components/themed-text';
import {
  Font,
  Gutter,
  RISK_TO_VERDICT,
  Radius,
  Space,
  Type,
  useSurface,
  useVerdictColors,
} from '@/constants/design';
import { goBackOrHome } from '@/lib/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { getActiveProfileId, listProfiles, setActiveProfileId } from '@/lib/profiles';
import { getLastProfile, getLastResult, personalizeAnalysis, replaceLastVerdict } from '@/lib/scan';
import type { Profile } from '@/lib/types';
import { localizeAllergen } from '@/lib/verdict';

// Screen 10 — Multi-profile · profile switcher.
//
// This used to be on ink ground in BOTH themes, on the reasoning that the
// weight of a dark surface is what stops the tap being mistaken for a filter.
// The reasoning was sound and the result was not: in light mode the app went
// welcome, onboarding, results — all paper — and then dropped into two ink
// screens, which reads as a rendering fault rather than as emphasis. Emphasis
// that a person reads as a bug is not emphasis. It follows the theme now, and
// the weight comes from the card and the rule instead.
//
// Switching re-evaluates the scan already on screen rather than sending the
// user back to the camera — the label read is done, and only the matching
// changes.

export default function ProfileSwitcherScreen() {
  const surface = useSurface();
  const verdict = useVerdictColors();
  const { user } = useAuth();
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
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <View style={styles.header}>
        <Pressable onPress={goBackOrHome} hitSlop={12}>
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            ‹ {t('common.back')}
          </ThemedText>
        </Pressable>
        <ThemedText style={[Type.title, { color: surface.ink }]}>{t('profiles.title')}</ThemedText>
        <ThemedText style={[Type.meta, { color: surface.inkMuted }]}>
          {t('profiles.subtitle')}
        </ThemedText>
      </View>

      {profiles === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={surface.ink} />
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
              ? verdict[RISK_TO_VERDICT.high]
              : profile.allergens.length > 0
                ? verdict[RISK_TO_VERDICT.moderate]
                : null;

            return (
              <Pressable
                key={profile.id}
                style={[
                  styles.row,
                  { backgroundColor: surface.card, borderColor: surface.rule },
                  active && { borderColor: surface.inkMuted },
                ]}
                onPress={() => void choose(profile)}
                disabled={switchingTo !== null}
              >
                {worst ? <View style={[styles.rowEdge, { backgroundColor: worst.ink }]} /> : null}
                <ApertureMark
                  size={22}
                  color={active ? surface.ink : surface.inkMuted}
                  style={styles.rowMark}
                />
                <View style={styles.rowText}>
                  <ThemedText style={[Type.label, { color: surface.ink }]}>
                    {profile.name}
                  </ThemedText>
                  <ThemedText
                    style={[styles.rowMeta, { color: surface.inkMuted }]}
                    numberOfLines={2}
                  >
                    {allergens.join(' · ') || t('verdict.noAllergens')}
                  </ThemedText>
                </View>
                {switchingTo === profile.id ? (
                  <ActivityIndicator size="small" color={surface.ink} />
                ) : active ? (
                  <ThemedText style={[styles.check, { color: surface.ink }]}>✓</ThemedText>
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
                  style={[styles.editButton, { borderColor: surface.rule }]}
                >
                  <ThemedText style={[styles.editText, { color: surface.inkMuted }]}>
                    {t('profiles.edit')}
                  </ThemedText>
                </Pressable>
              </Pressable>
            );
          })}

          {/* Adding a second profile needs an account.
              Not a paywall move — there is physically nowhere to put it. Before
              sign-in the app holds exactly ONE profile, in the keychain, and
              sending an anonymous user to onboarding here would silently
              overwrite the allergies they already entered. So this row offers
              the thing that actually unblocks them. */}
          <Pressable
            style={[styles.addRow, { borderColor: surface.rule }]}
            onPress={() =>
              user
                ? // `mode=add` — the same questions without the first-run
                  // introduction, and it ends back here rather than at the
                  // paywall. Somebody who already pays for this, adding their
                  // second child, must not be sold to again.
                  router.push('/onboarding?mode=add')
                : router.push({
                    pathname: '/sign-in',
                    // Name the person whose profile is about to be preserved.
                    // Without it the sign-in screen falls back to the "Me"
                    // placeholder and offers to save "Me's profile" to someone
                    // looking at a card that says Maya.
                    params: {
                      mode: 'save',
                      name: profiles.find((p) => p.id === activeId)?.name ?? '',
                    },
                  })
            }
          >
            <ThemedText style={[Type.label, { color: surface.ink }]}>
              {user ? t('profiles.add') : t('profiles.addNeedsAccount')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: Gutter, paddingTop: Space.sm, paddingBottom: Space.lg, gap: Space.xs },
  list: { paddingHorizontal: Gutter, paddingBottom: Space.xxl, gap: Space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    paddingLeft: Space.lg + 3,
    overflow: 'hidden',
  },
  rowEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  rowMark: { opacity: 0.9 },
  rowText: { flex: 1, gap: 2 },
  rowMeta: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },
  check: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  editButton: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  editText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },
  addRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    padding: Space.lg,
    alignItems: 'center',
  },
});
