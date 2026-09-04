import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LanguagePicker } from '@/components/language-picker';
import { type PlateName } from '@/components/inkwash-plate';
import { DecodeLoop } from '@/components/decode-loop';
import { ChoiceCard } from '@/components/onboarding/choice-card';
import { StepFrame } from '@/components/onboarding/chrome';
import {
  AliasPlate,
  DecodePlate,
  LabelPlate,
  SourcePlate,
} from '@/components/onboarding/teaching';
import {
  AllergenField,
  ConditionsField,
  DietaryField,
  NameField,
  StrictnessField,
  toAllergenEntries,
} from '@/components/profile-fields';
import { Space } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { goBackOrHome } from '@/lib/navigation';
import { createProfile, setActiveProfileId } from '@/lib/profiles';
import type { DietaryRule, ProfileAllergen, ProfileCondition } from '@/lib/types';

// Screens 06 & 07 — Onboarding.
//
// Onboarding IS profile creation: the profile is what turns a generic
// ingredient lookup into "is this safe for me". That has not changed. What
// changed is the length, and the reason is worth stating plainly, because a
// longer form is normally a worse form.
//
// This flow used to be four screens of questions and then a bill. Somebody who
// had never seen the app work was asked for their child's allergies and then
// asked for money, in that order, with nothing in between that earned either.
// Four screens is the right length for a form and the wrong length for an
// introduction.
//
// So it is now fourteen steps, and six of them ask for nothing at all. They pay
// out something instead: a welcome that says why anyone would bother, what a
// chemical name turns into, how a label hides milk, why a barcode is the wrong
// thing to read, who the verdicts quote, and what happens to the photograph.
// The questions are one to a screen, which reads as faster even though it is
// longer, and the last screen reads the whole profile back before anyone is
// asked for anything.
//
// WHY THE VALUE IS ARGUED HERE AND NOT ON THE WELCOME SCREEN
//
// It used to be argued there: a worked example and three supporting points, all
// landing on somebody who had been in the app for two seconds. It read as dense,
// and dense on a first screen reads as work. Behind the button there is room to
// make one point per screen, to a person who has already chosen to look.
//
// WHAT IS DELIBERATELY NOT ASKED
//
// Every step here collects something the app uses. There is no "where did you
// hear about us", no "have you tried other apps", no demographics. Those are
// good conversion instruments and this is a health app: everything a person
// types into this flow is health data about them or their child, and the
// defensible line is that we ask for what we act on and nothing else.
//
// `subject` is the one soft answer, and it is never persisted — it picks the
// wording of the next ten screens and the default name, then it is gone. It is
// a question about how to talk to someone, not a fact stored about them.

type Subject = 'me' | 'child' | 'other';

type StepId =
  | 'begin'
  | 'decode'
  | 'subject'
  | 'name'
  | 'allergens'
  | 'strictness'
  | 'aliases'
  | 'dietary'
  | 'conditions'
  | 'label'
  | 'sources'
  | 'language';

/**
 * Adding a second profile is not a first run.
 *
 * Somebody who already pays for this app, adding their other child, must not
 * be walked past the sources plate and the privacy plate and left at a
 * paywall. Same questions, none of the introduction, and it ends where it
 * started instead of at the till.
 */
const ADD_STEPS: StepId[] = ['subject', 'name', 'allergens', 'strictness', 'dietary', 'conditions'];

