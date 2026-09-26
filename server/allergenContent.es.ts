import type { AllergenText } from "./allergenContent";
import type { GuideSource } from "./guideContent";

/**
 * The allergen pages in Spanish, keyed by the English slug.
 *
 * Same sourcing as allergenContent.ts. The EU's Spanish text of Regulation
 * 1169/2011 is equally authentic with the English, so Annex II is quoted in
 * it verbatim ("Leche y sus derivados (incluida la lactosa)"), checked against
 * EUR-Lex on 2026-09-26; that is why those quotes say "cacahuetes". FDA and
 * the CFR publish only English, so their points are paraphrased without
 * quotation marks, except label wording ("whey (goat milk)"). Allergen names
 * follow the app's own Spanish (mobile/src/lib/i18n.tsx): Frutos secos,
 * Cacahuete, Alforfón.
 *
 * No em dashes in anything a reader sees.
 */

const EN = "(en inglés)";

export const ALLERGEN_SOURCES_ES: Record<string, GuideSource> = {
  "fda-qa": {
    org: "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
    title: "Preguntas y respuestas sobre alérgenos alimentarios (quinta edición), guía para la industria",
    year: 2025,
    url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-questions-and-answers-regarding-food-allergens-including-food-allergen-labeling",
    note: EN,
  },
  fda: {
    org: "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
    title: "Food Allergies (alergias alimentarias)",
    url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
    note: EN,
  },
  eu: {
    org: "Unión Europea",
    title: "Reglamento (UE) n.º 1169/2011 sobre la información alimentaria facilitada al consumidor, anexo II",
    year: 2011,
    url: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32011R1169",
  },
  jp: {
    org: "Agencia de Asuntos del Consumidor de Japón",
    title: "アレルギー表示について (etiquetado de alérgenos), abril de 2026",
    year: 2026,
    url: "https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/assets/food_labeling_cms204_260401_01.pdf",
    note: "(en japonés)",
  },
  cfr22: {
    org: "Código de Regulaciones Federales de EE. UU.",
    title: "21 CFR 101.22, etiquetado de especias, aromas, colorantes y conservantes químicos",
    url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-B/section-101.22",
    note: EN,
  },
};

const NOT_US = "No es un alérgeno principal, así que nada obliga a destacarlo en la etiqueta.[[fda]]";
const NOT_JP = "No figura en la lista obligatoria ni en la recomendada de Japón.[[jp]]";
const EU14 = "Uno de los 14 alérgenos";

