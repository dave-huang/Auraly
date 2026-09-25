import { useCallback, useEffect, useState } from 'react';

import { apiFetch, getToken } from './api';
import { restorePurchases, storeSaysEntitled, storeWillRenew } from './purchases';
import { cancelTrialReminder } from './trialReminder';

/**
 * What this person is allowed to do, according to OUR server.
 *
 * Deliberately not RevenueCat. The store knows what was bought; only the API
 * knows what we have decided that buys, and routing the answer through one
 * place means the paywall, the viewfinder and the account screen cannot
 * disagree with each other — or with the endpoint that actually refuses scans.
 */

export interface Entitlement {
  /** null means unlimited. Render the word, never the number. */
  totalScansAvailable: number | null;
  freeScansRemaining: number;
  freeScanGrant: number;
  purchasedScanBalance: number;
  subscription: {
    status: 'none' | 'trialing' | 'active' | 'grace' | 'expired';
    plan: 'monthly' | 'annual' | null;
    expiresAt: string | null;
    active: boolean;
    trialUsed: boolean;
    /**
     * Whether Apple bills again at expiresAt. Filled in on the phone from the
     * store by withRenewal(), never sent by the server. Only `false` changes
     * anything: an unknown answer keeps the billing copy, because telling a
     * person on a real trial that nothing will be charged is the worse error.
     */
    willRenew?: boolean | null;
  };
}

export const ANONYMOUS_ENTITLEMENT: Entitlement = {
  totalScansAvailable: null,
  freeScansRemaining: 0,
  freeScanGrant: 0,
  purchasedScanBalance: 0,
  subscription: {
    status: 'none', plan: null, expiresAt: null, active: false, trialUsed: false,
  },
};

export function fetchEntitlement(): Promise<Entitlement> {
  return apiFetch<Entitlement>('/api/account/scan-balance');
}

/**
 * The server's answer, with the store's word on renewal added.
 *
 * Every screen that says "billing starts" or "renews" reads its entitlement
 * through this, because the server alone cannot tell a free year that ends
 * from a trial that turns into a charge.
 */
export async function withRenewal<T extends Entitlement>(entitlement: T): Promise<T> {
  if (!entitlement.subscription.active) return entitlement;
  const willRenew = await storeWillRenew();
  return { ...entitlement, subscription: { ...entitlement.subscription, willRenew } };
}

