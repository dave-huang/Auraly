import type { Express } from "express";

import {
  ALLERGEN_PAGES,
  ALLERGEN_PAGES_BY_SLUG,
  ALLERGEN_SOURCES,
  type AllergenPage,
  type AllergenText,
} from "./allergenContent";
import { ALLERGEN_SOURCES_ES, ALLERGENS_ES } from "./allergenContent.es";
import { ALLERGEN_SOURCES_ZH, ALLERGENS_ZH } from "./allergenContent.zh";
import { GUIDES_BY_SLUG, type GuideSource, type GuideText } from "./guideContent";
import { GUIDES_ES } from "./guideContent.es";
import { GUIDES_ZH } from "./guideContent.zh";
import { badge, breadcrumbs, renderPage, UI } from "./guides";
import { NOT_FOUND } from "./legal";
import { HTML_LANG, SITE_LANGUAGES, type Lang } from "./siteCopy";
import { SITE_ORIGIN } from "./siteTheme";

/**
 * /en/allergens, /zh/allergens and /es/allergens: one page per allergen the
 * app checks for, and an index, in each language.
 *
 * These answer the searches people make most about allergens, "other names
 * for milk" and the like, from the same keyword lists the scanner matches
 * against, so the site and the app cannot disagree about what counts. The
 * content and its sourcing rules live in allergenContent.ts; the Chinese and
 * Spanish text in allergenContent.zh.ts and allergenContent.es.ts. The names
 * stay in English in every language, because they are what the matcher and an
 * English label use; each carries a note in the page's language.
 */

const ORG = `${SITE_ORIGIN}/#organization`;

const TEXT: Record<Exclude<Lang, "en">, Record<string, AllergenText>> = { zh: ALLERGENS_ZH, es: ALLERGENS_ES };
const SOURCES: Record<Lang, Record<string, GuideSource>> = {
  en: ALLERGEN_SOURCES,
  zh: ALLERGEN_SOURCES_ZH,
  es: ALLERGEN_SOURCES_ES,
};
const GUIDE_TEXT: Record<Lang, Record<string, GuideText>> = {
  en: Object.fromEntries(Array.from(GUIDES_BY_SLUG.values()).map((g) => [g.slug, g])),
  zh: GUIDES_ZH,
  es: GUIDES_ES,
};

/** The page furniture, per language. */
const T: Record<
  Lang,
  {
    allergen: string;
    names: (noun: string) => string;
    notIt: (noun: string) => string;
    law: string;
    us: string;
    eu: string;
    jp: string;
    elsewhere: string;
    columns: Record<"en" | "es" | "zh" | "ja", string>;
    inRevely: (label: string, noun: string) => string;
    checked: string;
    checkedAll: string;
    related: string;
    cite: string;
    index: {
      title: string;
      description: string;
      where: string;
      allergen: string;
      short: { us: string; eu: string; jp: string };
      sources: string;
      mayContain: string;
      compare: string;
      every: string;
    };
  }
