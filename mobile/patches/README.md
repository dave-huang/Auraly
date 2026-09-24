# Patches to dependencies

Applied by `patch-package` on every `npm install` (the `postinstall` script),
so they survive a clean install, EAS Build and a local archive alike. If a
dependency is upgraded and its patch no longer applies, the install fails
loudly. That is deliberate: re-make the patch against the new version rather
than deleting it.

## expo-camera: close-up focus (macro)

Before this patch, labels went blurry when the phone came close. The main
(wide) lens on Pro iPhones cannot focus nearer than roughly 15 to 20 cm, and
expo-camera always opens that single lens. The system Camera app avoids the
problem with a virtual camera: when the subject is too close, iOS switches to
the ultra-wide and crops it to the same framing, which is Apple's "macro".

The patch makes expo-camera do the same:

- `DeviceDiscovery.defaultBackCamera` prefers the triple camera, then the dual
  wide camera, before falling back to the single wide lens. Phones without an
  ultra-wide (SE, the "e" models, Air) are unchanged.
- `CameraSessionManager.updateZoom` treats zoom 0 as the wide lens (the first
  switch-over factor, the Camera app's "1x") rather than a factor of 1.0, which
  on these virtual cameras is the 0.5x ultra-wide. It also states `.auto`
  constituent switching, the mode that performs the macro swap.
- The zoom is re-applied whenever the device's active format changes, and once
  more after the session starts. iOS resets `videoZoomFactor` to 1.0 on every
  format change, and setting the photo preset after the device is added is one.
  Build 35 shipped without this and opened zoomed out at 0.5x: the zoom was
  set correctly, then undone a moment later by the preset.

expo-camera exposes neither choice to JavaScript: `selectedLens` matches
localized device names, and its `zoom` prop is a fraction of a maximum that
differs per device, so the Camera app's 1x cannot be reached from JS.
