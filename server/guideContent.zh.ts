import { citeWith, type GuideSource, type GuideText } from "./guideContent";

/**
 * The guides in Simplified Chinese, keyed by the English slug.
 *
 * Same rule as the English file: every claim is a quotation or close
 * paraphrase of a numbered source, or arithmetic on one. Where the source
 * publishes an official Chinese text (the WHO fact sheets) it is quoted
 * verbatim in “ ”. Where it does not (EU regulations, the CFR, FDA), the
 * sentence is a paraphrase with no quotation marks, and the source link goes
 * to the original, marked (英文). A translation of ours is never presented as
 * someone else's words.
 *
 * The WHO passages were checked against who.int/zh on 2026-09-25.
 * No em dashes (——) in anything a reader sees.
 */

const cite = citeWith("来源");
const EN = "（英文）";

const US_101_4: GuideSource = {
  org: "美国联邦法规",
  title: "21 CFR 101.4 食品配料的标示",
  url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.4",
  note: EN,
};

const EU_1169: GuideSource = {
  org: "欧盟",
  title: "第 1169/2011 号条例：向消费者提供食品信息",
  year: 2011,
  url: "https://eur-lex.europa.eu/eli/reg/2011/1169/oj",
  note: EN,
};

const FDA_ALLERGIES: GuideSource = {
  org: "美国食品药品监督管理局（FDA）",
  title: "Food Allergies（食物过敏）",
  url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
  note: EN,
};

