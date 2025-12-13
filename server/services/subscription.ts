import { db } from '../db';
import { users, scanUsageLogs, analyticsEvents, hasPremiumAccess, isTrialActive, getTrialDaysRemaining, type User } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const FREE_SCANS_PER_MONTH = 5;
const PREMIUM_HOURLY_RATE_LIMIT = 20;

export interface ScanQuotaStatus {
  canScan: boolean;
  reason?: 'no_scans' | 'rate_limited' | 'not_authenticated' | 'trial_expired';
  isPremium: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  freeScansUsed: number;
  freeScansLimit: number;
  nextResetDate?: Date;
  hourlyScansRemaining?: number;
  subscriptionStatus: string;
}

export class SubscriptionService {
  async getUserQuotaStatus(userId: string): Promise<ScanQuotaStatus> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        canScan: false,
        reason: 'not_authenticated',
        isPremium: false,
        isTrialActive: false,
        trialDaysRemaining: 0,
        freeScansUsed: 0,
        freeScansLimit: FREE_SCANS_PER_MONTH,
        subscriptionStatus: 'free',
      };
    }

    // Check and handle expired trial
    await this.maybeExpireTrial(user);
    await this.maybeResetMonthlyScans(user);
    await this.maybeResetHourlyRate(user);

    const [refreshedUser] = await db.select().from(users).where(eq(users.id, userId));
    const isPremium = hasPremiumAccess(refreshedUser);
    const trialActive = isTrialActive(refreshedUser);
    const trialDaysRemaining = getTrialDaysRemaining(refreshedUser);

    if (isPremium) {
      const hourlyScansRemaining = PREMIUM_HOURLY_RATE_LIMIT - (refreshedUser.hourlyScansCount || 0);
      return {
        canScan: hourlyScansRemaining > 0,
        reason: hourlyScansRemaining <= 0 ? 'rate_limited' : undefined,
        isPremium: true,
        isTrialActive: trialActive,
        trialDaysRemaining,
        freeScansUsed: 0,
        freeScansLimit: 0,
        hourlyScansRemaining,
        subscriptionStatus: refreshedUser.subscriptionStatus || 'free',
      };
    }

    // Free user (trial expired or never had one)
    const freeScansUsed = refreshedUser.monthlyFreeScansUsed || 0;
    const hasFreeScansRemaining = freeScansUsed < FREE_SCANS_PER_MONTH;

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);

    return {
      canScan: hasFreeScansRemaining,
      reason: !hasFreeScansRemaining ? 'no_scans' : undefined,
      isPremium: false,
      isTrialActive: false,
      trialDaysRemaining: 0,
      freeScansUsed,
      freeScansLimit: FREE_SCANS_PER_MONTH,
      nextResetDate: nextMonth,
      subscriptionStatus: refreshedUser.subscriptionStatus || 'free',
    };
  }

  private async maybeExpireTrial(user: User): Promise<void> {
    if (user.subscriptionStatus !== 'trial') return;
    if (!user.trialEndsAt) return;
    
    const now = new Date();
    const trialEndsAt = new Date(user.trialEndsAt);
    
    if (now >= trialEndsAt) {
      await db.update(users)
        .set({
          subscriptionStatus: 'free',
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      
      await db.insert(analyticsEvents).values({
        userId: user.id,
        eventType: 'trial_expired',
        eventData: { trialEndedAt: trialEndsAt.toISOString() },
      });
    }
  }

  private async maybeResetMonthlyScans(user: User): Promise<void> {
    const lastReset = user.lastFreeResetAt || new Date(0);
    const now = new Date();
    
    const lastResetMonth = lastReset.getMonth() + lastReset.getFullYear() * 12;
    const currentMonth = now.getMonth() + now.getFullYear() * 12;
    
    if (currentMonth > lastResetMonth) {
      await db.update(users)
        .set({
          monthlyFreeScansUsed: 0,
          lastFreeResetAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
    }
  }

  private async maybeResetHourlyRate(user: User): Promise<void> {
    const lastReset = user.hourlyScansResetAt || new Date(0);
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    if (lastReset < hourAgo) {
      await db.update(users)
        .set({
          hourlyScansCount: 0,
          hourlyScansResetAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
    }
  }

  async consumeScan(userId: string, productType?: string): Promise<{ success: boolean; source: 'free' | 'premium' }> {
    const quotaStatus = await this.getUserQuotaStatus(userId);
    
    if (!quotaStatus.canScan) {
      await db.insert(scanUsageLogs).values({
        userId,
        action: 'scan_blocked',
        productType,
        metadata: { reason: quotaStatus.reason },
      });
      throw new Error(quotaStatus.reason || 'Cannot scan');
    }

    let source: 'free' | 'premium' = 'free';

    if (quotaStatus.isPremium) {
      await db.update(users)
        .set({
          hourlyScansCount: sql`${users.hourlyScansCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      source = 'premium';
    } else {
      await db.update(users)
        .set({
          monthlyFreeScansUsed: sql`${users.monthlyFreeScansUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      source = 'free';
    }

    await db.insert(scanUsageLogs).values({
      userId,
      action: 'scan_success',
      scanSource: source,
      productType,
      metadata: {},
    });

    return { success: true, source };
  }

  async logPaywallView(userId: string | null, source: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId,
      eventType: 'paywall_view',
      eventData: { source },
    });
  }

  async logUpgradeClick(userId: string | null, option: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId,
      eventType: 'upgrade_click',
      eventData: { option },
    });
  }

  async logGatedContentTap(userId: string, contentType: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId,
      eventType: 'gated_content_tap',
      eventData: { contentType },
    });
  }

  async logTrialStarted(userId: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId,
      eventType: 'trial_started',
      eventData: {},
    });
  }
}

export const subscriptionService = new SubscriptionService();
