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
import {
  ADDITIVE_NAMES_ES,
  ADDITIVE_SOURCES_ES,
  EN as EN_ES,
  FAMILIES_ES,
  FDA_USES_ES,
  ORGS_ES,
} from "./additiveContent.es";
import {
  ADDITIVE_NAMES_ZH,
  ADDITIVE_SOURCES_ZH,
  EN as EN_ZH,
  FAMILIES_ZH,
  FDA_USES_ZH,
  ORGS_ZH,
} from "./additiveContent.zh";
import { ALLERGEN_PAGES_BY_SLUG, type AllergenText } from "./allergenContent";
import { ALLERGENS_ES } from "./allergenContent.es";
import { ALLERGENS_ZH } from "./allergenContent.zh";
import { GUIDES_BY_SLUG, type GuideSource, type GuideText } from "./guideContent";
import { GUIDES_ES } from "./guideContent.es";
import { GUIDES_ZH } from "./guideContent.zh";
import { badge, breadcrumbs, escapeAttr, renderPage, UI } from "./guides";
import { NOT_FOUND } from "./legal";
import { getEvidenceStore, type EvidenceRecord } from "./services/substances/evidence";
import { getSubstanceRegistry } from "./services/substances/identity";
import { sideAssessment } from "./services/substances/ingest/efsa";
import { HTML_LANG, SITE_LANGUAGES, type Lang } from "./siteCopy";
import { SITE_ORIGIN } from "./siteTheme";

/**
 * /en/additives, /zh/additives and /es/additives: every E-number additive in
 * the registry, and a page for each one we hold a substantive record for, in
 * each language.
 *
 * GENERATED FROM THE SAME DATA THE APP SHOWS. The records are the evidence
 * store's, the ones behind the app's ingredient drill-down, so the site and
 * the app cannot cite different things. What is written by hand lives in
 * additiveContent.ts and its .zh and .es siblings: names, the E-number
 * families, the FDA's use terms, and the definitions the pages quote (EFSA's
 * ADI, IARC's groups, the EU color warning).
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
 *
 * IN CHINESE AND SPANISH the sentences are the same sentences, written in
 * each language below (SAY), from the same fields. A quotation stays a
 * quotation only where the body published it in that language: the EU's
 * Spanish text of Annex V and of Regulation 2022/63. Every other source is
 * paraphrased and marked as English.
 */

const ORG = `${SITE_ORIGIN}/#organization`;

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
      const additive: Additive = {
        id: s.id,
        e,
        name,
        aliases: readableAliases((s.aliases ?? []).map((a) => a.name), name, e),
        category: s.category ?? null,
        records,
        hasPage: false,
        slug: slugFor(e, name),
      };
      // The gate counts what the page would actually say, so a record that
      // sentence() leaves out (an ADI from a pet-food opinion, say) cannot
      // hold a page open on its own.
      additive.hasPage = records.some((r) => r.source !== "fda_food_additives" && sentence(additive, r, "en") !== null);
      return additive;
    })
    .sort((a, b) => eSort(a.e, b.e));
}

// ---------------------------------------------------------------------------
// Per language: names, families, sources
// ---------------------------------------------------------------------------

const NAMES: Record<Exclude<Lang, "en">, Record<string, string>> = { zh: ADDITIVE_NAMES_ZH, es: ADDITIVE_NAMES_ES };

/** The additive's name in the page's language. */
function nameIn(a: Additive, lang: Lang): string {
  return lang === "en" ? a.name : (NAMES[lang][a.e] ?? a.name);
}

function familyIn(e: string, lang: Lang): { label: string; noun: string; from: number; to: number } | undefined {
  const f = familyOf(e);
  if (!f) return undefined;
  if (lang === "en") return f;
  return { ...f, ...(lang === "zh" ? FAMILIES_ZH : FAMILIES_ES)[f.slug] };
}

const OWN_SOURCES: Record<Lang, Record<string, GuideSource>> = {
  en: ADDITIVE_SOURCES,
  zh: ADDITIVE_SOURCES_ZH,
  es: ADDITIVE_SOURCES_ES,
};
const ORGS: Record<Exclude<Lang, "en">, Record<string, string>> = { zh: ORGS_ZH, es: ORGS_ES };
const IN_ENGLISH: Record<Exclude<Lang, "en">, string> = { zh: EN_ZH, es: EN_ES };

/**
 * A source as the page's language lists it. The page's own sources and the
 * two EU regulations have written translations; a record's source keeps its
 * English title, gets its body's name translated, and is marked as English.
 */
function localSource(s: GuideSource, lang: Lang): GuideSource {
  if (lang === "en") return s;
  for (const [key, en] of Object.entries(ADDITIVE_SOURCES)) {
    if (s === en || (key === "fda-inventory" && s.title === en.title)) return OWN_SOURCES[lang][key];
  }
  if (s.title.startsWith("Commission Regulation (EU) 2022/63")) return OWN_SOURCES[lang]["eu-2022-63"];
  return { ...s, org: ORGS[lang][s.org] ?? s.org, note: IN_ENGLISH[lang] };
}

const FDA_USES: Record<Exclude<Lang, "en">, Record<string, string>> = { zh: FDA_USES_ZH, es: FDA_USES_ES };

