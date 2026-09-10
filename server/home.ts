import type { Express } from "express";
import express from "express";
import path from "path";

import {
  FONT_FACES,
  HEAD_COMMON,
  PAPER_TOKENS,
  TYPE_TOKENS,
  footerInner,
  lockupLink,
} from "./siteTheme";
import {
  COPY,
  HTML_LANG,
  LANGUAGE_CODES,
  LANGUAGE_NAMES,
  SITE_LANGUAGES,
  isLang,
  type Copy,
  type Lang,
} from "./siteCopy";

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

/** Absolute, because canonical, hreflang and og:url all have to be. */
const SITE_ORIGIN = "https://revely.life";

/**
 * Open Graph wants a territory with the language. These are the ones the app
 * was written for, and they are a scrape hint rather than a claim about who
 * the copy is for: the Spanish is not written for Spain in particular.
 */
const OG_LOCALE: Record<Lang, string> = {
  en: "en_US",
  zh: "zh_CN",
  es: "es_ES",
};



const STYLE = `${FONT_FACES}

:root {
${PAPER_TOKENS}${TYPE_TOKENS}
  --shell: 1120px;
  --gutter: 24px;
  --band: clamp(72px, 8vw, 116px);
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
 * actually need (who is speaking, who published a figure), so
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

/* ---- the scroll cue --------------------------------------------------- */
/*
 * A hairline with a short ink segment that travels down it once and stays
 * there. Once, because the system's own rule for anything that reveals is
 * that it ends resolved: a loop reads as still trying, which is why the
 * scanner in the app sweeps a single time.
 *
 * It sits in the gap under the hero copy, which the taller plate column
 * already pays for, so it costs the hero no height on desktop and cannot push
 * the very fold it exists to advertise further down. Below the two-column
 * breakpoint there is no gap to borrow and no need for the hint, since a
 * stacked hero is visibly cut off on its own.
 *
 * FLEX, NOT INLINE-FLEX, AND THAT DISTINCTION IS THE WHOLE BUG. The badge above
 * is inline-block. While a paragraph of subscription terms sat between the two
 * it did not matter, because a block element forced the line break. Once that
 * paragraph was deleted an inline-level cue flowed up onto the badge's line,
 * and a 52px vertical hairline that reads as a scroll hint under the copy
 * reads as a divider welded to the CTA when it sits beside it. Block-level
 * flex keeps the row layout the rail needs and the line break it needs.
 */
.cue { display: none; }
@media (min-width: 880px) {
  .cue {
    display: flex; width: max-content; align-items: center; gap: 14px;
    margin-top: 40px; text-decoration: none; color: var(--ink-faint);
    font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
    letter-spacing: 0.17em; text-transform: uppercase;
  }
}
.cue:hover { color: var(--ink-muted); }
.cue-rail {
  position: relative; display: block; width: 1px; height: 52px;
  background: var(--rule); overflow: hidden; flex: none;
}
.cue-rail::after {
  content: ""; position: absolute; left: 0; width: 1px; height: 18px;
  background: var(--ink); top: 34px;
  animation: cue-run 1.5s cubic-bezier(.16, 1, .3, 1) .9s 1 backwards;
}
@keyframes cue-run { from { top: -18px; } to { top: 34px; } }
@media (prefers-reduced-motion: reduce) { .cue-rail::after { animation: none; } }

/* ---- header ----------------------------------------------------------- */

.top { padding: 30px 0 0; }
.top-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.lockup { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: var(--ink); }
.lockup .mark { width: 26px; height: 26px; flex: none; }
.lockup b { font-weight: 600; font-size: 1.125rem; letter-spacing: -0.02em; }

/* ---- the language switcher -------------------------------------------- */
/*
 * Three links rather than a menu, and the current one filled the same way an
 * active agency chip is, so the page has one vocabulary for "this is the one
 * you are on".
 */
.langs { display: flex; align-items: center; gap: 2px; flex: none; }
.lang {
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.1em; line-height: 1; color: var(--ink-faint);
  text-decoration: none; padding: 8px 10px; border-radius: 999px;
  transition: color .12s ease, background-color .12s ease;
}
.lang:hover { color: var(--ink); }
.lang.on { color: var(--paper); background: var(--ink); }
/* 中文 is two wide glyphs; letter-spacing built for EN and ES pulls it apart. */
.lang[lang="zh-Hans"] { letter-spacing: 0.02em; }

.legal-note { margin: -12px 0 22px; }

/* ---- Chinese ---------------------------------------------------------- */
/*
 * The Latin type here runs at negative tracking, which is right for a
 * grotesque at display sizes and wrong for Han characters: they are drawn on
 * a fixed square and tightening them closes gaps the glyphs need. The same
 * goes the other way for the mono labels, where 0.17em between two ideographs
 * reads as two separate words. Chinese also wants a looser line, because the
 * characters carry more ink per line than an alphabet does.
 *
 * Scoped to the document language rather than the font, so it cannot leak
 * onto the English and Spanish pages.
 */
html[lang="zh-Hans"] h1, html[lang="zh-Hans"] h2, html[lang="zh-Hans"] h3,
html[lang="zh-Hans"] .stat-line { letter-spacing: 0; }
html[lang="zh-Hans"] h1 { line-height: 1.22; }
html[lang="zh-Hans"] h2 { line-height: 1.34; }
html[lang="zh-Hans"] body { line-height: 1.85; }
html[lang="zh-Hans"] .lede { line-height: 1.75; }
html[lang="zh-Hans"] .eyebrow, html[lang="zh-Hans"] .cue,
html[lang="zh-Hans"] .num, html[lang="zh-Hans"] .agency,
html[lang="zh-Hans"] .agency-full { letter-spacing: 0.06em; }

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
  padding-block: clamp(36px, 4.4vw, 60px) clamp(48px, 5.4vw, 72px);
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

/*
 * The chips are buttons, not decoration, and they answer in a panel below
 * rather than a floating tooltip. A tooltip would have to be positioned,
 * clipped and re-positioned near the viewport edge, and on a phone it has no
 * hover to open it at all. One panel under the row has none of those problems
 * and is reachable by tap, click and keyboard identically.
 */
.agencies { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; list-style: none; padding: 0; }
.agency {
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.12em; color: var(--ink-muted);
  border: 1px solid var(--rule); background: var(--card);
  padding: 8px 13px; border-radius: 999px; cursor: pointer;
  transition: color .12s ease, border-color .12s ease, background-color .12s ease;
}
.agency:hover { color: var(--ink); border-color: var(--ink-faint); }
/*
 * .on is the chip whose text is on screen; aria-pressed is the one actually
 * chosen. They are usually the same and deliberately come apart while a
 * pointer is previewing another, because the fill should follow what you are
 * reading, and a pressed state that flips on hover would be a lie to anything
 * listening to it.
 */
.agency.on {
  color: var(--paper); background: var(--ink); border-color: var(--ink);
}
.agency:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }

/*
 * All four entries live in ONE grid cell, stacked, and the cell is therefore
 * always as tall as the longest of them. Only opacity changes, so moving from
 * chip to chip cannot move anything on the page.
 *
 * The first version reserved space with a min-height instead, which was wrong
 * twice over: it only applied above 820px, and the panel started hidden, so
 * the first hover grew the box from nothing and leaving collapsed it again.
 * Every hover in and out shoved the rest of the page. A guessed height is also
 * a guess about a font that had not loaded yet and a column width that varies;
 * the tallest child measures itself and is right at every width.
 *
 * One entry is shown from the start. An empty box waiting to be discovered is
 * both a worse resting state and a second thing to size around.
 */
.agency-detail {
  display: grid;
  margin-top: 18px; padding: 16px 18px;
  background: var(--card); border: 1px solid var(--rule);
  max-width: 42ch;
}
.agency-panel {
  grid-area: 1 / 1;
  opacity: 0; visibility: hidden;
  transition: opacity .16s ease, visibility 0s linear .16s;
}
.agency-panel.on {
  opacity: 1; visibility: visible;
  transition: opacity .16s ease, visibility 0s;
}
@media (prefers-reduced-motion: reduce) { .agency-panel { transition: none; } }
.agency-full {
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.11em; text-transform: uppercase; color: var(--ink-faint);
  margin-bottom: 8px;
}
.agency-body { font-size: 0.9375rem; line-height: 1.55; color: var(--ink-muted); margin: 0; }

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


/** Black on the paper ground, white on the ink band. */
const badge = (colour: "black" | "white", alt: string) =>
  `<a class="badge" href="${APP_STORE_URL}">` +
  `<img src="/media/appstore-badge-${colour}.svg" width="162" height="54"` +
  ` alt="${alt}"></a>`;

/*
 * Intrinsic sizes, so a plate reserves its box before it arrives. Without
 * these a lazily loaded image is zero pixels tall until it lands, and every
 * section under it jumps when it does. On a phone that is text moving under
 * somebody's eyes as they read, and it also means the fold is in a different
 * place before and after the images load, which is the last thing a page with
 * a fold problem needs.
 */
const PLATE_SIZE: Record<string, [number, number]> = {
  allergens: [587, 477], basket: [556, 399], "basket-lift": [556, 399],
  bowls: [596, 500], language: [760, 687], milk: [535, 379],
  privacy: [553, 507], scanning: [1200, 682], sources: [571, 391],
  specimen: [390, 468], tag: [560, 380],
};

/**
 * The language switcher.
 *
 * Three links, not a <select>: with three options a menu costs a click to
 * reveal what a row shows for free, and a link is a real URL somebody can
 * bookmark or send. Written in each language's own script and never as a
 * flag, for the reason set out beside LANGUAGE_CODES: a flag is a country and
 * a language is not.
 *
 * It sits in the masthead. The brief for above the fold was a headline, a line
 * under it, one button and one picture, and this is a fifth thing, which I
 * think it earns: somebody who cannot read the page cannot act on any of the
 * other four, and a switcher only in the footer is a switcher most people
 * never find. It is small, quiet, and in the mono voice the rest of the
 * furniture uses.
 */
function switcher(current: Lang, label: string): string {
  const links = SITE_LANGUAGES.map((code) => {
    const on = code === current;
    return `<a class="lang${on ? " on" : ""}" href="/${code}" hreflang="${HTML_LANG[code]}"` +
      ` lang="${HTML_LANG[code]}"${on ? ' aria-current="true"' : ""}` +
      ` title="${LANGUAGE_NAMES[code]}">${LANGUAGE_CODES[code]}</a>`;
  }).join("");
  return `<nav class="langs" aria-label="${label}">${links}</nav>`;
}

const plate = (name: string, alt = "") => {
  const [w, h] = PLATE_SIZE[name];
  return `<img src="/media/plates/${name}.webp" width="${w}" height="${h}"` +
    ` alt="${alt}" loading="lazy" decoding="async">`;
};

/** The page, in one language. */
function body(c: Copy, lang: Lang): string {
  return `
