import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AllergenField,
  ConditionsField,
  DietaryField,
  NameField,
  toAllergenEntries,
  toAllergenMap,
} from '@/components/profile-fields';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface, useVerdictColors } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { goBackOrHome } from '@/lib/navigation';
import { deleteProfile, listProfiles, updateProfile } from '@/lib/profiles';
import { getLastProfile, getLastResult, personalizeAnalysis, replaceLastVerdict } from '@/lib/scan';
import { toConditionMap, toDietaryMap } from '@/lib/types';
import type {
  ProfileAllergen,
  DietaryRule,
  Profile,
  ProfileCondition,
  Strictness,
} from '@/lib/types';

// Screen 10a — Profile editing.
//
// The counterpart to onboarding, and the reason it exists: allergies are not
// set once. A diagnosis changes, a severity turns out to have been understated,
// a child outgrows something. Without this screen the only way to record that
// was to create a second profile and leave a wrong one standing beside it.
//
// One page, not a wizard. Onboarding's four steps exist to walk someone who
// has never answered these questions before; someone coming back to correct one
// field should not be marched past three others to reach it.
//
// The same asymmetry as the verdict card: saving is a plain ink button, and
// deleting is the only thing on the screen allowed to carry the Avoid ink —
// spent on a destructive action, not on a preference.

export default function ProfileEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const surface = useSurface();
  const verdictColors = useVerdictColors();

  const [loaded, setLoaded] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [otherProfiles, setOtherProfiles] = useState(0);

  // Arriving with no id is knowable on the first render, so it is derived
  // rather than pushed into state by the effect below.
  const missing = !id || notFound;

  const [name, setName] = useState('');
  const [allergens, setAllergens] = useState<Map<string, ProfileAllergen>>(new Map());
  const [dietary, setDietary] = useState<Map<DietaryRule, Strictness>>(new Map());
  const [conditions, setConditions] = useState<Map<ProfileCondition, Strictness>>(new Map());
  const [busy, setBusy] = useState(false);

  // Loaded from the list rather than a by-id endpoint so a cold start on this
  // route — a deep link, a reload — populates the form instead of showing an
  // empty one over someone's real allergens.
  useEffect(() => {
    if (!id) return;
    let live = true;
    listProfiles()
      .then((list) => {
        if (!live) return;
        const profile = list.find((p) => p.id === id);
        if (!profile) {
          setNotFound(true);
          return;
        }
        setLoaded(profile);
        setOtherProfiles(list.length - 1);
        setName(profile.name);
        setAllergens(toAllergenMap(profile.allergens));
        setDietary(toDietaryMap(profile.dietaryRules));
        setConditions(toConditionMap(profile.conditions));
      })
      .catch(() => live && setNotFound(true));
    return () => {
      live = false;
    };
  }, [id]);

  async function save() {
    if (!loaded) return;
    setBusy(true);
    try {
      const saved = await updateProfile(loaded.id, {
        name: name.trim() || loaded.name,
        allergens: toAllergenEntries(allergens),
        dietaryRules: Array.from(dietary, ([rule, strictness]) => ({ rule, strictness })),
        conditions: Array.from(conditions, ([condition, strictness]) => ({ condition, strictness })),
      });

      // A verdict on screen behind this was decided by the rules that just
      // changed. Re-score it rather than leave an answer standing that the new
      // profile would no longer give.
      const held = getLastResult();
      if (held && getLastProfile()?.id === saved.id) {
        try {
          const rescored = await personalizeAnalysis(held, saved.id);
          replaceLastVerdict(rescored, {
            id: saved.id,
            name: saved.name,
            allergens: saved.allergens.map((a) => a.allergen),
          });
        } catch {
          // The edit is saved either way; a stale card behind us is corrected
          // on the next scan or profile switch. Failing the save here would be
          // the wrong trade.
        }
      }
      goBackOrHome();
    } catch (error: any) {
      Alert.alert(t('profileEdit.saveFailed'), error?.message ?? t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!loaded) return;
    Alert.alert(
      t('profileEdit.deleteTitle', { name: loaded.name }),
      t('profileEdit.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => void remove() },
      ],
      { cancelable: true },
    );
  }

  async function remove() {
    if (!loaded) return;
    setBusy(true);
    try {
      await deleteProfile(loaded.id);
      goBackOrHome();
    } catch (error: any) {
      Alert.alert(t('profileEdit.deleteFailed'), error?.message ?? t('common.tryAgain'));
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
        <View style={styles.centered}>
          <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
            {t('profileEdit.notFound')}
          </ThemedText>
          <Pressable onPress={goBackOrHome} hitSlop={12}>
            <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
              ‹ {t('common.back')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={surface.ink} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={goBackOrHome} hitSlop={12}>
            <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
              ‹ {t('common.back')}
            </ThemedText>
          </Pressable>

          <View style={styles.head}>
            <ThemedText style={[Type.title, { color: surface.ink }]}>
              {t('profileEdit.title')}
            </ThemedText>
            <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
              {t('profileEdit.subtitle')}
            </ThemedText>
          </View>

          <Section label={t('onboarding.nameLabel')}>
            <NameField value={name} onChange={setName} />
          </Section>

          <Section label={t('onboarding.allergensLabel')}>
            <AllergenField allergens={allergens} onChange={setAllergens} />
          </Section>

          <Section label={t('onboarding.dietaryLabel')}>
            <DietaryField dietary={dietary} onChange={setDietary} />
          </Section>

          <Section label={t('onboarding.conditionsLabel')}>
            <ConditionsField conditions={conditions} onChange={setConditions} />
          </Section>

          {/* Delete lives at the bottom, below a rule, outside the form. The
              server refuses to delete a last remaining profile, so the control
              is hidden rather than offered and then denied. */}
          {otherProfiles > 0 ? (
            <View style={[styles.danger, { borderTopColor: surface.rule }]}>
              <Pressable
                onPress={confirmDelete}
                disabled={busy}
                style={[styles.deleteButton, { borderColor: verdictColors.avoid.ink }]}
              >
                <ThemedText style={[styles.deleteLabel, { color: verdictColors.avoid.ink }]}>
                  {t('profileEdit.delete')}
                </ThemedText>
              </Pressable>
              <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                {t('profileEdit.deleteNote')}
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.danger, { borderTopColor: surface.rule }]}>
              <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                {t('profileEdit.lastProfileNote')}
              </ThemedText>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: surface.rule }]}>
          <Pressable
            style={[styles.primary, { backgroundColor: surface.ink }, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void save()}
          >
            <ThemedText style={[styles.primaryLabel, { color: surface.card }]}>
              {busy ? t('onboarding.saving') : t('profileEdit.save')}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const surface = useSurface();
  return (
    <View style={[styles.section, { borderTopColor: surface.rule }]}>
      <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.lg },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.xxl,
    gap: Space.md,
  },
  head: { gap: Space.sm, marginBottom: Space.sm },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Space.lg, gap: Space.md },

  danger: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Space.lg, gap: Space.sm },
  deleteButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: Space.md,
    alignItems: 'center',
  },
  deleteLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },

  footer: {
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  disabled: { opacity: 0.5 },
});
