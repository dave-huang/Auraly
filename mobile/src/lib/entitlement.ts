import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from './api';
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
  for (let i = 0; i < attempts; i++) {
    try {
      const entitlement = await fetchEntitlement();
      if (entitlement.subscription.active) return entitlement;
    } catch {
      // Keep trying — a flaky request here must not be read as "not paid".
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
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
      const next = await fetchEntitlement();
      setEntitlement(next);
      // Reconcile the Day 5 reminder against what the server says. This is the
      // one place that sees every entitlement change, whichever way it
      // happened — converted, cancelled, expired, or restored on a new phone.
      // A subscriber who gets "your trial ends in 2 days" a month into paying
      // has been told something false by an app whose whole pitch is that it
      // does not do that.
      if (next.subscription.status !== 'trialing') void cancelTrialReminder();
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