const FIRST_RUN_STEPS: StepId[] = [
  // Two before a single question is asked. The first says why anyone would
  // bother; the second shows the thing being bothered with. Asking a stranger
  // for their child's allergies before either of those is the wrong order.
  'begin',
  'decode',
  'subject',
  'name',
  'allergens',
  'strictness',
  'aliases',
  'dietary',
  'conditions',
  // The profile is complete here. Everything after it is the case for the app,
  // made to somebody who has already put work in.
  'label',
  'sources',
  'language',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const adding = useLocalSearchParams<{ mode?: string }>().mode === 'add';

  const [index, setIndex] = useState(0);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [name, setName] = useState('');
  const [allergens, setAllergens] = useState<Map<string, ProfileAllergen>>(new Map());
  const [dietary, setDietary] = useState<Set<DietaryRule>>(new Set());
  const [conditions, setConditions] = useState<Set<ProfileCondition>>(new Set());
  const [saving, setSaving] = useState(false);

  // "Me" is a fine name for your own profile and a terrible one for your
  // daughter's. So the placeholder stands only for the self case, and the
  // other two have to type something — which is the one place in this flow
  // worth blocking on, because the name is what every later verdict is
  // addressed to.
  const profileName = name.trim() || t('onboarding.namePlaceholder');
  const needsName = subject !== 'me' && name.trim().length === 0;

  // Strictness has nothing to be strict about until something is chosen, and a
  // step that renders an empty page is worse than one step fewer. Recomputed
  // rather than filtered once, so backing up and adding an allergen puts the
  // step back rather than skipping it for the rest of the session.
  const steps = useMemo(() => {
    const base = adding ? ADD_STEPS : FIRST_RUN_STEPS;
    return base.filter((step) => (step === 'strictness' ? allergens.size > 0 : true));
  }, [adding, allergens.size]);

  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  const dirty =
    subject !== null ||
    name.trim().length > 0 ||
    allergens.size > 0 ||
    dietary.size > 0 ||
    conditions.size > 0;

  // Onboarding is reachable by a single tap, so it is reachable by a single
  // MIS-tap too. The swipe-back gesture was a real exit but an invisible one —
  // nothing on screen said it was there, which left the form looking like a
  // room with no door. Now the door is the header control: back on every step
  // past the first, and out on the first.
  function close() {
    if (!dirty) return goBackOrHome();
    Alert.alert(t('onboarding.discardTitle'), t('onboarding.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('onboarding.discardConfirm'), style: 'destructive', onPress: goBackOrHome },
    ]);
  }

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
      // Active immediately — the viewfinder's chip has to name someone the
      // moment this hands over.
      await setActiveProfileId(profile.id);

      // Adding a profile ends where it began. Only a first run continues.
      if (adding) return router.replace('/profiles');

      // To the example scan, which goes on to the trial promise and the
      // paywall.
      //
      // Not the camera: with no free scans, sending someone to the viewfinder
      // means they frame a label, take the photo and only then learn they
      // cannot have the answer — effort spent for nothing.
      //
      // And not straight to the paywall either, which was the old destination.
      // That asked for money from an app that had never once done the thing it
      // is for, immediately after asking a stranger for their child's
      // allergies. /demo puts one real verdict in between, over a label we
      // supply. It costs no scan and no API call.
      router.replace('/demo');
    } catch (error: any) {
      Alert.alert(t('onboarding.saveFailed'), error?.message ?? t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  }

  function advance() {
    if (last) return void save();
    setIndex((i) => i + 1);
  }

  const content = renderStep({
    step,
    adding,
    t,
    subject,
    setSubject,
    name,
    setName,
    profileName,
    allergens,
    setAllergens,
    dietary,
    setDietary,
    conditions,
    setConditions,
  });

  return (
    <StepFrame
      // Fills as the LAST step completes, not as it opens, so the bar never
      // sits full above a question still waiting for an answer.
      progress={index / steps.length}
      onLeft={index === 0 ? close : () => setIndex((i) => i - 1)}
      leftGlyph={index === 0 ? '✕' : '‹'}
      leftLabel={index === 0 ? t('common.cancel') : t('common.back')}
      eyebrow={content.eyebrow}
      title={content.title}
      body={content.body}
      plate={content.plate}
      // The last step used to be a summary screen whose own CTA said "See it
      // work". With that screen gone, whatever question happens to be last has
      // to end the flow, so the finishing word is set here rather than hidden
      // in one case of the switch.
      cta={
        last
          ? saving
            ? t('onboarding.saving')
            : adding
              ? t('onboarding.save')
              : t('onboarding.finish')
          : content.cta
      }
      onCta={advance}
      ctaDisabled={
        saving || (step === 'subject' && subject === null) || (step === 'name' && needsName)
      }
      secondary={content.optional ? { label: t('onboarding.skip'), onPress: advance } : undefined}
      // Skip comes and goes as things are chosen; the space it occupies must
      // not, or the page shifts under the finger that chose them.
      reserveSecondary={content.skippable}
    >
      {content.children}
    </StepFrame>
  );
}

interface StepContent {
  /**
   * Set on the four steps that hand over a fact instead of collecting one.
   * Nothing else in the flow carries it, which is the point: the stamp is how
   * a lesson announces itself before the title has been read.
   */
  eyebrow?: string;
  title: string;
  body?: string;
  cta: string;
  children?: React.ReactNode;
  plate?: PlateName;
  /** Shows a Skip under the button — for the steps nobody has to answer. */
  optional?: boolean;
  /**
   * This step can show a Skip, whether or not it is showing one right now.
   * Distinct from `optional` on purpose: `optional` changes as the person
   * answers, and the footer's HEIGHT must not.
   */
  skippable?: boolean;
}

