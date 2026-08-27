import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark } from '@/components/aperture-mark';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Lamplight, Radius, Space, Type } from '@/constants/design';
import { PURCHASES_ENABLED } from '@/lib/config';
import { awaitEntitlement } from '@/lib/entitlement';
import { useTranslation } from '@/lib/i18n';
import { goBackOrHome } from '@/lib/navigation';
import { scheduleTrialReminder } from '@/lib/trialReminder';
import {
  PurchaseCancelledError,
  getPlans,
  purchasePlan,
  restorePurchases,
  storeSaysEntitled,
  type PlanOffer,
} from '@/lib/purchases';

// Screen 11 — Monetisation.
//
// Ink ground, and no verdict colour anywhere. The three inks mean a verdict;
// spending them on a "recommended" badge would trade the app's only trusted
// signal for a sale, and the verdict screen is where that trust has to survive.
//
// WHAT THIS SCREEN REFUSES TO DO
//
// No countdown. No "offer ends today". No pre-ticked plan the eye slides past,
// no obscured close button, no price that appears only after the tap. This app
// is a health tool whose entire equity is that it tells people the truth about
// what is in a jar; a dark pattern here is not a growth tactic, it is a
// contradiction of the product.
//
// THE TIMELINE IS THE POINT OF THE SCREEN
//
// It comes before the prices, and it says plainly when money moves: today it is
// free, on day five we remind you, on day seven you are charged unless you
// cancel. Saying so out loud raises trial starts rather than lowering them, and
// it collapses the two things that actually cost money later — refund requests
// and one-star reviews from people who felt ambushed. Apple also requires the
// terms to be legible before purchase (Guideline 3.1.2); this is that, written
// like a sentence instead of a disclosure.
//
// PRICES COME FROM THE STORE, NEVER FROM HERE
//
// `PlanOffer.price` is whatever StoreKit says in the person's own currency and
// storefront. Hard-coding "$7.99" would print a lie to everyone outside the US
// price tier — and a refund.

/**
 * The trial length we advertise, used ONLY while the store's own answer is
 * unavailable — see the note in the component. The real number always comes
 * from the product's introductory offer, so changing the offer in App Store
 * Connect changes every screen without a release; this constant exists so the
 * loading state is not blank, and never overrides a value the store gave us.
 */
const ADVERTISED_TRIAL_DAYS = 7;

