import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApertureMark } from '@/components/aperture-mark';
import { ApertureFrame, ResolveIn } from '@/components/aperture-reveal';
import { RiskMark } from '@/components/risk-mark';
import { TeachRing } from '@/components/teach-ring';
import { ThemedText } from '@/components/themed-text';
import { VerdictSeal } from '@/components/verdict-seal';
import {
  CONFIDENCE_SEGMENTS,
  Font,
  Radius,
  RISK_TO_VERDICT,
  RiskSignal,
  Space,
  Type,
  verdictTextStyle,
  useSurface,
  useVerdictColors,
} from '@/constants/design';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { setFocusedIngredient } from '@/lib/ingredient-focus';
import {
  flagReason,
  isProminentRank,
  localizeAllergen,
  localizeProfileTerm,
  nativeListSeparator,
  useVerdictCopy,
} from '@/lib/verdict';
import type { AnalysisResult, Ingredient, PersonalFlag } from '@/lib/types';

// The verdict card. One component carries the product, so it is built as a
// self-contained object with a FIXED internal order — every screenshot of it
// shows the same thing in the same places:
//
//   verdict edge → profile chip → verdict word → reason → seal
//   → READ FROM THE LABEL → ingredients → confidence meter → controls → mark
//
// Screenshot rule from the design: the card must stay legible cropped to its
// top 40%, the region a thumb leaves visible when someone films a scan. Seal,
// word and reason all live in that band, and the card carries its own paper
// rather than inheriting the camera behind it.
//
// The card is FLAT (Radius.flat). Roundness in this system means "you can
// press this" or "this is a sheet"; the card is neither.

/**
 * Five ink segments, never a percentage — a number invites arguing.
 *
 * The filled segments arrive one at a time, left to right, which is the
 * machine counting rather than announcing. Only the FILLED ones animate: the
 * empty segments are the measure the filled ones are read against, so they are
 * present from the first frame. A meter that drew its own scale as it went
 * would make four-of-five look like four-of-four until it finished.
 */
function ConfidenceMeter({ segments, color, faint }: { segments: number; color: string; faint: string }) {
  return (
    <View style={styles.meter}>
      {Array.from({ length: CONFIDENCE_SEGMENTS }).map((_, i) =>
        i < segments ? (
          <ResolveIn key={i} index={i} style={styles.segment}>
            <View style={[styles.segmentFill, { backgroundColor: color }]} />
          </ResolveIn>
        ) : (
          <View key={i} style={[styles.segment, { backgroundColor: faint }]} />
        ),
      )}
    </View>
  );
}

interface Row {
  key: string;
  name: string;
  original?: string;
  /**
   * The printed ingredient this one was found inside, when it came out of a
   * bracket. Undefined for anything printed at top level, which is nearly
   * every row.
   */
  parent?: string;
  note: string;
  flagged: boolean;
  /** Position as analysed, so ties keep the label's own order. */
  index: number;
  ingredient: Ingredient;
  flag?: PersonalFlag;
}

/**
 * Sort key for the ingredient list — lower sorts first.
 *
 * Colour first, strictly: every red row, then every amber, then every green.
 * The level is the one in force (`riskLevel` is already personal where a
 * profile raised it), so a peanut allergy's red row and a dairy intolerance's
 * amber one land in their own colour, and the list never shows an amber dot
 * above a red one.
 *
 * Within a colour, the rows raised because of WHO this user is come first,
 * allergens first among them — that is the part no other app can tell them,
 * and sorting a vegan flag above a sesame match would put a preference ahead
 * of a hospital visit. Then a match that changed nothing (a `verify` hedge),
 * then the rest.
 *
 * This used to put every personal match above everything else. A whey row for
 * a milk intolerance is amber, and it sat above Titanium Dioxide's red, which
 * read as the list contradicting its own colours.
 */
function rowWeight(row: Row): number {
  const level = row.ingredient.riskLevel;
  const band = level === 'high' ? 0 : level === 'moderate' ? 1 : 2;
  let within = 3;
  if (row.ingredient.personalRiskLevel) {
    within = row.flag?.type === 'allergen' && row.flag.certainty !== 'verify' ? 0 : 1;
  } else if (row.flag) {
    within = 2;
  }
  return band * 4 + within;
}

