import type { Express } from "express";
import express from "express";
import path from "path";

import {
  CONTACT_EMAIL,
  FONT_FACES,
  LEGAL_ENTITY,
  LOCKUP_LINK,
  PAPER_TOKENS,
  TYPE_TOKENS,
  footerInner,
} from "./siteTheme";

/**
 * revely.life, the marketing page.
 *
 * Separate from `legal.ts` on purpose. That file publishes legal instruments:
 * one shell, one column, a "last updated" line, and a stylesheet App Store
 * reviewers have already read three documents through. This one sells the app
 * and needs a different set of tools entirely, and folding a landing page into
 * that shell would have meant either a compromised landing page or a restyled
 * privacy policy on the eve of a review. Both files share the same tokens,
 * which is where the family resemblance actually lives.
 *
 * Like the legal pages this is a string rather than a file, because
 * `build:server` is a lone esbuild bundle with no asset copying and an .html
 * next to this one would simply not exist in the container. The IMAGES cannot
 * be a string, so they are copied in by the Dockerfile and mounted below; see
 * `scripts/build-web-assets.py` for where every one of them comes from.
 *
 * ON THE DESIGN SYSTEM
 *
 * Two rules from `design_handoff_revely/` govern most of what follows and are
 * worth stating because both are easy to break by accident:
 *
 *   COLOUR IS MEANING. Green, amber and red belong to a verdict and nowhere
 *   else. There is not one saturated colour on this page. The only red on it
 *   is inside a screenshot, where it is doing its job.
 *
 *   THE SERIF BELONGS TO THE VERDICT WORD. Which is why a marketing page with
 *   an obvious appetite for a display serif is set in Instrument Sans from top
 *   to bottom, with IBM Plex Mono for the machine voice: eyebrows, figures,
 *   the names of the agencies. Same division of labour as the app. Newsreader
 *   is not loaded at all, and the only verdict word here is in a screenshot.
 *
 * ONE THEME, DELIBERATELY. The app follows the system theme; this page does
 * not. The ink wash plates ship as coverage with no colour in them, and the
 * web has no runtime tint to give them one, so a plate is baked as ink at
 * build time and would vanish on a dark ground. Every colour below is painted
 * explicitly rather than inherited, so the page holds whatever the browser
 * puts behind it.
 */

const APP_STORE_URL = "https://apps.apple.com/app/id6799481205";



