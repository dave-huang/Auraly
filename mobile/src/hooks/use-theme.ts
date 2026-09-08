/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';

/**
 * Pinned to light, along with the rest of the app.
 *
 * This is what ThemedText falls back to when a call site passes no colour of
 * its own, and almost every one of them does pass a colour. The handful that
 * do not were the reason to pin it rather than leave it: `Colors.dark.text` is
 * white, and white on the cream ground would be invisible text.
 *
 * The design system's own switch is `useSurface` in constants/design.ts, and it
 * is pinned in the same way. Both go back together, or neither.
 */
export function useTheme() {
  return Colors.light;
}
