import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import path from "path";

import {
  CONTACT_EMAIL,
  FONT_FACES,
  HEAD_COMMON,
  LEGAL_ENTITY,
  LOCKUP,
  PAPER_TOKENS,
  SITE_ORIGIN,
  TYPE_TOKENS,
  footerInner,
  lockupLink,
} from "./siteTheme";
import { ALLERGEN_PATHS } from "./allergens";
import { GUIDE_ALTERNATES, GUIDE_PATHS } from "./guides";
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
  --band: clamp(60px, 8vw, 116px);
  --dock: 64px;
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; scroll-padding-top: var(--dock); }
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

.sr {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}

/* ---- type ------------------------------------------------------------- */

h1, h2, h3 { margin: 0; font-weight: 600; text-wrap: balance; }
h1 { font-size: clamp(2.25rem, 6.1vw, 4.3rem); line-height: 1.04; letter-spacing: -0.035em; }
h2 { font-size: clamp(1.85rem, 3.7vw, 2.9rem); line-height: 1.1;  letter-spacing: -0.03em; }
h3 { font-size: 1.3125rem; line-height: 1.3; letter-spacing: -0.02em; }
p  { margin: 0; color: var(--ink-muted); }

.lede { font-size: clamp(1.0625rem, 1.5vw, 1.3125rem); line-height: 1.55; max-width: 36ch; }
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
 * the badge. Height is 54px on the page and 40px in the bar, which is exactly
 * their floor and no lower, and the spacing around it clears a tenth of its
 * height on every side.
 *
 * This is the one thing on the page that is not ours and does not obey the
 * system. It earns the exception by being the control people already know.
 */
.badge { display: inline-block; line-height: 0; border-radius: 10px; flex: none; }
.badge img { display: block; height: 54px; width: auto; }
.badge:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; }
.close .badge:focus-visible { outline-color: var(--paper); }

/*
 * Nobody on Android can use that badge, and until 2026-09-22 it was the only
 * thing either button offered them. On an Android phone the script marks the
 * document and every badge gives way to the waitlist. Without script the
 * badge stays, which is the old behaviour and no worse than it was.
 */
.android-cta { display: none; }
.android .badge { display: none; }
.android .android-cta {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 20px;
  border-radius: 999px; font-weight: 600; font-size: 0.9375rem; text-decoration: none;
  background: var(--ink); color: var(--paper);
}
.close .android-cta { background: var(--paper); color: var(--ink); }

/* ---- the QR code ------------------------------------------------------ */
/*
 * For somebody reading on a laptop, whose phone is in their pocket. Only where
 * there is a fine pointer and room for it: on a phone a code on the screen is
 * a code nobody can scan. It points at /get rather than the App Store, so an
 * Android phone that scans it lands on the waitlist instead of a dead end.
 */
