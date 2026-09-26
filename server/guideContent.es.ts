import { citeWith, type GuideSource, type GuideText } from "./guideContent";

/**
 * The guides in Spanish, keyed by the English slug.
 *
 * Same rule as the English file: every claim is a quotation or close
 * paraphrase of a numbered source, or arithmetic on one. Where the source
 * publishes an official Spanish text it is quoted verbatim in “ ”: the WHO
 * fact sheets (who.int/es) and the EU regulations, whose Spanish versions on
 * EUR-Lex are equally authentic with the English. That is why the EU quotes
 * say "cacahuetes" and "zumos": it is the regulation's wording, not ours.
 * Where no Spanish text exists (the CFR, FDA), the sentence is a paraphrase
 * without quotation marks and the source is marked (en inglés).
 *
 * The WHO and EUR-Lex passages were checked on 2026-09-25. The WHO's Spanish
 * free-sugars definition contains em dashes, so only the part after them is
 * quoted. No em dashes in anything a reader sees.
 */

const cite = citeWith("Fuente");
const EN = "(en inglés)";

const US_101_4: GuideSource = {
  org: "Código de Regulaciones Federales de EE. UU.",
  title: "21 CFR 101.4, designación de los ingredientes",
  url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.4",
  note: EN,
};

const EU_1169: GuideSource = {
  org: "Unión Europea",
  title: "Reglamento (UE) n.º 1169/2011 sobre la información alimentaria facilitada al consumidor",
  year: 2011,
  url: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32011R1169",
};

const FDA_ALLERGIES: GuideSource = {
  org: "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
  title: "Food Allergies (alergias alimentarias)",
  url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
  note: EN,
};

