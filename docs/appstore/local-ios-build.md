# Building and shipping iOS from this Mac, without EAS Build

Used for the first time on 1.0.1, build 33, on 19 September 2026. That build
was approved and released on 20 September, so the process below is proven end
to end: archived here, uploaded through EAS Submit, and on the App Store.

The EAS free plan gives 15 iOS builds a year, and ours ran out. The counter
resets on 1 October 2026. Until then every release is archived here in Xcode
instead. Only the build moves: the upload still goes through EAS Submit, which
holds the App Store Connect API key, so no Apple password is typed anywhere in
this process.

The whole thing takes about 25 minutes, most of it compiling.

No em dashes anywhere in this file.

## Before the first local build, once

These four are already done on this Mac. They are written down because each one
fails in a way that does not say what is wrong, and because a new Mac needs all
four again.

**Sign in to Xcode and create a distribution certificate.** Xcode, Settings,
Accounts, add the Apple ID, then Manage Certificates and add an Apple
Distribution certificate. The private key lives in the login keychain and never
leaves this Mac. Do not revoke the EAS certificate to make room: EAS still owns
its own, and revoking it breaks every EAS build. Apple allows two distribution
certificates per account, which is exactly enough.

**Install the WWDR G3 intermediate certificate.** A certificate issued today is
signed by Apple Worldwide Developer Relations Certification Authority G3, and a
Mac that has only the old intermediate, which expired in February 2023, cannot
build the chain. Signing then fails with `unable to build chain to self-signed
root` and `errSecInternalComponent`, and `security find-identity -v` silently
omits the identity, which makes it look as though the certificate was never
created. Download `AppleWWDRCAG3.cer` from
https://www.apple.com/certificateauthority/ and add it to the **login**
keychain, not System and not iCloud.

Both certificates are healthy when this lists two valid identities:

    security find-identity -v -p codesigning

**Register one device with the team.** This is the surprising one. Archiving
with automatic signing signs the intermediate archive with a *development*
profile before the export re-signs it for the App Store, and Apple will not
issue a development profile to a team with no registered devices. Every earlier
build ran on EAS with distribution credentials only, so the team had none, and
the archive died at GatherProvisioningInputs with "Your team has no devices from
which to generate a provisioning profile" and "No profiles for 'life.revely.app'
were found".

Connect the iPhone by cable, unlock it, trust the Mac, wait for it in Xcode
under Window, Devices and Simulators, then open the Revely target, Signing and
Capabilities, and click Register Device if it offers. Developer Mode on the
phone is not needed, because nothing is being installed on it. The phone can be
unplugged immediately afterwards and is not needed again until the development
profile expires, about a year later.

**Know that the IPA is still a real distribution build.** The development
profile exists only inside the archive. The exported IPA is signed by Apple
Distribution: Dozy Labs LLC and carries the App Store profile, with no devices
in it.

## Every release

### 1. Set the version and the build number

`mobile/app.json` has to carry both, because a local build reads them from there
rather than from EAS, which is where `autoIncrement` normally does this:

    "version": "1.0.1",
    "ios": { "buildNumber": "33" }

The build number must be higher than anything App Store Connect has already
accepted for this version string. Check the remote counter first so the two do
not drift apart:

    cd mobile && npx eas-cli build:version:get --platform ios

### 2. Regenerate the native project

`mobile/ios` is not in git. It is generated, so anything changed by hand inside
it is lost here, with the single exception of signing settings, which live per
machine in Xcode rather than in the project file.

    cd mobile
    npx expo prebuild -p ios --clean
    export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
    cd ios && pod install

The locale exports are not decoration. On Ruby 4.0 CocoaPods otherwise stops
with `Unicode Normalization not appropriate for ASCII-8BIT`.

### 2b. Check the update channel is in the binary