const STYLE = `${FONT_FACES}

:root {
${PAPER_TOKENS}${TYPE_TOKENS}
  --shell: 1120px;
  --gutter: 24px;
  --band: clamp(76px, 9vw, 132px);
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.6;
  font-feature-settings: "kern" 1, "liga" 1;
  -webkit-font-smoothing: antialiased;
}

.shell { max-width: var(--shell); margin: 0 auto; padding-inline: var(--gutter); }

/* ---- type ------------------------------------------------------------- */

h1, h2, h3 { margin: 0; font-weight: 600; text-wrap: balance; }
h1 { font-size: clamp(2.55rem, 6.1vw, 4.3rem); line-height: 1.03; letter-spacing: -0.035em; }
h2 { font-size: clamp(1.95rem, 3.7vw, 2.9rem); line-height: 1.1;  letter-spacing: -0.03em; }
h3 { font-size: 1.3125rem; line-height: 1.3; letter-spacing: -0.02em; }
p  { margin: 0; color: var(--ink-muted); }

.lede { font-size: clamp(1.125rem, 1.5vw, 1.3125rem); line-height: 1.55; max-width: 34ch; }
.eyebrow {
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.17em; text-transform: uppercase; color: var(--ink-faint);
  margin: 0 0 20px;
}
/*
 * Faint ink on paper is 3.3:1, which the app can carry at arm's length on a
 * phone and a web page cannot. Anything in .meta says something a reader may
 * actually need (billing terms, who published a figure, who is speaking), so
 * it takes the muted ink and clears 4.5:1. The eyebrow keeps the faint ink:
 * it is a label whose words are repeated by the heading directly under it,
 * and it is the pairing the product itself ships.
 */
.meta { font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.02em; color: var(--ink-muted); }
/* Muted ink vanishes on the ink ground; there the faint is the light one. */
.close .meta, .foot .meta { color: #8A8175; }

a { color: var(--ink); text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

/* ---- the button ------------------------------------------------------- */
/*
 * Apple's own badge, served byte for byte as downloaded. Their guidelines
 * require the artwork unmodified, so there is deliberately no hover tint, no
 * scale on press and no recolouring here: every one of those is a change to
 * the badge. Height is 54px, comfortably over their 40px floor, and the
 * spacing around it clears a tenth of its height on every side.
 *
 * This is the one thing on the page that is not ours and does not obey the
 * system. It earns the exception by being the control people already know.
 */
.badge { display: inline-block; line-height: 0; border-radius: 10px; }
.badge img { display: block; height: 54px; width: auto; }
.badge:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; }
.close .badge:focus-visible { outline-color: var(--paper); }

.terms { margin-top: 16px; }

/* ---- header ----------------------------------------------------------- */

.top { padding: 30px 0 0; }
.lockup { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: var(--ink); }
.lockup .mark { width: 26px; height: 26px; flex: none; }
.lockup b { font-weight: 600; font-size: 1.125rem; letter-spacing: -0.02em; }

/* ---- hero ------------------------------------------------------------- */

/*
 * The headline spans both columns and the picture sits beside the paragraph,
 * not beside the headline. Setting them side by side halved the measure, and
 * "Know what you're eating." wants about eleven ems: in half a shell that
 * caps the type at 49px, which is a subheading pretending to be a headline.
 * Given the whole page it runs at full size on two lines, which is the line.
 */
.hero {
  display: grid; gap: clamp(24px, 2.6vw, 34px) clamp(28px, 4vw, 56px);
  grid-template-columns: 1fr;
  padding-block: clamp(44px, 6vw, 76px) clamp(60px, 7.5vw, 96px);
}
.hero h1 { grid-column: 1 / -1; }
.hero .lede { margin: 0 0 32px; }
.hero-plate { justify-self: center; width: 100%; max-width: 580px; }
.hero-plate img { display: block; width: 100%; height: auto; }

@media (min-width: 880px) {
  .hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
  .hero-copy { max-width: 31rem; padding-top: 4px; }
  .hero-plate { justify-self: end; align-self: start; margin: -22px -3% 0 0; }
}

/* ---- bands ------------------------------------------------------------ */

.band { padding-block: var(--band); }
.band.sunk { background: var(--sunk); }
.band.ruled { border-top: 1px solid var(--rule); }
.band-head { max-width: 40rem; }
.band-head .lede { max-width: 46ch; margin-top: 20px; }

/* ---- the pivot -------------------------------------------------------- */
/*
 * This held a cited statistic and now holds a plain statement, which is why
 * there is no mono attribution line beside it any more: nothing here is
 * quoting anybody, so nothing here should be dressed as a quotation.
 */

.stat {
  margin: clamp(40px, 5vw, 60px) 0 0;
  padding: 26px 0 0; border-top: 1px solid var(--rule);
  max-width: 48ch;
}
.stat-line {
  font-size: clamp(1.25rem, 2.2vw, 1.6rem); font-weight: 500; line-height: 1.28;
  letter-spacing: -0.02em; color: var(--ink); text-wrap: balance;
  margin-bottom: 12px;
}

/* ---- plate cards ------------------------------------------------------ */

.cards { display: grid; gap: 1px; margin-top: clamp(36px, 4vw, 52px); background: var(--rule); border: 1px solid var(--rule); }
@media (min-width: 760px) { .cards { grid-template-columns: repeat(3, 1fr); } }
.card { background: var(--card); padding: 26px 26px 30px; display: flex; flex-direction: column; }
.card .plate { height: 138px; margin: 2px 0 24px; display: flex; align-items: flex-end; }
.card .plate img { height: 100%; width: auto; max-width: 100%; object-fit: contain; object-position: left bottom; }
.card h3 { margin-bottom: 10px; }
.card p { font-size: 0.9375rem; line-height: 1.55; }

.aside { margin-top: 30px; font-size: 1.0625rem; color: var(--ink); }

/* ---- the three screens ------------------------------------------------ */

.steps { display: grid; gap: clamp(38px, 4vw, 46px); margin-top: clamp(44px, 5vw, 64px); }
@media (min-width: 760px) { .steps { grid-template-columns: repeat(3, 1fr); } }
.step img.screen {
  display: block; width: 100%; height: auto;
  border-radius: 12.5% / 5.75%;
  border: 1px solid var(--rule);
  box-shadow: 0 1px 2px rgba(22,19,15,.09), 0 22px 40px -18px rgba(22,19,15,.34);
}
.step .num { display: block; margin: 24px 0 8px; }
.step h3 { margin-bottom: 8px; }
.step p { font-size: 0.9375rem; line-height: 1.55; }

/* ---- feature rows ----------------------------------------------------- */

.rows { margin-top: 4px; }
/* The band already draws the divider above this list. A row rule on top of
   it reads as a mistake rather than as two rules. */
.row:first-child { border-top: 0; padding-top: 0; }
.row {
  display: grid; gap: clamp(24px, 4vw, 64px); align-items: center;
  padding: clamp(44px, 5vw, 64px) 0; border-top: 1px solid var(--rule);
}
@media (min-width: 820px) {
  .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .row.flip .row-plate { order: -1; }
}
.row-plate { display: flex; justify-content: center; }
.row-plate img { display: block; max-width: min(300px, 78%); height: auto; }
.row h3 { font-size: clamp(1.45rem, 2.3vw, 1.85rem); letter-spacing: -0.025em; margin-bottom: 14px; }
.row p { max-width: 40ch; }

.agencies { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; list-style: none; padding: 0; }
.agencies li {
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.12em; color: var(--ink-muted);
  border: 1px solid var(--rule); background: var(--card);
  padding: 7px 12px; border-radius: 999px;
}

/* ---- testimonials ----------------------------------------------------- */

.quotes { display: grid; gap: 20px; margin-top: clamp(38px, 4vw, 54px); }
@media (min-width: 820px) { .quotes { grid-template-columns: repeat(3, 1fr); } }
.quote {
  /* <figure> carries a UA margin of 1em 40px. Without this the cards are
     inset forty pixels on each side and nothing lines up with the heading. */
  margin: 0;
  background: var(--card); border: 1px solid var(--rule);
  padding: 28px 26px 26px; display: flex; flex-direction: column;
}
.quote blockquote { margin: 0 0 20px; font-size: 1.0625rem; line-height: 1.55; color: var(--ink); }
.quote figcaption { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--rule); }

/* ---- closing band ----------------------------------------------------- */

.close {
  position: relative; overflow: hidden;
  background: var(--ink); color: var(--paper);
  padding-block: clamp(80px, 10vw, 136px);
}
.close h2 { color: var(--paper); }
.close p { color: #B8AD99; }
.close .shell { position: relative; }
.close-inner { max-width: 34rem; }
.close .terms { color: #8A8175; }
.close-plate {
  position: absolute; right: -26px; bottom: 10px; width: min(400px, 42%);
  opacity: .28; pointer-events: none; user-select: none;
}
.close-plate img { display: block; width: 100%; height: auto; }
@media (max-width: 820px) { .close-plate { display: none; } }

/* ---- footer ----------------------------------------------------------- */

.foot { background: var(--ink); color: #8A8175; padding-block: 0 64px; }
.foot .shell { border-top: 1px solid #332C24; padding-top: 40px; }
.foot a { color: #B8AD99; text-decoration: none; }
.foot a:hover { color: var(--paper); text-decoration: underline; }
.foot-links { display: flex; flex-wrap: wrap; gap: 10px 26px; margin: 0 0 26px; padding: 0; list-style: none; font-size: 0.9375rem; }
.foot .lockup { color: var(--paper); }
.foot-row { display: flex; flex-wrap: wrap; gap: 18px 32px; align-items: center; justify-content: space-between; }
.foot .disclaimer { margin-top: 28px; max-width: 56ch; font-size: 0.8125rem; line-height: 1.6; color: #8A8175; }

/* ---- the reveal ------------------------------------------------------- */
/*
 * A plate rises once and stays risen. The system's rule for anything that
 * reveals is that it must END RESOLVED, so there is no loop and no exit
 * state, and the class is only ever added. The .js hook is set by script,
 * which means a reader with no JavaScript gets the finished page rather
 * than a blank one, and reduced motion gets it too.
 */
.js .rise { opacity: 0; transform: translateY(22px); }
.js .rise.in { opacity: 1; transform: none; transition: opacity .62s cubic-bezier(.16,1,.3,1), transform .62s cubic-bezier(.16,1,.3,1); }
@media (prefers-reduced-motion: reduce) {
  .js .rise { opacity: 1; transform: none; transition: none; }
}
`;

