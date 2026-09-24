import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import z from "zod";
import crypto from "crypto";
import { eq, sql, gte, and, count, desc, inArray } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./localAuth";
import { setupRevenueCatWebhook } from "./revenueCatWebhook";
import { registerLegalRoutes } from "./legal";
import { registerHomeRoutes } from "./home";
import { isLang } from "./siteCopy";
import { translateStatement } from "./services/substances/translations";
import { fetchSubscriber, RevenueCatNotConfigured } from "./services/revenueCatApi";
import { resolveFromSubscriber } from "./services/revenueCatState";
import { ENTITLEMENT_ID } from "@shared/products";
import {
  allowAnonymousScan,
  requireScanQuota,
  consumeForPrincipal,
  type ScanPrincipal,
} from "./anonymousAccess";
import { rateLimit } from "./rateLimit";
import { storage } from "./storage";
import { db } from "./db";
import { readLabelFromImage } from "./services/labelReader";
import { analyzeIngredients, analyzeIngredientsParallel, extractIngredientsFromText } from "./services/analyzer";
import { getCacheStats, clearAllCache, getAllCacheEntries } from "./services/cache";
import { subscriptionService } from "./services/subscription";
import { 
  analysisRequestSchema,
  riskPreferencesSchema,
  allergenPreferencesSchema,
  users,
  scanHistory,
  scanUsageLogs,
  sessions,
  purchaseLogs,
  type ProductType,
  type AnalysisResult,
  type InsertScanHistory,
  type Ingredient,
  type Profile,
  type RiskLevel,
  productTypes,
  productCategories,
  freeScansRemaining,
  getTotalScansAvailable,
  canUserScan,
  FREE_SCAN_GRANT,
  hasActiveSubscription,
  upsertProfileSchema,
  crashReports,
  crashReportInputSchema,
  labelContextSchema,
  type LabelContext,
  androidWaitlist,
  androidWaitlistInputSchema,
} from "@shared/schema";
import { applyProfileToAnalysis, annotateWithCitations, maxRisk } from "./services/personalRisk";
import { withLabelRanks } from "./services/labelRank";
import { demoAnalysis } from "./demoScan";
import { applyPopulationRisk, domainForProductType } from "./services/substances/classify";
import { getSubstanceRegistry } from "./services/substances/identity";
import { getEvidenceStore } from "./services/substances/evidence";
import { applyPolicy, POLICY_VERSION } from "./services/substances/policy";
import { ALLERGEN_KEYWORDS, type MajorAllergen } from "./services/allergenMatcher";

// In-memory store for analysis requests (for background processing)
interface AnalysisRequest {
  id: string;
  // Who started this scan. Checked on every status poll: without it, any
  // signed-in caller holding a request id could read someone else's label
  // text and analysis. The id is 64 bits of randomness so guessing one is not
  // practical, but "hard to guess" is not an access control.
  //
  // A scan can now be started before sign-in, so this is "user:<id>" or
  // "device:<id>" rather than a bare user id. Comparing the whole string keeps
  // the two namespaces from ever colliding.
  ownerKey: string;
  /** Present only for a signed-in scan. */
  userId?: string;
  status: 'processing' | 'ocr_complete' | 'completed' | 'failed';
  result?: AnalysisResult;
  error?: string;
  // A stable code for the failures a client should word itself. `error` stays
  // an English sentence for logs; a localized app cannot show it to anyone.
  errorCode?: string;
  ocrText?: string;
  // Published as soon as the label is read, before analysis finishes, so the
  // client can show real progress during the ~20-30s wait instead of a bare
  // spinner.
  ingredientCount?: number;
  /**
   * The label's ingredients, in the order printed, as soon as the reader has
   * them. Available roughly 15 seconds before any verdict is.
   *
   * The names alone are worth showing: they are what the person pointed the
   * camera at, and seeing their own label come back is the moment the app
   * stops looking like it might have failed. Verdicts land on top of these
   * rows afterwards.
   *
   * English canonical names, alongside the label's own words where the two
   * differ, because a bilingual pair is what the card shows and the pair is
   * the app's claim to have read rather than guessed.
   */
  ingredients?: string[];
  /**
   * Names whose analysis has returned, in the order they finished. Not the
   * label's order: batches run in parallel, and ones the cache already knows
   * finish first. The scan screen marks exactly these rows as checked.
   */
  checked?: string[];
  ingredientsOriginal?: string[];
  /** The bracket structure, so the pending rows can say "inside X" too. */
  composition?: { name: string; parts: string[] }[];
  productName?: string;
  timestamp: number;
}

const analysisRequests = new Map<string, AnalysisRequest>();

/**
 * Validate a profile sent inline with a scan.
 *
 * Same schema the stored profiles are written through, so an onboarding scan
 * cannot express anything a saved profile could not. Returns undefined on
 * anything malformed rather than throwing: a bad profile must degrade to a
 * generic verdict, never fail the scan.
 */
function parseInlineProfile(raw: unknown): any | undefined {
  const parsed = upsertProfileSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return {
    id: 'inline',
    userId: 'inline',
    name: parsed.data.name,
    isDefault: true,
    allergens: parsed.data.allergens,
    dietaryRules: parsed.data.dietaryRules,
    conditions: parsed.data.conditions,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Namespaced owner key for an in-flight scan. See AnalysisRequest.ownerKey. */
function principalKey(principal: ScanPrincipal | undefined): string {
  if (!principal) return '';
  return principal.kind === 'user' ? `user:${principal.userId}` : `device:${principal.deviceId}`;
}

// Global OCR cache - keyed by image content hash (language-independent)
interface OCRCacheEntry {
  text: string;
  timestamp: number;
  // Structured extraction from the multimodal label reader; absent for
  // entries produced by the legacy text-OCR path.
  ingredients?: string[];
  productName?: string;
  sourceLanguage?: string;
  declaredAllergens?: { contains: string[]; mayContain: string[] };
  originalIngredients?: string[];
  // The printed list, before sub-ingredients were flattened into `ingredients`.
  composition?: { name: string; parts: string[] }[];
  readConfidence?: 'high' | 'medium' | 'low';
  lineCount?: { read: number; total: number };
}
const ocrCache = new Map<string, OCRCacheEntry>();

// Global extracted ingredients cache - keyed by OCR text hash (language-independent)
// This ensures ingredients are extracted ONCE and reused for all languages
interface ExtractedIngredientsEntry {
  ingredients: string[];
  timestamp: number;
}
const extractedIngredientsCache = new Map<string, ExtractedIngredientsEntry>();

// Helper to compute hash of image data
function hashImageData(imageData: string): string {
  return crypto.createHash('sha256').update(imageData).digest('hex');
}

// Clean up old OCR cache entries (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [hash, entry] of Array.from(ocrCache.entries())) {
    if (entry.timestamp < oneHourAgo) {
      ocrCache.delete(hash);
    }
  }
}, 5 * 60 * 1000);