Build 33 shipped without one, and the consequence was silent: two updates were
published, the dashboard showed them live, and no phone could ever have
received them. A build asks for updates by channel name, and that name is
compiled in. EAS Build injects it from the `channel` field in `eas.json`, and a
local build never runs that step, so it is set in `app.json` instead:

    "updates": {
      "url": "https://u.expo.dev/d6bfe56f-09a6-4bbf-a26f-a7198a47027d",
      "requestHeaders": { "expo-channel-name": "production" }
    }

Prebuild writes that into the plist. Confirm it before going any further,
because nothing later fails when it is missing:

    plutil -p ios/Revely/Supporting/Expo.plist

`EXUpdatesRequestHeaders` must be there with `expo-channel-name => production`.
If it is not, the archive will build, sign, upload and pass review, and then
ignore every update ever published to it.

The channel also has to exist on the server, pointing at the branch updates are
published to. It does now, and `npx eas-cli channel:view production` says so;
`npx eas-cli channel:create production` is what created it.

UNRESOLVED: whether EAS Build overrides `requestHeaders` with the build
profile's own channel when the quota returns in October. The documentation does
not say. Check the plist of the first EAS build rather than assuming, and write
the answer down here.

### 3. Export the app's environment variables

Anything named `EXPO_PUBLIC_*` is inlined into the JavaScript bundle while it is
built, so these have to be in the shell before the archive starts. EAS reads
them from `eas.json`, and so should we, rather than retyping them and risking a
build that points at localhost:

    cd mobile
    eval "$(python3 -c "import json,shlex;e=json.load(open('eas.json'))['build']['production']['env'];print('\n'.join(f'export {k}={shlex.quote(v)}' for k,v in e.items()))")"

That covers the API URL, the RevenueCat public key and the two Google client
IDs. None of them are secrets. The RevenueCat secret key and the Google web
client secret must never appear in `eas.json` or anywhere else in this repo.

### 4. Archive and export

From `mobile/ios`, with the locale and the `EXPO_PUBLIC_*` variables still
exported, and `OUT` pointing anywhere outside the repository:

    OUT=~/revely-builds/1.0.1-33
    mkdir -p "$OUT"

    xcodebuild -workspace Revely.xcworkspace -scheme Revely \
      -configuration Release -destination "generic/platform=iOS" \
      -derivedDataPath "$OUT/dd" -archivePath "$OUT/Revely.xcarchive" \
      -allowProvisioningUpdates DEVELOPMENT_TEAM=H6R2W747LZ \
      CODE_SIGN_STYLE=Automatic archive

    xcodebuild -exportArchive -archivePath "$OUT/Revely.xcarchive" \
      -exportPath "$OUT/export" -allowProvisioningUpdates \
      -exportOptionsPlist ../../docs/appstore/ExportOptions.plist

Compiling takes roughly ten minutes. Partway through, macOS asks for permission
to use the Apple Distribution key: that prompt wants the Mac login password, and
the answer is Always Allow, because plain Allow asks again for every file being
signed.

`ExportOptions.plist` is committed next to this file. It asks for
`app-store-connect`, team H6R2W747LZ, automatic signing and symbol upload.

### 5. Check the IPA before it goes anywhere

