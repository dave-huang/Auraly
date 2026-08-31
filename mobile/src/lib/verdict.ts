import { MIN_CONFIDENT_SEGMENTS, confidenceSegments } from '@/constants/design';
import { TRANSLATED_KEYS, useTranslation, type TranslationKey } from '@/lib/i18n';
import type { AnalysisResult, PersonalFlag, RiskLevel } from '@/lib/types';

// Single source for the verdict word, the one-sentence why, and the seal
// lines. The on-screen card and the exported share image MUST say exactly the
// same thing — a shared image that disagrees with what the user saw would be
// worse than not sharing at all.

/** The verdict word for a level. Exported so the drill-down can name both the
 *  universal and the personal level in the same words the card uses. */
export const RISK_LABEL_KEYS: Record<RiskLevel, TranslationKey> = {
  low: 'risk.low',
  moderate: 'risk.moderate',
  high: 'risk.high',
};
const RISK_KEYS = RISK_LABEL_KEYS;

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

function localizeTerm(t: T, prefix: 'allergen' | 'severity', value: string): string {
  const key = `${prefix}.${value}` as TranslationKey;
  return key in TRANSLATED_KEYS ? t(key) : value;
}

export function localizeAllergen(t: T, value: string): string {
  const key = `allergen.${value.toLowerCase().replace(/ /g, '_')}` as TranslationKey;
  return key in TRANSLATED_KEYS ? t(key) : value;
}

/**
 * Localize a profile term by its kind.
 *
 * Dietary rules and conditions live under their own key prefixes, so looking
 * every term up as `allergen.*` leaves them untranslated — which showed as a
 * lowercase raw "vegan" sitting between a properly-cased "Peanut" and
 * "Sesame".
 */
export function localizeProfileTerm(
  t: T,
  type: 'allergen' | 'dietary' | 'condition',
  value: string,
): string {
  const key = `${type}.${value.toLowerCase().replace(/ /g, '_')}` as TranslationKey;
  return key in TRANSLATED_KEYS ? t(key) : value;
}

/**
 * Is a position on the ingredient list worth showing?
 *
 * Duplicated from server/services/labelRank.ts on purpose — the app cannot
 * import server modules, and this is a display threshold rather than a
 * derivation. Keep the two in step; the server owns the real definition.
 *
 * "11th of 14" is trivia. "2nd of 14" tells you what the product mostly is.
 *
 * The limit tightens on a short list: third of fourteen is a real statement,
 * third of four is nearly the end of the list and implies a prominence the
 * position does not carry. Mirrors prominentRankLimit on the server.
 */
/**
 * How to join the label's own ingredient list, in the label's own script.
 *
 * The list used to be joined with "、" unconditionally — the CJK enumeration
 * comma. That is right for a Chinese or Japanese packet and wrong everywhere
 * else: on a Spanish label it set "Almendras、Caseinato de Sodio", a CJK
 * punctuation mark inside a Latin-script list, which reads as exactly the
 * rendering bug the bilingual block exists to avoid looking like.
 */
export function nativeListSeparator(sourceLanguage?: string): string {
  const base = (sourceLanguage ?? '').slice(0, 2).toLowerCase();
  return base === 'zh' || base === 'ja' ? '、' : ', ';
}

export function isProminentRank(labelRank?: { rank: number; total: number }): boolean {
  if (!labelRank) return false;
  if (labelRank.total < 3) return false;
  return labelRank.rank <= (labelRank.total >= 5 ? 3 : 2);
}

export function flagReason(t: T, flag: PersonalFlag): string {
  if (!flag.reasonKey || !((flag.reasonKey as TranslationKey) in TRANSLATED_KEYS)) {
    return flag.reason;
  }
  const params = { ...(flag.reasonParams ?? {}) };
  if (typeof params.allergen === 'string') params.allergen = localizeTerm(t, 'allergen', params.allergen);
  if (typeof params.severity === 'string') params.severity = localizeTerm(t, 'severity', params.severity);
  return t(flag.reasonKey as TranslationKey, params);
}

export function flagTitle(t: T, flag: PersonalFlag): string {
  if (flag.ingredientName === 'Label allergen statement') return t('flag.labelStatement');
  const key = `allergen.${flag.ingredientName.toLowerCase().replace(/ /g, '_')}` as TranslationKey;
  return key in TRANSLATED_KEYS ? t(key) : flag.ingredientName;
}

export interface VerdictCopy {
  word: string;
  why: string;
  sealLines: [string, string];
  /** The photo could not be read well enough to answer. */
  uncertain: boolean;
  /**
   * The photo was read fine and the question still cannot be answered.
   *
   * Separate from `uncertain` because the two have different remedies: one is
   * fixed by retaking the shot, the other by finding a certification mark. Both
   * share the neutral treatment — neither may wear a verdict's colours.
   */
  unsettled: boolean;
  /** null when the read confidence is unknown — hide the meter entirely. */
  segments: number | null;
  allergenFlags: PersonalFlag[];
  otherFlags: PersonalFlag[];
}

export function useVerdictCopy(result: AnalysisResult, profileName?: string): VerdictCopy {
  const { t } = useTranslation();

  const flags = result.personalFlags ?? [];
  const allergenFlags = flags.filter((f) => f.type === 'allergen' && f.certainty !== 'verify');
  const otherFlags = flags.filter((f) => !allergenFlags.includes(f));

  // Only an explicitly poor read produces the uncertain state; an unknown
  // one (a scan replayed from history) keeps the verdict it was saved with.
  const segments = confidenceSegments(result.readConfidence);
  const uncertain = segments !== null && segments < MIN_CONFIDENT_SEGMENTS;

  // Only ever replaces a CLEAN verdict. A real violation or an allergen still
  // outranks it: being unable to certify a product does not make it safer, and
  // a Caution card must not soften into "we cannot say".
  const unsettledRules = result.unsettled ?? [];
  const unsettled = !uncertain && result.overallRisk === 'low' && unsettledRules.length > 0;

  const word = uncertain
    ? t('verdict.uncertain')
    : unsettled
      ? t('verdict.needsProof')
      : t(RISK_KEYS[result.overallRisk]);

  // One sentence naming the specific cause — never a restatement of the level.
  const why = uncertain
    ? t('verdict.uncertainWhy')
    : unsettled
      ? t('verdict.needsProofWhy', {
          rule: localizeProfileTerm(t, 'dietary', unsettledRules[0]),
        })
      : allergenFlags.length > 0
      ? flagReason(t, allergenFlags[0])
      : otherFlags.length > 0
        ? flagReason(t, otherFlags[0])
        : (result.ingredients.find((i) => i.riskLevel === result.overallRisk)?.summary ?? '');

  const name = profileName ?? result.appliedProfile?.name;

  // The seal must never contradict the word beside it. "CLEARED" is only
  // legal on a Safe verdict: stamping it on a Caution card — which the
  // no-allergen-flag branch used to do — tells someone the opposite of the
  // verdict they are looking at.
  const sealLines: [string, string] = uncertain
    ? [t('verdict.sealUnclear1'), t('verdict.sealUnclear2')]
    : unsettled
    ? [t('verdict.sealUnsettled1'), t('verdict.sealUnsettled2')]
    : allergenFlags.length > 0
      ? [localizeAllergen(t, allergenFlags[0].match), t('verdict.sealFound')]
      : result.overallRisk === 'low'
        ? [t('verdict.sealCleared'), name ?? '']
        : [t('verdict.sealWatch'), name ?? ''];

  return { word, why, sealLines, uncertain, unsettled, segments, allergenFlags, otherFlags };
}
