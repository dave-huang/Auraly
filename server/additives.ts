import fs from "fs";
import path from "path";
import type { Express } from "express";

import {
  ADDITIVE_NAMES,
  ADDITIVE_SOURCES,
  FAMILIES,
  RELATED_ALLERGENS,
  RELATED_GUIDES,
  familyOf,
} from "./additiveContent";
import { ALLERGEN_PAGES_BY_SLUG } from "./allergenContent";
import { GUIDES_BY_SLUG, type GuideSource } from "./guideContent";
import { badge, breadcrumbs, escapeAttr, renderPage } from "./guides";
import { NOT_FOUND } from "./legal";
import { getEvidenceStore, type EvidenceRecord } from "./services/substances/evidence";
import { getSubstanceRegistry } from "./services/substances/identity";
import { SITE_ORIGIN } from "./siteTheme";

/**
 * /en/additives: every E-number additive in the registry, and a page for each
 * one we hold a substantive record for.
 *
 * GENERATED FROM THE SAME DATA THE APP SHOWS. The records are the evidence
 * store's, the ones behind the app's ingredient drill-down, so the site and
 * the app cannot cite different things. What is written by hand lives in
 * additiveContent.ts: names, the E-number families, and the three definitions
 * the pages quote (EFSA's ADI, IARC's groups, the EU color warning).
 *
 * THE GATE. A page exists only when the additive has a record beyond the
 * FDA's inventory entry: an EFSA acceptable daily intake, an IARC group, a
 * Proposition 65 listing, or one of the hand-verified findings. An inventory
 * line alone ("generally recognized as safe") makes a page with nothing to
 * say, which is the thin content the index row already covers.
 *
 * NO VERDICTS. Pages report what each body said, in our own plain sentences
 * built from the record's fields, and cite it. The app's Safe / Caution /
 * Avoid level is not published here; it belongs to a scan and a profile.
 */

const ORG = `${SITE_ORIGIN}/#organization`;
const CHECKED = "September 26, 2026";

interface Additive {
  id: string;
  e: string;
  name: string;
  aliases: string[];
  category: string | null;
  records: EvidenceRecord[];
  hasPage: boolean;
  slug: string;
}

/** "E407" → "e407-carrageenan". Stable, readable, and unique by E number. */
function slugFor(e: string, name: string): string {
  const words = name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${e.toLowerCase()}-${words}`;
}

function eSort(a: string, b: string): number {
  const na = Number.parseInt(a.replace(/\D/g, ""), 10);
  const nb = Number.parseInt(b.replace(/\D/g, ""), 10);
  return na - nb || a.localeCompare(b);
}

/** Aliases worth printing: readable, not a restatement of the name or E number. */
function readableAliases(names: string[], display: string, e: string): string[] {
  const seen = new Set([display.toLowerCase(), e.toLowerCase()]);
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim();
    const key = n.toLowerCase();
    if (seen.has(key) || n.length > 40 || /^e[ -]?\d/i.test(n)) continue;
    if (n === n.toUpperCase() && /[A-Z]{4,}/.test(n)) continue;
    if (/\(|,/.test(n)) continue;
    seen.add(key);
    out.push(n);
  }
  return out.slice(0, 10);
}

function loadAdditives(): Additive[] {
  const file = path.resolve(process.cwd(), "server/data/substances/substances.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    substances: { id: string; name: string; eNumber?: string | null; category?: string | null; aliases?: { name: string }[] }[];
  };
  const registry = getSubstanceRegistry();
  const evidence = getEvidenceStore();

  return raw.substances
    .filter((s) => s.eNumber)
    .map((s) => {
      const e = s.eNumber!.replace(/\s+/g, "");
      const name = ADDITIVE_NAMES[e] ?? s.name;
      const seen = new Set<string>();
      const records = evidence
        .forSubstancesInDomain(registry.sameSubstanceIds(s.id), "food")
        .filter((r) => {
          // Belt and braces: until 2026-09-26 the Prop 65 ingest kept
          // chemicals OEHHA had delisted, under ids like
          // "saccharin_delisted_april_6_2001_click_here_…", as if still listed.
          // The ingest now skips them (ingest/prop65.ts); this keeps a page
          // from ever repeating one if an old snapshot is re-ingested.
          if (r.substanceId.includes("delisted")) return false;
          const key = `${r.source}|${r.kind}|${r.statement}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      const hasPage = records.some((r) => r.source !== "fda_food_additives");
      return {
        id: s.id,
        e,
        name,
        aliases: readableAliases((s.aliases ?? []).map((a) => a.name), name, e),
        category: s.category ?? null,
        records,
        hasPage,
        slug: slugFor(e, name),
      };
    })
    .sort((a, b) => eSort(a.e, b.e));
}

