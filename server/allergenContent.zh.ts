import type { AllergenText } from "./allergenContent";
import type { GuideSource } from "./guideContent";

/**
 * The allergen pages in Simplified Chinese, keyed by the English slug.
 *
 * Same sourcing as allergenContent.ts. None of the sources publishes an
 * official Chinese text, so nothing here is in quotation marks except label
 * wording, which stays in the language the label prints it in ("whey (goat
 * milk)"). Allergen names follow the app's own Chinese (mobile/src/lib/i18n.tsx):
 * 鸡蛋, 鱼类, 坚果 for tree nuts.
 *
 * No em dashes (——) in anything a reader sees.
 */

const EN = "（英文）";

export const ALLERGEN_SOURCES_ZH: Record<string, GuideSource> = {
  "fda-qa": {
    org: "美国食品药品监督管理局（FDA）",
    title: "食品过敏原问答（第五版），行业指南",
    year: 2025,
    url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-questions-and-answers-regarding-food-allergens-including-food-allergen-labeling",
    note: EN,
  },
  fda: {
    org: "美国食品药品监督管理局（FDA）",
    title: "Food Allergies（食物过敏）",
    url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
    note: EN,
  },
  eu: {
    org: "欧盟",
    title: "第 1169/2011 号条例：向消费者提供食品信息，附件二",
    year: 2011,
    url: "https://eur-lex.europa.eu/eli/reg/2011/1169/oj",
    note: EN,
  },
  jp: {
    org: "日本消费者厅",
    title: "アレルギー表示について（过敏原标示），2026 年 4 月",
    year: 2026,
    url: "https://www.caa.go.jp/policies/policy/food_labeling/food_sanitation/allergy/assets/food_labeling_cms204_260401_01.pdf",
    note: "（日文）",
  },
  cfr22: {
    org: "美国联邦法规",
    title: "21 CFR 101.22 香辛料、香料、色素和化学防腐剂的标示",
    url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-B/section-101.22",
    note: EN,
  },
};

const NOT_US = "不属于主要食品过敏原，所以没有规定要求在标签上突出标示。[[fda]]";
const NOT_JP = "不在日本的强制标示或建议标示清单上。[[jp]]";
const EU14 = "欧盟 14 种过敏原之一";

