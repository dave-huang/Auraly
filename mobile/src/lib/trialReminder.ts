import * as SecureStore from 'expo-secure-store';

/**
 * The Day 5 reminder.
 *
 * The paywall makes a promise in writing — "on day five we remind you the trial
 * is ending" — and this is the code that keeps it. Without it the timeline is a
 * sales line rather than a commitment, which is exactly the kind of small lie
 * that costs a health app the trust it runs on.
 *
 * It is also the cheapest refund prevention there is. The people who ask for
 * their money back are almost never the people who decided the app was not
 * worth it; they are the people who forgot they had started a trial. Apple
 * sends its own reminder, and it is easy to miss among everything else Apple
 * sends. Ours names the app and the date.
 *
 * WHY THIS IS THE RIGHT MOMENT TO ASK FOR NOTIFICATION PERMISSION
 *
 * Asked at launch, "Revely would like to send you notifications" is noise and
 * most people decline. Asked immediately after someone has started a trial, on
 * a screen that has just promised a reminder, it is the app asking for what it
 * needs to keep a promise the person has already read. A decline is fine and
 * costs nothing — the trial still ends, Apple still warns, and nothing here
 * throws.
 *
 * A local notification, never a push. No token, no server, no APNs, and nothing
 * about anyone's trial leaves the device.
 *
 * WHY expo-notifications IS IMPORTED LAZILY
 *
 * Importing it at module scope initialises the module at app launch, and that
 * initialisation reaches for PUSH: it tries to read persisted server
 * registration info and installs a remote-notification delegate. On a launch
 * that has nothing to do with notifications this produced a red error box —
 *
 *   [expo-notifications] Error reading persisted server registration info
 *   ...you still need to add "remote-notification" to UIBackgroundModes
 *
 * — for every user, over a feature the app does not have and does not want.
 * Loading it inside the two functions that actually need it means the module is
 * never touched unless somebody starts a trial, and the push machinery is never
 * woken at all.
 */

const REMINDER_KEY = 'revely.trialReminderId';

/** How long before the trial ends to fire. Two days into a seven-day trial. */
const LEAD_DAYS = 2;

/**
 * Schedule the reminder for a trial ending at `expiresAt`.
 *
 * Silent about everything. A reminder that fails to schedule must never
 * interrupt the screen someone reaches immediately after paying — that screen
 * is the single worst place in the app for an unexpected alert.
 */
export async function scheduleTrialReminder(
  expiresAt: string | Date,
  strings: { title: string; body: string },
): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    // Replace rather than stack. Re-subscribing, restoring on a new phone, or
    // simply reopening the paywall would otherwise queue a second reminder.
    await cancelTrialReminder();

    const end = new Date(expiresAt);
    const fireAt = new Date(end.getTime() - LEAD_DAYS * 86_400_000);
    // Already inside the lead window — a shorter trial, or someone restoring
    // late. Nothing useful to schedule, and a notification dated in the past
    // fires immediately, which reads as a bug.
    if (fireAt.getTime() <= Date.now()) return;

    const { status } = await Notifications.getPermissionsAsync();
    const granted =
      status === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return;

    const id = await Notifications.scheduleNotificationAsync({
      content: { title: strings.title, body: strings.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    await SecureStore.setItemAsync(REMINDER_KEY, id);
  } catch {
    // Deliberately silent — see above.
  }
}

/**
 * Cancel it.
 *
 * Called when the trial is no longer running, whichever way that happened:
 * converted to paid, cancelled, or expired. A subscriber who gets "your trial
 * ends in 2 days" a month after they started paying has been told something
 * false by an app whose entire pitch is that it tells the truth.
 */
export async function cancelTrialReminder(): Promise<void> {
  try {
    const id = await SecureStore.getItemAsync(REMINDER_KEY);
    // Checked BEFORE the import, so the common path — no reminder pending —
    // never loads the module either.
    if (!id) return;
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(id);
    await SecureStore.deleteItemAsync(REMINDER_KEY);
  } catch {
    // A reminder we cannot cancel is a wrong notification, not a crash.
  }
}
