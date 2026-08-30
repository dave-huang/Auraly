import {
  PLAN_BY_PRODUCT,
  PRODUCT_IDS,
  FREE_SCAN_GRANT,
  freeScansRemaining,
  hasActiveSubscription,
  getTotalScansAvailable,
  canUserScan,
  deviceScansRemaining,
  type User,
  type AnonymousDevice,
  type SubscriptionStatus,
} from '../shared/schema';
import { resolveState, resolveFromSubscriber } from '../server/services/revenueCatState';

/**
 * Entitlement — the deterministic half.
 *
 * This file guards money in both directions, and the two failures are not
 * symmetric. Letting someone scan free forever costs a per-scan OpenAI bill.
 * Locking out someone who has paid costs the person, a refund, and a review
 * that stays up for a year. The second is the one to be paranoid about, which
 * is why most of what follows checks that a subscriber keeps working.
 *
 * Everything here is pure. No database, no network, no RevenueCat.
 */

const errors: string[] = [];
function check(label: string, ok: boolean, detail: string) {
  if (!ok) errors.push(`${label}: ${detail}`);
}

const HOUR = 3600_000;
function user(over: Partial<User> = {}): User {
  return {
    id: 'u1',
    subscriptionStatus: 'none' as SubscriptionStatus,
    subscriptionPlan: null,
    subscriptionExpiresAt: null,
    trialUsed: false,
    freeScansUsed: 0,
    purchasedScanBalance: 0,
    ...over,
  } as User;
}

console.log('[ENTITLEMENT] subscription state');

// ---------------------------------------------------------------------------
// 1. Entitlement is status AND expiry. Never status alone.
//
// The failure this prevents: a webhook we never receive leaves a row saying
// `active` forever. Reading status without the date makes that permanent free
// access, and it is silent — nothing looks wrong until the bill arrives.
// ---------------------------------------------------------------------------
for (const status of ['trialing', 'active', 'grace'] as const) {
  check(`entitles/${status}`,
    hasActiveSubscription(user({ subscriptionStatus: status, subscriptionExpiresAt: new Date(Date.now() + HOUR) })),
    `${status} with a future expiry should entitle`);
  check(`expired/${status}`,
    !hasActiveSubscription(user({ subscriptionStatus: status, subscriptionExpiresAt: new Date(Date.now() - HOUR) })),
    `${status} with a PAST expiry must not entitle — the period it paid for is over`);
  check(`nodate/${status}`,
    !hasActiveSubscription(user({ subscriptionStatus: status, subscriptionExpiresAt: null })),
    `${status} with no expiry date must not entitle — a missing date is a missing webhook, not a licence`);
}
for (const status of ['none', 'expired'] as const) {
  check(`denies/${status}`,
    !hasActiveSubscription(user({ subscriptionStatus: status, subscriptionExpiresAt: new Date(Date.now() + HOUR) })),
    `${status} must not entitle even with a future date`);
}

// ---------------------------------------------------------------------------
// 2. A subscriber has no count, and is never blocked.
// ---------------------------------------------------------------------------
{
  const subscriber = user({
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + HOUR),
    freeScansUsed: FREE_SCAN_GRANT,
  });
  check('subscriber/unlimited', getTotalScansAvailable(subscriber) === null,
    'a subscriber must report null (unlimited), never a number a screen could render as a countdown');
  check('subscriber/can-scan', canUserScan(subscriber),
    'a subscriber with the free grant spent was blocked — this is the failure that produces a refund and a one-star review');

  const trialing = user({
    subscriptionStatus: 'trialing',
    subscriptionExpiresAt: new Date(Date.now() + HOUR),
    freeScansUsed: FREE_SCAN_GRANT,
  });
  check('trial/can-scan', canUserScan(trialing), 'someone inside their 7-day trial was blocked');

  const billingIssue = user({
    subscriptionStatus: 'grace',
    subscriptionExpiresAt: new Date(Date.now() + HOUR),
    freeScansUsed: FREE_SCAN_GRANT,
  });
  check('grace/can-scan', canUserScan(billingIssue),
    'a subscriber whose card needs updating was locked out of a health app over a clerical problem');
}

