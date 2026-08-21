import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Font, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import type { AllergenSeverity, DietaryRule, ProfileAllergen, ProfileCondition } from '@/lib/types';
import { DIETARY_RULES, MAJOR_ALLERGENS, PROFILE_CONDITIONS } from '@/lib/types';

// The profile form, as parts.
//
// Onboarding asks these questions across four steps; the editor asks them all
// on one page. Both must ask them *identically* — a strictness control that
// reads differently when you come back to change it is how someone ends up
// believing they set anaphylaxis when they set intolerance. So the fields live
// here once and both screens compose them.
//
// Everything is paper and ink. Selection is ink fill, never a verdict colour:
// choosing "peanut" is not a verdict, and colouring it red would spend the one
// signal the app has before a scan has even happened.

export const ALLERGEN_KEYS: Record<string, TranslationKey> = {
  milk: 'allergen.milk',
  egg: 'allergen.egg',
  fish: 'allergen.fish',
  shellfish: 'allergen.shellfish',
  tree_nuts: 'allergen.tree_nuts',
  peanut: 'allergen.peanut',
  wheat: 'allergen.wheat',
  soy: 'allergen.soy',
  sesame: 'allergen.sesame',
};

export const SEVERITY_KEYS: Record<AllergenSeverity, TranslationKey> = {
  anaphylaxis: 'severity.anaphylaxis',
  allergy: 'severity.allergy',
  intolerance: 'severity.intolerance',
  avoid: 'severity.avoid',
};

// Ordered hardest-to-softest, which is also the order the matcher escalates
// in: anaphylaxis and allergy read high, intolerance and avoid read moderate.
export const SEVERITY_ORDER: AllergenSeverity[] = [
  'anaphylaxis',
  'allergy',
  'intolerance',
  'avoid',
];

export const DIETARY_KEYS: Record<DietaryRule, TranslationKey> = {
  vegan: 'dietary.vegan',
  vegetarian: 'dietary.vegetarian',
  gluten_free: 'dietary.gluten_free',
  halal: 'dietary.halal',
  kosher: 'dietary.kosher',
};

export const CONDITION_KEYS: Record<ProfileCondition, TranslationKey> = {
  pregnancy: 'condition.pregnancy',
  breastfeeding: 'condition.breastfeeding',
  celiac: 'condition.celiac',
  eczema: 'condition.eczema',
  // Conditions where the risk is to this person specifically and no regulator
  // has restricted the ingredient — the gap the substance corpus cannot cover.
  pku: 'condition.pku',
  g6pd_deficiency: 'condition.g6pd_deficiency',
  hypertension: 'condition.hypertension',
  diabetes: 'condition.diabetes',
  kidney_disease: 'condition.kidney_disease',
};