// ---------------------------------------------------------------------------
// Records, in our own words
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2019-01-30" → "January 30, 2019"; "1-Jan-90" → "January 1, 1990"; "2010" stays. */
function usDate(d?: string | null): string | null {
  if (!d) return null;
  let m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  m = d.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (m) {
    const month = MONTHS.findIndex((x) => x.startsWith(m![2]));
    const year = Number(m[3]) + (Number(m[3]) > 30 ? 1900 : 2000);
    return month >= 0 ? `${MONTHS[month]} ${Number(m[1])}, ${year}` : null;
  }
  m = d.match(/^(\d{4})/);
  return m ? m[1] : null;
}

/**
 * The 21 CFR sections behind an FDA record, narrowed to the kind the sentence
 * describes. The inventory lists every section that mentions a substance,
 * including packaging (174 to 178) and color use in drugs and cosmetics
 * (73.1000 and up), none of which is about eating it.
 *
 *   color  73.x / 74.x below 1000: color additives in food
 *   food   170 to 173 and 180: food additives, including interim listings
 *   gras   182, 184, 186: generally recognized as safe
 */
function cfrSections(statement: string, kind: "color" | "food" | "gras"): string[] {
  const m = statement.match(/21 CFR ([\d. ]+)\)/);
  if (!m) return [];
  const pattern = {
    color: /^7[34]\.\d{1,3}$/,
    food: /^(17[0-3]|180)\./,
    gras: /^18[246]\./,
  }[kind];
  return m[1].trim().split(/\s+/).filter((sec) => pattern.test(sec)).slice(0, 3);
}

/** Ingested DOIs sometimes arrive mangled ("doi.org/doi. org/10…"). */
function cleanUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const doi = url.match(/10\.\d{4,}\/[^\s]+$/);
  if (url.includes("doi") && doi) return `https://doi.org/${doi[0]}`;
  return url;
}

const IARC_GROUPS: Record<string, string> = {
  "1": "carcinogenic to humans",
  "2A": "probably carcinogenic to humans",
  "2B": "possibly carcinogenic to humans",
  "3": "not classifiable as to its carcinogenicity to humans",
};

function kg70(value: number): string {
  const mg = value * 70;
  if (mg >= 1000) return `${(mg / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} g`;
  return `${mg.toLocaleString("en-US", { maximumFractionDigits: mg < 10 ? 1 : 0 })} mg`;
}

/**
 * One record as a sentence, or null to leave it out. Hand-verified findings
 * get hand-written sentences keyed by substance, because their statements are
 * paragraphs written for the app, in its style, not the page's.
 */
