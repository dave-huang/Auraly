import { useRouter } from 'expo-router';

import { StepFrame } from '@/components/onboarding/chrome';
import { useTranslation } from '@/lib/i18n';

// The last screen before the bill.
//
// It exists for one reason, and it is not persuasion: the people who ask for
// their money back are almost never the people who decided the app was not
// worth it. They are the people who forgot they had started a trial. Saying
// out loud, before anyone pays, that this phone will warn them costs a screen
// and prevents the single most common bad outcome of a free trial.
//
// ONE SENTENCE, AND NOTHING ELSE.
//
// This screen used to carry a three-row timeline (Today / Two days before /
// When it ends) and a paragraph about how the reminder is scheduled locally.
// All of it was true and all of it was noise: it turned the last beat before
// the price into a document, on a screen whose entire job is one promise. The
// promise is in the title and the line under it. The mechanics stayed in the
// code, where they belong, and the terms are stated in full on the paywall
// and in the Terms.
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
// The line that used to spell that condition out went with the rest of the
// small print. It has not stopped being true, and it is still stated where
// somebody looking for it will find it: the Terms, and iOS's own permission
// dialog at the moment the ask is actually made.

export default function ReminderScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <StepFrame
      // The questions are behind them. A full bar is the honest reading.
      progress={1}
      onLeft={() => router.replace('/trial')}
      leftGlyph="‹"
      leftLabel={t('common.back')}
      title={t('reminder.title')}
      body={t('reminder.body')}
      cta={t('reminder.cta')}
      onCta={() => router.replace('/paywall?gate=1&from=onboarding')}
    />
  );
}
