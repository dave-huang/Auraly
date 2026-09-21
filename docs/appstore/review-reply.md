# Reply to App Review, Guideline 2.1, build 32

Apple has not found a bug. This is the standard information request sent to a
developer account with no review history, and every item on it is answered with
words and one video. Nothing in the app has to change.

Prices are taken from App Store Connect, not invented here: $39.99 a year with
one week free, and $7.99 a month with no introductory offer. Both are confirmed
against the subscription records, and the monthly plan genuinely has no
introductory offer configured, which is what the app already tells people.

STATUS, 20 SEPTEMBER 2026: CLOSED. The reply went on 10 September with the
recording attached, the submission was resubmitted on 11 September at 3:18 PM,
and 1.0 was approved. Version 1.0.1 followed with build 33, submitted on
19 September and approved and released on 20 September.

This file is kept as the record of what was answered, because the next
information request will ask the same seven things and the answers are still
the answers. Part 2 is the wording to start the next version's notes from.

## After replying, you still have to resubmit

This is the step that cost two days, and it is the one to remember next time.

Replying in the message thread does not put a rejected version back in front of
a reviewer. That holds even for a Guideline 2.1 information request like this
one, where there is nothing in the app to change. The version stays Rejected,
the submission stays at Unresolved Issues, and no reviewer is holding it. Apple
says as much: you can correspond "until you resubmit to App Review", so the
reply goes alongside a resubmission, never instead of one.

The sequence, from Apple's page on managing a submission with unresolved
issues:

1. Open the submission and click Edit beside the rejected app version. It opens
   the version page.
2. Click Update Review. Apple's documentation calls this Add for Review; in this
   interface it is labelled Update Review because the version already belongs
   to the submission. The button reads Processing, then returns you to the
   submission, where the version now reads Ready for Review and the red banner
   is gone.
3. Click Resubmit to App Review. The submission and every item in it change to
   Waiting for Review.

A GREYED-OUT RESUBMIT BUTTON MEANS STEP 2 HAS NOT HAPPENED. It does not mean
Apple has the submission. That misreading is exactly what happened here: the
disabled button was taken as a sign the ball was in Apple's court, and the
reply sat on a closed submission for two days while nobody read it.

Two practical notes. Apple allows one edit per item before resubmission, so
finish the notes and attachments before clicking Update Review. And confirm the
state after every click rather than trusting it: the first Update Review click
here did nothing at all, with no dialog and no error, and only the second one
went through.

Apple's pages:
https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/manage-a-submission-with-unresolved-issues
https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/reply-to-app-review-messages

The in-app purchases are fine. Submission 04f73c64 contains four items: both
subscriptions, the subscription group, and the app version. The subscriptions
read "Ready for Review" rather than "In Review" only because the app version
was rejected, and App Store Connect will not review the rest of a submission
once one item fails. The 3.1.1 line in Apple's message is boilerplate that
ships with every 2.1 letter, not a finding against this submission.

There is no demo account to hand over, and there must not be one. Revely has no
passwords: it authenticates only through Sign in with Apple and Google Sign-In.
The switch that would allow a password-free test login, ALLOW_DEV_LOGIN, is off
in production and has to stay off, because turning it on would open
credential-free sign-in to everyone, not only to Apple. The reply below says
this plainly in its first paragraph, which is where a reviewer looks.

---

## Part 1. The Resolution Center reply

SENT ON 10 SEPTEMBER 2026 on submission 04f73c64, with the recording attached as
"Revely Demo Video.MP4". The text below is what went, with the video placeholder
replaced by "attached here".

The reply box holds 4,000 characters, which is why this is terser than it
would otherwise be: the first draft ran to 8,389 and had to come down by more
than half. App Store Connect counts a line break as one character, and this
text left 48 characters spare. Anything added here has to displace something.
The fuller wording lives in Part 2, which Apple also asked for and which has
its own 4,000 character field.

Thank you for the list. All seven answers follow, and are now also in the App Review Information notes.

SIGNING IN. Revely has no username or password, so there are no demo credentials: it uses only Sign in with Apple and Google Sign-In. Please sign in with Apple, with your own Apple Account or a sandbox account. The button is on the first screen and again when a purchase begins.

1. RECORDING. On a physical iPhone, current iOS, attached here. From launch it shows onboarding, sign-in, the subscription screen with both plans and prices, a purchase, a live scan, the result, history and account deletion.

2. PURPOSE AND AUDIENCE. Revely reads the ingredient list on packaged food and explains it. The problem: ingredient lists are unreadable in practice, in small print, often another language, and written in synonyms that hide allergens.

You tell Revely once what you would rather not eat: allergies, a condition, a diet, additives. Point the camera at any ingredient list and it transcribes, translates and explains each ingredient, then checks the list against your profile. The verdict names the ingredient found, where it sits in the list, quotes the published finding, and names who published it.

