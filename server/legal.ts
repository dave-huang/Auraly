import type { Express } from "express";

import {
  CONTACT_EMAIL,
  FONT_FACES,
  HEAD_COMMON,
  LAMPLIGHT_TOKENS,
  LEGAL_ENTITY,
  lockupLink,
  PAPER_TOKENS,
  TYPE_TOKENS,
  footerInner,
} from "./siteTheme";
import { COPY } from "./siteCopy";

/**
 * The three legal documents.
 *
 * The marketing home page moved to server/home.ts when it grew past two
 * paragraphs and a list of links. These are legal instruments and want a
 * different shell; the note at the top of that file explains the split.
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

/**
 * Jurisdiction for disputes. Legal-only, so it stays here rather than in
 * siteTheme, which the home page also imports and has no use for it.
 */
const GOVERNING_LAW =
  process.env.LEGAL_GOVERNING_LAW || "the State of Washington, USA";

/** Shown as "last updated". Bump when the text changes in substance. */
const LAST_UPDATED = "8 September 2026";

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
const STYLE = `${FONT_FACES}
:root {${PAPER_TOKENS}${TYPE_TOKENS}}
@media (prefers-color-scheme: dark) { :root {${LAMPLIGHT_TOKENS}} }

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink-muted);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  /* Pins the footer to the bottom on a short document, so a tall window does
     not show a band of bare paper under it. */
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
main { flex: 1 0 auto; }
.foot { flex: none; }

.shell { max-width: 42rem; margin: 0 auto; padding-inline: 24px; }

/* ---- masthead --------------------------------------------------------- */

.top { padding-block: 30px 0; }
.lockup { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: var(--ink); }
.lockup .mark { width: 26px; height: 26px; flex: none; }
.lockup b { font-weight: 600; font-size: 1.125rem; letter-spacing: -0.02em; }

.masthead { padding-block: 52px 28px; border-bottom: 1px solid var(--rule); margin-bottom: 36px; }

/* ---- type ------------------------------------------------------------- */
/*
 * Instrument Sans throughout, as everywhere else. The serif in this system
 * belongs to the verdict word and there is no verdict on a privacy policy.
 */

h1, h2, h3 { color: var(--ink); font-weight: 600; text-wrap: balance; }
h1 { font-size: clamp(2rem, 5vw, 2.75rem); line-height: 1.08; letter-spacing: -0.03em; margin: 0 0 14px; }
h2 {
  font-size: 1.4375rem; line-height: 1.25; letter-spacing: -0.02em;
  margin: 44px 0 14px; padding-top: 22px; border-top: 1px solid var(--rule);
}
h3 { font-size: 1.0625rem; line-height: 1.4; letter-spacing: -0.01em; margin: 26px 0 8px; }
p { margin: 0 0 16px; }
ul { margin: 0 0 16px; padding-left: 22px; }
li { margin-bottom: 9px; }
strong { color: var(--ink); font-weight: 600; }
em { font-style: italic; }
a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

.meta { font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.02em; color: var(--ink-muted); }
.updated {
  font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--ink-muted); margin: 0;
}

/* ---- document furniture ----------------------------------------------- */
/* Flat. Radius.flat is 0 in this system and a rounded card is a bug. */

.summary {
  background: var(--card); border: 1px solid var(--rule);
  padding: 22px 24px; margin: 0 0 10px;
}
.summary p:last-child, .callout p:last-child { margin-bottom: 0; }

/*
 * A 3px ink edge across the top rather than a rule down the left side. The
 * handoff deleted borderLeftWidth on cards, and the verdict card's own
 * emphasis is a heavy top edge, so this is the system's way of saying "read
 * this one properly".
 */
.callout {
  background: var(--sunk); border-top: 3px solid var(--ink);
  padding: 20px 22px; margin: 26px 0;
}

table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 0.9375rem; }
th, td { text-align: left; padding: 11px 14px 11px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
th {
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.11em; text-transform: uppercase; color: var(--ink-muted);
  border-bottom-color: var(--ink-faint);
}
.scroll { overflow-x: auto; }

/* ---- footer ----------------------------------------------------------- */
/*
 * The home page's footer inverts onto ink. This one cannot: these pages
 * follow the system theme, and an ink footer under a Lamplight document is
 * ink on ink. Same contents, painted from the tokens instead.
 */

.foot { margin-top: 64px; background: var(--sunk); padding-block: 40px 56px; }
.foot .shell { padding-top: 0; }
.foot a { color: var(--ink-muted); text-decoration: none; }
.foot a:hover { color: var(--ink); text-decoration: underline; }
.foot-links {
  display: flex; flex-wrap: wrap; gap: 10px 26px;
  margin: 0 0 26px; padding: 0; list-style: none; font-size: 0.9375rem;
}
.foot-row { display: flex; flex-wrap: wrap; gap: 18px 32px; align-items: center; justify-content: space-between; }
.foot .disclaimer { margin: 28px 0 0; max-width: 56ch; font-size: 0.8125rem; line-height: 1.6; color: var(--ink-faint); }
`;

/**
 * The document chrome.
 *
 * Now carries the site's masthead and footer rather than a bare title and
 * three links, so arriving here from the home page's footer does not feel
 * like leaving the site. The lockup goes back to the home page, which is the
 * only navigation a legal document should have.
 */