<header class="top">
  <div class="shell top-row">
    ${lockupLink(`/${lang}`, c.homeLabel)}
    ${switcher(lang, c.switcherLabel)}
  </div>
</header>

<main>

  <!-- Hook. Headline, one line under it, one button, one picture. The
       switcher above is the only other thing, and the note beside it explains
       why it is allowed to be.

       NO SUBSCRIPTION TERMS ANYWHERE ON THIS PAGE, DELIBERATELY. Nothing is
       sold here: the trial is disclosed where the money actually moves, on the
       paywall and in Apple's sheet, both of which state the price, the renewal
       and how to cancel. A half-line that named the trial without naming the
       price was a claim needing its own qualifier, so it bought no compliance
       and spent attention the CTA needed. -->
  <section class="shell hero">
    <h1>${c.heroTitle}</h1>
    <div class="hero-copy">
      <p class="lede">${c.heroLede}</p>
      ${badge("black", c.badgeAlt)}
      <a class="cue" href="#aisle"><span class="cue-rail" aria-hidden="true"></span>${c.cue}</a>
    </div>
    <div class="hero-plate">
      <img src="/media/plates/scanning.webp" width="1200" height="682" alt="${c.heroAlt}" fetchpriority="high" decoding="async">
    </div>
  </section>

  <!-- Problem. The aisle, and why it is genuinely hard rather than a thing
       careless people get wrong. Each of the three cards is a fact that can
       be checked, not a worry. -->
  <section class="band sunk" id="aisle">
    <div class="shell">
      <div class="band-head rise">
        <p class="eyebrow">${c.aisleEyebrow}</p>
        <h2>${c.aisleTitle}</h2>
        <p class="lede">${c.aisleLede}</p>
      </div>

      <div class="stat rise">
        <p class="stat-line">${c.pivotLine}</p>
        <p>${c.pivotBody}</p>
      </div>

      <div class="cards rise">
        ${["milk", "tag", "language"]
          .map(
            (name, i) => `<div class="card">
          <div class="plate">${plate(name)}</div>
          <h3>${c.cards[i].title}</h3>
          <p>${c.cards[i].body}</p>
        </div>`,
          )
          .join("\n        ")}
      </div>

      <p class="aside rise">${c.aside}</p>
    </div>
  </section>

  <!-- Solution. The three screens are real captures of the shipping build,
       in the order a person actually meets them. -->
  <section class="band">
    <div class="shell">
      <div class="band-head rise">
        <p class="eyebrow">${c.doesEyebrow}</p>
        <h2>${c.doesTitle}</h2>
        <p class="lede">${c.doesLede}</p>
      </div>

      <div class="steps">
        ${["04-who", "05-allergens", "01-verdict"]
          .map(
            (file, i) => `<div class="step rise">
          <img class="screen" src="/media/screens/${file}.webp" width="660" height="1434" loading="lazy" decoding="async" alt="${c.steps[i].alt}">
          <span class="num meta">${c.steps[i].num}</span>
          <h3>${c.steps[i].title}</h3>
          <p>${c.steps[i].body}</p>
        </div>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <!-- The three things that actually separate this from a barcode lookup. -->
  <section class="band ruled">
    <div class="shell rows">
      <div class="row rise">
        <div>
          <h3>${c.sourcesTitle}</h3>
          <p>${c.sourcesBody}</p>
          <ul class="agencies">
            ${c.agencies
              .map(
                (a, i) => `<li><button class="agency${i === 0 ? " on" : ""}" type="button" data-agency="${a.id}"
              aria-pressed="${i === 0}"
              aria-controls="agency-detail">${a.id.toUpperCase()}</button></li>`,
              )
              .join("\n            ")}
          </ul>
          <div class="agency-detail" id="agency-detail">
            ${c.agencies
              .map(
                (a, i) => `<div class="agency-panel${i === 0 ? " on" : ""}" data-agency="${a.id}">
              <p class="agency-full">${a.full}</p>
              <p class="agency-body">${a.body}</p>
            </div>`,
              )
              .join("\n            ")}
          </div>
        </div>
        <div class="row-plate">${plate("sources")}</div>
      </div>

      <div class="row flip rise">
        <div>
          <h3>${c.profilesTitle}</h3>
          <p>${c.profilesBody}</p>
        </div>
        <div class="row-plate">${plate("bowls")}</div>
      </div>

      <div class="row rise">
        <div>
          <h3>${c.photoTitle}</h3>
          <p>${c.photoBodyBefore}<a href="/privacy">${c.photoLink}</a>${c.photoBodyAfter}</p>
        </div>
        <div class="row-plate">${plate("privacy")}</div>
      </div>
    </div>
  </section>

  <!-- Social proof. See the note above the testimonials in siteCopy.ts: these
       are placeholders and every one of them needs replacing. -->
  <section class="band sunk">
    <div class="shell">
      <div class="band-head rise">
        <p class="eyebrow">${c.quotesEyebrow}</p>
        <h2>${c.quotesTitle}</h2>
      </div>
      <div class="quotes rise">
        ${c.testimonials
          .map(
            (t) => `<figure class="quote">
          <blockquote>&ldquo;${t.quote}&rdquo;</blockquote>
          <figcaption><strong>${t.name}</strong><br><span class="meta">${t.detail}</span></figcaption>
        </figure>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>

  <!-- Close. The one place on the page that inverts, so the last thing on it
       is unmistakably the last thing on it. -->
  <section class="close">
    <div class="close-plate">${plate("basket-lift")}</div>
    <div class="shell">
      <div class="close-inner">
        <h2>${c.closeTitle}</h2>
        <p class="lede" style="margin:20px 0 34px">${c.closeLede}</p>
        ${badge("white", c.badgeAlt)}
      </div>
    </div>
  </section>

</main>

<footer class="foot">
  <div class="shell">
${footerInner(c)}
  </div>
</footer>

<script>
  // The reveal.
  //
  // Three rules, all learned from the same bug. The class goes on from script,
  // so a reader with no JavaScript or no IntersectionObserver never has
  // anything hidden from them. There is no bottom inset. And a sweep resolves
  // anything already on screen, run again after load and after the webfonts
  // settle, because both move the fold.
  //
  // The bug: the slice of the next section showing under the hero is the main
  // signal that the page continues, and its heading sits only a few pixels
  // inside the first screen. An earlier version hid the bottom 12% from the
  // observer, then 8%, and both swallowed exactly that heading, so the fold
  // was a band of flat colour with nothing in it. Anything that decides what
  // is visible at the fold has to be deterministic rather than dependent on a
  // frame having been painted at a particular moment.
  (function () {
    var els = [].slice.call(document.querySelectorAll(".rise"));
    if (!els.length || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js");

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px", threshold: 0 });

    function sweep() {
      // A zero height means the page has not been sized yet, which some
      // headless and prerender contexts report while scripts are running.
      // Resolve everything rather than measure against nothing: the failure
      // that matters here is content staying invisible, so when the viewport
      // cannot be trusted the safe direction is to show it.
      var vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach(function (el) {
        if (el.classList.contains("in")) return;
        if (!vh || el.getBoundingClientRect().top < vh) {
          el.classList.add("in");
          io.unobserve(el);
        }
      });
    }

    els.forEach(function (el) { io.observe(el); });
    sweep();
    window.addEventListener("load", sweep);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sweep);
  })();

  // The agency chips.
  //
  // One is always chosen, so there is no empty state to fall back into and
  // nothing collapses when the pointer leaves. Hovering another previews it
  // and moving away returns to the chosen one, which a mouse can use to read
  // all four without clicking; a finger, which has no hover, gets the same
  // content from a tap. Every panel is already in the DOM and stacked in one
  // grid cell, so this only ever changes which is opaque.
  (function () {
    var chips = [].slice.call(document.querySelectorAll(".agency"));
    var panels = [].slice.call(document.querySelectorAll(".agency-panel"));
    if (!chips.length || !panels.length) return;
    var chosen = chips[0].dataset.agency;

    function show(id) {
      panels.forEach(function (p) { p.classList.toggle("on", p.dataset.agency === id); });
      chips.forEach(function (c) {
        c.classList.toggle("on", c.dataset.agency === id);
        c.setAttribute("aria-pressed", String(c.dataset.agency === chosen));
      });
    }

    chips.forEach(function (chip) {
      var id = chip.dataset.agency;
      chip.addEventListener("click", function () { chosen = id; show(id); });
      chip.addEventListener("mouseenter", function () { show(id); });
      chip.addEventListener("focus", function () { show(id); });
      chip.addEventListener("mouseleave", function () { show(chosen); });
      chip.addEventListener("blur", function () { show(chosen); });
    });
  })();
</script>`;
}

/**
 * The document, in one language.
 *
 * Every language's canonical URL is its own /<code> path, including English.
 * "/" is a negotiated alias that points its canonical at whichever of the
 * three it served, so the two are byte-identical and one render covers both.
 * hreflang lists all three on every page plus an x-default of English, which
 * is what tells a crawler these are translations of one page rather than
 * three pages that happen to rhyme.
 */
function page(lang: Lang): string {
  const c = COPY[lang];
  const alternates = SITE_LANGUAGES.map(
    (code) =>
      `<link rel="alternate" hreflang="${HTML_LANG[code]}" href="${SITE_ORIGIN}/${code}">`,
  ).join("\n");

  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">
<head>
${HEAD_COMMON}
<title>${c.title}</title>
<meta name="description" content="${c.description}">
<link rel="canonical" href="${SITE_ORIGIN}/${lang}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/en">
<meta name="theme-color" content="#F6F1E7">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE_ORIGIN}/${lang}">
<meta property="og:site_name" content="Revely">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
${SITE_LANGUAGES.filter((l) => l !== lang)
  .map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`)
  .join("\n")}
