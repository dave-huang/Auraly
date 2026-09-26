import type { GuideSource } from "./guideContent";

/**
 * The additive pages in Simplified Chinese: the hand-written half, as
 * additiveContent.ts is for English. The sentences themselves are in
 * additives.ts.
 *
 * NAMES are the ones a Chinese label uses, following the names in GB 2760
 * (the national standard for the use of food additives) where it has one,
 * with a common second name in brackets where labels use both: 谷氨酸钠（味精）.
 *
 * None of the sources publishes an official Chinese text, so nothing is in
 * quotation marks except an English term quoted as the source wrote it, and
 * every source is marked （英文）.
 *
 * No em dashes (——) in anything a reader sees.
 */

export const EN = "（英文）";

export const ADDITIVE_NAMES_ZH: Record<string, string> = {
  E100: "姜黄素", E101: "核黄素", E102: "柠檬黄", E104: "喹啉黄", E110: "日落黄",
  E120: "胭脂虫红", E122: "偶氮玉红", E123: "苋菜红", E124: "胭脂红", E127: "赤藓红",
  E129: "诱惑红", E131: "专利蓝 V", E132: "靛蓝", E133: "亮蓝", E140: "叶绿素",
  E141: "叶绿素铜钠盐", E142: "绿色 S", E150a: "普通焦糖色", E150c: "氨法焦糖色",
  E150d: "亚硫酸铵法焦糖色", E151: "亮黑 BN", E153: "植物炭黑", E155: "棕色 HT",
  E160a: "β-胡萝卜素", E160b: "胭脂树橙", E160c: "辣椒红", E160d: "番茄红素",
  E160e: "β-阿朴-8′-胡萝卜素醛", E161b: "叶黄素", E162: "甜菜红", E163: "花青素",
  E170: "碳酸钙", E171: "二氧化钛", E172: "氧化铁", E173: "铝", E174: "银", E175: "金",
  E200: "山梨酸", E202: "山梨酸钾", E203: "山梨酸钙", E210: "苯甲酸", E211: "苯甲酸钠",
  E212: "苯甲酸钾", E213: "苯甲酸钙", E220: "二氧化硫", E221: "亚硫酸钠", E222: "亚硫酸氢钠",
  E223: "焦亚硫酸钠", E224: "焦亚硫酸钾", E226: "亚硫酸钙", E228: "亚硫酸氢钾",
  E234: "乳酸链球菌素", E235: "纳他霉素", E239: "乌洛托品", E242: "二甲基二碳酸盐",
  E249: "亚硝酸钾", E250: "亚硝酸钠", E251: "硝酸钠", E252: "硝酸钾", E260: "乙酸",
  E261: "乙酸钾", E262: "乙酸钠", E263: "乙酸钙", E270: "乳酸", E280: "丙酸", E281: "丙酸钠",
  E282: "丙酸钙", E284: "硼酸", E285: "硼砂", E290: "二氧化碳", E296: "苹果酸", E297: "富马酸",
  E300: "抗坏血酸（维生素 C）", E301: "抗坏血酸钠", E302: "抗坏血酸钙",
  E304: "抗坏血酸棕榈酸酯", E306: "生育酚（维生素 E）", E307: "α-生育酚", E308: "γ-生育酚",
  E309: "δ-生育酚", E310: "没食子酸丙酯", E315: "异抗坏血酸", E316: "异抗坏血酸钠",
  E319: "特丁基对苯二酚（TBHQ）", E320: "丁基羟基茴香醚（BHA）", E321: "二丁基羟基甲苯（BHT）",
  E322: "磷脂", E325: "乳酸钠", E326: "乳酸钾", E327: "乳酸钙", E330: "柠檬酸",
  E331: "柠檬酸钠", E332: "柠檬酸钾", E333: "柠檬酸钙", E334: "酒石酸", E335: "酒石酸钠",
  E336: "酒石酸钾", E338: "磷酸", E339: "磷酸钠", E340: "磷酸钾", E341: "磷酸钙",
  E385: "乙二胺四乙酸二钠钙", E392: "迷迭香提取物", E400: "海藻酸", E401: "海藻酸钠",
  E402: "海藻酸钾", E404: "海藻酸钙", E405: "海藻酸丙二醇酯", E406: "琼脂", E407: "卡拉胶",
  E410: "刺槐豆胶", E412: "瓜尔胶", E413: "黄蓍胶", E414: "阿拉伯胶", E415: "黄原胶",
  E416: "刺梧桐胶", E417: "他拉胶", E418: "结冷胶", E420: "山梨糖醇", E421: "甘露糖醇",
  E422: "甘油", E432: "吐温 20", E433: "吐温 80", E435: "吐温 60", E440: "果胶",
  E442: "磷脂酸铵", E450: "酸式焦磷酸钠", E451: "三聚磷酸钠", E452: "六偏磷酸钠",
  E460: "微晶纤维素", E461: "甲基纤维素", E463: "羟丙基纤维素", E464: "羟丙基甲基纤维素",
  E466: "羧甲基纤维素钠", E470a: "脂肪酸钙盐", E470b: "脂肪酸镁盐",
  E471: "单双甘油脂肪酸酯", E472a: "乙酰化单双甘油脂肪酸酯", E472b: "乳酸脂肪酸甘油酯",
  E472c: "柠檬酸脂肪酸甘油酯", E472e: "双乙酰酒石酸单双甘油酯", E473: "蔗糖脂肪酸酯",
  E475: "聚甘油脂肪酸酯", E476: "聚甘油蓖麻醇酸酯（PGPR）", E477: "丙二醇脂肪酸酯",
  E481: "硬脂酰乳酸钠", E482: "硬脂酰乳酸钙", E491: "司盘 60", E500: "碳酸钠",
  E501: "碳酸钾", E503: "碳酸铵", E504: "碳酸镁", E507: "盐酸", E508: "氯化钾", E509: "氯化钙",
  E511: "氯化镁", E516: "硫酸钙", E524: "氢氧化钠", E525: "氢氧化钾", E526: "氢氧化钙",
  E551: "二氧化硅", E552: "硅酸钙", E553b: "滑石粉", E570: "脂肪酸",
  E575: "葡萄糖酸-δ-内酯", E578: "葡萄糖酸钙", E620: "谷氨酸", E621: "谷氨酸钠（味精）",
  E627: "5′-鸟苷酸二钠", E631: "5′-肌苷酸二钠", E635: "5′-呈味核苷酸二钠", E640: "甘氨酸",
  E900: "聚二甲基硅氧烷", E901: "蜂蜡", E903: "巴西棕榈蜡", E904: "紫胶", E905: "微晶蜡",
  E920: "L-半胱氨酸", E938: "氩气", E941: "氮气", E948: "氧气", E950: "安赛蜜",
  E951: "阿斯巴甜", E952: "甜蜜素", E953: "异麦芽酮糖醇", E954: "糖精", E955: "三氯蔗糖",
  E957: "索马甜", E959: "新橙皮苷二氢查耳酮", E960: "甜菊糖苷", E961: "纽甜",
  E962: "阿斯巴甜-安赛蜜盐", E965: "麦芽糖醇", E966: "乳糖醇", E967: "木糖醇", E968: "赤藓糖醇",
  E969: "爱德万甜", E1103: "转化酶", E1105: "溶菌酶", E1200: "聚葡萄糖", E1404: "氧化淀粉",
  E1412: "磷酸酯双淀粉", E1414: "乙酰化双淀粉磷酸酯", E1420: "醋酸酯淀粉",
  E1422: "乙酰化双淀粉己二酸酯", E1442: "羟丙基二淀粉磷酸酯", E1450: "辛烯基琥珀酸淀粉钠",
  E1505: "柠檬酸三乙酯", E1518: "三乙酸甘油酯", E1520: "丙二醇",
};

