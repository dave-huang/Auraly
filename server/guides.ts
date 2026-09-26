import type { Express } from "express";

import { GUIDES, GUIDES_BY_SLUG, type Guide, type GuideText } from "./guideContent";
import { GUIDES_ES } from "./guideContent.es";
import { GUIDES_ZH } from "./guideContent.zh";
import { DOC_STYLE, NOT_FOUND } from "./legal";
import { COPY, HTML_LANG, LANGUAGE_NAMES, SITE_LANGUAGES, type Lang } from "./siteCopy";
import { HEAD_COMMON, SITE_ORIGIN, footerInner, lockupLink } from "./siteTheme";

/**
 * The guides: /en/guides, /zh/guides and /es/guides, and one page per guide
 * under each.
 *
 * These exist to be found. The home page can only rank for "Revely"; the
 * questions people actually type ("names for sugar on a label", "what is E102")
 * are answered here, each with its sources, which is the same thing the app
 * does on a verdict card.
 *
 * Built on the legal documents' stylesheet rather than the home page's, for
 * the same reason those are: a long read wants one column and the system's
 * light and dark themes, and the home page is deliberately a single-theme
 * poster. The content lives in guideContent.ts (English, and the rules every
 * sentence has to follow) and guideContent.zh.ts / guideContent.es.ts.
 *
 * Every language uses the English slug, so one guide is one slug everywhere
 * and the hreflang set is just the three prefixes.
 */

const APP_STORE_URL = "https://apps.apple.com/app/id6799481205";
const ORG = `${SITE_ORIGIN}/#organization`;

/** The written text of every guide, per language. English carries the meta. */
const TEXT: Record<Lang, Record<string, GuideText>> = {
  en: Object.fromEntries(GUIDES.map((g) => [g.slug, g])),
  zh: GUIDES_ZH,
  es: GUIDES_ES,
};

const OG_LOCALE: Record<Lang, string> = { en: "en_US", zh: "zh_CN", es: "es_ES" };

/** Short enough for a phone's header; the full name is the accessible label. */
const LANG_SHORT: Record<Lang, string> = { en: "EN", zh: "中文", es: "ES" };

/** The page furniture, per language. Content strings live with the content. */
export const UI: Record<
  Lang,
  {
    guide: string;
    guides: string;
    inRevely: string;
    sources: string;
    related: string;
    checked: string;
    checkedAll: string;
    indexTitle: string;
    indexH1: string;
    indexDescription: string;
    languages: string;
    allergens: string;
    site: string;
    additives: string;
    learn: string;
    allTopics: string;
    inEnglish: string;
  }
> = {
  en: {
    guide: "Guide",
    guides: "Guides",
    inRevely: "In Revely",
    sources: "Sources",
    related: "Related guides",
    checked: "Sources checked September 25, 2026",
    checkedAll: "Every source above was checked against the published text on September 25, 2026.",
    indexTitle: "Guides to reading food labels",
    indexH1: "Read the label, not the front of the package",
    indexDescription:
      "What the rules say about ingredient lists, and what health authorities say about what’s on them. Every claim links to its source.",
    languages: "Language",
    allergens: "Allergens",
    site: "Site",
    additives: "Additives",
    learn: "Learn",
    allTopics: "All topics",
    inEnglish: "",
  },
  zh: {
    guide: "指南",
    guides: "指南",
    inRevely: "在 Revely 中",
    sources: "来源",
    related: "相关指南",
    checked: "来源核对于 2026 年 9 月 25 日",
    checkedAll: "以上所有来源均已于 2026 年 9 月 25 日与公开发布的原文核对。",
    indexTitle: "读懂食品标签的指南",
    indexH1: "看配料表，而不是包装正面",
    indexDescription: "关于配料表的规定，以及卫生机构对其中成分的说法。每一条说法都附有来源链接。",
    languages: "语言",
    allergens: "过敏原",
    site: "网站",
    additives: "食品添加剂",
    learn: "科普",
    allTopics: "全部内容",
    inEnglish: "英文",
  },
  es: {
    guide: "Guía",
    guides: "Guías",
    inRevely: "En Revely",
    sources: "Fuentes",
    related: "Guías relacionadas",
    checked: "Fuentes comprobadas el 25 de septiembre de 2026",
    checkedAll: "Todas las fuentes anteriores se comprobaron con el texto publicado el 25 de septiembre de 2026.",
    indexTitle: "Guías para leer etiquetas de alimentos",
    indexH1: "Lee la etiqueta, no la parte delantera del envase",
    indexDescription:
      "Lo que dicen las normas sobre las listas de ingredientes y lo que dicen las autoridades sanitarias sobre lo que contienen. Cada afirmación enlaza a su fuente.",
    languages: "Idioma",
    allergens: "Alérgenos",
    site: "Sitio",
    additives: "Aditivos",
    learn: "Aprende",
    allTopics: "Todos los temas",
    inEnglish: "en inglés",
  },
};

