/**
 * The guides at /en/guides: what the rules say about ingredient lists, and
 * what health authorities say about what is on them.
 *
 * THE RULE FOR EVERY SENTENCE HERE
 *
 * A guide is health content with the Revely name on it, and search engines
 * hold that to a higher standard than anything else on the site, rightly. So
 * every factual claim is one of two things:
 *
 *   - a quotation or close paraphrase of a primary source listed at the foot
 *     of the guide: a regulation, a Federal Register order, a WHO fact sheet;
 *   - arithmetic on those sources (0.6 g of sodium is 1.5 g of salt).
 *
 * The WHO, EU and FDA material mostly already lives in
 * server/data/substances/evidence, where it was verified against the
 * published source on 2026-08-24. Everything else was checked against the
 * source text on 2026-09-25: 21 CFR 101.4 and 101.22, Regulation (EU)
 * 1169/2011 Articles 15, 18 and 21 and Annexes I and II, FDA's food allergies
 * page, and the Red No. 3 order (Federal Register 2025-00830).
 *
 * If a sentence cannot be traced to a numbered source below it, it is either
 * the app describing itself or it should not be here. Quotations are verbatim,
 * including the EU's British spelling inside them ("emphasised", "colour").
 * Everything else is American English: spelling, dates written "January 15,
 * 2027", and periods and commas inside the closing quotation mark.
 *
 * Voice: the onboarding voice, second person, contractions, curiosity rather
 * than fear. No em dashes in anything a reader sees.
 */

export interface GuideSource {
  org: string;
  title: string;
  /**
   * For a document with a fixed date: a regulation, an order. Left out for a
   * page that is revised in place, such as a fact sheet or the current CFR,
   * where any year would be a guess; the guide's "sources checked" date covers
   * those.
   */
  year?: number;
  url: string;
  /** Said after the title when the source is not in the page's language. */
  note?: string;
}

/** Everything about a guide that is written in one language. */
export interface GuideText {
  title: string;
  description: string;
  dek: string;
  body: string;
  inRevely: string;
  sources: GuideSource[];
}

export interface Guide {
  slug: string;
  /** The h1 and the <title>, before " · Revely". */
  title: string;
  /** The meta description and the index card. Under about 160 characters. */
  description: string;
  /** The standfirst under the h1. */
  dek: string;
  /** HTML. Cite with cite(n), where n counts from 1 into `sources`. */
  body: string;
  /** What Revely does with this, in the callout before the sources. */
  inRevely: string;
  sources: GuideSource[];
  related: string[];
  /** ISO dates, for the structured data. */
  published: string;
  modified: string;
}

/**
 * Citation markers pointing at the numbered source list, labeled for screen
 * readers in the page's language.
 */
export function citeWith(label: string): (...n: number[]) => string {
  return (...n: number[]) =>
    n
      .map((i) => `<sup class="cite"><a href="#source-${i}" aria-label="${label} ${i}">${i}</a></sup>`)
      .join("");
}

const cite = citeWith("Source");

// ---------------------------------------------------------------------------
// Sources used by more than one guide
// ---------------------------------------------------------------------------

const US_101_4: GuideSource = {
  org: "US Code of Federal Regulations",
  title: "21 CFR 101.4, Food; designation of ingredients",
  url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.4",
};

const EU_1169: GuideSource = {
  org: "European Union",
  title: "Regulation (EU) No 1169/2011 on the provision of food information to consumers",
  year: 2011,
  url: "https://eur-lex.europa.eu/eli/reg/2011/1169/oj",
};

const FDA_ALLERGIES: GuideSource = {
  org: "US Food and Drug Administration",
  title: "Food Allergies",
  url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
};

const WHO_HEALTHY_DIET: GuideSource = {
  org: "World Health Organization",
  title: "Healthy diet (fact sheet)",
  url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
};

const PUBLISHED = "2026-09-25";

// ---------------------------------------------------------------------------
// The guides
// ---------------------------------------------------------------------------

