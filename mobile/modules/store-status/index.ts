import { requireOptionalNativeModule } from 'expo';

/** One subscription the Apple ID on this device is entitled to right now. */
export interface ActiveSubscription {
  productId: string;
  /** Milliseconds since the epoch; 0 when StoreKit gives no expiry. */
  expiresAt: number;
  /** Shared through Family Sharing rather than bought on this Apple ID. */
  familyShared: boolean;
}

interface StoreStatusNative {
  activeSubscriptions(): Promise<ActiveSubscription[]>;
}

// Optional on purpose. Binaries from 1.0.3 and earlier do not contain the
// module, and updates published to them carry this code too, so its absence
// has to read as "cannot tell" rather than as a crash on the paywall.
const native = requireOptionalNativeModule<StoreStatusNative>('StoreStatus');

/**
 * The Apple ID's current subscriptions, or null when this binary cannot say.
 * Read-only: see StoreStatusModule.swift for why that matters here.
 */
export async function activeSubscriptions(): Promise<ActiveSubscription[] | null> {
  if (!native) return null;
  try {
    return await native.activeSubscriptions();
  } catch {
    return null;
  }
}
