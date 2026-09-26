// Access-control checks.
//
//   npm run auth:check                          # static audit, no database
//   AUTH_CHECK_URL=https://revely-api.fly.dev npm run auth:check   # + live sweep
//
// Why this exists: two authentication holes shipped to production, and neither
// was caught by anything. `GET /api/login` signed in any anonymous caller, and
// the CORS allow-list had a line under it approving every origin, so any web
// page could read a signed-in user's history and profiles. Both were found by
// reading code — a method with no failure mode and no repeatability.
//
// The checks are deliberately static where they can be. A test that needs a
// database and two seeded users is a test that gets skipped when the database
// is unreachable, which is exactly when someone is most likely to be in a
// hurry. Reading the source proves the property on every run, offline, in
// under a second, and catches the case that actually happens: a new route
// added without the middleware.
//
// What static analysis cannot prove — that a handler passing a user id
// actually filters on it, that the deployed build behaves as the source says —
// is covered by the storage audit below and by the live sweep, which runs when
// you point it at a server.

import fs from 'fs';
import path from 'path';

interface Problem {
  severity: 'error' | 'warning';
  message: string;
}

const problems: Problem[] = [];
const root = path.resolve(import.meta.dirname, '..');

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Every route requires authentication, or is on this list
// ---------------------------------------------------------------------------

/**
 * Routes that answer unauthenticated callers, and why each one has to.
 *
 * Adding a route here is the moment to think — it is the only way to ship an
 * endpoint the whole internet can call. The check fails on any public route
 * that is not listed, so the decision cannot be made by omission.
 */
const INTENTIONALLY_PUBLIC: Record<string, string> = {
  'GET /api/healthz': 'liveness probe — must answer before auth or a session store exists',
  'GET /api/readyz': 'readiness probe',
  'POST /api/auth/mobile': 'sign-in itself; verifies an Apple/Google identity token',
  'POST /api/auth/dev-token': 'guarded separately — must be dead in production',
  'GET /api/login': 'guarded separately — must be dead in production',
  'GET /api/callback': 'redirect stub for stored OIDC URLs; reads nothing',
  'GET /api/logout': 'destroys the caller\'s own session',
  'POST /api/analytics/purchase-prompt-view': 'paywall views are counted before sign-in',
  'POST /api/crash': 'a release that dies at startup files nothing if a token is required — which is exactly the release you need to hear about; rate-limited and size-capped instead',
  'POST /api/webhooks/revenuecat': 'called by RevenueCat, which holds no user session; authenticated by a constant-time shared-secret check on the Authorization header, and refuses everything when REVENUECAT_WEBHOOK_SECRET is unset',
  'POST /api/scan-and-analyze': 'scanning works before sign-in so the app can prove itself, and so a reviewer can use it without an account — see server/anonymousAccess.ts. Guarded instead by allowAnonymousScan + requireScanQuota: a device with no free scans left is refused with 402 before any work is done',
  'GET /api/analysis-status/:requestId': 'polls a scan that may have been started anonymously. Guarded by allowAnonymousScan, and the result is released only to the namespaced owner key that started it',
  'POST /api/demo-scan': 'the example verdict at the end of onboarding, which runs before anyone has an account or an entitlement. The label is a server-held fixture, so there is no vision call, no quota spent and no user data involved; allowAnonymousScan is there only so the caller has to be one of ours',
  'GET /en': 'the marketing home page in English. Carries no user data and reads nothing',
  'GET /es': 'the marketing home page in Spanish. Same',
  'GET /zh': 'the marketing home page in Chinese. Same',
  'GET /en/guides': 'the index of the label-reading guides. A fixed page that reads nothing',
  'GET /zh/guides': 'the guide index in Chinese. Same',
  'GET /es/guides': 'the guide index in Spanish. Same',
  'GET /zh/guides/:slug': 'one guide in Chinese. Same as the English route',
  'GET /es/guides/:slug': 'one guide in Spanish. Same as the English route',
  'GET /en/guides/:slug': 'one guide. Looked up in a fixed in-memory map; an unknown slug gets the not-found page. Reads nothing',
  'GET /en/allergens': 'the index of the allergen pages. A fixed page that reads nothing',
  'GET /en/allergens/:slug': 'one allergen page. Looked up in a fixed in-memory map; an unknown slug gets the not-found page. Reads nothing',
  'GET /robots.txt': 'tells search engines what to crawl; a fixed string that reads nothing',
  'GET /sitemap.xml': 'lists the site\'s pages for search engines; a fixed string that reads nothing',
  'GET /get': 'the short link the site\'s QR code encodes. Redirects to the App Store, or an Android phone to the waitlist; reads nothing',
  'POST /api/waitlist/android': 'the Android waitlist on the marketing page. Its users have no app and so no account to sign in with. Rate-limited per address and trapped against bots; stores an email and a language, nothing else',
  'GET /': 'the marketing home page — Google\'s OAuth consent screen requires a reachable application home page before the app can be published, and it is the App Store listing\'s marketing URL. Carries no user data and reads nothing',
  'GET /privacy': 'the privacy policy — App Store Connect fetches this URL unauthenticated at every submission, and the paywall links to it before anyone has an account',
  'GET /terms': 'the terms of use — same reason; Guideline 3.1.2 requires it reachable from the purchase screen',
  'GET /health-data-privacy': 'the Washington My Health My Data Act policy — RCW 19.373.020 requires it publicly linked and distinct from the general privacy policy',
  'GET /privacy-policy': 'permanent redirect to /privacy; a legal URL that 404s is worse than a redirect',
  'GET /legal/privacy': 'permanent redirect to /privacy',
  'GET /terms-of-use': 'permanent redirect to /terms',
  'GET /legal/terms': 'permanent redirect to /terms',
};

