import type { Express, RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { storage } from "./storage";

// Roll-your-own mobile auth: the app performs native Sign in with Apple /
// Google, sends the resulting identity token here, and we verify it against
// the provider's public keys (JWKS) before issuing our own bearer token.
//
// Why bearer tokens rather than the web app's session cookies: native apps
// have no cookie jar semantics worth relying on, and a signed token lets the
// API stay stateless for mobile while the web session path keeps working
// unchanged during the transition.

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const APPLE_ISSUER = "https://appleid.apple.com";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function getSigningKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set to issue mobile auth tokens");
  }
  return new TextEncoder().encode(secret);
}

export interface VerifiedIdentity {
  provider: "apple" | "google";
  providerUserId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

async function verifyAppleToken(identityToken: string): Promise<VerifiedIdentity> {
  const audience = process.env.APPLE_BUNDLE_ID;
  if (!audience) {
    throw new Error("APPLE_BUNDLE_ID is not configured");
  }
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience,
  });
  return {
    provider: "apple",
    providerUserId: payload.sub as string,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

async function verifyGoogleToken(idToken: string): Promise<VerifiedIdentity> {
  // Accept any of the configured client IDs as audience: the iOS client ID
  // signs tokens from the native SDK, the web client ID is used for the
  // server-auth flow.
  const audiences = [process.env.GOOGLE_IOS_CLIENT_ID, process.env.GOOGLE_WEB_CLIENT_ID]
    .filter((v): v is string => Boolean(v));
  if (audiences.length === 0) {
    throw new Error("No Google client IDs configured (GOOGLE_IOS_CLIENT_ID / GOOGLE_WEB_CLIENT_ID)");
  }
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience: audiences,
  });
  if (payload.email && payload.email_verified === false) {
    throw new Error("Google account email is not verified");
  }
  return {
    provider: "google",
    providerUserId: payload.sub as string,
    email: typeof payload.email === "string" ? payload.email : undefined,
    firstName: typeof payload.given_name === "string" ? payload.given_name : undefined,
    lastName: typeof payload.family_name === "string" ? payload.family_name : undefined,
  };
}

/**
 * Resolve a verified provider identity to a user row.
 *
 * Account linking is by verified email: signing in with Google and Apple using
 * the same verified address lands on one account. Apple's "Hide My Email"
 * yields a per-app relay address, which is stable for that user, so it simply
 * behaves as a distinct account — correct, if occasionally surprising.
 *
 * NOTE: user IDs are provider-prefixed for new accounts. Existing accounts
 * (Replit-era numeric IDs) are adopted by email so scan history survives.
 */
async function resolveUser(identity: VerifiedIdentity) {
  if (identity.email) {
    const existing = await storage.getUserByEmail(identity.email);
    if (existing) return existing;
  }
  const id = `${identity.provider}:${identity.providerUserId}`;
  const existingById = await storage.getUser(id);
  if (existingById) return existingById;

  return storage.upsertUser({
    id,
    email: identity.email,
    firstName: identity.firstName,
    lastName: identity.lastName,
    profileImageUrl: undefined,
  });
}

async function issueToken(userId: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("revely")
    .setAudience("revely-mobile")
    .setExpirationTime(expiresAt)
    .sign(getSigningKey());
  return { token, expiresAt };
}

/** Verify one of our own bearer tokens; returns the user id or null. */
export async function verifyBearerToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      issuer: "revely",
      audience: "revely-mobile",
    });
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export function setupMobileAuth(app: Express) {
  // POST /api/auth/mobile { provider: 'apple'|'google', identityToken, firstName?, lastName? }
  //
  // firstName/lastName are accepted from the client only for Apple, which
  // returns the user's name exactly once (on first authorization) outside the
  // identity token. They are stored only when we don't already have a name.
  app.post("/api/auth/mobile", async (req, res) => {
    try {
      const { provider, identityToken, firstName, lastName } = req.body ?? {};
      if (!identityToken || (provider !== "apple" && provider !== "google")) {
        return res.status(400).json({ message: "provider ('apple'|'google') and identityToken are required" });
      }

      const identity = provider === "apple"
        ? await verifyAppleToken(identityToken)
        : await verifyGoogleToken(identityToken);

      if (provider === "apple") {
        if (firstName && typeof firstName === "string") identity.firstName = firstName.slice(0, 60);
        if (lastName && typeof lastName === "string") identity.lastName = lastName.slice(0, 60);
      }

      const user = await resolveUser(identity);

      // Backfill a name captured on Apple's first-authorization response.
      if (!user.firstName && identity.firstName) {
        await storage.upsertUser({
          id: user.id,
          email: user.email,
          firstName: identity.firstName,
          lastName: identity.lastName ?? user.lastName,
          profileImageUrl: user.profileImageUrl,
        });
      }

      const { token, expiresAt } = await issueToken(user.id);
      console.log(`[MOBILE-AUTH] ${provider} sign-in for user ${user.id}`);
      res.json({
        token,
        expiresAt,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      });
    } catch (error: any) {
      console.error("[MOBILE-AUTH] Sign-in failed:", error.message);
      res.status(401).json({ message: "Sign-in failed" });
    }
  });

  // Development-only shortcut so the app can be exercised without Apple/Google
  // credentials configured. Never enabled in production.
  app.post("/api/auth/dev-token", async (req, res) => {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "true") {
      return res.status(404).json({ message: "Not found" });
    }
    try {
      const email = process.env.DEV_USER_EMAIL || "dev@localhost";
      const existing = await storage.getUserByEmail(email);
      const user = existing ?? await storage.upsertUser({
        id: process.env.DEV_USER_ID || "local-dev",
        email,
        firstName: "Local",
        lastName: "Dev",
        profileImageUrl: undefined,
      });
      const { token, expiresAt } = await issueToken(user.id);
      console.warn(`[MOBILE-AUTH] Issued DEV token for ${user.id} — development only`);
      res.json({ token, expiresAt, user: { id: user.id, email: user.email, firstName: user.firstName } });
    } catch (error: any) {
      console.error("[MOBILE-AUTH] Dev token failed:", error.message);
      res.status(500).json({ message: "Failed to issue dev token" });
    }
  });
}

/**
 * Populates req.user from an Authorization: Bearer token, if present and
 * valid. Runs before the session middleware's consumers so bearer and cookie
 * auth are interchangeable for every downstream route.
 */
export const bearerAuthMiddleware: RequestHandler = async (req: any, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const userId = await verifyBearerToken(header.slice(7));
  if (!userId) return next();

  const user = await storage.getUser(userId);
  if (!user) return next();

  req.user = {
    claims: {
      sub: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
    },
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    isMobile: true,
  };
  next();
};