/** By family slug. */
export const FAMILIES_ZH: Record<string, { label: string; noun: string }> = {
  colors: { label: "着色剂", noun: "着色剂" },
  preservatives: { label: "防腐剂", noun: "防腐剂" },
  antioxidants: { label: "抗氧化剂和酸度调节剂", noun: "抗氧化剂和酸度调节剂" },
  thickeners: { label: "增稠剂、稳定剂和乳化剂", noun: "增稠剂、稳定剂和乳化剂" },
  acidity: { label: "酸度调节剂和抗结剂", noun: "酸度调节剂和抗结剂" },
  "flavor-enhancers": { label: "增味剂", noun: "增味剂" },
  "glazing-sweeteners": { label: "被膜剂、气体和甜味剂", noun: "被膜剂、气体和甜味剂" },
  other: { label: "其他添加剂", noun: "酶、改性淀粉和其他添加剂" },
};

/** The FDA inventory's "used for" terms (21 CFR 170.3(o)), in Chinese. */
export const FDA_USES_ZH: Record<string, string> = {
  "ANTICAKING AGENT OR FREE-FLOW AGENT": "抗结剂或流动剂",
  "ANTIMICROBIAL AGENT": "抗菌剂",
  ANTIOXIDANT: "抗氧化剂",
  "COLOR OR COLORING ADJUNCT": "着色剂或着色辅料",
  "CURING OR PICKLING AGENT": "腌制剂",
  "DOUGH STRENGTHENER": "面团强化剂",
  "DRYING AGENT": "干燥剂",
  "EMULSIFIER OR EMULSIFIER SALT": "乳化剂或乳化盐",
  "FIRMING AGENT": "硬化剂",
  "FLAVOR ENHANCER": "增味剂",
  "FLAVORING AGENT OR ADJUVANT": "香料或香料辅料",
  "FLOUR TREATING AGENT": "面粉处理剂",
  "FORMULATION AID": "配方助剂",
  FUMIGANT: "熏蒸剂",
  HUMECTANT: "水分保持剂",
  "LEAVENING AGENT": "膨松剂",
  "LUBRICANT OR RELEASE AGENT": "润滑剂或脱模剂",
  "MALTING OR FERMENTING AID": "制麦或发酵助剂",
  "MASTICATORY SUBSTANCE": "咀嚼物质",
  "NON-NUTRITIVE SWEETENER": "非营养性甜味剂",
  "NUTRIENT SUPPLEMENT": "营养补充剂",
  "NUTRITIVE SWEETENER": "营养性甜味剂",
  "OXIDIZING OR REDUCING AGENT": "氧化剂或还原剂",
  "PH CONTROL AGENT": "酸度调节剂",
  "PROCESSING AID": "加工助剂",
  PROPELLANT: "推进剂",
  SEQUESTRANT: "螯合剂",
  "SOLVENT OR VEHICLE": "溶剂或载体",
  "STABILIZER OR THICKENER": "稳定剂或增稠剂",
  "SURFACE-ACTIVE AGENT": "表面活性剂",
  "SURFACE-FINISHING AGENT": "表面处理剂",
  TEXTURIZER: "质构改良剂",
  TRACER: "示踪剂",
  "WASHING OR SURFACE REMOVAL AGENT": "清洗剂或去皮剂",
};

