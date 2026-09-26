import type { GuideSource } from "./guideContent";

/**
 * The hand-written half of /en/additives. The records themselves come from
 * the substance registry and the evidence store at boot, the same ones the app
 * shows in its drill-down; see additives.ts.
 *
 * Names are written here rather than taken from the registry because the
 * registry's are whatever each source printed: "GUAR, GUM (CYAMOPSIS
 * TETRAGONOLOBUS (L.))", "SODIUM METABISULFITE", "Tocoferoles". These are the
 * names a label uses, in American English.
 */

export const ADDITIVE_NAMES: Record<string, string> = {
  E100: "Curcumin", E101: "Riboflavin", E102: "Tartrazine", E104: "Quinoline yellow",
  E110: "Sunset yellow FCF", E120: "Carmine", E122: "Carmoisine", E123: "Amaranth",
  E124: "Ponceau 4R", E127: "Erythrosine (Red No. 3)", E129: "Allura red AC", E131: "Patent blue V",
  E132: "Indigotine (Blue No. 2)", E133: "Brilliant blue FCF", E140: "Chlorophyll",
  E141: "Copper chlorophyllin", E142: "Green S", E150a: "Plain caramel", E150c: "Ammonia caramel",
  E150d: "Sulfite ammonia caramel", E151: "Brilliant black BN", E153: "Vegetable carbon",
  E155: "Brown HT", E160a: "Beta-carotene", E160b: "Annatto", E160c: "Paprika extract",
  E160d: "Lycopene", E160e: "Beta-apo-8′-carotenal", E161b: "Lutein", E162: "Beetroot red",
  E163: "Anthocyanins", E170: "Calcium carbonate", E171: "Titanium dioxide", E172: "Iron oxides",
  E173: "Aluminum", E174: "Silver", E175: "Gold",
  E200: "Sorbic acid", E202: "Potassium sorbate", E203: "Calcium sorbate", E210: "Benzoic acid",
  E211: "Sodium benzoate", E212: "Potassium benzoate", E213: "Calcium benzoate",
  E220: "Sulfur dioxide", E221: "Sodium sulfite", E222: "Sodium bisulfite",
  E223: "Sodium metabisulfite", E224: "Potassium metabisulfite", E226: "Calcium sulfite",
  E228: "Potassium bisulfite", E234: "Nisin", E235: "Natamycin", E239: "Hexamine",
  E242: "Dimethyl dicarbonate", E249: "Potassium nitrite", E250: "Sodium nitrite",
  E251: "Sodium nitrate", E252: "Potassium nitrate", E260: "Acetic acid", E261: "Potassium acetate",
  E262: "Sodium acetate", E263: "Calcium acetate", E270: "Lactic acid", E280: "Propionic acid",
  E281: "Sodium propionate", E282: "Calcium propionate", E284: "Boric acid", E285: "Borax",
  E290: "Carbon dioxide", E296: "Malic acid", E297: "Fumaric acid",
  E300: "Ascorbic acid (vitamin C)", E301: "Sodium ascorbate", E302: "Calcium ascorbate",
  E304: "Ascorbyl palmitate", E306: "Tocopherols (vitamin E)", E307: "Alpha-tocopherol",
  E308: "Gamma-tocopherol", E309: "Delta-tocopherol", E310: "Propyl gallate",
  E315: "Erythorbic acid", E316: "Sodium erythorbate", E319: "TBHQ",
  E320: "BHA (butylated hydroxyanisole)", E321: "BHT (butylated hydroxytoluene)", E322: "Lecithin",
  E325: "Sodium lactate", E326: "Potassium lactate", E327: "Calcium lactate", E330: "Citric acid",
  E331: "Sodium citrate", E332: "Potassium citrate", E333: "Calcium citrate", E334: "Tartaric acid",
  E335: "Sodium tartrate", E336: "Potassium tartrate", E338: "Phosphoric acid",
  E339: "Sodium phosphate", E340: "Potassium phosphate", E341: "Calcium phosphate",
  E385: "Calcium disodium EDTA", E392: "Rosemary extract", E400: "Alginic acid",
  E401: "Sodium alginate", E402: "Potassium alginate", E404: "Calcium alginate",
  E405: "Propylene glycol alginate", E406: "Agar", E407: "Carrageenan", E410: "Locust bean gum",
  E412: "Guar gum", E413: "Tragacanth", E414: "Gum arabic (acacia gum)", E415: "Xanthan gum",
  E416: "Karaya gum", E417: "Tara gum", E418: "Gellan gum", E420: "Sorbitol", E421: "Mannitol",
  E422: "Glycerol", E432: "Polysorbate 20", E433: "Polysorbate 80", E435: "Polysorbate 60",
  E440: "Pectin", E442: "Ammonium phosphatides", E450: "Sodium acid pyrophosphate", E451: "Sodium tripolyphosphate",
  E452: "Sodium hexametaphosphate", E460: "Microcrystalline cellulose", E461: "Methyl cellulose",
  E463: "Hydroxypropyl cellulose", E464: "Hydroxypropyl methyl cellulose",
  E466: "Carboxymethyl cellulose", E470a: "Calcium salts of fatty acids",
  E470b: "Magnesium salts of fatty acids", E471: "Mono- and diglycerides of fatty acids",
  E472a: "Acetic acid esters of mono- and diglycerides",
  E472b: "Lactic acid esters of mono- and diglycerides",
  E472c: "Citric acid esters of mono- and diglycerides", E472e: "DATEM",
  E473: "Sucrose esters of fatty acids", E475: "Polyglycerol esters of fatty acids",
  E476: "Polyglycerol polyricinoleate (PGPR)", E477: "Propylene glycol esters of fatty acids",
  E481: "Sodium stearoyl lactylate", E482: "Calcium stearoyl lactylate",
  E491: "Sorbitan monostearate", E500: "Sodium carbonate", E501: "Potassium carbonate",
  E503: "Ammonium carbonate", E504: "Magnesium carbonate", E507: "Hydrochloric acid",
  E508: "Potassium chloride", E509: "Calcium chloride", E511: "Magnesium chloride",
  E516: "Calcium sulfate", E524: "Sodium hydroxide", E525: "Potassium hydroxide",
  E526: "Calcium hydroxide", E551: "Silicon dioxide", E552: "Calcium silicate", E553b: "Talc",
  E570: "Fatty acids", E575: "Glucono-delta-lactone", E578: "Calcium gluconate",
  E620: "Glutamic acid", E621: "Monosodium glutamate (MSG)", E627: "Disodium guanylate",
  E631: "Disodium inosinate", E635: "Disodium ribonucleotides", E640: "Glycine",
  E900: "Dimethylpolysiloxane", E901: "Beeswax", E903: "Carnauba wax", E904: "Shellac",
  E905: "Microcrystalline wax", E920: "L-cysteine", E938: "Argon", E941: "Nitrogen", E948: "Oxygen",
  E950: "Acesulfame K", E951: "Aspartame", E952: "Cyclamate", E953: "Isomalt", E954: "Saccharin",
  E955: "Sucralose", E957: "Thaumatin", E959: "Neohesperidin DC", E960: "Steviol glycosides (stevia)",
  E961: "Neotame", E962: "Aspartame-acesulfame salt", E965: "Maltitol", E966: "Lactitol",
  E967: "Xylitol", E968: "Erythritol", E969: "Advantame", E1103: "Invertase", E1105: "Lysozyme",
  E1200: "Polydextrose", E1404: "Oxidized starch", E1412: "Distarch phosphate",
  E1414: "Acetylated distarch phosphate", E1420: "Acetylated starch",
  E1422: "Acetylated distarch adipate", E1442: "Hydroxypropyl distarch phosphate",
  E1450: "Starch sodium octenyl succinate", E1505: "Triethyl citrate", E1518: "Triacetin",
  E1520: "Propylene glycol",
};

