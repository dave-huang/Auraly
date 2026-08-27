import type { Citation, ProfileCondition } from '@shared/schema';
import { firstMatchingTerm } from './termMatch';

/**
 * Condition advisories — health risk to a specific person.
 *
 * This is the layer the substance corpus structurally cannot see. The policy
 * engine answers "what have regulators done about this substance", which is a
 * question about the world. This file answers "what does this ingredient do to
 * the person holding the phone", which is a question about them.
 *
 * The case that forced it: aspartame is approved in every market on earth, sits
 * on no prohibition list, and causes irreversible neurological damage to someone
 * with phenylketonuria. Every regulator agrees it is safe *and* every regulator
 * requires a warning label for exactly one group of people. A risk scale built
 * only on enforcement action reports "no restrictions found" and is wrong in the
 * worst possible direction.
 *
 * Rules this table lives by:
 *
 *  1. EVERY advisory names an authority. Same discipline as an evidence record:
 *     if no health body has said it, it does not go in. The difference from the
 *     corpus is the KIND of statement — guidance for a population, not an
 *     enforcement action against a substance.
 *  2. `impact: 'avoid'` is reserved for exposures that are seriously harmful to
 *     this group, not merely inadvisable. It drives an Avoid verdict, so a
 *     careless one here cries wolf and teaches people to ignore the app.
 *  3. Domain matters. "Alcohol" in a drink and "alcohol denat." in a toner are
 *     different exposures; an advisory that ignored the distinction would flag
 *     every pregnant user's moisturiser.
 *  4. Matching is via `termMatch`, never substring — see that module for why
 *     "sugar free" would otherwise be the strongest sugar hit on the shelf.
 *
 * REVIEW STATUS: every advisory below is `ai_seeded` and carries that marker
 * into the UI. The sources are real and named, but a clinician has not signed
 * off on this table. Citations deliberately carry org/title/year and no URL —
 * a guessed link is worse than none, and the titles are unambiguous enough to
 * find. Adding verified URLs is a curation task, not a code change.
 */

export type AdvisoryImpact = 'avoid' | 'caution';
export type AdvisoryDomain = 'food' | 'cosmetic' | 'any';

export interface AdvisorySource {
  org: string;
  title: string;
  year?: number;
}

export interface ConditionAdvisory {
  /** Stable id — cited in flags, asserted reachable by the check script. */
  id: string;
  condition: ProfileCondition;
  /** Terms that trigger it. Whole-word, negation-aware. */
  terms: string[];
  impact: AdvisoryImpact;
  domain: AdvisoryDomain;
  /** i18n key for the user-facing sentence. */
  reasonKey: string;
  /** English fallback, and the statement shown in the citation. */
  reason: string;
  source: AdvisorySource;
}

