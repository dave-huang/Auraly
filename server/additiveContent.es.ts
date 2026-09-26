import type { GuideSource } from "./guideContent";

/**
 * The additive pages in Spanish: the hand-written half, as additiveContent.ts
 * is for English. The sentences themselves are in additives.ts.
 *
 * NAMES are the EU's own Spanish names, from the list of all additives in
 * Annex II, Part B, of Regulation (EC) No 1333/2008 (consolidated text of
 * August 18, 2026), which is what a label sold in Spain prints. Footnote
 * markers are dropped and a few are tidied where the EU text has a slip
 * ("Fostatos de calcio") or a bracket no label uses. Four are not in that
 * list, because the EU splits or never listed them, and are written here:
 * E160b, E203, E953, E960.
 *
 * Quotations are the EU's official Spanish text, verbatim: the Annex V
 * warning and the EFSA conclusion recited in Regulation (EU) 2022/63.
 * Everything else paraphrases an English source, without quotation marks, and
 * the source is marked "(en inglés)".
 *
 * No em dashes (—) in anything a reader sees.
 */

export const EN = "(en inglés)";

export const ADDITIVE_NAMES_ES: Record<string, string> = {
  E100: "Curcumina", E101: "Riboflavina", E102: "Tartrazina", E104: "Amarillo de quinoleína",
  E110: "Amarillo ocaso FCF, amarillo anaranjado S", E120: "Ácido carmínico, carmín",
  E122: "Azorrubina, carmoisina", E123: "Amaranto", E124: "Ponceau 4R, rojo cochinilla A",
  E127: "Eritrosina", E129: "Rojo allura AC", E131: "Azul patente V",
  E132: "Indigotina, carmín índigo", E133: "Azul brillante FCF", E140: "Clorofilas y clorofilinas",
  E141: "Complejos cúpricos de clorofilas y clorofilinas", E142: "Verde S",
  E150a: "Caramelo natural", E150c: "Caramelo amónico", E150d: "Caramelo de sulfito amónico",
  E151: "Negro brillante PN", E153: "Carbón vegetal", E155: "Marrón HT", E160a: "Carotenos",
  E160b: "Bixina y norbixina de bija", E160c: "Extracto de pimentón, capsantina, capsorrubina",
  E160d: "Licopeno", E160e: "Beta-apo-8′-carotenal", E161b: "Luteína",
  E162: "Rojo de remolacha, betanina", E163: "Antocianinas", E170: "Carbonato de calcio",
  E171: "Dióxido de titanio", E172: "Óxidos e hidróxidos de hierro", E173: "Aluminio",
  E174: "Plata", E175: "Oro",
  E200: "Ácido sórbico", E202: "Sorbato potásico", E203: "Sorbato cálcico", E210: "Ácido benzoico",
  E211: "Benzoato sódico", E212: "Benzoato potásico", E213: "Benzoato cálcico",
  E220: "Dióxido de azufre", E221: "Sulfito de sodio", E222: "Sulfito ácido de sodio",
  E223: "Metabisulfito sódico", E224: "Metabisulfito potásico", E226: "Sulfito de calcio",
  E228: "Sulfito ácido de potasio", E234: "Nisina", E235: "Natamicina", E239: "Hexametilentetramina",
  E242: "Dicarbonato de dimetilo", E249: "Nitrito potásico", E250: "Nitrito sódico",
  E251: "Nitrato sódico", E252: "Nitrato potásico", E260: "Ácido acético",
  E261: "Acetatos de potasio", E262: "Acetatos de sodio", E263: "Acetato cálcico",
  E270: "Ácido láctico", E280: "Ácido propiónico", E281: "Propionato sódico",
  E282: "Propionato cálcico", E284: "Ácido bórico", E285: "Tetraborato sódico (bórax)",
  E290: "Dióxido de carbono", E296: "Ácido málico", E297: "Ácido fumárico",
  E300: "Ácido ascórbico", E301: "Ascorbato sódico", E302: "Ascorbato cálcico",
  E304: "Ésteres ácidos grasos de ácido ascórbico", E306: "Extracto rico en tocoferoles",
  E307: "Alfa-tocoferol", E308: "Gamma-tocoferol", E309: "Delta-tocoferol",
  E310: "Galato de propilo", E315: "Ácido eritórbico", E316: "Eritorbato sódico",
  E319: "Terbutilhidroquinona (TBHQ)", E320: "Butilhidroxianisol (BHA)",
  E321: "Butilhidroxitolueno (BHT)", E322: "Lecitinas", E325: "Lactato sódico",
  E326: "Lactato potásico", E327: "Lactato cálcico", E330: "Ácido cítrico",
  E331: "Citratos de sodio", E332: "Citratos de potasio", E333: "Citratos de calcio",
  E334: "Ácido tartárico", E335: "Tartratos de sodio", E336: "Tartratos de potasio",
  E338: "Ácido fosfórico", E339: "Fosfatos de sodio", E340: "Fosfatos de potasio",
  E341: "Fosfatos de calcio", E385: "EDTA de calcio y disodio",
  E392: "Extractos de romero", E400: "Ácido algínico", E401: "Alginato sódico",
  E402: "Alginato potásico", E404: "Alginato cálcico", E405: "Alginato de propano-1,2-diol",
  E406: "Agar-agar", E407: "Carragenanos", E410: "Goma garrofín", E412: "Goma guar",
  E413: "Goma de tragacanto", E414: "Goma arábiga", E415: "Goma xantana", E416: "Goma karaya",
  E417: "Goma tara", E418: "Goma gellan", E420: "Sorbitoles", E421: "Manitol", E422: "Glicerina",
  E432: "Monolaurato de sorbitano polioxietilenado (polisorbato 20)",
  E433: "Monooleato de sorbitano polioxietilenado (polisorbato 80)",
  E435: "Monoestearato de sorbitano polioxietilenado (polisorbato 60)", E440: "Pectinas",
  E442: "Fosfátidos de amonio", E450: "Difosfatos", E451: "Trifosfatos", E452: "Polifosfatos",
  E460: "Celulosa", E461: "Metilcelulosa", E463: "Hidroxipropilcelulosa",
  E464: "Hidroxipropilmetilcelulosa", E466: "Carboximetilcelulosa sódica, goma de celulosa",
  E470a: "Sales sódicas, potásicas y cálcicas de ácidos grasos",
  E470b: "Sales magnésicas de ácidos grasos", E471: "Monoglicéridos y diglicéridos de ácidos grasos",
  E472a: "Ésteres acéticos de monoglicéridos y diglicéridos de ácidos grasos",
  E472b: "Ésteres lácticos de monoglicéridos y diglicéridos de ácidos grasos",
  E472c: "Ésteres cítricos de monoglicéridos y diglicéridos de ácidos grasos",
  E472e: "Ésteres monoacetil y diacetil tartáricos de monoglicéridos y diglicéridos de ácidos grasos",
  E473: "Sucroésteres de ácidos grasos", E475: "Ésteres poliglicéricos de ácidos grasos",
  E476: "Polirricinoleato de poliglicerol", E477: "Ésteres de propano-1,2-diol de ácidos grasos",
  E481: "Estearoil-2-lactilato sódico", E482: "Estearoil-2-lactilato cálcico",
  E491: "Monoestearato de sorbitano", E500: "Carbonatos de sodio", E501: "Carbonatos de potasio",
  E503: "Carbonatos de amonio", E504: "Carbonatos de magnesio", E507: "Ácido clorhídrico",
  E508: "Cloruro potásico", E509: "Cloruro cálcico", E511: "Cloruro magnésico",
  E516: "Sulfato cálcico", E524: "Hidróxido de sodio", E525: "Hidróxido de potasio",
  E526: "Hidróxido de calcio", E551: "Dióxido de silicio", E552: "Silicato cálcico", E553b: "Talco",
  E570: "Ácidos grasos", E575: "Glucono-delta-lactona", E578: "Gluconato cálcico",
  E620: "Ácido glutámico", E621: "Glutamato de monosodio", E627: "Guanilato disódico",
  E631: "Inosinato disódico", E635: "5′-ribonucleótidos de disodio", E640: "Glicina y su sal sódica",
  E900: "Dimetilpolisiloxano", E901: "Cera de abeja, blanca y amarilla", E903: "Cera de carnauba",
  E904: "Goma laca", E905: "Cera microcristalina", E920: "L-cisteína", E938: "Argón",
  E941: "Nitrógeno", E948: "Oxígeno", E950: "Acesulfamo K", E951: "Aspartamo", E952: "Ciclamatos",
  E953: "Isomalt", E954: "Sacarinas", E955: "Sucralosa", E957: "Taumatina", E959: "Neohesperidina DC",
  E960: "Glucósidos de esteviol", E961: "Neotamo", E962: "Sal de aspartamo y acesulfamo",
  E965: "Maltitoles", E966: "Lactitol", E967: "Xilitol", E968: "Eritritol", E969: "Advantame",
  E1103: "Invertasa", E1105: "Lisozima", E1200: "Polidextrosa", E1404: "Almidón oxidado",
  E1412: "Fosfato de dialmidón", E1414: "Fosfato de dialmidón acetilado",
  E1420: "Almidón acetilado", E1422: "Adipato de dialmidón acetilado",
  E1442: "Fosfato de dialmidón hidroxipropilado", E1450: "Octenilsuccinato sódico de almidón",
  E1505: "Citrato de trietilo", E1518: "Triacetato de glicerilo (triacetina)",
  E1520: "Propano-1,2-diol (propilenglicol)",
};