// Clean up old requests (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, req] of Array.from(analysisRequests.entries())) {
    if (req.timestamp < oneHourAgo) {
      analysisRequests.delete(id);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Configure multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Privacy policy and terms of use. Registered first because they are two of
  // the URLs an App Store submission is rejected for missing, and because the
  // paywall links to them (Guideline 3.1.2). See server/legal.ts.
  registerLegalRoutes(app);

  // The marketing page at "/", and the images and fonts it loads from /media.
  // Same ordering rule as the legal pages: everything here has to be claimed
  // before serveStatic()'s catch-all. See server/home.ts.
  registerHomeRoutes(app);

  // Liveness. This is what the platform health check hits, and it answers 200
  // whenever the process can serve HTTP at all.
  //
  // It deliberately does NOT fail when Postgres is unreachable. An earlier
  // version did, which meant a database problem presented as "deployment timed
  // out waiting for health checks" — indistinguishable from a container that
  // never booted — and, worse, blocked deploying the fix. It does not touch
  // Postgres at all now, for the reason below; /api/readyz is where database
  // state is reported and where monitoring should point. Registered before
  // auth so it answers even if the session store is unhappy.
  app.get('/api/healthz', (_req, res) => {
    // This used to `select 1` here, purely to report database state in the
    // body. Fly polls this route every 30 seconds, which is 86,400 queries a
    // month arriving too regularly for Neon's compute to ever idle out: the
    // branch stayed awake 16 hours a day with no users at all, and burned the
    // plan's compute hours until the database was cut off mid App Review.
    //
    // A liveness probe that wakes the thing it is watching is not free, and
    // this one was not even using the answer — the response is 200 either way.
    // The check belongs on /api/readyz, which is called deliberately rather
    // than on a timer.

    // The corpus ships inside the image, read from disk at boot. Reporting its
    // version here is the only way to confirm a deploy actually carried the
    // data it was supposed to: a server running a stale or absent corpus starts
    // cleanly, answers every request, and quietly rates ingredients off the
    // model alone. It has already happened once — the deployed API served the
    // 17-substance corpus for two days after the real one was built.
    const registry = getSubstanceRegistry();
    const evidence = getEvidenceStore();

    res.json({
      status: 'ok',
      // Not reported here on purpose: see the note above, and /api/readyz.
      database: 'see /api/readyz',
      uptimeSeconds: Math.round(process.uptime()),
      corpus: {
        registryVersion: registry.version,
        substances: registry.size,
        aliases: registry.aliasCount,
        evidenceVersion: evidence.version || 'empty',
        records: evidence.recordCount,
      },
      policyVersion: POLICY_VERSION,
    });
  });

  // Readiness. Strict: 503 unless the process can actually do useful work.
  // Point monitoring at this one, not at healthz.
  app.get('/api/readyz', async (_req, res) => {
    const started = Date.now();
    try {
      await db.execute(sql`select 1`);
      res.json({ status: 'ready', database: 'up', checkedInMs: Date.now() - started });
    } catch (error: any) {
      res.status(503).json({
        status: 'not_ready',
        database: 'down',
        reason: error?.message ?? String(error),
        checkedInMs: Date.now() - started,
      });
    }
  });

  // Setup authentication
  await setupAuth(app);

  // Subscription state, pushed by RevenueCat. Registered after auth so the
  // bearer middleware has run, though the route itself deliberately does not
  // use it — RevenueCat authenticates with a shared secret, not a user token.
  setupRevenueCatWebhook(app);

  // Auth endpoint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ==========================================
  // RISK PREFERENCES ENDPOINTS
  // ==========================================

  // GET /api/user/preferences - Get current user's risk preferences
  app.get('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserPreferences(userId);
      const onboardingCompleted = await storage.isOnboardingCompleted(userId);
      res.json({ preferences, onboardingCompleted });
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // PATCH /api/user/preferences - Update user's risk preferences
  app.patch('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = riskPreferencesSchema.partial().parse(req.body);
      const user = await storage.updateUserPreferences(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, preferences: user.riskPreferences });
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      res.status(400).json({ message: error.message || "Failed to update preferences" });
    }
  });

  // POST /api/user/onboarding - Complete onboarding with preferences
  app.post('/api/user/onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = riskPreferencesSchema.parse(req.body);
      const user = await storage.completeOnboarding(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, onboardingCompleted: true });
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(400).json({ message: error.message || "Failed to complete onboarding" });
    }
  });

  // POST /api/user/reset-onboarding - Reset onboarding (for testing/re-doing)
  app.post('/api/user/reset-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db
        .update(users)
        .set({ onboardingCompleted: false, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, onboardingCompleted: false });
    } catch (error) {
      console.error("Error resetting onboarding:", error);
      res.status(500).json({ message: "Failed to reset onboarding" });
    }
  });

  // ==========================================
  // ALLERGEN PREFERENCES ENDPOINTS
  // ==========================================

  // GET /api/user/allergen-preferences - Get current user's allergen preferences
  app.get('/api/user/allergen-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserAllergenPreferences(userId);
      res.json({ preferences });
    } catch (error) {
      console.error("Error fetching allergen preferences:", error);
      res.status(500).json({ message: "Failed to fetch allergen preferences" });
    }
  });

  // PATCH /api/user/allergen-preferences - Update user's allergen preferences
  app.patch('/api/user/allergen-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = allergenPreferencesSchema.partial().parse(req.body);
      const user = await storage.updateUserAllergenPreferences(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true, preferences: user.allergenPreferences });
    } catch (error: any) {
      console.error("Error updating allergen preferences:", error);
      res.status(400).json({ message: error.message || "Failed to update allergen preferences" });
    }
  });

  // POST /api/user/allergen-onboarding - Complete allergen onboarding with preferences
  app.post('/api/user/allergen-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = allergenPreferencesSchema.parse(req.body);
      const user = await storage.completeAllergenOnboarding(userId, preferences);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error completing allergen onboarding:", error);
      res.status(400).json({ message: error.message || "Failed to complete allergen onboarding" });
    }
  });

  // ==========================================
  // PERSONAL PROFILE ENDPOINTS (multi-profile per user)
  // ==========================================

  app.get('/api/profiles', isAuthenticated, async (req: any, res) => {
    try {
      const userProfiles = await storage.getProfiles(req.user.claims.sub);
      res.json(userProfiles);
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
      res.status(500).json({ message: "Failed to fetch profiles" });
    }
  });

  app.post('/api/profiles', isAuthenticated, async (req: any, res) => {
    try {
      const input = upsertProfileSchema.parse(req.body);
      const profile = await storage.createProfile(req.user.claims.sub, input);
      res.status(201).json(profile);
    } catch (error: any) {
      console.error("Error creating profile:", error);
      res.status(400).json({ message: error.message || "Failed to create profile" });
    }
  });

  app.patch('/api/profiles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const input = upsertProfileSchema.partial().parse(req.body);
      const profile = await storage.updateProfile(req.params.id, req.user.claims.sub, input);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      res.status(400).json({ message: error.message || "Failed to update profile" });
    }
  });

  app.delete('/api/profiles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.deleteProfile(req.params.id, req.user.claims.sub);
      if (result === "not_found") {
        return res.status(404).json({ message: "Profile not found" });
      }
      if (result === "last_profile") {
        // 409, not 400: the request is well formed, it just conflicts with the
        // rule that a user always has someone to check scans against.
        return res.status(409).json({ code: "last_profile", message: "Cannot delete your only profile" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting profile:", error);
      res.status(500).json({ message: "Failed to delete profile" });
    }
  });

  // GET /api/allergens/:allergen/aliases - the names this allergen hides under
  //
  // The ingredient drill-down answers "why did this flag?", and half that
  // answer is the alias list the matcher actually used. Served from
  // ALLERGEN_KEYWORDS rather than copied into the app: a stale duplicate in
  // the client would explain a match using words that no longer match.
  // GET /api/substances/:substanceId/evidence?domain=food
  //
  // The records behind a population-level risk level. The verdict card says
  // "regulated"; this is where the drill-down finds out by whom, where, and on
  // what basis.
  //
  // Fetched on demand rather than embedded in every analysis result, following
  // the allergen-aliases route above: a scan payload stays small, stored history
  // does not carry a frozen copy, and the answer always reflects the corpus as
  // it stands today rather than as it stood when the photo was taken.
  //
  // Source statements are returned verbatim, always. Since 2026-09-24 a
  // translation into ?lang= travels beside each one (`statementTranslated`),
  // never in place of it, and the app shows it marked as a translation with the
  // original a tap away. Most statements are sentences our ingest wrote from a
  // register's fields, not quotations, and a reader of Chinese or Spanish was
  // otherwise not reading the evidence at all. See substances/translations.ts.
  //
  // ?lang= is the language of the SCAN, which the app passes, not the app's
  // current setting: a scan reopened from history reads in the language it was
  // taken in.
  app.get('/api/substances/:substanceId/evidence', isAuthenticated, async (req: any, res) => {
    try {
      const substanceId = String(req.params.substanceId);
      const domain = req.query.domain === 'cosmetic' ? 'cosmetic' : 'food';
      const lang = typeof req.query.lang === 'string' && isLang(req.query.lang) ? req.query.lang : 'en';

      const substance = getSubstanceRegistry().getById(substanceId);
      if (!substance) {
        return res.status(404).json({ message: "Unknown substance" });
      }

      // Unioned across every id for this chemical, matching what decided the
      // verdict. If the drill-down listed only the records filed under the id
      // the name resolved to, the sources shown could not account for the
      // level shown.
      const records = getEvidenceStore().forSubstancesInDomain(
        getSubstanceRegistry().sameSubstanceIds(substanceId),
        domain,
      );
      const decision = applyPolicy(records, { domain });

      // Permitted in one market, prohibited in another. This is the whole point
      // of the feature, so it is computed here rather than left for the client
      // to infer from the record list.
      const permittedIn = Array.from(
        new Set(records.filter(r => r.kind === 'permitted').map(r => r.jurisdiction)),
      );
      const prohibitedIn = Array.from(
        new Set(records.filter(r => r.kind === 'prohibited').map(r => r.jurisdiction)),
      );

      res.json({
        substanceId,
        name: substance.name,
        cas: substance.cas ?? null,
        eNumber: substance.eNumber ?? null,
        level: decision.level,
        policyVersion: decision.policyVersion,
        divergence:
          permittedIn.length > 0 && prohibitedIn.length > 0
            ? { permittedIn, prohibitedIn }
            : null,
        records: records.map(r => ({
          statement: r.statement,
          statementTranslated: translateStatement(r.statement, lang),
          kind: r.kind,
          jurisdiction: r.jurisdiction,
          org: r.citation.org,
          title: r.citation.title,
          url: r.citation.url ?? null,
          determinedOn: r.determinedOn ?? null,
        })),
      });
    } catch (error: any) {
      console.error("Error fetching substance evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  app.get('/api/allergens/:allergen/aliases', isAuthenticated, async (req: any, res) => {
    const allergen = String(req.params.allergen).toLowerCase() as MajorAllergen;
    const aliases = ALLERGEN_KEYWORDS[allergen];
    if (!aliases) {
      return res.status(404).json({ message: "Unknown allergen" });
    }
    res.json({ allergen, aliases });
  });

  // POST /api/analysis/personalize - re-run the verdict for a different profile
  //
  // Switching the active profile must re-answer the question without a
  // re-scan: the label read is already done and costs a vision call, while
  // the personal verdict is pure deterministic matching. The client posts the
  // analysis it is holding and gets it back scored for another person.
  //
  // The matcher stays on the server so production and the eval harness keep
  // sharing one implementation — a second copy in the app is how the two
  // would silently drift apart.
  app.post('/api/analysis/personalize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { analysis, profileId } = req.body ?? {};
      if (!analysis || typeof analysis !== 'object' || !Array.isArray(analysis.ingredients)) {
        return res.status(400).json({ message: "An analysis with ingredients is required" });
      }
      if (typeof profileId !== 'string' || !profileId) {
        return res.status(400).json({ message: "profileId is required" });
      }

      const profile = await storage.getProfile(profileId, userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json(applyProfileToAnalysis(annotateWithCitations(analysis), profile));
    } catch (error: any) {
      console.error("[PERSONALIZE] Error re-scoring analysis:", error);
      res.status(500).json({ message: error.message || "Failed to re-score analysis" });
    }
  });

  // POST /api/demo-scan - the example verdict shown at the end of onboarding
  //
  // No quota, no vision call, no cost: the label is a fixture (server/demoScan.ts).
  // The VERDICT is not — it goes through the same chain a live scan does, so
  // what the app tells someone about their own allergies here is produced by
  // the real matcher and is true of the label it is shown against.
  //
  // Behind allowAnonymousScan but NOT requireScanQuota. The whole point is to
  // run before anyone has an account or an entitlement; the middleware is here
  // only so a caller has to be one of ours, and it spends nothing.
  app.post('/api/demo-scan', allowAnonymousScan, async (req: any, res) => {
    try {
      const { language, profile: inlineProfile } = req.body ?? {};

      let result = annotateWithCitations({ ...demoAnalysis(language), language: language || 'en' });
      result = withLabelRanks(result);

      // Same two-way resolution as a real scan, minus the stored-profile path:
      // by definition nobody has reached this endpoint with a saved profile.
      const profile = inlineProfile ? parseInlineProfile(inlineProfile) : undefined;
      if (profile) {
        result = applyProfileToAnalysis(result, profile);
      } else if (inlineProfile) {
        console.warn('[DEMO] inline profile could not be parsed; serving the generic example');
      }

      res.json(result);
    } catch (error: any) {
      console.error('[DEMO] Failed to build the example scan:', error?.message);
      res.status(500).json({ message: 'Failed to build the example scan' });
    }
  });

  // ==========================================
  // ACCOUNT MANAGEMENT ENDPOINTS
  // ==========================================

  // GET /api/account/scan-balance - Get scan balance and account details
  app.get('/api/account/scan-balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const quota = await subscriptionService.getUserQuotaStatus(userId);

      res.json({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        freeScansRemaining: quota.freeScansRemaining,
        freeScanGrant: quota.freeScanGrant,
        purchasedScanBalance: quota.purchasedScanBalance,
        // null means unlimited. The client renders the word, not the number.
        totalScansAvailable: quota.totalScansAvailable,
        subscription: quota.subscription,
      });
    } catch (error: any) {
      console.error("Error fetching scan balance:", error);
      res.status(500).json({ message: "Failed to fetch scan balance" });
    }
  });

  // POST /api/account/refresh-entitlement — ask RevenueCat, do not wait to be told
  //
  // The webhook is the normal path and stays the authority. This is the
  // recovery path for when a push is lost: a wrong secret, an outage, a deploy
  // landing between the purchase and the notification. Without it, someone who
  // has paid is stuck unsubscribed until some future event happens to arrive,
  // which is the worst support case a paid app has.
  //
  // The client may ask, but still does not decide — it triggers a question we
  // put to RevenueCat, and we write the answer. A device claiming to be
  // subscribed is worth exactly as much here as it was before.
  app.post('/api/account/refresh-entitlement', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const subscriber = await fetchSubscriber(userId);
      const state = resolveFromSubscriber(subscriber, ENTITLEMENT_ID);

      await subscriptionService.applySubscriptionState(userId, {
        ...state,
        revenueCatCustomerId: subscriber?.original_app_user_id,
      });
      console.log(`[RC-REFRESH] ${userId} is ${state.status}${state.plan ? ` (${state.plan})` : ''}`);

      const quota = await subscriptionService.getUserQuotaStatus(userId);
      res.json({ subscription: quota.subscription });
    } catch (error: any) {
      if (error instanceof RevenueCatNotConfigured) {
        console.warn('[RC-REFRESH] REVENUECAT_SECRET_KEY is not set');
        return res.status(503).json({ message: 'Subscription lookup is unavailable' });
      }
      // 502, and NOTHING written. Failing to reach RevenueCat is not evidence
      // that someone is unsubscribed, and writing `none` on a timeout would
      // cancel a subscription somebody is paying for.
      console.error('[RC-REFRESH] lookup failed:', error?.message);
      res.status(502).json({ message: 'Could not reach the store' });
    }
  });

  // DELETE /api/account - permanently delete the signed-in user
  //
  // Required by App Store guideline 5.1.1(v): an app that lets someone create
  // an account must let them delete it from inside the app, not by emailing
  // support.
  //
  // Everything goes in one statement — profiles, scan history, and usage and
  // purchase logs all cascade from users.id, and analytics events detach to a
  // null user rather than following the person out (see storage.deleteUser).
  // There is no soft-delete: someone asking to be forgotten is not asking to
  // be marked inactive.
  //
  // The bearer token survives cryptographically but stops working immediately,
  // because bearerAuthMiddleware looks the user up on every request and bails
  // when the row is gone.
  //
  // NOTE: this does not cancel an active subscription, and it cannot. The
  // subscription belongs to the Apple ID, not to this row — only the person
  // holding it can cancel, in their Apple ID settings. Deleting here removes
  // our record of the entitlement while Apple keeps billing, so both legal
  // documents say so in as many words (see server/legal.ts). If we ever want
  // to do better than a warning, the move is to surface it on the Account
  // screen before the confirm, not to fake a cancellation we cannot perform.
  app.delete('/api/account', isAuthenticated, async (req: any, res) => {
    try {
      // A deliberate hurdle on an irreversible endpoint. The client shows its
      // own confirmation; this guards against a stray DELETE reaching it.
      if (req.body?.confirm !== "DELETE") {
        return res.status(400).json({ message: 'Send { "confirm": "DELETE" } to delete this account' });
      }

      const userId = req.user.claims.sub;
      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`[ACCOUNT] Deleted user ${userId} and all associated data`);

      // Cookie sessions outlive the row they point at, so end the session too.
      // Bearer clients have no session; the callback simply never fires with
      // one and the response still goes out.
      if (req.session) {
        req.session.destroy(() => res.json({ success: true }));
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // POST /api/ocr is gone (2026-08-22). It was the last caller of the Google
  // Vision → Gemini OCR chain, and it had no callers of its own: neither the
  // mobile app nor the web client ever requested it. Scanning goes through
  // /api/scan-and-analyze, which reads labels via services/labelReader.ts.
  //
  // Removed rather than rewired, because an endpoint nothing calls is not worth
  // keeping alive — and this one kept two sets of third-party credentials in
  // the request path for no delivered behaviour.

  // Analysis endpoint - analyze ingredients (protected)
  app.post("/api/analyze", isAuthenticated, async (req, res) => {
    const startTime = Date.now();
    try {
      const { productType, ingredientsText, userLanguage } = analysisRequestSchema.parse(req.body);
      
      if (!ingredientsText || ingredientsText.trim().length < 10) {
        return res.status(400).json({ 
          error: 'Ingredient text is too short or empty. Please provide a clear image with visible ingredients.' 
        });
      }
      
      const result = await analyzeIngredients(productType as ProductType, ingredientsText, userLanguage);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[TIMING] Analysis completed in ${duration}s`);
      
      res.json(result);
    } catch (error: any) {
      console.error('Analysis endpoint error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Return appropriate status based on error type
      const statusCode = error.message?.includes('Incomplete ingredient analysis') ? 400 : 500;
      
      res.status(statusCode).json({ 
        error: error.message || 'Failed to analyze ingredients. Please try again.' 
      });
    }
  });

  // Cache statistics — read by the legacy web admin page. Gated because on a
  // public host an open endpoint reporting cache size is free reconnaissance.
  app.get("/api/cache-stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await getCacheStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check analysis status (for polling from mobile when tab is backgrounded) (protected)
  app.get("/api/analysis-status/:requestId", allowAnonymousScan, (req: any, res) => {
    const { requestId } = req.params;
    const request = analysisRequests.get(requestId);

    // Someone else's request is reported as missing rather than forbidden: a
    // 403 would confirm the id is real, which is itself worth not saying.
    if (!request || request.ownerKey !== principalKey(req.scanPrincipal)) {
      return res.status(404).json({ error: 'Analysis request not found' });
    }

    if (request.status === 'processing') {
      // Partial names when the reader has begun producing them. The status is
      // still 'processing': nothing has been analysed, and the client shows
      // the list without a verdict against any of it.
      return res.status(202).json({
        status: 'processing',
        ingredients: request.ingredients,
        ingredientsOriginal: request.ingredientsOriginal,
      });
    }
    
    if (request.status === 'ocr_complete') {
      return res.status(202).json({
        status: 'ocr_complete',
        ingredientCount: request.ingredientCount,
        ingredients: request.ingredients,
        ingredientsOriginal: request.ingredientsOriginal,
        composition: request.composition,
        checked: request.checked ?? [],
      });
    }
    
    if (request.status === 'failed') {
      return res.status(400).json({
        status: 'failed',
        error: request.error,
        code: request.errorCode,
      });
    }
    
    // Status === 'completed'
    res.json({
      status: 'completed',
      ocrText: request.ocrText,
      analysis: request.result
    });
  });

  // Combined OCR + Analysis endpoint (returns request ID immediately for mobile resilience) (protected)
  app.post("/api/scan-and-analyze", allowAnonymousScan, requireScanQuota, async (req, res) => {
    const body = req.body;
    
    // Validate required fields
    if ((!body.imageData && !body.ocrText) || !body.productType || !body.userLanguage) {
      return res.status(400).json({ 
        error: 'Missing required fields: (imageData OR ocrText), productType, and userLanguage are required.' 
      });
    }

    // Generate request ID
    const requestId = crypto.randomBytes(8).toString('hex');
    const principal: ScanPrincipal = (req as any).scanPrincipal;
    const userId: string | undefined =
      principal.kind === 'user' ? principal.userId : undefined;
    const analysisRequest: AnalysisRequest = {
      id: requestId,
      ownerKey: principalKey(principal),
      userId,
      status: 'processing',
      timestamp: Date.now()
    };
    analysisRequests.set(requestId, analysisRequest);
    
    // Return request ID immediately so client can poll
    res.status(202).json({ requestId, status: 'processing' });
    
    // Process analysis in background (non-blocking)
    (async () => {
      const startTime = Date.now();
      let ocrText: string | undefined;
      let structuredIngredients: string[] | undefined;
      let declaredAllergens: { contains: string[]; mayContain: string[] } | undefined;
      let originalIngredients: string[] | undefined;
      let composition: { name: string; parts: string[] }[] | undefined;
      let readConfidence: 'high' | 'medium' | 'low' | undefined;
      let lineCount: { read: number; total: number } | undefined;
      let sourceLanguage: string | undefined;
      let ocrDuration: string = '0.00';
      let ocrStage: 'skipped' | 'success' | 'failed' = 'skipped';
      let analysisStage: 'pending' | 'success' | 'failed' = 'pending';

      try {
        const {
          imageData, productType, userLanguage, ocrText: cachedOcrText, profileId,
          profile: inlineProfile,
        } = body;

        // Step 1: Read the label (multimodal-first) or use cached/client-provided text.
        // Label reading is language-independent — same result serves all languages.
        if (cachedOcrText) {
          console.log(`[SCAN-AND-ANALYZE-${requestId}] Using frontend-provided OCR text (${cachedOcrText.length} chars)`);
          ocrText = cachedOcrText;
          ocrStage = 'skipped';
        } else if (imageData) {
          // Check global label cache first (keyed by image hash, not language)
          const imageHash = hashImageData(imageData);
          const cachedOCREntry = ocrCache.get(imageHash);

          if (cachedOCREntry) {
            console.log(`[SCAN-AND-ANALYZE-${requestId}] Label cache HIT - reusing result for all languages`);
            ocrText = cachedOCREntry.text;
            structuredIngredients = cachedOCREntry.ingredients;
            declaredAllergens = cachedOCREntry.declaredAllergens;
            originalIngredients = cachedOCREntry.originalIngredients;
            composition = cachedOCREntry.composition;
            readConfidence = cachedOCREntry.readConfidence;
            lineCount = cachedOCREntry.lineCount;
            sourceLanguage = cachedOCREntry.sourceLanguage;
            ocrStage = 'skipped';
          } else {
            // Cache miss - read the label once, reused for all language variants
            console.log(`[SCAN-AND-ANALYZE-${requestId}] Label cache MISS - running multimodal label reader`);
            try {
              const labelResult = await readLabelFromImage(imageData, {
                // Names reach the client while the read is still running.
                // The reader spends most of a scan composing one response and
                // the names are in it long before it ends, so holding them
                // back bought nothing but a longer blank screen.
                onPartial: (found) => {
                  analysisRequest.ingredients = found.map((f) => f.english);
                  analysisRequest.ingredientsOriginal = found.map((f) => f.original);
                },
              });
              ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.log(`[TIMING] [LABEL-READ-SUCCESS-${requestId}] Label read via ${labelResult.method} in ${ocrDuration}s`);
              ocrStage = 'success';

              ocrText = labelResult.rawText;
              // The legacy OCR fallback returns heuristically-extracted
              // ingredients; only multimodal extractions are trusted as
              // structured (they're model-translated to English already).
              if (labelResult.method !== 'ocr-fallback') {
                structuredIngredients = labelResult.ingredients;
              }
              declaredAllergens = labelResult.declaredAllergens;
              originalIngredients = labelResult.ingredientsOriginal;
              // The label as printed. Empty on the OCR fallback, which splits
              // on commas and so never had a bracket to lose.
              composition = labelResult.entries.length
                ? labelResult.entries.map((entry) => ({
                    name: entry.english,
                    parts: entry.parts.map((part) => part.english),
                  }))
                : undefined;
              readConfidence = labelResult.confidence;
              lineCount = labelResult.lineCount;
              sourceLanguage = labelResult.sourceLanguage;
              if (declaredAllergens.contains.length || declaredAllergens.mayContain.length) {
                console.log(`[LABEL-READER] Declared allergens — contains: [${declaredAllergens.contains.join(', ')}] may contain: [${declaredAllergens.mayContain.join(', ')}]`);
              }

              // Store in global cache for future requests (all languages will use this same result)
              ocrCache.set(imageHash, {
                text: ocrText,
                ingredients: structuredIngredients,
                productName: labelResult.productName,
                sourceLanguage: labelResult.sourceLanguage,
                declaredAllergens,
                originalIngredients,
                composition,
                readConfidence: labelResult.confidence,
                lineCount: labelResult.lineCount,
                timestamp: Date.now()
              });
              console.log(`[SCAN-AND-ANALYZE-${requestId}] Label result cached - will be reused for other languages`);
            } catch (ocrError: any) {
              ocrStage = 'failed';
              ocrDuration = ((Date.now() - startTime) / 1000).toFixed(2);
              console.error(`[LABEL-READ-FAILED-${requestId}] Error after ${ocrDuration}s:`, ocrError.message);
              // Re-wrapping for the log prefix used to drop the error's code
              // with it, so the app fell back to showing this English sentence
              // verbatim. Carry the code across the boundary.
              const wrapped: any = new Error(`OCR failed: ${ocrError.message}`);
              if (typeof ocrError?.code === 'string') wrapped.code = ocrError.code;
              throw wrapped;
            }
          }
        }
        
        // Update status to indicate OCR is complete, now analyzing
        analysisRequest.status = 'ocr_complete';
        analysisRequest.timestamp = Date.now();
        // Everything the scan will list, published now rather than at the
        // end: the names are already known, and the wait that follows is the
        // analysis, not the reading.
        if (structuredIngredients?.length) {
          analysisRequest.ingredientCount = structuredIngredients.length;
          analysisRequest.ingredients = structuredIngredients;
          analysisRequest.ingredientsOriginal = originalIngredients;
          analysisRequest.composition = composition;
        }
        console.log(`[SCAN-AND-ANALYZE-${requestId}] OCR phase complete, starting analysis phase`);
        
        // Step 2a: Determine the ingredient list (language-independent) and cache it.
        // The multimodal label reader already produced structured English
        // ingredients; the heuristic text extraction only runs for plain-text
        // inputs (client-provided ocrText or the legacy OCR fallback).
        const extractionStartTime = Date.now();
        let extractedIngredients: string[] = [];
        const ocrTextHash = crypto.createHash('sha256').update(ocrText!).digest('hex');
        const cachedExtraction = extractedIngredientsCache.get(ocrTextHash);

        if (structuredIngredients && structuredIngredients.length > 0) {
          console.log(`[EXTRACTION] Using ${structuredIngredients.length} structured ingredients from multimodal label reader`);
          extractedIngredients = structuredIngredients;
          extractedIngredientsCache.set(ocrTextHash, {
            ingredients: extractedIngredients,
            timestamp: Date.now()
          });
        } else if (cachedExtraction) {
          console.log(`[EXTRACTION] Cache HIT - reusing ${cachedExtraction.ingredients.length} pre-extracted ingredients`);
          extractedIngredients = cachedExtraction.ingredients;
        } else {
          console.log(`[EXTRACTION] Cache MISS - extracting ingredients from OCR text`);
          const extractionResult = extractIngredientsFromText(ocrText!);
          extractedIngredients = extractionResult.ingredients;

          // Cache extracted ingredients for future language requests
          extractedIngredientsCache.set(ocrTextHash, {
            ingredients: extractedIngredients,
            timestamp: Date.now()
          });
          console.log(`[EXTRACTION] Cached ${extractedIngredients.length} extracted ingredients for reuse`);
        }
        
        const extractionDuration = ((Date.now() - extractionStartTime) / 1000).toFixed(2);
        console.log(`[TIMING] [EXTRACTION-${requestId}] Extraction completed in ${extractionDuration}s`);
        
        // Step 2b: Run Parallel Micro-Batched Analysis (using pre-extracted ingredients)
        const analysisStartTime = Date.now();
        try {
          let analysisResult = await analyzeIngredientsParallel(
            productType as ProductType, ocrText!, userLanguage, extractedIngredients,
            (names) => { analysisRequest.checked = [...(analysisRequest.checked ?? []), ...names]; },
          );
          analysisStage = 'success';
          const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

          console.log(`[TIMING] [ANALYSIS-SUCCESS-${requestId}] Analysis completed in ${analysisDuration}s (total: ${totalDuration}s)`);

          // Attach knowledge-base citations post-cache so cached analyses
          // pick up KB updates without re-analysis. Stamped with the language
          // the result is written in first, so the citations are translated
          // into it, and so the same scan reopened later still reads in it.
          analysisResult = annotateWithCitations({ ...analysisResult, language: userLanguage });

          // Carry the label's own allergen declaration onto the result so
          // profile matching can use it (the analysis cache is keyed on
          // ingredient text and knows nothing about it).
          if (declaredAllergens) {
            analysisResult = { ...analysisResult, declaredAllergens };
          }
          // Carry the English ingredient names through for allergen matching:
          // when userLanguage isn't English, analysisResult.ingredients[].name
          // is localized and would never match the English keyword lists.
          if (structuredIngredients?.length) {
            analysisResult = { ...analysisResult, canonicalIngredients: structuredIngredients };
          }
          // Source-language names + read confidence drive the bilingual pair
          // and the uncertain state on the verdict card.
          analysisResult = {
            ...analysisResult,
            originalIngredients,
            sourceLanguage,
            readConfidence,
            lineCount,
            // The label as printed. Travels alongside the flat list rather
            // than replacing it: the flat list is what was analysed, and this
            // is what the label actually says.
            composition,
          };
          // Position on the printed list. Must run after canonicalIngredients
          // and composition are attached above — those carry the label's own
          // order, and the analyzer's is not guaranteed to be.
          analysisResult = withLabelRanks(analysisResult);

          // Apply the personal profile AFTER analysis/cache retrieval so the
          // cached analysis stays profile-agnostic and serves every profile.
          //
          // Two ways in. A signed-in scan names a stored profile by id. A scan
          // made during onboarding, before there is an account, sends the
          // profile INLINE — it exists only on that device, so there is nothing
          // here to look up.
          //
          // The inline profile is validated and used for this one analysis and
          // never written anywhere. That is the whole point: someone who has
          // not signed in has not agreed to us storing their child's allergies,
          // and the first scan still has to be about that child or the app has
          // shown them the generic answer it is trying to prove it is better
          // than.
          const resolvedProfile = profileId && userId
            ? await storage.getProfile(profileId, userId)
            : inlineProfile
              ? parseInlineProfile(inlineProfile)
              : undefined;

          if (resolvedProfile) {
            analysisResult = applyProfileToAnalysis(analysisResult, resolvedProfile);
            const flagCount = analysisResult.personalFlags?.length ?? 0;
            console.log(`[PERSONAL-RISK-${requestId}] Applied profile "${resolvedProfile.name}": ${flagCount} personal flags, overall risk ${analysisResult.overallRisk}`);
          } else if (profileId || inlineProfile) {
            console.warn(`[PERSONAL-RISK-${requestId}] profile could not be resolved, skipping personalization`);
          }

          // Store completed result
          analysisRequest.status = 'completed';
          analysisRequest.result = analysisResult;
          analysisRequest.ocrText = ocrText;
          analysisRequest.timestamp = Date.now();

          // Spend the scan HERE, on success, and nowhere else.
          //
          // It used to be spent when the client saved the scan to history,
          // inside a try/catch that logged the failure and carried on. Three
          // things were wrong with that: an anonymous scan never reaches the
          // history route at all, a client that simply never called it scanned
          // for free forever, and a user at zero still got their analysis
          // because the check ran after we had already paid for it.
          //
          // Still swallowed on failure, but for the opposite reason: the person
          // has their verdict, and taking it away because a counter would not
          // increment is a worse outcome than one uncounted scan.
          try {
            await consumeForPrincipal(principal, productType);
          } catch (quotaError: any) {
            console.error(`[QUOTA-${requestId}] consume failed:`, quotaError?.message);
          }
          
        } catch (analysisError: any) {
          analysisStage = 'failed';
          const analysisDuration = ((Date.now() - analysisStartTime) / 1000).toFixed(2);
          console.error(`[ANALYSIS-FAILED-${requestId}] Analysis error after ${analysisDuration}s:`, analysisError.message);
          throw analysisError;
        }
      } catch (error: any) {
        console.error(`[SCAN-AND-ANALYZE-FAILED-${requestId}] Error:`, error.message);
        analysisRequest.status = 'failed';
        analysisRequest.error = error.message || 'Failed to analyze image. Please try again.';
        // Only errors that carry their own code get one — an unrecognised
        // failure must not be dressed up as a known, user-fixable one.
        analysisRequest.errorCode = typeof error?.code === 'string' ? error.code : undefined;
        analysisRequest.timestamp = Date.now();
      }
    })();
  });

  // ==================== SCAN HISTORY ENDPOINTS ====================

  // Schema for creating scan history
  const createScanHistorySchema = z.object({
    productName: z.string().optional().default("Unnamed Product"),
    productCategory: z.enum(productCategories as readonly [string, ...string[]]).optional().default("other"),
    originalImageUrl: z.string().nullable().optional(),
    detectedIngredients: z.array(z.string()),
    analysisResults: z.array(z.object({
      name: z.string(),
      // The English name the row was analysed as. Saved because `name` is in
      // the scan's language and every lookup on reopening is keyed in English;
      // see `sourceName` on ingredientSchema.
      sourceName: z.string().optional(),
      // Both carry the model's neutral rating. `riskLevel` stays for older
      // clients; `modelRiskLevel` is the one re-derivation reads, and having it
      // explicitly named is what stops a personalized level from being mistaken
      // for a universal one when the scan is reopened by someone else.
      riskLevel: z.enum(["low", "moderate", "high"]),
      modelRiskLevel: z.enum(["low", "moderate", "high"]).optional(),
      summary: z.string(),
      details: z.string(),
      category: z.string().nullish(),
      // Persisted, unlike the policy level beside it. A risk level is re-derived
      // on every read because the corpus and rules move; a printed ingredient
      // list does not, and the canonical names it was computed from are not kept
      // in a form that would let us recover the position later.
      labelRank: z
        .object({ rank: z.number().int().min(1), total: z.number().int().min(1) })
        .optional(),
    })),
    overallRisk: z.enum(["low", "moderate", "high"]),
    language: z.string().optional().default("en"),
    isUpdatedFromCache: z.boolean().optional().default(false),
    /**
     * The label as printed, sent so the saved count matches the card it was
     * saved from, and so reopening the scan can still say which bracket a
     * sub-ingredient came out of. Stored since 2026-09-20.
     */
    composition: z
      .array(z.object({ name: z.string(), parts: z.array(z.string()).default([]) }))
      .optional(),
    /** Stored since 2026-09-24; see `labelContext` on scanHistory. */
    labelContext: labelContextSchema.optional(),
  });

  // POST /api/history - Save a new scan to history
  app.post("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = createScanHistorySchema.parse(req.body);
      
      const scanData: InsertScanHistory = {
        userId,
        productName: data.productName || "Unnamed Product",
        productCategory: data.productCategory || "other",
        originalImageUrl: data.originalImageUrl || null,
        detectedIngredients: data.detectedIngredients,
        analysisResults: data.analysisResults,
        overallRisk: data.overallRisk,
        language: data.language || "en",
        isUpdatedFromCache: data.isUpdatedFromCache || false,
        // Every ingredient the scan lists, which is what the card shows and
        // what the packet prints: a bracket groups names, it does not hide
        // them. Composition still travels, for the rank and the "inside X"
        // lines, but it is not what gets counted.
        ingredientCount: data.detectedIngredients.length,
        // Null rather than an empty array when the reader found no structure:
        // an empty array would claim the label prints nothing, and the count
        // above would then disagree with it.
        composition: data.composition?.length ? data.composition : null,
        labelContext: data.labelContext ?? null,
      };
      
      const scan = await storage.createScanHistory(scanData);
      console.log(`[HISTORY] Saved scan ${scan.id} for user ${userId}`);
      
      // Quota is NOT spent here. Saving to history is a separate act from
      // scanning — the client can retry it, skip it, or call it twice — and
      // metering on it charged people for the wrong thing. See the consume call
      // in /api/scan-and-analyze.
      
      res.status(201).json({ success: true, scanId: scan.id });
    } catch (error: any) {
      console.error("[HISTORY] Error saving scan:", error);
      res.status(400).json({ error: error.message || "Failed to save scan" });
    }
  });

  // Validation schema for pagination query params
  const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
    // The history screen's verdict filter. Applied in SQL so the count and the
    // paging agree with what the pill claims.
    risk: z.enum(["low", "moderate", "high"]).optional(),
  });

  // Validation schema for scan ID params
  const scanIdSchema = z.object({
    scanId: z.string().uuid(),
  });

  /**
   * Re-derive a stored scan's levels, and its personal overlay when a profile
   * is supplied.
   *
   * Shared by the history list and the scan detail endpoint on purpose. They
   * used to derive separately — the detail screen re-personalized against the
   * active profile while the list returned the verdict frozen at scan time — so
   * a tile could read Safe while the screen it opened read Avoid. One function
   * is the only way two screens stay agreed.
   */
  function deriveStoredScan(
    scan: any,
    profile: Profile | undefined,
    opts: { withCitations: boolean } = { withCitations: true },
  ) {
    const domain = domainForProductType(scan.productCategory ?? 'food');
    const stored: any[] = Array.isArray(scan.analysisResults) ? scan.analysisResults : [];
    // The label facts the live result was scored with, so a reopened scan is
    // the same scan. Null before 2026-09-24, and then it is the old behaviour.
    const context = labelContextSchema.safeParse(scan.labelContext ?? {});
    const label: LabelContext = context.success ? context.data : {};
    const canonical = label.canonicalIngredients;
    // Rows saved without their English name get it back from the English list,
    // by position, and only when the two lists agree in length: the same rule
    // the analyzer used to attach it in the first place.
    const aligned = canonical && canonical.length === stored.length;
    const ingredients: Ingredient[] = stored.map((ing, i) =>
      applyPopulationRisk(
        ing.sourceName || !aligned ? ing : { ...ing, sourceName: canonical![i] },
        domain,
      ),
    );
    const asAnalysis = {
      productType: scan.productCategory,
      productName: scan.productName,
      ingredients,
      overallRisk: scan.overallRisk,
      analyzedAt: scan.createdAt.toISOString(),
      ...label,
      // The language the scan was TAKEN in, not the app's setting today: its
      // ingredient text is in that language, so its sources should be too.
      language: scan.language ?? 'en',
      // Absent on scans saved before the column existed, which is the same
      // thing a fresh OCR-fallback scan reports, so the card already knows
      // how to show a list with no structure behind it.
      ...(Array.isArray(scan.composition) && scan.composition.length
        ? { composition: scan.composition }
        : {}),
    } as any;

    // Ranks again, from the label context, rather than only the ones saved on
    // the rows: a scan saved before ranks could be found by English name has
    // none on its translated rows, and the same label saved in English does.
    const ranked = withLabelRanks(asAnalysis);

    if (profile) {
      // applyProfileToAnalysis sets overallRisk to the worst DISPLAYED level.
      return applyProfileToAnalysis(
        opts.withCitations ? annotateWithCitations(ranked) : ranked,
        profile,
      );
    }

    // No profile: the verdict is still the worst level actually shown, not the
    // one stored at scan time. The corpus moves — ingesting a source changes
    // levels on scans taken months ago — so a frozen overall verdict can sit
    // above rows that no longer support it.
    const worst = ingredients.reduce<RiskLevel>((acc, i) => maxRisk(acc, i.riskLevel), 'low');
    return { ...ranked, overallRisk: ingredients.length > 0 ? worst : scan.overallRisk };
  }

  // How many recent scans a personalized history view re-derives in one pass.
  // Personalization cannot be expressed in SQL, so when a profile is applied
  // the risk filter and the total have to be computed from the same derived
  // values the tiles show — otherwise the "High" pill counts stored verdicts
  // while the grid displays personalized ones, and they disagree on screen.
  // Above this many scans the request falls back to SQL paging rather than
  // growing without bound; the largest real history today is 140.
  const PERSONALIZED_WINDOW = 500;

  // GET /api/history - Get user's scan history (paginated)
  app.get("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { limit, offset, risk } = paginationSchema.parse(req.query);
      const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : undefined;

      const totalCount = await storage.getScanHistoryCount(userId);
      // Derived whether or not a profile is involved.
      //
      // Gating derivation on having a profile reintroduced the same bug one
      // branch over: with no profile the grid served stored verdicts while the
      // detail screen derived, so the two still disagreed for anyone who had
      // not set a profile up. What makes a stored verdict stale is the corpus
      // moving underneath it, and that happens to everyone.
      if (totalCount > PERSONALIZED_WINDOW) {
        console.warn(
          `[HISTORY] ${totalCount} scans exceeds the derivation window ` +
            `(${PERSONALIZED_WINDOW}); serving stored verdicts for user ${userId}`,
        );
        const [scans, filteredCount] = await Promise.all([
          storage.getScanHistory(userId, limit, offset, risk),
          storage.getScanHistoryCount(userId, risk),
        ]);
        return res.json({
          scans,
          total: filteredCount,
          limit,
          offset,
          hasMore: offset + scans.length < filteredCount,
        });
      }

      const profile = profileId ? await storage.getProfile(profileId, userId) : undefined;

      // Citations are skipped here: they attach reading material to an
      // ingredient and never change a level, and a tile shows no sources.
      const all = await storage.getScanHistory(userId, PERSONALIZED_WINDOW, 0);
      const derived = all.map((scan) => ({
        scan,
        overallRisk: deriveStoredScan(scan, profile, { withCitations: false }).overallRisk,
      }));
      const matching = risk ? derived.filter((d) => d.overallRisk === risk) : derived;
      const page = matching.slice(offset, offset + limit);

      res.json({
        scans: page.map((d) => ({ ...d.scan, overallRisk: d.overallRisk })),
        total: matching.length,
        limit,
        offset,
        hasMore: offset + page.length < matching.length,
      });
    } catch (error: any) {
      console.error("[HISTORY] Error fetching history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch history" });
    }
  });

  // GET /api/history/:scanId - Get a single scan by ID
  app.get("/api/history/:scanId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scanId } = scanIdSchema.parse(req.params);
      
      const scan = await storage.getScanById(scanId, userId);

      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }

      // Personal flags are not persisted with the scan — a profile's allergens
      // change over time, and stale safety flags are worse than none. Instead,
      // ?profileId= re-applies the *current* profile server-side so the
      // matching logic stays in one place.
      // Population risk is re-derived here for the same reason, and from the
      // same principle: the evidence corpus and the policy rules both move, so a
      // level frozen at scan time would assert an out-of-date regulatory
      // picture. Deriving on read also means ingesting a new source improves
      // every stored scan retroactively.
      //
      // saveScan only persists name/riskLevel/summary/details/category, so
      // without this a reopened scan would report every ingredient as unchecked
      // while the results screen for the same product said otherwise.
      const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : undefined;
      if (profileId) {
        const profile = await storage.getProfile(profileId, userId);
        if (profile) {
          // Same derivation the history list uses, so the tile and this screen
          // cannot report different verdicts for the same scan.
          const personalized = deriveStoredScan(scan, profile);
          return res.json({
            ...scan,
            analysisResults: personalized.ingredients,
            overallRisk: personalized.overallRisk,
            personalFlags: personalized.personalFlags,
            appliedProfile: personalized.appliedProfile,
            // The verdict card's evidence blocks. Re-derived here rather than
            // persisted, for the same reason the flags are: a profile's
            // allergens change, and a stale "what we checked" would vouch for
            // a check that never ran against today's profile.
            checked: personalized.checked,
            closestCall: personalized.closestCall,
            settle: personalized.settle,
          });
        }
      }

      // No profile requested — still derive, so the two paths cannot disagree
      // about what has been checked or about the overall verdict.
      const derived = deriveStoredScan(scan, undefined);
      res.json({
        ...scan,
        analysisResults: derived.ingredients,
        overallRisk: derived.overallRisk,
      });
    } catch (error: any) {
      console.error("[HISTORY] Error fetching scan:", error);
      res.status(500).json({ error: error.message || "Failed to fetch scan" });
    }
  });

  // PATCH /api/history/:scanId - Update a scan (rename)
  const updateScanSchema = z.object({
    productName: z.string().min(1).max(200),
  });

  app.patch("/api/history/:scanId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scanId } = scanIdSchema.parse(req.params);
      const { productName } = updateScanSchema.parse(req.body);
      
      const scan = await storage.updateScanName(scanId, userId, productName);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      console.log(`[HISTORY] Renamed scan ${scanId} to "${productName}"`);
      res.json(scan);
    } catch (error: any) {
      console.error("[HISTORY] Error updating scan:", error);
      res.status(400).json({ error: error.message || "Failed to update scan" });
    }
  });

  // DELETE /api/history/:scanId - Delete a single scan
  app.delete("/api/history/:scanId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { scanId } = scanIdSchema.parse(req.params);
      
      const deleted = await storage.deleteScan(scanId, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Scan not found" });
      }
      
      console.log(`[HISTORY] Deleted scan ${scanId} for user ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[HISTORY] Error deleting scan:", error);
      res.status(500).json({ error: error.message || "Failed to delete scan" });
    }
  });

  // DELETE /api/history - Delete all scans for user
  app.delete("/api/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const deletedCount = await storage.deleteAllScans(userId);
      
      console.log(`[HISTORY] Deleted ${deletedCount} scans for user ${userId}`);
      res.json({ success: true, deletedCount });
    } catch (error: any) {
      console.error("[HISTORY] Error deleting all scans:", error);
      res.status(500).json({ error: error.message || "Failed to delete scans" });
    }
  });

  // ==========================================
  // SCAN QUOTA
  // ==========================================
  //
  // Two things used to live here and no longer do.
  //
  // The FEEDBACK endpoint mailed a fixed inbox through Resend. No screen in the
  // iOS app ever called it; its only client was the retired web build under
  // client/. STRIPE billing (a publishable key, a checkout, an admin customer
  // sweep) was the same story, and production has held no Stripe key since the
  // move off Replit, so it failed closed on every path. Both meant naming a
  // processor in the privacy policy for something nobody could reach.


  app.get('/api/scan/quota', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await subscriptionService.getUserQuotaStatus(userId);
      res.json(status);
    } catch (error: any) {
      console.error('Error fetching scan quota:', error);
      res.status(500).json({ error: 'Failed to fetch scan quota' });
    }
  });


  // Open so the paywall can be measured before sign-in. Each call writes a
  // row, so without a limit an anonymous caller can grow the table for free.
  app.post('/api/analytics/purchase-prompt-view', rateLimit({ windowMs: 60 * 1000, max: 30, name: "analytics" }), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || null;
      const { source } = req.body;
      await subscriptionService.logPurchasePromptView(userId, source || 'unknown');
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error logging purchase prompt view:', error);
      res.status(500).json({ error: 'Failed to log event' });
    }
  });

  /**
   * Crash reports from the app.
   *
   * Unauthenticated on purpose. The crashes worth hearing about most are the
   * ones that happen before a person ever signs in — a bad release that dies at
   * startup reports nothing at all if this endpoint requires a session, which is
   * precisely the release you need to hear about. A user id is attached when
   * there happens to be one.
   *
   * That openness is why the limits below exist. The body is validated and
   * capped by `crashReportInputSchema`, unknown keys are stripped, and the rate
   * limit is per-IP: a crash LOOP on one device would otherwise write a row per
   * frame, and the app's own retry is not something this endpoint can see.
   *
   * Nothing here scrubs. The device already did that before sending, and a
   * second pass on the server would imply the first one is optional.
   */
  app.post(
    '/api/crash',
    rateLimit({ windowMs: 60 * 1000, max: 10, name: "crash" }),
    async (req: any, res) => {
      try {
        const parsed = crashReportInputSchema.safeParse(req.body);
        if (!parsed.success) {
          // 400 rather than a silent 200: a client sending malformed reports is
          // a client whose reports are being dropped, and it should find out.
          return res.status(400).json({ error: 'Invalid crash report' });
        }
        const report = parsed.data;

        // Grouping key: the message plus the first few stack frames. Deeper
        // frames vary with the route a person happened to take into the bug and
        // would split one fault into many.
        const frames = (report.stack ?? '')
          .split('\n')
          .slice(0, 4)
          .map(line => line.trim())
          .join('|');
        const fingerprint = crypto.createHash('sha256')
          .update(`${report.message}|${frames}`)
          .digest('hex')
          .slice(0, 16);

        await db.insert(crashReports).values({
          userId: req.user?.claims?.sub ?? null,
          message: report.message,
          stack: report.stack ?? null,
          origin: report.origin,
          screen: report.screen ?? null,
          fatal: report.fatal,
          appVersion: report.appVersion,
          buildVersion: report.buildVersion,
          platform: report.platform,
          osVersion: report.osVersion,
          fingerprint,
          occurredAt: new Date(report.at),
        });

        console.error(
          `[CRASH] ${report.platform} v${report.appVersion} (${report.buildVersion}) ` +
          `${report.origin}${report.fatal ? ' FATAL' : ''} [${fingerprint}] ${report.message}`,
        );
        res.status(204).end();
      } catch (error: any) {
        // Never surface a failure here. A device that cannot file a crash report
        // must not then retry, or a bad release turns into a write storm.
        console.error('Error storing crash report:', error.message);
        res.status(204).end();
      }
    },
  );

  // The Android waitlist on revely.life. Public, because the people it is for
  // have no way to hold an account: there is no app on their phone to sign in
  // with. Guarded instead by a tight per-address limit and a hidden field.
  //
  // The address is never logged. The count is, so the log alone says whether
  // the offer is being taken up without saying by whom.
  app.post(
    '/api/waitlist/android',
    rateLimit({ windowMs: 10 * 60 * 1000, max: 5, name: "android-waitlist" }),
    async (req, res) => {
      const parsed = androidWaitlistInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      const { email, lang, website } = parsed.data;
      // A bot that filled the trap is told it succeeded, so it has no reason
      // to try again with the field left empty.
      if (website) return res.status(204).end();
      const pageLang = lang && isLang(lang) ? lang : 'en';
      try {
        const inserted = await db
          .insert(androidWaitlist)
          .values({ email, lang: pageLang })
          .onConflictDoNothing()
          .returning({ email: androidWaitlist.email });
        console.log(`[WAITLIST] android ${inserted.length ? 'joined' : 'repeat'} lang=${pageLang}`);
        res.status(204).end();
      } catch (error: any) {
        console.error('Error storing waitlist address:', error.message);
        res.status(500).json({ error: 'Could not save' });
      }
    },
  );

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================
  // No default. The value that used to sit here was a Replit-era numeric user
  // id baked into the source, which meant "who is the admin" was decided by a
  // literal in a public repo rather than by deployment configuration. Absent
  // the variable the admin routes are simply closed — the failure mode of an
  // unset admin id must be "nobody", never "whoever holds that id".
  const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

  if (!ADMIN_USER_ID) {
    console.warn("[ADMIN] ADMIN_USER_ID is not set — /api/admin/* routes are disabled.");
  }

  const isAdmin = (req: any, res: any, next: any) => {
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!ADMIN_USER_ID || req.user.claims.sub !== ADMIN_USER_ID) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };

  // Check if a user is a test account based on email patterns
  function isTestUser(email: string | null | undefined): boolean {
    if (!email) return false;
    const lowerEmail = email.toLowerCase();
    
    // Fake/placeholder email domains (from automated testing)
    if (lowerEmail.endsWith('@example.com') || lowerEmail.endsWith('@test.com')) {
      return true;
    }
    
    // Replit internal domains
    if (lowerEmail.endsWith('@replit.com') || lowerEmail.endsWith('@repl.it')) {
      return true;
    }
    
    // Emails starting with test/testing (anchored to start)
    if (lowerEmail.startsWith('test@') || lowerEmail.startsWith('testing@')) {
      return true;
    }
    
    // Gmail-style +test aliases
    if (lowerEmail.includes('+test@') || lowerEmail.includes('+testing@')) {
      return true;
    }
    
    return false;
  }

  /**
   * Crash reports, newest fault first. Admin only.
   *
   * Grouped by fingerprint, because the question is never "what happened to
   * this one person" — it is "what is broken, how many people has it reached,
   * and did it start with a particular build".
   */
  app.get('/api/admin/crashes', isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const rows = await db
        .select({
          fingerprint: crashReports.fingerprint,
          message: sql<string>`min(${crashReports.message})`,
          origin: sql<string>`min(${crashReports.origin})`,
          screen: sql<string>`min(${crashReports.screen})`,
          occurrences: sql<number>`count(*)::int`,
          devices: sql<number>`count(distinct ${crashReports.userId})::int`,
          builds: sql<string>`string_agg(distinct ${crashReports.buildVersion}, ', ')`,
          firstSeen: sql<Date>`min(${crashReports.occurredAt})`,
          lastSeen: sql<Date>`max(${crashReports.occurredAt})`,
        })
        .from(crashReports)
        .groupBy(crashReports.fingerprint)
        .orderBy(sql`max(${crashReports.occurredAt}) desc`)
        .limit(100);
      res.json(rows);
    } catch (error: any) {
      console.error('Error reading crash reports:', error.message);
      res.status(500).json({ error: 'Failed to read crash reports' });
    }
  });

  app.get('/api/admin/dashboard', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const showTestUsers = req.query.showTestUsers === 'true';
      const allUsers = await db.select().from(users);
      
      // Filter out test users unless toggle is on
      const displayUsers = showTestUsers ? allUsers : allUsers.filter(u => !isTestUser(u.email));
      const realUsers = allUsers.filter(u => !isTestUser(u.email));
      
      const totalUsers = realUsers.length;
      const totalPurchasedScansBalance = realUsers.reduce((sum, u) => sum + (u.purchasedScanBalance || 0), 0);
      
      // Get scan history for time-based stats
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Query scans from scanHistory table
      const allScans = await db.select().from(scanHistory);
      const scansToday = allScans.filter(s => s.createdAt && new Date(s.createdAt) >= startOfToday).length;
      const scansThisWeek = allScans.filter(s => s.createdAt && new Date(s.createdAt) >= startOfWeek).length;
      const scansThisMonth = allScans.filter(s => s.createdAt && new Date(s.createdAt) >= startOfMonth).length;
      
      // Build per-user scan counts
      const userScanCounts = new Map<string, { today: number; week: number; month: number; total: number }>();
      for (const scan of allScans) {
        const userId = scan.userId;
        const counts = userScanCounts.get(userId) || { today: 0, week: 0, month: 0, total: 0 };
        counts.total++;
        if (scan.createdAt) {
          const scanDate = new Date(scan.createdAt);
          if (scanDate >= startOfToday) counts.today++;
          if (scanDate >= startOfWeek) counts.week++;
          if (scanDate >= startOfMonth) counts.month++;
        }
        userScanCounts.set(userId, counts);
      }

      // Use displayUsers for the user list (respects toggle), stats always use realUsers
      const recentUsers = displayUsers
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 100)
        .map(u => {
          const scanCounts = userScanCounts.get(u.id) || { today: 0, week: 0, month: 0, total: 0 };
          return {
            id: u.id,
            replitId: u.id,
            email: u.email || '',
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
            freeScansUsed: u.freeScansUsed || 0,
            subscriptionStatus: u.subscriptionStatus,
            purchasedScanBalance: u.purchasedScanBalance || 0,
            createdAt: u.createdAt?.toString() || '',
            scansToday: scanCounts.today,
            scansThisWeek: scanCounts.week,
            scansThisMonth: scanCounts.month,
            totalScans: scanCounts.total,
            isTestUser: isTestUser(u.email),
          };
        });

      res.json({
        stats: {
          totalUsers,
          totalPurchasedScansBalance,
          totalScansToday: scansToday,
          totalScansThisWeek: scansThisWeek,
          totalScansThisMonth: scansThisMonth,
        },
        recentUsers,
      });
    } catch (error: any) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });
  
  // Daily usage stats (logins and scans by day)
  app.get('/api/admin/daily-usage', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      
      // Get all scans in the period
      const scans = await db.select().from(scanHistory).where(gte(scanHistory.createdAt, startDate));
      
      // Get all sessions for login data
      const allSessions = await db.select().from(sessions);
      
      // Build daily stats
      const dailyStats: Record<string, { date: string; scans: number; logins: number }> = {};
      
      // Initialize all days
      for (let i = 0; i <= days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyStats[dateStr] = { date: dateStr, scans: 0, logins: 0 };
      }
      
      // Count scans by day
      for (const scan of scans) {
        if (scan.createdAt) {
          const dateStr = new Date(scan.createdAt).toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].scans++;
          }
        }
      }
      
      // Count unique logins by day (from session expires)
      // Sessions expire in the future, so we estimate login date
      for (const session of allSessions) {
        if (session.expire) {
          // Session typically expires 24h after login, so subtract 24h
          const loginDate = new Date(session.expire);
          loginDate.setHours(loginDate.getHours() - 24);
          const dateStr = loginDate.toISOString().split('T')[0];
          if (dailyStats[dateStr]) {
            dailyStats[dateStr].logins++;
          }
        }
      }
      
      // Convert to array sorted by date
      const result = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
      
      res.json({ dailyStats: result });
    } catch (error: any) {
      console.error('Daily usage error:', error);
      res.status(500).json({ error: 'Failed to load daily usage' });
    }
  });
  
  // Ingredient cache viewer
  app.get('/api/admin/ingredient-cache', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const entries = await getAllCacheEntries();
      
      // Sort by most recently updated
      entries.sort((a, b) => b.lastUpdated - a.lastUpdated);
      
      res.json({
        totalEntries: entries.length,
        entries: entries.slice(0, 500), // Limit to 500 entries for performance
      });
    } catch (error: any) {
      console.error('Ingredient cache error:', error);
      res.status(500).json({ error: 'Failed to load ingredient cache' });
    }
  });

  app.post('/api/admin/grant-scans', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, amount } = req.body;
      if (!userId || !amount || amount < 1) {
        return res.status(400).json({ error: 'User ID and valid amount required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newBalance = (user.purchasedScanBalance || 0) + amount;
      await db.update(users)
        .set({ purchasedScanBalance: newBalance })
        .where(eq(users.id, userId));

      res.json({ success: true, newBalance });
    } catch (error: any) {
      console.error('Grant scans error:', error);
      res.status(500).json({ error: 'Failed to grant scans' });
    }
  });

  // The promo codes and the referral scheme that used to live here are gone.
  //
  // Both handed out `purchasedScanBalance`, which was the currency of the model
  // this app has left: ten scans for $2.99, packs that never expire. A promo
  // code granted some; referring a friend granted ten to each of you.
  //
  // Under a subscription the app no longer sells packs, and the viewfinder's
  // gate asks `subscription.active` and never looks at how many scans are
  // banked. So both schemes credited scans the holder could not spend: the
  // server would have allowed the scan and the app would still have sent them
  // to the paywall. Nothing in the mobile app called either one, so nobody
  // found out.
  //
  // Removed rather than repointed at subscriptions, because the thing worth
  // building instead is a comp entitlement, and that is a different shape: it
  // grants subscription TIME, it has to survive RevenueCat overwriting the
  // subscription columns on every refresh, and it wants no redeem field in the
  // app at all.

  // Clear ingredient cache (admin only - use when AI prompts change)
  app.post('/api/admin/clear-cache', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const clearedCount = await clearAllCache();
      console.log(`[ADMIN] Cache cleared by user ${req.user.claims.sub}: ${clearedCount} entries removed`);
      res.json({ success: true, clearedCount, message: `Cleared ${clearedCount} cached ingredient analyses` });
    } catch (error: any) {
      console.error('Clear cache error:', error);
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
