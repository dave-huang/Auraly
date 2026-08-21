import { StyleSheet, View } from 'react-native';

import { ApertureMark, RevelyLockup } from '@/components/aperture-mark';
import { ThemedText } from '@/components/themed-text';
import { Font, Paper, RISK_TO_VERDICT, Space, Verdict, verdictTextStyle } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import type { AnalysisResult, RiskLevel } from '@/lib/types';
import { localizeAllergen } from '@/lib/verdict';

// The exported share object — a composed image, NOT a screenshot of the app.
//
// Two rules from the design govern everything here:
//
// 1. ALWAYS light theme, always the paper ground, regardless of the app's
//    theme. It has to survive being posted next to white feed chrome. That's
//    why this file imports `Paper` and `Verdict` directly and never calls
//    useSurface()/useVerdictColors() — a Lamplight export would disappear
//    into a dark post and read as broken.
//
// 2. The composition is FIXED. No user caption is baked in: every Revely
//    export has identical structure, which is what makes it recognisable in
//    a feed, and keeps user-written text from riding inside a card that
//    carries a health verdict under our name. Personal voice belongs in the
//    platform's own caption field, not in the image.

export type ShareFormat = 'feed' | 'story';

/** Design-specified output sizes, in physical pixels. */
export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

/** Logical width the card is laid out at; captured at 3x to hit 1080px. */
export const SHARE_LAYOUT_WIDTH = 360;
export const SHARE_PIXEL_RATIO = 3;

export function shareLayoutSize(format: ShareFormat) {
  const { width, height } = SHARE_SIZES[format];
  return { width: SHARE_LAYOUT_WIDTH, height: (height / width) * SHARE_LAYOUT_WIDTH };
}