> = {
  en: {
    allergen: "Allergen",
    names: (n) => `Names that mean ${n}`,
    notIt: (n) => `Look-alikes that aren’t ${n}`,
    law: "What the law requires",
    us: "United States",
    eu: "European Union",
    jp: "Japan",
    elsewhere: "On labels in other languages",
    columns: { en: "English", es: "Spanish", zh: "Chinese", ja: "Japanese" },
    inRevely: (_l, n) =>
      `Add ${n} to a profile and Revely checks every label you scan for the names on this page, whatever language the label is printed in.`,
    checked: "Sources checked September 26, 2026",
    checkedAll: "Every source above was checked against the published text on September 26, 2026.",
    related: "Related",
    cite: "Source",
    index: {
      title: "Food allergens and every name they go by",
      description:
        "The 15 allergens Revely checks for: the names each one goes by on an ingredient list, and whether the US, the EU and Japan require it to be declared.",
      where: "Where each one has to be declared",
      allergen: "Allergen",
      short: { us: "US", eu: "EU", jp: "Japan" },
      sources: "Sources: the FDA,[[fda]] the EU’s allergen annex[[eu]] and Japan’s Consumer Affairs Agency.[[jp]]",
      mayContain:
        "In the US, “may contain” warnings are voluntary.[[fda]] Japan goes further and doesn’t allow a bare “may contain” at all. It recommends saying what else the factory makes instead.[[jp]]",
      compare: "How US and EU labels show allergens, side by side.",
      every: "Every allergen",
    },
  },
  zh: {
    allergen: "过敏原",
    names: (n) => `代表${n}的名称`,
    notIt: (n) => `看起来像${n}、其实不是的`,
    law: "法律要求",
    us: "美国",
    eu: "欧盟",
    jp: "日本",
    elsewhere: "其他语言的标签上",
    columns: { en: "英文", es: "西班牙文", zh: "中文", ja: "日文" },
    inRevely: (l) =>
      `在档案中加入“${l}”，Revely 就会在你扫描的每一张标签上查找本页列出的名称，无论标签用什么语言印刷。`,
    checked: "来源核对于 2026 年 9 月 26 日",
    checkedAll: "以上所有来源均已于 2026 年 9 月 26 日与公开发布的原文核对。",
    related: "相关内容",
    cite: "来源",
    index: {
      title: "食品过敏原及其各种名称",
      description: "Revely 检查的 15 种过敏原：每一种在配料表上的各种名称，以及美国、欧盟和日本是否要求标示。",
      where: "各地的标示要求",
      allergen: "过敏原",
      short: { us: "美国", eu: "欧盟", jp: "日本" },
      sources: "来源：FDA、[[fda]]欧盟过敏原附件[[eu]]和日本消费者厅。[[jp]]",
      mayContain:
        "在美国，“可能含有”警告是自愿标注的。[[fda]] 日本更进一步，完全不允许只写“可能含有”，而是建议写明工厂还生产哪些产品。[[jp]]",
      compare: "美国和欧盟标签如何标示过敏原：并排对比。",
      every: "全部过敏原",
    },
  },
  es: {
    allergen: "Alérgeno",
    names: (n) => `Nombres que indican ${n}`,
    notIt: (n) => `Parecen ${n}, pero no lo son`,
    law: "Qué exige la ley",
    us: "Estados Unidos",
    eu: "Unión Europea",
    jp: "Japón",
    elsewhere: "En etiquetas en otros idiomas",
    columns: { en: "Inglés", es: "Español", zh: "Chino", ja: "Japonés" },
    inRevely: (l) =>
      `Añade “${l}” a un perfil y Revely revisará cada etiqueta que escanees en busca de los nombres de esta página, en el idioma en que esté impresa.`,
    checked: "Fuentes comprobadas el 26 de septiembre de 2026",
    checkedAll: "Todas las fuentes anteriores se comprobaron con el texto publicado el 26 de septiembre de 2026.",
    related: "Relacionado",
    cite: "Fuente",
    index: {
      title: "Alérgenos alimentarios y todos sus nombres",
      description:
        "Los 15 alérgenos que Revely revisa: los nombres de cada uno en una lista de ingredientes, y si EE. UU., la UE y Japón exigen declararlo.",
      where: "Dónde hay que declarar cada uno",
      allergen: "Alérgeno",
      short: { us: "EE. UU.", eu: "UE", jp: "Japón" },
      sources: "Fuentes: la FDA,[[fda]] el anexo de alérgenos de la UE[[eu]] y la Agencia de Asuntos del Consumidor de Japón.[[jp]]",
      mayContain:
        "En EE. UU., las advertencias “puede contener” son voluntarias.[[fda]] Japón va más allá y no permite un simple “puede contener”: recomienda indicar qué más se fabrica en la planta.[[jp]]",
      compare: "Cómo muestran los alérgenos las etiquetas de EE. UU. y la UE, lado a lado.",
      every: "Todos los alérgenos",
    },
  },
};