export const GUIDES_ES: Record<string, GuideText> = {
  "how-to-read-an-ingredient-list": {
    title: "Cómo leer una lista de ingredientes, venga de donde venga",
    description:
      "Las listas de ingredientes siguen unas pocas reglas. Qué significa el orden, cómo se marcan los alérgenos en EE. UU. y en la UE, y qué dice de verdad “puede contener”.",
    dek: "Los alimentos envasados que se venden en EE. UU. o en la UE enumeran sus ingredientes con las mismas pocas reglas. Cuando las conoces, la lista te dice más de lo que parece.",
    body: `
<h2>La lista va por orden de peso</h2>
<p>En EE. UU., los ingredientes se enumeran de mayor a menor según su peso.${cite(1)} En la UE, la lista incluye todos los ingredientes “en orden decreciente de peso, según se incorporen en el momento de su uso para la fabricación del alimento”.${cite(2)}</p>
<p>Así que el primer ingrediente es el que más hay, y el último, el que menos. Si comparas dos productos parecidos, empieza por las primeras líneas.</p>

<h2>Un mismo ingrediente puede repartirse por la lista</h2>
<p>Cada ingrediente ocupa su propio lugar en ese orden. Un producto endulzado con azúcar, jarabe de glucosa y miel enumera los tres por separado, y cada uno pesa menos que los tres juntos. Por eso cada uno aparece más abajo de lo que aparecería un solo azúcar.</p>
<p>Vale la pena leer hasta el final antes de decidir lo abajo que está algo. <a href="/es/guides/names-for-sugar">Estos son los nombres del azúcar.</a></p>

<h2>Los aditivos se nombran por su función</h2>
<p>En la UE, los aditivos de categorías como colorantes, conservantes o emulgentes “deberán designarse mediante la denominación de dicha categoría, seguida por su denominación específica o, si procede, por el número E”.${cite(2)} Por eso una etiqueta europea dice primero para qué sirve el aditivo y después su nombre o su número, como en “conservante: E211”.</p>
<p><a href="/es/additives">Busca un número E de una etiqueta.</a></p>

<h2>Los alérgenos se señalan, y el estilo depende de dónde se venda</h2>
<p>Una etiqueta de EE. UU. indica el origen de un alérgeno principal de una de dos maneras: entre paréntesis después del ingrediente, como en “whey (milk)” (suero de leche (leche)) o “flour (wheat)” (harina (trigo)), o en una línea justo después de la lista, como “Contains wheat, milk, and soy.” (Contiene trigo, leche y soja).${cite(3)}</p>
<p>Una etiqueta de la UE lo hace dentro de la propia lista. El nombre del alérgeno “se destacará mediante una composición tipográfica que la diferencie claramente del resto de la lista de ingredientes, por ejemplo mediante el tipo de letra, el estilo o el color de fondo”.${cite(2)} Normalmente lo verás en negrita.</p>
<p>Tampoco cubren los mismos alérgenos. EE. UU. nombra 9 y la UE, 14. <a href="/es/guides/allergen-labeling-us-and-eu">Así se comparan.</a></p>

<h2>“Puede contener” es voluntario</h2>
<p>Frases como “puede contener frutos secos” o “elaborado en una planta que también procesa frutos secos” hablan de contacto cruzado, no de la receta. En EE. UU., la FDA indica que la ley no exige estas advertencias.${cite(3)}</p>
<p>Eso tiene dos lecturas. Un producto sin advertencia no promete nada. Si una alergia es grave, que no haya advertencia no es una garantía.</p>

<h2>El idioma lo decide la tienda, no la fábrica</h2>
<p>La ley de la UE exige que la información obligatoria figure “en una lengua que comprendan fácilmente los consumidores de los Estados miembros donde se comercializa el alimento”.${cite(2)} Por eso los alimentos importados en Europa suelen llevar pegada una etiqueta traducida.</p>
<p>Si compras en el extranjero, o en el pasillo de productos importados de tu supermercado, puedes tener en la mano una lista en un idioma que no lees en absoluto.</p>
`,
    inRevely:
      "Revely lee listas de ingredientes en la mayoría de los idiomas y muestra el original junto a una traducción al tuyo. Marca en qué lugar de la lista está cada ingrediente y, cuando una autoridad sanitaria ha dicho algo sobre uno, te dice quién.",
    sources: [US_101_4, EU_1169, FDA_ALLERGIES],
  },

  "names-for-sugar": {
    title: "Los nombres del azúcar en una lista de ingredientes",
    description:
      "El azúcar aparece con más de una docena de nombres en las etiquetas. Cuáles buscar, qué cuenta la OMS como azúcar libre y cuánto recomienda.",
    dek: "Si solo buscas la palabra “azúcar”, se te escapará buena parte. Estos son los otros nombres que usa y lo que dice la Organización Mundial de la Salud sobre cuánto tomar.",
    body: `
<h2>Qué cuenta la OMS</h2>
<p>El consejo de la OMS se refiere a los <em>azúcares libres</em>: los monosacáridos y disacáridos, como la sacarosa, la fructosa o la glucosa, que se añaden a los alimentos y bebidas, así como “los azúcares presentes de forma natural en la miel, los siropes, los zumos de frutas y los concentrados de zumos de frutas”.${cite(1)}</p>
<p>Así que la miel, los siropes y los concentrados de zumo cuentan, por muy naturales que suenen.</p>

<h2>Cuánto</h2>
<p>Según la OMS, el consumo de azúcares libres “no debería superar el 10 % de la ingesta calórica diaria total”, lo que equivale a unos 50 g, unas 12 cucharillas rasas, en una persona con un peso saludable que consuma alrededor de 2000 calorías al día. Y añade que reducirlo al 5 % o menos “puede aportar beneficios adicionales para la salud”.${cite(1)}</p>

<h2>Los nombres que hay que buscar</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">En la etiqueta</th><th scope="col">Qué es</th><th scope="col">En inglés y en chino</th></tr></thead>
  <tbody>
    <tr><td>Azúcar, sacarosa</td><td>El azúcar de mesa de siempre, de caña o de remolacha.</td><td class="tr"><span lang="en">sugar, sucrose</span><span lang="zh-Hans">白砂糖</span></td></tr>
    <tr><td>Azúcar moreno</td><td>Sacarosa con parte de la melaza conservada o añadida de nuevo.</td><td class="tr"><span lang="en">brown sugar</span><span lang="zh-Hans">红糖</span></td></tr>
    <tr><td>Azúcar de coco, azúcar de palma</td><td>Azúcar hecho con savia de palmera.</td><td class="tr"><span lang="en">coconut sugar, palm sugar</span><span lang="zh-Hans">椰糖</span></td></tr>
    <tr><td>Glucosa, dextrosa</td><td>Un azúcar simple. Dextrosa es otro nombre de la glucosa.</td><td class="tr"><span lang="en">glucose, dextrose</span><span lang="zh-Hans">葡萄糖</span></td></tr>
    <tr><td>Fructosa</td><td>Un azúcar simple presente en la fruta y la miel.</td><td class="tr"><span lang="en">fructose</span><span lang="zh-Hans">果糖</span></td></tr>
    <tr><td>Jarabe de glucosa, jarabe de maíz</td><td>Jarabe que se obtiene al descomponer almidón, a menudo de maíz o de trigo.</td><td class="tr"><span lang="en">glucose syrup, corn syrup</span><span lang="zh-Hans">葡萄糖浆</span></td></tr>
    <tr><td>Jarabe de glucosa y fructosa, jarabe de maíz alto en fructosa</td><td>Jarabe de glucosa con parte de su glucosa convertida en fructosa.</td><td class="tr"><span lang="en">high-fructose corn syrup</span><span lang="zh-Hans">果葡糖浆</span></td></tr>
    <tr><td>Azúcar invertido</td><td>Sacarosa dividida en sus dos mitades, glucosa y fructosa.</td><td class="tr"><span lang="en">invert sugar</span><span lang="zh-Hans">转化糖</span></td></tr>
    <tr><td>Miel</td><td>La OMS la cuenta como azúcar libre.</td><td class="tr"><span lang="en">honey</span><span lang="zh-Hans">蜂蜜</span></td></tr>
    <tr><td>Melaza</td><td>El jarabe oscuro que queda al refinar el azúcar.</td><td class="tr"><span lang="en">molasses</span><span lang="zh-Hans">糖蜜</span></td></tr>
    <tr><td>Jarabe de arce, sirope de agave</td><td>Siropes, que la OMS cuenta como azúcar libre.</td><td class="tr"><span lang="en">maple syrup, agave syrup</span><span lang="zh-Hans">枫糖浆、龙舌兰糖浆</span></td></tr>
    <tr><td>Zumo o jugo concentrado de frutas</td><td>La OMS lo cuenta como azúcar libre, aunque venga de la fruta.</td><td class="tr"><span lang="en">fruit juice concentrate</span><span lang="zh-Hans">浓缩果汁</span></td></tr>
  </tbody>
</table>
</div>

<h2>Cuéntalos, no mires solo la primera línea</h2>
<p>Los ingredientes se enumeran por peso, de mayor a menor.${cite(2, 3)} Un producto que usa tres tipos de azúcar enumera cada uno por separado, y cada uno queda más abajo de lo que quedarían los tres juntos. Por eso conviene contar los azúcares, no solo comprobar si el azúcar va primero. <a href="/es/guides/how-to-read-an-ingredient-list">Más sobre cómo leer el orden.</a></p>
`,
    inRevely:
      "Revely reconoce estos azúcares en cualquier idioma en que esté impresa la etiqueta, muestra en qué lugar de la lista está cada uno y cita lo que dice la OMS sobre ellos.",
    sources: [
      {
        org: "Organización Mundial de la Salud",
        title: "Alimentación saludable (nota descriptiva)",
        url: "https://www.who.int/es/news-room/fact-sheets/detail/healthy-diet",
      },
      US_101_4,
      EU_1169,
    ],
  },

  "food-color-warnings": {
    title: "Los seis colorantes alimentarios que necesitan una advertencia en Europa",
    description:
      "En la UE, seis colorantes artificiales deben llevar una advertencia sobre la actividad y la atención de los niños. Cuáles son, sus nombres en EE. UU. y qué pasó con el rojo 3.",
    dek: "En la UE, estos seis colorantes solo pueden usarse si la etiqueta lleva una advertencia. Tres de ellos se venden en EE. UU. con otros nombres y sin ninguna advertencia.",
    body: `
<h2>La advertencia</h2>
<p>Según la ley de la UE, un alimento que contenga cualquiera de estos colorantes debe indicar, junto al nombre o número E del colorante, que “puede tener efectos negativos sobre la actividad y la atención de los niños”.${cite(1)}</p>
<div class="scroll">
<table>
  <thead><tr><th scope="col">Número E</th><th scope="col">Nombre</th><th scope="col">Nombre en EE. UU.</th></tr></thead>
  <tbody>
    <tr><td class="num">E102</td><td><a href="/es/additives/e102-tartrazine">Tartracina</a></td><td>FD&amp;C Yellow No. 5</td></tr>
    <tr><td class="num">E104</td><td><a href="/es/additives/e104-quinoline-yellow">Amarillo de quinoleína</a></td><td>Sin nombre FD&amp;C</td></tr>
    <tr><td class="num">E110</td><td><a href="/es/additives/e110-sunset-yellow-fcf">Amarillo anaranjado</a></td><td>FD&amp;C Yellow No. 6</td></tr>
    <tr><td class="num">E122</td><td><a href="/es/additives/e122-carmoisine">Carmoisina</a></td><td>Sin nombre FD&amp;C</td></tr>
    <tr><td class="num">E124</td><td><a href="/es/additives/e124-ponceau-4r">Rojo cochinilla A</a></td><td>Sin nombre FD&amp;C</td></tr>
    <tr><td class="num">E129</td><td><a href="/es/additives/e129-allura-red-ac">Rojo allura AC</a></td><td>FD&amp;C Red No. 40</td></tr>
  </tbody>
</table>
</div>
<p>Una advertencia no es una prohibición. Estos colorantes siguen permitidos en la UE; la etiqueta solo tiene que avisar, y eso los hace fáciles de encontrar en un envase europeo. En un envase de EE. UU., busca los nombres de la última columna, a menudo abreviados como Yellow 5, Yellow 6 o Red 40.</p>

<h2>Qué pasó con el rojo 3 en EE. UU.</h2>
<p>Otro colorante, el FD&amp;C Red No. 3, también llamado <a href="/es/additives/e127-erythrosine">eritrosina</a>, está saliendo de los alimentos en EE. UU. En enero de 2025 la FDA revocó su autorización para alimentos y medicamentos de uso oral. Para los alimentos, la orden entra en vigor el 15 de enero de 2027, que es el plazo para cambiar la receta.${cite(2)}</p>
<p>El motivo es tanto legal como científico. La ley de EE. UU. no permite autorizar un colorante si se ha comprobado que causa cáncer en animales. La FDA concluyó que el rojo 3 puede inducir cáncer en ratas macho mediante un mecanismo hormonal propio de las ratas.${cite(2)}</p>
`,
    inRevely:
      "Revely reconoce estos colorantes tanto si la etiqueta dice tartracina como E102 o Yellow 5, y te muestra la advertencia y quién la exige.",
    sources: [
      {
        org: "Unión Europea",
        title: "Reglamento (CE) n.º 1333/2008 sobre aditivos alimentarios, anexo V",
        year: 2008,
        url: "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32008R1333",
      },
      {
        org: "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
        title:
          "Revocación del FD&C Red No. 3 como aditivo colorante en alimentos y medicamentos de uso oral (Registro Federal 2025-00830)",
        year: 2025,
        url: "https://www.federalregister.gov/documents/2025/01/16/2025-00830/color-additive-petition-from-center-for-science-in-the-public-interest-et-al-request-to-revoke-color",
        note: EN,
      },
    ],
  },

  "partially-hydrogenated-oil": {
    title: "El aceite parcialmente hidrogenado, y por qué está desapareciendo",
    description:
      "El aceite parcialmente hidrogenado es la principal fuente de grasas trans industriales. Lo que recomienda la OMS y lo que decidió EE. UU. en 2015 y 2023.",
    dek: "Si una etiqueta incluye aceite parcialmente hidrogenado, estás ante la principal fuente de las grasas trans que la OMS quiere eliminar de los alimentos.",
    body: `
<h2>Qué es</h2>
<p>Hidrogenar parcialmente un aceite líquido lo vuelve más sólido. También produce grasas trans. En palabras de la OMS, las grasas trans “se producen industrialmente mediante la hidrogenación parcial de cualquier aceite líquido”.${cite(1)}</p>

<h2>Lo que dice la OMS</h2>
<p>La OMS pide eliminar las grasas trans de producción industrial y sustituirlas por grasas o aceites más saludables. Para los adultos, recomienda “limitar el consumo de grasas trans a menos del 1% de la ingesta energética total, lo que supone menos de 2,2 g al día para una dieta de 2000 calorías”.${cite(1)}</p>
<p>Y es directa sobre el motivo: “el consumo elevado de grasas trans aumenta el riesgo de muerte por cualquier causa en un 34%, el de muerte por cardiopatía coronaria en un 28% y el de cardiopatía coronaria en un 21%”.${cite(1)}</p>

<h2>Lo que decidió EE. UU.</h2>
<p>En 2015, la FDA determinó que los aceites parcialmente hidrogenados ya no se consideran generalmente reconocidos como seguros (GRAS) para ningún uso en alimentos. En 2023 revocó las últimas autorizaciones que quedaban, para margarina, manteca vegetal y pan, al concluir que esos usos pueden ser perjudiciales para la salud. La decisión entró en vigor el 22 de diciembre de 2023.${cite(2)}</p>

<h2>Totalmente hidrogenado es otro ingrediente</h2>
<p>Las decisiones de EE. UU. se refieren a los aceites <em>parcialmente</em> hidrogenados. El aceite totalmente hidrogenado es un ingrediente distinto y no está incluido. Así que fíjate bien en la palabra que acompaña a “hidrogenado”.</p>
`,
    inRevely:
      "Revely detecta el aceite parcialmente hidrogenado en cualquier idioma y te muestra lo que dicen la OMS y la FDA, con las fechas.",
    sources: [
      {
        org: "Organización Mundial de la Salud",
        title: "Grasas trans (nota descriptiva)",
        url: "https://www.who.int/es/news-room/fact-sheets/detail/trans-fat",
      },
      {
        org: "Administración de Alimentos y Medicamentos de EE. UU. (FDA)",
        title:
          "Revocación de los usos de los aceites parcialmente hidrogenados en alimentos (88 FR 53764), tras la determinación final sobre estos aceites (80 FR 34650)",
        year: 2023,
        url: "https://www.federalregister.gov/documents/2023/08/09/2023-16725/revocation-of-uses-of-partially-hydrogenated-oils-in-foods",
        note: EN,
      },
    ],
  },

  "salt-and-sodium": {
    title: "¿Sal o sodio? Cómo leer cualquiera de los dos",
    description:
      "Las etiquetas de la UE indican la sal y las de EE. UU., el sodio. Cómo pasar de uno a otro y cuánto recomienda la OMS al día.",
    dek: "Las etiquetas europeas te dan la sal. Las estadounidenses te dan el sodio. No son la misma cifra, y la conversión es sencilla cuando la conoces.",
    body: `
<h2>Lo que recomienda la OMS</h2>
<p>Para los adultos, la OMS recomienda “menos de 2000 mg/día de sodio (el equivalente a menos de 5 g/día de sal, aproximadamente una cucharadita)”. Para los niños, recomienda reducir esa cifra según la energía que necesiten.${cite(1)}</p>
<p>A la OMS le preocupa la presión arterial: el principal efecto sobre la salud de las dietas altas en sodio “es la hipertensión arterial”. También señala que en muchos países “una proporción importante del sodio en la dieta proviene de alimentos procesados”.${cite(1)}</p>

<h2>Cómo pasar de uno a otro</h2>
<p>Las etiquetas de la UE declaran la sal, y la ley la define como “el contenido equivalente en sal calculado mediante la fórmula: sal = sodio × 2,5”.${cite(2)} Las etiquetas de EE. UU. indican el sodio en miligramos.</p>
<div class="callout">
  <p><strong>Sodio × 2,5 = sal.</strong> Sal ÷ 2,5 = sodio.</p>
  <p>Así, una etiqueta de EE. UU. con 600 mg de sodio equivale a 1,5 g de sal, el 30 % de los 5 g de la OMS. Una etiqueta de la UE con 1 g de sal equivale a 400 mg de sodio.</p>
</div>

<h2>De dónde viene en la lista</h2>
<p>La sal no es el único ingrediente que aporta sodio. Busca también:</p>
<ul>
  <li>Sal, sal marina, sal gema, cloruro de sodio</li>
  <li>Salsa de soja y salsa de pescado</li>
  <li>Glutamato monosódico</li>
  <li>Cualquier ingrediente con “sodio” o “sódico” en el nombre, como el bicarbonato de sodio</li>
</ul>
`,
    inRevely:
      "Añade la hipertensión a un perfil y Revely señalará las fuentes de sodio en cada etiqueta que escanees para esa persona, con la recomendación de la OMS al lado.",
    sources: [
      {
        org: "Organización Mundial de la Salud",
        title: "Reducción de la ingesta de sodio (nota descriptiva)",
        url: "https://www.who.int/es/news-room/fact-sheets/detail/salt-reduction",
      },
      EU_1169,
    ],
  },

  "allergen-labeling-us-and-eu": {
    title: "Qué alérgenos tiene que nombrar una etiqueta en EE. UU. y en la UE",
    description:
      "EE. UU. exige declarar 9 alérgenos principales y la UE, 14. La comparación completa, y los dos que pueden esconderse bajo “spice” en una etiqueta de EE. UU.",
    dek: "EE. UU. y la UE obligan a las etiquetas a nombrar los alérgenos principales. No se ponen de acuerdo en cuáles son.",
    body: `
<h2>Lado a lado</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">Alérgeno</th><th scope="col">EE. UU.</th><th scope="col">UE</th></tr></thead>
  <tbody>
    <tr><td><a href="/es/allergens/milk">Leche</a></td><td>Sí</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/eggs">Huevos</a></td><td>Sí</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/fish">Pescado</a></td><td>Sí, con la especie</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/shellfish">Crustáceos</a>, como cangrejo, langosta y camarón</td><td>Sí, con la especie</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/tree-nuts">Frutos de cáscara</a></td><td>Sí, con el tipo de fruto</td><td>Sí: almendras, avellanas, nueces, anacardos, pacanas, nueces de Brasil, pistachos y nueces de macadamia</td></tr>
    <tr><td><a href="/es/allergens/peanuts">Cacahuetes o maní</a></td><td>Sí</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/wheat">Trigo</a></td><td>Sí</td><td>Dentro de los cereales que contienen gluten: trigo, centeno, cebada, avena, espelta y kamut</td></tr>
    <tr><td><a href="/es/allergens/soy">Soja</a></td><td>Sí</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/sesame">Sésamo</a></td><td>Sí, desde el 1 de enero de 2023</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/celery">Apio</a></td><td>No obligatorio</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/mustard">Mostaza</a></td><td>No obligatorio</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/lupin">Altramuces</a></td><td>No obligatorio</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/mollusks">Moluscos</a>, como mejillones, ostras y calamares</td><td>No obligatorio</td><td>Sí</td></tr>
    <tr><td><a href="/es/allergens/sulfites">Sulfitos</a></td><td>Se declaran a partir de 10 ppm, aunque no son un alérgeno principal</td><td>Sí, por encima de 10 mg/kg</td></tr>
  </tbody>
</table>
</div>
<p>La lista de EE. UU. procede de la Ley de Etiquetado de Alérgenos Alimentarios y Protección al Consumidor (FALCPA), que nombró ocho alimentos, y de la Ley FASTER, que añadió el sésamo como noveno a partir del 1 de enero de 2023. Las etiquetas de EE. UU. también deben indicar el tipo de fruto de cáscara y la especie de pescado o crustáceo.${cite(1)} La lista de la UE es el anexo II de su reglamento sobre información alimentaria.${cite(2)}</p>

<h2>Dos que pueden esconderse bajo “spice” en EE. UU.</h2>
<p>Según las normas de EE. UU., la semilla de apio y la harina de mostaza cuentan como especias, y las especias pueden declararse en la lista de ingredientes simplemente como “spice”.${cite(3)} Ni el apio ni la mostaza son alérgenos principales en EE. UU., así que cuando se usan como especia, nada obliga a nombrarlos. En una etiqueta de la UE, ambos tendrían que nombrarse y destacarse.</p>

<h2>Colorantes de insectos, en EE. UU.</h2>
<p>La FDA también exige que el extracto de cochinilla y el carmín, colorantes rojos obtenidos de insectos, se declaren en la etiqueta de todos los alimentos y cosméticos, porque se ha comprobado que son alergénicos.${cite(1)}</p>

<h2>Cómo se muestran</h2>
<p>Una etiqueta de EE. UU. nombra el alérgeno entre paréntesis después de un ingrediente o en una línea “Contains”. Una etiqueta de la UE lo destaca dentro de la lista de ingredientes, normalmente en negrita. <a href="/es/guides/how-to-read-an-ingredient-list">Más sobre cómo leer una etiqueta.</a></p>
<p><a href="/es/allergens">Todos los nombres de cada alérgeno en una etiqueta.</a></p>
`,
    inRevely:
      "Revely comprueba cada etiqueta con los alérgenos que elijas, incluidos los 14 de la UE y el trigo sarraceno, y conoce sus otros nombres, como suero de leche para la leche o tahini para el sésamo.",
    sources: [
      FDA_ALLERGIES,
      EU_1169,
      {
        org: "Código de Regulaciones Federales de EE. UU.",
        title: "21 CFR 101.22, etiquetado de especias, aromas, colorantes y conservantes químicos",
        url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-B/section-101.22",
        note: EN,
      },
    ],
  },
};