export const ALLERGENS_ES: Record<string, AllergenText> = {
  milk: {
    noun: "leche",
    label: "Leche",
    title: "Otros nombres de la leche en una etiqueta",
    description:
      "Suero, caseína, ghee y más: los nombres de la leche en una lista de ingredientes, lo que parece lácteo y no lo es, y cómo exigen declararla EE. UU., la UE y Japón.",
    dek: "La leche no siempre dice “leche”. Estos son los nombres que usa, los que solo suenan a lácteo y lo que las etiquetas están obligadas a indicar.",
    names: [
      "Leche, leche en polvo, grasa láctea, suero de mantequilla.",
      "Suero de leche, proteína de suero. El líquido que queda al hacer queso. Habitual en barritas de proteína y aperitivos.",
      "Caseína, caseinato. La principal proteína de la leche. El caseinato de sodio aparece en cremas para el café.",
      "Lactosa. El azúcar de la leche.",
      "Mantequilla, ghee. El ghee es mantequilla clarificada.",
      "Nata o crema, nata agria.",
      "Queso, cuajada. Como en la cuajada del queso.",
      "Yogur.",
      "Lácteos.",
    ],
    notIt: [
      "Manteca de cacao, manteca de karité. Grasas vegetales.",
      "Mantequilla de cacahuete y otras cremas de frutos secos o semillas. Se llaman así por su textura. Revísalas por cacahuete y frutos secos.",
      "Leche y crema de coco. Hechas de coco.",
      "Bebidas de soja, avena, almendra y arroz. Bebidas vegetales. Revisa sus propios alérgenos.",
      "Cremor tártaro. Un ingrediente de la levadura química que procede de la elaboración del vino.",
      "Bean curd. Otro nombre del tofu, que es soja.",
      "Calabaza butternut. Una verdura.",
    ],
    law: {
      us: "Alérgeno principal.[[fda]] La FDA cuenta la leche de vaca, cabra, oveja y otros rumiantes, y la leche de un animal que no sea la vaca debe nombrarlo, como en “whey (goat milk)”.[[fda-qa]]",
      eu: `${EU14}: “Leche y sus derivados (incluida la lactosa)”. Quedan exentos el lactosuero usado para hacer destilados alcohólicos y el lactitol.[[eu]]`,
      jp: "Obligatorio (乳).[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio", jp: "Obligatorio" },
    more: `
<h2>Las proteínas de leche hechas sin vacas también cuentan</h2>
<p>Según la guía de la FDA, una proteína procedente de un alérgeno principal se etiqueta como ese alérgeno aunque se obtenga de otra forma, por ejemplo por fermentación. Así que una proteína de leche hecha sin vacas tiene que declararse como leche.[[fda-qa]]</p>

<h2>El alérgeno no declarado más frecuente</h2>
<p>La FDA señala que la leche es la causa más frecuente de retiradas del mercado por alérgenos no declarados en EE. UU. Y destaca el chocolate negro como un producto de mayor riesgo para las personas alérgicas a la leche.[[fda]]</p>
`,
  },

  eggs: {
    noun: "huevo",
    label: "Huevo",
    title: "Otros nombres del huevo en una etiqueta",
    description:
      "Albúmina, ovoalbúmina, lisozima (E1105) y más: los nombres del huevo en una lista de ingredientes, y cómo exigen declararlo EE. UU., la UE y Japón.",
    dek: "El huevo se esconde en salsas, pasta, bollería e incluso algunos quesos. Estos son los nombres que hay que buscar.",
    names: [
      "Huevo, clara, yema, huevo en polvo.",
      "Albúmina. La proteína de la clara.",
      "Ovoalbúmina. La principal proteína de la clara.",
      "Mayonesa. Se hace con yema de huevo.",
      "Merengue. Clara batida.",
      "Lisozima, E1105. Una enzima obtenida de la clara, usada en algunos quesos y vinos.",
    ],
    notIt: [
      "Berenjena (eggplant). Una verdura.",
      "“Sin huevo”. Es una afirmación, no un ingrediente. Revely no la cuenta.",
    ],
    law: {
      us: "Alérgeno principal.[[fda]] La FDA cuenta los huevos de gallina, pato, oca, codorniz y otras aves, y los de un ave que no sea la gallina deben nombrarla, como en “ovalbumin (duck egg)”.[[fda-qa]]",
      eu: `${EU14}: “Huevos y productos a base de huevo”.[[eu]] Incluye la lisozima obtenida del huevo.`,
      jp: "Obligatorio (卵). Las etiquetas japonesas también pueden escribirlo 玉子 o たまご.[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio", jp: "Obligatorio" },
    more: `
<h2>Huevo en el queso</h2>
<p>La lisozima, E1105, es una enzima obtenida de la clara de huevo, y algunos quesos y vinos se elaboran con ella. Procede del huevo, así que según las normas de la UE es uno de los “productos a base de huevo” que hay que declarar.[[eu]] Es fácil pasarla por alto en un queso, porque nada más en la lista suena a huevo.</p>
`,
  },

  fish: {
    noun: "pescado",
    label: "Pescado",
    title: "Otros nombres del pescado en una etiqueta",
    description:
      "Anchoa, bacalao, salsa de pescado y más: los nombres del pescado en una lista de ingredientes, lo que exime la UE y cómo lo declaran EE. UU., la UE y Japón.",
    dek: "Las etiquetas de EE. UU. tienen que nombrar la especie, así que la palabra “pescado” puede no aparecer nunca. Estos son los nombres que hay que buscar.",
    names: [
      "Pescado, salsa de pescado, aceite de pescado, gelatina de pescado.",
      "Anchoa. Habitual en aliños y salsas.",
      "Bacalao, eglefino, abadejo, fletán, platija.",
      "Salmón, trucha.",
      "Atún, caballa, sardina, arenque.",
      "Tilapia.",
      "Surimi. Pasta de pescado moldeada, casi siempre abadejo, que se vende como imitación de cangrejo.",
      "Cola de pescado (isinglass). Gelatina de pescado usada para clarificar algunas cervezas y vinos.",
    ],
    notIt: ["Swedish Fish. Un caramelo. No lleva pescado."],
    law: {
      us: "Alérgeno principal.[[fda]] La etiqueta tiene que nombrar la especie, como “cod” (bacalao), no solo “fish”.[[fda-qa]]",
      eu: `${EU14}: “Pescado y productos a base de pescado”. Quedan exentas la gelatina de pescado usada como soporte de vitaminas o carotenoides y la gelatina de pescado o ictiocola usada para clarificar cerveza y vino.[[eu]]`,
      jp: "No es obligatorio. El salmón (さけ), la caballa (さば) y las huevas de salmón (いくら) están en la lista recomendada.[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio", jp: "Recomendado para salmón, caballa y huevas de salmón" },
  },

  shellfish: {
    noun: "crustáceos",
    label: "Crustáceos",
    title: "Otros nombres de los crustáceos en una etiqueta",
    description:
      "Camarón, gamba, cangrejo, langosta, cangrejo de río y kril: los crustáceos que una etiqueta tiene que nombrar, y por qué almejas y ostras son otro alérgeno.",
    dek: "En una etiqueta de EE. UU., “shellfish” significa crustáceos: camarones, cangrejos, langostas y sus parientes. Almejas, mejillones y ostras son otro grupo.",
    names: ["Camarón, gamba, langostino.", "Cangrejo.", "Langosta.", "Cangrejo de río.", "Kril. Crustáceos diminutos, usados en el aceite de kril."],
    law: {
      us: "Alérgeno principal como “Crustacean shellfish”.[[fda]] La etiqueta tiene que nombrar la especie, como “shrimp” o “crab”.[[fda-qa]]",
      eu: `${EU14}: “Crustáceos y productos a base de crustáceos”.[[eu]]`,
      jp: "Obligatorio para camarón (えび) y cangrejo (かに).[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio", jp: "Obligatorio para camarón y cangrejo" },
    more: `
<h2>Los moluscos son otro alérgeno</h2>
<p>Almejas, mejillones, ostras, vieiras y calamares son moluscos, no crustáceos. La UE los incluye como un alérgeno aparte. EE. UU. no los considera un alérgeno principal.[[eu]][[fda]] <a href="/es/allergens/mollusks">Estos son sus nombres.</a></p>
`,
  },

  mollusks: {
    noun: "moluscos",
    label: "Moluscos",
    title: "Otros nombres de los moluscos en una etiqueta",
    description:
      "Ostra, mejillón, almeja, calamar, pulpo y más: los nombres de los moluscos en una etiqueta. La UE exige declararlos. EE. UU. no.",
    dek: "La salsa de ostras, los calamares y los caracoles son moluscos. La UE obliga a las etiquetas a señalarlos. EE. UU. no.",
    names: [
      "Ostra, salsa de ostras. La salsa de ostras se hace con ostras.",
      "Mejillón, almeja, berberecho, bocina.",
      "Vieira.",
      "Calamar, sepia.",
      "Pulpo.",
      "Caracol, escargot, Helix aspersa. El extracto de caracol también aparece en algunos cosméticos.",
      "Oreja de mar (abulón).",
      "Molusco (mollusc, mollusk).",
    ],
    notIt: ["Seta de ostra (oyster mushroom). Una seta, llamada así por su forma."],
    law: {
      us: NOT_US,
      eu: `${EU14}: “Moluscos y productos a base de moluscos”.[[eu]]`,
      jp: "No es obligatorio. La oreja de mar (あわび) y el calamar (いか) están en la lista recomendada.[[jp]]",
    },
    status: { us: "No obligatorio", eu: "Obligatorio", jp: "Recomendado para oreja de mar y calamar" },
  },

  "tree-nuts": {
    noun: "frutos secos",
    label: "Frutos secos",
    title: "Otros nombres de los frutos secos en una etiqueta",
    description:
      "Qué frutos secos cuentan en una etiqueta en EE. UU., la UE y Japón, los nombres que parecen frutos secos y no lo son, y cuáles señala Revely.",
    dek: "“Frutos secos” significa listas distintas en cada país. Esto es lo que cubre cada una, y los nombres que suenan a fruto seco sin serlo.",
    names: [
      "Almendra.",
      "Nuez de Brasil.",
      "Anacardo.",
      "Avellana.",
      "Nuez de macadamia.",
      "Pacana.",
      "Piñón.",
      "Pistacho.",
      "Nuez.",
      "Castaña. No está en la lista de EE. UU. ni en la de la UE. Revely la señala de todos modos.",
      "Coco. No está en la lista de EE. UU. ni en la de la UE. Revely lo señala de todos modos.",
    ],
    notIt: ["Cacahuete o maní. Es una legumbre, y un alérgeno aparte.", "Nuez moscada. Una especia. No está en la lista de EE. UU. ni en la de la UE.", "Castaña de agua (water chestnut). Una verdura que crece en el agua."],
    law: {
      us: "Alérgeno principal, y la etiqueta tiene que nombrar el fruto.[[fda-qa]] La FDA enumera 12: almendra, nogal negro, nuez de Brasil, nuez de California, anacardo, avellana, nuez japonesa, macadamia, pacana, piñón, pistacho y nuez. Los demás se nombran en la lista de ingredientes, pero no en la línea “Contains”.[[fda-qa]]",
      eu: `${EU14}, con ocho “frutos de cáscara”: almendras, avellanas, nueces, anacardos, pacanas, nueces de Brasil, pistachos y nueces de macadamia.[[eu]]`,
      jp: "La nuez (くるみ) y el anacardo (カシューナッツ) son obligatorios. La almendra, la macadamia y el pistacho están en la lista recomendada.[[jp]]",
    },
    status: { us: "Obligatorio, 12 frutos", eu: "Obligatorio, 8 frutos", jp: "Obligatorio para nuez y anacardo" },
    more: `
<h2>Coco y castaña</h2>
<p>Ninguno de los dos está en la lista actual de 12 de la FDA ni en la de ocho de la UE.[[fda-qa]][[eu]] Revely los señala igualmente como frutos secos, lo que es más prudente que cualquiera de las dos listas.</p>
`,
  },

  peanuts: {
    noun: "cacahuete",
    label: "Cacahuete",
    title: "Otros nombres del cacahuete (maní) en una etiqueta",
    description:
      "Maní, cacahuate, aceite de arachis y más: los nombres del cacahuete en una etiqueta, qué pasa con su aceite y cómo lo declaran EE. UU., la UE y Japón.",
    dek: "El cacahuete es una legumbre, no un fruto seco, y tiene sus propios nombres en una etiqueta. Aquí están.",
    names: [
      "Cacahuete, mantequilla de cacahuete, harina de cacahuete, aceite de cacahuete.",
      "Groundnut. Otro nombre en inglés del cacahuete.",
      "Aceite de arachis, Arachis hypogaea. Arachis es el nombre latino, habitual en etiquetas europeas.",
    ],
    notIt: ["Frutos secos. Un alérgeno aparte.", "Nuez moscada. Una especia."],
    law: {
      us: "Alérgeno principal.[[fda]] El aceite de cacahuete muy refinado está exento del etiquetado de alérgenos, pero en la lista de ingredientes tiene que seguir llamándose “peanut oil”.[[fda-qa]]",
      eu: `${EU14}: “Cacahuetes y productos a base de cacahuetes”, sin exenciones.[[eu]]`,
      jp: "Obligatorio (落花生).[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio", jp: "Obligatorio" },
  },

  wheat: {
    noun: "trigo",
    label: "Trigo",
    title: "Otros nombres del trigo en una etiqueta",
    description:
      "Sémola, trigo duro, espelta, farina y seitán: los nombres del trigo en una etiqueta, lo que exime la UE y por qué el alforfón no es trigo.",
    dek: "El trigo aparece como sémola en la pasta, trigo duro en el pan y seitán en los sustitutos de la carne. Estos son sus nombres.",
    names: [
      "Trigo, harina de trigo, almidón de trigo, gluten de trigo.",
      "Sémola, trigo duro (semolina, durum). El trigo duro y la harina que se muele con él.",
      "Espelta. Una variedad antigua de trigo.",
      "Farina. Trigo molido, a menudo en cereales de desayuno.",
      "Seitán. Se hace con gluten de trigo.",
    ],
    notIt: ["Alforfón (buckwheat). No tiene relación con el trigo, pese al nombre. Es un alérgeno aparte."],
    law: {
      us: "Alérgeno principal.[[fda]] El centeno y la cebada no lo son.",
      eu: "Se declara dentro de los “Cereales que contengan gluten”: trigo, centeno, cebada, avena, espelta y kamut. Quedan exentos los jarabes de glucosa y las maltodextrinas a base de trigo.[[eu]]",
      jp: "Obligatorio (小麦).[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio, como cereal con gluten", jp: "Obligatorio" },
  },

  soy: {
    noun: "soja",
    label: "Soja",
    title: "Otros nombres de la soja en una etiqueta",
    description:
      "Soya, edamame, tofu, miso, tempeh y lecitina de soja: los nombres de la soja, de qué está exento el aceite de soja refinado y cómo la declaran las etiquetas.",
    dek: "La soja está en mucho más que el tofu. Estos son los nombres que usa, y los ingredientes de soja que las normas eximen.",
    names: [
      "Soja, soya, haba de soja.",
      "Lecitina de soja. Un emulsionante, habitual en chocolate y bollería.",
      "Salsa de soja.",
      "Edamame. Habas de soja tiernas.",
      "Tofu, tempeh.",
      "Miso. Pasta de soja fermentada.",
    ],
    law: {
      us: "Alérgeno principal, como en “lecithin (soy)”.[[fda]] El aceite de soja muy refinado está exento del etiquetado de alérgenos, pero sigue llamándose “soybean oil” en la lista de ingredientes.[[fda-qa]]",
      eu: `${EU14}: “Soja y productos a base de soja”. Quedan exentos el aceite de soja totalmente refinado, parte de la vitamina E (E306) y los esteroles vegetales obtenidos del aceite de soja.[[eu]]`,
      jp: "No es obligatorio. La soja (大豆) está en la lista recomendada.[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio", jp: "Recomendado" },
  },

  sesame: {
    noun: "sésamo",
    label: "Sésamo",
    title: "Otros nombres del sésamo en una etiqueta",
    description:
      "Tahini, ajonjolí, benne, gingelly y aceite de sésamo: los nombres del sésamo, cómo se declara dentro de las “especias” y cuándo pasó a ser un alérgeno principal en EE. UU.",
    dek: "El sésamo se convirtió en el noveno alérgeno principal de EE. UU. el 1 de enero de 2023. Estos son los nombres que usa.",
    names: [
      "Sésamo, ajonjolí, semillas de sésamo, aceite de sésamo.",
      "Tahini. Pasta de sésamo, la base del hummus.",
      "Benne. Un nombre antiguo de la semilla de sésamo.",
      "Gingelly. Nombre del sésamo y de su aceite en el sur de Asia.",
    ],
    law: {
      us: "Alérgeno principal desde el 1 de enero de 2023.[[fda]] Cuando el sésamo forma parte de las “especias”, la etiqueta tiene que decirlo: “spices (sesame)” o “Contains sesame”.[[fda-qa]]",
      eu: `${EU14}: “Granos de sésamo y productos a base de granos de sésamo”.[[eu]]`,
      jp: "No es obligatorio. El sésamo (ごま) está en la lista recomendada.[[jp]]",
    },
    status: { us: "Obligatorio", eu: "Obligatorio", jp: "Recomendado" },
  },

  sulfites: {
    noun: "sulfitos",
    label: "Sulfitos",
    title: "Otros nombres de los sulfitos en una etiqueta",
    description:
      "Dióxido de azufre y del E220 al E228: los nombres de los sulfitos, a partir de qué nivel hay que declararlos en EE. UU. y la UE, y qué significa “sin sulfitos”.",
    dek: "Los sulfitos evitan que se estropeen la fruta desecada, el vino y algunos alimentos procesados. En una etiqueta suelen aparecer como un número E.",
    names: [
      "Sulfito, bisulfito, metabisulfito (sulfite, sulphite).",
      "Dióxido de azufre (sulfur dioxide, sulphur dioxide). E220.",
      "E220, E221, E222, E223, E224, E226, E227, E228. El dióxido de azufre y los sulfitos de sodio, potasio y calcio.",
    ],
    notIt: [
      "“Sin sulfitos”, “sin sulfitos añadidos”. Son afirmaciones, no ingredientes. Revely no las cuenta.",
      "Sulfatos, como el sulfato de calcio. Compuestos distintos de los sulfitos.",
    ],
    law: {
      us: "No es un alérgeno principal, pero los sulfitos deben declararse a partir de 10 partes por millón, en parte por las reacciones adversas que provocan, como asma en personas sensibles.[[fda]]",
      eu: `${EU14}, por encima de 10 mg por kilo o litro, expresado como dióxido de azufre total.[[eu]]`,
      jp: NOT_JP,
    },
    status: { us: "Se declaran desde 10 ppm", eu: "Obligatorio por encima de 10 mg/kg", jp: "No obligatorio" },
  },

  mustard: {
    noun: "mostaza",
    label: "Mostaza",
    title: "Otros nombres de la mostaza en una etiqueta",
    description:
      "Mostaza, semilla de mostaza, Sinapis y Brassica: los nombres de la mostaza, por qué una etiqueta de EE. UU. puede llamarla “spice” y dónde hay que declararla.",
    dek: "La mostaza es uno de los 14 alérgenos de la UE, pero no un alérgeno principal en EE. UU., donde la etiqueta puede llamarla simplemente “spice” (especia).",
    names: ["Mostaza, semilla de mostaza, harina de mostaza.", "Sinapis. El nombre latino de la mostaza blanca.", "Brassica juncea, Brassica nigra. Mostaza parda y mostaza negra."],
    law: {
      us: "No es un alérgeno principal, así que nada obliga a destacarla en la etiqueta.[[fda]] La harina de mostaza cuenta como especia, y las especias pueden declararse juntas como “spice”.[[cfr22]]",
      eu: `${EU14}: “Mostaza y productos derivados”.[[eu]]`,
      jp: NOT_JP,
    },
    status: { us: "No obligatorio", eu: "Obligatorio", jp: "No obligatorio" },
  },

  celery: {
    noun: "apio",
    label: "Apio",
    title: "Otros nombres del apio en una etiqueta",
    description:
      "Apio, apionabo, semilla de apio y sal de apio: los nombres del apio, por qué la semilla puede esconderse en “spice” en EE. UU. y dónde hay que declararlo.",
    dek: "El apio aparece en caldos, sopas y mezclas de condimentos. La UE obliga a las etiquetas a señalarlo. EE. UU. no.",
    names: ["Apio, semilla de apio, sal de apio.", "Apionabo (celeriac). La raíz del apio.", "Apium graveolens. El nombre latino."],
    law: {
      us: "No es un alérgeno principal, así que nada obliga a destacarlo en la etiqueta.[[fda]] La semilla de apio cuenta como especia y puede declararse como “spice”. El apio en sí es un alimento, así que hay que nombrarlo.[[cfr22]]",
      eu: `${EU14}: “Apio y productos derivados”.[[eu]]`,
      jp: NOT_JP,
    },
    status: { us: "No obligatorio", eu: "Obligatorio", jp: "No obligatorio" },
  },

  lupin: {
    noun: "altramuz",
    label: "Altramuz",
    title: "Otros nombres del altramuz en una etiqueta",
    description:
      "Altramuz, lupino y harina de altramuz: qué es el altramuz en una lista de ingredientes, y por qué las etiquetas de la UE deben señalarlo y las de EE. UU. no.",
    dek: "El altramuz es una legumbre cuyas semillas y harina aparecen en algunos productos horneados. La UE obliga a las etiquetas a señalarlo.",
    names: ["Altramuz, lupino, harina de altramuz (lupin, lupine).", "Lupinus. El nombre latino."],
    law: { us: NOT_US, eu: `${EU14}: “Altramuces y productos a base de altramuces”.[[eu]]`, jp: NOT_JP },
    status: { us: "No obligatorio", eu: "Obligatorio", jp: "No obligatorio" },
  },

  buckwheat: {
    noun: "alforfón",
    label: "Alforfón",
    title: "Otros nombres del alforfón (trigo sarraceno) en una etiqueta",
    description:
      "Alforfón, trigo sarraceno, soba y Fagopyrum: qué es en una etiqueta, por qué no es trigo y por qué Japón exige declararlo y EE. UU. y la UE no.",
    dek: "El alforfón no es trigo, ni siquiera una gramínea. Japón obliga a declararlo. EE. UU. y la UE no.",
    names: [
      "Alforfón, trigo sarraceno, harina de alforfón.",
      "Soba. Fideos japoneses de alforfón, que a menudo llevan también trigo.",
      "Fagopyrum. El nombre latino.",
      "Kasha. Granos de alforfón tostados.",
    ],
    notIt: ["Trigo. No tiene relación, pese al nombre. Es un alérgeno aparte."],
    law: { us: NOT_US, eu: "No es uno de los 14 alérgenos de la UE.[[eu]]", jp: "Obligatorio (そば).[[jp]]" },
    status: { us: "No obligatorio", eu: "No obligatorio", jp: "Obligatorio" },
  },
};