For people with food allergies or intolerances, anyone managing a condition or diet, carers shopping for others, and travellers facing unfamiliar labels. Not directed at children.

3. SETUP. 1) Get started. 2) Onboarding asks who the profile is for: choose Myself; one allergy, say peanuts, is enough. 3) An example scan runs, then two trial screens. 4) Choose a plan on the subscription screen and tap the button. 5) Sign in with Apple; the purchase sheet follows and completes free in the sandbox. 6) The camera opens.

Point the camera at an ingredient list; a product containing the allergy from step 2 is clearest. With none to hand, tap "Choose a photo instead" below the shutter and pick any saved label photo. History, Profiles, Subscription and Account are in the camera menu; deletion is Account, then Delete account.

4. EXTERNAL SERVICES. OpenAI reads the label and analyses ingredients, via the business API, which does not train on the data. Apple and Google verify sign-in tokens only. Apple In-App Purchase handles all billing. RevenueCat carries subscription status. Neon hosts the database, Fly.io the servers. The same list is at https://revely.life/privacy.

Ingredient findings are quoted from the FDA, EFSA, the IARC, the EU CosIng annexes and California Proposition 65. A label photo is used for that one scan and not retained.

5. REGIONS. Identical everywhere: no geographic gating, no region-specific content. The interface follows the device locale in English, Spanish or Simplified Chinese; prices are Apple's local equivalents of our tier; findings are not filtered by country.

6. REGULATION AND THIRD-PARTY MATERIAL. Revely provides ingredient information only. It is not a medical device, does not diagnose or treat any condition, and is not a substitute for professional medical advice; that appears on every result screen and in our Terms of Use. The regulatory sources in item 4 are public documents, quoted with attribution and needing no licence. We claim no endorsement and show none of their logos. Health data customers enter is covered by https://revely.life/health-privacy.

7. IN-APP PURCHASE. One auto-renewing subscription in two durations, no free tier, no consumables. It unlocks unlimited scans, profiles for others, history and the sources behind each verdict.

revely.annual, $39.99 per year, after a 7-day free trial
revely.monthly, $7.99 per month, billed immediately

The screen appears at the end of onboarding (step 4) and afterwards from the camera menu under Subscribe. Both show each plan's title, duration and price from StoreKit in local currency and say when money moves. Restore Purchases, Terms of Use and Privacy Policy sit under the plans.

Questions to hello@dozylabs.net.

---

## Part 2. The App Review Information notes

SAVED IN APP STORE CONNECT ON 9 SEPTEMBER 2026 and later superseded. Before
resubmitting, the Notes field was replaced with the Part 1 reply text itself,
prefixed "In response to your App Review message:", 3,991 of the 4,000
characters, and the recording was also attached to the version's own
Attachment field. The text below is kept because it is the fuller wording, and
because it is the better starting point for the next version's notes.

Keep this and Part 1 in agreement: if one changes, change both.

    HOW TO SIGN IN

    Revely has no passwords, so there are no demo credentials to supply. It
    authenticates only through Sign in with Apple and Google Sign-In. Please
    sign in with Apple, using your own Apple Account or a sandbox account. The
    button is on the first screen and again when a purchase begins.

    WHAT THE APP DOES

    Revely reads the ingredient list on packaged food from a photo, translates
    it if needed, explains each ingredient, and checks the list against a
    profile of allergies, conditions, diets and additives the customer sets up
    once. Verdicts quote published findings and name the source. For people
    with food allergies or intolerances, people managing a condition or a diet,
    carers shopping for someone else, and anyone facing a label in a language
    they do not read. General audience, not directed at children.

    GETTING THROUGH THE APP

    1. Tap Get started. Onboarding asks who the profile is for: choose Myself.
       One allergy, for example peanuts, is enough.
    2. An example scan runs, then two short trial screens.
    3. On the subscription screen, choose a plan and tap the button.
    4. Sign in with Apple in the sheet. Apple's purchase sheet follows on its
       own and completes at no charge in the sandbox.
    5. The camera opens. Point it at the ingredient list on any packaged food,
       filling the frame. A product containing the allergy entered in step 1
       gives the clearest result.

    No packaged food to hand? The camera screen has "Choose a photo instead"
    below the shutter. Any saved photo of an ingredient list works.

    History, Profiles, Subscription and Account are in the camera screen menu.

    IN-APP PURCHASE

    One auto-renewing subscription, two durations, no free tier and no
    consumables. It unlocks unlimited scans, profiles, history and sources.

    revely.annual, $39.99 per year, after a 7-day free trial
    revely.monthly, $7.99 per month, billed immediately

    The purchase screen appears at the end of onboarding, and afterwards from
    the camera menu under Subscribe. Both show each plan's title, duration and
    price from StoreKit in local currency, and say when money moves before any
    purchase starts. Restore Purchases, Terms of Use and Privacy Policy are
    under the plans.

    ACCOUNT DELETION

    Camera screen menu, then Account, then Delete account. It removes the
    account, its profiles and its scan history.

    EXTERNAL SERVICES

    OpenAI reads labels and analyses ingredients, through the business API,
    which does not train on the data. Apple and Google verify sign-in tokens.
    Apple In-App Purchase handles all billing. RevenueCat carries subscription
    status. Neon hosts the database, Fly.io the servers. The same list is
    published at https://revely.life/privacy.

    Ingredient findings are quoted from the FDA's Substances Added to Food
    inventory, EFSA's OpenFoodTox, the IARC monographs, the EU CosIng annexes
    and California Proposition 65, all public regulatory publications, quoted
    with attribution and no claim of endorsement.

    REGIONS

    Identical everywhere. No geographic gating and no region-specific content.
    The interface follows the device locale in English, Spanish or Simplified
    Chinese, and prices are Apple's local equivalents. Findings are not
    filtered by country.

    WHAT THIS APP IS NOT

    Revely provides ingredient information only. It is not a medical device,
    does not diagnose or treat any condition, and is not a substitute for
    professional medical advice. That appears on every result screen.

    A label photo is used for that one scan and is not retained.

    Questions to hello@dozylabs.net, answered the same day.

