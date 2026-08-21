import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { setupMobileAuth, bearerAuthMiddleware } from "./mobileAuth";

// Local session-based auth that replaces the Replit OIDC flow so the app runs
// off-Replit. Exposes the same surface (setupAuth, isAuthenticated) and the
// same req.user.claims shape the routes expect.
//
// DEV ONLY: /api/login signs everyone in as a single configurable local user
// (DEV_USER_ID / DEV_USER_EMAIL). Replace with a real auth provider
// (Sign in with Apple / Clerk / Supabase) before any public deployment.

const DEV_USER = {
  id: process.env.DEV_USER_ID || "local-dev",
  email: process.env.DEV_USER_EMAIL || "dev@localhost",
  firstName: process.env.DEV_USER_FIRST_NAME || "Local",
  lastName: process.env.DEV_USER_LAST_NAME || "Dev",
};

declare module "express-session" {
  interface SessionData {
    localUser?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const isProduction = process.env.NODE_ENV === "production";
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Secure/none is required for the Capacitor webview origin in prod;
      // lax/insecure is required for plain-http localhost dev.
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: sessionTtl,
    },
  });
}

function toClaims(user: NonNullable<session.SessionData["localUser"]>) {
  return {
    sub: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    profile_image_url: undefined as string | undefined,
  };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Mobile clients authenticate with a Bearer token instead of a cookie.
  // Registered before the session reader so either mechanism populates
  // req.user identically for all downstream routes.
  setupMobileAuth(app);
  app.use(bearerAuthMiddleware);

  // Populate req.user from the session on every request so routes that read
  // req.user?.claims optionally (without isAuthenticated) keep working.
  app.use((req: any, _res, next) => {
    if (req.user) return next(); // already authenticated via bearer token
    if (req.session?.localUser) {
      req.user = {
        claims: toClaims(req.session.localUser),
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };
    }
    next();
  });

  // The dev sign-in shortcut.
  //
  // This route signs the caller in with no credentials whatsoever. It shipped
  // to production unguarded, where it handed any anonymous request on the
  // internet a valid session — /api/auth/user, /api/history and /api/profiles
  // all answered 200 to a caller who supplied nothing. On an app holding
  // allergies, medical conditions and pregnancy status, that is the worst
  // failure available.
  //
  // The mobile equivalent (POST /api/auth/dev-token) was written with exactly
  // this guard from the start; this one was simply never given it. Both
  // conditions are required, and production wins even if the flag is set — a
  // stray environment variable must not be able to reopen this.
  const devLoginEnabled =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LOGIN === "true") {
    console.error(
      "[AUTH] ALLOW_DEV_LOGIN=true is set in production and is being IGNORED. " +
        "Unset it — the credential-free sign-in route stays disabled regardless.",
    );
  }
  if (devLoginEnabled) {
    console.warn("[AUTH] DEV LOGIN ENABLED — /api/login signs in with no credentials.");
  }

  app.get("/api/login", async (req: any, res) => {
    if (!devLoginEnabled) {
      return res.status(404).json({ message: "Not found" });
    }
    try {
      // Adopt an existing account with this email (e.g. the user's original
      // Replit-era account and its scan history) instead of creating a
      // duplicate; only create the dev user if the email is unknown.
      const existing = await storage.getUserByEmail(DEV_USER.email);
      const sessionUser = existing
        ? {
            id: existing.id,
            email: existing.email ?? DEV_USER.email,
            firstName: existing.firstName ?? DEV_USER.firstName,
            lastName: existing.lastName ?? DEV_USER.lastName,
          }
        : DEV_USER;
      if (!existing) {
        await storage.upsertUser({
          id: DEV_USER.id,
          email: DEV_USER.email,
          firstName: DEV_USER.firstName,
          lastName: DEV_USER.lastName,
          profileImageUrl: undefined,
        });
      }
      req.session.localUser = sessionUser;
      req.session.save((err: any) => {
        if (err) {
          console.error("Failed to save session:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Login failed:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Kept for compatibility with any stored OIDC redirect URLs.
  app.get("/api/callback", (_req, res) => res.redirect("/"));

  app.get("/api/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // req.user is set by either the bearer-token middleware (mobile) or the
  // session reader (web).
  if (req.user?.claims?.sub) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
