import { users, scanHistory, type User, type UpsertUser, type ScanHistory, type InsertScanHistory } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Scan history operations
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
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Scan history operations
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
