import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApertureMark } from '@/components/aperture-mark';
import { HalftonePlate } from '@/components/halftone-plate';
import { ThemedText } from '@/components/themed-text';
import { Font, Gutter, Radius, Space, Type, useSurface } from '@/constants/design';
import { APPLE_SUBSCRIPTIONS_URL, PRIVACY_URL, PURCHASES_ENABLED, TERMS_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth-context';
import {
  awaitEntitlement,
  refreshEntitlement,
  useEntitlement,
  type Entitlement,
} from '@/lib/entitlement';
import { useTranslation } from '@/lib/i18n';
import { goBackOrHome } from '@/lib/navigation';
import { scheduleTrialReminder } from '@/lib/trialReminder';
import {
  AlreadySubscribedError,
  PurchaseCancelledError,
  ReceiptInUseError,
  getPlans,
  purchasePlan,
  restorePurchases,
  storeHasSubscription,
  storeSaysEntitled,
  type PlanOffer,
} from '@/lib/purchases';

// Screen 11 — Monetisation.
//
// It follows the device theme. It used to be pinned to ink ground in both,
// which read as deliberate weight in the design and as a rendering fault on a
// phone set to light: welcome, onboarding and results are all paper, and this
// screen dropped to black between them. The emphasis was not worth being
// mistaken for a bug on the screen that asks for money.
//
// No verdict colour anywhere, which has not changed. The three inks mean a
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
  const surface = useSurface();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  /**
   * Whether this screen came up as a locked door or was opened deliberately.
   *
   * It changes what "already subscribed" should do. Someone stopped mid-scan
   * wants their scan, so the right answer is to send them back to it. Someone
   * who tapped "Subscription" in the menu wants to see their subscription, and
   * bouncing them to the camera would look like the tap did nothing.
   */
  const gate = useLocalSearchParams<{ gate?: string }>().gate === '1';

  // What the SERVER says this person already has. Not the store — same rule as
  // everywhere else in the app, and the reason a jailbroken device cannot show
  // itself a subscribed screen.
  const { entitlement, loading: entitlementLoading, refresh } = useEntitlement(!!user);
  const sub = entitlement?.subscription;
  const subscribed = !!sub?.active;

  /**
   * The store says there is already a subscription here and we could not turn
   * it into access. Never sell on top of that — see the mount effect below.
   */
  const [storeSubscribed, setStoreSubscribed] = useState(false);
  const [checkingStore, setCheckingStore] = useState(PURCHASES_ENABLED);

  const [plans, setPlans] = useState<PlanOffer[] | null>(null);
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);

  useEffect(() => {
    void getPlans().then(setPlans);
  }, []);

  /**
   * Silently check whether this person is ALREADY subscribed before selling to
   * them.
   *
   * Landing on the paywall holding a valid subscription is the exact shape of
   * a lost webhook: the purchase went through, RevenueCat knows, and our
   * server was never successfully told. The person then gets asked to pay
   * twice, which is the worst thing this screen could do.
   *
   * Signed in only — an anonymous device has no account to look up. Failures
   * are ignored on purpose: this is a rescue, and if it cannot run the screen
   * should still work as an ordinary paywall.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // 1. Ask our server to go and look. Signed in only — an anonymous
        //    device has no account to write an answer to.
        if (user) {
          const found = await refreshEntitlement().catch(() => null);
          if (cancelled) return;
          if (found?.subscription.active) {
            // A locked door that turns out to be unlocked: go through it.
            // Anywhere else, stay and show them what they have.
            if (gate) router.replace('/');
            else void refresh();
            return;
          }
        }

        // 2. Ask the store. This is what catches the case that produced this
        //    code: a subscription the store knows about and we do not, where
        //    the plan rows below would happily sell a SECOND plan. Apple does
        //    not refuse that — monthly and annual are different products in
        //    one group, so buying the other one is a plan change, not a
        //    duplicate — which means nothing downstream can catch it either.
        //    It has to be caught before the tap.
        if (!(await storeHasSubscription()) || cancelled) return;
        setStoreSubscribed(true);
      } finally {
        if (!cancelled) setCheckingStore(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, gate, router, refresh]);

  const offer = plans?.find((p) => p.plan === selected) ?? null;

  /**
   * What annual saves against twelve months of monthly, as a percentage.
   *
   * Arithmetic on the store's own numbers rather than a written-in "58%",
   * for the reason nothing else here is hard-coded: Apple's price tiers do not
   * divide the same way in every currency, and a badge claiming a saving
   * somebody is not getting is worse than no badge.
   *
   * Null unless the saving is real and worth naming — if the two plans are
   * ever repriced closer together, the badge disappears rather than shrinking
   * to "Save 2%".
   */
  const annualSaving = (() => {
    const annual = plans?.find((p) => p.plan === 'annual');
    const monthly = plans?.find((p) => p.plan === 'monthly');
    if (!annual || !monthly || monthly.amount <= 0 || annual.amount <= 0) return null;
    const percent = Math.round((1 - annual.amount / (monthly.amount * 12)) * 100);
    return percent >= 5 ? percent : null;
  })();

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

  /**
   * The store says this Apple ID already has the subscription, and we have not
   * been able to turn that into access.
   *
   * Two different situations, and they need different sentences.
   *
   * NOT SIGNED IN. The overwhelmingly common one: a reinstall, or a new phone.
   * The subscription belongs to their account, not to the handset, so there is
   * literally nowhere to put it until they sign in — and no amount of retrying
   * will change that. Saying it plainly and offering the one door that works
   * beats an alert that only reports a failure.
   *
   * SIGNED IN. Rarer, and genuinely our problem: the receipt exists, we asked
   * RevenueCat, and we still could not record it. Never suggest buying again.
   */
  function offerSignInToRecover() {
    Alert.alert(t('paywall.foundTitle'), t('paywall.foundBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('paywall.foundCta'), onPress: () => router.replace('/sign-in?recover=1') },
    ]);
  }

  /** Shared tail of both recovery paths. Returns true if it got them in. */
  async function recoverExisting(alreadyPulled: boolean): Promise<boolean> {
    if (!user) {
      offerSignInToRecover();
      return false;
    }
    // `alreadyPulled` is set by callers that have just been through
    // awaitEntitlement, which ends in a pull of its own — asking RevenueCat
    // the same question twice in four seconds gets the same answer.
    const found = alreadyPulled ? null : await refreshEntitlement().catch(() => null);
    if (found) {
      router.replace('/');
      return true;
    }
    Alert.alert(t('paywall.foundTitle'), t('paywall.foundStuckBody'));
    return false;
  }

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
      // Already owned. Not a failure — they are further along than the screen
      // thinks — so this must never wear the word "failed".
      if (error instanceof AlreadySubscribedError) {
        await recoverExisting(false);
        return;
      }
      if (error instanceof ReceiptInUseError) {
        Alert.alert(t('paywall.receiptInUseTitle'), t('paywall.receiptInUseBody'));
        return;
      }
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
        // Returns immediately when there is no account, rather than spending
        // six seconds polling endpoints that can only answer 401.
        const found = await awaitEntitlement();
        if (found) {
          router.replace('/');
          return;
        }
        // It restored, and we still cannot use it. This used to go home
        // anyway, leaving someone holding a valid subscription on a camera
        // that would refuse the next photo without ever saying why.
        await recoverExisting(true);
        return;
      }
      Alert.alert(t('paywall.restoreNoneTitle'), t('paywall.restoreNoneBody'));
    } catch (error: any) {
      if (error instanceof ReceiptInUseError) {
        Alert.alert(t('paywall.receiptInUseTitle'), t('paywall.receiptInUseBody'));
        return;
      }
      Alert.alert(t('paywall.failedTitle'), error?.message ?? t('common.tryAgain'));
    } finally {
      setBusy(null);
    }
  }

  // Nothing is decided until the server has answered. A signed-in subscriber
  // seeing "Subscribe to Revely" for half a second before it corrects itself
  // is the same insult as seeing it permanently, delivered faster.
  if ((user && entitlementLoading) || checkingStore) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
        <View style={styles.waiting}>
          <ActivityIndicator color={surface.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (subscribed && sub) {
    return <SubscribedView sub={sub} onClose={goBackOrHome} />;
  }

  // The store knows about a subscription that our account does not. Showing
  // plans here is what let a subscriber buy a second one.
  if (storeSubscribed) {
    return (
      <RecoverView
        signedIn={!!user}
        onClose={goBackOrHome}
        onSignIn={() => router.replace('/sign-in?recover=1')}
        onRetry={() => void restore()}
        busy={busy === 'restore'}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={goBackOrHome} hitSlop={12} accessibilityRole="button">
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            ✕ {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.head}>
          {/* Four packets, four writing systems. This is the screen where the
              app asks to be paid for reading a label you cannot read, so the
              plate is the claim rather than an ornament beside it.

              Only on THIS head, not the two below it. The subscribed and
              unavailable screens share the style but not the argument — one is
              a receipt and the other is an apology, and neither is a place to
              be selling. */}
          <HalftonePlate name="packets" opacity={0.09} />
          <ApertureMark size={48} color={surface.ink} />
          <ThemedText style={[Type.title, { color: surface.ink }]}>
            {t('paywall.title')}
          </ThemedText>
          <ThemedText style={[Type.reason, { color: surface.inkMuted }]}>
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

        {/* The timeline that used to sit here — Today / Day 5 / Day 7, and a
            shorter monthly variant — is gone. It said out loud when money
            moves, which the plan rows and the fine print below already do, and
            it changed as you switched plans, so the screen appeared to rewrite
            itself under your thumb. The commitment it made is kept: the button
            never says "free trial" for a plan that bills today. */}

        {plans === null ? (
          <ActivityIndicator color={surface.ink} />
        ) : plans.length === 0 ? (
          // Honest dead end rather than a button that fails after the tap.
          <View style={[styles.unavailable, { borderColor: surface.rule }]}>
            <ThemedText style={[Type.body, { color: surface.inkMuted }]}>
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
                    { borderColor: active ? surface.ink : surface.rule },
                    active && { backgroundColor: surface.card },
                  ]}
                >
                  <View style={styles.planText}>
                    <View style={styles.planHeading}>
                      <ThemedText style={[Type.label, { color: surface.ink }]}>
                        {t(plan.plan === 'annual' ? 'paywall.annual' : 'paywall.monthly')}
                      </ThemedText>
                      {/* Inverted ink, never a verdict colour — the three inks
                          mean a verdict, and spending one on a badge that
                          wants your money is how a trusted signal stops being
                          one. Contrast does the highlighting instead.

                          It says what the arithmetic says. "Most popular" would
                          be an invented claim on the one screen where being
                          believed is the entire job, and on day one it would
                          describe nobody. */}
                      {plan.plan === 'annual' && annualSaving !== null ? (
                        <View style={[styles.badge, { backgroundColor: surface.ink }]}>
                          <ThemedText style={[styles.badgeText, { color: surface.paper }]}>
                            {t('paywall.saveBadge', { percent: annualSaving })}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText style={[Type.meta, { color: surface.inkMuted }]}>
                      {plan.plan === 'annual'
                        ? t('paywall.annualDetail', {
                            price: plan.price,
                            perMonth: plan.pricePerMonth,
                          })
                        : t('paywall.monthlyDetail', { price: plan.price })}
                    </ThemedText>
                    {/* Only the plan that HAS a trial says so. Annotating
                        monthly with its absence was answering a question
                        nobody asked, and it made the cheaper plan read as the
                        punished one. The fine print still states the terms. */}
                    {plan.trialDays > 0 ? (
                      <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
                        {t('paywall.planTrial', { days: plan.trialDays })}
                      </ThemedText>
                    ) : null}
                  </View>
                  {/* Selection is a mono mark, never a coloured tick. */}
                  <ThemedText style={[styles.tick, { color: surface.ink }]}>{active ? '✓' : ''}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          style={[
            styles.primary,
            { backgroundColor: surface.ink },
            (!offer || busy !== null) && styles.disabled,
          ]}
          disabled={!offer || busy !== null}
          onPress={() => void startTrial()}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.primaryLabel, { color: surface.paper }]}>
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
          {/* Louder when signed out, and phrased as a question.

              This is the only way an app can find a subscription bought on a
              phone it has since been deleted from: Apple gives no silent way
              to ask what an Apple ID owns, and restore is user-initiated by
              design. A grey afterthought under the button is not an ask, and
              somebody who does not see it buys a second plan instead. */}
          <ThemedText
            style={[
              Type.meta,
              { color: user ? surface.inkFaint : surface.ink },
            ]}
          >
            {busy === 'restore'
              ? t('paywall.working')
              : user
                ? t('paywall.restore')
                : t('paywall.restorePrompt')}
          </ThemedText>
        </Pressable>

        <ThemedText style={[Type.meta, styles.fine, { color: surface.inkFaint }]}>
          {hasTrial ? t('paywall.fine', { days: trialDays }) : t('paywall.fineNoTrial')}
        </ThemedText>

        {/*
          Required by Guideline 3.1.2: both documents must be reachable from
          the screen where money is asked for, not buried in Settings. They are
          links rather than a sheet so that a reviewer can confirm in one tap
          that the URLs actually resolve.
        */}
        <View style={styles.legal}>
          <LegalLink label={t('paywall.terms')} url={TERMS_URL} />
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>·</ThemedText>
          <LegalLink label={t('paywall.privacy')} url={PRIVACY_URL} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The store says there is a subscription; we cannot use it yet.
 *
 * A separate screen rather than an alert over the plans, because an alert
 * saying "you already have a subscription" on top of two Subscribe buttons is
 * a screen arguing with itself — and the buttons win, because they are bigger.
 *
 * NOT SIGNED IN is the ordinary case: a reinstall or a new phone. The
 * subscription lives on the account, so signing in is the whole fix, and the
 * copy says outright that nobody is charged twice — that is the fear, and
 * leaving it unanswered is what makes people buy a second plan to be safe.
 */
function RecoverView({
  signedIn,
  busy,
  onClose,
  onSignIn,
  onRetry,
}: {
  signedIn: boolean;
  busy: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onRetry: () => void;
}) {
  const surface = useSurface();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            ✕ {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.head}>
          <ApertureMark size={48} color={surface.ink} />
          <ThemedText style={[Type.title, { color: surface.ink }]}>
            {t('paywall.foundTitle')}
          </ThemedText>
          <ThemedText style={[Type.reason, { color: surface.inkMuted }]}>
            {signedIn ? t('paywall.foundStuckBody') : t('paywall.foundBody')}
          </ThemedText>
        </View>

        <Pressable
          style={[styles.primary, { backgroundColor: surface.ink }, busy && styles.disabled]}
          disabled={busy}
          onPress={signedIn ? onRetry : onSignIn}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.primaryLabel, { color: surface.paper }]}>
            {busy
              ? t('paywall.working')
              : signedIn
                ? t('paywall.foundRetry')
                : t('paywall.foundCta')}
          </ThemedText>
        </Pressable>

        <View style={styles.legal}>
          <LegalLink label={t('paywall.terms')} url={TERMS_URL} />
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>·</ThemedText>
          <LegalLink label={t('paywall.privacy')} url={PRIVACY_URL} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * What a subscriber sees instead of a paywall.
 *
 * Three things, in the order someone actually wants them: that they are
 * covered, when money next moves, and how to stop it. No plan rows and no
 * purchase button — there is nothing here left to buy, and a Subscribe button
 * a subscriber cannot use is worse than no button at all.
 *
 * SWITCHING PLANS IS NOT OFFERED HERE, ON PURPOSE
 *
 * Moving between monthly and annual is a StoreKit upgrade Apple performs in
 * its own sheet, with its own proration; an in-app control for it would be a
 * button that opens Settings wearing a costume. The link says where it goes.
 */
function SubscribedView({
  sub,
  onClose,
}: {
  sub: NonNullable<Entitlement['subscription']>;
  onClose: () => void;
}) {
  const surface = useSurface();
  const { t } = useTranslation();
  const trialing = sub.status === 'trialing';
  const grace = sub.status === 'grace';
  const date = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: surface.paper }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>
            ✕ {t('common.back')}
          </ThemedText>
        </Pressable>

        <View style={styles.head}>
          <ApertureMark size={48} color={surface.ink} />
          <ThemedText style={[Type.title, { color: surface.ink }]}>
            {grace
              ? t('paywall.graceTitle')
              : trialing
                ? t('paywall.trialTitle')
                : t('paywall.subscribedTitle')}
          </ThemedText>
          {/* The plan, then the date, as two lines rather than one sentence:
              the date is the fact people come here for, and it should not have
              to be read out of a paragraph. */}
          <ThemedText style={[Type.reason, { color: surface.inkMuted }]}>
            {t(sub.plan === 'annual' ? 'paywall.planAnnualNamed' : 'paywall.planMonthlyNamed')}
          </ThemedText>
          {date ? (
            <ThemedText style={[Type.reason, { color: surface.inkMuted }]}>
              {t(
                grace
                  ? 'paywall.graceDetail'
                  : trialing
                    ? 'paywall.trialChargeOn'
                    : 'paywall.renewsOn',
                { date },
              )}
            </ThemedText>
          ) : null}
        </View>

        {/* The same list the paywall sells, now read as a receipt. Worth
            keeping: most people never see this screen except when wondering
            whether the subscription is worth it. */}
        <View style={styles.includes}>
          <Include text={t('paywall.includeUnlimited')} />
          <Include text={t('paywall.includeProfiles')} />
          <Include text={t('paywall.includeCitations')} />
          <Include text={t('paywall.includeHistory')} />
        </View>

        {/* Outlined rather than filled. The filled button on this screen means
            "spend money"; nothing here should wear that weight. */}
        <Pressable
          style={[styles.secondary, { borderColor: surface.ink }]}
          onPress={() => void Linking.openURL(APPLE_SUBSCRIPTIONS_URL)}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.primaryLabel, { color: surface.ink }]}>
            {t('paywall.manageCta')}
          </ThemedText>
        </Pressable>

        <ThemedText style={[Type.meta, styles.fine, { color: surface.inkFaint }]}>
          {t('paywall.manageNote')}
        </ThemedText>

        <View style={styles.legal}>
          <LegalLink label={t('paywall.terms')} url={TERMS_URL} />
          <ThemedText style={[Type.meta, { color: surface.inkFaint }]}>·</ThemedText>
          <LegalLink label={t('paywall.privacy')} url={PRIVACY_URL} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A link out to a legal document.
 *
 * hitSlop because the label is deliberately small — it must not compete with
 * the price — and a 12px target is unusable without it. This is the same
 * mistake the photo-picker link made, and the fix is the same.
 */