function sentence(a: Additive, r: EvidenceRecord): { html: string; source: GuideSource } | null {
  const cite: GuideSource = {
    org: r.citation.org === "US FDA" ? "US Food and Drug Administration" : r.citation.org,
    title: r.citation.title,
    year: r.citation.year,
    url: cleanUrl(r.citation.url) ?? "",
  };
  const when = usDate(r.determinedOn);

  if (r.source === "curated") {
    if (r.kind === "warning_required") {
      return {
        html: "EU law requires foods containing it to carry the words “may have an adverse effect on activity and attention in children.”",
        source: ADDITIVE_SOURCES["eu-1333"],
      };
    }
    if (r.kind === "prohibited" && a.id === "titanium_dioxide") {
      return {
        html: "The EU removed it from its list of permitted food additives in January 2022, with a transition period for existing foods until August 7, 2022. EFSA had concluded that it “can no longer be considered safe when used as a food additive.”",
        source: cite,
      };
    }
    if (r.kind === "prohibited" && a.id === "fd_c_red_no_3") {
      return {
        html: "The FDA revoked its authorization for use in food in January 2025. For food, the order takes effect on January 15, 2027.",
        source: cite,
      };
    }
    if (r.kind === "health_guidance" && /nitrite/.test(a.id)) {
      return {
        html: "EFSA found that nitrite from its use as a food additive did not exceed the acceptable daily intake for the general population, “except for a slight exceedance in children at the highest percentile.”",
        source: cite,
      };
    }
    return null;
  }

  switch (r.kind) {
    case "guidance_value": {
      const g = r.guidance;
      if (!g || g.unit !== "mg/kg bw/day") return null;
      return {
        html: `EFSA set an acceptable daily intake of ${g.value} mg per kilogram of body weight per day${when ? ` (${when})` : ""}. For a 70 kg (154 lb) adult, that’s about ${kg70(g.value)} a day.`,
        source: cite,
      };
    }
    case "hazard_classification": {
      if (!r.iarcGroup) return null;
      return {
        html: `IARC classifies it as ${IARC_GROUPS[r.iarcGroup]} (Group ${r.iarcGroup}${when ? `, ${when}` : ""}).`,
        source: { ...cite, org: "International Agency for Research on Cancer" },
      };
    }
    case "carcinogen_listing":
      return {
        html: `California lists it under Proposition 65 as a chemical known to cause cancer${when ? `, since ${when}` : ""}.`,
        source: cite,
      };
    case "permitted": {
      // An interim listing says the same thing with a caveat; say it once.
      if (a.records.some((x) => x.source === r.source && x.kind === "under_review")) return null;
      const color = cfrSections(r.statement, "color");
      const secs = color.length ? color : cfrSections(r.statement, "food");
      if (secs.length === 0) return null;
      return {
        html: `The FDA permits it ${color.length ? "as a color additive" : "as a food additive"} by regulation (21 CFR ${secs.join(", ")}).`,
        source: { ...cite, title: "Substances Added to Food inventory" },
      };
    }
    case "no_concern_at_typical_exposure": {
      if (r.source === "jecfa") {
        return {
          html: "The Joint FAO/WHO Expert Committee on Food Additives recorded its acceptable daily intake as “not limited,” the designation used for additives of very low toxicity.",
          source: cite,
        };
      }
      const secs = cfrSections(r.statement, "gras");
      return {
        html: `The FDA lists it as generally recognized as safe (GRAS) for its intended use in food${secs.length ? ` (21 CFR ${secs.join(", ")})` : ""}.`,
        source: { ...cite, title: "Substances Added to Food inventory" },
      };
    }
    case "under_review": {
      const secs = cfrSections(r.statement, "food");
      return {
        html: `The FDA permits it in food on an interim basis, pending additional study${secs.length ? ` (21 CFR ${secs.join(", ")})` : ""}.`,
        source: { ...cite, title: "Substances Added to Food inventory" },
      };
    }
    default:
      return null;
  }
}

const ORDER = ["prohibited", "warning_required", "health_guidance", "guidance_value", "under_review", "permitted", "no_concern_at_typical_exposure", "hazard_classification", "carcinogen_listing"];

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const ADDITIVE_STYLE = `
.names { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-wrap: wrap; gap: 8px; }
.names li { margin: 0; padding: 4px 10px; border: 1px solid var(--rule); font-size: 0.9375rem; color: var(--ink); }
.says { padding-left: 22px; }
.says li { margin-bottom: 12px; }
.lookup { width: 100%; padding: 10px 12px; font: inherit; color: var(--ink); background: var(--card); border: 1px solid var(--rule); margin: 0 0 8px; }
.lookup:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
table.enums td:first-child { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; width: 5.5rem; }
`;

