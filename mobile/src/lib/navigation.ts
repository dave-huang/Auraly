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

/**
 * Into the app, at the camera, with nothing left on top of it.
 *
 * WHY THIS IS NOT `router.replace('/')`.
 *
 * The camera is the app's home and the stack's floor — except on the path
 * everybody actually takes. A signed-out cold start lands on the camera, which
 * immediately redirects to welcome, and a redirect REPLACES: the camera is
 * gone from the stack and welcome is now the floor. Onboarding then builds on
 * top of that, and the subscription screen ends the flow standing on welcome.
 *
 * `replace('/')` at that point does not return to the camera, because there is
 * no camera to return to. It pushes a second one on top of the flow that led
 * here — visibly so, since it inherits the screen it replaced. That is the
 * "camera as an overlay" report, and the pile-up that follows is the same bug
 * compounding: every scan pushed a verdict and replaced it with yet another
 * camera, so the stack grew by one screen per scan and a back swipe walked
 * down through every scan of the session.
 *
 * Two calls, one flush of the routing queue, and they compose:
 *
 *   dismissAll  drops everything back to the stack's floor. On the healthy
 *               path — camera, then a verdict over it — this is the whole job,
 *               and it lands on the camera that is ALREADY THERE rather than
 *               building a new one, so the viewfinder is not torn down and
 *               restarted between scans.
 *
 *   dismissTo   makes that floor the camera. If it already is, this is a
 *               no-op; if the floor is welcome, it takes welcome's place. Either
 *               way the stack ends as exactly one screen, which is what
 *               "you are in the app now" should mean.
 *
 * The guard is not defensive coding: dismissing a single-screen stack is an
 * unhandled action, and an unhandled action is a console warning in dev.
 */
export function goHome(): void {
  if (router.canDismiss()) router.dismissAll();
  router.dismissTo('/');
}