.qr { display: none; }
@media (min-width: 880px) and (hover: hover) and (pointer: fine) {
  .qr { display: flex; align-items: center; gap: 14px; }
  .qr img { display: block; width: 76px; height: 76px; border: 1px solid var(--rule); }
  .qr p { font-family: var(--mono); font-size: 0.6875rem; line-height: 1.5; letter-spacing: 0.02em; max-width: 15ch; color: var(--ink-muted); }
  .hero .qr { padding-left: 22px; border-left: 1px solid var(--rule); }
  .close .qr img { width: 96px; height: 96px; border: 0; }
  .close .qr p { color: #B8AD99; }
  .android .qr { display: none; }
}

/* ---- the scroll cue --------------------------------------------------- */
/*
 * A hairline with a short ink segment that travels down it once and stays
 * there. Once, because the system's own rule for anything that reveals is
 * that it ends resolved: a loop reads as still trying, which is why the
 * scanner in the app sweeps a single time.
 *
 * It points at how the app works, not at the problem section in between: a
 * visitor who wants to know more before downloading wants to see the product.
 * On a phone the rail goes and the words stay, as a plain link with a
 * finger-sized target, because a stacked hero has no gap to hang a rail in.
 *
 * FLEX, NOT INLINE-FLEX. An inline cue flows up onto the badge's line, and a
 * vertical hairline beside the CTA reads as a divider welded to it.
 */
.cue {
  display: flex; width: max-content; align-items: center; gap: 14px;
  min-height: 44px; margin-top: 4px; text-decoration: none; color: var(--ink-muted);
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.17em; text-transform: uppercase;
}
.cue:hover { color: var(--ink); }
.cue-rail { display: none; }
.cue::after { content: "\\2193"; font-family: var(--sans); letter-spacing: 0; }
@media (min-width: 880px) {
  .cue { margin-top: 28px; color: var(--ink-faint); }
  .cue::after { content: none; }
  .cue-rail {
    position: relative; display: block; width: 1px; height: 52px;
    background: var(--rule); overflow: hidden; flex: none;
  }
  .cue-rail::after {
    content: ""; position: absolute; left: 0; width: 1px; height: 18px;
    background: var(--ink); top: 34px;
    animation: cue-run 1.5s cubic-bezier(.16, 1, .3, 1) .9s 1 backwards;
  }
}
@keyframes cue-run { from { top: -18px; } to { top: 34px; } }
@media (prefers-reduced-motion: reduce) { .cue-rail::after { animation: none; } }

/* ---- header ----------------------------------------------------------- */

.top { padding: 18px 0 0; }
.top-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.lockup { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: var(--ink); }
.lockup .mark { width: 26px; height: 26px; flex: none; }
.lockup b { font-weight: 600; font-size: 1.125rem; letter-spacing: -0.02em; }

/* ---- the language switcher -------------------------------------------- */
/*
 * Three links rather than a menu, and the current one filled the same way an
 * active agency chip is, so the page has one vocabulary for "this is the one
 * you are on".
 *
 * The pill is drawn on the inner span and the link around it is 44px square
 * at least. The pill alone was 27px tall, under the size a thumb can hit
 * reliably, and making the pill itself 44px would have made the masthead
 * shout. The target grows; the picture does not.
 */
.langs { display: flex; align-items: center; flex: none; margin-right: -6px; }
.lang {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 44px; min-height: 44px; padding: 0 1px;
  font-family: var(--mono); font-size: 0.6875rem; font-weight: 500;
  letter-spacing: 0.1em; line-height: 1; color: var(--ink-faint); text-decoration: none;
}
.lang span { padding: 8px 10px; border-radius: 999px; transition: color .12s ease, background-color .12s ease; }
.lang:hover { color: var(--ink); }
.lang.on span { color: var(--paper); background: var(--ink); }
.lang:focus-visible { outline: 0; }
.lang:focus-visible span { outline: 2px solid var(--ink); outline-offset: 2px; }
/* 中文 is two wide glyphs; letter-spacing built for EN and ES pulls it apart. */
.lang[lang="zh-Hans"] { letter-spacing: 0.02em; }

.legal-note { margin: -12px 0 22px; }

/* ---- the bar that follows the page down ------------------------------- */
/*
 * The page is five or six screens long and the badge used to appear twice,
 * at the top and at the bottom, with nowhere to act in between. This bar
 * slides in once the hero's button has scrolled away and slides out again
 * when the closing band, which has its own, comes into view. It never sits
 * on top of a badge that is already on screen.
 *
 * It starts inert and hidden, so without script it simply never appears.
 */
.dock {
  position: fixed; inset: 0 0 auto; z-index: 20;
  background: rgba(246, 241, 231, .94);
  -webkit-backdrop-filter: saturate(1.2) blur(10px); backdrop-filter: saturate(1.2) blur(10px);
  border-bottom: 1px solid var(--rule);
  transform: translateY(-101%); visibility: hidden;
  transition: transform .32s cubic-bezier(.16,1,.3,1), visibility 0s linear .32s;
}
.dock.on { transform: none; visibility: visible; transition: transform .32s cubic-bezier(.16,1,.3,1), visibility 0s; }
@media (prefers-reduced-motion: reduce) { .dock, .dock.on { transition: none; } }
.dock-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: var(--dock); }
.dock .badge img { height: 40px; }
.dock .android-cta { min-height: 40px; }

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
html[lang="zh-Hans"] .qa summary { letter-spacing: 0; }
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
 * the headline wants about eleven ems: in half a shell that caps the type at
 * 49px, which is a subheading pretending to be a headline. Given the whole
 * page it runs at full size on two lines, which is the line.
 *
 * The drawing stays, rather than a screenshot of a verdict. A phone mockup
 * was tried on 2026-09-22 and taken out the same day at Dave's call; the real
 * screens are three scrolls down, in the order a person meets them.
 */