/**
 * The conventional grouping of E numbers by hundreds. It is a convention of
 * the numbering, not a rule of law, and the pages say "the range used for".
 */
export const FAMILIES: { from: number; to: number; slug: string; label: string; noun: string }[] = [
  { from: 100, to: 199, slug: "colors", label: "Colors", noun: "colors" },
  { from: 200, to: 299, slug: "preservatives", label: "Preservatives", noun: "preservatives" },
  { from: 300, to: 399, slug: "antioxidants", label: "Antioxidants and acidity regulators", noun: "antioxidants and acidity regulators" },
  { from: 400, to: 499, slug: "thickeners", label: "Thickeners, stabilizers and emulsifiers", noun: "thickeners, stabilizers and emulsifiers" },
  { from: 500, to: 599, slug: "acidity", label: "Acidity regulators and anti-caking agents", noun: "acidity regulators and anti-caking agents" },
  { from: 600, to: 699, slug: "flavor-enhancers", label: "Flavor enhancers", noun: "flavor enhancers" },
  { from: 900, to: 999, slug: "glazing-sweeteners", label: "Glazing agents, gases and sweeteners", noun: "glazing agents, gases and sweeteners" },
  { from: 1000, to: 1999, slug: "other", label: "Other additives", noun: "enzymes, modified starches and other additives" },
];

export function familyOf(eNumber: string): (typeof FAMILIES)[number] | undefined {
  const n = Number.parseInt(eNumber.replace(/\D/g, ""), 10);
  return FAMILIES.find((f) => n >= f.from && n <= f.to);
}

/** Checked 2026-09-26. */
export const ADDITIVE_SOURCES: Record<string, GuideSource> = {
  "efsa-adi": {
    org: "European Food Safety Authority",
    title: "Glossary: acceptable daily intake",
    url: "https://www.efsa.europa.eu/en/glossary/acceptable-daily-intake",
  },
  iarc: {
    org: "International Agency for Research on Cancer",
    title: "IARC Monographs: Questions and Answers",
    url: "https://monographs.iarc.who.int/wp-content/uploads/2018/07/IARCMonographs-QA.pdf",
  },
  "eu-1333": {
    org: "European Union",
    title: "Regulation (EC) No 1333/2008 on food additives, Annex V",
    year: 2008,
    url: "https://eur-lex.europa.eu/eli/reg/2008/1333/oj",
  },
  "fda-inventory": {
    org: "US Food and Drug Administration",
    title: "Substances Added to Food inventory",
    url: "https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances",
  },
};

/**
 * Which guides an additive's page links to, by E number. The colors guide for
 * the six warned colors and Red 3, the salt guide for MSG, and so on.
 */
export const RELATED_GUIDES: Record<string, string[]> = {
  E102: ["food-color-warnings"], E104: ["food-color-warnings"], E110: ["food-color-warnings"],
  E122: ["food-color-warnings"], E124: ["food-color-warnings"], E129: ["food-color-warnings"],
  E127: ["food-color-warnings"], E621: ["salt-and-sodium"],
};

/** Additives that are, or come from, one of the allergens with a page. */
export const RELATED_ALLERGENS: Record<string, string> = {
  E1105: "eggs",
  E220: "sulfites", E221: "sulfites", E222: "sulfites", E223: "sulfites",
  E224: "sulfites", E226: "sulfites", E228: "sulfites",
};

