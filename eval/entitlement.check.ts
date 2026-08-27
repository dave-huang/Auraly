import {
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
import { resolveState } from '../server/services/revenueCatState';

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
    ['initial trial', { type: 'INITIAL_PURCHASE', period_type: 'TRIAL', product_id: 'revely.plus.annual', expiration_at_ms: future }, 'trialing'],
    ['trial converts', { type: 'RENEWAL', period_type: 'NORMAL', product_id: 'revely.plus.annual', expiration_at_ms: future }, 'active'],
    ['cancellation', { type: 'CANCELLATION', period_type: 'NORMAL', product_id: 'revely.plus.monthly', expiration_at_ms: future }, 'active'],
    ['billing issue', { type: 'BILLING_ISSUE', period_type: 'NORMAL', product_id: 'revely.plus.monthly', expiration_at_ms: future }, 'grace'],
    ['expiration', { type: 'EXPIRATION', period_type: 'NORMAL', product_id: 'revely.plus.monthly', expiration_at_ms: past }, 'expired'],
    ['stale date', { type: 'RENEWAL', period_type: 'NORMAL', product_id: 'revely.plus.monthly', expiration_at_ms: past }, 'expired'],
    ['no date at all', { type: 'RENEWAL', period_type: 'NORMAL', product_id: 'revely.plus.monthly' }, 'expired'],
    ['unknown event type', { type: 'SOMETHING_NEW', period_type: 'NORMAL', product_id: 'revely.plus.annual', expiration_at_ms: future }, 'active'],
  ];

  for (const [label, event, expected] of cases) {
    const state = resolveState(event);
    check(`rc/${label}`, state.status === expected, `expected ${expected}, got ${state.status}`);
  }

  check('rc/plan-monthly',
    resolveState({ product_id: 'revely.plus.monthly', period_type: 'NORMAL', expiration_at_ms: future }).plan === 'monthly',
    'the monthly product id did not map to the monthly plan — check it against App Store Connect');
  check('rc/plan-annual',
    resolveState({ product_id: 'revely.plus.annual', period_type: 'NORMAL', expiration_at_ms: future }).plan === 'annual',
    'the annual product id did not map to the annual plan — check it against App Store Connect');
  check('rc/unknown-product',
    resolveState({ product_id: 'revely.plus.weekly', period_type: 'NORMAL', expiration_at_ms: future }).plan === null,
    'an unrecognised product id should resolve to a null plan, not guess one');
}

if (errors.length > 0) {
  console.log(`\n[ENTITLEMENT] ${errors.length} failure(s):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n[ENTITLEMENT] all entitlement checks passed');
