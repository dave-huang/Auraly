// Loaded here for `npm run dev`. The production start script also passes
// `--import dotenv/config`, because the bundler splits the output into chunks
// and does not guarantee this module is evaluated before the one that reads
// DATABASE_URL at import time.
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process - keep the server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process - keep the server running
});

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Origins allowed to make credentialed requests.
//
// The final `return callback(null, true)` that used to sit at the bottom of
// this function made the allow-list above it dead code: every origin was
// approved, with credentials: true. Combined with the production cookie's
// sameSite: "none", that let any web page in the world issue authenticated
// requests as a signed-in user AND read the responses — their scan history,
// their profiles' allergens and medical conditions, or DELETE /api/account.
//
// Native apps are unaffected either way: they send a Bearer token, which no
// browser attaches automatically, so CORS was never what protected them. This
// list exists for the cookie-session web client.
const ALLOWED_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
];

// Dev servers only. In production the web bundle is served same-origin, so it
// sends no Origin header at all and never needs an entry here.
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8081",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: same-origin requests, native fetch, curl, and the
      // health checker. Not a cross-site browser request, so nothing to guard.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== "production" && DEV_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      // Deny by omission rather than by error: no CORS headers come back, the
      // browser blocks the read, and the caller gets a clean failure instead
      // of a 500 in our logs.
      return callback(null, false);
    },
    credentials: true,
  })
);

// Stripe is gone. It was the Replit-era web app's billing: a schema migration
// at boot, a signed webhook endpoint, and a checkout flow. The iOS app bills
// through Apple and RevenueCat and never called any of it, and production has
// carried no Stripe key since the move off Replit, so every path through it
// failed closed. Dead code that accepts a signed webhook and creates customer
// records is worse than dead code: it is an undisclosed processor one
// environment variable away from being live. The stripe_customer_id column
// and the purchases table are LEFT ALONE deliberately; dropping columns is a
// migration, and this was a deletion.

// Increase body size limit to handle base64-encoded images (up to 50MB)
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('Express error handler:', err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Dynamic so the production bundle never carries `import "vite"`. Vite is
    // a devDependency; a static import here would crash a production-only
    // container before it served a single request.
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serves both the API and the client on PORT.
  // Note: macOS AirPlay occupies port 5000, so local dev defaults to 3000.
  // reusePort is unsupported on macOS (ENOTSUP) and only useful for
  // multi-process deployments, so it is intentionally not set.
  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
