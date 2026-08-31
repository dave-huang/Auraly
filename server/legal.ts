import type { Express } from "express";

/**
 * The public web pages: a home page, and the three legal documents.
 *
 * These live here as strings rather than as files under a static directory
 * because `build:server` is a single esbuild bundle with no asset copying —
 * an .html file next to this one would simply not exist in the container. A
 * bundled string cannot go missing.
 *
 * Two things depend on these URLs and will break loudly if they move:
 *   - App Store Connect requires a reachable privacy policy URL on the
 *     listing, re-checked at every submission.
 *   - Guideline 3.1.2 requires functional links to both documents on the
 *     paywall itself. mobile/src/app/paywall.tsx links here.
 *
 * The three values below are the real ones: Dozy Labs LLC is the entity that
 * publishes Revely and carries the liability these documents describe, and
 * Washington is where a dispute is heard. They are defaults in code rather
 * than deployment config on purpose — they are not secret, they are the same
 * in every environment, and a legal page that renders a placeholder because
 * an env var was missed is worse than one that cannot be overridden.
 *
 * ---------------------------------------------------------------------------
 * STILL OPEN: a lawyer's read of the whole thing. What follows is accurate
 * about the software — every claim in it was checked against the code — but
 * accuracy about the software is not the same as legal sufficiency for an app
 * that holds health information about pregnancies, infants, and diagnosed
 * conditions.
 * ---------------------------------------------------------------------------
 */

/** The entity these documents bind. */
const LEGAL_ENTITY = process.env.LEGAL_ENTITY || "Dozy Labs LLC";

/**
 * Where privacy requests go.
 *
 * Deliberately NOT falling back to FEEDBACK_EMAIL. That variable holds a
 * personal inbox, and this address is printed on a page the whole internet
 * reads and App Store reviewers archive — a fallback that quietly publishes
 * someone's personal address is a privacy leak inside a privacy policy.
 *
 * The policy promises a reply within 30 days, so whatever address is here has
 * to be one somebody actually reads.
 */
const CONTACT_EMAIL = process.env.LEGAL_CONTACT_EMAIL || "hello@dozylabs.net";

/** Jurisdiction for disputes. */
const GOVERNING_LAW =
  process.env.LEGAL_GOVERNING_LAW || "the State of Washington, USA";

/** Shown as "last updated". Bump when the text changes in substance. */
const LAST_UPDATED = "26 August 2026";

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

/**
 * Paper and ink, matching the app — these pages open inside it, and a plain
 * white legal page after a warm one reads as a different company's website.
 *
 * Both themes are defined at token level on :root, because the phone's browser
 * view follows the system theme and a document that is only legible in light
 * mode is a document half our readers cannot read.
 */
