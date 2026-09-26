import type { Express } from "express";

import { breadcrumbs, renderPage, SECTION_LANGS, UI, type Section } from "./guides";
import { HTML_LANG, SITE_LANGUAGES, type Lang } from "./siteCopy";
import { SITE_ORIGIN } from "./siteTheme";

/**
 * /en/learn, /zh/learn, /es/learn: the index of every content section, and
 * where the header's Learn menu and the footer's Learn link go.
 *
 * Sections not yet translated are listed anyway, linked to English and marked
 * as such, so a Chinese reader can still find the allergen pages.
 */

const ORG = `${SITE_ORIGIN}/#organization`;

const COPY: Record<
  Lang,
  { title: string; dek: string; sections: Record<Exclude<Section, "learn">, string> }
> = {
  en: {
    title: "Learn to read any food label",
    dek: "Guides to reading labels, every name each allergen goes by, and what regulators say about each additive. Every claim links to its source.",
    sections: {
      guides: "What the rules say about ingredient lists, and what health authorities say about what’s on them.",
      allergens: "The 15 allergens Revely checks for, and every name they go by on a label.",
      additives: "E numbers from E100 to E1520, and what EFSA, the FDA and others have said about them.",
    },
  },
  zh: {
    title: "读懂任何食品标签",
    dek: "读标签的指南、每种过敏原在标签上的各种名称，以及监管机构对每种添加剂的说法。每一条说法都附有来源。",
    sections: {
      guides: "关于配料表的规定，以及卫生机构对其中成分的说法。",
      allergens: "Revely 检查的 15 种过敏原，以及它们在标签上的各种名称。",
      additives: "从 E100 到 E1520 的 E 编号，以及 EFSA、FDA 等机构对它们的说法。",
    },
  },
  es: {
    title: "Aprende a leer cualquier etiqueta",
    dek: "Guías para leer etiquetas, todos los nombres de cada alérgeno y lo que dicen los reguladores sobre cada aditivo. Cada afirmación enlaza a su fuente.",
    sections: {
      guides: "Lo que dicen las normas sobre las listas de ingredientes y lo que dicen las autoridades sanitarias sobre lo que contienen.",
      allergens: "Los 15 alérgenos que Revely revisa y todos los nombres que usan en una etiqueta.",
      additives: "Los números E del E100 al E1520 y lo que han dicho la EFSA, la FDA y otros sobre ellos.",
    },
  },
};

export const LEARN_PATHS: Record<Lang, string> = { en: "/en/learn", zh: "/zh/learn", es: "/es/learn" };

function learnPage(lang: Lang): string {
  const c = COPY[lang];
  const ui = UI[lang];
  const labels: Record<Exclude<Section, "learn">, string> = {
    guides: ui.guides,
    allergens: ui.allergens,
    additives: ui.additives,
  };
  const cards = (["guides", "allergens", "additives"] as const)
    .map((section) => {
      const here = SECTION_LANGS[section].includes(lang);
      const href = `/${here ? lang : "en"}/${section}`;
      const note = here ? "" : ` <span class="meta">${ui.inEnglish}</span>`;
      return `<li><a href="${href}"${here ? "" : ' hreflang="en"'}><span class="t">${labels[section]}${note}</span><span class="d">${c.sections[section]}</span></a></li>`;
    })
    .join("\n  ");

  return renderPage({
    lang,
    paths: LEARN_PATHS,
    title: `${c.title} · Revely`,
    description: c.dek,
    ogType: "website",
    section: "learn",
    isIndex: true,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: c.title,
        description: c.dek,
        url: `${SITE_ORIGIN}${LEARN_PATHS[lang]}`,
        inLanguage: HTML_LANG[lang],
        publisher: { "@id": ORG },
      },
      breadcrumbs([
        { name: "Revely", path: `/${lang}` },
        { name: ui.learn, path: LEARN_PATHS[lang] },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow">${ui.learn}</p>
  <h1>${c.title}</h1>
  <p class="dek">${c.dek}</p>
</div>
<ul class="cards">
  ${cards}
</ul>`,
  });
}

const PAGES: Record<Lang, string> = Object.fromEntries(
  SITE_LANGUAGES.map((l) => [l, learnPage(l)]),
) as Record<Lang, string>;

/** Written out literally for the route audit in eval/auth.check.ts. */
export function registerLearnRoutes(app: Express): void {
  app.get("/en/learn", (_req, res) => res.type("html").send(PAGES.en));
  app.get("/zh/learn", (_req, res) => res.type("html").send(PAGES.zh));
  app.get("/es/learn", (_req, res) => res.type("html").send(PAGES.es));
}
