import type { AnalysisResult, Ingredient, RiskLevel } from '@shared/schema';

/**
 * The example scan shown at the end of onboarding.
 *
 * WHY THIS EXISTS
 *
 * FREE_SCAN_GRANT is 0, so the honest order of events is: build a profile,
 * then be asked to pay. Which means the app asks for money having never once
 * done the thing it is for. Whatever else is wrong with that, it is a very
 * hard sell, and it is the reason someone with a peanut-allergic child cannot
 * tell this app apart from the ten others they already deleted.
 *
 * So: one fixed label, analysed against the profile they just built, before
 * the ask. It is labelled as an example everywhere it appears.
 *
 * WHAT IS AND IS NOT REAL HERE
 *
 * The LABEL is a fixture — a plausible product, not a real brand, with an
 * ingredient list written by hand. The facts in it are true.
 *
 * The VERDICT is not a fixture. It runs through annotateWithCitations,
 * withLabelRanks and applyProfileToAnalysis exactly as a live scan does, so
 * the allergens found, the dietary conflicts, the "we checked for X and did
 * not find it" list and the overall risk are all produced by the real matcher
 * against the real profile. Nothing about the personal answer is staged, and
 * nothing here can flatter the app: a profile this label does not touch gets
 * a clean verdict, which is its own kind of demonstration.
 *
 * WHY THE LABEL IS IN SPANISH
 *
 * Reading a label you cannot read is the hardest thing this app does and the
 * hardest thing to explain in a sentence. Showing it costs nothing here: the
 * card puts the printed Spanish beside the reader's own language, and the
 * point lands without a word of marketing.
 *
 * WHY THIS PARTICULAR PRODUCT
 *
 * Every entry earns its place by being something a person could not
 * reasonably work out from the packet:
 *
 *   - sodium caseinate is milk, on products sold as non-dairy
 *   - gelatin's source animal is essentially never printed, so halal and
 *     kosher cannot be settled from the list — which is the app's `unsettled`
 *     state, demonstrated rather than described
 *   - carmine is an insect
 *   - sesame has only been a declarable US allergen since 2023
 *   - sulphur dioxide is the reason dried fruit stays orange
 *   - titanium dioxide is a whitener the EU withdrew from food in 2022 and
 *     the US still permits, which is the clearest single example of the same
 *     ingredient being answered differently depending on where you stand. It
 *     is also the label's one HIGH row, which the example scan needs: the
 *     screen teaches where to look, and a card whose worst row is a caution
 *     teaches it faintly.
 *
 * Between them they touch milk, tree nuts, soy, sesame, wheat and sulphites,
 * plus vegan, vegetarian, halal, kosher, gluten-free and celiac. Most
 * profiles will find something. Peanut is deliberately NOT in the list — the
 * most frightened group of users gets a calm, evidenced clear verdict, and
 * the label's own "may contain" line does the rest honestly.
 */

export type DemoLanguage = 'en' | 'zh' | 'es';

/** The demo label, one row per printed line. */
interface DemoRow {
  /** English name the matcher runs against. Never shown. */
  canonical: string;
  /** Exactly as printed on the (Spanish) packet. */
  original: string;
  riskLevel: RiskLevel;
  category: string;
  copy: Record<DemoLanguage, { name: string; summary: string; details: string }>;
}