.hero {
  display: grid; gap: clamp(22px, 2.6vw, 34px) clamp(28px, 4vw, 56px);
  grid-template-columns: 1fr;
  padding-block: clamp(28px, 4.4vw, 60px) clamp(48px, 5.4vw, 72px);
}
.hero h1 { grid-column: 1 / -1; }
.hero .lede { margin: 0 0 26px; }
.hero .cta { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 22px; }
.hero-plate { justify-self: center; width: 100%; max-width: 580px; }
.hero-plate img { display: block; width: 100%; height: auto; }

@media (min-width: 880px) {
  .hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
  .hero-copy { max-width: 31rem; padding-top: 4px; }
  .hero-plate { justify-self: end; align-self: start; margin: -22px -3% 0 0; }
}

/* ---- the Android waitlist --------------------------------------------- */
/*
 * A disclosure rather than a form sitting open under the badge. Most
 * visitors are on an iPhone or a laptop and the offer is one line to them.
 * On Android the script opens it, because for that visitor it is the only
 * thing on the page they can act on.
 *
 * The promise, one email and then deletion, is made in the Android answer in
 * the questions and in the privacy policy rather than under the field.
 */
.android-box { margin-top: 10px; }
.android-box summary {
  display: inline-flex; align-items: center; min-height: 44px; cursor: pointer;
  list-style: none; font-size: 0.9375rem; color: var(--ink-muted);
  text-decoration: underline; text-decoration-color: var(--rule);
  text-decoration-thickness: 1px; text-underline-offset: 4px;
}
.android-box summary::-webkit-details-marker { display: none; }
.android-box summary:hover { color: var(--ink); text-decoration-color: currentColor; }
.android .android-box summary { color: var(--ink); font-weight: 500; text-decoration: none; cursor: default; }
.notify { margin-top: 6px; max-width: 26rem; }
.notify-row { display: flex; gap: 8px; }
.notify input[type="email"] {
  flex: 1; min-width: 0; height: 48px; padding: 0 18px;
  font: inherit; font-size: 1rem; color: var(--ink);
  background: var(--card); border: 1px solid var(--rule); border-radius: 999px;
}
.notify input[type="email"]::placeholder { color: var(--ink-faint); }
.notify input[type="email"]:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
.notify button {
  flex: none; height: 48px; padding: 0 22px; border: 0; border-radius: 999px;
  font: inherit; font-size: 0.9375rem; font-weight: 600; cursor: pointer;
  background: var(--ink); color: var(--paper);
}
.notify button:disabled { opacity: .55; cursor: progress; }
.notify-status { margin-top: 8px; font-size: 0.9375rem; color: var(--ink); }
.notify-status:empty { display: none; }
.notify.done .notify-row { display: none; }
/* A field no person sees. Anything that fills it in is not a person. */
.notify .trap { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }

/* ---- bands ------------------------------------------------------------ */

.band { padding-block: var(--band); }
.band.sunk { background: var(--sunk); }
.band.ruled { border-top: 1px solid var(--rule); }
.band-head { max-width: 40rem; }
.band-head .lede { max-width: 46ch; margin-top: 18px; }

/* ---- plate cards ------------------------------------------------------ */
/*
 * Three across on a wide screen. On a phone each card lays its plate beside
 * its text instead of above it, which roughly halves the section's height:
 * three plates stacked at full size were three screens of scrolling for
 * three sentences.
 */
.cards { display: grid; gap: 1px; margin-top: clamp(30px, 4vw, 52px); background: var(--rule); border: 1px solid var(--rule); }
.card { background: var(--card); padding: 20px; display: grid; grid-template-columns: 76px minmax(0, 1fr); column-gap: 18px; align-items: start; }
.card .plate { grid-row: span 2; height: 64px; display: flex; align-items: flex-start; }
.card .plate img { height: 100%; width: 100%; object-fit: contain; object-position: left top; }
.card h3 { font-size: 1.125rem; margin-bottom: 6px; }
.card p { font-size: 0.9375rem; line-height: 1.55; }
@media (min-width: 760px) {
  .cards { grid-template-columns: repeat(3, 1fr); }
  .card { padding: 26px 26px 30px; display: flex; flex-direction: column; }
  .card .plate { height: 138px; margin: 2px 0 24px; align-items: flex-end; }
  .card .plate img { width: auto; max-width: 100%; object-position: left bottom; }
  .card h3 { font-size: 1.3125rem; margin-bottom: 10px; }
}