<meta property="og:title" content="${c.ogTitle}">
<meta property="og:description" content="${c.description}">
<meta property="og:image" content="${SITE_ORIGIN}/media/og-card-${lang}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<style>${STYLE}</style>
</head>
<body>
${body(c, lang)}
</body>
</html>`;
}

/** Rendered once at boot. The pages are static; only the copy differs. */
const PAGES: Record<Lang, string> = {
  en: page("en"),
  zh: page("zh"),
  es: page("es"),
};

/**
 * Best supported match for an Accept-Language header, English otherwise.
 *
 * Matches on the primary subtag only, which is what the app does in
 * deviceLanguage(): a zh-TW or zh-Hant reader gets our Simplified Chinese
 * rather than English. That is the same compromise the app makes and it is
 * the better of the two, but it is a compromise, and a Traditional catalogue
 * is the fix rather than a smarter parse here.
 */
function negotiate(header: string | undefined): Lang {
  if (!header) return "en";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((x) => x.trim().startsWith("q="));
      const weight = q ? Number.parseFloat(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), weight };
    })
    .filter((r) => r.tag && Number.isFinite(r.weight) && r.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of ranked) {
    if (tag === "*") break;
    const base = tag.split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

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

  // One canonical URL per language.
  //
  // Written out rather than looped over SITE_LANGUAGES so that the route
  // audit in eval/auth.check.ts can see them. It reads the source for literal
  // paths, which is the right way round: a route it cannot name is a route
  // nobody is checking is public on purpose.
  app.get("/en", (_req, res) => res.type("html").send(PAGES.en));
  app.get("/es", (_req, res) => res.type("html").send(PAGES.es));
  app.get("/zh", (_req, res) => res.type("html").send(PAGES.zh));

  /**
   * The root negotiates rather than redirecting.
   *
   * A redirect here would bounce the App Store's marketing URL and Google's
   * OAuth home page URL through a 302 on every visit, and it would put a
   * round trip in front of the first paint for the sake of a path segment.
   * Serving the negotiated language directly costs nothing and the canonical
   * tag points at the stable URL, so a crawler still indexes three pages
   * rather than four.
   *
   * Vary matters: without it any cache in front of this would serve the first
   * visitor's language to everyone behind it.
   */
  app.get("/", (req, res) => {
    const lang = negotiate(req.headers["accept-language"]);
    res.setHeader("Vary", "Accept-Language");
    res.type("html").send(PAGES[lang]);
  });
}
