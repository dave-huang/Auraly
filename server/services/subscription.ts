import { db } from '../db';
import {
  users,
  anonymousDevices,
  scanUsageLogs,
  analyticsEvents,
  FREE_SCAN_GRANT,
  freeScansRemaining,
  hasActiveSubscription,
  getTotalScansAvailable,
  deviceScansRemaining,
  type User,
  type SubscriptionStatus,
  type SubscriptionPlan,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Entitlement — who may scan, and how many times.
 *
 * This replaced a daily-refill counter when the app moved to a subscription
 * with a 7-day trial. The two models cannot coexist: a daily refill IS a free
 * tier, and it gives a person who is willing to wait until tomorrow no reason
 * ever to subscribe.
 *
 * THE CLIENT IS NEVER THE AUTHORITY. Every field here is either computed from
 * the database or written by the RevenueCat webhook. A request that arrives
 * claiming to be subscribed is a request from a device that has been tampered
 * with, and nothing in this file reads such a claim.
 *
 * Scans are spent in a fixed order — free grant, then purchased packs. Packs
 * are grandfathered: they were sold under a paywall that promised in writing
 * that they never expire, and a subscription launch does not get to quietly
 * void that. A subscriber with a leftover pack keeps it.
 */

export interface ScanQuotaStatus {
  canScan: boolean;
  reason?: 'no_scans' | 'not_authenticated';
  /** null means unlimited — an active subscription has no count. */
  totalScansAvailable: number | null;
  freeScansRemaining: number;
  freeScanGrant: number;
  purchasedScanBalance: number;
  subscription: {
    status: SubscriptionStatus;
    plan: SubscriptionPlan | null;
    /** ISO, or null when there is nothing to expire. */
    expiresAt: string | null;
    active: boolean;
    /** Whether this account has ever consumed its one trial. */
    trialUsed: boolean;
  };
}

function quotaFor(user: User): ScanQuotaStatus {
  const total = getTotalScansAvailable(user);
  return {
    canScan: total === null || total > 0,
    reason: total !== null && total <= 0 ? 'no_scans' : undefined,
    totalScansAvailable: total,
    freeScansRemaining: freeScansRemaining(user),
    freeScanGrant: FREE_SCAN_GRANT,
    purchasedScanBalance: user.purchasedScanBalance || 0,
    subscription: {
      status: user.subscriptionStatus,
      plan: user.subscriptionPlan ?? null,
      expiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      active: hasActiveSubscription(user),
      trialUsed: user.trialUsed,
    },
  };
}

const NO_USER: ScanQuotaStatus = {
  canScan: false,
  reason: 'not_authenticated',
  totalScansAvailable: 0,
  freeScansRemaining: 0,
  freeScanGrant: FREE_SCAN_GRANT,
  purchasedScanBalance: 0,
  subscription: {
    status: 'none', plan: null, expiresAt: null, active: false, trialUsed: false,
  },
};

export class SubscriptionService {
  async getUserQuotaStatus(userId: string): Promise<ScanQuotaStatus> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user ? quotaFor(user) : NO_USER;
  }

  /**
   * Spend one scan.
   *
   * The decrement is conditional in SQL rather than read-then-write. Two scans
   * fired from the same device at once would otherwise both read "1 remaining"
   * and both succeed, and the free grant is small enough that the race is worth
   * one extra WHERE clause.
   */
  async consumeScan(
    userId: string,
    productType?: string,
  ): Promise<{ success: boolean; source: 'free' | 'purchased' | 'subscription' }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('not_authenticated');

    // A subscriber spends nothing. There is no counter to move, which is the
    // point of the subscription.
    if (hasActiveSubscription(user)) {
      await this.log(userId, 'scan_success', 'subscription', productType);
      return { success: true, source: 'subscription' };
    }

    if (freeScansRemaining(user) > 0) {
      const updated = await db
        .update(users)
        .set({ freeScansUsed: sql`${users.freeScansUsed} + 1`, updatedAt: new Date() })
        .where(sql`${users.id} = ${userId} AND ${users.freeScansUsed} < ${FREE_SCAN_GRANT}`)
        .returning({ id: users.id });
      if (updated.length > 0) {
        await this.log(userId, 'scan_success', 'free', productType);
        return { success: true, source: 'free' };
      }
    }

    if ((user.purchasedScanBalance || 0) > 0) {
      const updated = await db
        .update(users)
        .set({
          purchasedScanBalance: sql`${users.purchasedScanBalance} - 1`,
          updatedAt: new Date(),
        })
        .where(sql`${users.id} = ${userId} AND ${users.purchasedScanBalance} > 0`)
        .returning({ id: users.id });
      if (updated.length > 0) {
        await this.log(userId, 'scan_success', 'purchased', productType);
        return { success: true, source: 'purchased' };
      }
    }

    await db.insert(scanUsageLogs).values({
      userId,
      action: 'scan_blocked',
      productType,
      metadata: { reason: 'no_scans' },
    });
    throw new Error('no_scans');
  }

  // ---- anonymous devices ----

  /**
   * What an unsigned-in device has left.
   *
   * A device row is created lazily on first scan, not on app open: an install
   * that never scans should leave nothing behind on the server.
   */
  async getDeviceQuota(deviceId: string): Promise<{ remaining: number; claimed: boolean }> {
    const [device] = await db
      .select().from(anonymousDevices).where(eq(anonymousDevices.id, deviceId));
    return {
      remaining: deviceScansRemaining(device),
      claimed: Boolean(device?.claimedByUserId),
    };
  }

  async consumeDeviceScan(deviceId: string, productType?: string): Promise<boolean> {
    // Upsert-then-conditionally-increment, so a first scan and a concurrent
    // second one cannot both be the "first".
    await db
      .insert(anonymousDevices)
      .values({ id: deviceId, freeScansUsed: 0 })
      .onConflictDoNothing();

    const updated = await db
      .update(anonymousDevices)
      .set({ freeScansUsed: sql`${anonymousDevices.freeScansUsed} + 1`, updatedAt: new Date() })
      .where(
        sql`${anonymousDevices.id} = ${deviceId}
            AND ${anonymousDevices.claimedByUserId} IS NULL
            AND ${anonymousDevices.freeScansUsed} < ${FREE_SCAN_GRANT}`,
      )
      .returning({ id: anonymousDevices.id });

    if (updated.length === 0) return false;
    await db.insert(scanUsageLogs).values({
      deviceId,
      action: 'scan_success',
      scanSource: 'free',
      productType,
      metadata: { anonymous: true },
    });
    return true;
  }

  /**
   * Move a device's spent scans onto the account that just signed in.
   *
   * Without this, signing in hands out a second free grant to everyone — spend
   * three anonymously, sign in, get three more. The scans follow the person,
   * which is the honest reading of "three free scans".
   *
   * Idempotent: a device already claimed by this user is a no-op, and one
   * claimed by somebody else is left alone rather than reassigned.
   */
  async claimDevice(deviceId: string, userId: string): Promise<void> {
    const [device] = await db
      .select().from(anonymousDevices).where(eq(anonymousDevices.id, deviceId));
    if (!device || device.claimedByUserId) return;

    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(anonymousDevices)
        .set({ claimedByUserId: userId, updatedAt: new Date() })
        .where(sql`${anonymousDevices.id} = ${deviceId}
                   AND ${anonymousDevices.claimedByUserId} IS NULL`)
        .returning({ used: anonymousDevices.freeScansUsed });
      if (claimed.length === 0) return;

      // Capped at the grant: a user who somehow arrives with two devices should
      // lose the grant once, not twice over.
      await tx
        .update(users)
        .set({
          freeScansUsed: sql`LEAST(${FREE_SCAN_GRANT}, ${users.freeScansUsed} + ${claimed[0].used})`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    });
  }

  // ---- subscription state, written only by the RevenueCat webhook ----

  async applySubscriptionState(
    userId: string,
    state: {
      status: SubscriptionStatus;
      plan: SubscriptionPlan | null;
      expiresAt: Date | null;
      revenueCatCustomerId?: string;
    },
  ): Promise<void> {
    await db
      .update(users)
      .set({
        subscriptionStatus: state.status,
        subscriptionPlan: state.plan,
        subscriptionExpiresAt: state.expiresAt,
        // Latches on. Once a trial has been consumed it can never be offered
        // again, so this is only ever set, never cleared.
        trialUsed: state.status === 'trialing' ? true : undefined,
        ...(state.revenueCatCustomerId
          ? { revenueCatCustomerId: state.revenueCatCustomerId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  private async log(
    userId: string,
    action: string,
    source: string,
    productType?: string,
  ): Promise<void> {
    await db.insert(scanUsageLogs).values({
      userId, action, scanSource: source, productType, metadata: {},
    });
  }

  async logPurchasePromptView(userId: string | null, source: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId, eventType: 'purchase_prompt_view', eventData: { source },
    });
  }

  async logPurchaseClick(userId: string | null, option: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId, eventType: 'purchase_click', eventData: { option },
    });
  }
}

export const subscriptionService = new SubscriptionService();