interface View {
  noun: string;
  label: string;
  title: string;
  description: string;
  dek: string;
  names: { term: string; note?: string }[];
  notIt?: { term: string; note: string }[];
  law: { us: string; eu: string; jp: string };
  status: { us: string; eu: string; jp: string };
  more?: string;
}

/** A page in one language. The English names always come from the English page. */
function view(p: AllergenPage, lang: Lang): View {
  if (lang === "en") return p;
  const t = TEXT[lang][p.slug];
  return {
    ...t,
    names: p.names.map((n, i) => ({ term: n.term, note: t.names[i] })),
    notIt: p.notIt?.map((n, i) => ({ term: n.term, note: t.notIt![i] })),
  };
}

function pathsFor(slug: string | null): Record<Lang, string> {
  const tail = slug ? `/allergens/${slug}` : "/allergens";
  return { en: `/en${tail}`, zh: `/zh${tail}`, es: `/es${tail}` };
}

/** Every allergen URL, for canonicalHost(). */
export const ALLERGEN_PATHS: readonly string[] = [null, ...ALLERGEN_PAGES.map((p) => p.slug)].flatMap((s) =>
  Object.values(pathsFor(s)),
);

/** The same URLs grouped as translations of each other, for the sitemap. */
export const ALLERGEN_ALTERNATES: readonly Record<Lang, string>[] = [null, ...ALLERGEN_PAGES.map((p) => p.slug)].map(
  pathsFor,
);

const ALLERGEN_STYLE = `
.names { list-style: none; padding: 0; margin: 0 0 16px; }
.names li { display: grid; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--rule); margin: 0; }
.names li:first-child { border-top: 1px solid var(--rule); }
.names strong { font-weight: 600; }
.names span { font-size: 0.9375rem; color: var(--ink-muted); }
th[scope="row"] { font-family: var(--sans); font-size: 0.9375rem; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink); border-bottom-color: var(--rule); }
/* A Chinese row label ("美国") would otherwise break between its characters. */
th[scope="row"] { word-break: keep-all; min-width: 4.5em; }
td :lang(ja), td :lang(zh-Hans) { font-family: var(--sans); }
`;

/**
 * Turn [[key]] markers into numbered citations, numbering in order of first
 * appearance across the page, and return the sources in that order.
 */
function citations(fragments: string[], lang: Lang): { html: string[]; sources: GuideSource[] } {
  const order: string[] = [];
  const html = fragments.map((fragment) =>
    fragment.replace(/\[\[([a-z0-9-]+)\]\]/g, (_m, key: string) => {
      if (!SOURCES[lang][key]) throw new Error(`unknown allergen source [[${key}]] (${lang})`);
      if (!order.includes(key)) order.push(key);
      const n = order.indexOf(key) + 1;
      return `<sup class="cite"><a href="#source-${n}" aria-label="${T[lang].cite} ${n}">${n}</a></sup>`;
    }),
  );
  return { html, sources: order.map((key) => SOURCES[lang][key]) };
}

function list(items: { term: string; note?: string }[]): string {
  return `<ul class="names">
  ${items.map((i) => `<li><strong lang="en">${i.term}</strong>${i.note ? `<span>${i.note}</span>` : ""}</li>`).join("\n  ")}
</ul>`;
}

function card(href: string, title: string, description: string): string {
  return `<li><a href="${href}"><span class="t">${title}</span><span class="d">${description}</span></a></li>`;
}

function sourceList(sources: GuideSource[]): string {
  return sources
    .map(
      (s, i) =>
        `<li id="source-${i + 1}"><span class="org">${s.org}</span>. <a href="${s.url}" rel="noopener">${s.title}</a>${s.year ? `, ${s.year}` : ""}${s.note ? ` ${s.note}` : ""}.</li>`,
    )
    .join("\n    ");
}