/** A name mid-sentence: "carrageenan", but "BHA" and "MSG" keep their capitals. */
function inSentence(name: string): string {
  return /^[A-Z]{2}|^[A-Z][a-z]*\s?\d/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

function card(href: string, title: string, description: string): string {
  return `<li><a href="${href}"><span class="t">${title}</span><span class="d">${description}</span></a></li>`;
}

function additivePage(a: Additive, all: Additive[]): string {
  const path = `/en/additives/${a.slug}`;
  const fam = familyOf(a.e);
  const lines = a.records
    .map((r) => ({ r, s: sentence(a, r) }))
    .filter((x): x is { r: EvidenceRecord; s: NonNullable<ReturnType<typeof sentence>> } => x.s !== null)
    .sort((x, y) => ORDER.indexOf(x.r.kind) - ORDER.indexOf(y.r.kind));

  // Number sources by first use, merging the same document cited twice.
  const sources: GuideSource[] = [];
  const cite = (s: GuideSource) => {
    let i = sources.findIndex((x) => x.url === s.url && x.title === s.title);
    if (i < 0) i = sources.push(s) - 1;
    return `<sup class="cite"><a href="#source-${i + 1}" aria-label="Source ${i + 1}">${i + 1}</a></sup>`;
  };

  const uses = a.category
    ? `<h2>What it’s used for</h2>
<p>The FDA lists these uses in food: ${a.category.toLowerCase().replace(/, /g, "; ")}.${cite(ADDITIVE_SOURCES["fda-inventory"])}</p>`
    : "";
  const says = lines.map((x) => `<li>${x.s.html}${cite(x.s.source)}</li>`).join("\n  ");
  const hasAdi = lines.some((x) => x.r.kind === "guidance_value");
  const hasIarc = lines.some((x) => x.r.kind === "hazard_classification");
  const explain = [
    hasAdi
      ? `<p>An acceptable daily intake is, in EFSA’s words, “an estimate of the amount of a substance in food or drinking water that can be consumed daily over a lifetime without presenting an appreciable risk to health.”${cite(ADDITIVE_SOURCES["efsa-adi"])}</p>`
      : "",
    hasIarc
      ? `<p>IARC’s groups “indicate the strength of the evidence as to whether an agent is capable of causing cancer,” but they don’t measure how likely cancer is at a given level of exposure.${cite(ADDITIVE_SOURCES.iarc)}</p>`
      : "",
  ].join("\n");

  const names = [a.e, `E ${a.e.slice(1)}`, a.name, ...a.aliases];
  const siblings = all.filter((x) => x.hasPage && x !== a && familyOf(x.e) === fam).slice(0, 3);
  const related = [
    ...(RELATED_GUIDES[a.e] ?? [])
      .map((slug) => GUIDES_BY_SLUG.get(slug))
      .filter((g) => Boolean(g))
      .map((g) => card(`/en/guides/${g!.slug}`, g!.title, g!.description)),
    ...(RELATED_ALLERGENS[a.e] ? [ALLERGEN_PAGES_BY_SLUG.get(RELATED_ALLERGENS[a.e])!] : []).map((p) =>
      card(`/en/allergens/${p.slug}`, p.title, p.description),
    ),
    ...siblings.map((x) => card(`/en/additives/${x.slug}`, `${x.name} (${x.e})`, `Another of the ${fam?.noun ?? "additives"}.`)),
  ].join("\n    ");

  const title = `${a.name} (${a.e}): what it is and what regulators say`;
  const description = `${a.name}, ${a.e}, is one of the ${fam?.noun ?? "food additives"}. The names it goes by on a label, and what EFSA, the FDA and others have said about it, with sources.`;

  return renderPage({
    lang: "en",
    paths: { en: path },
    title: `${title} · Revely`,
    description,
    ogType: "article",
    section: "additives",
    isIndex: false,
    style: ADDITIVE_STYLE,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        inLanguage: "en",
        url: `${SITE_ORIGIN}${path}`,
        mainEntityOfPage: `${SITE_ORIGIN}${path}`,
        datePublished: "2026-09-26",
        dateModified: "2026-09-26",
        image: `${SITE_ORIGIN}/media/og-card-en.png`,
        author: { "@id": ORG },
        publisher: { "@id": ORG },
        about: { "@type": "Thing", name: a.name, alternateName: a.e },
        citation: sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url, publisher: { "@type": "Organization", name: s.org } })),
      },
      breadcrumbs([
        { name: "Revely", path: "/en" },
        { name: "Additives", path: "/en/additives" },
        { name: `${a.name} (${a.e})`, path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow"><a href="/en/additives">Additive</a></p>
  <h1>${a.name} (${a.e})</h1>
  <p class="dek">${a.e} is in the E${fam ? fam.from : ""}s, the range used for ${fam?.noun ?? "food additives"}. Here’s what it goes by on a label, and what regulators and scientists have said about it.</p>
  <p class="updated">Sources checked ${CHECKED}</p>
</div>
<article>
<h2>Names on a label</h2>
<ul class="names">
  ${names.map((n) => `<li>${escapeAttr(n)}</li>`).join("\n  ")}
</ul>
<p>Labels outside Europe often print the number on its own, without the E.</p>
${uses}
<h2>What regulators and scientists say</h2>
<ul class="says">
  ${says}
</ul>
${explain}
</article>
<aside class="callout app" aria-label="In Revely">
  <p class="eyebrow">In Revely</p>
  <p>Revely recognizes ${escapeAttr(inSentence(a.name))} whether the label says its name or ${a.e}, and shows you these sources on the ingredient.</p>
  ${badge("en")}
</aside>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">Sources</h2>
  <ol>
    ${sources
      .map(
        (s, i) =>
          `<li id="source-${i + 1}"><span class="org">${s.org}</span>. ${s.url ? `<a href="${s.url}" rel="noopener">${escapeAttr(s.title)}</a>` : escapeAttr(s.title)}${s.year ? `, ${s.year}` : ""}.</li>`,
      )
      .join("\n    ")}
  </ol>
  <p class="checked">Records as held by Revely on ${CHECKED}. Each links to its source.</p>
</section>
${related ? `<section class="related" aria-labelledby="related-h">
  <h2 id="related-h">Related</h2>
  <ul class="cards">
    ${related}
  </ul>
</section>` : ""}`,
  });
}

function indexPage(all: Additive[]): string {
  const path = "/en/additives";
  const withPages = all.filter((a) => a.hasPage).length;
  const title = "E numbers: every food additive and what it is";
  const description = `A list of ${all.length} food additives by E number, with the names they go by on a label. For ${withPages} of them, what EFSA, the FDA and others have said, with sources.`;
  const groups = FAMILIES.map((f) => {
    const rows = all.filter((a) => familyOf(a.e) === f);
    if (rows.length === 0) return "";
    return `<h2 id="${f.slug}">${f.label} <span class="meta">E${f.from} to E${f.to}</span></h2>
<div class="scroll">
<table class="enums">
  <tbody>
    ${rows
      .map(
        (a) =>
          `<tr data-q="${escapeAttr(`${a.e} ${a.e.slice(1)} ${a.name} ${a.aliases.join(" ")}`.toLowerCase())}"><td>${a.e}</td><td>${a.hasPage ? `<a href="/en/additives/${a.slug}">${a.name}</a>` : a.name}</td></tr>`,
      )
      .join("\n    ")}
  </tbody>
</table>
</div>`;
  }).join("\n");

  return renderPage({
    lang: "en",
    paths: { en: path },
    title: `${title} · Revely`,
    description,
    ogType: "website",
    section: "additives",
    isIndex: true,
    style: ADDITIVE_STYLE,
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        url: `${SITE_ORIGIN}${path}`,
        inLanguage: "en",
        publisher: { "@id": ORG },
      },
      breadcrumbs([
        { name: "Revely", path: "/en" },
        { name: "Additives", path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow">Additives</p>
  <h1>${title}</h1>
  <p class="dek">${description}</p>
  <p class="updated">Sources checked ${CHECKED}</p>
</div>
<label class="meta" for="lookup">Find an additive by name or number</label>
<input id="lookup" class="lookup" type="search" placeholder="E407, carrageenan…" autocomplete="off">
<p class="meta" id="lookup-none" hidden>No additive matches that.</p>
${groups}
<script>
(function () {
  var input = document.getElementById("lookup");
  var none = document.getElementById("lookup-none");
  var rows = Array.prototype.slice.call(document.querySelectorAll("tr[data-q]"));
  var heads = Array.prototype.slice.call(document.querySelectorAll("h2[id]"));
  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase().replace(/^e\\s*-?\\s*/, "e");
    var shown = 0;
    rows.forEach(function (r) {
      var hit = !q || r.getAttribute("data-q").indexOf(q) >= 0 || r.getAttribute("data-q").replace(/^e/, "").indexOf(q.replace(/^e/, "")) === 0;
      r.hidden = !hit;
      if (hit) shown++;
    });
    heads.forEach(function (h) {
      var box = h.nextElementSibling;
      var any = box && box.querySelector("tr[data-q]:not([hidden])");
      h.hidden = !any;
      if (box) box.hidden = !any;
    });
    none.hidden = shown > 0;
  });
})();
</script>`,
  });
}