/** Routes that must additionally be behind the admin gate. */
const ADMIN_PREFIX = '/api/admin/';

interface Route {
  method: string;
  routePath: string;
  middleware: string;
  file: string;
}

/**
 * Find route registrations and the middleware between the path and the
 * handler.
 *
 * Source parsing, not a full AST. The shape being matched is fixed and
 * checked-in — `app.get('/api/x', isAuthenticated, handler)` — and a mistake
 * here fails loudly (a route the audit cannot read is reported, not skipped)
 * rather than quietly passing something through.
 */
function findRoutes(file: string): Route[] {
  return findRoutesIn(read(file), file);
}

function findRoutesIn(source: string, file: string): Route[] {
  const routes: Route[] = [];
  const registration = /\bapp\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;

  let match: RegExpExecArray | null;
  while ((match = registration.exec(source))) {
    const [, method, routePath] = match;
    // `app.get("env")` reads Express configuration and registers nothing. A
    // route path always starts with a slash.
    if (!routePath.startsWith('/')) continue;
    // Everything from the end of the path to where the handler's parameter
    // list begins is the middleware chain.
    const rest = source.slice(match.index + match[0].length);
    const handlerStart = rest.search(/\(\s*(_?req|_?[a-z]+\s*:\s*any)/);
    const middleware = handlerStart >= 0 ? rest.slice(0, handlerStart) : '';
    routes.push({ method: method.toUpperCase(), routePath, middleware, file });
  }
  return routes;
}

/**
 * What the cors() origin callback decides for an origin that matched nothing.
 *
 * The fall-through is the whole question. The defect was an allow-list with
 * `return callback(null, true)` underneath it, so a check that merely looked
 * for a refusal *somewhere* would have passed the broken version — the
 * refusal was there, it just never ran. Only the last decision matters.
 */
function corsFallThrough(source: string): {
  fallThrough: 'true' | 'false' | undefined;
  decisions: number;
} {
  const originStart = source.indexOf('origin: (origin, callback)');
  const credentialsAt = source.indexOf('credentials:', originStart);
  if (originStart < 0 || credentialsAt < 0) return { fallThrough: undefined, decisions: 0 };

  const originFn = source.slice(originStart, credentialsAt);
  const decisions = [...originFn.matchAll(/callback\(\s*null,\s*(true|false)\s*\)/g)];
  return {
    fallThrough: decisions.at(-1)?.[1] as 'true' | 'false' | undefined,
    decisions: decisions.length,
  };
}

// ---------------------------------------------------------------------------
// 0. The detectors detect
// ---------------------------------------------------------------------------
//
// A check that cannot fail is decoration. These run the two source-reading
// detectors against samples of the code as it looked when it was broken, and
// against the code as it should look, so every run proves the check still has
// teeth. Samples rather than mutating the real files: leaving a deliberate
// hole in the working tree, even briefly, is how a deliberate hole gets
// committed.

const BROKEN_CORS = `
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED.includes(origin)) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
`;

const FIXED_CORS = `
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
`;

const UNGUARDED_ROUTE = `app.get('/api/secret', async (req: any, res) => {});`;
const GUARDED_ROUTE = `app.get('/api/secret', isAuthenticated, async (req: any, res) => {});`;

function selfTest() {
  const failures: string[] = [];

  if (corsFallThrough(BROKEN_CORS).fallThrough !== 'true') {
    failures.push('CORS detector did not flag a callback that approves every origin');
  }
  if (corsFallThrough(FIXED_CORS).fallThrough !== 'false') {
    failures.push('CORS detector misreads a correct callback as approving');
  }
  if (/\bisAuthenticated\b/.test(middlewareOf(UNGUARDED_ROUTE))) {
    failures.push('route parser found auth middleware on an unguarded route');
  }
  if (!/\bisAuthenticated\b/.test(middlewareOf(GUARDED_ROUTE))) {
    failures.push('route parser missed auth middleware on a guarded route');
  }

  if (failures.length > 0) {
    console.log('\n[AUTH] SELF-TEST FAILED — these checks cannot be trusted');
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('[AUTH] self-test ok — detectors catch the known-bad shapes');
}

/** The middleware chain of the first route registration in `source`. */
function middlewareOf(source: string): string {
  return findRoutesIn(source, '<sample>')[0]?.middleware ?? '';
}

selfTest();

const routes = [
  ...findRoutes('server/routes.ts'),
  ...findRoutes('server/localAuth.ts'),
  ...findRoutes('server/mobileAuth.ts'),
  ...findRoutes('server/index.ts'),
  ...findRoutes('server/revenueCatWebhook.ts'),
  ...findRoutes('server/legal.ts'),
  ...findRoutes('server/home.ts'),
  ...findRoutes('server/guides.ts'),
  ...findRoutes('server/allergens.ts'),
];

console.log(`\n[AUTH] ${routes.length} routes found`);

let publicCount = 0;
let protectedCount = 0;

for (const route of routes) {
  const key = `${route.method} ${route.routePath}`;
  const guarded = /\bisAuthenticated\b/.test(route.middleware);
  const listed = key in INTENTIONALLY_PUBLIC;

  if (guarded) {
    protectedCount++;
    if (listed) {
      problems.push({
        severity: 'warning',
        message: `${key} is listed as public but also requires auth — the list is stale`,
      });
    }
    continue;
  }

  if (listed) {
    publicCount++;
    continue;
  }

  problems.push({
    severity: 'error',
    message:
      `${key} (${route.file}) has no isAuthenticated and is not on the public list. ` +
      `Add the middleware, or add it to INTENTIONALLY_PUBLIC with the reason it must be open.`,
  });
}

console.log(`  ${protectedCount} require authentication`);
console.log(`  ${publicCount} intentionally public`);

// Admin routes need the second gate as well.
for (const route of routes) {
  if (!route.routePath.startsWith(ADMIN_PREFIX)) continue;
  if (!/\bisAdmin\b/.test(route.middleware)) {
    problems.push({
      severity: 'error',
      message: `${route.method} ${route.routePath} is an admin route without isAdmin`,
    });
  }
}

// A public route listed here that no longer exists means the list is drifting
// from the code, and a stale entry could silently bless a future route.
for (const key of Object.keys(INTENTIONALLY_PUBLIC)) {
  const stillExists = routes.some((r) => `${r.method} ${r.routePath}` === key);
  if (!stillExists) {
    problems.push({
      severity: 'warning',
      message: `"${key}" is on the public list but no longer exists — remove it`,
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Single-record lookups filter on the caller
// ---------------------------------------------------------------------------
//
// The bug this guards against is the classic one: GET /api/history/:scanId
// fetching by id alone, so any signed-in user can read anyone's scan by
// changing a number in the URL. The routes pass a user id down today; what has
// to stay true is that the query actually uses it.

const OWNERSHIP_SCOPED = [
  'getScanById',
  'updateScanName',
  'deleteScan',
  'getProfile',
  'updateProfile',
  'deleteProfile',
];

const storage = read('server/storage.ts');

console.log('\n[AUTH] ownership scoping in storage');
for (const method of OWNERSHIP_SCOPED) {
  const start = storage.indexOf(`async ${method}(`);
  if (start < 0) {
    problems.push({
      severity: 'warning',
      message: `storage.${method} not found — this audit is out of date`,
    });
    continue;
  }
  // The method body up to the next method declaration.
  const rest = storage.slice(start);
  const end = rest.slice(1).search(/\n {2}(?:async )?[a-zA-Z]+\(/);
  const body = end >= 0 ? rest.slice(0, end + 1) : rest;

  const takesUserId = /\buserId\s*:\s*string/.test(body.slice(0, body.indexOf(')') + 1));
  const filtersOnUserId = /eq\([a-zA-Z]+\.userId,\s*userId\)/.test(body);

  if (takesUserId && filtersOnUserId) {
    console.log(`  ok   ${method} filters on userId`);
  } else {
    problems.push({
      severity: 'error',
      message:
        `storage.${method} ${!takesUserId ? 'does not take a userId' : 'never filters on userId'}` +
        ` — a caller could reach another account's row`,
    });
  }
}

// ---------------------------------------------------------------------------
// 3. The credential-free sign-in routes are guarded
// ---------------------------------------------------------------------------
//
// Both of these hand out a session with no credentials. One of them shipped to
// production unguarded. The guard has to check two things — that this is not a
// production build, and that the flag is set — so that neither a forgotten
// flag nor a stray environment variable is enough on its own.

console.log('\n[AUTH] dev sign-in guards');
const devRoutes: { file: string; label: string }[] = [
  { file: 'server/localAuth.ts', label: 'GET /api/login' },
  { file: 'server/mobileAuth.ts', label: 'POST /api/auth/dev-token' },
];

for (const { file, label } of devRoutes) {
  const source = read(file);
  const checksProduction = /NODE_ENV\s*[!=]==?\s*["']production["']/.test(source);
  const checksFlag = /ALLOW_DEV_LOGIN/.test(source);

  if (checksProduction && checksFlag) {
    console.log(`  ok   ${label} requires non-production AND ALLOW_DEV_LOGIN`);
  } else {
    problems.push({
      severity: 'error',
      message:
        `${label} (${file}) is missing its guard ` +
        `(production check: ${checksProduction}, flag check: ${checksFlag})`,
    });
  }
}

// ---------------------------------------------------------------------------
// 4. CORS does not approve every origin
// ---------------------------------------------------------------------------
//
// The specific defect: an allow-list, and then `return callback(null, true)`
// underneath it, which made the list decorative. With credentials: true, that
// let any site on the internet read a signed-in user's data.

console.log('\n[AUTH] CORS');
const cors = corsFallThrough(read('server/index.ts'));

if (cors.decisions === 0) {
  problems.push({
    severity: 'warning',
    message: 'could not locate the cors() origin callback to audit',
  });
} else if (cors.fallThrough === 'false') {
  console.log(`  ok   unrecognised origins are refused (${cors.decisions} decision points)`);
} else {
  problems.push({
    severity: 'error',
    message:
      `the CORS origin callback ends in callback(null, ${cors.fallThrough ?? '?'}) — with ` +
      `credentials:true, approving unrecognised origins lets any website read ` +
      `signed-in users' data`,
  });
}

// ---------------------------------------------------------------------------
// 5. The Apple audience matches the shipped bundle ID
// ---------------------------------------------------------------------------
//
// Apple ID tokens carry the app's bundle ID as their audience, and
// server/mobileAuth.ts verifies against APPLE_BUNDLE_ID. If the two drift
// apart, every Apple sign-in fails — and it fails at the JWT layer, so the
// user sees a generic "sign-in failed" and the server logs nothing that names
// the cause.
//
// This is not hypothetical. The app was renamed from Auraly to Revely and the
// bundle ID moved to life.revely.app, but APPLE_BUNDLE_ID kept the old
// com.auraly.app until 2026-08-15. The rename touched code and config; the
// environment variable was neither, so nothing caught it. Since Apple Sign-In
// is currently the only working sign-in method on iOS, that mismatch would
// have locked every TestFlight tester out of the app.
//
// Read from app.json rather than hardcoded: the point is that the two stay
// equal, not that either holds a particular value.

console.log('\n[AUTH] Apple bundle ID');
const appJson = JSON.parse(read('mobile/app.json'));
const bundleId: string | undefined = appJson?.expo?.ios?.bundleIdentifier;

if (!bundleId) {
  problems.push({
    severity: 'error',
    message: 'mobile/app.json has no expo.ios.bundleIdentifier to check against',
  });
} else {
  // Prefer the real environment; fall back to .env, which is what a local run
  // and the Fly deploy are both configured from.
  let configured = process.env.APPLE_BUNDLE_ID;
  if (!configured) {
    try {
      const line = read('.env').split('\n').find((l) => l.startsWith('APPLE_BUNDLE_ID='));
      configured = line?.slice('APPLE_BUNDLE_ID='.length).replace(/^["']|["']$/g, '').trim();
    } catch {
      // No .env (CI, a fresh clone) — handled as "not set" below.
    }
  }

  if (!configured) {
    problems.push({
      severity: 'warning',
      message:
        'APPLE_BUNDLE_ID is not set here, so it could not be compared with ' +
        `mobile/app.json (${bundleId}). It must be set wherever the server runs.`,
    });
  } else if (configured === bundleId) {
    console.log(`  ok   APPLE_BUNDLE_ID matches mobile/app.json (${bundleId})`);
  } else {
    problems.push({
      severity: 'error',
      message:
        `APPLE_BUNDLE_ID is "${configured}" but mobile/app.json ships ` +
        `"${bundleId}" — every Apple sign-in will be rejected`,
    });
  }
}

// This only checks the machine it runs on. Production reads its own Fly
// secret, which no local check can see, so the live sweep cannot confirm it
// either — verify with:
//   fly ssh console -a revely-api -C "printenv APPLE_BUNDLE_ID"

// ---------------------------------------------------------------------------
// 6. Live sweep (opt-in)
// ---------------------------------------------------------------------------
//
// Proves the deployed build behaves the way the source says. Read-only: it
// sends no bodies and touches no state, so it is safe against production.

const baseUrl = process.env.AUTH_CHECK_URL;
if (baseUrl) {
  console.log(`\n[AUTH] live sweep against ${baseUrl}`);

  const expectUnauthorized = routes.filter(
    (r) => r.method === 'GET' && /\bisAuthenticated\b/.test(r.middleware) && !r.routePath.includes(':'),
  );

  for (const route of expectUnauthorized) {
    try {
      const res = await fetch(`${baseUrl}${route.routePath}`, {
        method: 'GET',
        headers: { origin: 'https://evil.example' },
      });
      if (res.status === 401) {
        console.log(`  ok   GET ${route.routePath} → 401`);
      } else {
        problems.push({
          severity: 'error',
          message: `GET ${route.routePath} answered ${res.status} to an anonymous caller, expected 401`,
        });
      }
      if (res.headers.get('access-control-allow-origin') === 'https://evil.example') {
        problems.push({
          severity: 'error',
          message: `GET ${route.routePath} returned CORS approval for an arbitrary origin`,
        });
      }
    } catch (error: any) {
      problems.push({
        severity: 'warning',
        message: `GET ${route.routePath} could not be reached: ${error.message}`,
      });
    }
  }

  // The route that shipped open. It must not exist in production.
  const login = await fetch(`${baseUrl}/api/login`, { redirect: 'manual' });
  if (login.status === 404) {
    console.log('  ok   GET /api/login → 404');
  } else {
    problems.push({
      severity: 'error',
      message: `GET /api/login answered ${login.status} in production — the credential-free sign-in is reachable`,
    });
  }
} else {
  console.log('\n[AUTH] live sweep skipped (set AUTH_CHECK_URL to run it)');
}

// ---------------------------------------------------------------------------

const errors = problems.filter((p) => p.severity === 'error');
const warnings = problems.filter((p) => p.severity === 'warning');

if (warnings.length > 0) {
  console.log('\n[AUTH] warnings');
  for (const w of warnings) console.log(`  - ${w.message}`);
}

if (errors.length > 0) {
  console.log('\n[AUTH] FAILED');
  for (const e of errors) console.log(`  ✗ ${e.message}`);
  process.exit(1);
}

console.log(
  `\n[AUTH] passed${warnings.length > 0 ? ` with ${warnings.length} warning(s)` : ''}`,
);
