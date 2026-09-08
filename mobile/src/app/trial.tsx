import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { StepFrame } from '@/components/onboarding/chrome';
import { ThemedText } from '@/components/themed-text';
import { Font, Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';

// Between the example verdict and the bill, part one of two.
//
// The sequence is demo, then this, then /reminder, then the paywall. That
// looks like two screens standing between somebody and a price, and it is,
// deliberately: the two of them answer the only two questions a person has at
// this exact moment, and answering them on the paywall itself would bury both
// under a price and two plan rows.
//
//   Here     what do I actually get, and does anything happen to my card
//            today. Named plainly, before any number is shown.
//
//   Reminder what stops me forgetting I started this. That screen exists
//            because forgetting, not disliking, is what produces refunds.
//
// WHAT THIS SCREEN MUST NOT DO. It must not name a price, a plan or a number
// of days. The trial length comes from the store's introductory offer, per
// plan, and the paywall reads it live; anything hard-coded here would be a
// second source of truth for a commercial fact, and the moment the two
// disagreed this screen would be lying about money.

export default function TrialScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();

  const includes = [
    t('paywall.includeUnlimited'),
    t('paywall.includeProfiles'),
    t('paywall.includeCitations'),
    t('paywall.includeHistory'),
  ];

  return (
    <StepFrame
      progress={1}
      // Back a step, not out of the flow. Everything from /demo onwards is
      // reached with replace rather than push — deliberately, so nobody can
      // swipe back into a paid screen after buying — which means each screen
      // has to name the one before it rather than lean on a stack.
      onLeft={() => router.replace('/demo')}
      leftGlyph="‹"
      leftLabel={t('common.back')}
      title={t('trial.title')}
      body={t('trial.body')}
      cta={t('trial.cta')}
      onCta={() => router.replace('/reminder')}
    >
      <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
        <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>
          {t('trial.includesLabel')}
        </ThemedText>
        {includes.map((line, index) => (
          <Fragment key={line}>
            {index > 0 ? <View style={[styles.rule, { borderTopColor: surface.rule }]} /> : null}
            <ThemedText style={[Type.body, { color: surface.ink }]}>{line}</ThemedText>
          </Fragment>
        ))}
      </View>

      {/* The one line people are actually looking for. A tick rather than a
          sentence, because it is a fact to be spotted rather than read. */}
      <View style={styles.assurance}>
        <ThemedText style={[styles.tick, { color: surface.ink }]}>✓</ThemedText>
        <ThemedText style={[Type.label, { color: surface.ink }]}>
          {t('trial.noPayment')}
        </ThemedText>
      </View>
    </StepFrame>
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
  assurance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingTop: Space.md,
  },
  tick: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
});