export default function PaywallScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [plans, setPlans] = useState<PlanOffer[] | null>(null);
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  useEffect(() => {
    void getPlans().then(setPlans);
  }, []);

  const offer = plans?.find((p) => p.plan === selected) ?? null;

  // The trial is on the ANNUAL plan only; monthly bills immediately.
  //
  // Both values come from the store when we have it. This used to be
  // `offer?.trialDays || 7`, which promised a free week on whatever was
  // selected — so picking monthly would have shown a seven-day timeline and
  // then charged immediately, which is exactly the ambush this screen exists
  // to prevent, committed by our own copy.
  //
  // Before the offerings load, and when they cannot load at all, there is no
  // store answer to read. The screen still has to say something, so it says
  // what we advertise: annual carries the trial, monthly does not. Nothing can
  // be bought in that state — the CTA below is disabled whenever `offer` is
  // null — so this describes the offer rather than promising a specific
  // transaction.
  const hasTrial = offer ? offer.trialDays > 0 : selected === 'annual';
  const trialDays = offer?.trialDays || ADVERTISED_TRIAL_DAYS;

  async function startTrial() {
    if (!offer) return;
    setBusy('purchase');
    try {
      const info = await purchasePlan(offer);
      // Trust the SERVER, not the receipt in hand. RevenueCat's webhook is what
      // grants entitlement, and it lands a beat after StoreKit returns.
      const entitled = storeSaysEntitled(info) ? await awaitEntitlement() : null;
      if (entitled) {
        // Keep the promise the timeline just made, three lines up the screen.
        // Uses the server's expiry rather than a local date guess, so the
        // reminder lands relative to when Apple will actually bill.
        if (entitled.subscription.status === 'trialing' && entitled.subscription.expiresAt) {
          await scheduleTrialReminder(entitled.subscription.expiresAt, {
            title: t('trial.reminderTitle'),
            body: t('trial.reminderBody', {
              date: new Date(entitled.subscription.expiresAt).toLocaleDateString(),
            }),
          });
        }
        router.replace('/');
        return;
      }
      // Paid, but our side has not caught up. Never say "failed" here — the
      // money moved, and telling someone their purchase failed is how you get a
      // chargeback and a support thread on a purchase that actually worked.
      Alert.alert(t('paywall.pendingTitle'), t('paywall.pendingBody'));
      router.replace('/');
    } catch (error: any) {
      // Cancelling out of Apple's sheet is the most common outcome on any
      // paywall. It is not an error and must never produce an alert.
      if (error instanceof PurchaseCancelledError) return;
      Alert.alert(t('paywall.failedTitle'), error?.message ?? t('common.tryAgain'));
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      const info = await restorePurchases();
      if (storeSaysEntitled(info)) {
        await awaitEntitlement();
        router.replace('/');
        return;
      }
      Alert.alert(t('paywall.restoreNoneTitle'), t('paywall.restoreNoneBody'));
    } catch (error: any) {
      Alert.alert(t('paywall.failedTitle'), error?.message ?? t('common.tryAgain'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={goBackOrHome} hitSlop={12} accessibilityRole="button">
          <ThemedText style={[Type.meta, { color: Lamplight.inkFaint }]}>
            ✕ {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.head}>
          <ApertureMark size={40} color={Lamplight.ink} />
          <ThemedText style={[Type.title, { color: Lamplight.ink }]}>
            {t('paywall.title')}
          </ThemedText>
          <ThemedText style={[Type.reason, { color: Lamplight.inkMuted }]}>
            {t('paywall.body')}
          </ThemedText>
        </View>

        {/* What the subscription actually funds. The corpus line is the one
            claim no competitor can make, and it is true. */}
        <View style={styles.includes}>
          <Include text={t('paywall.includeUnlimited')} />
          <Include text={t('paywall.includeProfiles')} />
          <Include text={t('paywall.includeCitations')} />
          <Include text={t('paywall.includeHistory')} />
        </View>

        {/* The timeline, before the prices — but only when the selected plan
            actually has a trial. Monthly is billed today, and showing it a
            seven-day countdown would be a lie about that person's money.
            The monthly case gets its own, shorter statement rather than
            silence: the absence of a trial is the thing they most need to
            notice before tapping. */}
        <View style={[styles.timeline, { borderColor: Lamplight.rule }]}>
          {hasTrial ? (
            <>
              <ThemedText style={[Type.eyebrow, { color: Lamplight.inkFaint }]}>
                {t('paywall.timelineLabel', { days: trialDays })}
              </ThemedText>
              <Beat day={t('paywall.dayToday')} text={t('paywall.dayTodayBody')} />
              <Beat day={t('paywall.dayRemind')} text={t('paywall.dayRemindBody')} />
              <Beat
                day={t('paywall.dayCharge', { days: trialDays })}
                text={
                  offer
                    ? t('paywall.dayChargeBody', { price: offer.price })
                    : t('paywall.dayChargeBodyGeneric')
                }
                last
              />
            </>
          ) : (
            <>
              <ThemedText style={[Type.eyebrow, { color: Lamplight.inkFaint }]}>
                {t('paywall.noTrialLabel')}
              </ThemedText>
              <Beat
                day={t('paywall.dayToday')}
                text={
                  offer
                    ? t('paywall.billedTodayBody', { price: offer.price })
                    : t('paywall.billedTodayBodyGeneric')
                }
                last
              />
            </>
          )}
        </View>

        {plans === null ? (
          <ActivityIndicator color={Lamplight.ink} />
        ) : plans.length === 0 ? (
          // Honest dead end rather than a button that fails after the tap.
          <View style={[styles.unavailable, { borderColor: Lamplight.rule }]}>
            <ThemedText style={[Type.body, { color: Lamplight.inkMuted }]}>
              {PURCHASES_ENABLED ? t('paywall.plansUnavailable') : t('paywall.notOpenYet')}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.plans}>
            {plans.map((plan) => {
              const active = plan.plan === selected;
              return (
                <Pressable
                  key={plan.plan}
                  onPress={() => setSelected(plan.plan)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.plan,
                    { borderColor: active ? Lamplight.ink : Lamplight.rule },
                    active && { backgroundColor: Lamplight.card },
                  ]}
                >
                  <View style={styles.planText}>
                    <ThemedText style={[Type.label, { color: Lamplight.ink }]}>
                      {t(plan.plan === 'annual' ? 'paywall.annual' : 'paywall.monthly')}
                    </ThemedText>
                    <ThemedText style={[Type.meta, { color: Lamplight.inkMuted }]}>
                      {plan.plan === 'annual'
                        ? t('paywall.annualDetail', {
                            price: plan.price,
                            perMonth: plan.pricePerMonth,
                          })
                        : t('paywall.monthlyDetail', { price: plan.price })}
                    </ThemedText>
                    {/* Which plan carries the trial, stated on the row itself.
                        Only annual has one, and someone scanning the two
                        options has to be able to see that without selecting
                        each in turn to find out. Said plainly on BOTH rows —
                        "billed today" on monthly is the half that protects
                        the person rather than the sale. */}
                    <ThemedText style={[Type.meta, { color: Lamplight.inkFaint }]}>
                      {plan.trialDays > 0
                        ? t('paywall.planTrial', { days: plan.trialDays })
                        : t('paywall.planNoTrial')}
                    </ThemedText>
                  </View>
                  {/* Selection is a mono mark, never a coloured tick. */}
                  <ThemedText style={styles.tick}>{active ? '✓' : ''}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          style={[
            styles.primary,
            { backgroundColor: Lamplight.ink },
            (!offer || busy !== null) && styles.disabled,
          ]}
          disabled={!offer || busy !== null}
          onPress={() => void startTrial()}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.primaryLabel, { color: Lamplight.paper }]}>
            {busy === 'purchase'
              ? t('paywall.working')
              : hasTrial
                ? t('paywall.cta', { days: trialDays })
                : t('paywall.ctaNoTrial')}
          </ThemedText>
        </Pressable>

        {/* Required by Apple, and the real answer to "same person, new phone". */}
        <Pressable
          onPress={() => void restore()}
          disabled={busy !== null}
          hitSlop={12}
          style={styles.restore}
          accessibilityRole="button"
        >
          <ThemedText style={[Type.meta, { color: Lamplight.inkFaint }]}>
            {busy === 'restore' ? t('paywall.working') : t('paywall.restore')}
          </ThemedText>
        </Pressable>

        <ThemedText style={[Type.meta, styles.fine, { color: Lamplight.inkFaint }]}>
          {hasTrial ? t('paywall.fine', { days: trialDays }) : t('paywall.fineNoTrial')}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

function Include({ text }: { text: string }) {
  return (
    <View style={styles.include}>
      <View style={[styles.dot, { backgroundColor: Lamplight.inkFaint }]} />
      <ThemedText style={[Type.body, styles.includeText, { color: Lamplight.inkMuted }]}>
        {text}
      </ThemedText>
    </View>
  );
}

function Beat({ day, text, last = false }: { day: string; text: string; last?: boolean }) {
  return (
    <View style={[styles.beat, !last && { borderBottomColor: Lamplight.rule, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <ThemedText style={[Type.label, styles.beatDay, { color: Lamplight.ink }]}>{day}</ThemedText>
      <ThemedText style={[Type.body, styles.beatText, { color: Lamplight.inkMuted }]}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Lamplight.paper },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.lg,
    paddingBottom: Space.xxl,
    gap: Space.xl,
  },
  head: { gap: Space.md },

  includes: { gap: Space.sm },
  include: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 9, marginHorizontal: 5 },
  includeText: { flex: 1 },

  timeline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
    gap: Space.sm,
  },
  beat: { paddingVertical: Space.md, gap: 2 },
  beatDay: { letterSpacing: 0.3 },
  beatText: {},

  plans: { gap: Space.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
  },
  planText: { gap: Space.xs, flex: 1 },
  tick: { fontFamily: Font.monoMedium, fontSize: 14, color: Lamplight.ink },

  unavailable: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
  },

  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  disabled: { opacity: 0.4 },
  restore: { alignItems: 'center', paddingVertical: Space.sm },
  fine: { textAlign: 'center', lineHeight: 17 },
});