export function AnalysisView({
  result,
  subtitle,
  profileName,
  profileAllergens,
  controls,
  onRetake,
  onPressProfile,
  teach,
  onIngredientsLayout,
}: {
  result: AnalysisResult;
  subtitle?: string;
  profileName?: string;
  profileAllergens?: string[];
  /**
   * Ring the row that set the verdict and say so, once, then let it go.
   *
   * Passed by /demo and by nothing else. A first-time reader has no idea which
   * of thirty rows produced the word at the top of the card, and this points
   * at it for a few seconds on the one card where they have never seen the
   * layout before. Absent everywhere else on purpose: a real scan is not a
   * lesson, and a highlight on every result would be the app annotating its
   * own output forever.
   */
  teach?: string;
  /**
   * Where the ingredient list starts, in this card's own coordinates.
   *
   * Only /demo asks. It needs to scroll the list into view before the teaching
   * ring appears on it, and the list's position depends on how tall the
   * verdict, the reason and the bilingual block turned out to be in whichever
   * language is showing — so it is measured rather than guessed.
   */
  onIngredientsLayout?: (y: number) => void;
  /** Part 7 of the anatomy. Passed in so the card stays one object while the
   *  host screen decides what "next" means — scan again, or back to history. */
  controls?: ReactNode;
  onRetake?: () => void;
  /** Makes the chip the way into the profile switcher, where the design puts
   *  it: the answer is about a person, so the person is the control. */
  onPressProfile?: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();
  const verdictColors = useVerdictColors();

  const { word, why, sealLines, uncertain, unsettled, segments, allergenFlags, otherFlags } =
    useVerdictCopy(result, profileName);
  // Both states drop the verdict ink. An answer we cannot stand behind must
  // never wear a verdict's clothes — whether the photo failed or the question
  // was never answerable from a label.
  const neutral = uncertain || unsettled;
  const flags = result.personalFlags ?? [];

  const level = RISK_TO_VERDICT[result.overallRisk];
  const tone = verdictColors[level];
  const name = profileName ?? result.appliedProfile?.name;
  const edgeColor = neutral ? surface.rule : tone.ink;

  const chipText = profileAllergens?.length
    ? profileAllergens.map((a) => localizeAllergen(t, a)).join(' · ')
    : t('verdict.noAllergens');

  const native = result.originalIngredients?.join(nativeListSeparator(result.sourceLanguage)) ?? '';
  const english = result.canonicalIngredients?.join(', ') ?? '';
  // Only a genuine translation earns the block. On an English label the two
  // columns are the same words with different separators, which reads as a
  // rendering bug rather than the trust-builder it is meant to be.
  const translated = Boolean(
    result.sourceLanguage && !result.sourceLanguage.toLowerCase().startsWith('en'),
  );
  const showBilingual = Boolean(native && english && translated);

  const rows = buildRows(result, flags, t, translated);
  // The list is the evidence for the verdict, so it is ordered by how much each
  // row contributed to it: by colour, personal matches first within one. See
  // rowWeight.
  //
  // Rows used to sit in plain label order, which meant risk
  // played NO part in the ordering at all. On any card without a personal match
  // — every card, for anyone whose profile did not happen to fire — the
  // ingredient that caused a Caution or Avoid verdict could sit seventh, below
  // six rows of "no concerns found". The one row that explained the headline
  // was the hardest one to find.
  const ordered = [...rows].sort((a, b) => rowWeight(a) - rowWeight(b) || a.index - b.index);

  // How many levels a published record decided, rather than our own reading.
  // Both are honest answers; they are not equally strong, and a user is
  // entitled to know the mix without having to open every ingredient.
  const sourcedCount = result.ingredients.filter((ing) => ing.riskSource === 'record').length;

  const checked = result.checked ?? [];
  // The settling action opens the drill-down for the ingredient the doubt is
  // about, so it needs that ingredient's row. No row, no button — the block
  // still explains itself, it just doesn't offer a dead control.
  const settleRow = result.settle?.ingredientName
    ? rows.find((r) => r.name === result.settle?.ingredientName)
    : undefined;

  function openIngredient(row: Row) {
    setFocusedIngredient({
      ingredient: row.ingredient,
      original: row.original,
      flag: row.flag,
      profileName: name,
      productType: result.productType,
      language: result.language,
    });
    router.push('/ingredient');
  }

  return (
    <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
      {/* Verdict edge — the card's one saturated stripe, and colourless
          whenever we cannot stand behind an answer.
          Dashed is reserved for a label we could not READ; an unsettled card
          gets a solid grey edge, because the reading went fine and it is the
          question that has no answer. Two different remedies, two different
          marks. */}
      {uncertain ? (
        <View style={[styles.edgeUncertain, { borderTopColor: surface.inkFaint }]} />
      ) : (
        <View style={[styles.edge, { backgroundColor: edgeColor }]} />
      )}

      <View style={[styles.hero, { backgroundColor: neutral ? surface.sunk : tone.wash }]}>
        {/* Profile chip — bordered, mono, and always present. The empty state
            says so out loud rather than hiding: a verdict with nobody behind
            it is the one thing this card must not imply. */}
        <Pressable
          style={[styles.chip, { borderColor: neutral ? surface.rule : tone.ink }]}
          disabled={!onPressProfile}
          onPress={onPressProfile}
        >
          <ApertureMark size={14} color={neutral ? surface.inkMuted : tone.ink} />
          <ThemedText
            style={[styles.chipText, { color: neutral ? surface.inkMuted : tone.ink }]}
            numberOfLines={1}
          >
            {name ? `${name} · ${chipText}` : t('verdict.noProfile')}
          </ThemedText>
        </Pressable>

        <View style={styles.verdictRow}>
          <View style={styles.verdictText}>
            <ThemedText
              style={[
                Type.verdict,
                verdictTextStyle(word),
                { color: neutral ? surface.ink : tone.ink },
              ]}
            >
              {word}
            </ThemedText>
            <ThemedText style={[Type.reason, styles.why, { color: surface.inkMuted }]}>
              {why}
            </ThemedText>
          </View>
          <VerdictSeal lines={sealLines} color={neutral ? surface.inkFaint : tone.ink} />
        </View>
      </View>

      {/* An allergen the partial read DID catch.

          "Not sure" replaces the verdict word, the reason and the seal, so
          without this block an allergen found in the readable part of a bad
          photo would appear nowhere except a row far down the list. That is the
          one place withholding is most dangerous: a missed warning is a hospital
          visit, a false one is a lost snack, and the asymmetry decides it.

          Stated as unconfirmed, and colourless — the card still refuses to wear
          a verdict ink it has not earned. This names what we saw without
          claiming we read the label. */}
      {uncertain && allergenFlags.length > 0 ? (
        <View style={[styles.block, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.unconfirmedAllergenEyebrow')}
          </ThemedText>
          <View style={[styles.unconfirmed, { borderColor: surface.inkMuted }]}>
            <ThemedText style={[Type.reason, { color: surface.ink }]}>
              {t('verdict.unconfirmedAllergen', {
                allergen: allergenFlags
                  .map((f) => localizeAllergen(t, f.match))
                  .join(', '),
              })}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Uncertain gets retake affordances where a confident card gets
          evidence — the honest next move, not a softened verdict. */}
      {uncertain ? (
        <View style={[styles.block, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.retakeEyebrow')}
          </ThemedText>
          {(['retakeLight', 'retakeFlatten', 'retakeType'] as const).map((key) => (
            <View key={key} style={styles.tipRow}>
              <View style={[styles.tipDash, { backgroundColor: surface.inkFaint }]} />
              <ThemedText style={[Type.body, styles.tipText, { color: surface.inkMuted }]}>
                {t(`verdict.${key}`)}
              </ThemedText>
            </View>
          ))}
          {onRetake ? (
            <Pressable
              style={[styles.inlineAction, { borderColor: surface.ink }]}
              onPress={onRetake}
            >
              <ThemedText style={[Type.label, { color: surface.ink }]}>
                {t('verdict.retake')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* READ FROM THE LABEL — original beside its translation, on the paper
          ground inside the card so it reads as a quotation, not a claim.
          Redacted when the read failed: showing garbled OCR as if it were the
          label is worse than admitting the frame was unreadable. */}
      {showBilingual || uncertain ? (
        <View style={[styles.block, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.readFromLabel')}
            {!uncertain && result.sourceLanguage
              ? ` · ${result.sourceLanguage.toUpperCase()}→EN`
              : ''}
          </ThemedText>
          <View style={[styles.quote, { backgroundColor: surface.paper, borderColor: surface.rule }]}>
            {uncertain ? (
              /* The aperture, held still over the part that would not come
                 clear. Everywhere else in the app it sweeps and resolves;
                 here it must not, because the read genuinely failed and an
                 animation that resolved would be claiming otherwise. Static
                 brackets say only "this is where we looked", which is the
                 whole of what we can honestly say. Drawn faint, and never in
                 a verdict ink — uncertain carries no verdict colour. */
              <ApertureFrame style={styles.redactedFrame} color={surface.inkFaint}>
                <View style={styles.redacted}>
                  {[0.92, 0.78, 0.85, 0.4].map((width, i) => (
                    <View
                      key={i}
                      style={[styles.redactedBar, { width: `${width * 100}%`, backgroundColor: surface.rule }]}
                    />
                  ))}
                </View>
              </ApertureFrame>
            ) : (
              <View style={styles.bilingual}>
                <ThemedText style={[Type.body, styles.bilingualCol, { color: surface.ink }]}>
                  {native}
                </ThemedText>
                <View style={[styles.hairline, { backgroundColor: surface.rule }]} />
                <ThemedText style={[Type.body, styles.bilingualCol, { color: surface.inkMuted }]}>
                  {english}
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {/* WHAT WE CHECKED — the receipt behind a clean answer. Only shown when
          nothing was found: on a card that already names a problem, listing
          the checks that passed buries the one that didn't. */}
      {!uncertain && checked.length > 0 && flags.length === 0 ? (
        <View style={[styles.block, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.whatWeChecked')}
          </ThemedText>
          <View style={styles.checkWrap}>
            {checked.map((item) => (
              <View
                key={`${item.type}-${item.term}`}
                style={[styles.checkChip, { borderColor: surface.rule, backgroundColor: surface.paper }]}
              >
                <ThemedText style={[styles.checkText, { color: surface.inkMuted }]}>
                  {localizeProfileTerm(t, item.type, item.term)}
                </ThemedText>
              </View>
            ))}
          </View>
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            {t('verdict.noneFound')}
          </ThemedText>
        </View>
      ) : null}

      {/* CLOSEST CALL — the check that went to the edge and held. It is the
          difference between "nothing found" and "we looked hard". */}
      {!uncertain && result.closestCall ? (
        <View style={[styles.block, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.closestCall')}
          </ThemedText>
          <ThemedText style={[Type.body, { color: surface.ink }]}>
            {t('verdict.closestCallBody', {
              ingredient: result.closestCall.ingredientName,
              keyword: result.closestCall.keyword,
              allergen: localizeAllergen(t, result.closestCall.term),
            })}
          </ThemedText>
        </View>
      ) : null}

      {/* Ingredients: a green, orange or red mark, the name, and the reason. */}
      <View
        style={[styles.block, { borderTopColor: surface.rule }]}
        onLayout={(e) => onIngredientsLayout?.(e.nativeEvent.layout.y)}
      >
        <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
          {/* Counts the rows below, which is also what the packet prints.
              This briefly counted the label's top-level entries instead, on
              the theory that a bracket hides what is inside it. It does not:
              every name in "White Candy Coating (Sugar, Palm Kernel Oil, …)"
              is printed on the bag in the same type as the rest. Grouping is
              not concealment, so counting groups reported 4 above a list of
              24 and disagreed with both the screen and the packet.
              Where the grouping genuinely matters, the rows say so
              themselves: "inside White Candy Coating" on each part, and
              "#1 of 4" where position carries weight. */}
          {t('verdict.ingredientCount', { count: result.ingredients.length })}
        </ThemedText>
        {/* Read line by line, and shown that way. The rows come into focus in
            order rather than all at once — the app's own act, said as motion.
            The stagger is capped inside ResolveIn, so a forty-ingredient label
            still finishes in the same fraction of a second a short one does. */}
        {ordered.map((row, i) => (
          <ResolveIn key={row.key} index={i}>
          <MaybeTeach
            // Only the leading row, and only when it earned its place. On a
            // label of ordinary groceries `ordered[0]` is simply the first of
            // thirty clean rows, and ringing it while announcing that it set
            // the verdict would be pointing at nothing.
            teach={i === 0 && row.ingredient.riskLevel !== 'low' ? teach : undefined}
            tone={RiskSignal[row.ingredient.riskLevel].ink}
          >
          <Pressable
            style={[styles.row, { borderBottomColor: surface.sunk }]}
            onPress={() => openIngredient(row)}
          >
            <RiskMark level={row.ingredient.riskLevel} />
            <View style={styles.rowText}>
              <ThemedText style={[Type.label, { color: surface.ink }]}>{row.name}</ThemedText>
              {/* The printed name under the translation. Someone comparing the
                  card to the packet in their hand needs the words that are
                  actually on the packet. */}
              {row.original && row.original !== row.name ? (
                <ThemedText style={[styles.rowOriginal, { color: surface.inkFaint }]}>
                  {row.original}
                </ThemedText>
              ) : null}
              {/* Where the label actually printed it.
                  Sub-ingredients are analysed and ranked like any other row,
                  and the list is sorted by risk rather than by label order, so
                  a wheat flour hidden inside "Enriched Flour" can and should
                  rise to the top. Without this line it arrives there looking
                  like something printed on its own. */}
              {row.parent ? (
                <ThemedText style={[styles.rowOriginal, { color: surface.inkFaint }]}>
                  {t('verdict.insideIngredient', { parent: row.parent })}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={[Type.meta, styles.rowNote, { color: surface.inkFaint }]}>
              {row.note}
            </ThemedText>
          </Pressable>
          </MaybeTeach>
          </ResolveIn>
        ))}
      </View>

      {/* Flags that did not become the headline reason. */}
      {otherFlags.length > 0 ? (
        <View style={[styles.block, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('results.flaggedForYou')}
          </ThemedText>
          {otherFlags.map((flag, i) => (
            <ThemedText key={i} style={[Type.body, { color: surface.inkMuted }]}>
              {flagReason(t, flag)}
            </ThemedText>
          ))}
        </View>
      ) : null}

      {/* WHAT WOULD SETTLE THIS — present only when the doubt is actually
          resolvable, with the ingredient it concerns as the way in. */}
      {!uncertain && result.settle ? (
        <View style={[styles.block, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.wouldSettle')}
          </ThemedText>
          <ThemedText style={[Type.body, { color: surface.ink }]}>
            {t(result.settle.reasonKey as TranslationKey, result.settle.params)}
          </ThemedText>
          {settleRow ? (
            <Pressable
              style={[styles.inlineAction, { borderColor: surface.ink }]}
              onPress={() => openIngredient(settleRow)}
            >
              <ThemedText style={[Type.label, { color: surface.ink }]}>
                {t('verdict.settleAction', { ingredient: settleRow.name })}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Confidence meter — the machine reporting on itself, so mono. No meter
          when the read confidence is unknown: an empty or guessed meter would
          assert something we cannot support. */}
      {segments !== null ? (
        <View style={[styles.confRow, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.labelRead')}
          </ThemedText>
          <ConfidenceMeter
            segments={segments}
            color={uncertain ? surface.inkFaint : tone.ink}
            faint={surface.rule}
          />
          {/* Counts when the reader supplied them, the qualitative word when
              it didn't — never both, and never a count the reader invented. */}
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            {result.lineCount
              ? t('verdict.lineCount', {
                  read: result.lineCount.read,
                  total: result.lineCount.total,
                })
              : uncertain
                ? t('verdict.confPartial')
                : t('verdict.confClear')}
          </ThemedText>
        </View>
      ) : null}

      {/* How many of these levels a published document decided.

          Sits with the label-read meter because it answers the same kind of
          question — what does the machine know, and how surely. Every
          ingredient now has a level; this says how many of them we can put a
          source behind rather than our own reading.

          Hidden when the answer is none, which is the state on a label of
          ordinary groceries. "0 of 8" reads as a failure when it is really just
          a shopping list nobody has needed to regulate. */}
      {sourcedCount > 0 ? (
        <View style={[styles.confRow, { borderTopColor: surface.rule }]}>
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
            {t('verdict.sourcesChecked')}
          </ThemedText>
          <ThemedText style={[Type.meta, styles.coverageCount, { color: surface.inkFaint }]}>
            {t('verdict.sourcesCheckedCount', { checked: sourcedCount, total: rows.length })}
          </ThemedText>
        </View>
      ) : null}

      {controls ? (
        <View style={[styles.controls, { borderTopColor: surface.rule }]}>{controls}</View>
      ) : null}

      {/* NOT MEDICAL ADVICE, said on the card rather than only in the terms.
          
          This app reads allergen labels for people who have a reason to care
          what is on them, and until now the only place it said what it is not
          was a policy document nobody opens. The sentence belongs where the
          verdict is, which is here.

          Set as a footnote and not as a warning banner, on purpose. Anything
          alarm-coloured on every scan would train people to look past it
          inside a week, and it would also be the loudest thing on a card whose
          whole argument is that it is calm. Quiet, present, and in the same
          place every time is what makes a disclaimer readable rather than
          furniture.

          Written in the register of the Terms rather than in the app's own
          voice, deliberately. Two friendlier drafts came before this one, and
          the friendlier they got the more they read as the app hedging about
          the exact job it exists to do — a conversational caveat invites you
          to weigh it, while boilerplate is understood as boilerplate and read
          past. This is a legal notice, so it is written as one, and it uses
          the Terms' own words: not a medical device, does not diagnose or
          treat, not a substitute for professional advice, read the physical
          label if the allergy is serious.

          On every card, not just /results: /demo shows a real verdict and
          /scan-detail shows an old one, and a person cannot be expected to
          remember which screen carried the caveat. */}
      <View style={[styles.disclaimer, { borderTopColor: surface.rule }]}>
        {/* Sans, not Type.meta's mono. Mono is the machine's voice in this
            system — a line count, a transcription, a source id — and this
            sentence is Revely speaking in the first person about what it is
            and is not. Setting it in the machine face would file the one
            human caveat on the card under "readout". */}
        <ThemedText style={[styles.disclaimerText, { color: surface.inkFaint }]}>
          {t('results.disclaimer')}
        </ThemedText>
      </View>

      <View style={[styles.footer, { borderTopColor: surface.rule }]}>
        <View style={styles.footerMark}>
          {/* 14, not 12: the mark carries two bars at every size now, and 12
              was the one place where the pair started closing into a slab. */}
          <ApertureMark size={14} color={surface.inkFaint} />
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>Revely</ThemedText>
        </View>
        <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>{subtitle ?? ''}</ThemedText>
      </View>
    </View>
  );
}

/**
 * The short reason a row is flagged.
 *
 * A bare rule name is ambiguous in the worst direction: "Fish · vegan" reads
 * as a claim that fish IS vegan, when it means the opposite. Dietary and
 * condition matches say what they violate; only an allergen can stand alone,
 * because naming the allergen beside the ingredient is already the whole
 * sentence.
 */
function rowNote(
  t: (key: any, params?: Record<string, string | number>) => string,
  flag: PersonalFlag,
): string {
  if (flag.type === 'allergen') return localizeAllergen(t, flag.match);
  if (flag.type === 'dietary') return t('verdict.noteNot', { rule: localizeAllergen(t, flag.match) });
  // Conditions live under their own key prefix. Looking them up as allergens
  // finds nothing and falls through to the raw key, so an aspartame row for
  // someone with phenylketonuria read "pku" — a database identifier printed on
  // a safety card. Same defect that once printed "tree_nuts".
  return localizeProfileTerm(t, 'condition', flag.match);
}

/**
 * What the right-hand note says when nothing in the profile matched.
 *
 * Every branch answers one question — what do our sources say about this? — so
 * the four possible answers read on the same scale. The vocabulary this
 * replaced mixed registers badly: "regulated" was a fact, "worth reading" was
 * advice, "clear" was a verdict, and "not checked" was an apology for two
 * completely different situations.
 *
 * Position on the label is appended when it is prominent enough to matter. It
 * is the only quantity on the card, so it goes last and stays in machine voice.
 */
function unflaggedNote(
  t: (key: any, params?: Record<string, string | number>) => string,
  ing: Ingredient,
): string {
  const base = (): string => {
    // Where a published record set the level, say something specific — those
    // two phrases are worth more than the level alone and we can stand behind
    // them. Otherwise just name the level. Whether the level came from a record
    // or from our own assessment is answered in the drill-down, under "says
    // who?", which is where that question is actually asked.
    if (ing.riskSource === 'record') {
      const decidedBy = ing.policyRuleIds?.[0] ?? '';
      if (decidedBy.startsWith('high.')) return t('verdict.noteRegulated');
      if (decidedBy === 'moderate.health_body_intake_limit') return t('verdict.noteLimitIntake');
    }

    if (ing.riskLevel === 'high') return t('verdict.noteHigh');
    if (ing.riskLevel === 'moderate') return t('verdict.noteWatch');
    return t('verdict.noteNoConcern');
  };

  const rank = ing.labelRank;
  if (rank && isProminentRank(rank)) {
    return `${base()} · ${t('verdict.noteRank', { rank: rank.rank, total: rank.total })}`;
  }
  return base();
}

/**
 * One row per ingredient, with the flag that matched it resolved.
 *
 * A flag names the ingredient in ENGLISH. When results are shown in another
 * language, `ing.name` is localized and never matches — so the canonical name
 * at the same index is compared too, or a flagged allergen renders as "clear".
 *
 * That index is an ASSUMPTION, and a narrow one. `originalIngredients` and
 * `canonicalIngredients` come from the label reader; `ingredients` comes from
 * the analyzer, which is free to split, merge, and reorder what it was given —
 * a label reading "Peanut Butter (Ground Peanuts), Corn Grits" comes back as
 * [Peanut Butter, Corn Grits, Peanuts], and zipping by position then prints
 * "Ground Peanuts" underneath Corn Grits. On an allergen card that is not a
 * cosmetic slip: it puts a nut name under something that is not a nut.
 *
 * So the index is trusted only where it has to be and only where it can be:
 *  - the per-row original is shown ONLY on a genuinely translated label, where
 *    there is a distinct source string worth showing and no other key exists.
 *    On an English label the "original" IS the name, so any difference between
 *    them is misalignment, never information.
 *  - the canonical fallback is used only when the two lists are the same
 *    length, which is the weakest evidence that no splitting happened.
 */
function buildRows(
  result: AnalysisResult,
  flags: PersonalFlag[],
  t: (key: any, params?: Record<string, string | number>) => string,
  translated: boolean,
): Row[] {
  const sameLength = result.canonicalIngredients?.length === result.ingredients.length;

  // english sub-ingredient name -> the printed entry it belongs to.
  //
  // Matched on the canonical English names the reader produced, which is the
  // only key both sides share: `ing.name` is localized on a translated card,
  // and composition is always English. On a localized card the lookup simply
  // misses and the line is omitted, which is the right failure — a wrong
  // parent would tell somebody an allergen came from the wrong ingredient.
  const parentOf = new Map<string, string>();
  for (const entry of result.composition ?? []) {
    for (const part of entry.parts) {
      const key = part.trim().toLowerCase();
      // First parent wins, so an ingredient printed inside two different
      // brackets is attributed to the earlier (heavier) one rather than
      // flickering between them.
      if (key && !parentOf.has(key)) parentOf.set(key, entry.name);
    }
  }

  return result.ingredients.map((ing, i) => {
    // Pair a flag to its row by the index the server tagged it with, and
    // otherwise by an exact name match.
    //
    // This used to fall back to `canonicalIngredients[i]` whenever the two
    // arrays were the same length. They are two different lists — the label's
    // printed order from the reader, and the analyzer's own — and equal length
    // does not make them aligned. One split or merged entry shifts every
    // position after it, so a "milk" flag landed on whatever ingredient
    // happened to sit at the dairy entry's index: Dextrin, Enzymes, Citric
    // Acid and Maltose all read "matches Milk/Dairy" on a curry roux, each of
    // them sitting directly beside a genuine dairy row.
    //
    // An older cached result carries no index, so the name match still stands
    // on its own. Flags belonging to no row (a label's "contains" line) never
    // matched a row before and still do not.
    const flag = flags.find((f) => {
      if (f.ingredientIndex !== undefined) return f.ingredientIndex === i;
      return f.ingredientName.toLowerCase() === ing.name.toLowerCase();
    });

    // A personally flagged ingredient carries the flag's level, not the
    // population-level risk. Peanut butter is "low risk" in general and an
    // avoid for someone with a peanut allergy, and showing it green because the
    // base analysis says low would contradict the verdict directly above it.
    // `ing.riskLevel` is already the level in force (personal where one
    // applies, universal otherwise), so the mark needs no branch for it.
    //
    // Which colour comes from the flag's own `impact`, not from its type. The
    // old test — allergen means avoid, everything else means caution — was
    // wrong in both directions: it painted a lactose intolerance the same red
    // as an anaphylaxis, and it painted aspartame-for-someone-with-PKU amber,
    // which is the single case this whole layer was built to get right.
    // One rule for the dot and the note: the row speaks for whichever level is
    // actually in force.
    //
    // A row leads with its personal reason when a personal factor RAISED the
    // level. A flag that matched but changed nothing — a `verify` hedge about
    // how the sugar was filtered — does not get to speak over a real finding
    // about the substance, in either channel. Letting it speak in only one
    // produced an amber dot beside the words "no concerns", which is the row
    // arguing with itself.
    const personal = ing.personalRiskLevel;
    const leadWithFlag = Boolean(flag) && Boolean(personal);

    return {
      key: `${ing.name}-${i}`,
      name: ing.name,
      original:
        translated && sameLength ? result.originalIngredients?.[i] : undefined,
      parent: parentOf.get(ing.name.trim().toLowerCase()),
      // An unflagged row still has to agree with its own dot: an amber dot
      // beside the word "clear" is the row arguing with itself.
      //
      // The note and the dot answer different questions. The dot says how much
      // concern this ingredient carries; the note says on what basis. So the
      // note is derived from the RULE that produced the level, not from the
      // level itself — "limit intake" and "regulated" are both moderate-to-high
      // findings that a reader needs to tell apart.
      // A DEFINITE personal match is the most important thing about a row, so
      // it takes the note. A `verify` hedge is not: it says the ingredient
      // might conflict depending on how it was sourced, which is a weaker
      // statement than an actual finding about the substance.
      //
      // Getting this backwards hid real information. On a chocolate label the
      // sugar row read "not vegan" — a bone-char maybe — while the WHO
      // free-sugars finding and the position on the label, both certain, were
      // not shown at all. The hedge is still on the card; it is the headline
      // reason directly above.
      // "you · Peanut" — the prefix is what makes an overridden row legible at
      // a glance. Without it the card shows a red dot next to an ingredient
      // most people can eat quite safely, and never says why it is red for
      // this reader in particular.
      note: leadWithFlag
        ? t('verdict.noteForYou', { reason: rowNote(t, flag!) })
        : unflaggedNote(t, ing),
      flagged: Boolean(flag),
      index: i,
      ingredient: ing,
      flag,
    };
  });
}

/**
 * The ring, or nothing at all.
 *
 * A wrapper rather than a conditional in the middle of the list, so the row's
 * own markup stays written once. Every card except the example passes no
 * caption and gets its children straight back.
 */
function MaybeTeach({
  teach,
  tone,
  children,
}: {
  teach?: string;
  tone: string;
  children: React.ReactNode;
}) {
  if (!teach) return <>{children}</>;
  return (
    <TeachRing tone={tone} caption={teach}>
      {children}
    </TeachRing>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.flat,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  edge: { height: 6 },
  edgeUncertain: { height: 6, borderTopWidth: 2, borderStyle: 'dashed' },

  hero: { padding: Space.xl, gap: Space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingLeft: Space.sm,
    paddingRight: Space.md,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  chipText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15, flexShrink: 1 },
  verdictRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  verdictText: { flex: 1 },
  why: { marginTop: Space.xs },

  block: { padding: Space.xl, gap: Space.md, borderTopWidth: StyleSheet.hairlineWidth },
  quote: { borderWidth: StyleSheet.hairlineWidth, padding: Space.md },
  bilingual: { flexDirection: 'row', gap: Space.md, alignItems: 'flex-start' },
  bilingualCol: { flex: 1 },
  hairline: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  redactedFrame: { paddingVertical: Space.sm, paddingHorizontal: Space.md },
  redacted: { gap: 6, paddingVertical: 2 },
  redactedBar: { height: 9 },

  checkWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  checkChip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Space.md,
    paddingVertical: 5,
  },
  checkText: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  tipDash: { width: 8, height: 1, marginTop: 11 },
  tipText: { flex: 1 },
  inlineAction: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    marginTop: Space.xs,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, gap: 1 },
  rowOriginal: { fontFamily: Font.mono, fontSize: 11, lineHeight: 15 },
  rowNote: { textAlign: 'right', maxWidth: '38%' },

  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  meter: { flexDirection: 'row', gap: 3, flex: 1 },
  // Pushed right so the count lands under the label-read count above it,
  // reading as a second line of the same report rather than a new claim.
  coverageCount: { flex: 1, textAlign: 'right' },
  // Bordered, not filled, and carrying no verdict ink: the card is saying what
  // it saw, not what it concluded.
  unconfirmed: {
    borderWidth: 1,
    borderRadius: Radius.flat,
    padding: Space.md,
    marginTop: Space.xs,
  },
  segment: { flex: 1, height: 3 },
  // The fill inside an animated segment: the wrapper owns the track's width,
  // this owns the ink.
  segmentFill: { flex: 1, height: 3 },

  controls: {
    padding: Space.xl,
    gap: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disclaimer: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Between Type.body and Type.meta: small enough to read as fine print,
  // large enough that somebody with a severe allergy can actually read it.
  disclaimerText: { fontFamily: Font.sans, fontSize: 12, lineHeight: 17 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerMark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
