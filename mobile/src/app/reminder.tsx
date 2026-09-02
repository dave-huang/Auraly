import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { StepFrame } from '@/components/onboarding/chrome';
import { ThemedText } from '@/components/themed-text';
import { Radius, Space, Type, useSurface } from '@/constants/design';
import { useTranslation } from '@/lib/i18n';
import { goBackOrHome } from '@/lib/navigation';

// The last screen before the bill.
//
// It exists for one reason, and it is not persuasion: the people who ask for
// their money back are almost never the people who decided the app was not
// worth it. They are the people who forgot they had started a trial. Saying
// out loud, before anyone pays, that this phone will warn them costs a screen
// and prevents the single most common bad outcome of a free trial.
//
// EVERYTHING HERE IS A PROMISE THE CODE ALREADY KEEPS
//
// lib/trialReminder.ts schedules a LOCAL notification two days before the
// expiry the server reports, using Apple's own billing date rather than a
// guess. No token, no server, no APNs — nothing about anyone's trial leaves
// the device. That is why the last line can say so.
//
// WHAT THIS SCREEN DOES NOT DO
//
// It does not ask for notification permission. There is no trial yet, and
// "Revely would like to send you notifications" over a trial that does not
// exist is exactly the ask people decline. The permission is requested by
// scheduleTrialReminder, immediately after the purchase, on the far side of
// the paywall — at which point the person has already read this promise and
// the ask is the app keeping it.
//
// Hence "as long as notifications are on", which is not a disclaimer bolted
// onto a sales line. It is the literal condition, and someone who declines
// later should not be able to say they were told otherwise.

export default function ReminderScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const surface = useSurface();

  const steps: [string, string][] = [
    [t('reminder.nowLabel'), t('reminder.nowBody')],
    [t('reminder.beforeLabel'), t('reminder.beforeBody')],
    [t('reminder.endsLabel'), t('reminder.endsBody')],
  ];

  return (
    <StepFrame
      // The questions are behind them. A full bar is the honest reading.
      progress={1}
      onLeft={goBackOrHome}
      leftGlyph="‹"
      leftLabel={t('common.back')}
      title={t('reminder.title')}
      body={t('reminder.body')}
      cta={t('reminder.cta')}
      onCta={() => router.replace('/paywall?gate=1')}
    >
      <View style={[styles.card, { backgroundColor: surface.card, borderColor: surface.rule }]}>
        {steps.map(([label, detail], index) => (
          <Fragment key={label}>
            {index > 0 ? <View style={[styles.rule, { borderTopColor: surface.rule }]} /> : null}
            <View style={styles.row}>
              <ThemedText style={[Type.eyebrow, { color: surface.inkFaint }]}>{label}</ThemedText>
              <ThemedText style={[Type.body, { color: surface.ink }]}>{detail}</ThemedText>
            </View>
          </Fragment>
        ))}
      </View>

      <ThemedText style={[Type.meta, styles.note, { color: surface.inkFaint }]}>
        {t('reminder.note')}
      </ThemedText>
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
  row: { gap: Space.xs },
  note: { marginTop: Space.sm },
});