function LegalLink({ label, url }: { label: string; url: string }) {
  const surface = useSurface();
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      hitSlop={12}
      accessibilityRole="link"
    >
      <ThemedText style={[Type.meta, styles.legalLabel, { color: surface.inkFaint }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Include({ text }: { text: string }) {
  const surface = useSurface();
  return (
    <View style={styles.include}>
      <View style={[styles.dot, { backgroundColor: surface.inkFaint }]} />
      <ThemedText style={[Type.body, styles.includeText, { color: surface.inkMuted }]}>
        {text}
      </ThemedText>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Gutter,
    paddingTop: Space.lg,
    paddingBottom: Space.xxl,
    gap: Space.xl,
  },
  // Clipped, and that is the point: the plate is allowed behind the headline
  // and nowhere near the prices. Anything sitting behind a number someone is
  // about to be charged is a legibility problem, not a texture.
  head: { gap: Space.md, overflow: 'hidden' },

  includes: { gap: Space.sm },
  include: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 9, marginHorizontal: 5 },
  includeText: { flex: 1 },


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
  planHeading: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  badge: { paddingHorizontal: Space.sm, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: {
    fontFamily: Font.monoMedium,
    fontSize: 10,
    letterSpacing: 0.08 * 10,
    textTransform: 'uppercase',
  },
  tick: { fontFamily: Font.monoMedium, fontSize: 14 },

  unavailable: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.flat,
    padding: Space.lg,
  },

  primary: { borderRadius: Radius.pill, paddingVertical: Space.lg, alignItems: 'center' },
  // Same shape as `primary`, outlined — the subscriber screen's one action is
  // a door out to Apple, not a purchase, and it should not look like one.
  secondary: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Space.lg,
    alignItems: 'center',
  },
  primaryLabel: { fontFamily: Font.sansSemi, fontSize: 15, lineHeight: 20 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  restore: { alignItems: 'center', paddingVertical: Space.sm },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Space.xs,
    marginTop: Space.sm,
  },
  legalLabel: { textDecorationLine: 'underline' },
  fine: { textAlign: 'center', lineHeight: 17 },
});