const ROWS: DemoRow[] = [
  {
    canonical: 'Rolled Oats',
    original: 'Copos de Avena',
    riskLevel: 'low',
    category: 'grain',
    copy: {
      en: {
        name: 'Rolled Oats',
        summary: 'A whole grain. Gluten-free in itself, but rarely milled that way.',
        details:
          'Oats contain no gluten of their own. Most are grown and milled alongside wheat, barley and rye, so only oats specifically labelled gluten-free are considered safe in celiac disease.',
      },
      zh: {
        name: '燕麦片',
        summary: '全谷物。本身不含麸质，但加工过程通常并非如此。',
        details:
          '燕麦本身不含麸质。但大多数燕麦与小麦、大麦和黑麦一同种植与碾磨，因此只有明确标示"无麸质"的燕麦才适合乳糜泻患者。',
      },
      es: {
        name: 'Copos de Avena',
        summary: 'Un cereal integral. Sin gluten en sí, pero rara vez molido así.',
        details:
          'La avena no contiene gluten propio. La mayoría se cultiva y muele junto al trigo, la cebada y el centeno, por lo que solo la avena etiquetada como sin gluten se considera segura en la enfermedad celíaca.',
      },
    },
  },
  {
    canonical: 'Almonds',
    original: 'Almendras',
    riskLevel: 'low',
    category: 'nut',
    copy: {
      en: {
        name: 'Almonds',
        summary: 'A tree nut, and one of the allergens labels must declare.',
        details:
          'Tree nuts must be named on labels in the US, EU, UK and Canada. A tree nut allergy is usually lifelong, and being allergic to one nut does not predict the others either way.',
      },
      zh: {
        name: '杏仁',
        summary: '坚果类，属于标签必须标示的过敏原。',
        details:
          '在美国、欧盟、英国和加拿大，坚果必须在标签上具名标示。坚果过敏通常伴随终身，且对某一种坚果过敏并不能推断对其他坚果的反应。',
      },
      es: {
        name: 'Almendras',
        summary: 'Un fruto de cáscara, y uno de los alérgenos de declaración obligatoria.',
        details:
          'Los frutos de cáscara deben nombrarse en las etiquetas de EE. UU., la UE, el Reino Unido y Canadá. La alergia suele ser de por vida, y ser alérgico a un fruto seco no predice la reacción a los demás.',
      },
    },
  },
  {
    canonical: 'Sodium Caseinate',
    original: 'Caseinato de Sodio',
    riskLevel: 'low',
    category: 'protein',
    copy: {
      en: {
        name: 'Sodium Caseinate',
        summary: 'A milk protein, including on products sold as non-dairy.',
        details:
          'Casein is the main protein in milk. In the US a product can be labelled non-dairy and still contain sodium caseinate, because that claim is about butterfat rather than milk protein. For anyone allergic to milk it is the real thing, and it is not vegan.',
      },
      zh: {
        name: '酪蛋白酸钠',
        summary: '一种牛奶蛋白，即使产品标示为"非乳制品"。',
        details:
          '酪蛋白是牛奶中的主要蛋白质。在美国，产品可以标示为"非乳制品"却仍含有酪蛋白酸钠，因为该标示针对的是乳脂而非乳蛋白。对牛奶过敏的人而言，它就是牛奶成分，而且不属于纯素。',
      },
      es: {
        name: 'Caseinato de Sodio',
        summary: 'Una proteína láctea, incluso en productos vendidos como sin lácteos.',
        details:
          'La caseína es la principal proteína de la leche. En EE. UU. un producto puede etiquetarse como "non-dairy" y contener caseinato de sodio, porque esa afirmación se refiere a la grasa láctea y no a la proteína. Para quien es alérgico a la leche es leche, y no es vegano.',
      },
    },
  },
  {
    canonical: 'Glucose Syrup',
    original: 'Jarabe de Glucosa',
    riskLevel: 'low',
    category: 'sweetener',
    copy: {
      en: {
        name: 'Glucose Syrup',
        summary: 'A sugar syrup, usually made from wheat or maize.',
        details:
          'Even when the starting grain is wheat, glucose syrup is refined thoroughly enough that the EU exempts it from allergen labelling. Which grain it came from is rarely stated.',
      },
      zh: {
        name: '葡萄糖浆',
        summary: '糖浆，通常由小麦或玉米制成。',
        details:
          '即使原料是小麦，葡萄糖浆的精制程度也足以让欧盟豁免其过敏原标示要求。标签上很少注明原料来源。',
      },
      es: {
        name: 'Jarabe de Glucosa',
        summary: 'Un jarabe de azúcar, normalmente de trigo o maíz.',
        details:
          'Aunque el cereal de partida sea trigo, el jarabe de glucosa se refina lo suficiente como para que la UE lo exima del etiquetado de alérgenos. Rara vez se indica de qué cereal procede.',
      },
    },
  },
  {
    canonical: 'Dried Cranberries',
    original: 'Arándanos Rojos Deshidratados',
    riskLevel: 'low',
    category: 'fruit',
    copy: {
      en: {
        name: 'Dried Cranberries',
        summary: 'Dried fruit, almost always sweetened.',
        details:
          'Cranberries are too sour to dry unsweetened, so they are steeped in sugar or apple juice first. Dried fruit is also the usual reason a sulphite preservative appears further down a list.',
      },
      zh: {
        name: '蔓越莓干',
        summary: '果干，几乎都经过加糖处理。',
        details:
          '蔓越莓过酸，无法直接不加糖烘干，因此会先浸泡在糖或苹果汁中。果干也是成分表后段出现亚硫酸盐防腐剂的常见原因。',
      },
      es: {
        name: 'Arándanos Rojos Deshidratados',
        summary: 'Fruta desecada, casi siempre azucarada.',
        details:
          'El arándano rojo es demasiado ácido para secarse sin azúcar, así que se macera antes en azúcar o zumo de manzana. La fruta desecada es también el motivo habitual de que aparezca un conservante sulfitante más abajo en la lista.',
      },
    },
  },
  {
    canonical: 'Sulphur Dioxide',
    original: 'Dióxido de Azufre (E220)',
    riskLevel: 'moderate',
    category: 'preservative',
    copy: {
      en: {
        name: 'Sulphur Dioxide (E220)',
        summary: 'A sulphite preservative that can set off asthma.',
        details:
          'Used to stop dried fruit browning. The EU and UK require it to be declared above 10 mg/kg specifically because a minority of people with asthma react to it, sometimes severely. It is one of the fourteen allergens named in EU law.',
      },
      zh: {
        name: '二氧化硫（E220）',
        summary: '一种亚硫酸盐防腐剂，可能诱发哮喘。',
        details:
          '用于防止果干褐变。欧盟和英国规定含量超过 10 mg/kg 时必须标示，正是因为部分哮喘患者会对其产生反应，有时相当严重。它是欧盟法规列明的十四种过敏原之一。',
      },
      es: {
        name: 'Dióxido de Azufre (E220)',
        summary: 'Un conservante sulfitante que puede desencadenar asma.',
        details:
          'Se usa para evitar que la fruta desecada se oscurezca. La UE y el Reino Unido exigen declararlo por encima de 10 mg/kg precisamente porque una minoría de personas con asma reacciona a él, a veces de forma grave. Es uno de los catorce alérgenos recogidos en la norma europea.',
      },
    },
  },
  {
    canonical: 'Soy Lecithin',
    original: 'Lecitina de Soja',
    riskLevel: 'low',
    category: 'emulsifier',
    copy: {
      en: {
        name: 'Soy Lecithin',
        summary: 'An emulsifier from soybeans. Declared as soy.',
        details:
          'Refined enough that it carries very little soy protein, and most people with a soy allergy tolerate it. It is still declared as soy, and anyone with a severe allergy is advised to treat it as one.',
      },
      zh: {
        name: '大豆卵磷脂',
        summary: '来自大豆的乳化剂，须按大豆标示。',
        details:
          '精制程度较高，残留的大豆蛋白极少，多数大豆过敏者可以耐受。但它仍须按大豆标示，重度过敏者应视其为大豆成分。',
      },
      es: {
        name: 'Lecitina de Soja',
        summary: 'Un emulgente de soja. Se declara como soja.',
        details:
          'Está lo bastante refinada como para arrastrar muy poca proteína de soja, y la mayoría de las personas alérgicas la toleran. Aun así se declara como soja, y quien tenga una alergia grave debe tratarla como tal.',
      },
    },
  },
  {
    canonical: 'Sesame Seeds',
    original: 'Semillas de Sésamo',
    riskLevel: 'low',
    category: 'seed',
    copy: {
      en: {
        name: 'Sesame Seeds',
        summary: 'A major allergen, required on US labels only since 2023.',
        details:
          'The FASTER Act made sesame the ninth allergen US labels must declare, effective January 2023. Before that it could legally hide inside "spices" or "natural flavour", which is exactly how people were caught out.',
      },
      zh: {
        name: '芝麻',
        summary: '主要过敏原，美国自 2023 年起才要求标示。',
        details:
          '《FASTER 法案》将芝麻列为美国标签必须标示的第九种过敏原，自 2023 年 1 月起生效。在此之前，它可以合法地隐藏在"香辛料"或"天然香料"之中，许多人正是因此中招。',
      },
      es: {
        name: 'Semillas de Sésamo',
        summary: 'Alérgeno mayor: obligatorio en EE. UU. solo desde 2023.',
        details:
          'La FASTER Act convirtió al sésamo en el noveno alérgeno de declaración obligatoria en EE. UU., en vigor desde enero de 2023. Antes podía ocultarse legalmente bajo "especias" o "aroma natural", que es justo como pillaba a la gente.',
      },
    },
  },
  {
    canonical: 'Wheat Starch',
    original: 'Almidón de Trigo',
    riskLevel: 'low',
    category: 'starch',
    copy: {
      en: {
        name: 'Wheat Starch',
        summary: 'A starch from wheat. Contains gluten unless it says otherwise.',
        details:
          'Ordinary wheat starch keeps enough gluten to matter in celiac disease. A version processed to remove it exists and is labelled "gluten-free wheat starch". The distinction is the whole difference, and it is one word.',
      },
      zh: {
        name: '小麦淀粉',
        summary: '来自小麦的淀粉。除非另有标示，否则含麸质。',
        details:
          '普通小麦淀粉保留的麸质足以对乳糜泻患者构成影响。经处理去除麸质的版本会标示为"无麸质小麦淀粉"，差别全在这几个字上。',
      },
      es: {
        name: 'Almidón de Trigo',
        summary: 'Almidón de trigo. Contiene gluten salvo que se indique lo contrario.',
        details:
          'El almidón de trigo corriente conserva gluten suficiente para importar en la enfermedad celíaca. Existe una versión tratada para eliminarlo, etiquetada como "almidón de trigo sin gluten": toda la diferencia está en esas dos palabras.',
      },
    },
  },
  {
    canonical: 'Gelatin',
    original: 'Gelatina',
    riskLevel: 'low',
    category: 'gelling agent',
    copy: {
      en: {
        name: 'Gelatin',
        summary: 'An animal protein, usually pork or beef. The animal is rarely named.',
        details:
          'Boiled from skin, bone and connective tissue. Because the source animal is almost never printed, gelatin cannot be cleared as halal or kosher from an ingredient list alone, and that takes certification. It is never vegan or vegetarian.',
      },
      zh: {
        name: '明胶',
        summary: '动物蛋白，通常来自猪或牛。标签极少注明来源。',
        details:
          '由皮、骨和结缔组织熬制而成。由于来源动物几乎从不标注，仅凭成分表无法判定明胶是否符合清真或洁食标准，这需要认证。它绝不属于纯素或素食。',
      },
      es: {
        name: 'Gelatina',
        summary: 'Proteína animal, normalmente de cerdo o vacuno. Rara vez se nombra el animal.',
        details:
          'Se obtiene cociendo piel, hueso y tejido conjuntivo. Como casi nunca se indica el animal de origen, la gelatina no puede darse por halal ni kosher solo con la lista de ingredientes: eso exige certificación. Nunca es vegana ni vegetariana.',
      },
    },
  },
  {
    canonical: 'Titanium Dioxide',
    original: 'Dióxido de Titanio (E171)',
    riskLevel: 'high',
    category: 'colour',
    copy: {
      en: {
        name: 'Titanium Dioxide (E171)',
        summary: 'A whitener the EU withdrew from food in 2022.',
        details:
          'Used to make coatings and fillings look opaque and white. EFSA re-evaluated it in 2021 and could not rule out damage to DNA, so the EU stopped allowing it as a food additive from 2022. It is still permitted in food in the United States and across much of Latin America, and it is still used in toothpaste and sunscreen.',
      },
      zh: {
        name: '二氧化钛（E171）',
        summary: '一种增白剂，欧盟已于 2022 年停止允许用于食品。',
        details:
          '用来让糖衣和夹心看起来不透明、发白。欧洲食品安全局在 2021 年重新评估后，无法排除它对 DNA 的损害，因此欧盟自 2022 年起不再允许它作为食品添加剂。它在美国和拉丁美洲多数国家仍可用于食品，也仍用于牙膏和防晒霜。',
      },
      es: {
        name: 'Dióxido de Titanio (E171)',
        summary: 'Un blanqueador que la UE retiró de los alimentos en 2022.',
        details:
          'Se usa para que coberturas y rellenos se vean opacos y blancos. La EFSA lo reevaluó en 2021 y no pudo descartar daños en el ADN, así que la UE dejó de permitirlo como aditivo alimentario desde 2022. Sigue permitido en alimentos en Estados Unidos y en buena parte de Latinoamérica, y se sigue usando en pasta de dientes y protector solar.',
      },
    },
  },
  {
    canonical: 'Carmine',
    original: 'Carmín (E120)',
    riskLevel: 'low',
    category: 'colour',
    copy: {
      en: {
        name: 'Carmine (E120)',
        summary: 'A red colour made from insects.',
        details:
          'Also printed as cochineal or carminic acid. It is produced from the dried bodies of the cochineal scale insect, around 70,000 of them per kilogram. Not vegan or vegetarian, and a rare allergen in its own right.',
      },
      zh: {
        name: '胭脂红（E120）',
        summary: '由昆虫制成的红色色素。',
        details:
          '也标示为胭脂虫红或胭脂虫酸。由胭脂虫的干燥虫体制成，每公斤约需七万只。不属于纯素或素食，本身也是一种罕见过敏原。',
      },
      es: {
        name: 'Carmín (E120)',
        summary: 'Un colorante rojo hecho a partir de insectos.',
        details:
          'También aparece como cochinilla o ácido carmínico. Se obtiene de los cuerpos desecados de la cochinilla: unos 70 000 insectos por kilogramo. No es vegano ni vegetariano, y es un alérgeno poco frecuente por sí mismo.',
      },
    },
  },
];

