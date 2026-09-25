/**
 * What the home page and the legal documents have in common.
 *
 * This module exists because they had nothing in common. The home page was
 * rebuilt in Instrument Sans on the app's own tokens while the three legal
 * pages stayed in Georgia on a stylesheet written months earlier, so following
 * a footer link took you to what looked like a different company. Keeping two
 * copies of a colour ramp in step by hand is a losing game, so the ramp, the
 * faces, the mark and the footer live here and both files import them.
 *
 * WHAT IS DELIBERATELY NOT SHARED
 *
 * Layout. A landing page is a sequence of bands designed to move somebody
 * along; a privacy policy is one column somebody reads or searches. They want
 * different structures and pretending otherwise would compromise both.
 *
 * And theme. The home page is light only, because the ink wash plates ship as
 * coverage with the ink baked in at build time and would vanish on a dark
 * ground. The legal pages carry no images, open inside the app through the
 * paywall's links, and are read on phones that follow the system theme, so
 * they keep both. That is why the dark tokens are exported separately rather
 * than folded into the light ones.
 */

/** The entity these documents bind. */
export const LEGAL_ENTITY = process.env.LEGAL_ENTITY || "Dozy Labs LLC";

/**
 * Where privacy requests go.
 *
 * Deliberately NOT falling back to FEEDBACK_EMAIL. That variable holds a
 * personal inbox, and this address is printed on a page the whole internet
 * reads and App Store reviewers archive — a fallback that quietly publishes
 * someone's personal address is a privacy leak inside a privacy policy.
 */
export const CONTACT_EMAIL =
  process.env.LEGAL_CONTACT_EMAIL || "hello@dozylabs.net";

/**
 * The one address the site is indexed under.
 *
 * Absolute, because canonical, hreflang, og:url and the sitemap all have to
 * be. The same server also answers on www.revely.life and revely-api.fly.dev;
 * see canonicalHost() in home.ts for what happens to those.
 */
export const SITE_ORIGIN = "https://revely.life";

/**
 * Self-hosted, and cut to Latin by scripts/build-web-assets.py.
 *
 * Not fonts.googleapis.com. These pages are where we tell people which
 * companies receive anything of theirs, and the list would be wrong the moment
 * rendering the list required a request to Google.
 */
export const FONT_FACES = `
@font-face { font-family: "Instrument Sans"; src: url("/media/fonts/instrument-sans-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Instrument Sans"; src: url("/media/fonts/instrument-sans-500.woff2") format("woff2"); font-weight: 500; font-display: swap; }
@font-face { font-family: "Instrument Sans"; src: url("/media/fonts/instrument-sans-600.woff2") format("woff2"); font-weight: 600; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/media/fonts/ibm-plex-mono-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/media/fonts/ibm-plex-mono-500.woff2") format("woff2"); font-weight: 500; font-display: swap; }
`;

/**
 * Two faces, strict jobs, exactly as the app divides them, then the system's
 * Chinese after them.
 *
 * Instrument Sans and IBM Plex Mono are cut to Latin by the asset script and
 * neither has a CJK glyph in it, which is correct: a usable Simplified face is
 * megabytes even subset, and shipping one to every visitor to render a page
 * most of them read in English is not a trade worth making. Chinese therefore
 * resolves from the reader's own system, which is the same thing the app does
 * with Newsreader. The Latin faces still win for Latin, because they come
 * first and the fallbacks only supply what they lack.
 */
export const TYPE_TOKENS = `
  --cjk: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC";
  --sans: "Instrument Sans", ui-sans-serif, -apple-system, system-ui, var(--cjk), sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, var(--cjk), monospace;
`;

/** Paper, from design_handoff_revely/design.ts. Nothing here is invented. */
export const PAPER_TOKENS = `
  --card: #FFFCF6; --paper: #F6F1E7; --sunk: #EDE6D8; --rule: #DDD4C2;
  --lift: #FFFFFF;
  --ink-faint: #8A8175; --ink-muted: #5C554A; --ink: #16130F;
`;

/** Lamplight. The same logic, read by lamp. */
export const LAMPLIGHT_TOKENS = `
  --card: #1E1A15; --paper: #16130F; --sunk: #241F19; --rule: #332C24;
  --lift: #2A241C;
  --ink-faint: #8A8175; --ink-muted: #A79E90; --ink: #F6F1E7;
`;

/**
 * The Aperture: four detached corner brackets over two text bars, which is a
 * scan reticle with a label caught in it. Inline rather than a file because it
 * is chrome, it is tiny, and it has to take its colour from whatever it sits
 * on. Transcribed from mobile/src/components/aperture-mark.tsx at its large
 * optical size.
 */
export const MARK = `<svg class="mark" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="square" aria-hidden="true">
  <path d="M14 34V14h20"/><path d="M66 14h20v20"/>
  <path d="M86 66v20H66"/><path d="M34 86H14V66"/>
  <path d="M30 44h40" stroke-width="6"/><path d="M30 58h26" stroke-width="6"/>
</svg>`;

/** Mark plus wordmark. The wordmark is never the serif; see the design notes. */
export const LOCKUP = `${MARK}<b>Revely</b>`;

/** The lockup as a link home, in whichever language's home that is. */
export function lockupLink(href: string, label: string): string {
  return `<a class="lockup" href="${href}" aria-label="${label}">${LOCKUP}</a>`;
}

export interface FooterCopy {
  footPrivacy: string;
  footTerms: string;
  footHealth: string;
  disclaimer: string;
  /** Only set where the documents are not in the page's own language. */
  legalNote?: string;
}

/**
 * The footer's contents, from one function on every page, so the legal links,
 * the entity and the medical disclaimer cannot say one thing on the home page
 * and another on the policy it links to. Each page paints it with its own CSS,
 * because the home page's footer sits on ink and the legal ones sit on paper.
 *
 * The labels are passed in rather than written here because the home page has
 * three languages and the documents themselves have one. On a page that is not
 * in English, legalNote says so: linking somebody to a privacy policy in a
 * language they were not reading a moment ago, without warning, is worse than
 * telling them first.
 */
export function footerInner(c: FooterCopy): string {
  return `    <ul class="foot-links">
      <li><a href="/privacy">${c.footPrivacy}</a></li>
      <li><a href="/terms">${c.footTerms}</a></li>
      <li><a href="/health-data-privacy">${c.footHealth}</a></li>
      <li><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></li>
    </ul>
    ${c.legalNote ? `<p class="meta legal-note">${c.legalNote}</p>` : ""}
    <div class="foot-row">
      <span class="lockup">${LOCKUP}</span>
      <span class="meta">${LEGAL_ENTITY}</span>
    </div>
    <p class="disclaimer">${c.disclaimer}</p>`;
}

/** Head elements every page on the site carries. */
export const HEAD_COMMON = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/media/favicon.png" sizes="48x48">
<link rel="apple-touch-icon" href="/media/apple-touch-icon.png">
<link rel="preload" as="font" type="font/woff2" href="/media/fonts/instrument-sans-400.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/media/fonts/instrument-sans-600.woff2" crossorigin>`;
