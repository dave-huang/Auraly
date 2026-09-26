import type { Express } from "express";

import { ALLERGEN_PAGES, ALLERGEN_PAGES_BY_SLUG, ALLERGEN_SOURCES, type AllergenPage } from "./allergenContent";
import { GUIDES_BY_SLUG } from "./guideContent";
import { badge, breadcrumbs, renderPage } from "./guides";
import { NOT_FOUND } from "./legal";
import { SITE_ORIGIN } from "./siteTheme";

/**
 * /en/allergens: one page per allergen the app checks for, and an index.
 *
 * These answer the searches people make most about allergens, "other names
 * for milk" and the like, from the same keyword lists the scanner matches
 * against, so the site and the app cannot disagree about what counts. The
 * content and its sourcing rules live in allergenContent.ts.
 *
 * English only for now. Rendered through the guides' page shell, so the
 * header, footer, themes and structured data are the same everywhere.
 */

const ORG = `${SITE_ORIGIN}/#organization`;
const CHECKED = "September 26, 2026";

/** Every allergen URL, for the sitemap and canonicalHost(). */
export const ALLERGEN_PATHS: readonly string[] = [
  "/en/allergens",
  ...ALLERGEN_PAGES.map((p) => `/en/allergens/${p.slug}`),
];

const ALLERGEN_STYLE = `
.names { list-style: none; padding: 0; margin: 0 0 16px; }
.names li { display: grid; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--rule); margin: 0; }
.names li:first-child { border-top: 1px solid var(--rule); }
.names strong { font-weight: 600; }
.names span { font-size: 0.9375rem; color: var(--ink-muted); }
th[scope="row"] { font-family: var(--sans); font-size: 0.9375rem; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink); border-bottom-color: var(--rule); }
td :lang(ja), td :lang(zh-Hans) { font-family: var(--sans); }
`;

/**
 * Turn [[key]] markers into numbered citations, numbering in order of first
 * appearance across the page, and return the sources in that order.
 */
function citations(fragments: string[]): { html: string[]; sources: (typeof ALLERGEN_SOURCES)[string][] } {
  const order: string[] = [];
  const html = fragments.map((fragment) =>
    fragment.replace(/\[\[([a-z0-9-]+)\]\]/g, (_m, key: string) => {
      if (!ALLERGEN_SOURCES[key]) throw new Error(`unknown allergen source [[${key}]]`);
      if (!order.includes(key)) order.push(key);
      const n = order.indexOf(key) + 1;
      return `<sup class="cite"><a href="#source-${n}" aria-label="Source ${n}">${n}</a></sup>`;
    }),
  );
  return { html, sources: order.map((key) => ALLERGEN_SOURCES[key]) };
}

function list(items: { term: string; note?: string }[]): string {
  return `<ul class="names">
  ${items.map((i) => `<li><strong>${i.term}</strong>${i.note ? `<span>${i.note}</span>` : ""}</li>`).join("\n  ")}
</ul>`;
}

function card(href: string, title: string, description: string): string {
  return `<li><a href="${href}"><span class="t">${title}</span><span class="d">${description}</span></a></li>`;
}

function sourceList(sources: (typeof ALLERGEN_SOURCES)[string][]): string {
  return sources
    .map(
      (s, i) =>
        `<li id="source-${i + 1}"><span class="org">${s.org}</span>. <a href="${s.url}" rel="noopener">${s.title}</a>${s.year ? `, ${s.year}` : ""}${s.note ? ` ${s.note}` : ""}.</li>`,
    )
    .join("\n    ");
}