const PRODUCT_NAME: Record<DemoLanguage, string> = {
  en: 'Berry & Almond Yogurt Bar',
  zh: '莓果杏仁酸奶棒',
  es: 'Barrita de Yogur con Bayas y Almendras',
};

/** What the packet itself declares, in the two lines EU labels print. */
const DECLARED = {
  contains: ['milk', 'almonds', 'soy', 'sesame', 'wheat', 'sulphur dioxide'],
  // Kept because it is true of this kind of product, and because a profile
  // this list does not touch still deserves an honest hedge rather than a
  // clean verdict the label does not support.
  mayContain: ['peanut'],
};

/**
 * Language for the demo, narrowed to what we hold copy for.
 *
 * Falls back to English rather than throwing: an unexpected locale must show
 * an English example, never no example at all.
 */
function pick(language: string | undefined): DemoLanguage {
  const base = (language ?? 'en').slice(0, 2).toLowerCase();
  return base === 'zh' || base === 'es' ? base : 'en';
}

/**
 * The example label, unpersonalized.
 *
 * Callers must run this through the same post-analysis chain a live scan uses
 * (annotateWithCitations → withLabelRanks → applyProfileToAnalysis); see the
 * route in routes.ts.
 */
export function demoAnalysis(language: string | undefined): AnalysisResult {
  const lang = pick(language);

  const ingredients: Ingredient[] = ROWS.map((row) => ({
    name: row.copy[lang].name,
    riskLevel: row.riskLevel,
    universalRiskLevel: row.riskLevel,
    summary: row.copy[lang].summary,
    details: row.copy[lang].details,
    category: row.category,
  }));

  return {
    productType: 'food',
    productName: PRODUCT_NAME[lang],
    ingredients,
    // Titanium dioxide alone, before any profile. Personalization only ever
    // raises this.
    overallRisk: 'high',
    analyzedAt: new Date().toISOString(),
    canonicalIngredients: ROWS.map((row) => row.canonical),
    originalIngredients: ROWS.map((row) => row.original),
    sourceLanguage: 'es',
    // The fixture is complete by construction, and saying so is accurate: the
    // confidence meter is reporting on a read that lost nothing.
    readConfidence: 'high',
    lineCount: { read: ROWS.length, total: ROWS.length },
    declaredAllergens: DECLARED,
  };
}
