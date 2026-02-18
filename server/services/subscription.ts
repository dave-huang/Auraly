import { db } from '../db';
import { users, scanUsageLogs, analyticsEvents, getDailyFreeScansLimit, needsDailyReset, getDailyFreeScansRemaining, type User } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const DAILY_FREE_SCANS = getDailyFreeScansLimit();

export interface ScanQuotaStatus {
  canScan: boolean;
  reason?: 'no_scans' | 'not_authenticated';
  dailyFreeScansUsed: number;
  dailyFreeScansLimit: number;
  dailyFreeScansRemaining: number;
  purchasedScanBalance: number;
  totalScansAvailable: number;
  nextDailyReset: string;
}

export class SubscriptionService {
  async getUserQuotaStatus(userId: string): Promise<ScanQuotaStatus> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        canScan: false,
        reason: 'not_authenticated',
        dailyFreeScansUsed: 0,
        dailyFreeScansLimit: DAILY_FREE_SCANS,
        dailyFreeScansRemaining: DAILY_FREE_SCANS,
        purchasedScanBalance: 0,
        totalScansAvailable: 0,
        nextDailyReset: this.getNextDailyReset(),
      };
    }

    await this.maybeResetDailyScans(user);
    const [refreshedUser] = await db.select().from(users).where(eq(users.id, userId));

    const dailyFreeRemaining = getDailyFreeScansRemaining(refreshedUser);
    const purchasedBalance = refreshedUser.purchasedScanBalance || 0;
    const totalAvailable = dailyFreeRemaining + purchasedBalance;

    return {
      canScan: totalAvailable > 0,
      reason: totalAvailable <= 0 ? 'no_scans' : undefined,
      dailyFreeScansUsed: refreshedUser.dailyFreeScansUsed || 0,
      dailyFreeScansLimit: DAILY_FREE_SCANS,
      dailyFreeScansRemaining: dailyFreeRemaining,
      purchasedScanBalance: purchasedBalance,
      totalScansAvailable: totalAvailable,
      nextDailyReset: this.getNextDailyReset(),
    };
  }

  private getNextDailyReset(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  private async maybeResetDailyScans(user: User): Promise<void> {
    if (needsDailyReset(user)) {
      await db.update(users)
        .set({
          dailyFreeScansUsed: 0,
          lastDailyReset: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
  }

  async consumeScan(userId: string, productType?: string): Promise<{ success: boolean; source: 'free' | 'purchased' }> {
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

    let source: 'free' | 'purchased' = 'free';

    if (quotaStatus.dailyFreeScansRemaining > 0) {
      await db.update(users)
        .set({
          dailyFreeScansUsed: sql`${users.dailyFreeScansUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      source = 'free';
    } else {
      await db.update(users)
        .set({
          purchasedScanBalance: sql`${users.purchasedScanBalance} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      source = 'purchased';
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

  async logPurchasePromptView(userId: string | null, source: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId,
      eventType: 'purchase_prompt_view',
      eventData: { source },
    });
  }

  async logPurchaseClick(userId: string | null, option: string): Promise<void> {
    await db.insert(analyticsEvents).values({
      userId,
      eventType: 'purchase_click',
      eventData: { option },
    });
  }
}

export const subscriptionService = new SubscriptionService();
