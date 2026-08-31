import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark } from '@/components/aperture-mark';
import {
  AllergenField,
  CONDITION_KEYS,
  ConditionsField,
  DIETARY_KEYS,
  DietaryField,
  NameField,
  SEVERITY_KEYS,
  allergenLabel,
  toAllergenEntries,
} from '@/components/profile-fields';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { createProfile, setActiveProfileId } from '@/lib/profiles';
import type { DietaryRule, ProfileAllergen, ProfileCondition } from '@/lib/types';

// Screens 06 & 07 — Onboarding, four steps.
//
// Onboarding IS profile creation: the profile is what turns a generic
// ingredient lookup into "is this safe for me". It is split into four steps
// rather than one long form because step 2 asks a question people need room to
// answer honestly — how strict to be about each allergen — and a strictness
// control buried under a wall of chips gets left on its default.
//
// The fields themselves live in components/profile-fields so the edit screen
// asks these questions in exactly the same words.

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [allergens, setAllergens] = useState<Map<string, ProfileAllergen>>(new Map());
  const [dietary, setDietary] = useState<Set<DietaryRule>>(new Set());
  const [conditions, setConditions] = useState<Set<ProfileCondition>>(new Set());
  const [saving, setSaving] = useState(false);

  const profileName = name.trim() || t('onboarding.namePlaceholder');

  async function save() {
    setSaving(true);
    try {
      const profile = await createProfile({
        name: profileName,
        isDefault: true,
        allergens: toAllergenEntries(allergens),
        dietaryRules: Array.from(dietary),
        conditions: Array.from(conditions),
      });
      // Make it the active profile immediately — the viewfinder's chip has to
      // name someone the moment onboarding hands over.
      await setActiveProfileId(profile.id);
      // Straight to the paywall, not the camera. With no free scans, sending
      // someone to the viewfinder means they frame a label, take the photo and
      // only then learn they cannot have the answer — effort spent for nothing.
      // Asking before the work is the honest order, and it costs us no scan.
      router.replace('/paywall?gate=1');
    } catch (error: any) {
      Alert.alert(t('onboarding.saveFailed'), error?.message ?? t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  }

  const allergenList = Array.from(allergens.entries());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('onboarding.stepOf', { step, total: TOTAL_STEPS })}
          </ThemedText>
          {/* Same segmented language as the confidence meter — the machine
              reporting position, not a decorative progress bar. */}
          <View style={styles.progress}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  { backgroundColor: i < step ? surface.ink : surface.rule },
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <>
              <ThemedText style={[Type.title, { color: surface.ink }]}>
                {t('onboarding.step1Title')}
              </ThemedText>
              <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
                {t('onboarding.subtitle')}
              </ThemedText>
              <NameField value={name} onChange={setName} autoFocus />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <ThemedText style={[Type.title, { color: surface.ink }]}>
                {t('onboarding.step2Title', { name: profileName })}
              </ThemedText>
              <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
                {t('onboarding.step2Body')}
              </ThemedText>
              <AllergenField allergens={allergens} onChange={setAllergens} />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <ThemedText style={[Type.title, { color: surface.ink }]}>
                {t('onboarding.step3Title')}
              </ThemedText>
              <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
                {t('onboarding.step3Body')}
              </ThemedText>

              <ThemedText style={[Type.eyebrow, styles.groupLabel, { color: surface.inkFaint }]}>
                {t('onboarding.dietaryLabel')}
              </ThemedText>
              <DietaryField dietary={dietary} onChange={setDietary} />

              <ThemedText style={[Type.eyebrow, styles.groupLabel, { color: surface.inkFaint }]}>
                {t('onboarding.conditionsLabel')}
              </ThemedText>
              <ConditionsField conditions={conditions} onChange={setConditions} />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <ThemedText style={[Type.title, { color: surface.ink }]}>
                {t('onboarding.step4Title')}
              </ThemedText>
              <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
                {t('onboarding.step4Body')}
              </ThemedText>

              {/* The confirmation shows the profile as the app will show it
                  from now on — the same chip that rides on the viewfinder. */}
              <View
                style={[styles.summary, { backgroundColor: surface.card, borderColor: surface.rule }]}
              >
                <View style={styles.summaryHead}>
                  <ApertureMark size={22} color={surface.ink} />
                  <ThemedText style={[Type.title, { color: surface.ink }]}>{profileName}</ThemedText>
                </View>

                <SummaryRow
                  label={t('onboarding.allergensLabel')}
                  value={
                    allergenList
                      .map(
                        ([allergen, entry]) =>
                          `${allergenLabel(t, allergen)} (${t(SEVERITY_KEYS[entry.severity])})`,
                      )
                      .join(' · ') || t('onboarding.summaryNone')
                  }
                />
                <SummaryRow
                  label={t('onboarding.dietaryLabel')}
                  value={
                    Array.from(dietary)
                      .map((rule) => t(DIETARY_KEYS[rule]))
                      .join(' · ') || t('onboarding.summaryNone')
                  }
                />
                <SummaryRow
                  label={t('onboarding.conditionsLabel')}
                  value={
                    Array.from(conditions)
                      .map((condition) => t(CONDITION_KEYS[condition]))
                      .join(' · ') || t('onboarding.summaryNone')
                  }
                />
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: surface.rule }]}>
          {step > 1 ? (
            <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={12} style={styles.back}>
              <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                ‹ {t('common.back')}
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}

          <Pressable
            style={[styles.primary, { backgroundColor: surface.ink }, saving && styles.disabled]}
            disabled={saving}
            onPress={() => (step === TOTAL_STEPS ? void save() : setStep((s) => s + 1))}
          >
            <ThemedText style={[styles.primaryLabel, { color: surface.card }]}>
              {step === TOTAL_STEPS
                ? saving
                  ? t('onboarding.saving')
                  : t('onboarding.start')
                : t('onboarding.next')}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const surface = useSurface();
  return (
    <View style={[styles.summaryRow, { borderTopColor: surface.rule }]}>
      <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>{label}</ThemedText>
      <ThemedText style={[Type.body, { color: surface.ink }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Gutter, paddingTop: Space.md, gap: Space.sm },
  progress: { flexDirection: 'row', gap: 3 },
  progressSegment: { flex: 1, height: 3 },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.xl,
    paddingBottom: Space.xxl,
    gap: Space.md,
  },

  groupLabel: { marginTop: Space.lg },

  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.md,
    marginTop: Space.sm,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  summaryRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Space.md, gap: Space.xs },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Gutter,
    paddingTop: Space.md,
    paddingBottom: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  back: { minWidth: 60 },
  primary: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Space.lg,
    alignItems: 'center',
  },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  disabled: { opacity: 0.5 },
});