/** Days left in a trial, rounded up. Zero when there is no trial running. */
export function trialDaysRemaining(entitlement: Entitlement | null): number {
  const sub = entitlement?.subscription;
  if (!sub || sub.status !== 'trialing' || !sub.expiresAt) return 0;
  const ms = new Date(sub.expiresAt).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/**
 * Poll the API until it agrees a purchase happened.
 *
 * RevenueCat's webhook is fast but not synchronous with the purchase, so the
 * moment StoreKit returns there is a short window where the store says
 * "subscribed" and our server has not heard yet. Showing a paywall to someone
 * who has just paid is the worst timing in the app, so the success path waits
 * for the server rather than trusting the client — which is also the only
 * answer that cannot be faked.
 */
export async function awaitEntitlement(
  attempts = 6,
  delayMs = 1000,
): Promise<Entitlement | null> {
  // No account, nothing to wait for. Every request below would 401, so polling
  // spends six seconds under a "Working…" label to reach the answer we already
  // have — and the caller then has to guess whether the silence meant "not
  // paid" or "nowhere to put it". Say so immediately instead.
  if (!(await getToken())) return null;

  for (let i = 0; i < attempts; i++) {
    try {
      const entitlement = await fetchEntitlement();
      if (entitlement.subscription.active) return entitlement;
    } catch {
      // Keep trying — a flaky request here must not be read as "not paid".
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // The webhook never came. It usually lands in a second or two, so six
  // seconds of silence means it is probably not coming at all — a lost push,
  // an outage, a secret that stopped matching. Ask the server to go and find
  // out instead of leaving someone who has just paid on the paywall.
  try {
    return await refreshEntitlement();
  } catch {
    return null;
  }
}

/**
 * What a restore turned out to mean.
 *
 *   granted    the subscription is attached to the account and the app is open
 *   noAccount  the Apple ID owns it and there is nowhere to put it yet
 *   stuck      the Apple ID owns it and our server would not record it
 *   nothing    this Apple ID owns nothing
 */
export type RestoreOutcome = 'granted' | 'noAccount' | 'stuck' | 'nothing';

/**
 * Restore, and turn that into access. The whole sequence, in one place.
 *
 * IT LIVES HERE BECAUSE IT HAS TO HAPPEN TWICE, AND USED TO HAPPEN ONCE.
 *
 * Restoring from a fresh install with no account got as far as "you already
 * have a subscription, sign in" and then stopped. Signing in tells RevenueCat
 * who this is, which is not the same as handing it the receipt: the receipt
 * was synced under the anonymous id the restore ran on, and identifying does
 * not resync it. So the server, asked outright, still saw nothing, and the
 * person was returned to the paywall with no sign that anything was left to
 * do — where tapping Restore a SECOND time, now signed in, worked. The tap
 * they could not have known to make is this function, called again after
 * sign-in.
 *
 * `signedIn` is passed rather than looked up because this is a plain function
 * and the answer lives in a React context. It only decides which of two true
 * sentences to tell: there is nowhere to put this yet, or we could not record
 * it. Never a third about buying again — the money has already moved.
 */
export async function restoreAndGrant(signedIn: boolean): Promise<RestoreOutcome> {
  const info = await restorePurchases();
  if (!storeSaysEntitled(info)) return 'nothing';
  if (!signedIn) return 'noAccount';
  return (await awaitEntitlement()) ? 'granted' : 'stuck';
}

/**
 * Make the server ask RevenueCat directly, rather than wait to be told.
 *
 * Still not the client deciding anything: this triggers a question the server
 * puts to RevenueCat, and the server writes the answer. It exists because a
 * push that is lost is lost, and the person holding the receipt should not
 * have to wait for a renewal weeks away to get what they paid for.
 */
export async function refreshEntitlement(): Promise<Entitlement | null> {
  // Same reason as above: there is no account for the server to write to.
  if (!(await getToken())) return null;

  await apiFetch<{ subscription: Entitlement['subscription'] }>(
    '/api/account/refresh-entitlement',
    { method: 'POST' },
  );
  // Re-read the full record rather than trusting the narrower reply: scan
  // balances and the free grant come from the same place, and a caller holding
  // half an Entitlement is how the two drift.
  const entitlement = await fetchEntitlement();
  return entitlement.subscription.active ? entitlement : null;
}

/**
 * Entitlement for the current session, refetched on demand.
 *
 * `refresh` deliberately does no synchronous state work before its first
 * await — a setState in the body of an effect cascades renders, and the lint
 * rule that catches it is right. Initial `loading` comes from `enabled`
 * instead, so nothing has to be set on the way in.
 */
export function useEntitlement(enabled = true) {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await withRenewal(await fetchEntitlement());
      setEntitlement(next);
      // Reconcile the Day 5 reminder against what the server says. This is the
      // one place that sees every entitlement change, whichever way it
      // happened — converted, cancelled, expired, or restored on a new phone.
      // A subscriber who gets "your trial ends in 2 days" a month into paying
      // has been told something false by an app whose whole pitch is that it
      // does not do that.
      // A trial that will not bill has nothing to remind anyone about.
      if (next.subscription.status !== 'trialing' || next.subscription.willRenew === false) {
        void cancelTrialReminder();
      }
    } catch {
      // Left null. Every caller treats null as "unknown", never as "blocked" —
      // a network blip must not put a paywall in front of a subscriber.
      setEntitlement(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    // The rule cannot see past the await inside `refresh`, so it reads this as
    // a synchronous setState in an effect. It is not: nothing is set before
    // `fetchEntitlement` resolves, which is a later tick, so there is no
    // cascading render to prevent. Initial `loading` comes from `enabled`
    // precisely so the body has no state to set on the way in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { entitlement, loading: enabled && loading, refresh };
}