/** One guide in every language, or the index in every language. */
function pathsFor(slug: string | null): Record<Lang, string> {
  const tail = slug ? `/guides/${slug}` : "/guides";
  return { en: `/en${tail}`, zh: `/zh${tail}`, es: `/es${tail}` };
}

/** Every guide URL, for canonicalHost(). */
export const GUIDE_PATHS: readonly string[] = [null, ...GUIDES.map((g) => g.slug)].flatMap((slug) =>
  Object.values(pathsFor(slug)),
);

/** The same URLs grouped as translations of each other, for the sitemap. */
export const GUIDE_ALTERNATES: readonly Record<Lang, string>[] = [null, ...GUIDES.map((g) => g.slug)].map(
  pathsFor,
);

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

.top nav { display: flex; align-items: center; gap: 16px; white-space: nowrap; }
.top nav .langs { display: flex; gap: 10px; font-family: var(--mono); font-size: 0.75rem; }
.top nav .langs a[aria-current] { text-decoration: underline; text-underline-offset: 4px; }
.learn { position: relative; }
.learn summary { list-style: none; cursor: pointer; font-size: 0.9375rem; color: var(--ink-muted); }
.learn summary::-webkit-details-marker { display: none; }
.learn summary::after { content: ""; display: inline-block; width: 6px; height: 6px; margin-left: 7px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: translateY(-3px) rotate(45deg); }
.learn[open] summary { color: var(--ink); }
.learn .menu { position: absolute; right: 0; top: calc(100% + 12px); z-index: 20; display: grid; min-width: 220px; padding: 6px 0; background: var(--card); border: 1px solid var(--rule); box-shadow: 0 8px 24px rgba(22, 19, 15, 0.12); }
.learn .menu a { padding: 9px 16px; font-size: 0.9375rem; color: var(--ink); text-decoration: none; white-space: nowrap; }
.learn .menu a:hover, .learn .menu a:focus-visible { background: var(--sunk); }
.learn .menu a[aria-current] { font-weight: 600; }
.learn .menu .note { font-family: var(--mono); font-size: 0.6875rem; color: var(--ink-faint); margin-left: 4px; }
/* The display tracking is tuned for Latin; CJK fills its em box and wants none. */
:lang(zh) h1, :lang(zh) h2, :lang(zh) .cards .t { letter-spacing: 0; }
:lang(zh) .dek { line-height: 1.7; }
`;

export function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

export function badge(lang: Lang): string {
  // The black badge on paper, the white one by lamplight. Apple supplies both,
  // and a black badge on the dark ground is a hole in the page.
  return `<a class="badge" href="${APP_STORE_URL}">
    <picture>
      <source srcset="/media/appstore-badge-white.svg" media="(prefers-color-scheme: dark)">
      <img src="/media/appstore-badge-black.svg" width="132" height="44" alt="${escapeAttr(COPY[lang].badgeAlt)}">
    </picture>
  </a>`;
}

/**
 * The sections the header links to, and the languages each exists in. A link
 * is only drawn in a language the section has, so a Chinese page never sends
 * its reader to an English index without saying so.
 */
export type Section = "guides" | "allergens" | "additives" | "learn";

export const SECTION_LANGS: Record<Section, readonly Lang[]> = {
  guides: SITE_LANGUAGES,
  allergens: SITE_LANGUAGES,
  additives: SITE_LANGUAGES,
  learn: SITE_LANGUAGES,
};

/**
 * The document every guide and allergen page is poured into.
 *
 * `paths` names the page in each language it exists in; hreflang, the
 * language switcher and x-default all come from it, so a page that exists
 * only in English simply has one entry.
 */
export function renderPage(opts: {
  lang: Lang;
  paths: Partial<Record<Lang, string>>;
  title: string;
  description: string;
  ogType: "article" | "website";
  schema: unknown[];
  section: Section;
  isIndex: boolean;
  main: string;
  /** Page-type CSS, appended after the shared stylesheet. */
  style?: string;
}): string {
  const { lang, paths } = opts;
  const url = `${SITE_ORIGIN}${paths[lang]}`;
  const ui = UI[lang];
  const available = SITE_LANGUAGES.filter((l) => paths[l]);
  const alternates =
    available.length > 1
      ? [
          ...available.map(
            (l) => `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${SITE_ORIGIN}${paths[l]}">`,
          ),
          `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${paths.en ?? paths[lang]}">`,
        ].join("\n")
      : "";
  const langLinks =
    available.length > 1
      ? `<span class="langs" role="group" aria-label="${ui.languages}">${available
          .map(
            (l) =>
              `<a href="${paths[l]}" hreflang="${HTML_LANG[l]}" lang="${HTML_LANG[l]}" aria-label="${LANGUAGE_NAMES[l]}"${l === lang ? ' aria-current="true"' : ""}>${LANG_SHORT[l]}</a>`,
          )
          .join("")}</span>`
      : "";
  // The Learn menu: every section, in this language where it exists and in
  // English, marked as such, where it does not yet. A <details> so it opens
  // and closes without script; the script below only closes it on an outside
  // tap. The Learn index is the menu's first item and its no-JS fallback.
  const menuItem = (section: Exclude<Section, "learn">, label: string) => {
    const here = SECTION_LANGS[section].includes(lang);
    const current = opts.section === section && opts.isIndex ? ' aria-current="page"' : "";
    return `<a href="/${here ? lang : "en"}/${section}"${current}>${label}${here ? "" : ` <span class="note">${ui.inEnglish}</span>`}</a>`;
  };
  const learnMenu = `<details class="learn">
        <summary>${ui.learn}</summary>
        <div class="menu">
          <a href="/${lang}/learn"${opts.section === "learn" ? ' aria-current="page"' : ""}>${ui.allTopics}</a>
          ${menuItem("guides", ui.guides)}
          ${menuItem("allergens", ui.allergens)}
          ${menuItem("additives", ui.additives)}
        </div>
      </details>`;
  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">