/**
 * By family slug. The labels use the EU's Spanish category names
 * (conservadores, emulgentes, correctores de la acidez). The noun carries its
 * article, because the pages say "el rango que se usa para los colorantes".
 */
export const FAMILIES_ES: Record<string, { label: string; noun: string }> = {
  colors: { label: "Colorantes", noun: "los colorantes" },
  preservatives: { label: "Conservadores", noun: "los conservadores" },
  antioxidants: { label: "Antioxidantes y correctores de la acidez", noun: "los antioxidantes y correctores de la acidez" },
  thickeners: { label: "Espesantes, estabilizadores y emulgentes", noun: "los espesantes, estabilizadores y emulgentes" },
  acidity: { label: "Correctores de la acidez y antiaglomerantes", noun: "los correctores de la acidez y antiaglomerantes" },
  "flavor-enhancers": { label: "Potenciadores del sabor", noun: "los potenciadores del sabor" },
  "glazing-sweeteners": { label: "Agentes de recubrimiento, gases y edulcorantes", noun: "los agentes de recubrimiento, gases y edulcorantes" },
  other: { label: "Otros aditivos", noun: "las enzimas, los almidones modificados y otros aditivos" },
};

/** The FDA inventory's "used for" terms (21 CFR 170.3(o)), in Spanish. */
export const FDA_USES_ES: Record<string, string> = {
  "ANTICAKING AGENT OR FREE-FLOW AGENT": "antiaglomerante o agente de flujo libre",
  "ANTIMICROBIAL AGENT": "agente antimicrobiano",
  ANTIOXIDANT: "antioxidante",
  "COLOR OR COLORING ADJUNCT": "colorante o coadyuvante de coloración",
  "CURING OR PICKLING AGENT": "agente de curado o encurtido",
  "DOUGH STRENGTHENER": "reforzador de masa",
  "DRYING AGENT": "agente secante",
  "EMULSIFIER OR EMULSIFIER SALT": "emulgente o sal emulgente",
  "FIRMING AGENT": "endurecedor",
  "FLAVOR ENHANCER": "potenciador del sabor",
  "FLAVORING AGENT OR ADJUVANT": "aromatizante o coadyuvante de aroma",
  "FLOUR TREATING AGENT": "agente de tratamiento de la harina",
  "FORMULATION AID": "coadyuvante de formulación",
  FUMIGANT: "fumigante",
  HUMECTANT: "humectante",
  "LEAVENING AGENT": "gasificante",
  "LUBRICANT OR RELEASE AGENT": "lubricante o desmoldeante",
  "MALTING OR FERMENTING AID": "coadyuvante de malteado o fermentación",
  "MASTICATORY SUBSTANCE": "sustancia masticatoria",
  "NON-NUTRITIVE SWEETENER": "edulcorante no nutritivo",
  "NUTRIENT SUPPLEMENT": "complemento nutritivo",
  "NUTRITIVE SWEETENER": "edulcorante nutritivo",
  "OXIDIZING OR REDUCING AGENT": "agente oxidante o reductor",
  "PH CONTROL AGENT": "regulador del pH",
  "PROCESSING AID": "coadyuvante tecnológico",
  PROPELLANT: "gas propulsor",
  SEQUESTRANT: "secuestrante",
  "SOLVENT OR VEHICLE": "disolvente o vehículo",
  "STABILIZER OR THICKENER": "estabilizador o espesante",
  "SURFACE-ACTIVE AGENT": "agente tensioactivo",
  "SURFACE-FINISHING AGENT": "agente de acabado superficial",
  TEXTURIZER: "texturizante",
  TRACER: "trazador",
  "WASHING OR SURFACE REMOVAL AGENT": "agente de lavado o pelado",
};

