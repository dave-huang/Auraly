import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  Font,
  Gutter,
  RISK_TO_VERDICT,
  Radius,
  RiskSignal,
  Space,
  Type,
  useSurface,
  useVerdictColors,
} from '@/constants/design';
import { fetchAllergenAliases } from '@/lib/allergens';
import { goBackOrHome } from '@/lib/navigation';
import { useTranslation } from '@/lib/i18n';
import { getFocusedIngredient } from '@/lib/ingredient-focus';
import { fetchSubstanceEvidence, type Jurisdiction, type SubstanceEvidence } from '@/lib/substances';
import { RISK_LABEL_KEYS, flagReason, isProminentRank, localizeAllergen } from '@/lib/verdict';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Jurisdiction codes as a reader would name them.
 *
 * "US-CA" is the register's shorthand, not a place anyone says out loud, and a
 * screen that quotes a regulator should name the regulator's territory in the
 * reader's language.
 */
const JURISDICTION_KEYS: Record<Jurisdiction, TranslationKey> = {
  EU: 'jurisdiction.EU',
  UK: 'jurisdiction.UK',
  US: 'jurisdiction.US',
  'US-CA': 'jurisdiction.US_CA',
  CA: 'jurisdiction.CA',
  AU: 'jurisdiction.AU',
  INTL: 'jurisdiction.INTL',
};

function localizeJurisdiction(t: (key: TranslationKey) => string, code: Jurisdiction): string {
  const key = JURISDICTION_KEYS[code];
  return key ? t(key) : code;
}

// Screen 09 — Drill-down · Ingredient detail.
//
// One ingredient, and the four things someone actually wants after a verdict:
// why it flagged, what the claim rests on, who says so, and what other names
// it goes by. Everything here is quotation and citation — the screen makes no
// claim of its own, which is why the verdict ink appears on a single edge and
// nowhere else.