.aside { margin-top: 26px; font-size: 1.0625rem; color: var(--ink); }

/* ---- the three screens ------------------------------------------------ */
/*
 * Side by side on a wide screen. On a phone they become a row you swipe, with
 * the next screen showing at the edge so it is obvious there is one: three
 * full-height phone screenshots stacked were the longest stretch of the page.
 * The row bleeds to the screen edges and snaps to the gutter.
 */
.steps { display: grid; gap: clamp(38px, 4vw, 46px); margin-top: clamp(36px, 5vw, 64px); }
.step img.screen {
  display: block; width: 100%; height: auto;
  border-radius: 12.5% / 5.75%;
  border: 1px solid var(--rule);
  box-shadow: 0 1px 2px rgba(22,19,15,.09), 0 22px 40px -18px rgba(22,19,15,.34);
}
.step .num { display: block; margin: 22px 0 8px; }
.step h3 { margin-bottom: 8px; }
.step p { font-size: 0.9375rem; line-height: 1.55; }
@media (max-width: 759px) {
  .steps {
    grid-auto-flow: column; grid-auto-columns: 74%; gap: 16px;
    overflow-x: auto; overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory; scroll-padding-inline: var(--gutter);
    margin-inline: calc(-1 * var(--gutter)); padding: 0 var(--gutter) 30px;
    margin-bottom: -30px; scrollbar-width: none;
  }
  .steps::-webkit-scrollbar { display: none; }
  .step { scroll-snap-align: start; }
}
@media (min-width: 760px) { .steps { grid-template-columns: repeat(3, 1fr); } }

/* ---- feature rows ----------------------------------------------------- */

.rows { margin-top: 4px; }
/* The band already draws the divider above this list. A row rule on top of
   it reads as a mistake rather than as two rules. */
.row:first-child { border-top: 0; padding-top: 0; }
.row {
  display: grid; gap: clamp(20px, 4vw, 64px); align-items: center;
  padding: clamp(40px, 5vw, 64px) 0; border-top: 1px solid var(--rule);
}
@media (min-width: 820px) {
  .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .row.flip .row-plate { order: -1; }
}
.row-plate { display: flex; justify-content: center; }
.row-plate img { display: block; max-width: min(200px, 60%); height: auto; }
@media (min-width: 820px) { .row-plate img { max-width: min(300px, 78%); } }
.row h3 { font-size: clamp(1.45rem, 2.3vw, 1.85rem); letter-spacing: -0.025em; margin-bottom: 14px; }
.row p { max-width: 40ch; }

/* ---- proof ------------------------------------------------------------ */