function allergenPage(p: AllergenPage): string {
  const path = `/en/allergens/${p.slug}`;
  const { html, sources } = citations([p.law.us, p.law.eu, p.law.jp, p.more ?? ""]);
  const [us, eu, jp, more] = html;

  const related = [
    ...p.related
      .map((slug) => ALLERGEN_PAGES_BY_SLUG.get(slug))
      .filter((r): r is AllergenPage => Boolean(r))
      .map((r) => card(`/en/allergens/${r.slug}`, r.title, r.description)),
    ...["allergen-labeling-us-and-eu", "how-to-read-an-ingredient-list"]
      .map((slug) => GUIDES_BY_SLUG.get(slug))
      .filter((g) => Boolean(g))
      .map((g) => card(`/en/guides/${g!.slug}`, g!.title, g!.description)),
  ].join("\n    ");

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.description,
    inLanguage: "en",
    url: `${SITE_ORIGIN}${path}`,
    mainEntityOfPage: `${SITE_ORIGIN}${path}`,
    datePublished: "2026-09-26",
    dateModified: "2026-09-26",
    image: `${SITE_ORIGIN}/media/og-card-en.png`,
    author: { "@id": ORG },
    publisher: { "@id": ORG },
    about: { "@type": "Thing", name: `${p.label} allergy` },
    citation: sources.map((s) => ({
      "@type": "CreativeWork",
      name: s.title,
      url: s.url,
      publisher: { "@type": "Organization", name: s.org },
    })),
  };

  return renderPage({
    lang: "en",
    paths: { en: path },
    title: `${p.title} · Revely`,
    description: p.description,
    ogType: "article",
    section: "allergens",
    isIndex: false,
    schema: [
      article,
      breadcrumbs([
        { name: "Revely", path: "/en" },
        { name: "Allergens", path: "/en/allergens" },
        { name: p.label, path },
      ]),
    ],
    style: ALLERGEN_STYLE,
    main: `<div class="masthead">
  <p class="eyebrow"><a href="/en/allergens">Allergen</a></p>
  <h1>${p.title}</h1>
  <p class="dek">${p.dek}</p>
  <p class="updated">Sources checked ${CHECKED}</p>
</div>
<article>
<h2>Names that mean ${p.noun}</h2>
${list(p.names)}
${p.notIt ? `<h2>Look-alikes that aren’t ${p.noun}</h2>\n${list(p.notIt)}` : ""}

<h2>What the law requires</h2>
<div class="scroll">
<table>
  <tbody>
    <tr><th scope="row">United States</th><td>${us}</td></tr>
    <tr><th scope="row">European Union</th><td>${eu}</td></tr>
    <tr><th scope="row">Japan</th><td>${jp}</td></tr>
  </tbody>
</table>
</div>

<h2>On labels in other languages</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">Spanish</th><th scope="col">Chinese</th>${p.elsewhere.ja ? '<th scope="col">Japanese</th>' : ""}</tr></thead>
  <tbody><tr><td lang="es">${p.elsewhere.es}</td><td lang="zh-Hans">${p.elsewhere.zh}</td>${p.elsewhere.ja ? `<td lang="ja">${p.elsewhere.ja}</td>` : ""}</tr></tbody>
</table>
</div>
${more}
</article>
<aside class="callout app" aria-label="In Revely">
  <p class="eyebrow">In Revely</p>
  <p>Add ${p.noun} to a profile and Revely checks every label you scan for the names on this page, whatever language the label is printed in.</p>
  ${badge("en")}
</aside>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">Sources</h2>
  <ol>
    ${sourceList(sources)}
  </ol>
  <p class="checked">Every source above was checked against the published text on ${CHECKED}.</p>
</section>
<section class="related" aria-labelledby="related-h">
  <h2 id="related-h">Related</h2>
  <ul class="cards">
    ${related}
  </ul>
</section>`,
  });
}

function indexPage(): string {
  const path = "/en/allergens";
  const title = "Food allergens and every name they go by";
  const description =
    "The 15 allergens Revely checks for: the names each one goes by on an ingredient list, and whether the US, the EU and Japan require it to be declared.";
  const { html, sources } = citations([
    "Sources: the FDA,[[fda]] the EU’s allergen annex[[eu]] and Japan’s Consumer Affairs Agency.[[jp]]",
    `<p>In the US, “may contain” warnings are voluntary.[[fda]] Japan goes further and doesn’t allow a bare “may contain” at all. It recommends saying what else the factory makes instead.[[jp]]</p>`,
  ]);
  const rows = ALLERGEN_PAGES.map(
    (p) =>
      `<tr><th scope="row"><a href="/en/allergens/${p.slug}">${p.label}</a></th><td>${p.status.us}</td><td>${p.status.eu}</td><td>${p.status.jp}</td></tr>`,
  ).join("\n    ");

  return renderPage({
    lang: "en",
    paths: { en: path },
    title: `${title} · Revely`,
    description,
    ogType: "website",
    section: "allergens",
    isIndex: true,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        url: `${SITE_ORIGIN}${path}`,
        inLanguage: "en",
        publisher: { "@id": ORG },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: ALLERGEN_PAGES.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_ORIGIN}/en/allergens/${p.slug}`,
            name: p.title,
          })),
        },
      },
      breadcrumbs([
        { name: "Revely", path: "/en" },
        { name: "Allergens", path },
      ]),
    ],
    style: ALLERGEN_STYLE,
    main: `<div class="masthead">
  <p class="eyebrow">Allergens</p>
  <h1>${title}</h1>
  <p class="dek">${description}</p>
  <p class="updated">Sources checked ${CHECKED}</p>
</div>
<h2>Where each one has to be declared</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">Allergen</th><th scope="col">US</th><th scope="col">EU</th><th scope="col">Japan</th></tr></thead>
  <tbody>
    ${rows}
  </tbody>
</table>
</div>
<p class="meta">${html[0]}</p>
${html[1]}
<p><a href="/en/guides/allergen-labeling-us-and-eu">How US and EU labels show allergens, side by side.</a></p>

<h2>Every allergen</h2>
<ul class="cards">
  ${ALLERGEN_PAGES.map((p) => card(`/en/allergens/${p.slug}`, p.title, p.description)).join("\n  ")}
</ul>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">Sources</h2>
  <ol>
    ${sourceList(sources)}
  </ol>
</section>`,
  });
}

const INDEX = indexPage();
const PAGES: ReadonlyMap<string, string> = new Map(ALLERGEN_PAGES.map((p) => [p.slug, allergenPage(p)]));

/**
 * Mount the allergen pages. Before serveStatic(), like the guides.
 * Written out literally for the route audit in eval/auth.check.ts.
 */
export function registerAllergenRoutes(app: Express): void {
  app.get("/en/allergens", (_req, res) => res.type("html").send(INDEX));
  app.get("/en/allergens/:slug", (req, res) => {
    const page = PAGES.get(req.params.slug);
    if (!page) return res.status(404).type("html").send(NOT_FOUND);
    res.type("html").send(page);
  });
}