function renderStep(args: {
  step: StepId;
  adding: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  subject: Subject | null;
  setSubject: (next: Subject) => void;
  name: string;
  setName: (next: string) => void;
  profileName: string;
  allergens: Map<string, ProfileAllergen>;
  setAllergens: (next: Map<string, ProfileAllergen>) => void;
  dietary: Set<DietaryRule>;
  setDietary: (next: Set<DietaryRule>) => void;
  conditions: Set<ProfileCondition>;
  setConditions: (next: Set<ProfileCondition>) => void;
}): StepContent {
  const { step, t, subject, profileName } = args;

  switch (step) {
    case 'begin':
      return {
        title: t('onboarding.beginTitle'),
        // No plate here any more. The basket was a still drawing of an empty
        // basket, which is pleasant and says nothing; DecodeLoop shows the
        // product working, on the one screen where somebody has not yet
        // decided whether to care.
        body: t('onboarding.beginBody'),
        cta: t('onboarding.beginCta'),
        children: <DecodeLoop />,
      };

    case 'decode':
      return {
        eyebrow: t('teach.eyebrow'),
        title: t('teach.decodeTitle'),
        // No plate: three worked examples fill the page, and the frame would
        // drop a drawing anyway.
        body: t('teach.decodeBody'),
        cta: t('onboarding.next'),
        children: <DecodePlate />,
      };

    case 'subject':
      return {
        title: t('onboarding.subjectTitle'),
        plate: 'bowls',
        body: t('onboarding.subjectBody'),
        cta: t('onboarding.next'),
        children: (
          <View style={styles.choices}>
            {(['me', 'child', 'other'] as Subject[]).map((option) => (
              <ChoiceCard
                key={option}
                label={t(SUBJECT_LABEL[option])}
                hint={t(SUBJECT_HINT[option])}
                selected={subject === option}
                onPress={() => args.setSubject(option)}
              />
            ))}
          </View>
        ),
      };

    case 'name':
      return {
        title:
          subject === 'me' ? t('onboarding.nameTitleMe') : t('onboarding.nameTitleOther'),
        plate: 'tag',
        body: t('onboarding.nameBody'),
        cta: t('onboarding.next'),
        children: <NameField value={args.name} onChange={args.setName} autoFocus />,
      };

    case 'allergens':
      return {
        // "Anything Me needs to avoid?" is what the placeholder name produces,
        // and it reads like a bug. Somebody who never typed a name gets the
        // question addressed to them instead of to a third person.
        title: args.name.trim()
          ? t('onboarding.allergensTitle', { name: profileName })
          : t('onboarding.allergensTitleSelf'),
        plate: 'allergens',
        body: t('onboarding.allergensBody'),
        cta: t('onboarding.next'),
        // Nobody has to have an allergy. A diet or a condition alone is a
        // perfectly good reason to be here, and a required field would make
        // those people invent an answer.
        optional: args.allergens.size === 0,
        skippable: true,
        children: (
          <AllergenField
            allergens={args.allergens}
            onChange={args.setAllergens}
            showStrictness={false}
          />
        ),
      };

    case 'strictness':
      return {
        title: t('onboarding.strictnessTitle'),
        plate: 'balance',
        body: t('onboarding.strictnessBody'),
        cta: t('onboarding.next'),
        children: (
          <StrictnessField
            allergens={args.allergens}
            onChange={args.setAllergens}
            showHeading={false}
          />
        ),
      };

    case 'aliases':
      return {
        eyebrow: t('teach.eyebrow'),
        title: t('teach.aliasTitle'),
        body: t('teach.aliasBody'),
        cta: t('onboarding.next'),
        // The still life of the thing being taught: a jug, butter and cheese,
        // three objects that look nothing alike and are one ingredient.
        plate: 'milk',
        children: <AliasPlate />,
      };

    case 'dietary':
      return {
        title: t('onboarding.dietaryTitle'),
        plate: 'dietary',
        body: t('onboarding.dietaryBody'),
        cta: t('onboarding.next'),
        optional: args.dietary.size === 0,
        skippable: true,
        children: <DietaryField dietary={args.dietary} onChange={args.setDietary} />,
      };

    case 'conditions':
      return {
        title: t('onboarding.conditionsTitle'),
        plate: 'conditions',
        body: t('onboarding.conditionsBody'),
        cta: t('onboarding.next'),
        optional: args.conditions.size === 0,
        skippable: true,
        children: <ConditionsField conditions={args.conditions} onChange={args.setConditions} />,
      };

    case 'label':
      return {
        eyebrow: t('teach.eyebrow'),
        title: t('teach.labelTitle'),
        body: t('teach.labelBody'),
        cta: t('onboarding.next'),
        // Blank tins, no words on them anywhere. Exactly what a barcode leaves
        // you holding: a product identified only by a number.
        plate: 'packets',
        children: <LabelPlate />,
      };

    case 'sources':
      return {
        eyebrow: t('teach.eyebrow'),
        title: t('teach.sourceTitle'),
        body: t('teach.sourceBody'),
        cta: t('onboarding.next'),
        plate: 'sources',
        children: <SourcePlate />,
      };

    case 'language':
    default:
      return {
        title: t('onboarding.languageTitle'),
        plate: 'language',
        body: t('onboarding.languageBody'),
        cta: t('onboarding.next'),
        children: (
          <View style={styles.languageRow}>
            <LanguagePicker />
          </View>
        ),
      };
  }
}

const SUBJECT_LABEL = {
  me: 'onboarding.subjectMe',
  child: 'onboarding.subjectChild',
  other: 'onboarding.subjectOther',
} as const;

const SUBJECT_HINT = {
  me: 'onboarding.subjectMeHint',
  child: 'onboarding.subjectChildHint',
  other: 'onboarding.subjectOtherHint',
} as const;

const styles = StyleSheet.create({
  choices: { gap: Space.sm },
  languageRow: { flexDirection: 'row' },
});
