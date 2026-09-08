import { users, scanHistory, profiles, type User, type UpsertUser, type ScanHistory, type InsertScanHistory, type RiskPreferences, type AllergenPreferences, type Profile, type UpsertProfileInput, type RiskLevel, defaultRiskPreferences, defaultAllergenPreferences } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, count } from "drizzle-orm";
// Why a profile deletion did or didn't happen. A bare boolean would collapse
// "you don't own that profile" and "that's your last one" into the same 404,
// and the second needs a different sentence in front of the user.
export type DeleteProfileResult = "deleted" | "not_found" | "last_profile";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;

  getProfiles(userId: string): Promise<Profile[]>;
  getProfile(profileId: string, userId: string): Promise<Profile | undefined>;
  createProfile(userId: string, input: UpsertProfileInput): Promise<Profile>;
  updateProfile(profileId: string, userId: string, input: Partial<UpsertProfileInput>): Promise<Profile | undefined>;
  deleteProfile(profileId: string, userId: string): Promise<DeleteProfileResult>;

  getUserPreferences(userId: string): Promise<RiskPreferences>;
  updateUserPreferences(userId: string, preferences: Partial<RiskPreferences>): Promise<User | undefined>;
  completeOnboarding(userId: string, preferences: RiskPreferences): Promise<User | undefined>;
  isOnboardingCompleted(userId: string): Promise<boolean>;
  
  getUserAllergenPreferences(userId: string): Promise<AllergenPreferences>;
  updateUserAllergenPreferences(userId: string, preferences: Partial<AllergenPreferences>): Promise<User | undefined>;
  completeAllergenOnboarding(userId: string, allergenPreferences: AllergenPreferences): Promise<User | undefined>;
  
  createScanHistory(scan: InsertScanHistory): Promise<ScanHistory>;
  getScanHistory(userId: string, limit?: number, offset?: number, risk?: RiskLevel): Promise<ScanHistory[]>;
  getScanHistoryCount(userId: string, risk?: RiskLevel): Promise<number>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getProfiles(userId: string): Promise<Profile[]> {
    return db.select().from(profiles).where(eq(profiles.userId, userId)).orderBy(desc(profiles.isDefault), profiles.createdAt);
  }

  async getProfile(profileId: string, userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));
    return profile;
  }

  async createProfile(userId: string, input: UpsertProfileInput): Promise<Profile> {
    if (input.isDefault) {
      await db.update(profiles).set({ isDefault: false }).where(eq(profiles.userId, userId));
    }
    const [profile] = await db.insert(profiles).values({
      userId,
      name: input.name,
      isDefault: input.isDefault ?? false,
      allergens: input.allergens,
      dietaryRules: input.dietaryRules,
      conditions: input.conditions,
    }).returning();
    return profile;
  }

  async updateProfile(profileId: string, userId: string, input: Partial<UpsertProfileInput>): Promise<Profile | undefined> {
    if (input.isDefault) {
      await db.update(profiles).set({ isDefault: false }).where(eq(profiles.userId, userId));
    }
    const [profile] = await db.update(profiles)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .returning();
    return profile;
  }

  // Deleting a profile is the one destructive thing a user can do to their own
  // safety settings, so two invariants are enforced here rather than trusted to
  // the client:
  //
  //  - A user always keeps at least one profile. Zero profiles means every
  //    later scan has nobody to check against, and the app would have to send
  //    them back through onboarding to recover.
  //  - Exactly one profile stays default. Deleting the default one silently
  //    would leave `getProfiles` with no isDefault row to sort to the top, so
  //    the successor is promoted in the same breath.
  async deleteProfile(profileId: string, userId: string): Promise<DeleteProfileResult> {
    const owned = await db.select({ id: profiles.id, isDefault: profiles.isDefault })
      .from(profiles).where(eq(profiles.userId, userId));

    const target = owned.find(p => p.id === profileId);
    if (!target) return "not_found";
    if (owned.length <= 1) return "last_profile";

    await db.delete(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));

    if (target.isDefault) {
      const successor = owned.find(p => p.id !== profileId);
      if (successor) {
        await db.update(profiles).set({ isDefault: true, updatedAt: new Date() })
          .where(eq(profiles.id, successor.id));
      }
    }
    return "deleted";
  }

  // Permanent account deletion (App Store guideline 5.1.1(v)).
  //
  // Every table that references users.id is ON DELETE CASCADE, except
  // analytics_events which is SET NULL — so the row goes and the usage,
  // purchase, scan history and profile rows go with it, while the anonymised
  // event stream survives without pointing at a person.
  //
  // Nothing is soft-deleted: someone asking to be forgotten is not asking to
  // be flagged as inactive.
  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return result.length > 0;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      const updates: Record<string, any> = {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        updatedAt: new Date(),
      };
      const [user] = await db
        .update(users)
        .set(updates)
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

  // The optional risk filter is applied in SQL, not in the client: the history
  // screen's filter pills page through results, and filtering only the page
  // already loaded would show "3 avoid scans" to someone who has thirty.
  async getScanHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    risk?: RiskLevel,
  ): Promise<ScanHistory[]> {
    const scans = await db
      .select()
      .from(scanHistory)
      .where(
        risk
          ? and(eq(scanHistory.userId, userId), eq(scanHistory.overallRisk, risk))
          : eq(scanHistory.userId, userId),
      )
      .orderBy(desc(scanHistory.createdAt))
      .limit(limit)
      .offset(offset);
    return scans;
  }

  async getScanHistoryCount(userId: string, risk?: RiskLevel): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scanHistory)
      .where(
        risk
          ? and(eq(scanHistory.userId, userId), eq(scanHistory.overallRisk, risk))
          : eq(scanHistory.userId, userId),
      );
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