---

## Part 3. The screen recording

On a physical iPhone, on the current iOS. Not the simulator. Delete the app
first so it launches with no account and no profile, and sign out of the App
Store's production account and into a sandbox tester account beforehand, in
Settings, Developer, Sandbox Apple Account.

Have ready, before you press record: one packaged food whose ingredient list
contains peanuts or another allergen you will enter during onboarding, and good
light on the label.

Screen recording is Control Centre. Uninterrupted, one take, roughly four
minutes. Do not narrate over it. Do not cut it. Apple wants the unedited flow,
and pauses while a scan runs are expected.

    1  Launch      Start recording on the home screen, then tap the icon. The
                   launch has to be in the video.
    2  Onboarding  Get started. Choose Myself. Enter the allergen your product
                   actually contains. Move through the rest at a readable pace.
    3  Example     The example scan plays. Let it finish rather than skipping.
    4  Trial       The two trial screens, then Continue for free.
    5  Paywall     STOP HERE FOR FIVE SECONDS. Both plans, both prices, the
                   trial length and the billing line have to be legible and
                   still on screen long enough to read. This is the shot Apple
                   said they need. Then tap Terms of Use, let it open, come
                   back, tap Privacy Policy, let it open, come back.
    6  Sign in     Choose the annual plan and tap the button. Sign in with
                   Apple. Complete Apple's purchase sheet. Sandbox charges
                   nothing.
    7  Scan        The camera opens. Point it at the ingredient list, filling
                   the frame. Take the shot. Let the analysis run.
    8  Result      Scroll the whole verdict, slowly. Reach the flagged
                   ingredient, open it, show the quoted source and who
                   published it. Scroll to the bottom so the disclaimer is on
                   screen.
    9  Library     Back to the camera. Tap "Choose a photo instead" and show
                   the picker opening. Cancel out. This proves the route in
                   section 3 of the reply is real.
    10 History     Menu, History. Show the scan you just made in the list.
    11 Profiles    Menu, Profiles. Show that a second profile can be added.
                   Adding one is optional, but show the screen.
    12 Deletion    Menu, Account. Scroll so the screen naming what deletion
                   removes is readable. Tap Delete account, then confirm in
                   the alert. Let the app return to the first screen.
    13 Stop        Stop recording.

Step 12 genuinely deletes the account. That is what Apple is asking to see, and
the account is a sandbox one, so let it delete. Do not stop the recording
before the confirmation goes through: the confirmed deletion is the shot.

Attach the file directly rather than hosting it and pasting a link. Both the
reply dialog (Attach File) and the version's App Review Information section
(Attachment) take a video, and this recording went into both. A direct
attachment cannot expire, cannot sit behind a login, and stays with the
submission.

---

## Part 4. Dry run notes, iPhone 17 Pro simulator, 9 September 2026

Walked in the simulator on a dev build to de-risk the real take. Everything
below is observed, not assumed.

### The sequence, verified

