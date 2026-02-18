import { users, scanHistory, type User, type UpsertUser, type ScanHistory, type InsertScanHistory, type RiskPreferences, type AllergenPreferences, defaultRiskPreferences, defaultAllergenPreferences } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getUserPreferences(userId: string): Promise<RiskPreferences>;
  updateUserPreferences(userId: string, preferences: Partial<RiskPreferences>): Promise<User | undefined>;
  completeOnboarding(userId: string, preferences: RiskPreferences): Promise<User | undefined>;
  isOnboardingCompleted(userId: string): Promise<boolean>;
  
  getUserAllergenPreferences(userId: string): Promise<AllergenPreferences>;
  updateUserAllergenPreferences(userId: string, preferences: Partial<AllergenPreferences>): Promise<User | undefined>;
  completeAllergenOnboarding(userId: string, allergenPreferences: AllergenPreferences): Promise<User | undefined>;
  
  createScanHistory(scan: InsertScanHistory): Promise<ScanHistory>;
  getScanHistory(userId: string, limit?: number, offset?: number): Promise<ScanHistory[]>;
  getScanHistoryCount(userId: string): Promise<number>;
  getScanById(scanId: string, userId: string): Promise<ScanHistory | undefined>;
  updateScanName(scanId: string, userId: string, productName: string): Promise<ScanHistory | undefined>;
  deleteScan(scanId: string, userId: string): Promise<boolean>;
  deleteAllScans(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    }
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async getUserPreferences(userId: string): Promise<RiskPreferences> {
    const user = await this.getUser(userId);
    return (user?.riskPreferences as RiskPreferences) || defaultRiskPreferences;
  }

  async updateUserPreferences(userId: string, preferences: Partial<RiskPreferences>): Promise<User | undefined> {
    const currentUser = await this.getUser(userId);
    if (!currentUser) return undefined;
    
    const currentPrefs = (currentUser.riskPreferences as RiskPreferences) || defaultRiskPreferences;
    const updatedPrefs = { ...currentPrefs, ...preferences };
    
    const [user] = await db
      .update(users)
      .set({ 
        riskPreferences: updatedPrefs,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async completeOnboarding(userId: string, preferences: RiskPreferences): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        riskPreferences: preferences,
        onboardingCompleted: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async isOnboardingCompleted(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user?.onboardingCompleted ?? false;
  }

  async getUserAllergenPreferences(userId: string): Promise<AllergenPreferences> {
    const user = await this.getUser(userId);
    return (user?.allergenPreferences as AllergenPreferences) || defaultAllergenPreferences;
  }

  async updateUserAllergenPreferences(userId: string, preferences: Partial<AllergenPreferences>): Promise<User | undefined> {
    const currentUser = await this.getUser(userId);
    if (!currentUser) return undefined;
    
    const currentPrefs = (currentUser.allergenPreferences as AllergenPreferences) || defaultAllergenPreferences;
    const updatedPrefs = { ...currentPrefs, ...preferences };
    
    const [user] = await db
      .update(users)
      .set({ 
        allergenPreferences: updatedPrefs,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async completeAllergenOnboarding(userId: string, allergenPreferences: AllergenPreferences): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        allergenPreferences: allergenPreferences,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createScanHistory(scanData: InsertScanHistory): Promise<ScanHistory> {
    const [scan] = await db
      .insert(scanHistory)
      .values(scanData)
      .returning();
    return scan;
  }

  async getScanHistory(userId: string, limit: number = 20, offset: number = 0): Promise<ScanHistory[]> {
    const scans = await db
      .select()
      .from(scanHistory)
      .where(eq(scanHistory.userId, userId))
      .orderBy(desc(scanHistory.createdAt))
      .limit(limit)
      .offset(offset);
    return scans;
  }

  async getScanHistoryCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scanHistory)
      .where(eq(scanHistory.userId, userId));
    return result[0]?.count ?? 0;
  }

  async getScanById(scanId: string, userId: string): Promise<ScanHistory | undefined> {
    const [scan] = await db
      .select()
      .from(scanHistory)
      .where(and(eq(scanHistory.id, scanId), eq(scanHistory.userId, userId)));
    return scan;
  }

  async updateScanName(scanId: string, userId: string, productName: string): Promise<ScanHistory | undefined> {
    const [scan] = await db
      .update(scanHistory)
      .set({ productName })
      .where(and(eq(scanHistory.id, scanId), eq(scanHistory.userId, userId)))
      .returning();
    return scan;
  }

  async deleteScan(scanId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(scanHistory)
      .where(and(eq(scanHistory.id, scanId), eq(scanHistory.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deleteAllScans(userId: string): Promise<number> {
    const result = await db
      .delete(scanHistory)
      .where(eq(scanHistory.userId, userId))
      .returning();
    return result.length;
  }
}

export const storage = new DatabaseStorage();
