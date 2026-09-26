import type { MajorAllergen } from "./services/allergenMatcher";
import type { GuideSource } from "./guideContent";

/**
 * The allergen pages at /en/allergens: one per allergen the app checks for.
 *
 * SAME RULE AS THE GUIDES (see guideContent.ts). Every factual claim is a
 * quotation or close paraphrase of a source, cited with a [[key]] marker that
 * the renderer numbers per page. The sources, all checked on 2026-09-26:
 *
 *   fda-qa   FDA, Questions and Answers Regarding Food Allergens (Edition 5),
 *            January 2025. Read from the PDF: milk and egg species (C.1 to
 *            C.4), species and nut type (C.5), the 12-nut Table 1 and C.8,
 *            "spices (sesame)", highly refined oils (B.8, D.9), and proteins
 *            made by other technologies (B.16).
 *   fda      FDA's Food Allergies page: the two ways to declare, sulfites at
 *            10 ppm, cochineal and carmine, milk and recalls.
 *   eu       Regulation (EU) 1169/2011, Annex II and Article 21.
 *   jp       Japan's Consumer Affairs Agency, アレルギー表示について, April
 *            2026: nine mandatory items, twenty recommended, alternative
 *            spellings for egg, and the ban on bare "may contain" wording.
 *   cfr22    21 CFR 101.22: the definition of spice, and "spice" as a
 *            collective name.
 *
 * THE NAMES LIST IS THE MATCHER. Every term in `names` contains a keyword the
 * app matches for that allergen, and every keyword appears in some term; see
 * eval/allergen-pages.check.ts. A name the app does not catch is not listed
 * here, even when it is true, because the "In Revely" box
 * promises the app flags these. Gaps are fixed in allergenMatcher.ts first.
 *
 * American English. No em dashes in anything a reader sees.
 */

export interface AllergenPage {
  id: MajorAllergen;
  slug: string;
  /** As it reads in a sentence: "milk", "tree nuts". */
  noun: string;
  /** As it reads in a heading or a table: "Milk", "Tree nuts". */
  label: string;
  title: string;
  description: string;
  dek: string;
  names: { term: string; note?: string }[];
  notIt?: { term: string; note: string }[];
  /** How labels print it in other languages. Short: the declaration words. */
  elsewhere: { es: string; zh: string; ja?: string };
  law: { us: string; eu: string; jp: string };
  /** One or two words per market, for the index table. */
  status: { us: string; eu: string; jp: string };
  /** Extra sections, each starting with an h2. */
  more?: string;
  related: string[];
}

export const ALLERGEN_SOURCES: Record<string, GuideSource> = {
  "fda-qa": {
    org: "US Food and Drug Administration",
    title:
      "Questions and Answers Regarding Food Allergens, Including the Food Allergen Labeling Requirements of the Federal Food, Drug, and Cosmetic Act (Edition 5)",
    year: 2025,
    url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-questions-and-answers-regarding-food-allergens-including-food-allergen-labeling",
  },
  fda: {
    org: "US Food and Drug Administration",
    title: "Food Allergies",
    url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
  },
  eu: {
    org: "European Union",
    title: "Regulation (EU) No 1169/2011 on the provision of food information to consumers, Annex II",
    year: 2011,
    url: "https://eur-lex.europa.eu/eli/reg/2011/1169/oj",
  },
  jp: {
    org: "Consumer Affairs Agency, Japan",
    title: "アレルギー表示について (Allergen labeling), April 2026",
    year: 2026,
    url: "https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/assets/food_labeling_cms204_260401_01.pdf",
    note: "(in Japanese)",
  },
  cfr22: {
    org: "US Code of Federal Regulations",
    title: "21 CFR 101.22, Foods; labeling of spices, flavorings, colorings and chemical preservatives",
    url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-B/section-101.22",
  },
};

const NOT_US = "Not a major food allergen, so nothing requires it to stand out on the label.[[fda]]";
const NOT_EU = "Not one of the EU’s 14 allergens.[[eu]]";
const NOT_JP = "Not on Japan’s mandatory or recommended list.[[jp]]";