.proof { display: grid; gap: clamp(28px, 4vw, 64px); align-items: center; }
@media (min-width: 820px) { .proof { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.proof .lede { max-width: 42ch; margin-top: 18px; }

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
  min-height: 36px; padding: 8px 14px; border-radius: 999px; cursor: pointer;
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
 * chip to chip cannot move anything on the page. A reserved min-height was
 * tried first and shoved the page on every hover; the tallest child measures
 * itself and is right at every width.
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

/* ---- questions -------------------------------------------------------- */
/*
 * Native disclosures, so they open by keyboard, by screen reader and by the
 * browser's own find-in-page with no script at all. The plus is two bars and
 * the vertical one lies down when the answer is open.
 */
.faq-grid { display: grid; gap: 30px; }
@media (min-width: 880px) {
  .faq-grid { grid-template-columns: minmax(0, .8fr) minmax(0, 1.4fr); gap: 64px; align-items: start; }
}
.faq { border-top: 1px solid var(--rule); }
.qa { border-bottom: 1px solid var(--rule); }
.qa summary {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  min-height: 44px; padding: 18px 0; cursor: pointer; list-style: none;
  font-size: 1.125rem; font-weight: 500; line-height: 1.35; letter-spacing: -0.01em; color: var(--ink);
}
.qa summary::-webkit-details-marker { display: none; }
.qa summary i { position: relative; width: 14px; height: 14px; flex: none; }
.qa summary i::before, .qa summary i::after {
  content: ""; position: absolute; left: 0; top: 6px; width: 14px; height: 2px;
  background: var(--ink); transition: transform .2s cubic-bezier(.16,1,.3,1);
}
.qa summary i::after { transform: rotate(90deg); }
.qa[open] summary i::after { transform: rotate(0deg); }
@media (prefers-reduced-motion: reduce) { .qa summary i::after { transition: none; } }
.qa p { padding: 0 34px 22px 0; max-width: 60ch; font-size: 1rem; }

/* ---- closing band ----------------------------------------------------- */

.close {
  position: relative; overflow: hidden;
  background: var(--ink); color: var(--paper);
  padding-block: clamp(72px, 10vw, 136px);
}
.close h2 { color: var(--paper); }
.close p { color: #B8AD99; }
.close .shell { position: relative; }
.close-inner { max-width: 36rem; }
.close .lede { margin: 18px 0 32px; }
.close .cta { display: flex; flex-wrap: wrap; align-items: center; gap: 18px 28px; }
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

/**
 * The QR code, for desktop visitors. Decorative to a screen reader, because
 * the badge beside it is the same destination as a link somebody can follow;
 * the caption is visible text for everybody else.
 */
const qr = (caption: string) =>
  `<div class="qr"><img src="/media/qr-get.svg" width="76" height="76" alt="">` +
  `<p>${caption}</p></div>`;

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
 * It sits in the masthead, because somebody who cannot read the page cannot
 * act on anything else on it, and a switcher only in the footer is a switcher
 * most people never find.
 */
function switcher(current: Lang, label: string): string {
  const links = SITE_LANGUAGES.map((code) => {
    const on = code === current;
    return `<a class="lang${on ? " on" : ""}" href="/${code}" hreflang="${HTML_LANG[code]}"` +
      ` lang="${HTML_LANG[code]}"${on ? ' aria-current="true"' : ""}` +
      ` title="${LANGUAGE_NAMES[code]}"><span>${LANGUAGE_CODES[code]}</span></a>`;
  }).join("");
  return `<nav class="langs" aria-label="${label}">${links}</nav>`;
}

const plate = (name: string, alt = "") => {
  const [w, h] = PLATE_SIZE[name];
  return `<img src="/media/plates/${name}.webp" width="${w}" height="${h}"` +
    ` alt="${alt}" loading="lazy" decoding="async">`;
};

/**
 * The waitlist form. One per page: every other Android prompt is a link to
 * #android, which the script turns into "open this and put the cursor in it".
 * The messages ride on data attributes so the script needs no copy of its own
 * and says them in the page's language.
 */
function androidBox(c: Copy, lang: Lang): string {
  return `<details class="android-box" id="android">
        <summary>${c.androidSummary}</summary>
        <form class="notify" data-lang="${lang}" data-thanks="${c.androidThanks}"
          data-invalid="${c.androidInvalid}" data-failed="${c.androidFailed}" novalidate>
          <div class="notify-row">
            <label class="sr" for="notify-email">${c.emailLabel}</label>
            <input id="notify-email" name="email" type="email" inputmode="email"
              autocomplete="email" autocapitalize="off" spellcheck="false"
              maxlength="254" placeholder="you@example.com" required>
            <button type="submit">${c.androidSubmit}</button>
          </div>
          <input class="trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="notify-status" role="status" aria-live="polite"></p>
        </form>
      </details>`;
}

/** Answers carry the odd link; the structured data wants plain text. */
const plain = (html: string) => html.replace(/<[^>]+>/g, "");

/**
 * The questions again, as FAQPage structured data. Google stopped showing FAQ
 * rich results for most sites in 2023, so this is not a bet on a snippet; it
 * is the cheapest way to tell any crawler, including the ones answering
 * questions directly, what the page says about price, privacy and accuracy.
 * `<` is escaped so no answer can ever close the script element early.
 */
function faqSchema(c: Copy, lang: Lang): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: HTML_LANG[lang],
    mainEntity: c.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: plain(item.a) },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Who and what this site is, for search engines.
 *
 * Mostly for the name. "Revely" is also a 1981 song with a lot of pages about
 * it, and this is how Google learns the word can mean an iPhone app with its
 * own site, logo and publisher. The WebSite entry is what Google reads for the
 * site name it prints above a result.
 *
 * No rating and no price. Google shows an app's stars only with a rating, and
 * there is no honest one to give it yet; a price would have to be a single
 * number for a subscription priced in every currency.
 */
function siteSchema(c: Copy, lang: Lang): string {
  const org = `${SITE_ORIGIN}/#organization`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: "Revely",
        legalName: LEGAL_ENTITY,
        url: `${SITE_ORIGIN}/`,
        logo: `${SITE_ORIGIN}/media/apple-touch-icon.png`,
        email: CONTACT_EMAIL,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: "Revely",
        url: `${SITE_ORIGIN}/`,
        publisher: { "@id": org },
        inLanguage: SITE_LANGUAGES.map((l) => HTML_LANG[l]),
      },
      {
        "@type": "MobileApplication",
        "@id": `${SITE_ORIGIN}/#app`,
        name: "Revely",
        operatingSystem: "iOS",
        applicationCategory: "HealthApplication",
        description: c.description,
        url: `${SITE_ORIGIN}/${lang}`,
        installUrl: APP_STORE_URL,
        sameAs: [APP_STORE_URL],
        image: `${SITE_ORIGIN}/media/og-card-${lang}.png`,
        inLanguage: SITE_LANGUAGES.map((l) => HTML_LANG[l]),
        publisher: { "@id": org },
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/** The page, in one language. */
function body(c: Copy, lang: Lang): string {
  return `
<header class="top" id="top">
  <div class="shell top-row">
    ${lockupLink(`/${lang}`, c.homeLabel)}
    ${switcher(lang, c.switcherLabel)}
  </div>
</header>

<div class="dock" inert>
  <div class="shell dock-row">
    <a class="lockup" href="#top" aria-label="${c.homeLabel}">${LOCKUP}</a>
    <div>
      <a class="badge" href="${APP_STORE_URL}"><img src="/media/appstore-badge-black.svg" width="120" height="40" alt="${c.badgeAlt}"></a>
      <a class="android-cta" href="#android">${c.dockAndroid}</a>
    </div>
  </div>
</div>

<main>

  <!-- Hook. Headline, one line under it, the button, and one picture.

       Price is answered once, in full, in the questions near the end: what is
       free, which plan has the trial, where the price is shown and where you
       cancel. Not up here, where half a line naming the trial without the
       price would be a claim needing its own qualifier. -->
  <section class="shell hero">
    <h1>${c.heroTitle}</h1>
    <div class="hero-copy">
      <p class="lede">${c.heroLede}</p>
      <div class="cta">
        ${badge("black", c.badgeAlt)}
        ${qr(c.qrCaption)}
      </div>
      ${androidBox(c, lang)}
      <a class="cue" href="#how"><span class="cue-rail" aria-hidden="true"></span>${c.cue}</a>
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
  <section class="band" id="how">
    <div class="shell">
      <div class="band-head rise">
        <p class="eyebrow">${c.doesEyebrow}</p>
        <h2>${c.doesTitle}</h2>
        <p class="lede">${c.doesLede}</p>
      </div>

      <div class="steps rise">
        ${["04-who", "05-allergens", "01-verdict"]
          .map(
            (file, i) => `<div class="step">
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

  <!-- Solution, continued. What separates this from a barcode lookup. The
       photo row that sat here went on 2026-09-23: "What happens to my photo?"
       in the questions below says the same thing, with the policy link. -->
  <section class="band ruled">
    <div class="shell rows">
      <div class="row rise">
        <div>
          <h3>${c.profilesTitle}</h3>
          <p>${c.profilesBody}</p>
        </div>
        <div class="row-plate">${plate("bowls")}</div>
      </div>
    </div>
  </section>

  <!-- Social proof. The page runs hook, pain, solution, proof, action, and
       this is the proof: until there are real reviews, the strongest reason
       to believe what the app says is who it quotes.

       When there is an App Store rating worth showing, and real quotes from
       real people, they go in this band beside the sources. Three invented
       testimonials held this position until 2026-09-22; see siteCopy.ts. -->
  <section class="band ruled" id="sources">
    <div class="shell proof">
      <div class="rise">
        <p class="eyebrow">${c.proofEyebrow}</p>
        <h2>${c.sourcesTitle}</h2>
        <p class="lede">${c.sourcesBody}</p>
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
      <div class="row-plate rise">${plate("sources")}</div>
    </div>
  </section>

  <!-- Questions, after the proof and before the button, at Dave's call on
       2026-09-23. They answer what is left once somebody is persuaded:
       accuracy, signal, the photo, the price, the languages and Android. -->
  <section class="band sunk" id="faq">
    <div class="shell faq-grid">
      <div class="band-head rise">
        <p class="eyebrow">${c.faqEyebrow}</p>
        <h2>${c.faqTitle}</h2>
      </div>
      <div class="faq rise">
        ${c.faq
          .map(
            (item) => `<details class="qa">
          <summary>${item.q}<i aria-hidden="true"></i></summary>
          <p>${item.a}</p>
        </details>`,
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
        <p class="lede">${c.closeLede}</p>
        <div class="cta">
          ${badge("white", c.badgeAlt)}
          <a class="android-cta" href="#android">${c.dockAndroid}</a>
          ${qr(c.qrCaption).replace('width="76" height="76"', 'width="96" height="96"')}
        </div>
      </div>
    </div>
  </section>

</main>

<footer class="foot">
  <div class="shell">
${footerInner(c, `/${lang}/guides`)}
  </div>
</footer>

<script>
  // Android first, before anything measures the page: marking the document
  // swaps every badge for the waitlist, which changes heights.
  //
  // User agent sniffing is crude, and here crude is enough. The worst a wrong
  // answer does is show an Android visitor the App Store badge they saw
  // before this existed, or show an iPhone visitor a waitlist link.
  (function () {
    var box = document.getElementById("android");
    if (!box) return;
    if (/Android/i.test(navigator.userAgent)) {
      document.documentElement.classList.add("android");
      box.open = true;
    }
    if (location.hash === "#android") box.open = true;

    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var form = box.querySelector("form");
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector("button");
    var status = form.querySelector(".notify-status");

    // Every "Android?" link on the page lands here, opened, with the cursor in
    // the field, rather than jumping to a closed disclosure somebody then has
    // to find and open.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href="#android"]');
      if (!a) return;
      e.preventDefault();
      box.open = true;
      box.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
      if (history.replaceState) history.replaceState(null, "", "#android");
    });

    function say(text) { status.textContent = text; }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        say(form.dataset.invalid);
        input.focus();
        return;
      }
      button.disabled = true;
      say("");
      fetch("/api/waitlist/android", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, lang: form.dataset.lang, website: form.website.value }),
      })
        .then(function (r) {
          if (r.status === 400) throw new Error("invalid");
          if (!r.ok) throw new Error("failed");
          form.classList.add("done");
          say(form.dataset.thanks);
        })
        .catch(function (err) {
          say(err && err.message === "invalid" ? form.dataset.invalid : form.dataset.failed);
        })
        .then(function () { button.disabled = false; });
    });
  })();

  // The bar that follows the page down.
  //
  // Shown only while the hero's call to action is above the screen and the
  // closing band's is not yet on it, so there is never a second button beside
  // one already visible. Inert whenever it is hidden, so it is never in the
  // tab order or read aloud while nobody can see it.
  (function () {
    var dock = document.querySelector(".dock");
    var hero = document.querySelector(".hero-copy");
    var close = document.querySelector(".close");
    if (!dock || !hero || !close || !("IntersectionObserver" in window)) return;
    var heroGone = false, closeHere = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === hero) heroGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        else closeHere = e.isIntersecting;
      });
      var on = heroGone && !closeHere;
      dock.classList.toggle("on", on);
      if (on) dock.removeAttribute("inert"); else dock.setAttribute("inert", "");
    });
    io.observe(hero);
    io.observe(close);
  })();

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
${siteSchema(c, lang)}
${faqSchema(c, lang)}
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
 * Every path that serves a page, spelled the one way it is indexed.
 *
 * The legal documents are here too although legal.ts serves them, because a
 * duplicate of the privacy policy is as much a duplicate as one of the home
 * page.
 */