function shell(title: string, description: string, head: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
${HEAD_COMMON}
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="theme-color" content="#F6F1E7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16130F" media="(prefers-color-scheme: dark)">
<style>${STYLE}</style>
</head>
<body>
<header class="top">
  <div class="shell">${lockupLink("/", COPY.en.homeLabel)}</div>
</header>
<main class="shell">
<div class="masthead">
${head}
</div>
${body}
</main>
<footer class="foot">
  <div class="shell">
${footerInner(COPY.en)}
  </div>
</footer>
</body>
</html>`;
}

/** A legal document: title, and the date it last changed. */
function page(title: string, description: string, body: string): string {
  return shell(
    `${title} · Revely`,
    description,
    `  <h1>${title}</h1>
  <p class="updated">Last updated ${LAST_UPDATED}</p>`,
    body,
  );
}

// ---------------------------------------------------------------------------
// Privacy policy
// ---------------------------------------------------------------------------

const PRIVACY = page(
  "Privacy Policy",
  "What Revely collects, what it never collects, how long it is kept, and every company that receives anything.",
  `
<div class="summary">
  <p><strong>The short version.</strong> Revely reads product labels and tells you
  whether what is in them matters for you. To do that it needs to know what you
  are avoiding: allergies, dietary rules, medical conditions. That is health
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
severe each one is (including anaphylaxis), dietary rules, and health conditions,
which may include <strong>pregnancy, breastfeeding, an infant under twelve
months, kidney disease, high blood pressure, diabetes, celiac disease, and
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
<p>We do keep a one-way cryptographic hash of the image, a fixed-length
fingerprint the original cannot be reconstructed from, so that re-scanning the
same label does not have to be paid for and processed twice.</p>

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
<p>So that the app works before you have an account, your device generates a
random identifier the first time it runs and stores it in the iOS keychain. It
tells our server that a request came from a copy of our app rather than from
nobody in particular, and it is what the example scan during setup is attributed
to. It is not your advertising identifier, it contains nothing about you or your
hardware, and it is not shared with anyone. When you sign in, it is linked to
your account once, so that anything done on the device before you signed in
belongs to you afterwards.</p>

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
<em>name</em> only, never what was on it, so a crash never carries scan or
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
queue and not a deactivation. The records are deleted.</p>
<p><strong>Deleting your account does not cancel a subscription.</strong> Your
subscription lives with Apple, not with us, and only you can cancel it, in your
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
you enter it, and you may withdraw that consent at any time by deleting the
profile, which stops the processing.</p>
<p>If you are in California, we do not sell or share personal information as the
CCPA defines those terms, and we will never discriminate against you for
exercising any right described here.</p>

<h2>Children</h2>
<p>Revely is not directed at children, and you must be at least 13 to hold an
account. A parent may of course create a profile describing a child, including an
infant. That information belongs to the parent's account and is deleted with
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
<p>${LEGAL_ENTITY}, <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`,
);

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
const HEALTH_DATA = page(
  "Consumer Health Data Privacy Policy",
  "The consumer health data disclosures required by the Washington My Health My Data Act.",
  `
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
      <td>Health conditions you record in a profile, including pregnancy,
      breastfeeding, an infant under twelve months, kidney disease, high blood
      pressure, diabetes, and celiac disease</td>
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
<p>Our other providers (OpenAI, Apple, Google and RevenueCat) receive no
consumer health data. What each of them does receive is described in
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
<p>${LEGAL_ENTITY}, <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`,
);

// ---------------------------------------------------------------------------
// Terms of use
// ---------------------------------------------------------------------------

const TERMS = page(
  "Terms of Use",
  "The agreement for using Revely, including what it is not: a medical device, or a substitute for advice from a clinician.",
  `
<div class="summary">
  <p><strong>The short version.</strong> Revely helps you read ingredient labels.
  It is a reference tool, not a medical device and not a doctor. It can misread a
  label, and labels themselves change without notice. If a mistake would harm
  you, read the physical package and ask a professional.</p>
  <p>Subscriptions renew automatically until you cancel. You cancel in your Apple
  ID settings, not with us.</p>
</div>

<h2>1. Agreeing to these terms</h2>
<p>By using Revely you agree to these terms. If you do not agree, please do not
use the app. You must be at least 13 years old to hold an account.</p>

<h2>2. What Revely is, and is not</h2>
<p>Revely reads the ingredient list on a product and compares it against what you
have told it you avoid. Where we hold a published finding on an ingredient, we
quote it and name who published it. Where we do not, the app says what it can
about the ingredient in its own words, and does not dress that up as somebody
else's conclusion.</p>

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
<p>You sign in with Apple or Google. Keep your access to that account secure:
anything done through your account is treated as done by you. Tell us promptly if
you believe someone else has access. You may delete your account at any time from the
Account screen.</p>

<h2>5. Trying Revely before you pay</h2>
<p>Setting up a profile is free, and at the end of setup we show you a worked
example: a real ingredient list, checked against the profile you have just
built, so you can see what an answer looks like before deciding anything. It is
labelled as an example wherever it appears.</p>
<p>Scanning your own labels needs a subscription. The annual plan starts with a
free trial, described in the next section.</p>

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
  deleting your Revely account cancels a subscription. Cancel with Apple first,
  or the charges continue.</li>
  <li>One free trial per person. We cannot grant a second one.</li>
</ul>
<p>Refunds are handled by Apple under the terms of the App Store, and we are not
able to issue them ourselves. If a charge looks wrong, contact Apple Support, and
tell us as well so we can look into it.</p>

<h2>7. Using the app properly</h2>
<p>Please do not: use Revely for anything unlawful; try to break, overload, or
probe the service; scrape or bulk-extract our content; reverse-engineer the app
except where the law says you may; resell access; or submit content that is not
yours to submit. We may suspend accounts that do these things.</p>

<h2>8. Our content</h2>
<p>The app, its design, its writing, and its ingredient assessments belong to
${LEGAL_ENTITY} and are protected by copyright. You get a personal,
non-exclusive, non-transferable licence to use Revely for your own purposes. Your
own content, your profiles and your scans, remains yours; you grant us only the
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
<p>${LEGAL_ENTITY}, <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
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