/**
 * PLACEHOLDER TESTIMONIALS. NOT REAL PEOPLE, NOT REAL QUOTES.
 *
 * Written to hold the shape of the section while the app is in review and
 * there is nobody to quote yet. Every one of them has to be replaced with a
 * real, attributable quote from a real user before this page is published,
 * or it is a fabricated endorsement on the marketing site of a health
 * product, which is both a lie and the kind of lie a regulator has a name
 * for. If real quotes are not ready on launch day, DELETE THE SECTION. An
 * absent testimonial costs a little momentum; an invented one costs the
 * only thing this product is selling, which is that we do not make things up.
 *
 * Dave asked for them on the page on 2026-09-08, having been told twice that
 * they are invented. That is his call to make and this comment is not an
 * argument with it, but the next person to open this file should know what
 * they are reading: nobody said any of this. Replace all three the moment
 * there are real users to quote.
 */
const TESTIMONIALS = [
  {
    quote:
      "My son reacts to tree nuts, and cashew hides under about six different names. I stopped trusting myself to catch all of them at four in the afternoon with a cart. Now I just scan it.",
    name: "Maya R.",
    detail: "Parent of two",
  },
  {
    quote:
      "I lived in Spain for a year and never once read a label properly. Revely puts the printed Spanish next to the English and I can finally see what I have been eating.",
    name: "Tom W.",
    detail: "Uses it abroad",
  },
  {
    quote:
      "I am not allergic to anything. I just wanted to know what half the words meant. It tells me who looked at an ingredient and what they found, and then it leaves me alone to decide.",
    name: "Priya S.",
    detail: "Reads everything",
  },
];