const PAGE_PATHS = new Set([
  "/",
  "/en",
  "/es",
  "/zh",
  "/privacy",
  "/terms",
  "/health-data-privacy",
  ...GUIDE_PATHS,
  ...ALLERGEN_PATHS,
]);

/**
 * One address per page.
 *
 * The same server answers on revely.life, www.revely.life and
 * revely-api.fly.dev, and Express matches paths without regard to case or a
 * trailing slash, so /en, /EN and /en/ on three hosts were nine copies of one
 * page. The canonical tag already told Google which to keep; a permanent
 * redirect means it never has to guess, and a link someone shares with the
 * wrong spelling still counts towards the right page.
 *
 *   www.revely.life, anything    -> revely.life, same path
 *   *.fly.dev, a page            -> revely.life, that page
 *   any host, /EN or /en/        -> /en
 *
 * Only pages move on fly.dev. That host is the API the app talks to, and an
 * /api request, or anything that is not a GET, must never be redirected: a
 * 301 turns a POST into a GET and the body is lost. Local development keeps
 * its own host and only has its spelling tidied.
 *
 * Mounted from routes.ts ahead of every page, the legal ones included.
 */
export function canonicalHost(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const host = (req.headers.host ?? "").toLowerCase().split(":")[0];
  if (host === "www.revely.life") {
    return res.redirect(301, `${SITE_ORIGIN}${req.originalUrl}`);
  }

  const lower = req.path.toLowerCase();
  const page = lower.length > 1 ? lower.replace(/\/+$/, "") : lower;
  if (!PAGE_PATHS.has(page)) return next();

  const q = req.originalUrl.indexOf("?");
  const query = q === -1 ? "" : req.originalUrl.slice(q);

  if (host.endsWith(".fly.dev")) {
    return res.redirect(301, `${SITE_ORIGIN}${page}${query}`);
  }
  if (page !== req.path) return res.redirect(301, `${page}${query}`);
  next();
}