/**
 * The FDA inventory's uses for an additive, in the page's language. Only the
 * inventory's own terms, which it writes in capitals: a few registry entries
 * carry a category from elsewhere ("acidity_regulator", "colour"), which the
 * FDA never said.
 */
function fdaUses(category: string | null, lang: Lang): string[] {
  if (!category) return [];
  const terms = category
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^[A-Z][A-Z -]+$/.test(t));
  return lang === "en" ? terms.map((t) => t.toLowerCase()) : terms.map((t) => FDA_USES[lang][t]).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Records, in our own words
// ---------------------------------------------------------------------------

interface Day {
  y: number;
  m?: number;
  d?: number;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2019-01-30", "1-Jan-90" or "2010", as a date. */
function parseDate(d?: string | null): Day | null {
  if (!d) return null;
  let m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  m = d.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (m) {
    const month = MONTHS.findIndex((x) => x.startsWith(m![2]));
    const year = Number(m[3]) + (Number(m[3]) > 30 ? 1900 : 2000);
    return month >= 0 ? { y: year, m: month + 1, d: Number(m[1]) } : null;
  }
  m = d.match(/^(\d{4})/);
  return m ? { y: Number(m[1]) } : null;
}

/** "January 30, 2019", "2019 年 1 月 30 日", "30 de enero de 2019". */
function formatDate(day: Day, lang: Lang): string {
  if (!day.m || !day.d) return lang === "zh" ? `${day.y} 年` : String(day.y);
  if (lang === "zh") return `${day.y} 年 ${day.m} 月 ${day.d} 日`;
  if (lang === "es") return `${day.d} de ${MESES[day.m - 1]} de ${day.y}`;
  return `${MONTHS[day.m - 1]} ${day.d}, ${day.y}`;
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

const LOCALE: Record<Lang, string> = { en: "en-US", zh: "zh-CN", es: "es-ES" };

function num(value: number, lang: Lang, digits = 3): string {
  return value.toLocaleString(LOCALE[lang], { maximumFractionDigits: digits });
}

/** An ADI, per kilogram, as a day's amount for a 70 kg adult. */
function kg70(value: number, lang: Lang): string {
  const mg = value * 70;
  const [grams, milligrams] = lang === "zh" ? [" 克", " 毫克"] : [" g", " mg"];
  if (mg >= 1000) return `${num(mg / 1000, lang, 1)}${grams}`;
  return `${num(mg, lang, mg < 10 ? 1 : 0)}${milligrams}`;
}

/**
 * Every sentence a page can say, in each language. `when` is already a date
 * in the page's language; `secs` the CFR sections, joined.
 */
interface Phrases {
  euWarning: string;
  tio2: string;
  red3: string;
  nitrite: string;
  adi: (value: string, when: string | null, perDay: string) => string;
  iarcGroups: Record<string, string>;
  iarc: (desc: string, group: string, when: string | null) => string;
  prop65: (when: Day | null) => string;
  permitted: (color: boolean, secs: string) => string;
  jecfa: string;
  gras: (secs: string | null) => string;
  interim: (secs: string | null) => string;
  cfrJoin: string;
  adiMeans: string;
  iarcMeans: string;
}

const SAY: Record<Lang, Phrases> = {
  en: {
    euWarning: "EU law requires foods containing it to carry the words “may have an adverse effect on activity and attention in children.”",
    tio2: "The EU removed it from its list of permitted food additives in January 2022, with a transition period for existing foods until August 7, 2022. EFSA had concluded that it “can no longer be considered safe when used as a food additive.”",
    red3: "The FDA revoked its authorization for use in food in January 2025. For food, the order takes effect on January 15, 2027.",
    nitrite:
      "EFSA found that nitrite from its use as a food additive did not exceed the acceptable daily intake for the general population, “except for a slight exceedance in children at the highest percentile.”",
    adi: (v, when, perDay) =>
      `EFSA set an acceptable daily intake of ${v} mg per kilogram of body weight per day${when ? ` (${when})` : ""}. For a 70 kg (154 lb) adult, that’s about ${perDay} a day.`,
    iarcGroups: {
      "1": "carcinogenic to humans",
      "2A": "probably carcinogenic to humans",
      "2B": "possibly carcinogenic to humans",
      "3": "not classifiable as to its carcinogenicity to humans",
    },
    iarc: (desc, g, when) => `IARC classifies it as ${desc} (Group ${g}${when ? `, ${when}` : ""}).`,
    prop65: (when) =>
      `California lists it under Proposition 65 as a chemical known to cause cancer${when ? `, since ${formatDate(when, "en")}` : ""}.`,
    permitted: (color, secs) =>
      `The FDA permits it ${color ? "as a color additive" : "as a food additive"} by regulation (21 CFR ${secs}).`,
    jecfa:
      "The Joint FAO/WHO Expert Committee on Food Additives recorded its acceptable daily intake as “not limited,” the designation used for additives of very low toxicity.",
    gras: (secs) =>
      `The FDA lists it as generally recognized as safe (GRAS) for its intended use in food${secs ? ` (21 CFR ${secs})` : ""}.`,
    interim: (secs) =>
      `The FDA permits it in food on an interim basis, pending additional study${secs ? ` (21 CFR ${secs})` : ""}.`,
    cfrJoin: ", ",
    adiMeans:
      "An acceptable daily intake is, in EFSA’s words, “an estimate of the amount of a substance in food or drinking water that can be consumed daily over a lifetime without presenting an appreciable risk to health.”",
    iarcMeans:
      "IARC’s groups “indicate the strength of the evidence as to whether an agent is capable of causing cancer,” but they don’t measure how likely cancer is at a given level of exposure.",
  },
  zh: {
    euWarning: "欧盟法律要求含有这种色素的食品在标签上警示，它可能对儿童的活动和注意力产生不良影响。",
    tio2: "欧盟于 2022 年 1 月将它从允许使用的食品添加剂清单中删除，已按旧规定生产的食品有过渡期，至 2022 年 8 月 7 日止。此前 EFSA 已得出结论，认为它用作食品添加剂时已不能再被视为安全。",
    red3: "FDA 于 2025 年 1 月撤销了它在食品中的使用许可。就食品而言，该命令自 2027 年 1 月 15 日起生效。",
    nitrite:
      "EFSA 发现，作为食品添加剂使用带来的亚硝酸盐摄入没有超过一般人群的每日允许摄入量，只有摄入量处于最高百分位的儿童略有超出。",
    adi: (v, when, perDay) =>
      `EFSA 设定的每日允许摄入量为每公斤体重每天 ${v} 毫克${when ? `（${when}）` : ""}。对体重 70 公斤的成年人来说，约为每天 ${perDay}。`,
    iarcGroups: {
      "1": "对人类致癌",
      "2A": "很可能对人类致癌",
      "2B": "可能对人类致癌",
      "3": "对人类的致癌性尚无法分类",
    },
    iarc: (desc, g, when) => `IARC 将它归入第 ${g} 组，即${desc}${when ? `（${when}）` : ""}。`,
    prop65: (when) => `加州根据第 65 号提案，将它列为已知可致癌的化学物质${when ? `（自 ${formatDate(when, "zh")}起）` : ""}。`,
    permitted: (color, secs) => `FDA 依据法规允许将它用作${color ? "色素添加剂" : "食品添加剂"}（21 CFR ${secs}）。`,
    jecfa:
      "粮农组织/世卫组织食品添加剂联合专家委员会（JECFA）将它的每日允许摄入量记为 “not limited”（不作限制），这是用于毒性很低的添加剂的说法。",
    gras: (secs) => `FDA 将它列为公认安全（GRAS）物质，可按预期用途用于食品${secs ? `（21 CFR ${secs}）` : ""}。`,
    interim: (secs) => `在获得更多研究结果之前，FDA 暂时允许它用于食品${secs ? `（21 CFR ${secs}）` : ""}。`,
    cfrJoin: "、",
    adiMeans:
      "按照 EFSA 的解释，每日允许摄入量是对食品或饮用水中某种物质数量的估计：一个人终生每天摄入这一数量，也不会对健康构成明显风险。",
    iarcMeans: "IARC 的分组表示的是一种物质能否致癌的证据有多充分，并不衡量在某一暴露水平下患癌的可能性有多大。",
  },
  es: {
    // Quoted from the EU's Spanish text: Annex V of Regulation 1333/2008, and
    // recital 11 of Regulation 2022/63.
    euWarning:
      "La legislación de la UE exige que los alimentos que lo contienen lleven la indicación “puede tener efectos negativos sobre la actividad y la atención de los niños”.",
    tio2: "La UE lo retiró de su lista de aditivos alimentarios autorizados en enero de 2022, con un período transitorio para los alimentos ya producidos hasta el 7 de agosto de 2022. La EFSA había concluido que “ya no puede considerarse seguro cuando se utiliza como aditivo alimentario”.",
    red3: "La FDA revocó en enero de 2025 la autorización para usarlo en alimentos. Para los alimentos, la orden entra en vigor el 15 de enero de 2027.",
    nitrite:
      "La EFSA concluyó que el nitrito procedente de su uso como aditivo alimentario no superaba la ingesta diaria admisible en la población general, salvo un ligero exceso en los niños del percentil más alto.",
    adi: (v, when, perDay) =>
      `La EFSA fijó una ingesta diaria admisible de ${v} mg por kilogramo de peso corporal al día${when ? ` (${when})` : ""}. Para un adulto de 70 kg, eso equivale a unos ${perDay} al día.`,
    iarcGroups: {
      "1": "carcinógeno para los seres humanos",
      "2A": "probablemente carcinógeno para los seres humanos",
      "2B": "posiblemente carcinógeno para los seres humanos",
      "3": "no clasificable en cuanto a su carcinogenicidad para los seres humanos",
    },
    iarc: (desc, g, when) => `El IARC clasifica este aditivo como ${desc} (grupo ${g}${when ? `, ${when}` : ""}).`,
    prop65: (when) =>
      `California incluye este aditivo en la lista de la Proposición 65 como sustancia química que se sabe que causa cáncer${
        when ? `, desde ${when.d ? "el " : ""}${formatDate(when, "es")}` : ""
      }.`,
    permitted: (color, secs) =>
      `La FDA autoriza su uso como ${color ? "aditivo colorante" : "aditivo alimentario"} mediante reglamento (21 CFR ${secs}).`,
    jecfa:
      "El Comité Mixto FAO/OMS de Expertos en Aditivos Alimentarios (JECFA) registró su ingesta diaria admisible como “not limited” (no limitada), la designación que usa para los aditivos de muy baja toxicidad.",
    gras: (secs) =>
      `La FDA incluye este aditivo entre los generalmente reconocidos como seguros (GRAS) para su uso previsto en alimentos${secs ? ` (21 CFR ${secs})` : ""}.`,
    interim: (secs) =>
      `La FDA permite su uso en alimentos de forma provisional, a la espera de más estudios${secs ? ` (21 CFR ${secs})` : ""}.`,
    cfrJoin: ", ",
    adiMeans:
      "Según la EFSA, la ingesta diaria admisible es una estimación de la cantidad de una sustancia en los alimentos o el agua potable que se puede consumir a diario durante toda la vida sin un riesgo apreciable para la salud.",
    iarcMeans:
      "Los grupos del IARC indican la solidez de las pruebas de que un agente puede causar cáncer, pero no miden la probabilidad de cáncer a un nivel de exposición determinado.",
  },
};

/**
 * One record as a sentence, or null to leave it out. Hand-verified findings
 * get hand-written sentences keyed by substance, because their statements are
 * paragraphs written for the app, in its style, not the page's. The source is
 * the English one; the page puts it into its own language.
 */
function sentence(a: Additive, r: EvidenceRecord, lang: Lang): { html: string; source: GuideSource } | null {
  const say = SAY[lang];
  const cite: GuideSource = {
    org: r.citation.org === "US FDA" ? "US Food and Drug Administration" : r.citation.org,
    title: r.citation.title,
    year: r.citation.year,
    url: cleanUrl(r.citation.url) ?? "",
  };
  const day = parseDate(r.determinedOn);
  const when = day ? formatDate(day, lang) : null;
  const inventory = { ...cite, title: "Substances Added to Food inventory" };
  const secs = (list: string[]) => (list.length ? list.join(say.cfrJoin) : null);

  if (r.source === "curated") {
    if (r.kind === "warning_required") return { html: say.euWarning, source: ADDITIVE_SOURCES["eu-1333"] };
    if (r.kind === "prohibited" && a.id === "titanium_dioxide") return { html: say.tio2, source: cite };
    if (r.kind === "prohibited" && a.id === "fd_c_red_no_3") return { html: say.red3, source: cite };
    if (r.kind === "health_guidance" && /nitrite/.test(a.id)) return { html: say.nitrite, source: cite };
    return null;
  }

  switch (r.kind) {
    case "guidance_value": {
      const g = r.guidance;
      if (!g || g.unit !== "mg/kg bw/day") return null;
      if (!efsaSpeaksToFood(r)) return null;
      const value = lang === "en" ? String(g.value) : num(g.value, lang, 4);
      return { html: say.adi(value, when, kg70(g.value, lang)), source: cite };
    }
    case "hazard_classification": {
      if (!r.iarcGroup) return null;
      return {
        html: say.iarc(say.iarcGroups[r.iarcGroup], r.iarcGroup, when),
        source: { ...cite, org: "International Agency for Research on Cancer" },
      };
    }
    case "carcinogen_listing":
      return { html: say.prop65(day), source: cite };
    case "permitted": {
      // An interim listing says the same thing with a caveat; say it once.
      if (a.records.some((x) => x.source === r.source && x.kind === "under_review")) return null;
      const color = cfrSections(r.statement, "color");
      const list = color.length ? color : cfrSections(r.statement, "food");
      if (list.length === 0) return null;
      return { html: say.permitted(color.length > 0, secs(list)!), source: inventory };
    }
    case "no_concern_at_typical_exposure": {
      if (r.source === "jecfa") return { html: say.jecfa, source: cite };
      return { html: say.gras(secs(cfrSections(r.statement, "gras"))), source: inventory };
    }
    case "under_review":
      return { html: say.interim(secs(cfrSections(r.statement, "food"))), source: inventory };
    default:
      return null;
  }
}

/**
 * Whether an EFSA ADI is EFSA's position on the substance as food. The
 * ingest prefers such a row whenever EFSA has one (ingest/efsa.ts); what is
 * left here is a substance whose only ADI came from assessing it as a feed
 * additive (Patent Blue V, for pets), a pesticide residue (phosphoric acid,
 * under an opinion about phosphonates, a different chemical), a previous
 * cargo in a food tanker (carnauba and microcrystalline wax), or a row with no
 * opinion named at all. "EFSA set an acceptable daily intake" over any of
 * those citations misleads, so the page says nothing rather than that.
 */
function efsaSpeaksToFood(r: EvidenceRecord): boolean {
  const title = r.citation?.title ?? "";
  if (title === "an EFSA scientific opinion") return false;
  const domain = r.statement.match(/in its assessment of (.+?), in "/)?.[1] ?? "";
  return !sideAssessment(domain, title);
}

const ORDER = ["prohibited", "warning_required", "health_guidance", "guidance_value", "under_review", "permitted", "no_concern_at_typical_exposure", "hazard_classification", "carcinogen_listing"];

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** The page furniture, per language. */
const T: Record<
  Lang,
  {
    additive: string;
    title: (name: string, e: string) => string;
    heading: (name: string, e: string) => string;
    description: (name: string, e: string, noun: string) => string;
    dek: (e: string, from: number, noun: string) => string;
    anyFamily: string;
    names: string;
    bareNumber: string;
    uses: string;
    usesList: (uses: string[]) => string;
    says: string;
    inRevely: (name: string, e: string) => string;
    checked: string;
    checkedAll: string;
    related: string;
    cite: string;
    sibling: (label: string, noun: string) => string;
    index: {
      title: string;
      description: (all: number, withPages: number) => string;
      range: (from: number, to: number) => string;
      find: string;
      placeholder: string;
      none: string;
    };
  }
> = {
  en: {
    additive: "Additive",
    title: (n, e) => `${n} (${e}): what it is and what regulators say`,
    heading: (n, e) => `${n} (${e})`,
    description: (n, e, noun) =>
      `${n}, ${e}, is one of the ${noun}. The names it goes by on a label, and what EFSA, the FDA and others have said about it, with sources.`,
    dek: (e, from, noun) =>
      `${e} is in the E${from}s, the range used for ${noun}. Here’s what it goes by on a label, and what regulators and scientists have said about it.`,
    anyFamily: "food additives",
    names: "Names on a label",
    bareNumber: "Labels outside Europe often print the number on its own, without the E.",
    uses: "What it’s used for",
    usesList: (u) => `The FDA lists these uses in food: ${u.join("; ")}.`,
    says: "What regulators and scientists say",
    inRevely: (n, e) =>
      `Revely recognizes ${escapeAttr(inSentence(n))} whether the label says its name or ${e}, and shows you these sources on the ingredient.`,
    checked: "Sources checked September 26, 2026",
    checkedAll: "Records as held by Revely on September 26, 2026. Each links to its source.",
    related: "Related",
    cite: "Source",
    sibling: (_label, noun) => `Another of the ${noun}.`,
    index: {
      title: "E numbers: every food additive and what it is",
      description: (all, pages) =>
        `A list of ${all} food additives by E number, with the names they go by on a label. For ${pages} of them, what EFSA, the FDA and others have said, with sources.`,
      range: (from, to) => `E${from} to E${to}`,
      find: "Find an additive by name or number",
      placeholder: "E407, carrageenan…",
      none: "No additive matches that.",
    },
  },
  zh: {
    additive: "添加剂",
    title: (n, e) => `${n}（${e}）：它是什么，监管机构怎么说`,
    heading: (n, e) => `${n}（${e}）`,
    description: (n, e, noun) =>
      `${n}（${e}）属于${noun}。本页列出它在标签上的各种名称，以及 EFSA、FDA 等机构对它的说法，并附来源。`,
    dek: (e, from, noun) =>
      `${e} 属于 E${from} 段，这一段编号用于${noun}。下面是它在标签上的名称，以及监管机构和科学家对它的说法。`,
    anyFamily: "食品添加剂",
    names: "标签上的名称",
    bareNumber: "欧洲以外的标签常常只印数字，不带 E。",
    uses: "用途",
    usesList: (u) => `FDA 列出的食品用途：${u.join("；")}。`,
    says: "监管机构和科学家的说法",
    inRevely: (_n, e) => `无论标签上印的是它的名称还是 ${e}，Revely 都能认出它，并在这种配料上向你展示这些来源。`,
    checked: "来源核对于 2026 年 9 月 26 日",
    checkedAll: "以上为 Revely 在 2026 年 9 月 26 日所存的记录，每条都链接到其来源。",
    related: "相关内容",
    cite: "来源",
    sibling: (label) => `同属${label}。`,
    index: {
      title: "E 编号：每种食品添加剂是什么",
      description: (all, pages) =>
        `按 E 编号排列的 ${all} 种食品添加剂，以及它们在标签上的名称。其中 ${pages} 种附有 EFSA、FDA 等机构的说法和来源。`,
      range: (from, to) => `E${from} 至 E${to}`,
      find: "按名称或编号查找添加剂",
      placeholder: "E407、卡拉胶…",
      none: "没有匹配的添加剂。",
    },
  },
  es: {
    additive: "Aditivo",
    title: (n, e) => `${n} (${e}): qué es y qué dicen los reguladores`,
    heading: (n, e) => `${n} (${e})`,
    description: (n, e, noun) =>
      `${n} (${e}) pertenece al grupo de ${noun}. Los nombres con los que aparece en una etiqueta y lo que han dicho la EFSA, la FDA y otros, con fuentes.`,
    dek: (e, from, noun) =>
      `${e} está en la serie E${from}, la que se usa para ${noun}. Aquí están los nombres con los que aparece en una etiqueta y lo que han dicho los reguladores y los científicos.`,
    anyFamily: "los aditivos alimentarios",
    names: "Nombres en la etiqueta",
    bareNumber: "Fuera de Europa, las etiquetas suelen imprimir solo el número, sin la E.",
    uses: "Para qué se usa",
    usesList: (u) => `La FDA enumera estos usos en los alimentos: ${u.join("; ")}.`,
    says: "Lo que dicen los reguladores y los científicos",
    inRevely: (_n, e) =>
      `Revely reconoce este aditivo tanto si la etiqueta pone su nombre como si pone ${e}, y te muestra estas fuentes en el ingrediente.`,
    checked: "Fuentes comprobadas el 26 de septiembre de 2026",
    checkedAll: "Registros tal como los tenía Revely el 26 de septiembre de 2026. Cada uno enlaza a su fuente.",
    related: "Relacionado",
    cite: "Fuente",
    sibling: (label) => `Del mismo grupo: ${label.toLowerCase()}.`,
    index: {
      title: "Números E: todos los aditivos alimentarios y qué son",
      description: (all, pages) =>
        `${all} aditivos alimentarios por número E, con los nombres con los que aparecen en una etiqueta. Para ${pages} de ellos, lo que han dicho la EFSA, la FDA y otros, con fuentes.`,
      range: (from, to) => `E${from} a E${to}`,
      find: "Busca un aditivo por nombre o número",
      placeholder: "E407, carragenanos…",
      none: "Ningún aditivo coincide.",
    },
  },
};

const ADDITIVE_STYLE = `
.names { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-wrap: wrap; gap: 8px; }
.names li { margin: 0; padding: 4px 10px; border: 1px solid var(--rule); font-size: 0.9375rem; color: var(--ink); }
.says { padding-left: 22px; }
.says li { margin-bottom: 12px; }
.lookup { width: 100%; padding: 10px 12px; font: inherit; color: var(--ink); background: var(--card); border: 1px solid var(--rule); margin: 0 0 8px; }
.lookup:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
table.enums td:first-child { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; width: 5.5rem; }
table.enums .meta { margin-left: 6px; }
`;

/** A name mid-sentence: "carrageenan", but "BHA" and "MSG" keep their capitals. */
function inSentence(name: string): string {
  return /^[A-Z]{2}|^[A-Z][a-z]*\s?\d/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** For the search box: lowercase, and "carragenanos" finds "Carragenanos" with or without accents. */
function searchKey(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function card(href: string, title: string, description: string): string {
  return `<li><a href="${href}"><span class="t">${title}</span><span class="d">${description}</span></a></li>`;
}

const GUIDE_TEXT: Record<Lang, Record<string, GuideText>> = {
  en: Object.fromEntries(Array.from(GUIDES_BY_SLUG.values()).map((g) => [g.slug, g])),
  zh: GUIDES_ZH,
  es: GUIDES_ES,
};
const ALLERGEN_TEXT: Record<Lang, Record<string, Pick<AllergenText, "title" | "description">>> = {
  en: Object.fromEntries(Array.from(ALLERGEN_PAGES_BY_SLUG.values()).map((p) => [p.slug, p])),
  zh: ALLERGENS_ZH,
  es: ALLERGENS_ES,
};

function pathsFor(slug: string | null): Record<Lang, string> {
  return Object.fromEntries(
    SITE_LANGUAGES.map((l) => [l, slug ? `/${l}/additives/${slug}` : `/${l}/additives`]),
  ) as Record<Lang, string>;
}

function additivePage(a: Additive, all: Additive[], lang: Lang): string {
  const t = T[lang];
  const say = SAY[lang];
  const paths = pathsFor(a.slug);
  const path = paths[lang];
  const name = nameIn(a, lang);
  const fam = familyIn(a.e, lang);
  const noun = fam?.noun ?? t.anyFamily;
  const lines = a.records
    .map((r) => ({ r, s: sentence(a, r, lang) }))
    .filter((x): x is { r: EvidenceRecord; s: NonNullable<ReturnType<typeof sentence>> } => x.s !== null)
    .sort((x, y) => ORDER.indexOf(x.r.kind) - ORDER.indexOf(y.r.kind));

  // Number sources by first use, merging the same document cited twice.
  const sources: GuideSource[] = [];
  const cite = (en: GuideSource) => {
    const s = localSource(en, lang);
    let i = sources.findIndex((x) => x.url === s.url && x.title === s.title);
    if (i < 0) i = sources.push(s) - 1;
    return `<sup class="cite"><a href="#source-${i + 1}" aria-label="${t.cite} ${i + 1}">${i + 1}</a></sup>`;
  };

  const usesList = fdaUses(a.category, lang);
  const uses = usesList.length
    ? `<h2>${t.uses}</h2>
<p>${t.usesList(usesList)}${cite(ADDITIVE_SOURCES["fda-inventory"])}</p>`
    : "";
  const says = lines.map((x) => `<li>${x.s.html}${cite(x.s.source)}</li>`).join("\n  ");
  const hasAdi = lines.some((x) => x.r.kind === "guidance_value");
  const hasIarc = lines.some((x) => x.r.kind === "hazard_classification");
  const explain = [
    hasAdi ? `<p>${say.adiMeans}${cite(ADDITIVE_SOURCES["efsa-adi"])}</p>` : "",
    hasIarc ? `<p>${say.iarcMeans}${cite(ADDITIVE_SOURCES.iarc)}</p>` : "",
  ].join("\n");

  // The page's name first, then the English name and the registry's aliases,
  // which are English, marked so a screen reader says them as English.
  const seen = new Set<string>();
  const names = [
    { n: a.e, en: false },
    { n: `E ${a.e.slice(1)}`, en: false },
    { n: name, en: lang === "en" },
    { n: a.name, en: true },
    ...a.aliases.map((n) => ({ n, en: true })),
  ].filter(({ n }) => !seen.has(n.toLowerCase()) && Boolean(seen.add(n.toLowerCase())));
  const nameItems = names
    .map(({ n, en }) => `<li${en && lang !== "en" ? ' lang="en"' : ""}>${escapeAttr(n)}</li>`)
    .join("\n  ");

  const family = familyOf(a.e);
  const siblings = all.filter((x) => x.hasPage && x !== a && familyOf(x.e) === family).slice(0, 3);
  const related = [
    ...(RELATED_GUIDES[a.e] ?? [])
      .map((slug) => ({ slug, g: GUIDE_TEXT[lang][slug] }))
      .filter((x) => Boolean(x.g))
      .map((x) => card(`/${lang}/guides/${x.slug}`, x.g.title, x.g.description)),
    ...(RELATED_ALLERGENS[a.e] ? [RELATED_ALLERGENS[a.e]] : []).map((slug) =>
      card(`/${lang}/allergens/${slug}`, ALLERGEN_TEXT[lang][slug].title, ALLERGEN_TEXT[lang][slug].description),
    ),
    ...siblings.map((x) =>
      card(`/${lang}/additives/${x.slug}`, t.heading(nameIn(x, lang), x.e), t.sibling(fam?.label ?? "", noun)),
    ),
  ].join("\n    ");

  const title = t.title(name, a.e);
  const description = t.description(name, a.e, noun);

  return renderPage({
    lang,
    paths,
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
        inLanguage: HTML_LANG[lang],
        url: `${SITE_ORIGIN}${path}`,
        mainEntityOfPage: `${SITE_ORIGIN}${path}`,
        datePublished: "2026-09-26",
        dateModified: "2026-09-26",
        image: `${SITE_ORIGIN}/media/og-card-${lang}.png`,
        author: { "@id": ORG },
        publisher: { "@id": ORG },
        about: { "@type": "Thing", name, alternateName: lang === "en" ? a.e : [a.e, a.name] },
        citation: sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url, publisher: { "@type": "Organization", name: s.org } })),
      },
      breadcrumbs([
        { name: "Revely", path: `/${lang}` },
        { name: UI[lang].additives, path: paths[lang].replace(/\/[^/]+$/, "") },
        { name: t.heading(name, a.e), path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow"><a href="/${lang}/additives">${t.additive}</a></p>
  <h1>${t.heading(name, a.e)}</h1>
  <p class="dek">${t.dek(a.e, fam?.from ?? 0, noun)}</p>
  <p class="updated">${t.checked}</p>
</div>
<article>
<h2>${t.names}</h2>
<ul class="names">
  ${nameItems}
</ul>
<p>${t.bareNumber}</p>
${uses}
<h2>${t.says}</h2>
<ul class="says">
  ${says}
</ul>
${explain}
</article>
<aside class="callout app" aria-label="${UI[lang].inRevely}">
  <p class="eyebrow">${UI[lang].inRevely}</p>
  <p>${t.inRevely(name, a.e)}</p>
  ${badge(lang)}
</aside>
<section class="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">${UI[lang].sources}</h2>
  <ol>
    ${sources
      .map(
        (s, i) =>
          `<li id="source-${i + 1}"><span class="org">${s.org}</span>. ${s.url ? `<a href="${s.url}" rel="noopener">${escapeAttr(s.title)}</a>` : escapeAttr(s.title)}${s.year ? `, ${s.year}` : ""}${s.note ? ` ${s.note}` : ""}.</li>`,
      )
      .join("\n    ")}
  </ol>
  <p class="checked">${t.checkedAll}</p>
</section>
${related ? `<section class="related" aria-labelledby="related-h">
  <h2 id="related-h">${t.related}</h2>
  <ul class="cards">
    ${related}
  </ul>
</section>` : ""}`,
  });
}

function indexPage(all: Additive[], lang: Lang): string {
  const t = T[lang];
  const paths = pathsFor(null);
  const path = paths[lang];
  const withPages = all.filter((a) => a.hasPage).length;
  const title = t.index.title;
  const description = t.index.description(all.length, withPages);
  const groups = FAMILIES.map((f) => {
    const rows = all.filter((a) => familyOf(a.e) === f);
    if (rows.length === 0) return "";
    return `<h2 id="${f.slug}">${familyIn(`E${f.from}`, lang)!.label} <span class="meta">${t.index.range(f.from, f.to)}</span></h2>
<div class="scroll">
<table class="enums">
  <tbody>
    ${rows
      .map((a) => {
        const name = nameIn(a, lang);
        const shown = a.hasPage ? `<a href="/${lang}/additives/${a.slug}">${name}</a>` : name;
        const english =
          lang !== "en" && name.toLowerCase() !== a.name.toLowerCase() ? ` <span class="meta" lang="en">${a.name}</span>` : "";
        const q = searchKey(`${a.e} ${a.e.slice(1)} ${name} ${a.name} ${a.aliases.join(" ")}`);
        return `<tr id="${a.e.toLowerCase()}" data-q="${escapeAttr(q)}"><td>${a.e}</td><td>${shown}${english}</td></tr>`;
      })
      .join("\n    ")}
  </tbody>
</table>
</div>`;
  }).join("\n");

  return renderPage({
    lang,
    paths,
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
        inLanguage: HTML_LANG[lang],
        publisher: { "@id": ORG },
      },
      breadcrumbs([
        { name: "Revely", path: `/${lang}` },
        { name: UI[lang].additives, path },
      ]),
    ],
    main: `<div class="masthead">
  <p class="eyebrow">${UI[lang].additives}</p>
  <h1>${title}</h1>
  <p class="dek">${description}</p>
  <p class="updated">${t.checked}</p>
</div>
<label class="meta" for="lookup">${t.index.find}</label>
<input id="lookup" class="lookup" type="search" placeholder="${t.index.placeholder}" autocomplete="off">
<p class="meta" id="lookup-none" hidden>${t.index.none}</p>
${groups}
<script>
(function () {
  var input = document.getElementById("lookup");
  var none = document.getElementById("lookup-none");
  var rows = Array.prototype.slice.call(document.querySelectorAll("tr[data-q]"));
  var heads = Array.prototype.slice.call(document.querySelectorAll("h2[id]"));
  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/^e\\s*-?\\s*/, "e");
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

// A translation missing a name, a family or a use term is a build error, not
// an English word on a Chinese page.
for (const lang of ["zh", "es"] as const) {
  for (const e of Object.keys(ADDITIVE_NAMES)) {
    if (!NAMES[lang][e]) throw new Error(`additive ${e} has no ${lang} name`);
  }
  for (const f of FAMILIES) {
    if (!(lang === "zh" ? FAMILIES_ZH : FAMILIES_ES)[f.slug]) throw new Error(`family ${f.slug} has no ${lang} label`);
  }
}

// Built lazily, on the first request: it reads the registry and the evidence
// store, which the server has already loaded, and 3.7 MB of JSON besides.
let built: { all: Additive[]; index: Record<Lang, string>; pages: Record<Lang, Map<string, string>> } | null = null;
function build() {
  if (built) return built;
  const all = loadAdditives();
  for (const a of all.filter((x) => x.hasPage)) {
    for (const lang of ["zh", "es"] as const) {
      for (const term of (a.category ?? "").split(",").map((x) => x.trim()).filter((x) => /^[A-Z][A-Z -]+$/.test(x))) {
        if (!FDA_USES[lang][term]) throw new Error(`FDA use "${term}" (${a.e}) has no ${lang} translation`);
      }
    }
  }
  const per = <V>(f: (lang: Lang) => V) => Object.fromEntries(SITE_LANGUAGES.map((l) => [l, f(l)])) as Record<Lang, V>;
  built = {
    all,
    index: per((lang) => indexPage(all, lang)),
    pages: per((lang) => new Map(all.filter((a) => a.hasPage).map((a) => [a.slug, additivePage(a, all, lang)]))),
  };
  return built;
}

/** Every additive URL, for canonicalHost() and the sitemap. Built on first call. */
export function additivePaths(): string[] {
  return additiveAlternates().flatMap((group) => SITE_LANGUAGES.map((l) => group[l]));
}

/** Each additive page in every language, grouped for the sitemap's hreflang links. */
export function additiveAlternates(): Record<Lang, string>[] {
  return [pathsFor(null), ...Array.from(build().pages.en.keys()).map((slug) => pathsFor(slug))];
}

function serve(lang: Lang) {
  return (req: { params: { slug: string } }, res: any) => {
    const { all, pages } = build();
    const page = pages[lang].get(req.params.slug);
    if (page) return res.type("html").send(page);
    // A bare E number, "/en/additives/e407", goes to its page.
    const slug = req.params.slug.toLowerCase();
    const byE = all.find((a) => a.hasPage && a.e.toLowerCase() === slug);
    if (byE) return res.redirect(301, `/${lang}/additives/${byE.slug}`);
    // A page that no longer exists, because the record that held it open
    // turned out not to be about food (2026-09-26: E131, E338, E903, E904,
    // E905), goes to its row in the index, which still names it.
    const retired = all.find((a) => !a.hasPage && a.slug === slug);
    if (retired) return res.redirect(301, `/${lang}/additives#${retired.e.toLowerCase()}`);
    res.status(404).type("html").send(NOT_FOUND);
  };
}

/**
 * Mount the additive pages. Before serveStatic(), like the guides.
 * Written out literally for the route audit in eval/auth.check.ts.
 */
export function registerAdditiveRoutes(app: Express): void {
  app.get("/en/additives", (_req, res) => res.type("html").send(build().index.en));
  app.get("/zh/additives", (_req, res) => res.type("html").send(build().index.zh));
  app.get("/es/additives", (_req, res) => res.type("html").send(build().index.es));
  app.get("/en/additives/:slug", serve("en"));
  app.get("/zh/additives/:slug", serve("zh"));
  app.get("/es/additives/:slug", serve("es"));
}