// Built lazily, on the first request: it reads the registry and the evidence
// store, which the server has already loaded, and 3.7 MB of JSON besides.
let built: { all: Additive[]; index: string; pages: Map<string, string> } | null = null;
function build() {
  if (built) return built;
  const all = loadAdditives();
  built = {
    all,
    index: indexPage(all),
    pages: new Map(all.filter((a) => a.hasPage).map((a) => [a.slug, additivePage(a, all)])),
  };
  return built;
}

/** Every additive URL, for the sitemap and canonicalHost(). Built on first call. */
export function additivePaths(): string[] {
  return ["/en/additives", ...Array.from(build().pages.keys()).map((slug) => `/en/additives/${slug}`)];
}

/**
 * Mount the additive pages. Before serveStatic(), like the guides.
 * Written out literally for the route audit in eval/auth.check.ts.
 */
export function registerAdditiveRoutes(app: Express): void {
  app.get("/en/additives", (_req, res) => res.type("html").send(build().index));
  app.get("/en/additives/:slug", (req, res) => {
    const { all, pages } = build();
    const page = pages.get(req.params.slug);
    if (page) return res.type("html").send(page);
    // A bare E number, "/en/additives/e407", goes to its page.
    const byE = all.find((a) => a.hasPage && a.e.toLowerCase() === req.params.slug.toLowerCase());
    if (byE) return res.redirect(301, `/en/additives/${byE.slug}`);
    res.status(404).type("html").send(NOT_FOUND);
  });
}