const STYLE = `
:root {
  --card: #FFFCF6; --paper: #F6F1E7; --sunk: #EDE6D8; --rule: #DDD4C2;
  --ink-faint: #8A8175; --ink-muted: #5C554A; --ink: #16130F;
}
@media (prefers-color-scheme: dark) {
  :root {
    --card: #1E1A15; --paper: #16130F; --sunk: #241F19; --rule: #332C24;
    --ink-faint: #8A8175; --ink-muted: #A79E90; --ink: #F6F1E7;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0 20px 96px;
  background: var(--paper);
  color: var(--ink);
  font-family: ui-serif, Georgia, "Times New Roman", serif;
  font-size: 17px;
  line-height: 1.65;
  -webkit-text-size-adjust: 100%;
}
main { max-width: 40rem; margin: 0 auto; }
header { padding: 48px 0 8px; border-bottom: 1px solid var(--rule); margin-bottom: 32px; }
.mark {
  font-family: ui-sans-serif, -apple-system, system-ui, sans-serif;
  font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ink-faint); margin: 0 0 12px;
}
/* The mark itself, in full ink — .mark above is the faint text eyebrow, and
   the logo wearing that colour reads as a disabled control. */
.brandmark { color: var(--ink); margin: 0 0 18px; line-height: 0; }
h1 { font-size: 30px; line-height: 1.2; margin: 0 0 10px; text-wrap: balance; }
h2 {
  font-size: 21px; margin: 40px 0 12px; text-wrap: balance;
  padding-top: 20px; border-top: 1px solid var(--rule);
}
h3 { font-size: 17px; margin: 24px 0 8px; }
p, li { color: var(--ink-muted); }
li { margin-bottom: 8px; }
strong { color: var(--ink); font-weight: 600; }
a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
.updated {
  font-family: ui-sans-serif, -apple-system, system-ui, sans-serif;
  font-size: 13px; color: var(--ink-faint); margin: 0;
}
.summary {
  background: var(--card); border: 1px solid var(--rule);
  padding: 20px 22px; margin: 0 0 8px;
}
.summary p:last-child, .callout p:last-child { margin-bottom: 0; }
.summary p:first-child, .callout p:first-child { margin-top: 0; }
.callout {
  background: var(--sunk); border-left: 3px solid var(--ink-faint);
  padding: 18px 20px; margin: 24px 0;
}
table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 15px; }
th, td { text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
th {
  font-family: ui-sans-serif, -apple-system, system-ui, sans-serif;
  font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ink-faint);
}
td { color: var(--ink-muted); }
.scroll { overflow-x: auto; }
footer {
  margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--rule);
  font-family: ui-sans-serif, -apple-system, system-ui, sans-serif;
  font-size: 13px; color: var(--ink-faint);
}
footer a { color: var(--ink-faint); }
`;

/**
 * The document chrome, with no opinion about what sits at the top.
 *
 * Split out when the home page arrived: `page()` below stamps a "Last updated"
 * line under the title, which is right for a legal instrument and meaningless
 * on a home page — and a home page whose <title> read "Revely · Revely" and
 * whose first two lines both said "Revely" was the giveaway that one wrapper
 * was doing two jobs.
 */