/** Black on the paper ground, white on the ink band. */
const badge = (colour: "black" | "white") =>
  `<a class="badge" href="${APP_STORE_URL}">` +
  `<img src="/media/appstore-badge-${colour}.svg" width="162" height="54"` +
  ` alt="Download on the App Store"></a>`;

const plate = (name: string, alt = "") =>
  `<img src="/media/plates/${name}.webp" alt="${alt}" loading="lazy" decoding="async">`;

const BODY = `
<header class="top">
  <div class="shell">
    ${LOCKUP_LINK}
  </div>
</header>

<main>

  <!-- Hook. Headline, one line under it, one button, one picture. Nothing
       else is allowed above the fold; every extra thing here is a thing
       somebody reads instead of the headline. -->
  <section class="shell hero">
    <h1>Shop anywhere.<br>Know what you&rsquo;re eating.</h1>
    <div class="hero-copy">
      <p class="lede">Point your camera at any ingredient list, in any
      language. We&rsquo;ll tell you what it means for you, and for anyone you
      shop for.</p>
      ${badge("black")}
      <p class="meta terms">For iPhone. The annual plan starts with a 7-day free trial.</p>
    </div>
    <div class="hero-plate">
      <img src="/media/plates/scanning.webp" width="1200" height="682" alt="A hand holding a phone up to the back of a snack pouch." fetchpriority="high" decoding="async">
    </div>
  </section>

  <!-- Problem. The aisle, and why it is genuinely hard rather than a thing
       careless people get wrong. Each of the three cards is a fact that can
       be checked, not a worry. -->
  <section class="band sunk">
    <div class="shell">
      <div class="band-head rise">
        <p class="eyebrow">The aisle</p>
        <h2>You turn the packet over, and you&rsquo;re none the wiser.</h2>
        <p class="lede">Twelve lines of small print, half of them words nobody
        uses outside a laboratory. Somewhere in there is the thing you avoid,
        or there isn&rsquo;t. There is no way to tell while you are standing
        there holding it.</p>
      </div>

      <div class="stat rise">
        <p class="stat-line">Ingredient labels aren&rsquo;t always easy to decode.</p>
        <p>You shouldn&rsquo;t have to Google every ingredient just to understand
        what you&rsquo;re buying.</p>
      </div>

      <div class="cards rise">
        <div class="card">
          <div class="plate">${plate("milk")}</div>
          <h3>One ingredient, a dozen names.</h3>
          <p>Whey. Casein. Lactose. Sodium caseinate. Every one of them is
          milk, and only one of them says so.</p>
        </div>
        <div class="card">
          <div class="plate">${plate("tag")}</div>
          <h3>The rules keep moving.</h3>
          <p>Sesame only became a required allergen label in the US in 2023.
          The EU pulled titanium dioxide out of food in 2022. The US still
          allows it.</p>
        </div>
        <div class="card">
          <div class="plate">${plate("language")}</div>
          <h3>And it isn&rsquo;t always in your language.</h3>
          <p>A jar from the Asian grocery. A snack somebody brought back. A
          pack printed for a market that isn&rsquo;t yours.</p>
        </div>
      </div>

      <p class="aside rise">So you put it back on the shelf. Or you buy it and hope.</p>
    </div>
  </section>

  <!-- Solution. The three screens are real captures of the shipping build,
       in the order a person actually meets them. -->
  <section class="band">
    <div class="shell">
      <div class="band-head rise">
        <p class="eyebrow">What Revely does</p>
        <h2>Tell us once. We check every label against it.</h2>
        <p class="lede">Setting it up takes about a minute. After that the
        camera does the work.</p>
      </div>

      <div class="steps">
        <div class="step rise">
          <img class="screen" src="/media/screens/04-who.webp" width="660" height="1434" loading="lazy" decoding="async" alt="A Revely screen headed &quot;Who are we checking for?&quot; offering Myself, My child, and Someone I care for.">
          <span class="num meta">Step one</span>
          <h3>Say who it&rsquo;s for.</h3>
          <p>You, your child, a partner, a parent you cook for. Everyone gets a
          profile of their own.</p>
        </div>
        <div class="step rise">
          <img class="screen" src="/media/screens/05-allergens.webp" width="660" height="1434" loading="lazy" decoding="async" alt="A Revely screen headed &quot;What's off-limits for Jane?&quot; with allergens listed as tappable chips.">
          <span class="num meta">Step two</span>
          <h3>Say what to watch for.</h3>
          <p>Allergies, and how strict to be about each one. Conditions
          you&rsquo;re managing. Diets you keep to.</p>
        </div>
        <div class="step rise">
          <img class="screen" src="/media/screens/01-verdict.webp" width="660" height="1434" loading="lazy" decoding="async" alt="A Revely verdict card reading Avoid, because tree nuts are on Jane's list, with the Spanish label printed beside its English translation.">
          <span class="num meta">Step three</span>
          <h3>Then point the camera.</h3>
          <p>One word, and the reason under it. The printed label on one side,
          your language on the other.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- The three things that actually separate this from a barcode lookup. -->
  <section class="band ruled">
    <div class="shell rows">
      <div class="row rise">
        <div>
          <h3>We show you who says so.</h3>
          <p>Where there is a published finding on an ingredient, we quote it
          and name who published it. Their words, not our summary of them. You
          read it, and you decide.</p>
          <ul class="agencies"><li>FDA</li><li>EFSA</li><li>IARC</li><li>WHO</li></ul>
        </div>
        <div class="row-plate">${plate("sources")}</div>
      </div>

      <div class="row flip rise">
        <div>
          <h3>One photo, everybody&rsquo;s answer.</h3>
          <p>Switch to another profile and the scan already on screen is
          rechecked straight away. You don&rsquo;t have to take the picture
          again.</p>
        </div>
        <div class="row-plate">${plate("bowls")}</div>
      </div>

      <div class="row rise">
        <div>
          <h3>Your photo is used once, then it&rsquo;s gone.</h3>
          <p>It isn&rsquo;t kept after it has been read. No advertising, no
          trackers, nothing sold. What we collect and every company that
          receives anything is written out in the
          <a href="/privacy">privacy policy</a>.</p>
        </div>
        <div class="row-plate">${plate("privacy")}</div>
      </div>
    </div>
  </section>

  <!-- Social proof. See the note above TESTIMONIALS: these are placeholders
       and every one of them needs replacing with a real quote. -->
  <section class="band sunk">
    <div class="shell">
      <div class="band-head rise">
        <p class="eyebrow">What people say</p>
        <h2>The aisle gets a lot quieter.</h2>
      </div>
      <div class="quotes rise">
        ${TESTIMONIALS.map(
          (t) => `<figure class="quote">
          <blockquote>&ldquo;${t.quote}&rdquo;</blockquote>
          <figcaption><strong>${t.name}</strong><br><span class="meta">${t.detail}</span></figcaption>
        </figure>`,
        ).join("\n        ")}
      </div>
    </div>
  </section>

  <!-- Close. The one place on the page that inverts, so the last thing on it
       is unmistakably the last thing on it. -->
  <section class="close">
    <div class="close-plate">${plate("basket-lift")}</div>
    <div class="shell">
      <div class="close-inner">
        <h2>Know what you&rsquo;re eating.</h2>
        <p class="lede" style="margin:20px 0 34px">Set up a profile, see an
        example scan, and take it to the shops.</p>
        ${badge("white")}
        <p class="meta terms">For iPhone. The annual plan starts with a 7-day free trial.</p>
      </div>
    </div>
  </section>

</main>

<footer class="foot">
  <div class="shell">
${footerInner()}
  </div>
</footer>

<script>
  // Everything the reveal needs, and nothing it doesn't. The class goes on
  // first so a browser without IntersectionObserver, or with scripting off,
  // never hides anything it cannot then show.
  (function () {
    if (!("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.06 });
    document.querySelectorAll(".rise").forEach(function (el) { io.observe(el); });
  })();
</script>`;