// ---------------------------------------------------------------------------
// 2b. The product identifiers themselves.
//
// Apple will not rename a product id or let you reuse a deleted one, so a typo
// in App Store Connect is permanent there and silent here: the app skips a
// product it cannot name and renders a paywall with no plans, raising nothing.
// These cannot check what Apple actually holds, but they catch the shapes a
// slip produces.
// ---------------------------------------------------------------------------
{
  const ids = Object.values(PRODUCT_IDS);
  const PREFIX = 'revely.';

  check('products/distinct', new Set(ids).size === ids.length,
    `the two plans must have different product ids, got ${ids.join(', ')}`);

  // A single mistyped identifier — revenly.annual for revely.annual — leaves
  // the other one correct, so the prefix is what breaks rather than both ids.
  const wrong = ids.filter(id => !id.startsWith(PREFIX));
  check('products/prefix', wrong.length === 0,
    `every product id should start with "${PREFIX}"; check the spelling of: ${wrong.join(', ')}`);

  for (const [plan, id] of Object.entries(PRODUCT_IDS)) {
    check(`products/maps-back/${plan}`, PLAN_BY_PRODUCT[id] === plan,
      `${id} should resolve to the ${plan} plan, got ${PLAN_BY_PRODUCT[id]}`);
  }
}

// ---------------------------------------------------------------------------
// 3. The free grant, and the hard paywall behind it.
// ---------------------------------------------------------------------------
{
  check('free/fresh', freeScansRemaining(user()) === FREE_SCAN_GRANT,
    `a new account should have ${FREE_SCAN_GRANT}`);
  check('free/spent', freeScansRemaining(user({ freeScansUsed: FREE_SCAN_GRANT })) === 0,
    'a spent grant should be 0');
  check('free/overspent', freeScansRemaining(user({ freeScansUsed: FREE_SCAN_GRANT + 5 })) === 0,
    'an overspent grant must clamp at 0, never go negative and hand out scans');
  check('free/exhausted-blocks', !canUserScan(user({ freeScansUsed: FREE_SCAN_GRANT })),
    'the paywall is hard past the grant — an unsubscribed account at zero must be blocked');

  // The assertions above are written against the constant, so they hold at any
  // grant. This one is about the value we actually ship: the wall is at the
  // front door. A brand-new account, having used nothing, can scan nothing.
  // If someone raises FREE_SCAN_GRANT without meaning to, this fails and says so.
  check('free/hard-walled-at-zero', FREE_SCAN_GRANT === 0 && !canUserScan(user()),
    `Revely is subscription-only: a new account must be blocked before it scans. ` +
    `FREE_SCAN_GRANT is ${FREE_SCAN_GRANT}, and a fresh user ` +
    `${canUserScan(user()) ? 'can' : 'cannot'} scan`);

  // Same claim for someone who has never signed in. The device path is a
  // separate counter and could drift from the account one.
  check('free/hard-walled-anonymously', deviceScansRemaining(undefined) === 0,
    'an unknown device must get nothing — the trial is the only way in');
}

// ---------------------------------------------------------------------------
// 4. Grandfathered scan packs.
//
// These were sold under a paywall whose own words were "One-time purchase. No
// subscription, no auto-renewal." Launching subscriptions does not get to
// quietly void that.
// ---------------------------------------------------------------------------
{
  const packHolder = user({ freeScansUsed: FREE_SCAN_GRANT, purchasedScanBalance: 7 });
  check('packs/honoured', canUserScan(packHolder),
    'someone holding a purchased pack was blocked by the new paywall — they paid for those scans');
  check('packs/counted', getTotalScansAvailable(packHolder) === 7,
    `expected 7 available, got ${getTotalScansAvailable(packHolder)}`);
}