export const CONDITION_ADVISORIES: ConditionAdvisory[] = [
  // ---- phenylketonuria ----
  // The reason this whole module exists. Both sweeteners are a phenylalanine
  // source and both carry a mandatory label warning in the US and EU — which
  // means the regulators agree with this advisory, they simply express it as a
  // labelling duty rather than a restriction, so the corpus never sees it.
  {
    id: 'pku.aspartame',
    condition: 'pku',
    terms: ['aspartame', 'e951', 'e 951', 'aspartame acesulfame salt', 'e962', 'e 962', 'phenylalanine'],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.pku.aspartame',
    reason:
      'Aspartame is a source of phenylalanine, which cannot be safely metabolised with PKU. US and EU labelling law requires this to be declared.',
    source: {
      org: 'US FDA',
      title: '21 CFR 172.804 — Aspartame; label declaration for phenylketonurics',
    },
  },

  // ---- G6PD deficiency ----
  {
    id: 'g6pd.fava',
    condition: 'g6pd_deficiency',
    terms: ['fava bean', 'faba bean', 'broad bean', 'vicia faba', 'fava'],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.g6pd.fava',
    reason:
      'Fava beans can trigger acute haemolysis (favism) in people with G6PD deficiency.',
    source: {
      org: 'World Health Organization',
      title: 'Glucose-6-phosphate dehydrogenase deficiency — WHO Working Group report',
    },
  },

  // ---- coeliac disease ----
  // Raised from the seed list's blanket "caution" to avoid. For coeliac disease
  // gluten is not a substance to watch, it is the thing that causes the damage —
  // the same standing an allergen has, and it should read that way on the card.
  {
    id: 'celiac.gluten_grains',
    condition: 'celiac',
    terms: [
      'wheat', 'barley', 'rye', 'malt', 'malt extract', 'spelt', 'farro', 'semolina',
      'durum', 'triticale', 'seitan', 'farina', 'graham flour', 'brewer s yeast',
    ],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.celiac.gluten',
    reason: 'Contains or derives from a gluten grain, which damages the small intestine in coeliac disease.',
    source: {
      org: 'American College of Gastroenterology',
      title: 'ACG Clinical Guidelines: Diagnosis and Management of Celiac Disease',
      year: 2023,
    },
  },

  // ---- pregnancy ----
  // Split by degree rather than lumped. Oral/prescription retinoids are proven
  // teratogens; topical retinol is a precaution about an absorbed dose nobody
  // has measured as harmful. Saying both with the same force would either
  // overstate the second or understate the first.
  {
    id: 'pregnancy.oral_retinoid',
    condition: 'pregnancy',
    terms: ['isotretinoin', 'tretinoin', 'acitretin', 'etretinate', 'tazarotene', 'bexarotene'],
    impact: 'avoid',
    domain: 'any',
    reasonKey: 'advisory.pregnancy.oralRetinoid',
    reason: 'Retinoids of this class are established teratogens and are contraindicated in pregnancy.',
    source: {
      org: 'American College of Obstetricians and Gynecologists',
      title: 'ACOG Committee Opinion: Skin conditions and treatment in pregnancy',
    },
  },
  {
    id: 'pregnancy.topical_retinoid',
    condition: 'pregnancy',
    terms: ['retinol', 'retinal', 'retinyl palmitate', 'retinyl acetate', 'retinaldehyde', 'adapalene'],
    impact: 'caution',
    domain: 'cosmetic',
    reasonKey: 'advisory.pregnancy.topicalRetinoid',
    reason:
      'Topical vitamin A derivatives are commonly advised against in pregnancy as a precaution — systemic absorption is low but not established as safe.',
    source: {
      org: 'American College of Obstetricians and Gynecologists',
      title: 'ACOG Committee Opinion: Skin conditions and treatment in pregnancy',
    },
  },
  {
    id: 'pregnancy.high_mercury_fish',
    condition: 'pregnancy',
    terms: ['shark', 'swordfish', 'king mackerel', 'tilefish', 'marlin', 'bigeye tuna', 'orange roughy'],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.pregnancy.mercury',
    reason:
      'Highest-mercury fish. Methylmercury crosses the placenta and can harm a developing nervous system.',
    source: {
      org: 'US FDA & EPA',
      title: 'Advice About Eating Fish, for those who might become or are pregnant',
    },
  },
  {
    id: 'pregnancy.alcohol',
    condition: 'pregnancy',
    terms: ['alcohol', 'ethanol', 'ethyl alcohol', 'wine', 'rum', 'brandy', 'liqueur', 'beer'],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.pregnancy.alcohol',
    reason: 'No level of alcohol has been established as safe during pregnancy.',
    source: {
      org: 'US Centers for Disease Control and Prevention',
      title: 'Alcohol Use in Pregnancy',
    },
  },
  {
    id: 'pregnancy.unpasteurised',
    condition: 'pregnancy',
    terms: ['unpasteurized', 'unpasteurised', 'raw milk'],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.pregnancy.listeria',
    reason:
      'Unpasteurised dairy carries a listeria risk, which is far more dangerous in pregnancy than otherwise.',
    source: {
      org: 'US Centers for Disease Control and Prevention',
      title: 'Listeria — People at Risk: Pregnant Women and Newborns',
    },
  },
  {
    id: 'pregnancy.caffeine',
    condition: 'pregnancy',
    terms: ['caffeine', 'guarana'],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.pregnancy.caffeine',
    reason: 'Caffeine intake is advised to stay under about 200 mg a day during pregnancy.',
    source: {
      org: 'American College of Obstetricians and Gynecologists',
      title: 'ACOG Committee Opinion 462: Moderate Caffeine Consumption During Pregnancy',
    },
  },
  {
    id: 'pregnancy.cosmetic_actives',
    condition: 'pregnancy',
    terms: ['hydroquinone', 'formaldehyde', 'dibutyl phthalate', 'thioglycolic acid'],
    impact: 'caution',
    domain: 'cosmetic',
    reasonKey: 'advisory.pregnancy.cosmeticActives',
    reason:
      'Commonly advised against during pregnancy because systemic absorption is meaningful — discuss with your doctor.',
    source: {
      org: 'American College of Obstetricians and Gynecologists',
      title: 'ACOG Committee Opinion: Skin conditions and treatment in pregnancy',
    },
  },

  // ---- breastfeeding ----
  {
    id: 'breastfeeding.alcohol',
    condition: 'breastfeeding',
    terms: ['alcohol', 'ethanol', 'ethyl alcohol', 'wine', 'rum', 'brandy', 'liqueur', 'beer'],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.breastfeeding.alcohol',
    reason: 'Alcohol passes into breast milk; timing feeds around intake is the usual advice.',
    source: {
      org: 'US Centers for Disease Control and Prevention',
      title: 'Alcohol and Breastfeeding',
    },
  },
  {
    id: 'breastfeeding.high_mercury_fish',
    condition: 'breastfeeding',
    terms: ['shark', 'swordfish', 'king mackerel', 'tilefish', 'marlin', 'bigeye tuna'],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.breastfeeding.mercury',
    reason: 'Highest-mercury fish are advised against while breastfeeding.',
    source: {
      org: 'US FDA & EPA',
      title: 'Advice About Eating Fish, for those who might become or are pregnant or breastfeeding',
    },
  },
  {
    id: 'breastfeeding.topical_retinoid',
    condition: 'breastfeeding',
    terms: ['isotretinoin', 'tretinoin', 'retinol', 'retinyl palmitate', 'hydroquinone'],
    impact: 'caution',
    domain: 'cosmetic',
    reasonKey: 'advisory.breastfeeding.retinoid',
    reason: 'Commonly advised against while breastfeeding — discuss with your doctor.',
    source: {
      org: 'American College of Obstetricians and Gynecologists',
      title: 'ACOG Committee Opinion: Skin conditions and treatment in pregnancy',
    },
  },

  // ---- hypertension ----
  // Deliberately caution, never avoid. Salt is in almost everything; an Avoid
  // verdict on every loaf of bread would be noise, and noise is how a safety
  // app trains people to swipe past the one warning that mattered.
  {
    id: 'hypertension.sodium',
    condition: 'hypertension',
    terms: [
      'salt', 'sea salt', 'table salt', 'rock salt', 'sodium chloride',
      'monosodium glutamate', 'msg', 'soy sauce', 'fish sauce',
    ],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.hypertension.sodium',
    reason:
      'A sodium source. WHO recommends staying under 2 g of sodium (5 g of salt) a day, and lower intake lowers blood pressure.',
    source: {
      org: 'World Health Organization',
      title: 'WHO guideline: Sodium intake for adults and children',
      year: 2012,
    },
  },

  // ---- type 2 diabetes ----
  {
    id: 'diabetes.free_sugars',
    condition: 'diabetes',
    terms: [
      'sugar', 'sucrose', 'glucose syrup', 'glucose fructose syrup', 'high fructose corn syrup',
      'corn syrup', 'dextrose', 'invert sugar', 'maltose', 'molasses', 'honey',
      'agave syrup', 'agave nectar', 'fruit juice concentrate', 'maltodextrin',
    ],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.diabetes.sugars',
    reason:
      'A free sugar — absorbed quickly and counted toward the intake WHO recommends holding under 10% of daily energy.',
    source: {
      org: 'World Health Organization',
      title: 'WHO guideline: Sugars intake for adults and children',
      year: 2015,
    },
  },

  // ---- chronic kidney disease ----
  // Phosphate ADDITIVES specifically: inorganic phosphate is absorbed far more
  // completely than the phosphorus naturally present in food, which is why it is
  // singled out in CKD guidance while a high-protein food is not.
  {
    id: 'kidney.phosphate_additives',
    condition: 'kidney_disease',
    terms: [
      'phosphoric acid', 'sodium phosphate', 'disodium phosphate', 'trisodium phosphate',
      'potassium phosphate', 'calcium phosphate', 'sodium tripolyphosphate',
      'sodium polyphosphate', 'tetrasodium pyrophosphate',
      'e338', 'e339', 'e340', 'e341', 'e450', 'e451', 'e452',
    ],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.kidney.phosphate',
    reason:
      'An added inorganic phosphate. These are absorbed far more completely than phosphorus naturally present in food, which matters when kidneys clear it slowly.',
    source: {
      org: 'KDIGO',
      title: 'KDIGO Clinical Practice Guideline for the Diagnosis, Evaluation, Prevention, and Treatment of CKD-MBD',
    },
  },
  {
    id: 'kidney.potassium_additives',
    condition: 'kidney_disease',
    terms: ['potassium chloride', 'potassium lactate', 'potassium citrate', 'e508'],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.kidney.potassium',
    reason:
      'An added potassium salt, often used as a salt replacer. Potassium load matters in reduced kidney function.',
    source: {
      org: 'National Kidney Foundation',
      title: 'KDOQI Clinical Practice Guideline for Nutrition in CKD',
      year: 2020,
    },
  },

  // ---- eczema / atopic dermatitis ----
  {
    id: 'eczema.contact_sensitizers',
    condition: 'eczema',
    terms: [
      'fragrance', 'parfum', 'methylisothiazolinone', 'methylchloroisothiazolinone',
      'formaldehyde', 'quaternium 15', 'imidazolidinyl urea', 'diazolidinyl urea',
      'lanolin', 'cocamidopropyl betaine', 'propylene glycol', 'balsam of peru',
    ],
    impact: 'caution',
    domain: 'cosmetic',
    reasonKey: 'advisory.eczema.sensitizers',
    reason: 'A common contact sensitiser and a frequent eczema trigger.',
    source: {
      org: 'American Academy of Dermatology',
      title: 'Guidelines of care for the management of atopic dermatitis',
    },
  },

  // ---- infant, under 12 months ----
  //
  // The only entry here whose subject is not the account holder. A parent
  // scanning for a baby is reading the same label as everyone else and asking a
  // different question, and until now the app answered the adult's.
  //
  // Honey is the case that justifies the condition, and it is the cleanest
  // example in the whole table of what the substance corpus structurally cannot
  // see: honey is an unrestricted food in every market on earth, sits on no
  // prohibition list, has no ADI, and hospitalises infants. There is no
  // enforcement action to find because there is nothing wrong with the honey.
  //
  // Deliberately food-only. Baby skincare is a real question with real
  // authorities behind it, but none I could cite tonight without guessing, and
  // the eczema advisory already carries the contact sensitisers.
  {
    id: 'infant.honey',
    condition: 'infant',
    terms: ['honey'],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.infant.honey',
    reason:
      'Honey can carry Clostridium botulinum spores. An infant gut cannot suppress them, and they produce the toxin that causes infant botulism. Not before 12 months, in any amount, cooked or raw.',
    source: {
      org: 'US Centers for Disease Control and Prevention',
      title: 'Botulism: Prevention — Infant Botulism',
    },
  },
  {
    id: 'infant.unpasteurised',
    condition: 'infant',
    terms: ['unpasteurized', 'unpasteurised', 'raw milk'],
    impact: 'avoid',
    domain: 'food',
    reasonKey: 'advisory.infant.rawMilk',
    reason:
      'Unpasteurised dairy can carry listeria, salmonella and E. coli. Infants are among the groups most likely to be hospitalised by them.',
    source: {
      org: 'US Centers for Disease Control and Prevention',
      title: 'Food Safety and Raw Milk',
    },
  },
  // Sodium is caution, not avoid, for the same reason it is on hypertension:
  // salt is in nearly everything, and an Avoid on every jar of pasta sauce
  // teaches a parent to swipe past the honey warning.
  {
    id: 'infant.sodium',
    condition: 'infant',
    terms: [
      'salt', 'sea salt', 'table salt', 'rock salt', 'sodium chloride',
      'monosodium glutamate', 'msg', 'soy sauce', 'fish sauce', 'stock cube', 'bouillon',
    ],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.infant.sodium',
    reason:
      'A sodium source. Infant kidneys clear sodium poorly; NHS advice is under 1 g of salt a day before 12 months, which most adult food exceeds in a serving.',
    source: {
      org: 'UK National Health Service',
      title: 'Foods to avoid giving babies and young children',
    },
  },
  // Honey is deliberately absent from this list — it is a free sugar, but the
  // botulism advisory above already claims it, and repeating it here would only
  // produce a term the coverage check reports as permanently shadowed.
  {
    id: 'infant.added_sugars',
    condition: 'infant',
    terms: [
      'sugar', 'sucrose', 'glucose syrup', 'glucose fructose syrup', 'high fructose corn syrup',
      'corn syrup', 'dextrose', 'invert sugar', 'maltose', 'molasses',
      'agave syrup', 'agave nectar', 'fruit juice concentrate', 'maltodextrin',
    ],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.infant.addedSugars',
    reason:
      'An added sugar. US federal dietary guidance is to avoid added sugars entirely before age 2 — there is no recommended amount, only less.',
    source: {
      org: 'US Departments of Agriculture and Health and Human Services',
      title: 'Dietary Guidelines for Americans, 2020-2025 — Birth Through 23 Months',
      year: 2020,
    },
  },
  {
    id: 'infant.caffeine',
    condition: 'infant',
    terms: ['caffeine', 'guarana', 'coffee'],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.infant.caffeine',
    reason:
      'A stimulant with no established safe intake for young children. Paediatric guidance is that caffeine has no place in a child\'s diet.',
    source: {
      org: 'American Academy of Pediatrics',
      title: 'Clinical Report: Sports Drinks and Energy Drinks for Children and Adolescents',
      year: 2011,
    },
  },
  // Rice takes up inorganic arsenic from soil, and rice drinks concentrate it
  // in a form small children drink by the cup. This is the one arsenic claim
  // narrow enough to cite without overreaching: the NHS names rice drinks
  // specifically. Rice flour and brown rice syrup are a real question the same
  // source does not answer, so they are not here.
  {
    id: 'infant.rice_drinks',
    condition: 'infant',
    terms: ['rice drink', 'rice milk', 'rice beverage'],
    impact: 'caution',
    domain: 'food',
    reasonKey: 'advisory.infant.riceDrinks',
    reason:
      'Rice drinks carry inorganic arsenic. NHS advice is that children under 5 should not have them.',
    source: {
      org: 'UK National Health Service',
      title: 'Foods to avoid giving babies and young children',
    },
  },
];

