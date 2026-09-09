# Reply to App Review, Guideline 2.1, build 32

Apple has not found a bug. This is the standard information request sent to a
developer account with no review history, and every item on it is answered with
words and one video. Nothing in the app has to change.

Three things are needed from you before this can be sent:

1. The screen recording. Shot list is at the end of this file. It has to be a
   real device, not the simulator, and Apple will check.
2. The two subscription prices, which live in App Store Connect and are marked
   PRICE HERE below.
3. A confirmation in App Store Connect that both in-app purchases are attached
   to this version and submitted with it, not sitting in "Ready to Submit" on
   their own. Apple raised that in their Prevent Common Issues list.

There is no demo account to hand over, and there must not be one. Revely has no
passwords: it authenticates only through Sign in with Apple and Google Sign-In.
The switch that would allow a password-free test login, ALLOW_DEV_LOGIN, is off
in production and has to stay off, because turning it on would open
credential-free sign-in to everyone, not only to Apple. The reply below says
this plainly in its first paragraph, which is where a reviewer looks.

---

## Part 1. Paste into Resolution Center

Hello, and thank you for the detailed list. Answers to all seven items follow.

SIGNING IN, BEFORE ANYTHING ELSE

Revely has no username and password, so we cannot supply demo credentials. The
app authenticates only through Sign in with Apple and Google Sign-In. Please
sign in with Apple, using your own Apple Account or a sandbox account. The
button appears on the first screen and again when a purchase begins. No email
address, name or password is ever typed into the app.

1. SCREEN RECORDING

A recording made on a physical iPhone running the current iOS is here:

    VIDEO LINK HERE

It begins at app launch and shows, in order: onboarding, Sign in with Apple,
the subscription screen with both plans and their prices, a purchase, a live
scan of a product's ingredient list, the result, scan history, and account
deletion.

2. WHAT THE APP IS FOR, AND WHO FOR

Revely reads the ingredient list on packaged food and explains it.

The problem: an ingredient list is the one piece of health information people
are handed at the moment of purchase and cannot read. It is printed small,
often in another language, and written in a vocabulary of additives, E numbers
and chemical synonyms that almost nobody recognises. An allergen can appear
under a name that does not contain the allergen's word at all.

What Revely does: you tell it once what you would rather not eat, which can be
allergies, a condition you are managing, a diet you keep to, or additives you
avoid. You then point the camera at any ingredient list. The app transcribes it,
translates it if it is not in your language, explains each ingredient, and
checks the whole list against your profile. The verdict names the ingredient it
found, where it sits in the list, and quotes the published finding behind it,
naming who published it.

Who it is for: people with food allergies or intolerances, people managing a
condition with a dietary component, people keeping to a diet for religious or
personal reasons, parents and carers who shop for someone else, and travellers
facing labels in a language they do not read. Profiles cover the last case:
you can hold a profile for a child or a parent and switch between them, and the
scan already on screen is rechecked immediately.

Revely is for a general audience and is not directed at children.

3. SETTING UP AND REACHING THE MAIN FEATURES

    1. Launch the app and tap Get started.
    2. Onboarding asks who the profile is for. Choose Myself. Adding one
       allergy, for example peanuts, is enough to make the result obvious.
    3. An example scan runs on a sample label, checked against the profile you
       just built, followed by two short screens about the free trial.
    4. The subscription screen appears. Choose a plan and tap the button.
    5. Sign in with Apple in the sheet that appears. Apple's purchase sheet
       follows on its own. In the sandbox environment it completes at no charge.
    6. The camera opens. This is the app's home screen.

To test a scan, point the camera at the ingredient list on any packaged food,
filling the frame with the list. A product containing the allergy you entered
gives the clearest result.

If you do not have packaged food to hand, the camera screen has "Choose a photo
instead" below the shutter. Save any photograph of an ingredient list to the
device's photo library and select it there. The scan is identical.

Everything else is behind the menu on the camera screen: History, Profiles,
Subscription and Account.