// ---------------------------------------------------------------------------
// 4b. The pull path.
//
// resolveFromSubscriber answers the same question as resolveState from a
// different shape, and the two MUST agree — if asking RevenueCat and being told
// by RevenueCat can disagree about the same subscription, one is a bug and the
// person finds out by losing access they paid for.
// ---------------------------------------------------------------------------
{
  const ENT = 'subscriber';
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  const sub = (over: any = {}) => ({
    entitlements: { [ENT]: { expires_date: future, product_identifier: PRODUCT_IDS.annual } },
    subscriptions: { [PRODUCT_IDS.annual]: { expires_date: future, period_type: 'normal' } },
    ...over,
  });

  check('pull/active', resolveFromSubscriber(sub(), ENT).status === 'active',
    'a live non-trial subscription should read active');

  check('pull/trialing',
    resolveFromSubscriber(sub({
      subscriptions: { [PRODUCT_IDS.annual]: { expires_date: future, period_type: 'trial' } },
    }), ENT).status === 'trialing',
    'period_type trial should read trialing — lower case here, upper case in webhooks');

  check('pull/intro-is-trial',
    resolveFromSubscriber(sub({
      subscriptions: { [PRODUCT_IDS.annual]: { expires_date: future, period_type: 'intro' } },
    }), ENT).status === 'trialing',
    'intro counts as a trial, same as the webhook path');

  check('pull/grace',
    resolveFromSubscriber(sub({
      subscriptions: {
        [PRODUCT_IDS.annual]: {
          expires_date: future, period_type: 'normal',
          billing_issues_detected_at: '2026-08-30T00:00:00Z',
        },
      },
    }), ENT).status === 'grace',
    'a billing problem keeps access, exactly as BILLING_ISSUE does');

  check('pull/expired',
    resolveFromSubscriber({
      entitlements: { [ENT]: { expires_date: past, product_identifier: PRODUCT_IDS.annual } },
    }, ENT).status === 'expired',
    'a past expiry is expired however healthy the rest looks');

  check('pull/none', resolveFromSubscriber({ entitlements: {} }, ENT).status === 'none',
    'never subscribed is none, not expired');

  check('pull/unknown-subscriber', resolveFromSubscriber(undefined, ENT).status === 'none',
    'a customer RevenueCat has never heard of is not entitled');

  // The entitlement name is the thing most likely to be mistyped in a
  // dashboard, and getting it wrong takes money without granting access.
  check('pull/wrong-entitlement-name',
    resolveFromSubscriber(sub(), 'plus').status === 'none',
    'an entitlement under another name must not grant access');

  check('pull/plan-mapped',
    resolveFromSubscriber(sub(), ENT).plan === 'annual',
    'the product id should map to its plan, as it does in the webhook path');

  // A malformed date must not read as "entitled forever".
  check('pull/garbage-date',
    resolveFromSubscriber({
      entitlements: { [ENT]: { expires_date: 'not-a-date', product_identifier: PRODUCT_IDS.annual } },
    }, ENT).status === 'expired',
    'an unparseable expiry must fail closed');

  // The two paths, same subscription, same answer.
  const pushed = resolveState({
    type: 'RENEWAL', period_type: 'TRIAL', product_id: PRODUCT_IDS.annual,
    expiration_at_ms: Date.parse(future),
  });
  const pulled = resolveFromSubscriber(sub({
    subscriptions: { [PRODUCT_IDS.annual]: { expires_date: future, period_type: 'trial' } },
  }), ENT);
  check('pull/agrees-with-push',
    pushed.status === pulled.status && pushed.plan === pulled.plan,
    `push said ${pushed.status}/${pushed.plan}, pull said ${pulled.status}/${pulled.plan}`);
}

// ---------------------------------------------------------------------------
// 5. Anonymous devices.
// ---------------------------------------------------------------------------
{
  const device = (over: Partial<AnonymousDevice> = {}): AnonymousDevice =>
    ({ id: 'd1', freeScansUsed: 0, claimedByUserId: null, ...over }) as AnonymousDevice;

  check('device/unknown', deviceScansRemaining(undefined) === FREE_SCAN_GRANT,
    'a device we have never seen should get the full grant');
  check('device/spent', deviceScansRemaining(device({ freeScansUsed: FREE_SCAN_GRANT })) === 0,
    'a spent device should be 0');
  check('device/claimed', deviceScansRemaining(device({ claimedByUserId: 'u1' })) === 0,
    'a CLAIMED device must get nothing — otherwise signing out is a way to mint a fresh grant on demand');
}