function shell(title: string, head: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header>
${head}
</header>
${body}
<footer>
  <p><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a></p>
  <p><a href="/health-data-privacy">Consumer Health Data Privacy Policy</a></p>
  <p>${LEGAL_ENTITY} · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</footer>
</main>
</body>
</html>`;
}

/** A legal document: eyebrow, title, and the date it last changed. */
function page(title: string, body: string): string {
  return shell(
    `${title} · Revely`,
    `  <p class="mark">Revely</p>
  <h1>${title}</h1>
  <p class="updated">Last updated ${LAST_UPDATED}</p>`,
    body,
  );
}

// ---------------------------------------------------------------------------
// Privacy policy
// ---------------------------------------------------------------------------

const PRIVACY = page("Privacy Policy", `
<div class="summary">
  <p><strong>The short version.</strong> Revely reads product labels and tells you
  whether what is in them matters for you. To do that it needs to know what you
  are avoiding — allergies, dietary rules, medical conditions. That is health
  information, and we treat it as such.</p>
  <p>We do not sell it. We do not use it for advertising. There are no advertising
  or tracking SDKs in the app. Label photos are not kept after they are read. You
  can delete everything from inside the app, and deletion means deletion.</p>
</div>

<h2>Who we are</h2>
<p>Revely is provided by ${LEGAL_ENTITY}. For anything in this policy, including
requests to see or delete your data, write to
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>What we collect, and why</h2>

<h3>Health information you enter</h3>
<p>Profiles are the heart of the app. A profile can record allergens and how
severe each one is (including anaphylaxis), dietary rules, and health conditions
— which may include <strong>pregnancy, breastfeeding, an infant under twelve
months, kidney disease, high blood pressure, diabetes, coeliac disease, and
similar</strong>. You may create profiles for other people, such as your
children.</p>
<p>We use this for one purpose: deciding what to tell you about a label you
scanned. It is never used for advertising, never sold, and never shared with
anyone outside the processors listed below.</p>
<p>Before you create an account, profiles are stored <strong>only on your
device</strong> and sent with a scan to produce that scan's answer. They are not
saved on our servers until you sign in and choose to keep them.</p>

<h3>Label photos</h3>
<p>When you scan a product, the photo is sent to OpenAI, which reads the
ingredient list out of it and returns text. <strong>We do not store the
photo.</strong> Neither our servers nor your scan history keep the image after
the label has been read.</p>
<p>We do keep a one-way cryptographic hash of the image — a fixed-length
fingerprint that the original cannot be reconstructed from — so that re-scanning
the same label does not have to be paid for and processed twice.</p>

<h3>Your scans</h3>
<p>If you are signed in, we save the product name, the ingredients we read, the
result we produced, the risk level, and when it happened, so that your history
is there when you come back. Signed-out scans are not attached to any account.</p>

<h3>Your account</h3>
<p>You sign in with Apple or Google. We receive and store your email address and,
if the provider supplies them, your name and profile picture. <strong>We never
receive your Apple or Google password.</strong> If you use Apple's Hide My Email,
we only ever see the relay address, which is the point of it.</p>

<h3>A device identifier</h3>
<p>So that you can try the app before creating an account, your device generates a
random identifier the first time it runs and stores it in the iOS keychain. It
counts free scans. It is not your advertising identifier, it contains nothing
about you or your hardware, and it is not shared with anyone. When you sign in,
it is linked to your account once, so that the free scans you already used are
not granted a second time.</p>

<h3>Subscription status</h3>
<p>If you subscribe, Apple handles the payment. <strong>We never see your card,
your billing address, or your Apple ID.</strong> Apple tells RevenueCat, our
subscription processor, that a subscription exists, and RevenueCat tells our
server whether your account is currently entitled and when the period ends. That
is all we store about billing.</p>

<h3>Diagnostics</h3>
<p>When the app crashes it sends us the error message, the technical stack trace,
the name of the screen you were on, and the app and operating system versions.
The report is scrubbed on your device first, and it carries the screen's
<em>name</em> only — never what was on it, so a crash never carries scan or
profile contents. We also count a small number of product events, such as the
paywall being shown, to understand whether the app works.</p>

<h2>What we never do</h2>
<ul>
  <li>We never sell or rent your personal information to anyone.</li>
  <li>We never use your health information for advertising or marketing.</li>
  <li>We do not include advertising SDKs, and we do not track you across other
  apps or websites. The app asks for no tracking permission because it does no
  tracking.</li>
  <li>We do not build profiles of you for anyone else, and we share nothing with
  data brokers.</li>
</ul>

<h2>Who processes your data for us</h2>
<p>These are the only companies that touch your data, and each does so only to
run part of the service.</p>
<div class="scroll">
<table>
  <thead><tr><th>Who</th><th>What they receive</th><th>Why</th></tr></thead>
  <tbody>
    <tr><td>OpenAI</td><td>Label photos and ingredient text</td><td>Reading labels and analysing ingredients. Sent through the business API, which does not use the data to train models.</td></tr>
    <tr><td>Apple / Google</td><td>Your sign-in token</td><td>Verifying that you are who you signed in as. Verification only.</td></tr>
    <tr><td>Apple</td><td>Your payment</td><td>All subscription billing. We receive none of it.</td></tr>
    <tr><td>RevenueCat</td><td>Subscription status and an account identifier</td><td>Keeping entitlement correct across your devices.</td></tr>
    <tr><td>Neon</td><td>The database contents</td><td>Hosting the database.</td></tr>
    <tr><td>Fly.io</td><td>Traffic to the service</td><td>Running the servers.</td></tr>
    <tr><td>Resend</td><td>Your email address, if you write to us</td><td>Delivering that message.</td></tr>
  </tbody>
</table>
</div>
<p>These providers process data in the United States. If you are writing to us
from elsewhere, your information is transferred there to run the service.</p>

<h2>How long we keep things</h2>
<ul>
  <li><strong>Label photos:</strong> not kept. They exist only for the seconds it
  takes to read them.</li>
  <li><strong>Profiles and scan history:</strong> until you delete them, or until
  you delete your account.</li>
  <li><strong>Crash reports and product events:</strong> kept for troubleshooting
  and then discarded. Crash reports lose their link to your account when the
  account is deleted; product events do the same.</li>
  <li><strong>Backups:</strong> deletions reach our backups as those backups
  age out on their normal schedule.</li>
</ul>

<h2>Deleting your account</h2>
<p>You can delete your account from inside the app, on the Account screen. It
removes your account, your profiles, and your scan history. This is not a request
queue and not a deactivation — the records are deleted.</p>
<p><strong>Deleting your account does not cancel a subscription.</strong> Your
subscription lives with Apple, not with us, and only you can cancel it — in your
Apple ID settings. Please cancel first, then delete, or you will keep being
charged for an account that no longer exists.</p>
<p>One thing survives, deliberately, and it is not about you: when the app meets
an ingredient it cannot classify, it records the <em>ingredient name</em> so we
know what to add next. Those rows have never had an account attached to them and
so contain nothing to delete.</p>

<h2>Your rights</h2>
<p>Wherever you live, you may ask us for a copy of what we hold about you, ask us
to correct it, or ask us to delete it. Write to
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> and we will respond within
30 days.</p>
<p>If you are in the European Economic Area or the United Kingdom, our lawful
basis for handling ordinary account data is performing our contract with you.
For health information, it is <strong>your explicit consent</strong>, given when
you enter it — and you may withdraw that consent at any time by deleting the
profile, which stops the processing.</p>
<p>If you are in California, we do not sell or share personal information as the
CCPA defines those terms, and we will never discriminate against you for
exercising any right described here.</p>

<h2>Children</h2>
<p>Revely is not directed at children, and you must be at least 13 to hold an
account. A parent may of course create a profile describing a child, including an
infant — that information belongs to the parent's account and is deleted with
it.</p>

<h2>Security</h2>
<p>Traffic is encrypted in transit. The database is encrypted at rest. Sign-in
tokens are held in the iOS keychain rather than in ordinary app storage. Access
to production data is limited to those who need it to operate the service.</p>
<p>No service can promise perfect security, and we will not pretend otherwise. If
we ever discover a breach affecting your information, we will tell you and the
relevant regulators as the law requires.</p>

<h2>Changes to this policy</h2>
<p>If we change this policy in a way that matters, we will update the date at the
top and tell you in the app before the change takes effect. Continuing to use
Revely afterwards means the new version applies.</p>

<h2>Contact</h2>
<p>${LEGAL_ENTITY} — <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`);

// ---------------------------------------------------------------------------
// Consumer health data privacy policy (Washington My Health My Data Act)
// ---------------------------------------------------------------------------

/**
 * A SEPARATE document, on purpose.
 *
 * RCW 19.373.020 requires a consumer health data privacy policy that is linked
 * distinctly and is NOT merged into the general privacy policy — and it
 * requires the policy to carry the five disclosures below and nothing else.
 * That last part is why this page has no summary box, no reassurance, and no
 * writing that is not doing required work: padding it with brand voice is not
 * a neutral stylistic choice here, it is the thing the statute forbids.
 *
 * The Act has no revenue threshold, so being small does not exempt Dozy Labs
 * LLC, and it carries a private right of action through the Consumer
 * Protection Act rather than regulator-only enforcement.
 *
 * The sharing disclosure is narrow because the architecture is: profiles never
 * reach OpenAI. analyzeIngredients() takes ingredient text and a language, and
 * applyProfileToAnalysis() runs afterwards on our own server — personalRisk.ts
 * contains no fetch and no await, because it is local matching. Keep it that
 * way. Passing a profile into a model prompt would move health data to a third
 * party and make this section false.
 */
const HEALTH_DATA = page("Consumer Health Data Privacy Policy", `
<p>This policy is required by the Washington My Health My Data Act and applies
to consumer health data that ${LEGAL_ENTITY} collects through Revely. It covers
Washington residents and anyone whose consumer health data we collect in
Washington. It is separate from our
<a href="/privacy">general Privacy Policy</a>, which covers everything else.</p>

<h2>1. What consumer health data we collect, and why</h2>
<div class="scroll">
<table>
  <thead><tr><th>Category</th><th>Why we collect it, and how it is used</th></tr></thead>
  <tbody>
    <tr>
      <td>Health conditions you record in a profile — including pregnancy,
      breastfeeding, an infant under twelve months, kidney disease, high blood
      pressure, diabetes, and coeliac disease</td>
      <td>To decide which ingredients on a label matter for the person that
      profile describes. Used only to produce that answer.</td>
    </tr>
    <tr>
      <td>Allergies and intolerances you record, and how severe each one is,
      including anaphylaxis</td>
      <td>To flag matching ingredients and set how strongly a result is
      stated. Used only to produce that answer.</td>
    </tr>
    <tr>
      <td>Dietary rules you record</td>
      <td>Same purpose. Some rules imply a health status, so we treat all of
      them as health data rather than sorting them.</td>
    </tr>
    <tr>
      <td>Your scans and their results, which can indicate a health status by
      what you were checking for</td>
      <td>To show you the result, and to keep your history available to you
      when you are signed in.</td>
    </tr>
  </tbody>
</table>
</div>
<p>We do not use consumer health data for advertising, marketing, or profiling,
and we do not use it to make any decision about you beyond answering the
question you asked about a label.</p>
<p>We do not collect location data of any kind. Revely has no location
permission and no location capability, so we cannot and do not infer anything
about health services you visit.</p>

<h2>2. Where it comes from</h2>
<p>One source: <strong>you</strong>. Every category above is entered by you in
the app or produced by a scan you took. We do not buy consumer health data, and
we do not receive it from data brokers, advertising networks, health care
providers, or any other outside source.</p>

<h2>3. What consumer health data we share</h2>
<p>We share the categories in section 1 only with the infrastructure providers
in section 4, and only so that the app can store and serve your own data back
to you. We share no consumer health data for any other purpose.</p>
<p><strong>Your profiles and conditions are not sent to our ingredient-reading
provider.</strong> A scan sends the label photo to OpenAI, which reads the
ingredients out of it. Matching those ingredients against your profile happens
afterwards on our own servers. OpenAI does not receive your allergies, your
conditions, your dietary rules, or your identity.</p>
<p><strong>We do not sell consumer health data</strong> as the My Health My
Data Act defines selling, and we have never done so. If that ever changes, the
Act requires us to obtain your signed authorization first, separately from any
other consent.</p>

<h2>4. Who receives it</h2>
<div class="scroll">
<table>
  <thead><tr><th>Category of recipient</th><th>Who</th><th>What they do with it</th></tr></thead>
  <tbody>
    <tr><td>Database hosting</td><td>Neon Inc.</td><td>Stores the database on our instructions. No independent use.</td></tr>
    <tr><td>Application hosting</td><td>Fly.io Inc.</td><td>Runs our servers, so the data passes through their infrastructure. No independent use.</td></tr>
  </tbody>
</table>
</div>
<p>That is the complete list. ${LEGAL_ENTITY} has no affiliates, and no
advertiser, analytics provider, data broker, or marketing partner receives
consumer health data from us.</p>
<p>Our other providers — OpenAI, Apple, Google, RevenueCat, and Resend —
receive no consumer health data. What each of them does receive is described in
our <a href="/privacy">general Privacy Policy</a>.</p>

<h2>5. Your rights, and how to use them</h2>
<p>Write to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> to exercise
any right below. We will confirm we received your request and respond within
<strong>45 days</strong>. If we need more time we may take up to 45 additional
days, and we will tell you why before the first period ends.</p>
<ul>
  <li><strong>Confirm and access.</strong> Ask whether we collect, share, or
  sell your consumer health data, and get a copy of it, along with a list of
  every third party and affiliate we have shared it with and how to contact
  them.</li>
  <li><strong>Withdraw consent.</strong> Withdraw your consent to our
  collecting your consumer health data, to our sharing it, or to both
  separately. Withdrawing stops future processing; it does not undo processing
  that already happened.</li>
  <li><strong>Delete.</strong> Ask us to delete your consumer health data. We
  will delete it from our live systems, our archives, and our backups within
  <strong>30 days</strong>, and we will tell every provider in section 4 that
  received it to do the same. You can also delete it yourself at any time from
  the Account screen in the app, which is immediate.</li>
</ul>

<h2>6. If we refuse</h2>
<p>If we decline a request, we will tell you why, and you may appeal by
replying to that message or writing again to
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with the word "appeal".
We will decide the appeal and write to you within <strong>45 days</strong>,
explaining the reasons.</p>
<p>If we deny the appeal, you may submit a complaint to the Washington State
Attorney General at
<a href="https://www.atg.wa.gov/file-complaint">atg.wa.gov/file-complaint</a>.
We will include that link in any denial we send you.</p>

<h2>7. Contact</h2>
<p>${LEGAL_ENTITY} — <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`);

// ---------------------------------------------------------------------------
// Terms of use
// ---------------------------------------------------------------------------

const TERMS = page("Terms of Use", `
<div class="summary">
  <p><strong>The short version.</strong> Revely helps you read ingredient labels.
  It is a reference tool, not a medical device and not a doctor. It can misread a
  label, and labels themselves change without notice — so if a mistake would harm
  you, read the physical package and ask a professional.</p>
  <p>Subscriptions renew automatically until you cancel. You cancel in your Apple
  ID settings, not with us.</p>
</div>

<h2>1. Agreeing to these terms</h2>
<p>By using Revely you agree to these terms. If you do not agree, please do not
use the app. You must be at least 13 years old to hold an account.</p>

<h2>2. What Revely is — and is not</h2>
<p>Revely reads the ingredient list on a product and compares it against what you
have told it you avoid. It draws on published sources from food-safety and health
authorities, and it tells you which source each statement came from.</p>

<div class="callout">
  <p><strong>Revely does not give medical advice.</strong> It is not a medical
  device, it does not diagnose, treat, cure, or prevent anything, and it is not a
  substitute for a doctor, pharmacist, dietitian, or allergist. Never delay or
  disregard professional advice because of something Revely told you.</p>
  <p><strong>If you have a serious allergy, read the physical label.</strong>
  Photographs can be blurred, cropped, or badly lit; text recognition can misread
  a word; manufacturers reformulate without warning; and packaging in your hand
  may be newer than anything we have seen. A "safe" result from Revely is not a
  guarantee that a product is safe for you.</p>
  <p>If you are having an allergic reaction, use your emergency medication and
  call your local emergency number. Do not open this app.</p>
</div>

<h2>3. Accuracy</h2>
<p>We work hard to be right and to show our sources, but we cannot promise that
every reading or every assessment is correct or complete. Ingredient science
changes, authorities disagree with one another, and automated label reading is
imperfect. You use Revely's output at your own judgement.</p>

<h2>4. Your account</h2>
<p>You sign in with Apple or Google. Keep your access to that account secure —
anything done through your account is treated as done by you. Tell us promptly if
you believe someone else has access. You may delete your account at any time from
Settings.</p>

<h2>5. Free scans</h2>
<p>New devices and new accounts receive a small number of free scans so you can
see what the app does before paying. The number is set by us and may change. Free
scans have no cash value, cannot be transferred, and may not be obtained by
creating repeat accounts or resetting devices.</p>

<h2>6. Subscriptions, trials, and billing</h2>
<p>Revely offers a monthly and an annual subscription. Current prices are shown in
the app before you buy, in your local currency.</p>
<ul>
  <li><strong>The free trial applies to the annual plan.</strong> The monthly plan
  is charged immediately when you subscribe. The app always states which applies
  before you confirm.</li>
  <li>Payment is charged to your Apple ID at confirmation of purchase.</li>
  <li><strong>Subscriptions renew automatically</strong> unless you turn off
  auto-renew at least <strong>24 hours before</strong> the current period ends.
  Your account is charged for renewal within 24 hours before the period ends.</li>
  <li>If you take a free trial, any unused part of it is forfeited when you buy a
  subscription during the trial. This is Apple's rule and applies across the App
  Store.</li>
  <li><strong>You manage and cancel subscriptions in your Apple ID settings</strong>,
  not inside Revely and not by writing to us. Neither deleting the app nor
  deleting your Revely account cancels a subscription — cancel with Apple first,
  or the charges continue.</li>
  <li>One free trial per person. We cannot grant a second one.</li>
</ul>
<p>Refunds are handled by Apple under the terms of the App Store, and we are not
able to issue them ourselves. If a charge looks wrong, contact Apple Support, and
tell us as well so we can look into it.</p>
<p>If you bought a scan pack before subscriptions existed, those scans remain
yours. They do not expire and they never auto-renew, exactly as promised when you
bought them. They work alongside a subscription.</p>

<h2>7. Using the app properly</h2>
<p>Please do not: use Revely for anything unlawful; try to break, overload, or
probe the service; scrape or bulk-extract our content; reverse-engineer the app
except where the law says you may; resell access; or submit content that is not
yours to submit. We may suspend accounts that do these things.</p>

<h2>8. Our content</h2>
<p>The app, its design, its writing, and its ingredient assessments belong to
${LEGAL_ENTITY} and are protected by copyright. You get a personal,
non-exclusive, non-transferable licence to use Revely for your own purposes. Your
own content — your profiles and your scans — remains yours; you grant us only the
permission needed to operate the service for you.</p>

<h2>9. Ending things</h2>
<p>You may stop using Revely and delete your account whenever you like. We may
suspend or end access if these terms are broken, or if we discontinue the
service. If we discontinue it, we will give reasonable notice and honour paid
periods you have already bought.</p>

<h2>10. Disclaimers and limits</h2>
<p>To the fullest extent the law allows, Revely is provided "as is" and "as
available", without warranties of any kind, and we disclaim implied warranties of
merchantability, fitness for a particular purpose, and non-infringement.</p>
<p>To the fullest extent the law allows, ${LEGAL_ENTITY} is not liable for
indirect, incidental, special, or consequential damages, and our total liability
for any claim is limited to what you paid us in the twelve months before it
arose.</p>
<p>Some places do not allow these exclusions. Nothing here removes rights you have
under the consumer law where you live, and nothing here limits liability for
death or personal injury caused by our negligence, or for fraud.</p>

<h2>11. Apple</h2>
<p>Apple is not a party to these terms and is not responsible for Revely. Apple
has no obligation to provide support for the app. If the app fails to conform to
any warranty, you may notify Apple and Apple will refund the purchase price;
Apple has no other warranty obligation. Apple and its subsidiaries are
third-party beneficiaries of these terms and may enforce them against you.</p>

<h2>12. Changes</h2>
<p>We may update these terms. If a change matters, we will update the date at the
top and tell you in the app before it takes effect. Continuing to use Revely
afterwards means the new terms apply.</p>

<h2>13. Governing law</h2>
<p>These terms are governed by the laws of ${GOVERNING_LAW}, without regard to its
conflict-of-laws rules, except where the consumer law of your own country gives
you rights that cannot be overridden.</p>

<h2>14. Contact</h2>
<p>${LEGAL_ENTITY} — <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`);

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

/**
 * The Aperture, as SVG.
 *
 * Transcribed from mobile/src/components/aperture-mark.tsx on the same
 * 100-unit grid, at its LARGE optical size — four detached corner brackets
 * over two text bars. Inline rather than a file for the reason the whole
 * module is inline: `build:server` is one esbuild bundle and copies no assets.
 */
const MARK = `<svg viewBox="0 0 100 100" width="44" height="44" fill="currentColor" aria-hidden="true">
  <path d="M11.5 11.5h25v5h-25z"/><path d="M11.5 11.5h5v25h-5z"/>
  <path d="M63.5 11.5h25v5h-25z"/><path d="M83.5 11.5h5v25h-5z"/>
  <path d="M63.5 83.5h25v5h-25z"/><path d="M83.5 63.5h5v25h-5z"/>
  <path d="M11.5 83.5h25v5h-25z"/><path d="M11.5 63.5h5v25h-5z"/>
  <rect x="27" y="41" width="46" height="6"/><rect x="27" y="55" width="32" height="6"/>
</svg>`;

/**
 * The home page.
 *
 * It exists because three separate parties ask for one and the site had
 * nothing at the root but a JSON 404: Google's OAuth consent screen wants an
 * application home page before it will let the app be published, the App Store
 * listing wants a marketing URL, and anyone who reads a privacy policy and
 * wonders who wrote it needs somewhere to land.
 *
 * Deliberately not a marketing site. It says what the app does, who publishes
 * it, and where the documents are. It does not claim an App Store link that
 * does not exist yet — a dead "Download" button on the page a reviewer visits
 * is worse than no button.
 */
const HOME = shell(
  "Revely · Scan a label, know what it means for you",
  `  <p class="brandmark">${MARK}</p>
  <h1>Scan a label. Know what it means for you.</h1>
  <p class="updated">An iOS app from ${LEGAL_ENTITY}</p>`,
  `<div class="summary">
<p>Point your camera at an ingredient list and Revely reads it — in any
language — and checks it against the allergies, conditions and dietary rules of
whoever you are shopping for.</p>
<p>Every verdict names the authority behind it: findings published by the FDA,
EFSA, IARC and the WHO, quoted rather than summarised, so you can see who says
so and decide for yourself.</p>
</div>

<h2>Documents</h2>
<ul>
  <li><a href="/privacy">Privacy Policy</a> — what we collect, what we never
  collect, and every company that receives anything.</li>
  <li><a href="/terms">Terms of Use</a> — including what Revely is not, which is
  a medical device or a substitute for advice from a clinician.</li>
  <li><a href="/health-data-privacy">Consumer Health Data Privacy Policy</a> —
  required by Washington's My Health My Data Act, and written for it.</li>
</ul>

<h2>Contact</h2>
<p>${LEGAL_ENTITY} — <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
<p>Privacy requests go to the same address, and are answered within 30 days.</p>
`,
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Mount the legal pages.
 *
 * Must run before serveStatic(), whose catch-all answers everything it does not
 * recognise with a 404 — registering after it would make both pages unreachable
 * and fail an App Store submission for a reason nothing in the app would show.
 */
export function registerLegalRoutes(app: Express): void {
  const send = (html: string) => (_req: unknown, res: any) => {
    res.type("html").send(html);
  };

  // The root used to answer `{"message":"Not found"}` — see serveStatic's
  // API-only branch, whose catch-all this must be registered before.
  app.get("/", send(HOME));

  app.get("/privacy", send(PRIVACY));
  app.get("/terms", send(TERMS));
  app.get("/health-data-privacy", send(HEALTH_DATA));

  // The App Store listing form and older links have used these spellings.
  // A legal URL that 404s is worse than a redirect nobody needed.
  app.get("/privacy-policy", (_req, res) => res.redirect(301, "/privacy"));
  app.get("/legal/privacy", (_req, res) => res.redirect(301, "/privacy"));
  app.get("/terms-of-use", (_req, res) => res.redirect(301, "/terms"));
  app.get("/legal/terms", (_req, res) => res.redirect(301, "/terms"));
}
