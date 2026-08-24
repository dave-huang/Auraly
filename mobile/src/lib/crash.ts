import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api';

/**
 * Crash capture, with the scrubbing done before anything leaves the device.
 *
 * The app has had none of this. A JavaScript error has meant a white screen
 * and silence: the person sees the app die, and we learn nothing at all. That
 * is survivable while the testers are people you can phone, and it stops being
 * survivable the moment the App Store link is public and the device is one
 * nobody here has ever held.
 *
 * WHAT MUST NEVER LEAVE THE DEVICE
 *
 * This is a health app. It holds label photographs, ingredient lists, and
 * profiles naming somebody's allergies — which is to say, a record of a medical
 * condition attached to a named person and often a child. A crash reporter is
 * exactly the kind of component that hoovers all of it up by accident, because
 * the useful thing to send (a stack trace, the state that produced it) and the
 * unacceptable thing to send (what the user was actually looking at) arrive in
 * the same object.
 *
 * So the rule here is an ALLOW-list, not a deny-list. `buildReport` names the
 * fields that go, and nothing reaches a sink except those fields. Free text —
 * the message and the stack, which cannot be enumerated in advance — is passed
 * through `scrub` on the way out.
 *
 * WHERE REPORTS GO
 *
 * To our own API, at POST /api/crash. Not to a third-party processor, and that
 * was the deciding argument: sending crash data to Sentry or its equivalents
 * would mean declaring another recipient of health-adjacent data in the App
 * Store privacy labels, and routing profile-shaped material through a company
 * that is not us. The cost is real — no native crash capture, no symbolication,
 * no alerting, just JavaScript errors in a table you have to look at — and it
 * is the right trade for this app at this size.
 *
 * The sink is still a seam rather than a hard-coded call, so swapping in a
 * hosted service later is one function.
 */

export interface CrashReport {
  /** Scrubbed. */
  message: string;
  /** Scrubbed. Absent when the error carried none. */
  stack?: string;
  /** 'render' from the error boundary, 'global' from an uncaught error. */
  origin: 'render' | 'global' | 'promise';
  /** Route the person was on, e.g. "results". Never route PARAMS. */
  screen?: string;
  /** Whether the error killed the app rather than a subtree. */
  fatal: boolean;
  appVersion: string;
  buildVersion: string;
  platform: string;
  osVersion: string;
  /** Milliseconds since epoch. */
  at: number;
}

export type CrashSink = (report: CrashReport) => void | Promise<void>;

/**
 * Patterns that must never survive into a report.
 *
 * Ordered most specific first, because an earlier replacement changes what the
 * later ones can still see. Each one is here because this app can actually
 * produce it — none of them is hypothetical.
 */
const REDACTIONS: { pattern: RegExp; with: string }[] = [
  // A label photograph, inlined as a data URL. Megabytes of the thing we most
  // need never to send, and it appears in error messages whenever an upload
  // fails with the request body attached.
  { pattern: /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, with: '[image]' },
  // Bare base64 runs long enough to be a payload rather than an identifier.
  { pattern: /\b[A-Za-z0-9+/]{120,}={0,2}\b/g, with: '[data]' },
  { pattern: /\bBearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, with: 'Bearer [token]' },
  { pattern: /\b[\w-]+\.[\w-]{10,}\.[\w-]+\b/g, with: '[token]' },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, with: '[email]' },
  // Connection strings and anything shaped like a credential in a URL.
  { pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/]+:[^\s@]+@/gi, with: '$1://[redacted]@' },
];

/** Run free text through every redaction and cap its length. */
export function scrub(text: string | undefined): string | undefined {
  if (!text) return undefined;
  let out = text;
  for (const rule of REDACTIONS) out = out.replace(rule.pattern, rule.with);
  // A runaway message is a payload in disguise. Stacks are the long thing worth
  // keeping, and 8 KB is far more than a real one needs.
  return out.length > 8192 ? `${out.slice(0, 8192)}…[truncated]` : out;
}

let sink: CrashSink | null = null;
const recent: CrashReport[] = [];
const RECENT_LIMIT = 5;

/** Install the destination for reports. Called once, at startup. */
export function setCrashSink(next: CrashSink | null): void {
  sink = next;
}

/** The last few reports, for the error screen to offer as copyable text. */
export function recentCrashes(): CrashReport[] {
  return [...recent];
}

function buildReport(
  error: unknown,
  origin: CrashReport['origin'],
  options: { fatal?: boolean; screen?: string } = {},
): CrashReport {
  const asError = error instanceof Error ? error : new Error(String(error));
  return {
    message: scrub(asError.message) ?? 'Unknown error',
    stack: scrub(asError.stack),
    origin,
    screen: options.screen,
    fatal: options.fatal ?? false,
    appVersion: Application.nativeApplicationVersion ?? 'unknown',
    buildVersion: Application.nativeBuildVersion ?? 'unknown',
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    at: Date.now(),
  };
}

/**
 * Record a crash. Never throws, whatever the sink does.
 *
 * A reporter that can fail while reporting turns one crash into two, and the
 * second one has no handler above it.
 */
export function reportCrash(
  error: unknown,
  origin: CrashReport['origin'],
  options: { fatal?: boolean; screen?: string } = {},
): CrashReport {
  const report = buildReport(error, origin, options);

  recent.unshift(report);
  if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;

  // Logged unconditionally: in a development build this is how a developer sees
  // it at all, and in production the log is inert.
  console.error(`[CRASH:${report.origin}]`, report.message, report.stack ?? '');

  try {
    void sink?.(report);
  } catch {
    // Swallowed on purpose — see above.
  }
  return report;
}

/**
 * Catch what React cannot: errors thrown outside render, and rejected promises
 * nobody awaited.
 *
 * The error boundary only sees errors raised while React is rendering. An
 * exception in a timer, a listener, or an un-awaited fetch never touches it,
 * and those are a large share of what actually breaks an app in the field.
 */
export function installCrashHandlers(): void {
  const globalAny = globalThis as any;

  const errorUtils = globalAny.ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      reportCrash(error, 'global', { fatal: Boolean(isFatal) });
      // Chained rather than replaced: React Native's own handler is what shows
      // the redbox in development, and losing it would trade one blind spot for
      // another.
      previous?.(error, isFatal);
    });
  }

  // Hermes implements the web's unhandledrejection event.
  if (typeof globalAny.addEventListener === 'function') {
    globalAny.addEventListener('unhandledrejection', (event: any) => {
      reportCrash(event?.reason ?? 'Unhandled promise rejection', 'promise');
    });
  }
}

/**
 * The sink that ships reports to our own API.
 *
 * Fire-and-forget by design, and unauthenticated. The crashes worth hearing
 * about most are the ones before anyone signs in — a release that dies at
 * startup files nothing at all if a token is required, which is exactly the
 * release you need to hear about. The server attaches a user id when a session
 * happens to exist.
 *
 * A failure to report is swallowed. There is no retry and no queue: a crash
 * loop would turn one broken device into a write storm against the endpoint
 * that is meant to be telling you the device is broken.
 */
export function apiCrashSink(report: CrashReport): void {
  const { message, stack, origin, screen, fatal, appVersion, buildVersion, platform, osVersion, at } =
    report;
  void apiFetch('/api/crash', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      message,
      stack,
      origin,
      screen,
      fatal,
      appVersion,
      buildVersion,
      platform,
      osVersion,
      at,
    }),
  }).catch(() => {
    // Deliberately silent — see above.
  });
}