<head>
${HEAD_COMMON}
<title>${opts.title}</title>
<meta name="description" content="${escapeAttr(opts.description)}">
<link rel="canonical" href="${url}">
${alternates}
<meta name="theme-color" content="#F6F1E7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16130F" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${opts.ogType}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Revely">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
<meta property="og:title" content="${escapeAttr(opts.title)}">
<meta property="og:description" content="${escapeAttr(opts.description)}">
<meta property="og:image" content="${SITE_ORIGIN}/media/og-card-${lang}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${opts.schema.map(jsonLd).join("\n")}
<style>${DOC_STYLE}${GUIDE_STYLE}${opts.style ?? ""}</style>
</head>
<body>
<header class="top">
  <div class="shell">
    ${lockupLink(`/${lang}`, COPY[lang].homeLabel)}
    <nav aria-label="${ui.site}">
      ${learnMenu}
      ${langLinks}
    </nav>
  </div>
</header>
<main class="shell">
${opts.main}
</main>
<footer class="foot">
  <div class="shell">
${footerInner(COPY[lang], `/${lang}/learn`)}
  </div>
</footer>
<script>
document.addEventListener("click", function (e) {
  document.querySelectorAll("details.learn[open]").forEach(function (d) {
    if (!d.contains(e.target)) d.removeAttribute("open");
  });
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") document.querySelectorAll("details.learn[open]").forEach(function (d) { d.removeAttribute("open"); });
});
</script>
</body>
</html>`;
}

function card(lang: Lang, slug: string): string {
  const g = TEXT[lang][slug];
  return `<li><a href="/${lang}/guides/${slug}"><span class="t">${g.title}</span><span class="d">${g.description}</span></a></li>`;
}

export function breadcrumbs(items: { name: string; path: string }[]): unknown {
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

function guidePage(meta: Guide, lang: Lang): string {
  const g = TEXT[lang][meta.slug];
  const ui = UI[lang];
  const paths = pathsFor(meta.slug);
  const path = paths[lang];
  const sources = g.sources
    .map(
      (s, i) =>
        `<li id="source-${i + 1}"><span class="org">${s.org}</span>. <a href="${s.url}" rel="noopener">${s.title}</a>${s.year ? `, ${s.year}` : ""}${s.note ? ` ${s.note}` : ""}.</li>`,
    )
    .join("\n    ");
  const related = meta.related
    .filter((slug) => GUIDES_BY_SLUG.has(slug))
    .map((slug) => card(lang, slug))
    .join("\n    ");

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    inLanguage: HTML_LANG[lang],
    url: `${SITE_ORIGIN}${path}`,
    mainEntityOfPage: `${SITE_ORIGIN}${path}`,
    datePublished: meta.published,
    dateModified: meta.modified,
    image: `${SITE_ORIGIN}/media/og-card-${lang}.png`,
    author: { "@id": ORG },
    publisher: { "@id": ORG },
    citation: g.sources.map((s) => ({
      "@type": "CreativeWork",
      name: s.title,
      url: s.url,
      publisher: { "@type": "Organization", name: s.org },
    })),
  };

  return renderPage({
    lang,
    paths,
    title: `${g.title} · Revely`,
    description: g.description,
    ogType: "article",
    section: "guides",
    isIndex: false,
    schema: [
      article,
      breadcrumbs([
        { name: "Revely", path: `/${lang}` },
        { name: ui.guides, path: `/${lang}/guides` },
        { name: g.title, path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow"><a href="/${lang}/guides">${ui.guide}</a></p>
  <h1>${g.title}</h1>
  <p class="dek">${g.dek}</p>
  <p class="updated">${ui.checked}</p>
</div>
<article>
${g.body}
</article>
<aside class="callout app" aria-label="${ui.inRevely}">
  <p class="eyebrow">${ui.inRevely}</p>
  <p>${g.inRevely}</p>
  ${badge(lang)}
</aside>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">${ui.sources}</h2>
  <ol>
    ${sources}
  </ol>
  <p class="checked">${ui.checkedAll}</p>
</section>
<section class="related" aria-labelledby="related-h">
  <h2 id="related-h">${ui.related}</h2>
  <ul class="cards">
    ${related}
  </ul>
</section>`,
  });
}