/** The page's own sources, in Chinese. Checked 2026-09-26. */
export const ADDITIVE_SOURCES_ZH: Record<string, GuideSource> = {
  "efsa-adi": {
    org: "欧洲食品安全局（EFSA）",
    title: "Glossary: acceptable daily intake（术语：每日允许摄入量）",
    url: "https://www.efsa.europa.eu/en/glossary/acceptable-daily-intake",
    note: EN,
  },
  iarc: {
    org: "国际癌症研究机构（IARC）",
    title: "IARC Monographs: Questions and Answers（问答）",
    url: "https://monographs.iarc.who.int/wp-content/uploads/2018/07/IARCMonographs-QA.pdf",
    note: EN,
  },
  "eu-1333": {
    org: "欧盟",
    title: "第 1333/2008 号条例：食品添加剂，附件五",
    year: 2008,
    url: "https://eur-lex.europa.eu/eli/reg/2008/1333/oj",
    note: EN,
  },
  "eu-2022-63": {
    org: "欧盟委员会",
    title: "第 2022/63 号条例：修订第 1333/2008 号条例附件二和附件三中有关食品添加剂二氧化钛（E 171）的规定",
    year: 2022,
    url: "https://eur-lex.europa.eu/eli/reg/2022/63/oj",
    note: EN,
  },
  "fda-inventory": {
    org: "美国食品药品监督管理局（FDA）",
    title: "Substances Added to Food（食品添加物质清单）",
    url: "https://www.hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances",
    note: EN,
  },
};

/** The bodies behind the evidence records, by the name the record gives. */
export const ORGS_ZH: Record<string, string> = {
  EFSA: "欧洲食品安全局（EFSA）",
  IARC: "国际癌症研究机构（IARC）",
  "International Agency for Research on Cancer": "国际癌症研究机构（IARC）",
  "US FDA": "美国食品药品监督管理局（FDA）",
  "US Food and Drug Administration": "美国食品药品监督管理局（FDA）",
  "California OEHHA": "加州环境健康危害评估办公室（OEHHA）",
  "Joint FAO/WHO Expert Committee on Food Additives": "粮农组织/世卫组织食品添加剂联合专家委员会（JECFA）",
  "European Commission": "欧盟委员会",
  "European Union": "欧盟",
};
