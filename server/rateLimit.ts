import type { RequestHandler } from "express";

// A small fixed-window rate limiter for the handful of endpoints that answer
// unauthenticated callers.
//
// In-memory and per-process on purpose. A shared store (Redis) would be the
// right answer for a fleet, but this runs as one machine, and the thing being
// prevented is an anonymous caller hammering an endpoint — not a distributed
// attack that a single counter would miss anyway. It costs no dependency and
// no network hop, and it can be swapped later without touching call sites.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Bounded so a stream of unique IPs cannot grow this map without limit; the
// sweep is cheap because expired entries are the common case.
const MAX_TRACKED_KEYS = 50_000;

function sweep(now: number) {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(options: {
  windowMs: number;
  max: number;
  name: string;
}): RequestHandler {
  const { windowMs, max, name } = options;

  return (req, res, next) => {
    const now = Date.now();
    // req.ip is only trustworthy because index.ts sets trust proxy — behind
    // Fly's proxy the socket address is the proxy, identical for every caller.
    const key = `${name}:${req.ip ?? "unknown"}`;
    const window = buckets.get(key);

    if (!window || window.resetAt <= now) {
      if (buckets.size >= MAX_TRACKED_KEYS) sweep(now);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    window.count++;
    if (window.count > max) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        message: "Too many requests. Please try again shortly.",
        retryAfter,
      });
    }

    next();
  };
}