export default function IngredientScreen() {
  const { t } = useTranslation();
  const surface = useSurface();
  const verdictColors = useVerdictColors();

  const focus = getFocusedIngredient();
  const [aliases, setAliases] = useState<string[] | null>(null);
  const [evidence, setEvidence] = useState<SubstanceEvidence | null>(null);

  const flag = focus?.flag;
  const profileName = focus?.profileName;
  const substanceId = focus?.ingredient.substanceId;
  const evidenceDomain: 'food' | 'cosmetic' =
    focus?.productType === 'personal_care' ? 'cosmetic' : 'food';

  useEffect(() => {
    // Only the corpus can answer this, and only for a resolved substance.
    // A failure leaves `evidence` null, which renders as the "not checked"
    // block — the same thing an empty corpus says, and equally true from the
    // reader's side.
    if (!substanceId) return;
    let live = true;
    fetchSubstanceEvidence(substanceId, evidenceDomain, focus?.language)
      .then((data) => live && setEvidence(data))
      // A failure leaves `evidence` null, which renders as the "not checked"
      // block — the same thing an empty corpus says, and equally true from
      // the reader's side.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [substanceId, evidenceDomain, focus?.language]);

  useEffect(() => {
    // Aliases come from the server's matcher, not a copy in the app: a stale
    // duplicate would explain a match using words that no longer match.
    if (flag?.type !== 'allergen') return;
    let live = true;
    fetchAllergenAliases(flag.match)
      .then((list) => live && setAliases(list))
      .catch(() => live && setAliases([]));
    return () => {
      live = false;
    };
  }, [flag?.type, flag?.match]);

  if (!focus) return <Redirect href="/" />;

  const { ingredient, original } = focus;
  const tone = flag
    ? verdictColors[flag.type === 'allergen' && flag.certainty !== 'verify' ? 'avoid' : 'caution']
    : ingredient.riskLevel === 'low'
      ? null
      : verdictColors[RISK_TO_VERDICT[ingredient.riskLevel]];

  const citations = flag?.citations ?? ingredient.citations ?? [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={goBackOrHome} hitSlop={12}>
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            ‹ {t('common.back')}
          </ThemedText>
        </Pressable>

        <View>
          <ThemedText style={[Type.title, { color: surface.ink }]}>{ingredient.name}</ThemedText>
          {original && original !== ingredient.name ? (
            <ThemedText style={[styles.original, { color: surface.inkFaint }]}>
              {original}
            </ThemedText>
          ) : null}
        </View>

        {/* The two levels, side by side.

            Shown ONLY when they differ, which is the only time the comparison
            says anything. This is where "the personal level overrides the
            universal one" gets stated out loud instead of being implied by a
            dot colour: most people can eat this, and here is the specific thing
            about you that changes it. */}
        {ingredient.personalRiskLevel &&
        ingredient.universalRiskLevel &&
        ingredient.personalRiskLevel !== ingredient.universalRiskLevel ? (
          <View style={[styles.section, { borderTopColor: surface.rule }]}>
            <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
              {t('ingredient.twoLevels')}
            </ThemedText>
            <View style={styles.levelRow}>
              <ThemedText style={[Type.body, styles.levelLabel, { color: surface.inkMuted }]}>
                {t('ingredient.forMostPeople')}
              </ThemedText>
              <ThemedText
                style={[Type.label, { color: RiskSignal[ingredient.universalRiskLevel].ink }]}
              >
                {t(RISK_LABEL_KEYS[ingredient.universalRiskLevel])}
              </ThemedText>
            </View>
            <View style={styles.levelRow}>
              <ThemedText style={[Type.body, styles.levelLabel, { color: surface.ink }]}>
                {profileName ? t('ingredient.forProfile', { profile: profileName }) : t('ingredient.forYou')}
              </ThemedText>
              <ThemedText
                style={[Type.label, { color: RiskSignal[ingredient.personalRiskLevel].ink }]}
              >
                {t(RISK_LABEL_KEYS[ingredient.personalRiskLevel])}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {/* Why it flagged. The only place on this screen carrying verdict ink,
            and only as an edge. */}
        {flag ? (
          <View style={[styles.panel, { backgroundColor: surface.card, borderColor: surface.rule }]}>
            {tone ? <View style={[styles.panelEdge, { backgroundColor: tone.ink }]} /> : null}
            <View style={styles.panelBody}>
              <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
                {t('ingredient.whyFlagged')}
              </ThemedText>
              <ThemedText style={[Type.reason, { color: surface.ink }]}>
                {flagReason(t, flag)}
              </ThemedText>
              {flag.certainty === 'verify' ? (
                <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
                  {t('ingredient.verifyNote')}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* The regulatory record — why this ingredient carries the level it
            does, in the words of the bodies that decided it.

            In the scan's language where a translation exists, marked as one,
            with the English original a tap away. These were shown only in
            English until 2026-09-24, on the reasoning that a translated
            quotation is not a quotation; but most are sentences our ingest
            wrote, and a Chinese reader shown English was not reading them. The
            original stays one tap away because it is what can be checked. */}
        {evidence && evidence.records.length > 0 ? (
          <View style={[styles.section, { borderTopColor: surface.rule }]}>
            <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
              {t('ingredient.regulatoryRecord')}
            </ThemedText>

            {/* The divergence, when there is one. This is the sentence the whole
                substance corpus exists to be able to say. */}
            {evidence.divergence ? (
              <View style={[styles.divergence, { borderColor: surface.rule }]}>
                <ThemedText style={[Type.body, { color: surface.ink }]}>
                  {t('ingredient.divergence', {
                    permitted: evidence.divergence.permittedIn
                      .map((j) => localizeJurisdiction(t, j))
                      .join(', '),
                    prohibited: evidence.divergence.prohibitedIn
                      .map((j) => localizeJurisdiction(t, j))
                      .join(', '),
                  })}
                </ThemedText>
              </View>
            ) : null}

            {evidence.records.map((record, i) => (
              <View key={`${record.org}-${i}`} style={styles.record}>
                <SourceStatement statement={record.statement} translated={record.statementTranslated} />
                <Pressable
                  disabled={!record.url}
                  onPress={() => record.url && void Linking.openURL(record.url)}
                >
                  <ThemedText style={[styles.source, { color: surface.inkMuted }]}>
                    {record.org} · {localizeJurisdiction(t, record.jurisdiction)}
                    {record.determinedOn ? ` · ${record.determinedOn}` : ''}
                    {record.url ? ' ↗' : ''}
                  </ThemedText>
                </Pressable>
              </View>
            ))}

            {/* Identifiers, when a source gave us one. Mono, because this is the
                machine's handle on the substance rather than a claim about it —
                and it is what makes an answer checkable against the register. */}
            {evidence.cas || evidence.eNumber ? (
              <ThemedText style={[styles.identifiers, { color: surface.inkFaint }]}>
                {[evidence.cas ? `CAS ${evidence.cas}` : null, evidence.eNumber]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {/* What it is. */}
        <View style={[styles.section, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('ingredient.what')}
          </ThemedText>
          <ThemedText style={[Type.body, { color: surface.ink }]}>
            {ingredient.details || ingredient.summary}
          </ThemedText>
          {ingredient.riskAdjustmentReason ? (
            <ThemedText style={[Type.meta, { color: surface.inkMuted }]}>
              {ingredient.riskAdjustmentReason}
            </ThemedText>
          ) : null}
        </View>

        {/* Position on the label — the one quantity available without a
            nutrition panel, and the only thing on this screen derived from the
            product rather than from a source. Shown only when it is high enough
            to mean something: "11th of 14" is trivia. */}
        {isProminentRank(ingredient.labelRank) ? (
          <View style={[styles.section, { borderTopColor: surface.rule }]}>
            <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
              {t('verdict.rankEyebrow')}
            </ThemedText>
            <ThemedText style={[Type.body, { color: surface.ink }]}>
              {t('verdict.rankBody', {
                rank: ingredient.labelRank!.rank,
                total: ingredient.labelRank!.total,
              })}
            </ThemedText>
          </View>
        ) : null}

        {/* Sources. A review status is shown on every one: an AI-seeded entry
            claiming the authority of a reviewed one is the failure mode this
            whole knowledge base exists to avoid. */}
        {citations.length > 0 ? (
          <View style={[styles.section, { borderTopColor: surface.rule }]}>
            <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
              {t('ingredient.sources')}
            </ThemedText>
            {citations.map((citation) => (
              <View key={citation.entryId} style={styles.citation}>
                <SourceStatement statement={citation.statement} translated={citation.statementTranslated} />
                {citation.sources.map((source, i) => (
                  <Pressable
                    key={`${citation.entryId}-${i}`}
                    disabled={!source.url}
                    onPress={() => source.url && void Linking.openURL(source.url)}
                  >
                    <ThemedText style={[styles.source, { color: surface.inkMuted }]}>
                      {source.org}
                      {source.year ? ` · ${source.year}` : ''} · {source.title}
                      {source.url ? ' ↗' : ''}
                    </ThemedText>
                  </Pressable>
                ))}
                <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
                  {t(
                    citation.reviewStatus === 'human_reviewed'
                      ? 'ingredient.humanReviewed'
                      : 'ingredient.aiSeeded',
                  )}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {/* Aliases — the other names this hides under on a label. */}
        {flag?.type === 'allergen' ? (
          <View style={[styles.section, { borderTopColor: surface.rule }]}>
            <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
              {t('ingredient.aliases', { allergen: localizeAllergen(t, flag.match) })}
            </ThemedText>
            {aliases === null ? (
              <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>…</ThemedText>
            ) : aliases.length === 0 ? (
              <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
                {t('ingredient.noAliases')}
              </ThemedText>
            ) : (
              <View style={styles.aliasWrap}>
                {aliases.map((alias) => (
                  <View
                    key={alias}
                    style={[styles.alias, { borderColor: surface.rule, backgroundColor: surface.card }]}
                  >
                    <ThemedText style={[styles.aliasText, { color: surface.inkMuted }]}>
                      {alias}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A source's statement, in the scan's language when a translation exists.
 *
 * The translation is labelled as one and the English original is a tap away,
 * never swapped for it: the original is the thing a reader can check against
 * the register, and a translation that hid it would be claiming to be it.
 */
function SourceStatement({ statement, translated }: { statement: string; translated?: string | null }) {
  const surface = useSurface();
  const { t } = useTranslation();
  const [showOriginal, setShowOriginal] = useState(false);
  if (!translated) {
    return <ThemedText style={[Type.body, { color: surface.ink }]}>{statement}</ThemedText>;
  }
  return (
    <View style={styles.statement}>
      <ThemedText style={[Type.body, { color: surface.ink }]}>{translated}</ThemedText>
      {showOriginal ? (
        <ThemedText style={[Type.body, { color: surface.inkMuted }]}>{statement}</ThemedText>
      ) : null}
      <Pressable
        onPress={() => setShowOriginal((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityState={{ expanded: showOriginal }}
      >
        <ThemedText style={[styles.source, { color: surface.inkFaint }]}>
          {t('ingredient.translated')} · {t(showOriginal ? 'ingredient.hideOriginal' : 'ingredient.showOriginal')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Gutter, gap: Space.xl, paddingBottom: Space.xxl },
  original: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18, marginTop: 2 },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    overflow: 'hidden',
  },
  panelEdge: { height: 6 },
  panelBody: { padding: Space.lg, gap: Space.sm },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Space.lg, gap: Space.sm },
  // Two levels read as a comparison only when they line up vertically, so the
  // label takes the space and the level sits hard against the right edge.
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: Space.md },
  levelLabel: { flex: 1 },
  citation: { gap: Space.xs, paddingTop: Space.sm },
  statement: { gap: Space.xs },
  footnote: { paddingTop: Space.xs },
  source: { fontFamily: Font.mono, fontSize: 11, lineHeight: 16 },
  // The divergence sits in a bordered box rather than a coloured one: the three
  // verdict inks mean a verdict, and this is a fact about two legal regimes.
  divergence: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.md,
    marginTop: Space.xs,
  },
  record: { gap: Space.xs, paddingTop: Space.sm },
  identifiers: { fontFamily: Font.mono, fontSize: 11, lineHeight: 16, paddingTop: Space.sm },
  aliasWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  alias: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.md,
    paddingVertical: 5,
  },
  aliasText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },
});