/**
 * Where crawlers may go. Everywhere but the API, which has nothing to index
 * and answers most requests with 401.
 */
const ROBOTS = `User-agent: *
Disallow: /api/
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

/**
 * Every page there is, so none has to be found by following a link.
 *
 * Each language lists its siblings as well, which says the same thing as the
 * hreflang tags in the pages themselves; Google accepts either and reads both.
 * No lastmod: the pages are rendered at boot, and a date that changes on every
 * deploy is one Google learns to ignore.
 */
const SITEMAP = (() => {
  const group = (paths: Record<Lang, string>) => {
    const links = [
      ...SITE_LANGUAGES.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[l]}" href="${SITE_ORIGIN}${paths[l]}"/>`,
      ),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${paths.en}"/>`,
    ].join("\n");
    return SITE_LANGUAGES.map(
      (l) => `  <url>\n    <loc>${SITE_ORIGIN}${paths[l]}</loc>\n${links}\n  </url>`,
    );
  };
  const homes = group({ en: "/en", zh: "/zh", es: "/es" });
  const guides = GUIDE_ALTERNATES.flatMap(group);
  // English only, so no alternates: the allergen pages until they are
  // translated, and the legal documents for good.
  const legal = [...ALLERGEN_PATHS, "/privacy", "/terms", "/health-data-privacy"].map(
    (p) => `  <url>\n    <loc>${SITE_ORIGIN}${p}</loc>\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...homes, ...guides, ...legal].join("\n")}
</urlset>
`;
})();

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
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("text/plain").send(ROBOTS);
  });
  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("application/xml").send(SITEMAP);
  });

  app.get("/en", (_req, res) => res.type("html").send(PAGES.en));
  app.get("/es", (_req, res) => res.type("html").send(PAGES.es));
  app.get("/zh", (_req, res) => res.type("html").send(PAGES.zh));

  /**
   * Where the QR code points, and a short link worth printing.
   *
   * An iPhone, or anything that is not Android, goes to the App Store. An
   * Android phone goes to the waitlist on the home page, in its own language,
   * rather than to a store listing it cannot install from. The day there is
   * an Android app this sends it to Google Play instead, and every code
   * already printed keeps working.
   *
   * 302, not 301: a permanent redirect is cached by the browser, and this
   * one is written to change.
   */
  app.get("/get", (req, res) => {
    res.setHeader("Vary", "User-Agent, Accept-Language");
    if (/android/i.test(req.headers["user-agent"] ?? "")) {
      const lang = negotiate(req.headers["accept-language"]);
      return res.redirect(302, `/${lang}#android`);
    }
    res.redirect(302, APP_STORE_URL);
  });

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