/** An allergen's display name, falling back to whatever the user typed. */
export function allergenLabel(t: (key: TranslationKey) => string, allergen: string): string {
  return ALLERGEN_KEYS[allergen] ? t(ALLERGEN_KEYS[allergen]) : allergen;
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const surface = useSurface();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[
        styles.chip,
        { borderColor: surface.rule, backgroundColor: surface.card },
        selected && { backgroundColor: surface.ink, borderColor: surface.ink },
      ]}
    >
      <ThemedText style={[Type.label, { color: selected ? surface.card : surface.ink }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function toggleIn<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** The allergen map as the server wants it. Insertion order is preserved. */
export function toAllergenEntries(map: Map<string, AllergenSeverity>): ProfileAllergen[] {
  return Array.from(map.entries()).map(([allergen, severity]) => ({ allergen, severity }));
}

export function toAllergenMap(entries: ProfileAllergen[]): Map<string, AllergenSeverity> {
  return new Map(entries.map((a) => [a.allergen, a.severity]));
}

export function NameField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const surface = useSurface();
  const { t } = useTranslation();
  return (
    <TextInput
      style={[
        styles.input,
        { borderColor: surface.rule, backgroundColor: surface.card, color: surface.ink },
      ]}
      placeholder={t('onboarding.namePlaceholder')}
      placeholderTextColor={surface.inkFaint}
      value={value}
      onChangeText={onChange}
      maxLength={60}
      autoFocus={autoFocus}
    />
  );
}

/**
 * Allergen chips, a free-text add, and one strictness row per chosen allergen.
 *
 * Strictness is a visible set of options rather than a tap-to-cycle value:
 * this is the setting that decides whether a trace warning becomes an Avoid.
 */
export function AllergenField({
  allergens,
  onChange,
}: {
  allergens: Map<string, AllergenSeverity>;
  onChange: (next: Map<string, AllergenSeverity>) => void;
}) {
  const surface = useSurface();
  const { t } = useTranslation();
  const [custom, setCustom] = useState('');

  const list = Array.from(allergens.entries());

  function toggle(allergen: string) {
    const next = new Map(allergens);
    // Default to "allergy", not the most severe option: a default that
    // overstates someone's risk teaches them to distrust the verdicts.
    if (next.has(allergen)) next.delete(allergen);
    else next.set(allergen, 'allergy');
    onChange(next);
  }

  function addCustom() {
    const value = custom.trim().toLowerCase();
    if (!value) return;
    onChange(new Map(allergens).set(value, 'avoid'));
    setCustom('');
  }

  return (
    <>
      <View style={styles.chipRow}>
        {MAJOR_ALLERGENS.map((allergen) => (
          <Chip
            key={allergen}
            label={t(ALLERGEN_KEYS[allergen])}
            selected={allergens.has(allergen)}
            onPress={() => toggle(allergen)}
          />
        ))}
      </View>

      <View style={styles.customRow}>
        <TextInput
          style={[
            styles.input,
            styles.customInput,
            { borderColor: surface.rule, backgroundColor: surface.card, color: surface.ink },
          ]}
          placeholder={t('onboarding.customPlaceholder')}
          placeholderTextColor={surface.inkFaint}
          value={custom}
          onChangeText={setCustom}
          onSubmitEditing={addCustom}
          returnKeyType="done"
        />
        <Pressable style={[styles.addButton, { backgroundColor: surface.ink }]} onPress={addCustom}>
          <ThemedText style={[Type.label, { color: surface.card }]}>
            {t('onboarding.add')}
          </ThemedText>
        </Pressable>
      </View>

      {list.length > 0 ? (
        <View style={styles.strictness}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('onboarding.strictnessLabel')}
          </ThemedText>
          {list.map(([allergen, severity]) => (
            <View key={allergen} style={[styles.strictRow, { borderTopColor: surface.rule }]}>
              <ThemedText style={[Type.label, { color: surface.ink }]}>
                {allergenLabel(t, allergen)}
              </ThemedText>
              <View style={styles.severityRow}>
                {SEVERITY_ORDER.map((option) => {
                  const active = option === severity;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => onChange(new Map(allergens).set(allergen, option))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.severityOption,
                        { borderColor: surface.rule, backgroundColor: surface.card },
                        active && { backgroundColor: surface.ink, borderColor: surface.ink },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.severityText,
                          { color: active ? surface.card : surface.inkMuted },
                        ]}
                      >
                        {t(SEVERITY_KEYS[option])}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

export function DietaryField({
  dietary,
  onChange,
}: {
  dietary: Set<DietaryRule>;
  onChange: (next: Set<DietaryRule>) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.chipRow}>
      {DIETARY_RULES.map((rule) => (
        <Chip
          key={rule}
          label={t(DIETARY_KEYS[rule])}
          selected={dietary.has(rule)}
          onPress={() => onChange(toggleIn(dietary, rule))}
        />
      ))}
    </View>
  );
}

export function ConditionsField({
  conditions,
  onChange,
}: {
  conditions: Set<ProfileCondition>;
  onChange: (next: Set<ProfileCondition>) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.chipRow}>
      {PROFILE_CONDITIONS.map((condition) => (
        <Chip
          key={condition}
          label={t(CONDITION_KEYS[condition])}
          selected={conditions.has(condition)}
          onPress={() => onChange(toggleIn(conditions, condition))}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    fontFamily: Font.sans,
    fontSize: 16,
    lineHeight: 22,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  customRow: { flexDirection: 'row', gap: Space.sm, alignItems: 'center' },
  customInput: { flex: 1 },
  addButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  strictness: { marginTop: Space.lg, gap: Space.sm },
  strictRow: { paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth, gap: Space.sm },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  severityOption: {
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  severityText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },
});