/** The page's own sources, in Spanish. Checked 2026-09-26. */
export const ADDITIVE_SOURCES_ES: Record<string, GuideSource> = {
  "efsa-adi": {
    org: "Autoridad Europea de Seguridad Alimentaria (EFSA)",
    title: "Glossary: acceptable daily intake (glosario: ingesta diaria admisible)",
    url: "https://www.efsa.europa.eu/en/glossary/acceptable-daily-intake",
    note: EN,
  },
  iarc: {
    org: "Centro Internacional de Investigaciones sobre el Cáncer (IARC)",
    title: "IARC Monographs: Questions and Answers (preguntas y respuestas)",
    url: "https://monographs.iarc.who.int/wp-content/uploads/2018/07/IARCMonographs-QA.pdf",
    note: EN,
  },
  "eu-1333": {
    org: "Unión Europea",
    title: "Reglamento (CE) n.º 1333/2008 sobre aditivos alimentarios, anexo V",
    year: 2008,
    url: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32008R1333",
  },
  "eu-2022-63": {
    org: "Comisión Europea",
    title:
      "Reglamento (UE) 2022/63 de la Comisión, por el que se modifican los anexos II y III del Reglamento (CE) n.º 1333/2008 en lo que respecta al aditivo alimentario dióxido de titanio (E 171)",
    year: 2022,
    url: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32022R0063",
  },
  "fda-inventory": {
    org: "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
    title: "Substances Added to Food (inventario de sustancias añadidas a los alimentos)",
    url: "https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances",
    note: EN,
  },
};

/** The bodies behind the evidence records, by the name the record gives. */
export const ORGS_ES: Record<string, string> = {
  EFSA: "Autoridad Europea de Seguridad Alimentaria (EFSA)",
  IARC: "Centro Internacional de Investigaciones sobre el Cáncer (IARC)",
  "International Agency for Research on Cancer": "Centro Internacional de Investigaciones sobre el Cáncer (IARC)",
  "US FDA": "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
  "US Food and Drug Administration": "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
  "California OEHHA": "Oficina de Evaluación de Riesgos para la Salud Ambiental de California (OEHHA)",
  "Joint FAO/WHO Expert Committee on Food Additives": "Comité Mixto FAO/OMS de Expertos en Aditivos Alimentarios (JECFA)",
  "European Commission": "Comisión Europea",
  "European Union": "Unión Europea",
};
