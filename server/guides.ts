import type { Express } from "express";

import { GUIDES, GUIDES_BY_SLUG, type Guide } from "./guideContent";
import { DOC_STYLE, NOT_FOUND } from "./legal";
import { COPY } from "./siteCopy";
import { HEAD_COMMON, SITE_ORIGIN, footerInner, lockupLink } from "./siteTheme";

/**
 * The guides: /en/guides, and one page per guide under it.
 *
 * These exist to be found. The home page can only rank for "Revely"; the
 * questions people actually type ("names for sugar on a label", "what is E102")
 * are answered here, each with its sources, which is the same thing the app
 * does on a verdict card.
 *
 * Built on the legal documents' stylesheet rather than the home page's, for
 * the same reason those are: a long read wants one column and the system's
 * light and dark themes, and the home page is deliberately a single-theme
 * poster. The content lives in guideContent.ts, with the rules every sentence
 * in it has to follow.
 *
 * English only for now. Under /en/ so that Chinese and Spanish can sit beside
 * it at /zh/guides and /es/guides later with hreflang between them, without
 * moving a URL that has already been indexed.
 */

const APP_STORE_URL = "https://apps.apple.com/app/id6799481205";
const ORG = `${SITE_ORIGIN}/#organization`;
const CHECKED = "25 September 2026";

/** Every guide URL, for the sitemap and canonicalHost(). */
export const GUIDE_PATHS: readonly string[] = [
  "/en/guides",
  ...GUIDES.map((g) => `/en/guides/${g.slug}`),
];

const GUIDE_STYLE = `
.top .shell { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.top nav a { font-size: 0.9375rem; color: var(--ink-muted); text-decoration: none; }
.top nav a:hover, .top nav a[aria-current] { color: var(--ink); }

.masthead { padding-block: 44px 28px; }
.eyebrow {
  font-family: var(--mono); font-size: 0.75rem; font-weight: 500; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--ink-muted); margin: 0 0 14px;
}
.eyebrow a { color: inherit; text-decoration: none; }
.eyebrow a:hover { color: var(--ink); text-decoration: underline; }
.dek { font-size: 1.1875rem; line-height: 1.55; color: var(--ink); margin: 0 0 20px; max-width: 36em; }

sup.cite { font-family: var(--mono); font-size: 0.6875rem; line-height: 0; margin-left: 2px; }
sup.cite a { text-decoration: none; color: var(--ink-muted); padding: 0 1px; }
sup.cite a:hover { color: var(--ink); text-decoration: underline; }
article > h2:first-child { border-top: 0; padding-top: 0; margin-top: 0; }
td.tr span { display: block; }
td.tr span + span { margin-top: 2px; }
td.num { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }

.app { display: grid; gap: 16px; }
.app .eyebrow { margin: 0; }
.app p { margin: 0; color: var(--ink); }
.badge { display: inline-block; line-height: 0; }
.badge img { height: 44px; width: auto; }

.sources ol { padding-left: 22px; font-size: 0.9375rem; }
.sources li { margin-bottom: 12px; scroll-margin-top: 24px; }
.sources li:target { background: var(--sunk); outline: 6px solid var(--sunk); }
.sources .org { color: var(--ink); font-weight: 500; }
.sources .checked { font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.02em; }

.cards { list-style: none; padding: 0; margin: 0; display: grid; gap: 0; }
.cards li { margin: 0; border-top: 1px solid var(--rule); }
.cards li:last-child { border-bottom: 1px solid var(--rule); }
.cards a { display: block; padding: 20px 0; text-decoration: none; color: var(--ink-muted); }
.cards a:hover .t, .cards a:focus-visible .t { text-decoration: underline; text-underline-offset: 3px; }
.cards .t { display: block; color: var(--ink); font-weight: 600; font-size: 1.125rem; line-height: 1.35; letter-spacing: -0.01em; margin-bottom: 6px; text-wrap: balance; }
.cards .d { display: block; font-size: 0.9375rem; line-height: 1.55; }
.related .cards .t { font-size: 1rem; }
`;

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function badge(): string {
  // The black badge on paper, the white one by lamplight. Apple supplies both,
  // and a black badge on the dark ground is a hole in the page.
  return `<a class="badge" href="${APP_STORE_URL}">
    <picture>
      <source srcset="/media/appstore-badge-white.svg" media="(prefers-color-scheme: dark)">
      <img src="/media/appstore-badge-black.svg" width="132" height="44" alt="Download on the App Store">
    </picture>
  </a>`;
}

