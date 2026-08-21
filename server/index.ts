// Loaded here for `npm run dev`. The production start script also passes
// `--import dotenv/config`, because the bundler splits the output into chunks
// and does not guarantee this module is evaluated before the one that reads
// DATABASE_URL at import time.
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, isStripeConfigured } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';

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

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  if (!isStripeConfigured()) {
    console.log('STRIPE_SECRET_KEY not set, skipping Stripe initialization (billing disabled)');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ 
      databaseUrl
    });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    // Public base URL for Stripe webhooks. Set PUBLIC_BASE_URL when deployed
    // (e.g. https://api.revely.app); unset locally, webhook setup is skipped
    // (use `stripe listen --forward-to localhost:5000/api/stripe/webhook` instead).
    const publicBaseUrl =
      process.env.PUBLIC_BASE_URL ||
      (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : undefined);
    if (!publicBaseUrl) {
      console.log('PUBLIC_BASE_URL not set, skipping webhook configuration');
    } else {
      try {
        console.log('Setting up managed webhook...');
        const webhookBaseUrl = publicBaseUrl;
        const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`,
          {
            enabled_events: ['*'],
            description: 'Revely managed webhook for Stripe sync',
          }
        );
        console.log(`Webhook configured: ${webhook.url} (UUID: ${uuid})`);
      } catch (webhookError) {
        console.error('Failed to configure webhook (non-fatal):', webhookError);
      }
    }

    console.log('Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => {
        console.log('Stripe data synced');
      })
      .catch((err: any) => {
        console.error('Error syncing Stripe data:', err);
      });
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

initStripe();

app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer.');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

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