export const ALLERGEN_PAGES: AllergenPage[] = [
  {
    id: "milk",
    slug: "milk",
    noun: "milk",
    label: "Milk",
    title: "Other names for milk on a food label",
    description:
      "Whey, casein, ghee and more: the names milk goes by on an ingredient list, the look-alikes that aren’t dairy, and how the US, EU and Japan require it to be declared.",
    dek: "Milk doesn’t always say “milk.” Here are the names it goes by, the ones that only sound like dairy, and what labels are required to tell you.",
    names: [
      { term: "Milk, milk powder, milkfat, buttermilk" },
      { term: "Whey, whey protein", note: "The liquid left when milk is made into cheese. Common in protein bars and snacks." },
      { term: "Casein, caseinate", note: "The main protein in milk. Sodium caseinate shows up in coffee creamers." },
      { term: "Lactose", note: "The sugar in milk." },
      { term: "Butter, ghee", note: "Ghee is clarified butter." },
      { term: "Cream, sour cream" },
      { term: "Cheese, curd", note: "As in cheese curds." },
      { term: "Yogurt" },
      { term: "Dairy" },
    ],
    notIt: [
      { term: "Cocoa butter, shea butter", note: "Fats from plants." },
      { term: "Peanut butter and other nut or seed butters", note: "Named for their texture. Check them for peanuts and tree nuts instead." },
      { term: "Coconut milk, coconut cream", note: "Made from coconut." },
      { term: "Soy, oat, almond and rice milk", note: "Plant drinks. Check them for their own allergens." },
      { term: "Cream of tartar", note: "A baking powder ingredient that comes from winemaking." },
      { term: "Bean curd", note: "Another name for tofu, which is soy." },
      { term: "Butternut squash", note: "A vegetable." },
    ],
    elsewhere: { es: "leche, lácteo, suero de leche", zh: "牛奶、乳、乳成分", ja: "乳、乳成分" },
    law: {
      us: "A major food allergen.[[fda]] The FDA counts milk from cows, goats, sheep and other ruminants, and milk from an animal other than a cow should name it, as in “whey (goat milk).”[[fda-qa]]",
      eu: "One of the 14 allergens: “Milk and products thereof (including lactose).” Whey used to make spirits, and lactitol, are exempt.[[eu]]",
      jp: "Mandatory (乳).[[jp]]",
    },
    status: { us: "Required", eu: "Required", jp: "Required" },
    more: `
<h2>Milk proteins made without cows still count</h2>
<p>Under FDA guidance, a protein from a major food allergen is labeled as that allergen even when it’s made another way, for example by fermentation. So a milk protein made without a cow still has to be declared as milk.[[fda-qa]]</p>

<h2>The most common undeclared allergen</h2>
<p>The FDA says milk is the most common cause of recalls for undeclared allergens in the US. It has singled out dark chocolate as a higher-risk product for people allergic to milk.[[fda]]</p>
`,
    related: ["eggs", "soy", "tree-nuts"],
  },

  {
    id: "egg",
    slug: "eggs",
    noun: "eggs",
    label: "Eggs",
    title: "Other names for eggs on a food label",
    description:
      "Albumin, ovalbumin, lysozyme (E1105) and more: the names egg goes by on an ingredient list, and how the US, EU and Japan require it to be declared.",
    dek: "Egg hides in sauces, pasta, baked goods and even some cheeses. Here are the names to look for.",
    names: [
      { term: "Egg, egg white, egg yolk, dried egg" },
      { term: "Albumin, albumen", note: "Egg white protein." },
      { term: "Ovalbumin", note: "The main protein in egg white." },
      { term: "Mayonnaise", note: "Made with egg yolk." },
      { term: "Meringue", note: "Whipped egg white." },
      { term: "Lysozyme, E1105", note: "An enzyme made from egg white, used in some cheeses and wines." },
    ],
    notIt: [
      { term: "Eggplant", note: "A vegetable." },
      { term: "“Egg-free,” “eggless”", note: "Claims, not ingredients. Revely doesn’t count them." },
    ],
    elsewhere: { es: "huevo, lisozima", zh: "蛋、鸡蛋、溶菌酶", ja: "卵、たまご、玉子" },
    law: {
      us: "A major food allergen.[[fda]] The FDA counts eggs from chickens, ducks, geese, quail and other fowl, and eggs from another bird should name it, as in “ovalbumin (duck egg).”[[fda-qa]]",
      eu: "One of the 14 allergens: “Eggs and products thereof.”[[eu]] That includes lysozyme made from egg.",
      jp: "Mandatory (卵). Japanese labels may write it 玉子 or たまご instead.[[jp]]",
    },
    status: { us: "Required", eu: "Required", jp: "Required" },
    more: `
<h2>Egg in cheese</h2>
<p>Lysozyme, E1105, is an enzyme made from egg white, and some cheeses and wines are made with it. It comes from egg, so under EU rules it’s one of the “products thereof” that has to be declared.[[eu]] It’s easy to miss on a cheese label, because nothing else on the list sounds like egg.</p>
`,
    related: ["milk", "wheat", "soy"],
  },

  {
    id: "fish",
    slug: "fish",
    noun: "fish",
    label: "Fish",
    title: "Other names for fish on a food label",
    description:
      "Anchovy, cod, fish sauce and more: the names fish goes by on an ingredient list, what the EU exempts, and how labels in the US, EU and Japan declare it.",
    dek: "US labels have to name the kind of fish, so the word “fish” may never appear. Here are the names to look for.",
    names: [
      { term: "Fish, fish sauce, fish oil, fish gelatin" },
      { term: "Anchovy", note: "Common in dressings and sauces." },
      { term: "Cod, haddock, pollock, halibut, flounder" },
      { term: "Salmon, trout" },
      { term: "Tuna, mackerel, sardine, herring" },
      { term: "Tilapia" },
      { term: "Surimi", note: "Shaped fish paste, usually pollock, sold as imitation crab." },
      { term: "Isinglass", note: "Gelatin from fish, used to clear some beers and wines." },
    ],
    notIt: [{ term: "Swedish Fish", note: "A candy. There’s no fish in it." }],
    elsewhere: { es: "pescado", zh: "鱼、魚", ja: "さけ、さば、いくら" },
    law: {
      us: "A major food allergen.[[fda]] The label has to name the species, such as “cod,” not just “fish.”[[fda-qa]]",
      eu: "One of the 14 allergens: “Fish and products thereof.” Fish gelatin used to carry vitamins or carotenoids, and fish gelatin or isinglass used to clear beer and wine, are exempt.[[eu]]",
      jp: "Not mandatory. Salmon (さけ), mackerel (さば) and salmon roe (いくら) are on the recommended list.[[jp]]",
    },
    status: { us: "Required", eu: "Required", jp: "Recommended for salmon, mackerel and salmon roe" },
    related: ["shellfish", "mollusks", "eggs"],
  },

  {
    id: "shellfish",
    slug: "shellfish",
    noun: "crustacean shellfish",
    label: "Crustacean shellfish",
    title: "Other names for shellfish on a food label",
    description:
      "Shrimp, prawn, crab, lobster, crawfish and krill: the crustaceans a label has to name, and why clams and oysters are a separate allergen.",
    dek: "On a US label, “shellfish” means crustaceans: shrimp, crab, lobster and their relatives. Clams, mussels and oysters are a different group.",
    names: [
      { term: "Shrimp, prawn" },
      { term: "Crab" },
      { term: "Lobster" },
      { term: "Crawfish, crayfish" },
      { term: "Krill", note: "Tiny crustaceans, used in krill oil." },
    ],
    elsewhere: { es: "camarón, gamba, cangrejo, marisco", zh: "虾、蝦、蟹、甲壳类", ja: "えび、かに" },
    law: {
      us: "A major food allergen as “Crustacean shellfish.”[[fda]] The label has to name the species, such as “shrimp” or “crab.”[[fda-qa]]",
      eu: "One of the 14 allergens: “Crustaceans and products thereof.”[[eu]]",
      jp: "Mandatory for shrimp (えび) and crab (かに).[[jp]]",
    },
    status: { us: "Required", eu: "Required", jp: "Required for shrimp and crab" },
    more: `
<h2>Mollusks are a separate allergen</h2>
<p>Clams, mussels, oysters, scallops and squid are mollusks, not crustaceans. The EU lists them as a separate allergen. The US doesn’t list them as a major food allergen at all.[[eu]][[fda]] <a href="/en/allergens/mollusks">Here are their names.</a></p>
`,
    related: ["mollusks", "fish", "eggs"],
  },

  {
    id: "molluscs",
    slug: "mollusks",
    noun: "mollusks",
    label: "Mollusks",
    title: "Other names for mollusks on a food label",
    description:
      "Oyster, mussel, clam, squid, octopus and more: the names mollusks go by on a label. The EU requires them to be declared. The US doesn’t.",
    dek: "Oyster sauce, calamari and escargot are all mollusks. The EU makes labels call them out. The US doesn’t.",
    names: [
      { term: "Oyster, oyster sauce", note: "Oyster sauce is made from oysters." },
      { term: "Mussel, clam, cockle, whelk" },
      { term: "Scallop" },
      { term: "Squid, calamari, cuttlefish" },
      { term: "Octopus" },
      { term: "Snail, escargot, Helix aspersa", note: "Snail extract also appears in some skin care." },
      { term: "Abalone" },
      { term: "Mollusc, mollusk" },
    ],
    notIt: [{ term: "Oyster mushroom", note: "A mushroom, named for its shape." }],
    elsewhere: { es: "molusco, ostra, calamar", zh: "贝类、牡蛎、蚵", ja: "あわび、いか" },
    law: {
      us: NOT_US,
      eu: "One of the 14 allergens: “Molluscs and products thereof.”[[eu]]",
      jp: "Not mandatory. Abalone (あわび) and squid (いか) are on the recommended list.[[jp]]",
    },
    status: { us: "Not required", eu: "Required", jp: "Recommended for abalone and squid" },
    related: ["shellfish", "fish", "sulfites"],
  },

  {
    id: "tree_nuts",
    slug: "tree-nuts",
    noun: "tree nuts",
    label: "Tree nuts",
    title: "Other names for tree nuts on a food label",
    description:
      "Which nuts count as tree nuts on a label in the US, the EU and Japan, the look-alikes that don’t, and what Revely flags.",
    dek: "“Tree nuts” means different lists in different countries. Here’s what each one covers, and the nut-sounding names that aren’t nuts at all.",
    names: [
      { term: "Almond" },
      { term: "Brazil nut" },
      { term: "Cashew" },
      { term: "Hazelnut, filbert" },
      { term: "Macadamia" },
      { term: "Pecan" },
      { term: "Pine nut" },
      { term: "Pistachio" },
      { term: "Walnut" },
      { term: "Chestnut", note: "Not on the US or EU list. Revely flags it anyway." },
      { term: "Coconut", note: "Not on the US or EU list. Revely flags it anyway." },
    ],
    notIt: [
      { term: "Peanut", note: "A legume, and a separate allergen." },
      { term: "Nutmeg", note: "A spice. Not on the US or EU list." },
      { term: "Water chestnut", note: "A vegetable that grows in water." },
    ],
    elsewhere: { es: "frutos de cáscara, nuez, almendra, avellana, anacardo", zh: "坚果、堅果、核桃、腰果", ja: "くるみ、カシューナッツ" },
    law: {
      us: "A major food allergen, and the label has to name the nut.[[fda-qa]] The FDA lists 12: almond, black walnut, Brazil nut, California walnut, cashew, filbert or hazelnut, heartnut, macadamia, pecan, pine nut, pistachio and walnut. Other nuts are named in the ingredient list but not in the “Contains” line.[[fda-qa]]",
      eu: "One of the 14 allergens, covering eight nuts: almonds, hazelnuts, walnuts, cashews, pecans, Brazil nuts, pistachios and macadamias.[[eu]]",
      jp: "Walnut (くるみ) and cashew (カシューナッツ) are mandatory. Almond, macadamia and pistachio are on the recommended list.[[jp]]",
    },
    status: { us: "Required, 12 nuts", eu: "Required, 8 nuts", jp: "Required for walnut and cashew" },
    more: `
<h2>Coconut and chestnut</h2>
<p>Neither is on the FDA’s current list of 12 or the EU’s list of eight.[[fda-qa]][[eu]] Revely flags both as tree nuts anyway, which is more cautious than either list.</p>
`,
    related: ["peanuts", "sesame", "milk"],
  },

  {
    id: "peanut",
    slug: "peanuts",
    noun: "peanuts",
    label: "Peanuts",
    title: "Other names for peanuts on a food label",
    description:
      "Groundnut, arachis oil and more: the names peanuts go by on a label, what happens to peanut oil, and how the US, EU and Japan declare them.",
    dek: "Peanuts are legumes, not nuts, and they have their own names on a label. Here they are.",
    names: [
      { term: "Peanut, peanut butter, peanut flour, peanut oil" },
      { term: "Groundnut", note: "Another name for peanut." },
      { term: "Arachis oil, Arachis hypogaea", note: "Arachis is the Latin name, common on European labels." },
    ],
    notIt: [
      { term: "Tree nuts", note: "A separate allergen." },
      { term: "Nutmeg", note: "A spice." },
    ],
    elsewhere: { es: "cacahuete, cacahuate, maní", zh: "花生、落花生", ja: "落花生、ピーナッツ" },
    law: {
      us: "A major food allergen.[[fda]] Highly refined peanut oil is exempt from allergen labeling, but it still has to be called “peanut oil” in the ingredient list.[[fda-qa]]",
      eu: "One of the 14 allergens: “Peanuts and products thereof,” with no exemptions.[[eu]]",
      jp: "Mandatory (落花生).[[jp]]",
    },
    status: { us: "Required", eu: "Required", jp: "Required" },
    related: ["tree-nuts", "soy", "sesame"],
  },

  {
    id: "wheat",
    slug: "wheat",
    noun: "wheat",
    label: "Wheat",
    title: "Other names for wheat on a food label",
    description:
      "Semolina, durum, spelt, farina and seitan: the names wheat goes by on a label, what the EU exempts, and why buckwheat isn’t wheat.",
    dek: "Wheat turns up as semolina in pasta, durum in bread and seitan in meat alternatives. Here are its names.",
    names: [
      { term: "Wheat, wheat flour, wheat starch, wheat gluten" },
      { term: "Semolina, durum", note: "Durum wheat, and the flour milled from it." },
      { term: "Spelt", note: "An old variety of wheat." },
      { term: "Farina", note: "Milled wheat, often in breakfast cereal." },
      { term: "Seitan", note: "Made from wheat gluten." },
    ],
    notIt: [{ term: "Buckwheat", note: "Not related to wheat, despite the name. It’s a separate allergen." }],
    elsewhere: { es: "trigo", zh: "小麦、小麥", ja: "小麦" },
    law: {
      us: "A major food allergen.[[fda]] Rye and barley aren’t.",
      eu: "Declared as “Cereals containing gluten”: wheat, rye, barley, oats, spelt and kamut. Glucose syrup and maltodextrin made from wheat are exempt.[[eu]]",
      jp: "Mandatory (小麦).[[jp]]",
    },
    status: { us: "Required", eu: "Required, as a gluten cereal", jp: "Required" },
    related: ["buckwheat", "eggs", "soy"],
  },

  {
    id: "soy",
    slug: "soy",
    noun: "soy",
    label: "Soy",
    title: "Other names for soy on a food label",
    description:
      "Soya, soybean, edamame, tofu, miso, tempeh and soy lecithin: the names soy goes by, what refined soybean oil is exempt from, and how labels declare it.",
    dek: "Soy is in far more than tofu. Here are the names it goes by, and the soy ingredients the rules exempt.",
    names: [
      { term: "Soy, soya, soybean" },
      { term: "Soy lecithin", note: "An emulsifier, common in chocolate and baked goods." },
      { term: "Soy sauce" },
      { term: "Edamame", note: "Young soybeans." },
      { term: "Tofu, tempeh" },
      { term: "Miso", note: "Fermented soybean paste." },
    ],
    elsewhere: { es: "soja, soya", zh: "大豆、黄豆", ja: "大豆" },
    law: {
      us: "A major food allergen, as in “lecithin (soy).”[[fda]] Highly refined soybean oil is exempt from allergen labeling, but it’s still called “soybean oil” in the ingredient list.[[fda-qa]]",
      eu: "One of the 14 allergens. Fully refined soybean oil, some vitamin E (E306) and plant sterols made from soybean oil are exempt.[[eu]]",
      jp: "Not mandatory. Soybean (大豆) is on the recommended list.[[jp]]",
    },
    status: { us: "Required", eu: "Required", jp: "Recommended" },
    related: ["peanuts", "wheat", "milk"],
  },

  {
    id: "sesame",
    slug: "sesame",
    noun: "sesame",
    label: "Sesame",
    title: "Other names for sesame on a food label",
    description:
      "Tahini, benne, gingelly and sesame oil: the names sesame goes by, how it’s declared inside “spices,” and when it became a US major allergen.",
    dek: "Sesame became the ninth US major food allergen on January 1, 2023. Here are the names it goes by.",
    names: [
      { term: "Sesame, sesame seed, sesame oil" },
      { term: "Tahini", note: "Sesame paste, the base of hummus." },
      { term: "Benne", note: "An old name for sesame seed." },
      { term: "Gingelly", note: "A name for sesame, and sesame oil, in South Asia." },
    ],
    elsewhere: { es: "sésamo, ajonjolí", zh: "芝麻", ja: "ごま" },
    law: {
      us: "A major food allergen since January 1, 2023.[[fda]] When sesame is part of “spices,” the label has to say so: “spices (sesame)” or “Contains sesame.”[[fda-qa]]",
      eu: "One of the 14 allergens: “Sesame seeds and products thereof.”[[eu]]",
      jp: "Not mandatory. Sesame (ごま) is on the recommended list.[[jp]]",
    },
    status: { us: "Required", eu: "Required", jp: "Recommended" },
    related: ["tree-nuts", "peanuts", "mustard"],
  },

  {
    id: "sulphites",
    slug: "sulfites",
    noun: "sulfites",
    label: "Sulfites",
    title: "Other names for sulfites on a food label",
    description:
      "Sulfur dioxide and E220 to E228: the names sulfites go by, the level at which they must be declared in the US and EU, and what sulfite-free claims mean.",
    dek: "Sulfites keep dried fruit, wine and some processed foods from spoiling. On a label they often appear as an E number.",
    names: [
      { term: "Sulfite, sulphite, bisulfite, metabisulfite" },
      { term: "Sulfur dioxide, sulphur dioxide", note: "E220." },
      { term: "E220, E221, E222, E223, E224, E226, E227, E228", note: "Sulfur dioxide and the sodium, potassium and calcium sulfites." },
    ],
    notIt: [
      { term: "“Sulfite-free,” “no added sulfites”", note: "Claims, not ingredients. Revely doesn’t count them." },
      { term: "Sulfates, such as calcium sulfate", note: "Different compounds from sulfites." },
    ],
    elsewhere: { es: "sulfitos, dióxido de azufre", zh: "亚硫酸盐、二氧化硫", ja: "亜硫酸塩" },
    law: {
      us: "Not a major food allergen, but sulfites must be declared at 10 parts per million or more, “due in part to adverse reactions to them, such as asthma in sensitive individuals.”[[fda]]",
      eu: "One of the 14 allergens, above 10 mg per kilogram or liter, measured as total sulfur dioxide.[[eu]]",
      jp: NOT_JP,
    },
    status: { us: "Declared at 10 ppm or more", eu: "Required above 10 mg/kg", jp: "Not required" },
    related: ["mollusks", "mustard", "celery"],
  },

  {
    id: "mustard",
    slug: "mustard",
    noun: "mustard",
    label: "Mustard",
    title: "Other names for mustard on a food label",
    description:
      "Mustard, mustard seed, Sinapis and Brassica: the names mustard goes by, why a US label can call it “spice,” and where it must be declared.",
    dek: "Mustard is one of the EU’s 14 allergens but not a US major allergen, and on a US label it can be listed simply as “spice.”",
    names: [
      { term: "Mustard, mustard seed, mustard flour" },
      { term: "Sinapis", note: "The Latin name for white mustard." },
      { term: "Brassica juncea, Brassica nigra", note: "Brown and black mustard." },
    ],
    elsewhere: { es: "mostaza", zh: "芥末", ja: "からし、マスタード" },
    law: {
      us: `${NOT_US} Mustard flour counts as a spice, and spices can be listed together as “spice.”[[cfr22]]`,
      eu: "One of the 14 allergens: “Mustard and products thereof.”[[eu]]",
      jp: NOT_JP,
    },
    status: { us: "Not required", eu: "Required", jp: "Not required" },
    related: ["celery", "sesame", "sulfites"],
  },

  {
    id: "celery",
    slug: "celery",
    noun: "celery",
    label: "Celery",
    title: "Other names for celery on a food label",
    description:
      "Celery, celeriac, celery seed and celery salt: the names celery goes by, why celery seed can hide in “spice” on a US label, and where it must be declared.",
    dek: "Celery turns up in stocks, soups and seasoning blends. The EU makes labels call it out. The US doesn’t.",
    names: [
      { term: "Celery, celery seed, celery salt" },
      { term: "Celeriac", note: "Celery root." },
      { term: "Apium graveolens", note: "The Latin name." },
    ],
    elsewhere: { es: "apio", zh: "芹菜", ja: "セロリ" },
    law: {
      us: `${NOT_US} Celery seed counts as a spice and can be listed as “spice.” Celery itself is a food, so it has to be named.[[cfr22]]`,
      eu: "One of the 14 allergens: “Celery and products thereof.”[[eu]]",
      jp: NOT_JP,
    },
    status: { us: "Not required", eu: "Required", jp: "Not required" },
    related: ["mustard", "sesame", "wheat"],
  },

  {
    id: "lupin",
    slug: "lupin",
    noun: "lupin",
    label: "Lupin",
    title: "Other names for lupin on a food label",
    description:
      "Lupin, lupine and lupin flour: what lupin is on an ingredient list, and why EU labels must call it out when US labels don’t.",
    dek: "Lupin is a legume whose seeds and flour turn up in some baked goods. The EU makes labels call it out.",
    names: [
      { term: "Lupin, lupine, lupin flour" },
      { term: "Lupinus", note: "The Latin name." },
    ],
    elsewhere: { es: "altramuz, lupino", zh: "羽扇豆", ja: "ルピナス" },
    law: {
      us: NOT_US,
      eu: "One of the 14 allergens: “Lupin and products thereof.”[[eu]]",
      jp: NOT_JP,
    },
    status: { us: "Not required", eu: "Required", jp: "Not required" },
    related: ["peanuts", "soy", "wheat"],
  },

  {
    id: "buckwheat",
    slug: "buckwheat",
    noun: "buckwheat",
    label: "Buckwheat",
    title: "Other names for buckwheat on a food label",
    description:
      "Buckwheat, soba and Fagopyrum: what buckwheat is on a label, why it isn’t wheat, and why Japan requires it to be declared when the US and EU don’t.",
    dek: "Buckwheat isn’t wheat, or even a grass. Japan makes labels declare it. The US and EU don’t.",
    names: [
      { term: "Buckwheat, buckwheat flour" },
      { term: "Soba", note: "Japanese buckwheat noodles, which often contain wheat too." },
      { term: "Fagopyrum", note: "The Latin name." },
      { term: "Kasha", note: "Roasted buckwheat groats." },
    ],
    notIt: [{ term: "Wheat", note: "Not related, despite the name. A separate allergen." }],
    elsewhere: { es: "alforfón, trigo sarraceno", zh: "荞麦、蕎麥", ja: "そば" },
    law: {
      us: NOT_US,
      eu: NOT_EU,
      jp: "Mandatory (そば).[[jp]]",
    },
    status: { us: "Not required", eu: "Not required", jp: "Required" },
    related: ["wheat", "soy", "eggs"],
  },
];

/**
 * One allergen page in another language.
 *
 * The names stay in English, because they are what the scanner matches and
 * what an English-language label prints; `names` and `notIt` hold one note per
 * English entry, in order, and each note starts with the name in the page's
 * language. eval/allergen-pages.check.ts holds the lengths equal.
 */
export interface AllergenText {
  noun: string;
  label: string;
  title: string;
  description: string;
  dek: string;
  names: string[];
  notIt?: string[];
  law: { us: string; eu: string; jp: string };
  status: { us: string; eu: string; jp: string };
  more?: string;
}

export const ALLERGEN_PAGES_BY_SLUG: ReadonlyMap<string, AllergenPage> = new Map(
  ALLERGEN_PAGES.map((p) => [p.slug, p]),
);
