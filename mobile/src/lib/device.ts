import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * A random id for this install, so the app can scan before it has an account.
 *
 * WHAT THIS IS NOT: it is not a device identifier in the sense Apple means, and
 * declaring it as one on the privacy nutrition label would be wrong. It is a
 * UUID this app generates for itself on first launch. It is not derived from
 * hardware, it is not the IDFV or IDFA, it does not survive an uninstall, it is
 * never shared with anyone, and it cannot be joined to an identity — the row it
 * unlocks on the server holds a count of free scans and nothing else.
 *
 * Its only job is to stop the three free scans from being infinite. Anyone can
 * mint one; that is why the grant behind it is three, and why every route that
 * touches personal data still requires a real token.
 *
 * Kept in the keychain rather than AsyncStorage so that clearing the app's
 * caches does not silently hand out a fresh grant.
 */

const DEVICE_KEY = 'revely.deviceId';

let cached: string | null = null;

export async function getDeviceId(): Promise<string | null> {
  if (cached) return cached;
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_KEY);
    if (stored) {
      cached = stored;
      return cached;
    }
    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_KEY, fresh);
    cached = fresh;
    return cached;
  } catch {
    // The keychain refused. Mint an id for this session anyway rather than
    // returning null: without a header the server answers 401 and the app tells
    // someone to sign in during the very onboarding step designed not to ask
    // that. A session-scoped id still meters correctly on the server; it simply
    // does not survive a relaunch, which is the right way for this to degrade.
    cached = Crypto.randomUUID();
    return cached;
  }
}