export const GUIDES: Guide[] = [
  {
    slug: "how-to-read-an-ingredient-list",
    title: "How to read an ingredient list, wherever it was printed",
    description:
      "Ingredient lists follow a few rules. Here’s what the order means, how allergens are marked in the US and the EU, and what “may contain” really tells you.",
    dek: "Every packaged food sold in the US or the EU lists its ingredients under the same few rules. Once you know them, the list tells you more than it seems to.",
    body: `
<h2>The list is in order of weight</h2>
<p>In the US, ingredients are listed “in descending order of predominance by weight.”${cite(1)} The EU rule is the same: “in descending order of weight, as recorded at the time of their use in the manufacture of the food.”${cite(2)}</p>
<p>So the first ingredient is the one there’s most of, and the last is the one there’s least of. When you’re comparing two similar products, start with the first few lines.</p>

<h2>One ingredient can be split across the list</h2>
<p>Each ingredient takes its own place in that order. A product sweetened with sugar, glucose syrup and honey lists all three separately, and each one weighs less than the three together would. So each sits further down the list than a single sugar would have.</p>
<p>It’s worth reading to the end before deciding how far down something is. <a href="/en/guides/names-for-sugar">Here are the names sugar goes by.</a></p>

<h2>Allergens are marked, and the style depends on where it’s sold</h2>
<p>A US label names the source of a major allergen in one of two ways: in parentheses after the ingredient, as in “whey (milk)” or “flour (wheat),” or in a line right after the list, such as “Contains wheat, milk, and soy.”${cite(3)}</p>
<p>An EU label does it inside the list itself. The allergen has to be “emphasised through a typeset that clearly distinguishes it from the rest of the list of ingredients, for example by means of the font, style or background colour.”${cite(2)} You’ll usually see it in bold.</p>
<p>The two don’t cover the same allergens, either. The US names 9 and the EU names 14. <a href="/en/guides/allergen-labeling-us-and-eu">Here’s how they compare.</a></p>

<h2>“May contain” is voluntary</h2>
<p>Lines like “may contain nuts” or “made in a facility that also handles nuts” are about cross-contact, not about the recipe. In the US, the FDA says these statements “are not required by law.”${cite(3)}</p>
<p>That cuts both ways. A product without one isn’t promising anything. If an allergy is serious, no warning isn’t the same as a guarantee.</p>

<h2>The language follows the shop, not the factory</h2>
<p>EU law requires the mandatory information to appear “in a language easily understood by the consumers of the Member States where a food is marketed.”${cite(2)} That’s why imported food in Europe often has a translated sticker on it.</p>
<p>Shop abroad, or in an import aisle at home, and you can easily be holding a list in a language you don’t read at all.</p>
`,
    inRevely:
      "Revely reads ingredient lists in most languages and shows the original next to a translation in yours. It marks where each ingredient sits on the list, and when a health authority has said something about one, it tells you who.",
    sources: [US_101_4, EU_1169, FDA_ALLERGIES],
    related: ["names-for-sugar", "allergen-labeling-us-and-eu", "salt-and-sodium"],
    published: PUBLISHED,
    modified: PUBLISHED,
  },

  {
    slug: "names-for-sugar",
    title: "The names for sugar on an ingredient list",
    description:
      "Sugar goes by more than a dozen names on a label. Here are the ones to look for, what WHO counts as free sugar, and how much it recommends.",
    dek: "Look for the word “sugar” and you’ll miss a lot of it. Here are the other names it goes by, and what the World Health Organization says about how much to have.",
    body: `
<h2>What WHO counts</h2>
<p>WHO’s advice is about <em>free sugars</em>, which it defines as “monosaccharides and disaccharides (e.g. sucrose, fructose, glucose) added to foods and beverages by the manufacturer, cook or consumer, and sugars naturally present in honey, syrups, fruit juices and fruit juice concentrates.”${cite(1)}</p>
<p>So honey, syrups and fruit juice concentrate all count, however natural they sound.</p>

<h2>How much</h2>
<p>WHO recommends that free sugars be “limited to less than 10% of total daily energy intake, which is equivalent to 50 g (or about 12 level teaspoons) for a person of healthy body weight consuming about 2000 calories per day.” It adds that going down to 5% or less “may provide additional health benefits.”${cite(1)}</p>

<h2>The names to look for</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">On the label</th><th scope="col">What it is</th><th scope="col">In Spanish and Chinese</th></tr></thead>
  <tbody>
    <tr><td>Sugar, sucrose</td><td>Ordinary table sugar, from cane or beet.</td><td class="tr"><span lang="es">azúcar</span><span lang="zh-Hans">白砂糖</span></td></tr>
    <tr><td>Brown sugar</td><td>Sucrose with some molasses left in or added back.</td><td class="tr"><span lang="es">azúcar moreno</span><span lang="zh-Hans">红糖</span></td></tr>
    <tr><td>Coconut sugar, palm sugar</td><td>Sugar made from palm sap.</td><td class="tr"><span lang="es">azúcar de coco</span><span lang="zh-Hans">椰糖</span></td></tr>
    <tr><td>Glucose, dextrose</td><td>A simple sugar. Dextrose is another name for it.</td><td class="tr"><span lang="es">glucosa, dextrosa</span><span lang="zh-Hans">葡萄糖</span></td></tr>
    <tr><td>Fructose</td><td>A simple sugar found in fruit and honey.</td><td class="tr"><span lang="es">fructosa</span><span lang="zh-Hans">果糖</span></td></tr>
    <tr><td>Glucose syrup, corn syrup</td><td>A syrup made by breaking down starch, often from corn or wheat.</td><td class="tr"><span lang="es">jarabe de glucosa</span><span lang="zh-Hans">葡萄糖浆</span></td></tr>
    <tr><td>High-fructose corn syrup, glucose-fructose syrup</td><td>Glucose syrup with part of its glucose turned into fructose. Europe calls it glucose-fructose syrup.</td><td class="tr"><span lang="es">jarabe de glucosa y fructosa</span><span lang="zh-Hans">果葡糖浆</span></td></tr>
    <tr><td>Invert sugar, invert syrup</td><td>Sucrose split into its two halves, glucose and fructose.</td><td class="tr"><span lang="es">azúcar invertido</span><span lang="zh-Hans">转化糖</span></td></tr>
    <tr><td>Honey</td><td>Counted by WHO as free sugar.</td><td class="tr"><span lang="es">miel</span><span lang="zh-Hans">蜂蜜</span></td></tr>
    <tr><td>Molasses, treacle</td><td>The dark syrup left over from refining sugar.</td><td class="tr"><span lang="es">melaza</span><span lang="zh-Hans">糖蜜</span></td></tr>
    <tr><td>Maple syrup, agave syrup</td><td>Syrups, which WHO counts as free sugar.</td><td class="tr"><span lang="es">jarabe de arce, sirope de agave</span><span lang="zh-Hans">枫糖浆, 龙舌兰糖浆</span></td></tr>
    <tr><td>Fruit juice concentrate</td><td>Counted by WHO as free sugar, even though it comes from fruit.</td><td class="tr"><span lang="es">zumo concentrado de frutas</span><span lang="zh-Hans">浓缩果汁</span></td></tr>
  </tbody>
</table>
</div>

<h2>Count them, not just the first line</h2>
<p>Ingredients are listed by weight, heaviest first.${cite(2, 3)} A product that uses three kinds of sugar lists each one separately, and each sits lower than all three together would. So it’s worth counting the sugars, not only checking whether sugar comes first. <a href="/en/guides/how-to-read-an-ingredient-list">More on reading the order.</a></p>
`,
    inRevely:
      "Revely recognizes these sugars in any language the label is printed in, shows where each one sits on the list, and quotes what WHO says about them.",
    sources: [WHO_HEALTHY_DIET, US_101_4, EU_1169],
    related: ["how-to-read-an-ingredient-list", "salt-and-sodium", "partially-hydrogenated-oil"],
    published: PUBLISHED,
    modified: PUBLISHED,
  },

  {
    slug: "food-color-warnings",
    title: "The six food colors that need a warning in Europe",
    description:
      "In the EU, six artificial colors must carry a warning about children’s activity and attention. Here are the six, their US names, and what happened to Red 3.",
    dek: "In the EU, six colors can only be used if the label carries a warning. Three of them are sold in the US under other names, with no warning at all.",
    body: `
<h2>The warning</h2>
<p>Under EU law, a food containing any of these colors must say it “may have an adverse effect on activity and attention in children,” next to the color’s name or E number.${cite(1)}</p>
<div class="scroll">
<table>
  <thead><tr><th scope="col">E number</th><th scope="col">Name</th><th scope="col">US name</th></tr></thead>
  <tbody>
    <tr><td class="num">E102</td><td>Tartrazine</td><td>FD&amp;C Yellow No. 5</td></tr>
    <tr><td class="num">E104</td><td>Quinoline yellow</td><td>No FD&amp;C name</td></tr>
    <tr><td class="num">E110</td><td>Sunset yellow</td><td>FD&amp;C Yellow No. 6</td></tr>
    <tr><td class="num">E122</td><td>Carmoisine</td><td>No FD&amp;C name</td></tr>
    <tr><td class="num">E124</td><td>Ponceau 4R</td><td>No FD&amp;C name</td></tr>
    <tr><td class="num">E129</td><td>Allura red</td><td>FD&amp;C Red No. 40</td></tr>
  </tbody>
</table>
</div>
<p>A warning isn’t a ban. These colors are still permitted in the EU. The label just has to say so, which makes them easy to spot on a European package. On a US package, look for the names in the last column instead, often shortened to Yellow 5, Yellow 6 or Red 40.</p>

<h2>What happened to Red 3 in the US</h2>
<p>A different color, FD&amp;C Red No. 3, also called erythrosine, is on its way out of US food. In January 2025 the FDA revoked its authorization for use in food and ingested drugs. For food, the order takes effect on January 15, 2027, which is the deadline for reformulating.${cite(2)}</p>
<p>The reason is legal as much as scientific. US law doesn’t allow a color to be authorized once it’s been found to cause cancer in animals. The FDA found that Red No. 3 “can induce cancer in male rats, through a rat specific hormonal mechanism.”${cite(2)}</p>
`,
    inRevely:
      "Revely recognizes these colors whether the label says tartrazine, E102 or Yellow 5, and shows you the warning and who requires it.",
    sources: [
      {
        org: "European Union",
        title: "Regulation (EC) No 1333/2008 on food additives, Annex V",
        year: 2008,
        url: "https://eur-lex.europa.eu/eli/reg/2008/1333/oj",
      },
      {
        org: "US Food and Drug Administration",
        title:
          "Color Additive Petition From Center for Science in the Public Interest, et al.; Request To Revoke Color Additive Listing for Use of FD&C Red No. 3 in Food and Ingested Drugs (Federal Register 2025-00830)",
        year: 2025,
        url: "https://www.federalregister.gov/documents/2025/01/16/2025-00830/color-additive-petition-from-center-for-science-in-the-public-interest-et-al-request-to-revoke-color",
      },
    ],
    related: ["how-to-read-an-ingredient-list", "partially-hydrogenated-oil", "names-for-sugar"],
    published: PUBLISHED,
    modified: PUBLISHED,
  },

  {
    slug: "partially-hydrogenated-oil",
    title: "Partially hydrogenated oil, and why it’s disappearing",
    description:
      "Partially hydrogenated oil is the main source of industrial trans fat. Here’s what WHO recommends, and what the US decided in 2015 and 2023.",
    dek: "If a label lists partially hydrogenated oil, you’re looking at the main source of the trans fat WHO wants gone from food.",
    body: `
<h2>What it is</h2>
<p>Partially hydrogenating a liquid oil makes it more solid. It also makes trans fat. In WHO’s words, “trans fat is produced industrially by the partial hydrogenation of any liquid oils.”${cite(1)}</p>

<h2>What WHO says</h2>
<p>WHO calls for industrially produced trans fat to be eliminated, and notes it “can be eliminated and replaced with healthier fats or oils.” For adults, it recommends keeping trans fat to “less than 1% of total energy intake, which is less than 2.2 g per day for a 2000-calorie diet.”${cite(1)}</p>
<p>It’s direct about why: high intake of trans fat “increases the risk of death from any cause by 34%, coronary heart disease deaths by 28%, and coronary heart disease by 21%.”${cite(1)}</p>

<h2>What the US decided</h2>
<p>In 2015 the FDA determined that partially hydrogenated oils are no longer “generally recognized as safe (GRAS) for any use in human food.” In 2023 it revoked the last remaining authorizations, for uses in margarine, shortening and bread, concluding that “these uses of PHOs may be injurious to health.” That took effect on December 22, 2023.${cite(2)}</p>

<h2>Fully hydrogenated is a different ingredient</h2>
<p>The US decisions are about <em>partially</em> hydrogenated oils. Fully hydrogenated oil is a separate ingredient, and isn’t what they cover. So read the word before “hydrogenated” carefully.</p>
`,
    inRevely:
      "Revely spots partially hydrogenated oil in any language and shows you what WHO and the FDA say about it, with the dates.",
    sources: [
      {
        org: "World Health Organization",
        title: "Trans fat (fact sheet)",
        url: "https://www.who.int/news-room/fact-sheets/detail/trans-fat",
      },
      {
        org: "US Food and Drug Administration",
        title:
          "Revocation of Uses of Partially Hydrogenated Oils in Foods (88 FR 53764), following the Final Determination Regarding Partially Hydrogenated Oils (80 FR 34650)",
        year: 2023,
        url: "https://www.federalregister.gov/documents/2023/08/09/2023-16725/revocation-of-uses-of-partially-hydrogenated-oils-in-foods",
      },
    ],
    related: ["names-for-sugar", "salt-and-sodium", "food-color-warnings"],
    published: PUBLISHED,
    modified: PUBLISHED,
  },

  {
    slug: "salt-and-sodium",
    title: "Salt or sodium: how to read either number",
    description:
      "EU labels show salt and US labels show sodium. Here’s how to turn one into the other, and what WHO recommends a day.",
    dek: "European labels give you salt. American labels give you sodium. They aren’t the same number, and the conversion is simple once you know it.",
    body: `
<h2>What WHO recommends</h2>
<p>For adults, WHO recommends “less than 2000 mg/day of sodium (equivalent to &lt; 5 g/day salt, or approximately one teaspoon).” For children aged 2 to 15, it recommends adjusting that downward based on how much energy they need.${cite(1)}</p>
<p>WHO’s concern is blood pressure: “the primary health effect associated with diets high in sodium is raised blood pressure.” It also notes that in many countries “a significant proportion of sodium in the diet comes from processed foods.”${cite(1)}</p>

<h2>Turning one into the other</h2>
<p>EU labels declare salt, and the law defines it as “the salt equivalent content calculated using the formula: salt = sodium × 2,5.”${cite(2)} US labels list sodium in milligrams.</p>
<div class="callout">
  <p><strong>Sodium × 2.5 = salt.</strong> Salt ÷ 2.5 = sodium.</p>
  <p>So a US label showing 600 mg of sodium is 1.5 g of salt, which is 30% of WHO’s 5 g. An EU label showing 1 g of salt is 400 mg of sodium.</p>
</div>

<h2>Where it comes from on the list</h2>
<p>Salt isn’t the only ingredient that brings sodium with it. Look for these too:</p>
<ul>
  <li>Salt, sea salt, rock salt, sodium chloride</li>
  <li>Soy sauce and fish sauce</li>
  <li>Monosodium glutamate, or MSG</li>
  <li>Anything with “sodium” in its name, such as sodium bicarbonate, which is baking soda</li>
</ul>
`,
    inRevely:
      "Add high blood pressure to a profile and Revely points out the sodium sources on every label you scan for that person, with WHO’s guidance beside them.",
    sources: [
      {
        org: "World Health Organization",
        title: "Salt reduction (fact sheet)",
        url: "https://www.who.int/news-room/fact-sheets/detail/salt-reduction",
      },
      EU_1169,
    ],
    related: ["names-for-sugar", "how-to-read-an-ingredient-list", "partially-hydrogenated-oil"],
    published: PUBLISHED,
    modified: PUBLISHED,
  },

  {
    slug: "allergen-labeling-us-and-eu",
    title: "Which allergens a label has to name, in the US and the EU",
    description:
      "The US requires 9 major allergens to be declared and the EU 14. Here’s the full comparison, and the two that can hide under “spice” on a US label.",
    dek: "The US and the EU both make labels name the major allergens. They don’t agree on what those are.",
    body: `
<h2>Side by side</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">Allergen</th><th scope="col">US</th><th scope="col">EU</th></tr></thead>
  <tbody>
    <tr><td>Milk</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Eggs</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Fish</td><td>Yes, with the species</td><td>Yes</td></tr>
    <tr><td>Crustaceans, such as crab, lobster and shrimp</td><td>Yes, with the species</td><td>Yes</td></tr>
    <tr><td>Tree nuts</td><td>Yes, with the type of nut</td><td>Yes: almonds, hazelnuts, walnuts, cashews, pecans, Brazil nuts, pistachios and macadamias</td></tr>
    <tr><td>Peanuts</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Wheat</td><td>Yes</td><td>As part of cereals containing gluten: wheat, rye, barley, oats, spelt and kamut</td></tr>
    <tr><td>Soy</td><td>Yes</td><td>Yes</td></tr>
    <tr><td>Sesame</td><td>Yes, since January 1, 2023</td><td>Yes</td></tr>
    <tr><td>Celery</td><td>Not required</td><td>Yes</td></tr>
    <tr><td>Mustard</td><td>Not required</td><td>Yes</td></tr>
    <tr><td>Lupin</td><td>Not required</td><td>Yes</td></tr>
    <tr><td>Molluscs, such as mussels, oysters and squid</td><td>Not required</td><td>Yes</td></tr>
    <tr><td>Sulfites</td><td>Declared at 10 ppm or more, though not a major allergen</td><td>Yes, above 10 mg/kg</td></tr>
  </tbody>
</table>
</div>
<p>The US list comes from the Food Allergen Labeling and Consumer Protection Act, which named eight foods, and the FASTER Act, which made sesame the ninth from January 1, 2023. US labels must also name the type of tree nut and the species of fish or crustacean.${cite(1)} The EU list is Annex II of its food information regulation.${cite(2)}</p>

<h2>Two that can hide under “spice” in the US</h2>
<p>Under US rules, celery seed and mustard flour both count as spices, and spices can be declared on the ingredient list simply as “spice.”${cite(3)} Neither celery nor mustard is a major allergen in the US, so when they’re used as a spice, nothing requires them to be named. On an EU label, both would have to be named and emphasized.</p>

<h2>Colors from insects, in the US</h2>
<p>The FDA also requires cochineal extract and carmine, red colors made from insects, to be declared on the label of all food and cosmetic products, because they’ve been identified as allergenic.${cite(1)}</p>

<h2>How they’re shown</h2>
<p>A US label names the allergen in parentheses after an ingredient or in a “Contains” line. An EU label emphasizes it inside the ingredient list, usually in bold. <a href="/en/guides/how-to-read-an-ingredient-list">More on reading a label.</a></p>
<p><a href="/en/allergens">Every name each allergen goes by on a label.</a></p>
`,
    inRevely:
      "Revely checks every label against the allergens you set, including all 14 of the EU’s and buckwheat, and knows their other names, like whey for milk and tahini for sesame.",
    sources: [
      FDA_ALLERGIES,
      EU_1169,
      {
        org: "US Code of Federal Regulations",
        title: "21 CFR 101.22, Foods; labeling of spices, flavorings, colorings and chemical preservatives",
        url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-B/section-101.22",
      },
    ],
    related: ["how-to-read-an-ingredient-list", "food-color-warnings", "names-for-sugar"],
    published: PUBLISHED,
    modified: PUBLISHED,
  },
];

export const GUIDES_BY_SLUG: ReadonlyMap<string, Guide> = new Map(GUIDES.map((g) => [g.slug, g]));