function indexPage(lang: Lang): string {
  const ui = UI[lang];
  const paths = pathsFor(null);
  const path = paths[lang];
  return renderPage({
    lang,
    paths,
    title: `${ui.indexTitle} · Revely`,
    description: ui.indexDescription,
    ogType: "website",
    section: "guides",
    isIndex: true,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: ui.indexTitle,
        description: ui.indexDescription,
        url: `${SITE_ORIGIN}${path}`,
        inLanguage: HTML_LANG[lang],
        publisher: { "@id": ORG },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: GUIDES.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_ORIGIN}/${lang}/guides/${g.slug}`,
            name: TEXT[lang][g.slug].title,
          })),
        },
      },
      breadcrumbs([
        { name: "Revely", path: `/${lang}` },
        { name: ui.guides, path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow">${ui.guides}</p>
  <h1>${ui.indexH1}</h1>
  <p class="dek">${ui.indexDescription}</p>
</div>
<ul class="cards">
  ${GUIDES.map((g) => card(lang, g.slug)).join("\n  ")}
</ul>`,
  });
}

/**
 * Guides that have changed address, old slug to new. Permanent, and kept for
 * good: Google was asked to index the old addresses, and a redirect is how a
 * link to one still counts towards the page.
 *
 * The first two moved to American spelling on 2026-09-25.
 */
const MOVED: ReadonlyMap<string, string> = new Map([
  ["food-colour-warnings", "food-color-warnings"],
  ["allergen-labelling-us-and-eu", "allergen-labeling-us-and-eu"],
]);

// A guide missing a translation is a build error, not a 404 in production.
for (const lang of SITE_LANGUAGES) {
  for (const g of GUIDES) {
    if (!TEXT[lang][g.slug]) throw new Error(`guide ${g.slug} has no ${lang} text`);
  }
}

/** Rendered once at boot, like the home page. */
const INDEX: Record<Lang, string> = {
  en: indexPage("en"),
  zh: indexPage("zh"),
  es: indexPage("es"),
};
const PAGES: Record<Lang, ReadonlyMap<string, string>> = {
  en: new Map(GUIDES.map((g) => [g.slug, guidePage(g, "en")])),
  zh: new Map(GUIDES.map((g) => [g.slug, guidePage(g, "zh")])),
  es: new Map(GUIDES.map((g) => [g.slug, guidePage(g, "es")])),
};

function serveGuide(lang: Lang) {
  return (req: { params: { slug: string } }, res: any) => {
    const moved = MOVED.get(req.params.slug);
    if (moved) return res.redirect(301, `/${lang}/guides/${moved}`);
    const page = PAGES[lang].get(req.params.slug);
    if (!page) return res.status(404).type("html").send(NOT_FOUND);
    res.type("html").send(page);
  };
}

/**
 * Mount the guides. Before serveStatic(), whose catch-all would otherwise
 * answer first; see registerHomeRoutes().
 *
 * Written out per language rather than looped, so the route audit in
 * eval/auth.check.ts can read each path; see the same note in home.ts.
 */
export function registerGuideRoutes(app: Express): void {
  app.get("/en/guides", (_req, res) => res.type("html").send(INDEX.en));
  app.get("/zh/guides", (_req, res) => res.type("html").send(INDEX.zh));
  app.get("/es/guides", (_req, res) => res.type("html").send(INDEX.es));
  app.get("/en/guides/:slug", serveGuide("en"));
  app.get("/zh/guides/:slug", serveGuide("zh"));
  app.get("/es/guides/:slug", serveGuide("es"));
}
