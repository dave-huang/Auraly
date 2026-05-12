# Auraly iOS App — Setup Guide

This project has been wrapped with **Capacitor** to deploy Auraly as a native iOS app. The web app codebase is fully reused — the iOS app loads the same React frontend inside a native iOS shell.

## What's been set up for you

- Capacitor 8 installed with the iOS platform
- `capacitor.config.ts` configured (bundle ID: `com.auraly.app`, app name: `Auraly`)
- Native plugins installed: `@capacitor/camera`, `@capacitor/preferences`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/app`, `@capacitor/browser`
- iOS Xcode project scaffolded under `ios/`
- Backend CORS enabled with credentials support so the native app can call the API
- Session cookies updated to `sameSite: 'none'` for cross-origin auth from the native app
- Frontend API client (`client/src/lib/queryClient.ts`) automatically uses the absolute backend URL when running natively, and relative URLs when running on the web — see `client/src/lib/platform.ts`

## What you'll need

1. **A Mac with Xcode** (latest version recommended)
2. **CocoaPods** — install with `sudo gem install cocoapods` or via Homebrew: `brew install cocoapods`
3. **An Apple Developer account** ($99/year) to ship to TestFlight or the App Store
4. **Node.js** matching this project's version

## First-time setup on your Mac

After cloning the project to your Mac:

```bash
npm install
npm run build
npx cap sync ios
cd ios/App
pod install
cd ../..
npx cap open ios
```

That last command launches Xcode. From there you can run the app in the simulator or on a device.

## The development loop

Every time you change the web code:

```bash
npm run build         # Rebuild the web bundle
npx cap sync ios      # Copy the bundle into the iOS project
```

Then re-run from Xcode.

## Configuration you should review

### Backend URL

The iOS app calls `https://auraly.replit.app` by default. To change this, set a build-time env var before `npm run build`:

```bash
VITE_API_BASE_URL=https://your-domain.com npm run build
```

Or override permanently in `client/src/lib/platform.ts`.

### Bundle identifier

Set to `com.auraly.app`. To change it, edit `capacitor.config.ts` and the `PRODUCT_BUNDLE_IDENTIFIER` in `ios/App/App.xcodeproj/project.pbxproj`.

### App icon and splash screen

Replace the assets under `ios/App/App/Assets.xcassets/AppIcon.appiconset/` and `ios/App/App/Assets.xcassets/Splash.imageset/` with your branded images. Apple requires multiple sizes — easiest path is to use a tool like [appicon.co](https://appicon.co) to generate the full set from a single 1024×1024 image.

## Known follow-ups before App Store submission

These are not configured yet because they each have meaningful product decisions and external setup attached:

### 1. Replace Stripe with Apple In-App Purchase

Apple requires digital goods (your scan bundles) to be sold via IAP. The web app can keep using Stripe, but the iOS app needs IAP. Recommended plugin: [`@capgo/capacitor-purchases`](https://github.com/Cap-go/capacitor-purchases) or [RevenueCat's Capacitor SDK](https://www.revenuecat.com/docs/getting-started/installation/capacitor) (RevenueCat is more popular and handles receipt validation for you).

You'll need to:
- Create the scan bundle product in App Store Connect
- Add a backend endpoint to validate the App Store receipt and grant scans
- Detect platform in the frontend and route iOS users to IAP, web users to Stripe

### 2. Switch to Google + Sign in with Apple

The current Replit OIDC login won't work cleanly inside a native app (it relies on cookies and a browser redirect). For iOS specifically, Apple requires "Sign in with Apple" if you offer any other social login. Plan to switch the auth setup to Google + Apple before shipping.

### 3. Native camera

The web `getUserMedia` API works inside Capacitor's WKWebView, so the existing `ImageUploader` component should function without changes. For a more native feel (better focus, faster capture), swap it for `@capacitor/camera` when running on iOS — `getPlatform()` from `client/src/lib/platform.ts` tells you when.

### 4. Privacy disclosures

In `ios/App/App/Info.plist`, add usage descriptions for any permissions the app uses:

```xml
<key>NSCameraUsageDescription</key>
<string>Auraly uses your camera to scan product ingredient labels.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Auraly uses your photo library to scan ingredient label photos you've already taken.</string>
```

### 5. App Store Connect listing

Screenshots (multiple device sizes), app description, keywords, privacy policy URL, support URL, age rating, and the App Privacy data disclosures all need to be filled in inside App Store Connect.

## Troubleshooting

**"Pod install fails on Mac"** — make sure CocoaPods is installed and you're running `pod install` from `ios/App`, not the project root.

**"Network requests fail in the simulator"** — check that `VITE_API_BASE_URL` was set correctly at build time and that your backend's CORS allows the request. Also confirm the backend is publicly reachable (the simulator can't see `localhost` on your dev machine the same way the browser can).

**"Auth doesn't work in the iOS app"** — this is expected with the current Replit OIDC flow. See follow-up #2 above.