/** Impact → the risk level a fired advisory forces the ingredient to. */
export function impactToRisk(impact: AdvisoryImpact): 'high' | 'moderate' {
  return impact === 'avoid' ? 'high' : 'moderate';
}

/**
 * The advisory that fires for this ingredient, or undefined.
 *
 * Worst-first within a condition, so an ingredient tripping both an `avoid` and
 * a `caution` advisory reports the `avoid` one. Domain-filtered: a `food`
 * advisory never fires on a cosmetic label.
 */
export function matchAdvisory(
  ingredientName: string,
  condition: ProfileCondition,
  domain: 'food' | 'cosmetic',
): { advisory: ConditionAdvisory; term: string } | undefined {
  const candidates = CONDITION_ADVISORIES.filter(
    (a) => a.condition === condition && (a.domain === 'any' || a.domain === domain),
  ).sort((a, b) => (a.impact === b.impact ? 0 : a.impact === 'avoid' ? -1 : 1));

  for (const advisory of candidates) {
    const term = firstMatchingTerm(ingredientName, advisory.terms);
    if (term) return { advisory, term };
  }
  return undefined;
}

/**
 * Render an advisory as a Citation, so condition flags carry their authority
 * through exactly the same UI the knowledge base already uses.
 *
 * `reviewStatus` is honestly `ai_seeded`: the sources are real and named, but
 * no clinician has reviewed this table. The UI can and should say so.
 */
export function advisoryCitation(advisory: ConditionAdvisory): Citation {
  return {
    entryId: advisory.id,
    statement: advisory.reason,
    riskContext: advisory.condition,
    sources: [{ org: advisory.source.org, title: advisory.source.title, year: advisory.source.year }],
    reviewStatus: 'ai_seeded',
  };
}

/** Every condition that has at least one advisory behind it. */
export function conditionsWithAdvisories(): Set<ProfileCondition> {
  return new Set(CONDITION_ADVISORIES.map((a) => a.condition));
}