function Seal({ lines, color, size }: { lines: [string, string]; color: string; size: number }) {
  return (
    <View
      style={[
        styles.seal,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
      ]}
    >
      <View style={[styles.sealInner, { borderRadius: (size - 10) / 2, borderColor: color }]}>
        {/* lineHeight scales with fontSize. A dynamic size with a static (or
            missing) line box is exactly how RN shears glyphs. */}
        {lines.filter(Boolean).map((line, i) => (
          <ThemedText
            key={i}
            style={[styles.sealText, { color, fontSize: size * 0.12, lineHeight: size * 0.16 }]}
          >
            {line}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

function ProfileChip({ name, allergens }: { name?: string; allergens?: string[] }) {
  // Localized here rather than by the caller, matching the in-app card: the
  // stored values are matcher keys ("tree_nuts"), and an exported image is the
  // last place the machine's vocabulary should show up.
  const { t } = useTranslation();
  return (
    <View style={styles.chipRow}>
      <ApertureMark size={14} color={Paper.inkMuted} />
      <ThemedText style={styles.chipText} numberOfLines={1}>
        {name ? `${name} · ` : ''}
        {allergens?.length
          ? allergens.map((a) => localizeAllergen(t, a)).join(' · ')
          : t('verdict.noAllergens')}
      </ThemedText>
    </View>
  );
}

export function ShareCard({
  format,
  result,
  word,
  reason,
  sealLines,
  profileName,
  profileAllergens,
}: {
  format: ShareFormat;
  result: AnalysisResult;
  word: string;
  reason: string;
  sealLines: [string, string];
  profileName?: string;
  profileAllergens?: string[];
}) {
  const tone = Verdict[RISK_TO_VERDICT[result.overallRisk as RiskLevel]];
  const size = shareLayoutSize(format);

  const native = result.originalIngredients?.join('、') ?? '';
  const english = result.canonicalIngredients?.join(', ') ?? '';
  // Same rule as the in-app card: only a genuine translation earns the block,
  // or an English label exports two identical columns and reads as a bug.
  const translated = Boolean(
    result.sourceLanguage && !result.sourceLanguage.toLowerCase().startsWith('en'),
  );
  const showBilingual = Boolean(native && english && translated);

  // Story is read at arm's length, so it leads with the seal and sets the
  // verdict word larger. Feed is read close, so it leads with word + reason
  // and carries the bilingual block, which is the trust-builder.
  const isStory = format === 'story';

  return (
    <View style={[styles.card, size, { backgroundColor: tone.wash }]}>
      {/* Same verdict edge as the in-app card, so a shared image is
          recognisably the same object someone saw in the app. */}
      <View style={[styles.edge, { backgroundColor: tone.ink }]} />
      <View style={styles.body}>
        <ProfileChip name={profileName} allergens={profileAllergens} />

        {isStory ? (
          <View style={styles.storyMain}>
            <Seal lines={sealLines} color={tone.ink} size={120} />
            <ThemedText
              style={[styles.word, verdictTextStyle(word), styles.wordStory, { color: tone.ink }]}
            >
              {word}
            </ThemedText>
            <ThemedText style={styles.reason} numberOfLines={4}>
              {reason}
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.feedHead}>
              <View style={styles.feedHeadText}>
                <ThemedText style={[styles.word, verdictTextStyle(word), { color: tone.ink }]}>
                  {word}
                </ThemedText>
                <ThemedText style={styles.reason} numberOfLines={3}>
                  {reason}
                </ThemedText>
              </View>
              <Seal lines={sealLines} color={tone.ink} size={84} />
            </View>

            {showBilingual ? (
              <View style={styles.bilingualBlock}>
                <ThemedText style={styles.eyebrow}>
                  Read from the label
                  {result.sourceLanguage ? ` · ${result.sourceLanguage.toUpperCase()} → EN` : ''}
                </ThemedText>
                <View style={styles.bilingual}>
                  <ThemedText style={styles.bilingualNative} numberOfLines={6}>
                    {native}
                  </ThemedText>
                  <View style={styles.hairline} />
                  <ThemedText style={styles.bilingualEn} numberOfLines={6}>
                    {english}
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.footer}>
        {/* Instrument Sans 600, never Newsreader: the serif belongs to the
            verdict word alone, and a serif wordmark here would read as a
            second verdict. */}
        <RevelyLockup size={20} color={Paper.ink} />
        <ThemedText style={styles.tagline}>read the label in any language</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  edge: { height: 10 },
  body: { padding: Space.xl, gap: Space.xl, flex: 1 },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  // Every lineHeight here is explicit and above its fontSize: an exported
  // image cannot be re-taken, so a sheared glyph ships forever.
  chipText: { fontFamily: Font.mono, fontSize: 10, lineHeight: 14, color: Paper.inkMuted, flex: 1 },

  feedHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  feedHeadText: { flex: 1, gap: Space.sm },
  storyMain: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.xl },

  // lineHeight must exceed fontSize or RN shears the ascenders.
  word: { fontFamily: Font.display, fontSize: 52, lineHeight: 66, letterSpacing: -1.6 },
  wordStory: { textAlign: 'center' },
  reason: { fontFamily: Font.sans, fontSize: 15, lineHeight: 21, color: Paper.inkMuted, textAlign: 'left' },

  // Paper ground with a ruled border, flat — the same treatment the in-app
  // card gives the quotation, so the two read as one object.
  bilingualBlock: {
    backgroundColor: Paper.paper,
    borderWidth: 1,
    borderColor: Paper.rule,
    padding: Space.lg,
    gap: Space.sm,
  },
  eyebrow: {
    fontFamily: Font.monoMedium,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Paper.inkFaint,
  },
  bilingual: { flexDirection: 'row', gap: Space.md },
  bilingualNative: { flex: 1, fontFamily: Font.sans, fontSize: 12, lineHeight: 17, color: Paper.ink },
  bilingualEn: { flex: 1, fontFamily: Font.sans, fontSize: 12, lineHeight: 17, color: Paper.inkMuted },
  hairline: { width: StyleSheet.hairlineWidth, backgroundColor: Paper.rule },

  seal: { borderWidth: 2, padding: 4 },
  sealInner: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  sealText: {
    fontFamily: Font.monoMedium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    backgroundColor: Paper.card,
  },
  tagline: { fontFamily: Font.mono, fontSize: 9, lineHeight: 13, color: Paper.inkFaint },
});
