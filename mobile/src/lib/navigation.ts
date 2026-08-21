import { router } from 'expo-router';

/**
 * Go back, or fall back to the viewfinder.
 *
 * A bare `router.back()` is only safe when something is behind you. Reached
 * cold — via a deep link, a notification, or as the first route after a
 * reload — the stack is empty, `GO_BACK` goes unhandled, and the back control
 * silently does nothing, stranding the user on a screen with no way out.
 *
 * The camera is the app's home, so it is the right floor to land on.
 */
export function goBackOrHome(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