Thirteen screens from launch to the paywall. A human moving at a readable pace
gets there in roughly ninety seconds.

     1  Welcome           Wordmark, "Your ingredient guardian.", Get started
     2  Shop anywhere     Card animates: a fourth ingredient appears as the
                          FR to EN translation lands. Let it finish. CTA is
                          "Let's do it"
     3  Green means fine  The three risk inks, with an EXAMPLE badge
     4  Who are we        Myself / My child / Someone I care for. NEXT IS
        checking for      DISABLED until one is picked
     5  What should we    Free text, defaults to "Me"
        call you
     6  What's off-limits Allergen chips. Pick the one your product contains
     7  How careful       Severity per allergen, Allergy preselected
     8  Different names   The alias card: "Both of those are milk"
     9  Any diet          Chips, skippable
    10  Pregnant, nursing Conditions, skippable. This is the health data the
                          Consumer Health Data Privacy Policy covers
    11  Reads the label   Barcode versus printed list
    12  When an agency    FDA, EFSA, IARC, WHO, each with one line on what it
        has ruled         rules on
    13  Which language    EN chip. CTA is "See it work"

Then the example scan, two trial screens, and the paywall.

### Three screens are worth holding on

The example scan is the strongest thing in the recording and it arrives before
any purchase. The verdict read "Avoid" in the serif, with a chip saying
"Dave . Peanut", a stamp reading CHECK DAVE, and the reason written out: "The
label warns this may contain traces of Peanut, from shared equipment." Below
it the Spanish label sits beside its English translation, twelve ingredients,
titanium dioxide flagged high risk and sulfur dioxide worth a look. It caught
the peanut from the label's own "may contain" declaration rather than from an
ingredient name, which is the whole argument for the product. Scroll it slowly.

Screen 12 answers Apple's question 6 visually: four agencies named, one line
each, no invented score. Screen 13 answers question 5.

### Where the dry run stops, and why

The paywall renders its furniture but no plans: "Subscriptions aren't live in
this build yet." A dev build has no RevenueCat key, so PURCHASES_ENABLED is
false, no offerings load, and Continue is disabled.

Everything after the purchase is therefore unreachable here. The camera screen
redirects to the paywall whenever entitlement is inactive, at
mobile/src/app/index.tsx:300, so the live scan, the result, the photo library
route, history, profiles and account deletion cannot be rehearsed on this
build. Steps 6 through 13 of Part 3 have to be done cold, on TestFlight.

That is the argument for installing build 32 from TestFlight rather than
recording from a dev build: it is not only that Apple wants the binary they
are reviewing, it is that a dev build physically cannot show them the four
things they asked to see.

The paywall's static half is correct and worth knowing before you record it:
the heading reads "Start your 7-day free trial to continue", the billing
sentence underneath reads "Free for 7 days, then the plan you picked, billed
to your Apple ID. Renews until canceled. Cancel any time in Settings, at least
24 hours before the trial ends", and Terms of Use, Privacy Policy and Restore
purchases sit in one row below that. So the reply's claim about this screen is
accurate; only the prices were missing here.

### Traps, all of which I walked into

THE SIGN IN LINK SITS DIRECTLY UNDER GET STARTED. I hit it twice. It opens a
"Welcome back" sheet with a lone Sign in with Apple button, which on a
recording looks like a wrong turn or a bug. Aim at the upper half of the
button, and if the sheet does open, tap the dimmed area above it and start the
take again rather than trying to recover on camera.

THE NEXT BUTTON MOVES. On the two skippable screens, diet and conditions, a
Skip link sits below Next, which pushes Next about 40 points higher than on
every other screen. On the allergen screen the Skip link disappears the moment
you select a chip, so Next moves down mid-screen. Recording by muscle memory
produces mis-taps here.

THE NAME FIELD NEEDS A DELIBERATE PACE. Typing fast dropped a character for me,
and the name is not cosmetic: the next heading reads "What's off-limits for
Dave?" and the verdict card is stamped with it. A truncated name is visible for
the rest of the recording.

THE DEV WARNING TOAST SITS ON TOP OF THE CTA. Dev builds only, and another
reason to record from TestFlight, but if you do end up in a dev build, dismiss
it before you start or it covers the button you are about to press.

### One thing to fix, but not now

The in-app Terms and Privacy links open revely-api.fly.dev, not revely.life.
Every EAS profile including production sets EXPO_PUBLIC_API_URL to
https://revely-api.fly.dev, and mobile/src/lib/config.ts derives the legal URLs
from it.

Both hosts serve the same Fly app, and I checked: /terms is byte-identical on
each, same SHA-256. So Guideline 3.1.2 is satisfied, the links work, and there
is no contradiction of substance with the reply or with the Privacy Policy URL
in App Store Connect. It is a cosmetic mismatch: a reviewer who compares the
in-app link against the listed policy URL sees two hostnames for one document.

Not worth a new build in the middle of a review, and repointing
EXPO_PUBLIC_API_URL would move all API traffic as a side effect. The clean fix
is a separate SITE_URL constant for the legal pages, in the next version.