Four things are worth confirming, and all four have been wrong at some point:

    cd "$OUT" && mkdir -p chk && cd chk && unzip -q ../export/Revely.ipa
    A=$(ls -d Payload/*.app)
    plutil -extract CFBundleShortVersionString raw $A/Info.plist
    plutil -extract CFBundleVersion raw $A/Info.plist
    codesign -dvv $A 2>&1 | grep -E "Authority|TeamIdentifier"
    security cms -D -i $A/embedded.mobileprovision | plutil -extract Name raw -
    plutil -extract EXUpdatesRuntimeVersion raw $A/Expo.plist
    codesign --verify --deep --strict $A && echo VERIFY_OK

Expected: the version and build from step 1, `Apple Distribution: Dozy Labs LLC
(H6R2W747LZ)` with `TeamIdentifier=H6R2W747LZ`, a Team Store provisioning
profile, a runtime version equal to the app version, and VERIFY_OK.

Do not try to confirm a URL by grepping the bundle. Hermes packs and overlaps
its string table, so a URL assembled from a template literal never appears
contiguously, and a known-good URL comes back with zero hits too.

### 6. Upload

EAS Submit accepts a local file, and uses the App Store Connect API key it
already stores, so there is no password and no two-factor prompt:

    cd mobile
    npx eas-cli submit -p ios --path "$OUT/export/Revely.ipa"

On the free plan this queues for a submitter, which took about fifteen minutes
on 19 September. Apple then processes the build for another ten to thirty
minutes before it appears under the version's Build section and in TestFlight.

### 7. Keep the artifacts

The build ran in a scratch directory that gets cleared. Copy the IPA and the
xcarchive to `~/revely-builds/<version>-<build>/`, which is outside the working
tree on purpose, in the same spirit as `~/revely-backups`. The xcarchive holds
the dSYMs, which are the only way to read a crash report from that build later.

## Publishing an over-the-air update

Proven on 1.0.2 build 34, on 22 September 2026: the ingredient checklist was
published as an update and appeared on a real phone on the second launch.
Build 33 could never have received one (see step 2b).

An update can only change JavaScript and assets. Anything native (a new
package with native code, a permission, an app.json change prebuild acts on)
needs a new build and a new version number instead, because the runtime
version is the app version and an update never crosses it.

**Export the same settings the build used, every time.** This is the trap.
`eas update` does not read the `env` block in `eas.json`, there is no
`mobile/.env`, and the production environment on EAS holds no variables.
Published from a bare shell, the bundle has no server address, and
`config.ts` deliberately throws on launch when it is missing, so every phone
on that version would crash on open until the update was replaced. Export
exactly as in step 3:

    cd mobile
    eval "$(python3 -c "import json,shlex;e=json.load(open('eas.json'))['build']['production']['env'];print('\n'.join(f'export {k}={shlex.quote(v)}' for k,v in e.items()))")"

Then publish. `--environment` is required in non-interactive mode; it finds
nothing on EAS and leaves the exported variables in place:

    npx eas-cli update --channel production --platform ios \
      --environment production --message "..." --non-interactive

**Check the bundle that was uploaded.** It is left in `mobile/dist`
(gitignored). Unlike the step 5 warning about URLs built from template
literals, these are plain inlined strings and do survive into the bytecode:

    H=$(ls dist/_expo/static/js/ios/*.hbc)
    strings -n 8 $H | grep -c revely-api.fly.dev                  # 1
    strings -n 8 $H | grep -c "must be set for production builds" # 0

The second line reads 0 because the throwing branch is compiled out once the
address is defined. If it reads 1, the address is missing: publish again
with the variables exported, straight away.

**How a phone picks it up.** The app checks on launch and downloads in the
background, then runs the new bundle on the NEXT launch. Open, wait a few
seconds, close fully, open again.

**Publishing to a version that is not the one in `app.json`.** The update's
runtime version is read from `version` in `app.json` at publish time. Once the
next release has been bumped there (1.0.3 while 1.0.2 is the one on the App
Store), a plain publish targets 1.0.3 and not one phone on 1.0.2 receives it,
with nothing in the output to say so. First done on 24 September 2026. Set
the version back for the publish only, check the output says the runtime you
meant, and restore it:

    sed -i '' 's/"version": "1.0.3"/"version": "1.0.2"/' app.json
    npx eas-cli update --channel production --platform ios \
      --environment production --message "..." --non-interactive
    git checkout app.json

This is only safe when every change since that binary is JavaScript. A change
to native code, including a patch under `mobile/patches/`, is not in the old
binary, and JavaScript that expects it would call into nothing.

## What still has to happen in App Store Connect

Attaching the build, updating the App Review notes and submitting are covered in
[review-reply.md](review-reply.md), including the part that cost two days: a
reply to App Review does not restart the review, and a rejected version needs
Update Review and then Resubmit.