export const ALLERGENS_ZH: Record<string, AllergenText> = {
  milk: {
    noun: "牛奶",
    label: "牛奶",
    title: "食品标签上牛奶的其他名称",
    description: "乳清、酪蛋白、酥油等：牛奶在配料表上的各种名称、看起来像乳制品其实不是的配料，以及美国、欧盟和日本的标示要求。",
    dek: "牛奶不一定写成“牛奶”。这里是它在标签上的各种名称、只是听起来像乳制品的配料，以及标签必须告诉你的内容。",
    names: [
      "牛奶、奶粉、乳脂、酪乳。",
      "乳清、乳清蛋白。制作奶酪时剩下的液体，常见于蛋白棒和零食。",
      "酪蛋白、酪蛋白酸盐。牛奶中的主要蛋白质。咖啡伴侣里常有酪蛋白酸钠。",
      "乳糖。牛奶中的糖。",
      "黄油、酥油。酥油是澄清黄油。",
      "奶油、酸奶油。",
      "奶酪、凝乳。指奶酪凝块。",
      "酸奶。",
      "乳制品。",
    ],
    notIt: [
      "可可脂、乳木果油。来自植物的油脂。",
      "花生酱等坚果酱、种子酱。因质地得名。要检查的是花生和坚果。",
      "椰奶、椰浆。用椰子制成。",
      "豆奶、燕麦奶、杏仁奶、米浆。植物饮品，要检查它们各自的过敏原。",
      "塔塔粉。一种来自酿酒业的泡打粉成分。",
      "豆腐（bean curd）。由大豆制成。",
      "奶油南瓜（butternut squash）。一种蔬菜。",
    ],
    law: {
      us: "主要食品过敏原。[[fda]] FDA 所说的牛奶包括牛、山羊、绵羊等反刍动物的奶；不是牛奶时，应注明动物，例如“whey (goat milk)”。[[fda-qa]]",
      eu: `${EU14}：牛奶及其制品（包括乳糖）。用于酿造烈酒的乳清和乳糖醇除外。[[eu]]`,
      jp: "强制标示（乳）。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示", jp: "必须标示" },
    more: `
<h2>不用奶牛生产的乳蛋白也算</h2>
<p>根据 FDA 的指南，来自主要食品过敏原的蛋白质，即使用其他方法生产，例如发酵，也要按该过敏原标示。所以不用奶牛生产的乳蛋白仍须标为牛奶。[[fda-qa]]</p>

<h2>最常见的未标示过敏原</h2>
<p>FDA 表示，在美国因未标示过敏原而召回的产品中，牛奶是最常见的原因。它还特别指出，对牛奶过敏的人要格外留意黑巧克力。[[fda]]</p>
`,
  },

  eggs: {
    noun: "鸡蛋",
    label: "鸡蛋",
    title: "食品标签上鸡蛋的其他名称",
    description: "白蛋白、卵白蛋白、溶菌酶（E1105）等：鸡蛋在配料表上的各种名称，以及美国、欧盟和日本的标示要求。",
    dek: "鸡蛋藏在酱料、面食、烘焙食品，甚至一些奶酪里。这里是要找的名称。",
    names: [
      "蛋、蛋清、蛋黄、蛋粉。",
      "白蛋白。蛋清中的蛋白质。",
      "卵白蛋白。蛋清中的主要蛋白质。",
      "蛋黄酱。用蛋黄制成。",
      "蛋白霜。打发的蛋清。",
      "溶菌酶、E1105。用蛋清制成的酶，用于一些奶酪和葡萄酒。",
    ],
    notIt: [
      "茄子（eggplant）。一种蔬菜。",
      "“不含蛋”“无蛋”。这是声明，不是配料。Revely 不会把它们算作鸡蛋。",
    ],
    law: {
      us: "主要食品过敏原。[[fda]] FDA 所说的蛋包括鸡、鸭、鹅、鹌鹑等禽类的蛋；不是鸡蛋时，应注明禽类，例如“ovalbumin (duck egg)”。[[fda-qa]]",
      eu: `${EU14}：蛋及其制品。[[eu]] 用蛋制成的溶菌酶也包括在内。`,
      jp: "强制标示（卵）。日本标签也可以写作“玉子”或“たまご”。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示", jp: "必须标示" },
    more: `
<h2>奶酪里的蛋</h2>
<p>溶菌酶（E1105）是用蛋清制成的酶，一些奶酪和葡萄酒会用到它。它来自蛋，所以按欧盟规定属于必须标示的蛋制品。[[eu]] 在奶酪标签上很容易漏看，因为配料表上没有别的东西听起来像蛋。</p>
`,
  },

  fish: {
    noun: "鱼类",
    label: "鱼类",
    title: "食品标签上鱼类的其他名称",
    description: "凤尾鱼、鳕鱼、鱼露等：鱼类在配料表上的各种名称、欧盟的豁免，以及美国、欧盟和日本的标示方式。",
    dek: "美国标签必须写出鱼的种类，所以可能根本不会出现“鱼”字。这里是要找的名称。",
    names: [
      "鱼、鱼露、鱼油、鱼明胶。",
      "凤尾鱼。常见于沙拉酱和调味汁。",
      "鳕鱼、黑线鳕、狭鳕、比目鱼、鲽鱼。",
      "三文鱼、鳟鱼。",
      "金枪鱼、鲭鱼、沙丁鱼、鲱鱼。",
      "罗非鱼。",
      "鱼糜（surimi）。成型的鱼浆，多用狭鳕，常做成仿蟹肉。",
      "鱼胶（isinglass）。用鱼制成的明胶，用来澄清一些啤酒和葡萄酒。",
    ],
    notIt: ["Swedish Fish。一种糖果，里面没有鱼。"],
    law: {
      us: "主要食品过敏原。[[fda]] 标签必须写出鱼的种类，例如“cod”，而不能只写“fish”。[[fda-qa]]",
      eu: `${EU14}：鱼类及其制品。用作维生素或类胡萝卜素载体的鱼明胶，以及用来澄清啤酒和葡萄酒的鱼明胶或鱼胶除外。[[eu]]`,
      jp: "不强制标示。三文鱼（さけ）、鲭鱼（さば）和三文鱼籽（いくら）在建议标示清单上。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示", jp: "建议标示三文鱼、鲭鱼和三文鱼籽" },
  },

  shellfish: {
    noun: "甲壳类",
    label: "甲壳类",
    title: "食品标签上甲壳类的其他名称",
    description: "虾、对虾、蟹、龙虾、小龙虾和磷虾：标签必须写出的甲壳类，以及为什么蛤蜊和牡蛎是另一种过敏原。",
    dek: "在美国标签上，“shellfish”指的是甲壳类：虾、蟹、龙虾等。蛤蜊、贻贝和牡蛎属于另一类。",
    names: ["虾、对虾。", "蟹。", "龙虾。", "小龙虾。", "磷虾。一种小型甲壳类，用于磷虾油。"],
    law: {
      us: "主要食品过敏原，名称为“Crustacean shellfish”（甲壳类贝类）。[[fda]] 标签必须写出种类，例如“shrimp”或“crab”。[[fda-qa]]",
      eu: `${EU14}：甲壳类及其制品。[[eu]]`,
      jp: "虾（えび）和蟹（かに）强制标示。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示", jp: "虾和蟹必须标示" },
    more: `
<h2>软体动物是另一种过敏原</h2>
<p>蛤蜊、贻贝、牡蛎、扇贝和鱿鱼属于软体动物，不是甲壳类。欧盟把它们列为另一种过敏原，美国则根本不把它们列为主要食品过敏原。[[eu]][[fda]] <a href="/zh/allergens/mollusks">这里是它们的名称。</a></p>
`,
  },

  mollusks: {
    noun: "软体动物",
    label: "软体动物",
    title: "食品标签上软体动物的其他名称",
    description: "牡蛎、贻贝、蛤蜊、鱿鱼、章鱼等：软体动物在标签上的各种名称。欧盟要求标示，美国不要求。",
    dek: "蚝油、炸鱿鱼圈和法式蜗牛都来自软体动物。欧盟要求标签把它们标出来，美国不要求。",
    names: [
      "牡蛎、蚝油。蚝油是用牡蛎制成的。",
      "贻贝、蛤蜊、鸟蛤、蛾螺。",
      "扇贝。",
      "鱿鱼、墨鱼。",
      "章鱼。",
      "蜗牛、法式蜗牛、Helix aspersa。一些护肤品里也有蜗牛提取物。",
      "鲍鱼。",
      "软体动物（mollusc、mollusk）。",
    ],
    notIt: ["平菇（oyster mushroom）。一种蘑菇，因形状得名。"],
    law: {
      us: NOT_US,
      eu: `${EU14}：软体动物及其制品。[[eu]]`,
      jp: "不强制标示。鲍鱼（あわび）和鱿鱼（いか）在建议标示清单上。[[jp]]",
    },
    status: { us: "不要求", eu: "必须标示", jp: "建议标示鲍鱼和鱿鱼" },
  },

  "tree-nuts": {
    noun: "坚果",
    label: "坚果",
    title: "食品标签上坚果的其他名称",
    description: "在美国、欧盟和日本，哪些坚果算作过敏原、哪些名称其实不是坚果，以及 Revely 会标出哪些。",
    dek: "“坚果”在不同国家指的是不同的清单。这里是每份清单涵盖的内容，以及听起来像坚果、其实不是的名称。",
    names: [
      "杏仁。",
      "巴西坚果。",
      "腰果。",
      "榛子。",
      "夏威夷果。",
      "碧根果。",
      "松子。",
      "开心果。",
      "核桃。",
      "栗子。不在美国或欧盟的清单上，但 Revely 仍会标出。",
      "椰子。不在美国或欧盟的清单上，但 Revely 仍会标出。",
    ],
    notIt: ["花生。属于豆类，是另一种过敏原。", "肉豆蔻。一种香料，不在美国或欧盟的清单上。", "荸荠（water chestnut）。一种水生蔬菜。"],
    law: {
      us: "主要食品过敏原，标签必须写出坚果的种类。[[fda-qa]] FDA 列出 12 种：杏仁、黑核桃、巴西坚果、加州核桃、腰果、榛子、日本核桃、夏威夷果、碧根果、松子、开心果和核桃。其他坚果要在配料表中写出名称，但不写进“Contains”那一行。[[fda-qa]]",
      eu: `${EU14}，涵盖八种坚果：杏仁、榛子、核桃、腰果、碧根果、巴西坚果、开心果和夏威夷果。[[eu]]`,
      jp: "核桃（くるみ）和腰果（カシューナッツ）强制标示。杏仁、夏威夷果和开心果在建议标示清单上。[[jp]]",
    },
    status: { us: "必须标示，12 种", eu: "必须标示，8 种", jp: "核桃和腰果必须标示" },
    more: `
<h2>椰子和栗子</h2>
<p>两者都不在 FDA 目前的 12 种清单或欧盟的 8 种清单上。[[fda-qa]][[eu]] Revely 仍把它们都当作坚果标出，比两份清单都更谨慎。</p>
`,
  },

  peanuts: {
    noun: "花生",
    label: "花生",
    title: "食品标签上花生的其他名称",
    description: "落花生、arachis 油等：花生在标签上的各种名称、花生油的处理方式，以及美国、欧盟和日本的标示要求。",
    dek: "花生属于豆类，不是坚果，在标签上有自己的名称。这里是它们。",
    names: ["花生、花生酱、花生粉、花生油。", "落花生（groundnut）。花生的另一个名称。", "Arachis 油、Arachis hypogaea。Arachis 是拉丁学名，常见于欧洲标签。"],
    notIt: ["坚果（tree nuts）。另一种过敏原。", "肉豆蔻。一种香料。"],
    law: {
      us: "主要食品过敏原。[[fda]] 高度精炼的花生油不受过敏原标示要求约束，但在配料表中仍须称为“peanut oil”。[[fda-qa]]",
      eu: `${EU14}：花生及其制品，没有豁免。[[eu]]`,
      jp: "强制标示（落花生）。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示", jp: "必须标示" },
  },

  wheat: {
    noun: "小麦",
    label: "小麦",
    title: "食品标签上小麦的其他名称",
    description: "粗粒小麦粉、杜兰小麦、斯佩尔特小麦、法丽那和面筋肉：小麦在标签上的各种名称、欧盟的豁免，以及为什么荞麦不是小麦。",
    dek: "小麦会以意面里的粗粒小麦粉、面包里的杜兰小麦、素肉里的面筋出现。这里是它的名称。",
    names: [
      "小麦、小麦粉、小麦淀粉、小麦面筋。",
      "粗粒小麦粉、杜兰小麦（semolina、durum）。杜兰小麦及其磨成的粉。",
      "斯佩尔特小麦（spelt）。一种古老的小麦品种。",
      "法丽那（farina）。磨碎的小麦，常见于早餐谷物。",
      "面筋肉（seitan）。用小麦面筋制成。",
    ],
    notIt: ["荞麦（buckwheat）。虽然名字相似，但和小麦没有关系，是另一种过敏原。"],
    law: {
      us: "主要食品过敏原。[[fda]] 黑麦和大麦不是。",
      eu: "以“含麸质谷物”标示：小麦、黑麦、大麦、燕麦、斯佩尔特小麦和卡姆小麦。用小麦制成的葡萄糖浆和麦芽糊精除外。[[eu]]",
      jp: "强制标示（小麦）。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示，作为含麸质谷物", jp: "必须标示" },
  },

  soy: {
    noun: "大豆",
    label: "大豆",
    title: "食品标签上大豆的其他名称",
    description: "Soya、毛豆、豆腐、味噌、天贝和大豆卵磷脂：大豆的各种名称、精炼大豆油的豁免，以及标签的标示方式。",
    dek: "含大豆的远不止豆腐。这里是它的各种名称，以及规定豁免的大豆成分。",
    names: [
      "大豆（soy、soya、soybean）。",
      "大豆卵磷脂。一种乳化剂，常见于巧克力和烘焙食品。",
      "酱油。",
      "毛豆（edamame）。嫩大豆。",
      "豆腐、天贝。",
      "味噌。发酵的大豆酱。",
    ],
    law: {
      us: "主要食品过敏原，例如“lecithin (soy)”。[[fda]] 高度精炼的大豆油不受过敏原标示要求约束，但在配料表中仍称为“soybean oil”。[[fda-qa]]",
      eu: `${EU14}。完全精炼的大豆油、部分维生素 E（E306）以及用大豆油制成的植物甾醇除外。[[eu]]`,
      jp: "不强制标示。大豆在建议标示清单上。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示", jp: "建议标示" },
  },

  sesame: {
    noun: "芝麻",
    label: "芝麻",
    title: "食品标签上芝麻的其他名称",
    description: "芝麻酱（tahini）、benne、gingelly 和芝麻油：芝麻的各种名称、它在“香辛料”中如何标示，以及它何时成为美国的主要过敏原。",
    dek: "芝麻在 2023 年 1 月 1 日成为美国第九种主要食品过敏原。这里是它的各种名称。",
    names: ["芝麻、芝麻籽、芝麻油。", "芝麻酱（tahini）。鹰嘴豆泥的基础。", "Benne。芝麻籽的旧称。", "Gingelly。南亚对芝麻和芝麻油的叫法。"],
    law: {
      us: "自 2023 年 1 月 1 日起为主要食品过敏原。[[fda]] 芝麻作为“香辛料”的一部分时，标签必须写明：“spices (sesame)”或“Contains sesame”。[[fda-qa]]",
      eu: `${EU14}：芝麻籽及其制品。[[eu]]`,
      jp: "不强制标示。芝麻（ごま）在建议标示清单上。[[jp]]",
    },
    status: { us: "必须标示", eu: "必须标示", jp: "建议标示" },
  },

  sulfites: {
    noun: "亚硫酸盐",
    label: "亚硫酸盐",
    title: "食品标签上亚硫酸盐的其他名称",
    description: "二氧化硫以及 E220 至 E228：亚硫酸盐的各种名称、美国和欧盟要求标示的含量，以及“不含亚硫酸盐”声明的含义。",
    dek: "亚硫酸盐能防止果干、葡萄酒和一些加工食品变质。在标签上，它们常以 E 编号出现。",
    names: [
      "亚硫酸盐（sulfite、sulphite）、亚硫酸氢盐、焦亚硫酸盐。",
      "二氧化硫（sulfur dioxide、sulphur dioxide）。E220。",
      "E220、E221、E222、E223、E224、E226、E227、E228。二氧化硫，以及钠、钾、钙的亚硫酸盐。",
    ],
    notIt: [
      "“不含亚硫酸盐”“未添加亚硫酸盐”。这是声明，不是配料。Revely 不会把它们算作亚硫酸盐。",
      "硫酸盐，例如硫酸钙。和亚硫酸盐是不同的化合物。",
    ],
    law: {
      us: "不属于主要食品过敏原，但含量达到百万分之十（10 ppm）或以上时必须标示，部分原因是一些敏感人群会出现哮喘等不良反应。[[fda]]",
      eu: `${EU14}，以二氧化硫总量计，超过每千克或每升 10 毫克时须标示。[[eu]]`,
      jp: NOT_JP,
    },
    status: { us: "10 ppm 或以上须标示", eu: "超过 10 mg/kg 须标示", jp: "不要求" },
  },

  mustard: {
    noun: "芥末",
    label: "芥末",
    title: "食品标签上芥末的其他名称",
    description: "芥末、芥菜籽、Sinapis 和 Brassica：芥末的各种名称、为什么美国标签可以把它写成“spice”，以及哪里要求标示。",
    dek: "芥末是欧盟 14 种过敏原之一，但不是美国的主要过敏原；在美国标签上，它可以只写成“spice”（香辛料）。",
    names: ["芥末、芥菜籽、芥末粉。", "Sinapis。白芥的拉丁学名。", "Brassica juncea、Brassica nigra。褐芥和黑芥。"],
    law: {
      us: "不属于主要食品过敏原，所以没有规定要求在标签上突出标示。[[fda]] 芥末粉属于香辛料，香辛料可以统称为“spice”。[[cfr22]]",
      eu: `${EU14}：芥末及其制品。[[eu]]`,
      jp: NOT_JP,
    },
    status: { us: "不要求", eu: "必须标示", jp: "不要求" },
  },

  celery: {
    noun: "芹菜",
    label: "芹菜",
    title: "食品标签上芹菜的其他名称",
    description: "芹菜、根芹、芹菜籽和芹菜盐：芹菜的各种名称、为什么芹菜籽在美国标签上可以藏在“spice”里，以及哪里要求标示。",
    dek: "芹菜常见于高汤、汤品和调味料。欧盟要求标签把它标出来，美国不要求。",
    names: ["芹菜、芹菜籽、芹菜盐。", "根芹（celeriac）。芹菜的根。", "Apium graveolens。拉丁学名。"],
    law: {
      us: "不属于主要食品过敏原，所以没有规定要求在标签上突出标示。[[fda]] 芹菜籽属于香辛料，可以写成“spice”；芹菜本身是食物，必须写出名称。[[cfr22]]",
      eu: `${EU14}：芹菜及其制品。[[eu]]`,
      jp: NOT_JP,
    },
    status: { us: "不要求", eu: "必须标示", jp: "不要求" },
  },

  lupin: {
    noun: "羽扇豆",
    label: "羽扇豆",
    title: "食品标签上羽扇豆的其他名称",
    description: "羽扇豆、lupine 和羽扇豆粉：羽扇豆在配料表上是什么，以及为什么欧盟标签必须标出而美国标签不必。",
    dek: "羽扇豆是一种豆类，它的种子和粉会出现在一些烘焙食品里。欧盟要求标签把它标出来。",
    names: ["羽扇豆（lupin、lupine）、羽扇豆粉。", "Lupinus。拉丁学名。"],
    law: { us: NOT_US, eu: `${EU14}：羽扇豆及其制品。[[eu]]`, jp: NOT_JP },
    status: { us: "不要求", eu: "必须标示", jp: "不要求" },
  },

  buckwheat: {
    noun: "荞麦",
    label: "荞麦",
    title: "食品标签上荞麦的其他名称",
    description: "荞麦、荞麦面和 Fagopyrum：荞麦在标签上是什么、为什么它不是小麦，以及为什么日本要求标示而美国和欧盟不要求。",
    dek: "荞麦不是小麦，甚至不是禾本植物。日本要求标签标示它，美国和欧盟不要求。",
    names: ["荞麦、荞麦粉。", "荞麦面（soba）。日本的荞麦面条，常常也含有小麦。", "Fagopyrum。拉丁学名。", "Kasha。烘烤过的荞麦粒。"],
    notIt: ["小麦（wheat）。虽然名字相似，但没有关系，是另一种过敏原。"],
    law: { us: NOT_US, eu: "不在欧盟的 14 种过敏原之列。[[eu]]", jp: "强制标示（そば）。[[jp]]" },
    status: { us: "不要求", eu: "不要求", jp: "必须标示" },
  },
};