/** The other-languages table, with the page's own language first. */
function elsewhereTable(p: AllergenPage, lang: Lang): string {
  const order: ("es" | "zh" | "ja")[] = lang === "zh" ? ["zh", "es", "ja"] : lang === "es" ? ["es", "zh", "ja"] : ["es", "zh", "ja"];
  const cols = order.filter((c) => p.elsewhere[c]);
  const tag = { es: "es", zh: "zh-Hans", ja: "ja" } as const;
  return `<div class="scroll">
<table>
  <thead><tr>${cols.map((c) => `<th scope="col">${T[lang].columns[c]}</th>`).join("")}</tr></thead>
  <tbody><tr>${cols.map((c) => `<td lang="${tag[c]}">${p.elsewhere[c]}</td>`).join("")}</tr></tbody>
</table>
</div>`;
}

function allergenPage(p: AllergenPage, lang: Lang): string {
  const v = view(p, lang);
  const t = T[lang];
  const paths = pathsFor(p.slug);
  const path = paths[lang];
  const { html, sources } = citations([v.law.us, v.law.eu, v.law.jp, v.more ?? ""], lang);
  const [us, eu, jp, more] = html;

  const related = [
    ...p.related
      .map((slug) => ALLERGEN_PAGES_BY_SLUG.get(slug))
      .filter((r): r is AllergenPage => Boolean(r))
      .map((r) => {
        const rv = view(r, lang);
        return card(`/${lang}/allergens/${r.slug}`, rv.title, rv.description);
      }),
    ...["allergen-labeling-us-and-eu", "how-to-read-an-ingredient-list"]
      .filter((slug) => GUIDE_TEXT[lang][slug])
      .map((slug) => card(`/${lang}/guides/${slug}`, GUIDE_TEXT[lang][slug].title, GUIDE_TEXT[lang][slug].description)),
  ].join("\n    ");

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: v.title,
    description: v.description,
    inLanguage: HTML_LANG[lang],
    url: `${SITE_ORIGIN}${path}`,
    mainEntityOfPage: `${SITE_ORIGIN}${path}`,
    datePublished: "2026-09-26",
    dateModified: "2026-09-26",
    image: `${SITE_ORIGIN}/media/og-card-${lang}.png`,
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
    lang,
    paths,
    title: `${v.title} · Revely`,
    description: v.description,
    ogType: "article",
    section: "allergens",
    isIndex: false,
    style: ALLERGEN_STYLE,
    schema: [
      article,
      breadcrumbs([
        { name: "Revely", path: `/${lang}` },
        { name: UI[lang].allergens, path: `/${lang}/allergens` },
        { name: v.label, path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow"><a href="/${lang}/allergens">${t.allergen}</a></p>
  <h1>${v.title}</h1>
  <p class="dek">${v.dek}</p>
  <p class="updated">${t.checked}</p>
</div>
<article>
<h2>${t.names(v.noun)}</h2>
${list(v.names)}
${v.notIt ? `<h2>${t.notIt(v.noun)}</h2>\n${list(v.notIt)}` : ""}

<h2>${t.law}</h2>
<div class="scroll">
<table>
  <tbody>
    <tr><th scope="row">${t.us}</th><td>${us}</td></tr>
    <tr><th scope="row">${t.eu}</th><td>${eu}</td></tr>
    <tr><th scope="row">${t.jp}</th><td>${jp}</td></tr>
  </tbody>
</table>
</div>

<h2>${t.elsewhere}</h2>
${elsewhereTable(p, lang)}
${more}
</article>
<aside class="callout app" aria-label="${UI[lang].inRevely}">
  <p class="eyebrow">${UI[lang].inRevely}</p>
  <p>${t.inRevely(v.label, v.noun)}</p>
  ${badge(lang)}
</aside>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">${UI[lang].sources}</h2>
  <ol>
    ${sourceList(sources)}
  </ol>
  <p class="checked">${t.checkedAll}</p>
</section>
<section class="related" aria-labelledby="related-h">
  <h2 id="related-h">${t.related}</h2>
  <ul class="cards">
    ${related}
  </ul>
</section>`,
  });
}

function indexPage(lang: Lang): string {
  const t = T[lang];
  const paths = pathsFor(null);
  const path = paths[lang];
  const { html, sources } = citations([t.index.sources, `<p>${t.index.mayContain}</p>`], lang);
  const rows = ALLERGEN_PAGES.map((p) => {
    const v = view(p, lang);
    return `<tr><th scope="row"><a href="/${lang}/allergens/${p.slug}">${v.label}</a></th><td>${v.status.us}</td><td>${v.status.eu}</td><td>${v.status.jp}</td></tr>`;
  }).join("\n    ");

  return renderPage({
    lang,
    paths,
    title: `${t.index.title} · Revely`,
    description: t.index.description,
    ogType: "website",
    section: "allergens",
    isIndex: true,
    style: ALLERGEN_STYLE,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t.index.title,
        description: t.index.description,
        url: `${SITE_ORIGIN}${path}`,
        inLanguage: HTML_LANG[lang],
        publisher: { "@id": ORG },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: ALLERGEN_PAGES.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${SITE_ORIGIN}/${lang}/allergens/${p.slug}`,
            name: view(p, lang).title,
          })),
        },
      },
      breadcrumbs([
        { name: "Revely", path: `/${lang}` },
        { name: UI[lang].allergens, path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow">${UI[lang].allergens}</p>
  <h1>${t.index.title}</h1>
  <p class="dek">${t.index.description}</p>
  <p class="updated">${t.checked}</p>
</div>
<h2>${t.index.where}</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">${t.index.allergen}</th><th scope="col">${t.index.short.us}</th><th scope="col">${t.index.short.eu}</th><th scope="col">${t.index.short.jp}</th></tr></thead>
  <tbody>
    ${rows}
  </tbody>
</table>
</div>
<p class="meta">${html[0]}</p>
${html[1]}
<p><a href="/${lang}/guides/allergen-labeling-us-and-eu">${t.index.compare}</a></p>

<h2>${t.index.every}</h2>
<ul class="cards">
  ${ALLERGEN_PAGES.map((p) => {
    const v = view(p, lang);
    return card(`/${lang}/allergens/${p.slug}`, v.title, v.description);
  }).join("\n  ")}
</ul>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">${UI[lang].sources}</h2>
  <ol>
    ${sourceList(sources)}
  </ol>
</section>`,
  });
}

// A translation missing a page is a build error, not a 404 in production.
for (const lang of ["zh", "es"] as const) {
  for (const p of ALLERGEN_PAGES) {
    const t = TEXT[lang][p.slug];
    if (!t) throw new Error(`allergen ${p.slug} has no ${lang} text`);
    if (t.names.length !== p.names.length || (t.notIt?.length ?? 0) !== (p.notIt?.length ?? 0)) {
      throw new Error(`allergen ${p.slug} (${lang}) has a names or look-alikes list out of step with English`);
    }
  }
}

const INDEX: Record<Lang, string> = Object.fromEntries(SITE_LANGUAGES.map((l) => [l, indexPage(l)])) as Record<Lang, string>;
const PAGES: Record<Lang, ReadonlyMap<string, string>> = Object.fromEntries(
  SITE_LANGUAGES.map((l) => [l, new Map(ALLERGEN_PAGES.map((p) => [p.slug, allergenPage(p, l)]))]),
) as unknown as Record<Lang, ReadonlyMap<string, string>>;

function serve(lang: Lang) {
  return (req: { params: { slug: string } }, res: any) => {
    const page = PAGES[lang].get(req.params.slug);
    if (!page) return res.status(404).type("html").send(NOT_FOUND);
    res.type("html").send(page);
  };
}

/**
 * Mount the allergen pages. Before serveStatic(), like the guides.
 * Written out literally for the route audit in eval/auth.check.ts.
 */
export function registerAllergenRoutes(app: Express): void {
  app.get("/en/allergens", (_req, res) => res.type("html").send(INDEX.en));
  app.get("/zh/allergens", (_req, res) => res.type("html").send(INDEX.zh));
  app.get("/es/allergens", (_req, res) => res.type("html").send(INDEX.es));
  app.get("/en/allergens/:slug", serve("en"));
  app.get("/zh/allergens/:slug", serve("zh"));
  app.get("/es/allergens/:slug", serve("es"));
}