const TITLE = "Revely · Scan any food label, in any language";
const DESCRIPTION =
  "Point your camera at any ingredient list, in any language. Revely reads it " +
  "and tells you what it means for your allergies, your conditions, and " +
  "anyone you shop for.";

const HOME = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<link rel="canonical" href="https://revely.life/">
<meta name="theme-color" content="#F6F1E7">
<link rel="icon" href="/media/favicon.png" sizes="48x48">
<link rel="apple-touch-icon" href="/media/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:url" content="https://revely.life/">
<meta property="og:site_name" content="Revely">
<meta property="og:title" content="Shop anywhere. Know what you’re eating.">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="https://revely.life/media/og-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="font" type="font/woff2" href="/media/fonts/instrument-sans-600.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/media/fonts/instrument-sans-400.woff2" crossorigin>
<style>${STYLE}</style>
</head>
<body>
${BODY}
</body>
</html>`;

/**
 * Mount the home page and the images it needs.
 *
 * Registered before `serveStatic()` for the same reason the legal routes are:
 * its catch-all answers everything it does not recognise, so anything mounted
 * after it is unreachable.
 */
export function registerHomeRoutes(app: Express): void {
  // process.cwd(), not import.meta.dirname: the server runs as a single
  // bundled file in dist/, and this directory is copied to /app/server/web by
  // the Dockerfile. Same convention as server/data.
  app.use(
    "/media",
    express.static(path.resolve(process.cwd(), "server/web/media"), {
      // Fingerprinting these would mean a build step the rest of this server
      // does not have. A day is short enough that a change is not stuck for
      // long and long enough that a repeat visit costs nothing.
      maxAge: "1d",
      immutable: false,
      fallthrough: false,
    }),
  );

  app.get("/", (_req, res) => {
    res.type("html").send(HOME);
  });
}