function shell(opts: {
  path: string;
  title: string;
  description: string;
  ogType: "article" | "website";
  schema: unknown[];
  current: "index" | "guide";
  main: string;
}): string {
  const url = `${SITE_ORIGIN}${opts.path}`;
  return `<!doctype html>
<html lang="en">
<head>
${HEAD_COMMON}
<title>${opts.title}</title>
<meta name="description" content="${escapeAttr(opts.description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#F6F1E7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16130F" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${opts.ogType}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Revely">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${escapeAttr(opts.title)}">
<meta property="og:description" content="${escapeAttr(opts.description)}">
<meta property="og:image" content="${SITE_ORIGIN}/media/og-card-en.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${opts.schema.map(jsonLd).join("\n")}
<style>${DOC_STYLE}${GUIDE_STYLE}</style>
</head>
<body>
<header class="top">
  <div class="shell">
    ${lockupLink("/en", COPY.en.homeLabel)}
    <nav aria-label="Site"><a href="/en/guides"${opts.current === "index" ? ' aria-current="page"' : ""}>Guides</a></nav>
  </div>
</header>
<main class="shell">
${opts.main}
</main>
<footer class="foot">
  <div class="shell">
${footerInner(COPY.en)}
  </div>
</footer>
</body>
</html>`;
}

function card(g: Guide): string {
  return `<li><a href="/en/guides/${g.slug}"><span class="t">${g.title}</span><span class="d">${g.description}</span></a></li>`;
}

function breadcrumbs(items: { name: string; path: string }[]): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_ORIGIN}${item.path}`,
    })),
  };
}

function guidePage(g: Guide): string {
  const path = `/en/guides/${g.slug}`;
  const sources = g.sources
    .map(
      (s, i) =>
        `<li id="source-${i + 1}"><span class="org">${s.org}</span>. <a href="${s.url}" rel="noopener">${s.title}</a>${s.year ? `, ${s.year}` : ""}.</li>`,
    )
    .join("\n    ");
  const related = g.related
    .map((slug) => GUIDES_BY_SLUG.get(slug))
    .filter((r): r is Guide => Boolean(r))
    .map(card)
    .join("\n    ");

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    inLanguage: "en",
    url: `${SITE_ORIGIN}${path}`,
    mainEntityOfPage: `${SITE_ORIGIN}${path}`,
    datePublished: g.published,
    dateModified: g.modified,
    image: `${SITE_ORIGIN}/media/og-card-en.png`,
    author: { "@id": ORG },
    publisher: { "@id": ORG },
    citation: g.sources.map((s) => ({
      "@type": "CreativeWork",
      name: s.title,
      url: s.url,
      publisher: { "@type": "Organization", name: s.org },
    })),
  };

  return shell({
    path,
    title: `${g.title} · Revely`,
    description: g.description,
    ogType: "article",
    current: "guide",
    schema: [
      article,
      breadcrumbs([
        { name: "Revely", path: "/en" },
        { name: "Guides", path: "/en/guides" },
        { name: g.title, path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow"><a href="/en/guides">Guide</a></p>
  <h1>${g.title}</h1>
  <p class="dek">${g.dek}</p>
  <p class="updated">Sources checked ${CHECKED}</p>
</div>
<article>
${g.body}
</article>
<aside class="callout app" aria-label="In Revely">
  <p class="eyebrow">In Revely</p>
  <p>${g.inRevely}</p>
  ${badge()}
</aside>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">Sources</h2>
  <ol>
    ${sources}
  </ol>
  <p class="checked">Every source above was checked against the published text on ${CHECKED}.</p>
</section>
<section class="related" aria-labelledby="related-h">
  <h2 id="related-h">Related guides</h2>
  <ul class="cards">
    ${related}
  </ul>
</section>`,
  });
}

function indexPage(): string {
  const path = "/en/guides";
  const title = "Guides to reading food labels · Revely";
  const description =
    "What the rules say about ingredient lists, and what health authorities say about what’s on them. Every claim links to its source.";
  return shell({
    path,
    title,
    description,
    ogType: "website",
    current: "index",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Guides to reading food labels",
        description,
        url: `${SITE_ORIGIN}${path}`,
        inLanguage: "en",
        publisher: { "@id": ORG },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: GUIDES.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_ORIGIN}/en/guides/${g.slug}`,
            name: g.title,
          })),
        },
      },
      breadcrumbs([
        { name: "Revely", path: "/en" },
        { name: "Guides", path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow">Guides</p>
  <h1>Read the label, not the front of the pack</h1>
  <p class="dek">What the rules say about ingredient lists, and what health authorities say about what’s on them. Every claim links to its source.</p>
</div>
<ul class="cards">
  ${GUIDES.map(card).join("\n  ")}
</ul>`,
  });
}

/** Rendered once at boot, like the home page. */
const INDEX = indexPage();
const PAGES: ReadonlyMap<string, string> = new Map(GUIDES.map((g) => [g.slug, guidePage(g)]));

/**
 * Mount the guides. Before serveStatic(), whose catch-all would otherwise
 * answer first; see registerHomeRoutes().
 */
export function registerGuideRoutes(app: Express): void {
  app.get("/en/guides", (_req, res) => res.type("html").send(INDEX));
  app.get("/en/guides/:slug", (req, res) => {
    const page = PAGES.get(req.params.slug);
    if (!page) return res.status(404).type("html").send(NOT_FOUND);
    res.type("html").send(page);
  });
}