export const GUIDES_ZH: Record<string, GuideText> = {
  "how-to-read-an-ingredient-list": {
    title: "怎样看懂配料表，无论它印在哪里",
    description:
      "配料表有几条固定规则。这里讲清楚排列顺序的含义、美国和欧盟怎样标注过敏原，以及“可能含有”到底说明了什么。",
    dek: "在美国或欧盟销售的包装食品，都按同样几条规则列出配料。了解这些规则，配料表能告诉你的比看上去多。",
    body: `
<h2>配料按重量排列</h2>
<p>在美国，配料必须按重量从多到少排列。${cite(1)} 欧盟的规定相同：按生产时加入的重量递减排列。${cite(2)}</p>
<p>所以排在第一位的配料含量最多，排在最后的最少。比较两款相似的产品时，先看前几项。</p>

<h2>同一种配料可能分散在列表各处</h2>
<p>每种配料单独排位。一款产品如果同时用了糖、葡萄糖浆和蜂蜜，这三样会分别列出，而每一样都比三者加起来轻，所以各自都比单用一种糖时排得更靠后。</p>
<p>判断某样东西排在多靠后之前，值得把整张表读完。<a href="/zh/guides/names-for-sugar">这里是糖的各种名称。</a></p>

<h2>添加剂按用途标注</h2>
<p>在欧盟，属于着色剂、防腐剂、乳化剂等类别的添加剂，必须先写类别名称，再写具体名称，或在适当时写 E 编号。${cite(2)} 所以欧洲的标签会先说明添加剂的用途，再写它的名称或编号，例如“preservative: E211”（防腐剂：E211）。</p>
<p><a href="/zh/additives">查一查标签上的 E 编号。</a></p>

<h2>过敏原会被标出，方式取决于在哪里销售</h2>
<p>美国标签用两种方式之一注明主要过敏原的来源：在配料后面加括号，例如“whey (milk)”（乳清（牛奶））或“flour (wheat)”（面粉（小麦））；或者在配料表后紧接一行，例如“Contains wheat, milk, and soy.”（含有小麦、牛奶和大豆）。${cite(3)}</p>
<p>欧盟标签则直接在配料表里标出：过敏原的名称必须用与其他配料明显不同的字体、样式或背景颜色加以突出。${cite(2)} 你通常会看到它是粗体。</p>
<p>两边涵盖的过敏原也不一样：美国列出 9 种，欧盟列出 14 种。<a href="/zh/guides/allergen-labeling-us-and-eu">这里是两者的对比。</a></p>

<h2>“可能含有”是自愿标注的</h2>
<p>“可能含有坚果”或“生产设施也处理坚果”这类说明，讲的是交叉接触，而不是配方。在美国，FDA 表示这类说明并非法律要求。${cite(3)}</p>
<p>这句话要反过来读：没有这类说明的产品，也没有做出任何保证。如果过敏很严重，没有警告不等于安全。</p>

<h2>标签语言跟着销售地，而不是工厂</h2>
<p>欧盟法律要求，强制性信息必须使用销售地所在成员国消费者容易理解的语言。${cite(2)} 所以在欧洲买到的进口食品上，常常贴着翻译过的标签。</p>
<p>在国外购物，或者站在本地的进口货架前，你手里的配料表很可能是一种你完全看不懂的语言。</p>
`,
    inRevely:
      "Revely 能读懂大多数语言的配料表，并把原文和你所用语言的译文并排显示。它会标出每种配料在列表中的位置；如果某个卫生机构对某种配料有过说法，它会告诉你是谁说的。",
    sources: [US_101_4, EU_1169, FDA_ALLERGIES],
  },

  "names-for-sugar": {
    title: "配料表上糖的各种名称",
    description:
      "糖在标签上有十几种名称。这里列出要找的写法、世卫组织怎样定义游离糖，以及它建议的摄入量。",
    dek: "只找“糖”字，你会漏掉很多。这里是糖的其他名称，以及世界卫生组织对摄入量的建议。",
    body: `
<h2>世卫组织算哪些</h2>
<p>世卫组织的建议针对的是<em>游离糖</em>：“游离糖包括生产商、厨师或消费者添加到食品和饮料中的所有单糖和双糖（例如蔗糖、果糖、葡萄糖）以及蜂蜜、糖浆、果汁及浓缩果汁中天然存在的糖。”${cite(1)}</p>
<p>所以蜂蜜、糖浆和浓缩果汁都算在内，无论听起来多么天然。</p>

<h2>吃多少</h2>
<p>世卫组织建议：“游离糖摄入量应限制在每日总能量摄入的10%以下。对于每天消耗约2000卡路里热量的健康体重者而言，这相当于50克（或约12茶匙）。”它还指出，进一步降到5%或更少“可能会带来额外健康益处”。${cite(1)}</p>

<h2>要找的名称</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">标签上的写法</th><th scope="col">是什么</th><th scope="col">英文和西班牙文标签上</th></tr></thead>
  <tbody>
    <tr><td>白砂糖、蔗糖</td><td>普通的食糖，来自甘蔗或甜菜。</td><td class="tr"><span lang="en">sugar, sucrose</span><span lang="es">azúcar</span></td></tr>
    <tr><td>红糖、黄砂糖</td><td>保留或加回了部分糖蜜的蔗糖。</td><td class="tr"><span lang="en">brown sugar</span><span lang="es">azúcar moreno</span></td></tr>
    <tr><td>椰糖、棕榈糖</td><td>用棕榈树汁液制成的糖。</td><td class="tr"><span lang="en">coconut sugar, palm sugar</span><span lang="es">azúcar de coco</span></td></tr>
    <tr><td>葡萄糖</td><td>一种单糖，也叫右旋糖。</td><td class="tr"><span lang="en">glucose, dextrose</span><span lang="es">glucosa, dextrosa</span></td></tr>
    <tr><td>果糖</td><td>一种单糖，存在于水果和蜂蜜中。</td><td class="tr"><span lang="en">fructose</span><span lang="es">fructosa</span></td></tr>
    <tr><td>葡萄糖浆、玉米糖浆</td><td>由淀粉分解而成的糖浆，原料多为玉米或小麦。</td><td class="tr"><span lang="en">glucose syrup, corn syrup</span><span lang="es">jarabe de glucosa</span></td></tr>
    <tr><td>果葡糖浆</td><td>部分葡萄糖转化成果糖的葡萄糖浆。美国叫高果糖玉米糖浆，欧洲叫葡萄糖果糖糖浆。</td><td class="tr"><span lang="en">high-fructose corn syrup, glucose-fructose syrup</span><span lang="es">jarabe de glucosa y fructosa</span></td></tr>
    <tr><td>转化糖、转化糖浆</td><td>分解成葡萄糖和果糖两部分的蔗糖。</td><td class="tr"><span lang="en">invert sugar</span><span lang="es">azúcar invertido</span></td></tr>
    <tr><td>蜂蜜</td><td>世卫组织将其计为游离糖。</td><td class="tr"><span lang="en">honey</span><span lang="es">miel</span></td></tr>
    <tr><td>糖蜜</td><td>精制糖时剩下的深色糖浆。</td><td class="tr"><span lang="en">molasses, treacle</span><span lang="es">melaza</span></td></tr>
    <tr><td>枫糖浆、龙舌兰糖浆</td><td>糖浆，世卫组织将其计为游离糖。</td><td class="tr"><span lang="en">maple syrup, agave syrup</span><span lang="es">jarabe de arce, sirope de agave</span></td></tr>
    <tr><td>浓缩果汁</td><td>虽然来自水果，世卫组织仍将其计为游离糖。</td><td class="tr"><span lang="en">fruit juice concentrate</span><span lang="es">zumo concentrado de frutas</span></td></tr>
  </tbody>
</table>
</div>

<h2>数一数，而不只是看第一行</h2>
<p>配料按重量从多到少排列。${cite(2, 3)} 一款产品用了三种糖，就会分别列出三种，而每一种都比三者加起来排得更靠后。所以值得数一数有几种糖，而不只是看糖是不是排在第一位。<a href="/zh/guides/how-to-read-an-ingredient-list">更多关于排列顺序的说明。</a></p>
`,
    inRevely:
      "无论标签用什么语言印刷，Revely 都能认出这些糖，标出每一种在列表中的位置，并引用世卫组织对它们的说法。",
    sources: [
      {
        org: "世界卫生组织",
        title: "健康饮食（情况介绍）",
        url: "https://www.who.int/zh/news-room/fact-sheets/detail/healthy-diet",
      },
      US_101_4,
      EU_1169,
    ],
  },

  "food-color-warnings": {
    title: "在欧洲必须附带警示的六种食用色素",
    description:
      "在欧盟，六种人工色素必须附带关于儿童活动和注意力的警示。这里列出这六种色素、它们的美国名称，以及赤藓红的遭遇。",
    dek: "在欧盟，这六种色素只有在标签附带警示时才能使用。其中三种在美国以别的名称销售，完全没有警示。",
    body: `
<h2>警示内容</h2>
<p>根据欧盟法律，含有以下任何一种色素的食品，必须在色素名称或 E 编号旁注明：可能对儿童的活动和注意力产生不良影响。${cite(1)}</p>
<div class="scroll">
<table>
  <thead><tr><th scope="col">E 编号</th><th scope="col">名称</th><th scope="col">美国名称</th></tr></thead>
  <tbody>
    <tr><td class="num">E102</td><td><a href="/zh/additives/e102-tartrazine">柠檬黄</a></td><td>FD&amp;C Yellow No. 5</td></tr>
    <tr><td class="num">E104</td><td><a href="/zh/additives/e104-quinoline-yellow">喹啉黄</a></td><td>没有 FD&amp;C 名称</td></tr>
    <tr><td class="num">E110</td><td><a href="/zh/additives/e110-sunset-yellow-fcf">日落黄</a></td><td>FD&amp;C Yellow No. 6</td></tr>
    <tr><td class="num">E122</td><td><a href="/zh/additives/e122-carmoisine">偶氮玉红</a></td><td>没有 FD&amp;C 名称</td></tr>
    <tr><td class="num">E124</td><td><a href="/zh/additives/e124-ponceau-4r">胭脂红</a></td><td>没有 FD&amp;C 名称</td></tr>
    <tr><td class="num">E129</td><td><a href="/zh/additives/e129-allura-red-ac">诱惑红</a></td><td>FD&amp;C Red No. 40</td></tr>
  </tbody>
</table>
</div>
<p>警示不等于禁用。这些色素在欧盟仍然允许使用，只是标签必须说明，所以在欧洲的包装上很容易发现。在美国的包装上，要找的是最后一列的名称，常简写为 Yellow 5、Yellow 6 或 Red 40。</p>

<h2>赤藓红在美国的遭遇</h2>
<p>另一种色素 FD&amp;C Red No. 3，也叫<a href="/zh/additives/e127-erythrosine">赤藓红</a>，正在退出美国食品。2025 年 1 月，FDA 撤销了它在食品和口服药物中的使用许可。对食品而言，这项命令于 2027 年 1 月 15 日生效，也就是重新调整配方的最后期限。${cite(2)}</p>
<p>原因既关乎科学，也关乎法律。美国法律规定，一种色素一旦被发现会使动物致癌，就不能再获批准。FDA 认定，Red No. 3 会通过一种大鼠特有的激素机制诱发雄性大鼠患癌。${cite(2)}</p>
`,
    inRevely:
      "无论标签写的是柠檬黄、E102 还是 Yellow 5，Revely 都能认出这些色素，并告诉你相关警示以及是谁要求的。",
    sources: [
      {
        org: "欧盟",
        title: "第 1333/2008 号条例：食品添加剂，附件五",
        year: 2008,
        url: "https://eur-lex.europa.eu/eli/reg/2008/1333/oj",
        note: EN,
      },
      {
        org: "美国食品药品监督管理局（FDA）",
        title: "撤销 FD&C Red No. 3 在食品和口服药物中的色素添加剂许可（联邦公报 2025-00830）",
        year: 2025,
        url: "https://www.federalregister.gov/documents/2025/01/16/2025-00830/color-additive-petition-from-center-for-science-in-the-public-interest-et-al-request-to-revoke-color",
        note: EN,
      },
    ],
  },

  "partially-hydrogenated-oil": {
    title: "部分氢化油，以及它为什么正在消失",
    description:
      "部分氢化油是工业反式脂肪的主要来源。这里是世卫组织的建议，以及美国在 2015 年和 2023 年作出的决定。",
    dek: "如果配料表上有部分氢化油，你看到的就是世卫组织希望从食品中清除的反式脂肪的主要来源。",
    body: `
<h2>它是什么</h2>
<p>把液体油部分氢化会让它变硬，同时也会产生反式脂肪。用世卫组织的话说：“工业生产的反式脂肪是通过对任何液体油(在大多数情况下为植物油)进行部分氢化获得的”。${cite(1)}</p>

<h2>世卫组织怎么说</h2>
<p>世卫组织呼吁消除工业生产的反式脂肪，并指出可以“使用较健康的脂肪或油”取而代之。它建议成年人“将反式脂肪摄入量限制在总摄入能量的1%以下，即在每天2000卡路里的饮食中反式脂肪摄入量不应超过2.2克”。${cite(1)}</p>
<p>它也直接说明了原因：“摄入大量反式脂肪会使全因死亡风险增加34%，冠心病死亡风险增加28%，患冠心病风险增加21%。”${cite(1)}</p>

<h2>美国的决定</h2>
<p>2015 年，FDA 认定部分氢化油在任何食品用途中都不再属于公认安全（GRAS）。2023 年，它撤销了最后剩下的使用许可，涉及人造黄油、起酥油和面包，结论是这些用途可能危害健康。该决定于 2023 年 12 月 22 日生效。${cite(2)}</p>

<h2>完全氢化是另一种配料</h2>
<p>美国的这些决定针对的是<em>部分</em>氢化油。完全氢化油是另一种配料，不在其范围内。所以要看清“氢化”前面的那个词。</p>
`,
    inRevely:
      "Revely 能以任何语言认出部分氢化油，并告诉你世卫组织和 FDA 对它的说法，附上日期。",
    sources: [
      {
        org: "世界卫生组织",
        title: "反式脂肪（情况介绍）",
        url: "https://www.who.int/zh/news-room/fact-sheets/detail/trans-fat",
      },
      {
        org: "美国食品药品监督管理局（FDA）",
        title: "撤销部分氢化油在食品中的用途（88 FR 53764），及此前关于部分氢化油的最终认定（80 FR 34650）",
        year: 2023,
        url: "https://www.federalregister.gov/documents/2023/08/09/2023-16725/revocation-of-uses-of-partially-hydrogenated-oils-in-foods",
        note: EN,
      },
    ],
  },

  "salt-and-sodium": {
    title: "盐还是钠：两个数字怎么看",
    description: "欧盟标签标的是盐，美国标签标的是钠。这里告诉你两者怎样换算，以及世卫组织建议每天吃多少。",
    dek: "欧洲的标签给你的是盐，美国的标签给你的是钠。两者不是同一个数，但知道换算方法就很简单。",
    body: `
<h2>世卫组织的建议</h2>
<p>世卫组织建议成人的钠摄入量“低于2000毫克/天（相当于&lt;5克/天的盐）”。对于儿童，它建议根据其能量需要相应下调。${cite(1)}</p>
<p>世卫组织关注的是血压：“与高钠饮食相关的主要健康影响是血压升高”。它还指出，在很多国家，“饮食中的钠有很大一部分来自加工食品”。${cite(1)}</p>

<h2>两者怎样换算</h2>
<p>欧盟标签标注的是盐，法律将其定义为按“盐 = 钠 × 2.5”这个公式算出的盐当量。${cite(2)} 美国标签则以毫克为单位标注钠。</p>
<div class="callout">
  <p><strong>钠 × 2.5 = 盐。</strong>盐 ÷ 2.5 = 钠。</p>
  <p>所以美国标签上的 600 毫克钠就是 1.5 克盐，相当于世卫组织建议上限 5 克的 30%。欧盟标签上的 1 克盐就是 400 毫克钠。</p>
</div>

<h2>配料表里的钠从哪儿来</h2>
<p>带来钠的不只有盐。也要留意这些：</p>
<ul>
  <li>盐、海盐、岩盐、氯化钠</li>
  <li>酱油和鱼露</li>
  <li>谷氨酸钠，也就是味精</li>
  <li>名称里带“钠”字的配料，比如碳酸氢钠，也就是小苏打</li>
</ul>
`,
    inRevely:
      "在档案里加上高血压，Revely 就会在你为这个人扫描的每张标签上指出钠的来源，并附上世卫组织的建议。",
    sources: [
      {
        org: "世界卫生组织",
        title: "减少钠摄入（情况介绍）",
        url: "https://www.who.int/zh/news-room/fact-sheets/detail/salt-reduction",
      },
      EU_1169,
    ],
  },

  "allergen-labeling-us-and-eu": {
    title: "美国和欧盟：标签必须注明哪些过敏原",
    description:
      "美国要求标明 9 种主要过敏原，欧盟要求 14 种。这里是完整对比，以及在美国标签上可能藏在“spice”（香辛料）里的两种。",
    dek: "美国和欧盟都要求标签注明主要过敏原，但两边对哪些算主要过敏原并没有达成一致。",
    body: `
<h2>并排对比</h2>
<div class="scroll">
<table>
  <thead><tr><th scope="col">过敏原</th><th scope="col">美国</th><th scope="col">欧盟</th></tr></thead>
  <tbody>
    <tr><td>牛奶</td><td>是</td><td>是</td></tr>
    <tr><td>蛋</td><td>是</td><td>是</td></tr>
    <tr><td>鱼</td><td>是，并注明鱼的种类</td><td>是</td></tr>
    <tr><td>甲壳类，如蟹、龙虾和虾</td><td>是，并注明种类</td><td>是</td></tr>
    <tr><td>树坚果</td><td>是，并注明坚果种类</td><td>是：杏仁、榛子、核桃、腰果、碧根果、巴西坚果、开心果和夏威夷果</td></tr>
    <tr><td>花生</td><td>是</td><td>是</td></tr>
    <tr><td>小麦</td><td>是</td><td>归入含麸质谷物：小麦、黑麦、大麦、燕麦、斯佩尔特小麦和卡姆小麦</td></tr>
    <tr><td>大豆</td><td>是</td><td>是</td></tr>
    <tr><td>芝麻</td><td>是，自 2023 年 1 月 1 日起</td><td>是</td></tr>
    <tr><td>芹菜</td><td>不要求</td><td>是</td></tr>
    <tr><td>芥末</td><td>不要求</td><td>是</td></tr>
    <tr><td>羽扇豆</td><td>不要求</td><td>是</td></tr>
    <tr><td>软体动物，如贻贝、牡蛎和鱿鱼</td><td>不要求</td><td>是</td></tr>
    <tr><td>亚硫酸盐</td><td>含量达到 10 ppm 或以上时须标明，但不属于主要过敏原</td><td>是，超过 10 mg/kg 时</td></tr>
  </tbody>
</table>
</div>
<p>美国的清单来自《食品过敏原标识和消费者保护法》（FALCPA），该法列出了八种食品；FASTER 法案从 2023 年 1 月 1 日起把芝麻列为第九种。美国标签还必须注明树坚果的种类，以及鱼或甲壳类的品种。${cite(1)} 欧盟的清单是其食品信息条例的附件二。${cite(2)}</p>

<h2>在美国可能藏在“spice”里的两种</h2>
<p>按照美国的规定，芹菜籽和芥末粉都属于香辛料，而香辛料在配料表上可以只写作“spice”。${cite(3)} 芹菜和芥末在美国都不是主要过敏原，所以作为香辛料使用时，没有任何规定要求写出它们的名称。在欧盟标签上，两者都必须写明并加以突出。</p>

<h2>在美国，来自昆虫的色素</h2>
<p>FDA 还要求，胭脂虫提取物（cochineal extract）和胭脂虫红（carmine）这两种用昆虫制成的红色色素，必须在所有食品和化妆品的标签上标明，因为它们已被认定会引起过敏。${cite(1)}</p>

<h2>标注方式</h2>
<p>美国标签会在配料后面加括号，或用“Contains”一行注明过敏原。欧盟标签则在配料表中把它突出显示，通常是粗体。<a href="/zh/guides/how-to-read-an-ingredient-list">更多关于读标签的说明。</a></p>
<p><a href="/zh/allergens">每种过敏原在标签上的各种名称。</a></p>
`,
    inRevely:
      "Revely 会根据你设置的过敏原检查每一张标签，包括欧盟的全部 14 种以及荞麦，也认得它们的别名，比如乳清对应牛奶，芝麻酱对应芝麻。",
    sources: [
      FDA_ALLERGIES,
      EU_1169,
      {
        org: "美国联邦法规",
        title: "21 CFR 101.22 香辛料、香料、色素和化学防腐剂的标示",
        url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-B/section-101.22",
        note: EN,
      },
    ],
  },
};
