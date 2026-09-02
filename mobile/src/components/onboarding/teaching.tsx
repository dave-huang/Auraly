import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApertureMark } from '@/components/aperture-mark';
import { RiskMark } from '@/components/risk-mark';
import { ThemedText } from '@/components/themed-text';
import { Font, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';

// The screens in this flow that ask for nothing.
//
// They are the reason the flow is allowed to be long. A questionnaire that is
// only questions gets abandoned around the sixth one; what keeps someone moving
// is being given something between the asks. Each of these pays out a fact the
// app can actually back up: what a chemical name turns into, how a label hides
// an allergen, why a barcode is the wrong thing to read, who the verdicts are
// quoting, and what happens to the photograph. The length buys understanding
// rather than just sunk cost.
//
// Everything here is set in type. There is no photograph in any of them, and
// that is deliberate: a stock shot of a supermarket aisle would say nothing
// these words do not, and this app's whole visual argument is that a label is a
// document. The wash drawings sit below them, in their own space.

/**
 * Split a string on `*marked*` runs.
 *
 * The copy needs two words inside a sentence picked out, and the words are
 * different in every language — so the emphasis has to travel WITH the
 * translation rather than being positional. A translator moves the asterisks;
 * nobody has to touch this file.
 */
function marked(source: string): { text: string; hit: boolean }[] {
  return source
    .split('*')
    .filter((part) => part.length > 0)
    .map((text, index) => ({ text, hit: index % 2 === 1 }));
}

/**
 * "One ingredient, ten words for it."
 *
 * The single most convincing thing this app knows, and the thing every person
 * who has ever had to read a label for someone else already half-suspects. The
 * terms listed are the real ones from the milk entry in the allergen matcher,
 * not a persuasive selection.
 */
export function AliasPlate() {
  const { t } = useTranslation();
  const surface = useSurface();

  return (
    <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
      <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
        {t('teach.aliasEyebrow')}
      </ThemedText>

      {/* Set in mono, like the label transcription on the results screen —
          this is meant to read as something photographed, not as our prose. */}
      <ThemedText style={[styles.labelText, { color: surface.inkFaint }]}>
        {marked(t('teach.aliasLabel')).map((part, index) => (
          <ThemedText
            key={index}
            style={
              part.hit
                ? [styles.labelText, styles.hit, { color: surface.ink, borderBottomColor: surface.ink }]
                : [styles.labelText, { color: surface.inkFaint }]
            }
          >
            {part.text}
          </ThemedText>
        ))}
      </ThemedText>

      <View style={[styles.rule, { borderTopColor: surface.rule }]} />

      <ThemedText style={[Type.title, { color: surface.ink }]}>
        {t('teach.aliasVerdict')}
      </ThemedText>
      <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
        {t('teach.aliasWords')}
      </ThemedText>
    </View>
  );
}

/**
 * Three names off a real label, and what each one turns into.
 *
 * The first thing the app does, shown rather than promised. It is also the only
 * place in the flow that puts the three risk marks side by side, which is worth
 * doing once before anyone meets them on a results screen: green, amber and red
 * mean something specific here, and seeing all three at once is how somebody
 * learns that the green one is a real answer rather than a blank.
 *
 * The examples are chosen to make that point. One to be careful with, one that
 * is completely fine, and one from the bathroom shelf rather than the kitchen,
 * because this app reads skincare too and nothing else in onboarding says so.
 */
export function DecodePlate() {
  const { t } = useTranslation();
  const surface = useSurface();

  const rows: [string, string, 'low' | 'moderate' | 'high'][] = [
    [t('teach.decodeOne'), t('teach.decodeOneWhat'), 'moderate'],
    [t('teach.decodeTwo'), t('teach.decodeTwoWhat'), 'low'],
    [t('teach.decodeThree'), t('teach.decodeThreeWhat'), 'high'],
  ];

  return (
    <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
      <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
        {t('teach.decodeEyebrow')}
      </ThemedText>

      {rows.map(([name, what, level], index) => (
        <Fragment key={name}>
          {index > 0 ? <View style={[styles.rule, { borderTopColor: surface.rule }]} /> : null}
          <View style={styles.decodeRow}>
            <View style={styles.decodeMark}>
              <RiskMark level={level} />
            </View>
            <View style={styles.decodeText}>
              {/* The printed name in mono, the way the results screen sets a
                  transcription: this is quoted from a packet, not our prose. */}
              <ThemedText style={[styles.labelText, { color: surface.ink }]}>{name}</ThemedText>
              <ThemedText style={[Type.body, { color: surface.inkMuted }]}>{what}</ThemedText>
            </View>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/**
 * Why this app points at the ingredient list and not at the barcode.
 *
 * Worth its own screen because it is the question every person who has used a
 * barcode scanner will ask, and because the answer is the reason the product
 * works at all. A barcode is a pointer into somebody's database. The printed
 * list is a legal declaration about the object in your hand.
 *
 * Two panels rather than a paragraph: the whole point is the comparison.
 */
export function LabelPlate() {
  const { t } = useTranslation();
  const surface = useSurface();

  const panels: [string, string][] = [
    [t('teach.labelBarcode'), t('teach.labelBarcodeWhat')],
    [t('teach.labelPrinted'), t('teach.labelPrintedWhat')],
  ];

  return (
    <View style={styles.panels}>
      {panels.map(([name, what], index) => (
        <View
          key={name}
          style={[
            styles.panel,
            {
              backgroundColor: index === 1 ? surface.card : surface.sunk,
              borderColor: surface.rule,
            },
          ]}
        >
          <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>{name}</ThemedText>
          <ThemedText
            style={[Type.body, { color: index === 1 ? surface.ink : surface.inkMuted }]}
          >
            {what}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Who the verdicts are quoting. The claim the competitors cannot make. */
export function SourcePlate() {
  const { t } = useTranslation();
  const surface = useSurface();

  const bodies: [string, string][] = [
    [t('teach.sourceFda'), t('teach.sourceFdaWhat')],
    [t('teach.sourceEfsa'), t('teach.sourceEfsaWhat')],
    [t('teach.sourceIarc'), t('teach.sourceIarcWhat')],
    [t('teach.sourceWho'), t('teach.sourceWhoWhat')],
  ];

  return (
    <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
      {bodies.map(([name, what], index) => (
        <Fragment key={name}>
          {index > 0 ? <View style={[styles.rule, { borderTopColor: surface.rule }]} /> : null}
          <View style={styles.sourceRow}>
            <ThemedText style={[styles.sourceName, { color: surface.ink }]}>{name}</ThemedText>
            <ThemedText style={[Type.body, styles.sourceWhat, { color: surface.inkMuted }]}>
              {what}
            </ThemedText>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/**
 * What happens to the photograph.
 *
 * Every line here is checked against what the code does, and the wording is
 * narrower than the wording people expect. "Never leaves your phone" would be
 * FALSE — the image is uploaded to be read. What is true is that it is read
 * and dropped: it is never written to the database, never attached to the
 * account, and the only lasting copy is the one on the device. A privacy
 * promise this app cannot keep is worse than none.
 */
export function PrivacyPlate() {
  const { t } = useTranslation();
  const surface = useSurface();

  const lines = [t('teach.privacyOne'), t('teach.privacyTwo'), t('teach.privacyThree')];

  return (
    <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
      <ApertureMark size={26} color={surface.inkFaint} />
      {lines.map((line, index) => (
        <Fragment key={line}>
          {index > 0 ? <View style={[styles.rule, { borderTopColor: surface.rule }]} /> : null}
          <ThemedText style={[Type.body, { color: surface.ink }]}>{line}</ThemedText>
        </Fragment>
      ))}
    </View>
  );
}

/**
 * Everything they just entered, read back to them.
 *
 * The commitment beat. Ten screens of answering questions is work, and this is
 * the screen that shows the work added up to something — the profile stated as
 * a standing instruction rather than as a form they filled in.
 */
export function ReflectPlate({ name, lines }: { name: string; lines: string[] }) {
  const { t } = useTranslation();
  const surface = useSurface();

  return (
    <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
      <View style={styles.reflectHead}>
        <ApertureMark size={22} color={surface.ink} />
        <ThemedText style={[Type.title, { color: surface.ink }]}>{name}</ThemedText>
      </View>

      {lines.length === 0 ? (
        <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
          {t('teach.reflectNone')}
        </ThemedText>
      ) : (
        lines.map((line) => (
          <View key={line} style={[styles.reflectRow, { borderTopColor: surface.rule }]}>
            <ThemedText style={[Type.body, { color: surface.ink }]}>{line}</ThemedText>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.md,
  },
  rule: { borderTopWidth: StyleSheet.hairlineWidth },

  labelText: { fontFamily: Font.mono, fontSize: 13, lineHeight: 21 },
  // An underline rather than a highlight: this is a reader's pencil mark on a
  // document, and a highlighter would be the first block of flat colour in an
  // app whose only colour is a verdict.
  hit: { borderBottomWidth: 1 },

  decodeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  // Nudged onto the first line of type rather than the top of the block.
  decodeMark: { paddingTop: 6 },
  decodeText: { flex: 1, gap: 3 },

  panels: { gap: Space.sm },
  // The second panel is on card stock and the first is sunk, so the comparison
  // has a winner before either is read.
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.sm,
  },

  sourceRow: { gap: Space.xs },
  sourceName: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  sourceWhat: { flex: 1 },

  reflectHead: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  reflectRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Space.md },
});