// ---------------------------------------------------------------------------
// 6. RevenueCat event → state.
//
// The mapping that decides whether a paying person keeps access. Two cases are
// easy to get backwards and expensive both times:
//   CANCELLATION is not expiry. Auto-renew is off; the period already paid for
//     still runs. Treating it as expiry locks someone out of time they bought.
//   BILLING_ISSUE is not expiry either. Apple retries for days.
// ---------------------------------------------------------------------------
console.log('[ENTITLEMENT] RevenueCat event mapping');
{
  const future = Date.now() + 30 * 24 * HOUR;
  const past = Date.now() - HOUR;

  const cases: [string, Parameters<typeof resolveState>[0], SubscriptionStatus][] = [
    ['initial trial', { type: 'INITIAL_PURCHASE', period_type: 'TRIAL', product_id: PRODUCT_IDS.annual, expiration_at_ms: future }, 'trialing'],
    ['trial converts', { type: 'RENEWAL', period_type: 'NORMAL', product_id: PRODUCT_IDS.annual, expiration_at_ms: future }, 'active'],
    ['cancellation', { type: 'CANCELLATION', period_type: 'NORMAL', product_id: PRODUCT_IDS.monthly, expiration_at_ms: future }, 'active'],
    ['billing issue', { type: 'BILLING_ISSUE', period_type: 'NORMAL', product_id: PRODUCT_IDS.monthly, expiration_at_ms: future }, 'grace'],
    ['expiration', { type: 'EXPIRATION', period_type: 'NORMAL', product_id: PRODUCT_IDS.monthly, expiration_at_ms: past }, 'expired'],
    ['stale date', { type: 'RENEWAL', period_type: 'NORMAL', product_id: PRODUCT_IDS.monthly, expiration_at_ms: past }, 'expired'],
    ['no date at all', { type: 'RENEWAL', period_type: 'NORMAL', product_id: PRODUCT_IDS.monthly }, 'expired'],
    ['unknown event type', { type: 'SOMETHING_NEW', period_type: 'NORMAL', product_id: PRODUCT_IDS.annual, expiration_at_ms: future }, 'active'],
  ];

  for (const [label, event, expected] of cases) {
    const state = resolveState(event);
    check(`rc/${label}`, state.status === expected, `expected ${expected}, got ${state.status}`);
  }

  check('rc/plan-monthly',
    resolveState({ product_id: PRODUCT_IDS.monthly, period_type: 'NORMAL', expiration_at_ms: future }).plan === 'monthly',
    'the monthly product id did not map to the monthly plan — check it against App Store Connect');
  check('rc/plan-annual',
    resolveState({ product_id: PRODUCT_IDS.annual, period_type: 'NORMAL', expiration_at_ms: future }).plan === 'annual',
    'the annual product id did not map to the annual plan — check it against App Store Connect');
  // The trial is on the annual plan only. A monthly purchase arrives with
  // period_type NORMAL and must resolve to `active` — never `trialing`, which
  // would make the app tell someone who was charged today that they are inside
  // a free trial, and suppress nothing but their willingness to trust it.
  check('rc/monthly-has-no-trial',
    resolveState({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL', product_id: PRODUCT_IDS.monthly, expiration_at_ms: future }).status === 'active',
    'a first monthly purchase resolved as trialing — monthly is billed immediately');
  check('rc/annual-trial-still-works',
    resolveState({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL', product_id: PRODUCT_IDS.annual, expiration_at_ms: future }).status === 'trialing',
    'the annual trial stopped resolving as a trial');

  check('rc/unknown-product',
    resolveState({ product_id: 'revely.weekly.not.configured', period_type: 'NORMAL', expiration_at_ms: future }).plan === null,
    'an unrecognised product id should resolve to a null plan, not guess one');
}

if (errors.length > 0) {
  console.log(`\n[ENTITLEMENT] ${errors.length} failure(s):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n[ENTITLEMENT] all entitlement checks passed');