4. EXTERNAL SERVICES

    OpenAI          Reads the label from the photo and analyses the
                    ingredients. Used through the business API, which does not
                    train on the data sent to it.
    Apple           Sign in with Apple, for authentication.
    Google          Google Sign-In, for authentication. Token verification
                    only.
    Apple           In-App Purchase. All billing, without exception. Revely
                    takes no payment by any other route and holds no card
                    details.
    RevenueCat      Subscription status, so an entitlement follows the account
                    across devices.
    Neon            PostgreSQL database hosting.
    Fly.io          Application hosting.

That list is the same one published in our privacy policy at
https://revely.life/privacy, which names every recipient and what each one
receives.

The ingredient findings the app quotes come from published regulatory and
scientific sources: the US FDA's Substances Added to Food inventory, EFSA's
OpenFoodTox, the IARC monographs, the EU CosIng annexes, and California
Proposition 65. These are public government and intergovernmental
publications.

A label photograph is used for the one scan it was taken for and is not
retained.

5. REGIONAL DIFFERENCES

The app behaves identically in every region. There is no geographic gating, no
region-specific content, and no feature available in one country and not
another.

Two things do vary, neither of them by our choice of region:

    The interface language follows the device locale, and is English, Spanish
    or Simplified Chinese. The three are equivalent in function; the same
    screens and the same findings appear in each.

    Subscription prices are Apple's local equivalents for the tier we set, in
    the customer's own currency. The app never prints a price of its own. It
    displays whatever StoreKit reports for that storefront.

The ingredient findings themselves are not filtered by country. If the FDA and
EFSA have both published on an ingredient, both are shown, wherever the
customer is, and each is attributed.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL

Revely provides ingredient information only. It is not a medical device, does
not diagnose, treat, cure or prevent any condition, and is not a substitute for
professional medical advice. That statement appears on every result screen in
the app, not only in the listing, and it is repeated in our Terms of Use.

The app makes no clinical claim, offers no diagnosis, and provides no treatment
or dosing guidance. It reports what a published source says about an ingredient
and names the source, so the customer reads the finding and decides. It does not
assert conclusions of its own beyond matching an ingredient list against
preferences the customer entered themselves.

The material we quote is published by the FDA, EFSA, the IARC, the European
Commission and the State of California. These are public regulatory
publications, quoted with attribution. No licence is required to cite them, we
claim no endorsement by any of these bodies, and the app does not display their
logos or marks or suggest any affiliation.

Health information the customer enters, such as allergies and conditions, is
covered by a separate Consumer Health Data Privacy Policy at
https://revely.life/health-privacy.

7. IN-APP PURCHASE

Revely sells one auto-renewing subscription in two durations. There is no free
tier and no consumable purchase. The subscription unlocks the app itself:
unlimited scans, profiles for other people, scan history, and the published
sources behind each verdict.

    revely.annual    PRICE HERE per year, after a 7-day free trial
    revely.monthly   PRICE HERE per month, billed immediately

Reaching the purchase flow, by either route:

    At the end of onboarding, the subscription screen appears on its own, as
    step 4 in section 3 above. This is the route almost everyone takes.

    At any time afterwards, from the menu on the camera screen, by tapping
    Subscribe.

Both screens show each plan's title, duration and price, taken from StoreKit in
the customer's currency, and state when money moves before any purchase begins:
the annual plan shows a timeline saying the trial is free today, that a
reminder arrives before it ends, and on which day of the trial the charge
lands unless it is cancelled; the monthly plan says it bills today. Restore Purchases sits under the plans, next to links
to the Terms of Use and the Privacy Policy.

Subscriptions are managed and cancelled in Apple Account settings. The app links
there from the Account screen rather than asking anyone to cancel through us.

We have added all of the above to the App Review Information notes for future
submissions. Any questions, please write to hello@dozylabs.net and we will
answer the same day.

---

## Part 2. Paste into the Notes field, App Review Information

Apple asked for this to be stored there as well as replied. Under the 4,000
character limit. Keep the two in agreement: if one changes, change both.

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

    revely.annual, PRICE HERE per year, after a 7-day free trial
    revely.monthly, PRICE HERE per month, billed immediately

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

Upload it somewhere Apple can reach without an account, and put the link in the
reply where it says VIDEO LINK HERE.
