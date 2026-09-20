/**
 * The website, in the three languages the app speaks.
 *
 * WHY THE LANGUAGE CONSTANTS ARE COPIED RATHER THAN IMPORTED
 *
 * `mobile/src/lib/i18n.tsx` is the source of truth for what Revely speaks and
 * what each language is called. It cannot be imported here: `.dockerignore`
 * excludes mobile/ from the server image, deliberately, because it is 4.7GB of
 * node_modules and Xcode output that the server never reads. So the codes and
 * the names below are duplicated, and they must stay byte-identical to that
 * file. If a fourth language is added there, it has to be added here too.
 *
 * WHERE THE ENGLISH CAME FROM, AND THE OTHER TWO
 *
 * Four of these strings are not new. The hero headline and its line beneath,
 * "Who are we checking for?" and "What's off-limits for you?" are already in
 * the app catalogue in all three languages, so the site uses those exact
 * translations rather than a second opinion on the same sentence. Somebody who
 * reads the page in Spanish and then opens the app should meet the same words.
 *
 * The rest I translated, in the register the catalogue already set: second
 * person, informal "tú" in Spanish, plain and unadorned in Chinese, and no em
 * dashes in any of the three. That register is a decision somebody made about
 * this product and it is not mine to redecide per surface.
 *
 * STILL OPEN: a native reader on the Spanish and Chinese copy. It is accurate
 * and it is idiomatic as far as I can judge, and neither of those is the same
 * as having been read by somebody who speaks it.
 */

/** Must match SUPPORTED_LANGUAGES in mobile/src/lib/i18n.tsx. */
export const SITE_LANGUAGES = ["en", "zh", "es"] as const;
export type Lang = (typeof SITE_LANGUAGES)[number];

export function isLang(code: string): code is Lang {
  return (SITE_LANGUAGES as readonly string[]).includes(code);
}

/** Must match LANGUAGE_NAMES in mobile/src/lib/i18n.tsx. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  zh: "简体中文",
  es: "Español",
};

/**
 * The short form for the switcher. Must match LANGUAGE_CODES in the app.
 *
 * Each language in its own script, never a flag: a flag is a country and a
 * language is not, and "ZH" would be no better, because somebody looking for
 * Chinese is looking for 中文.
 */
export const LANGUAGE_CODES: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  es: "ES",
};

/**
 * What goes in <html lang> and in hreflang.
 *
 * "zh" alone does not say which script. The app's Chinese is Simplified, so
 * the document says so, which is what a screen reader and a translation
 * prompt both need to hear.
 */
export const HTML_LANG: Record<Lang, string> = {
  en: "en",
  zh: "zh-Hans",
  es: "es",
};

interface Card {
  title: string;
  body: string;
}
interface Step {
  num: string;
  title: string;
  body: string;
  alt: string;
}
interface Agency {
  id: string;
  full: string;
  body: string;
}
interface Testimonial {
  quote: string;
  name: string;
  detail: string;
}

export interface Copy {
  title: string;
  description: string;
  ogTitle: string;

  switcherLabel: string;
  homeLabel: string;

  heroTitle: string;
  heroLede: string;
  cue: string;
  heroAlt: string;
  badgeAlt: string;

  aisleEyebrow: string;
  aisleTitle: string;
  aisleLede: string;
  pivotLine: string;
  pivotBody: string;
  cards: [Card, Card, Card];
  aside: string;

  doesEyebrow: string;
  doesTitle: string;
  doesLede: string;
  steps: [Step, Step, Step];

  sourcesTitle: string;
  sourcesBody: string;
  agencies: Agency[];

  profilesTitle: string;
  profilesBody: string;

  photoTitle: string;
  photoBodyBefore: string;
  photoLink: string;
  photoBodyAfter: string;

  quotesEyebrow: string;
  quotesTitle: string;
  testimonials: Testimonial[];

  closeTitle: string;
  closeLede: string;

  footPrivacy: string;
  footTerms: string;
  footHealth: string;
  disclaimer: string;
  /** Shown only where the documents are not in the page's language. */
  legalNote?: string;
}

/**
 * PLACEHOLDER TESTIMONIALS, IN THREE LANGUAGES NOW.
 *
 * Nobody said any of this. Dave asked for them on the page on 2026-09-08
 * having been told twice that they are invented, which is his call, and this
 * note is not an argument with it. It is here so the next person to open the
 * file knows what they are reading.
 *
 * When real quotes arrive they should probably NOT be translated. A quote is
 * somebody's own words, and putting a sentence in their mouth in a language
 * they did not say it in is a different kind of invention. Show the original
 * and, if it matters, a translation beside it.
 */
const en: Copy = {
  title: "Revely · Scan any food label, in any language",
  description:
    "Point your camera at any ingredient list, in any language. Revely reads " +
    "it and tells you what it means for your allergies, your conditions, and " +
    "anyone you shop for.",
  ogTitle: "Shop anywhere. Know what you’re eating.",

  switcherLabel: "Language",
  homeLabel: "Revely, home",

  heroTitle: "Shop anywhere.<br>Know what you’re eating.",
  heroLede:
    "Point your camera at any ingredient list, in any language. We’ll tell " +
    "you what it means for you, and for anyone you shop for.",
  cue: "Why this is hard",
  heroAlt: "A hand holding a phone up to the back of a snack pouch.",
  badgeAlt: "Download on the App Store",

  aisleEyebrow: "The aisle",
  aisleTitle: "You turn the packet over, and you’re none the wiser.",
  aisleLede:
    "Twelve lines of small print, half of them words nobody uses outside a " +
    "laboratory. Somewhere in there is the thing you avoid, or there isn’t. " +
    "There is no way to tell while you are standing there holding it.",
  pivotLine: "Ingredient labels aren’t always easy to decode.",
  pivotBody:
    "You shouldn’t have to Google every ingredient just to understand what " +
    "you’re buying.",
  cards: [
    {
      title: "One ingredient, a dozen names.",
      body:
        "Whey. Casein. Lactose. Sodium caseinate. Every one of them is milk, " +
        "and only one of them says so.",
    },
    {
      title: "The rules keep moving.",
      body:
        "Sesame only became a required allergen label in the US in 2023. The " +
        "EU pulled titanium dioxide out of food in 2022. The US still allows it.",
    },
    {
      title: "And it isn’t always in your language.",
      body:
        "A jar from the Asian grocery. A snack somebody brought back. A pack " +
        "printed for a market that isn’t yours.",
    },
  ],
  aside: "So you put it back on the shelf. Or you buy it and hope.",

  doesEyebrow: "What Revely does",
  doesTitle: "Tell us once. We check every label against it.",
  doesLede:
    "Setting it up takes about a minute. After that the camera does the work.",
  steps: [
    {
      num: "Step one",
      title: "Say who it’s for.",
      body:
        "You, your child, a partner, a parent you cook for. Everyone gets a " +
        "profile of their own.",
      alt:
        "A Revely screen asking who the profile is for, offering yourself, " +
        "your child, or someone you care for.",
    },
    {
      num: "Step two",
      title: "Say what to watch for.",
      body:
        "Allergies, and how strict to be about each one. Conditions you’re " +
        "managing. Diets you keep to.",
      alt:
        "A Revely screen listing allergens as tappable chips, headed with the " +
        "question of what is off-limits for this profile.",
    },
    {
      num: "Step three",
      title: "Then point the camera.",
      body:
        "One word, and the reason under it. The printed label on one side, " +
        "your language on the other.",
      alt:
        "A Revely verdict card reading Avoid because tree nuts are on the " +
        "profile’s list, with the printed Spanish label beside its English " +
        "translation.",
    },
  ],

  sourcesTitle: "We show you who says so.",
  sourcesBody:
    "Where there is a published finding on an ingredient, we quote it and " +
    "name who published it. Their words, not our summary of them. You read " +
    "it, and you decide.",
  agencies: [
    {
      id: "fda",
      full: "US Food and Drug Administration",
      body:
        "Decides which additives may be used in food sold in the United " +
        "States, and in what quantity. When it withdraws an approval or " +
        "requires a warning on a label, that decision is what we quote.",
    },
    {
      id: "efsa",
      full: "European Food Safety Authority",
      body:
        "Gives the EU its scientific advice on food risk, and re-examines " +
        "additives that are already on sale. It is usually the reason the " +
        "same ingredient is treated one way in Europe and another in the US.",
    },
    {
      id: "iarc",
      full: "International Agency for Research on Cancer",
      body:
        "Part of the WHO. It grades how strong the evidence is that something " +
        "can cause cancer, which is not the same as how risky it is in the " +
        "amounts you would actually eat. We quote the grade and say which of " +
        "the two it measures.",
    },
    {
      id: "who",
      full: "World Health Organization",
      body:
        "Sets the international guidance that most national advice on diet is " +
        "built from, including the limits on things like sodium and free sugars.",
    },
  ],

  profilesTitle: "One photo, everybody’s answer.",
  profilesBody:
    "Switch to another profile and the scan already on screen is rechecked " +
    "straight away. You don’t have to take the picture again.",

  photoTitle: "Your photo is used once, then it’s gone.",
  photoBodyBefore:
    "It isn’t kept after it has been read. No advertising, no trackers, " +
    "nothing sold. What we collect and every company that receives anything " +
    "is written out in the ",
  photoLink: "privacy policy",
  photoBodyAfter: ".",

  quotesEyebrow: "What people say",
  quotesTitle: "The aisle gets a lot quieter.",
  testimonials: [
    {
      quote:
        "My son reacts to tree nuts, and cashew hides under about six " +
        "different names. I stopped trusting myself to catch all of them at " +
        "four in the afternoon with a cart. Now I just scan it.",
      name: "Maya R.",
      detail: "Parent of two",
    },
    {
      quote:
        "I lived in Spain for a year and never once read a label properly. " +
        "Revely puts the printed Spanish next to the English and I can " +
        "finally see what I have been eating.",
      name: "Tom W.",
      detail: "Uses it abroad",
    },
    {
      quote:
        "I am not allergic to anything. I just wanted to know what half the " +
        "words meant. It tells me who looked at an ingredient and what they " +
        "found, and then it leaves me alone to decide.",
      name: "Priya S.",
      detail: "Reads everything",
    },
  ],

  closeTitle: "Know what you’re eating.",
  closeLede: "Set up a profile, see an example scan, and take it to the shops.",

  footPrivacy: "Privacy Policy",
  footTerms: "Terms of Use",
  footHealth: "Consumer Health Data Privacy Policy",
  disclaimer:
    "Revely provides ingredient information only. It is not a medical device, " +
    "does not diagnose or treat any condition, and is not a substitute for " +
    "professional medical advice.",
};

const es: Copy = {
  title: "Revely · Lee cualquier etiqueta, en cualquier idioma",
  description:
    "Apunta la cámara a cualquier lista de ingredientes, en cualquier idioma. " +
    "Revely la lee y te dice qué significa para tus alergias, tus " +
    "condiciones y para quien tú compras.",
  // From the app catalogue, so the page and the app say the same sentence.
  ogTitle: "Compra donde sea. Entiende lo que comes.",

  switcherLabel: "Idioma",
  homeLabel: "Revely, inicio",

  heroTitle: "Compra donde sea.<br>Entiende lo que comes.",
  heroLede:
    "Apunta la cámara a cualquier lista de ingredientes, en cualquier idioma. " +
    "Te decimos qué significa para ti, y para quien tú compras.",
  cue: "Por qué cuesta tanto",
  heroAlt: "Una mano sostiene un teléfono frente al reverso de una bolsa de snacks.",
  badgeAlt: "Consíguelo en el App Store",

  aisleEyebrow: "El pasillo",
  aisleTitle: "Le das la vuelta al paquete y sigues igual que antes.",
  aisleLede:
    "Doce líneas de letra pequeña, la mitad con palabras que nadie usa fuera " +
    "de un laboratorio. En algún lugar de ahí está lo que evitas, o no está. " +
    "No hay manera de saberlo mientras lo tienes en la mano.",
  pivotLine: "Las etiquetas de ingredientes no siempre son fáciles de descifrar.",
  pivotBody:
    "No deberías tener que buscar cada ingrediente en Google solo para " +
    "entender lo que estás comprando.",
  cards: [
    {
      title: "Un ingrediente, doce nombres.",
      body:
        "Suero. Caseína. Lactosa. Caseinato de sodio. Todos son leche, y solo " +
        "uno de ellos lo dice.",
    },
    {
      title: "Las reglas no dejan de cambiar.",
      body:
        "El sésamo no fue alérgeno de declaración obligatoria en EE. UU. " +
        "hasta 2023. La UE retiró el dióxido de titanio de los alimentos en " +
        "2022. EE. UU. todavía lo permite.",
    },
    {
      title: "Y no siempre está en tu idioma.",
      body:
        "Un frasco del supermercado asiático. Un snack que alguien trajo de " +
        "viaje. Un paquete impreso para un mercado que no es el tuyo.",
    },
  ],
  aside: "Así que lo dejas en el estante. O lo compras y cruzas los dedos.",

  doesEyebrow: "Qué hace Revely",
  doesTitle: "Dínoslo una vez. Revisamos cada etiqueta con eso en mano.",
  doesLede:
    "Configurarlo lleva un minuto. Después, la cámara hace el trabajo.",
  steps: [
    {
      num: "Paso uno",
      title: "Dinos para quién es.",
      body:
        "Tú, tu hijo, tu pareja, un padre para quien cocinas. Cada uno tiene " +
        "su propio perfil.",
      alt:
        "Una pantalla de Revely que pregunta para quién es el perfil, con las " +
        "opciones de ti mismo, tu hijo o alguien a quien cuidas.",
    },
    {
      num: "Paso dos",
      title: "Dinos qué vigilar.",
      body:
        "Alergias, y cuánto cuidado hace falta con cada una. Condiciones que " +
        "estás manejando. Dietas que sigues.",
      alt:
        "Una pantalla de Revely con los alérgenos como etiquetas pulsables, " +
        "encabezada por la pregunta de qué está prohibido para este perfil.",
    },
    {
      num: "Paso tres",
      title: "Después, apunta la cámara.",
      body:
        "Una palabra, y el motivo debajo. La etiqueta impresa a un lado, tu " +
        "idioma al otro.",
      alt:
        "Una tarjeta de veredicto de Revely que dice Evitar porque los frutos " +
        "secos de árbol están en la lista del perfil, con la etiqueta impresa " +
        "en español junto a su traducción al inglés.",
    },
  ],

  sourcesTitle: "Te mostramos quién lo dice.",
  sourcesBody:
    "Cuando existe un dictamen publicado sobre un ingrediente, lo citamos y " +
    "decimos quién lo publicó. Sus palabras, no nuestro resumen de ellas. Tú " +
    "lo lees y tú decides.",
  agencies: [
    {
      id: "fda",
      full: "Administración de Alimentos y Medicamentos de EE. UU.",
      body:
        "Decide qué aditivos pueden usarse en los alimentos que se venden en " +
        "Estados Unidos, y en qué cantidad. Cuando retira una autorización o " +
        "exige una advertencia en la etiqueta, esa decisión es lo que citamos.",
    },
    {
      id: "efsa",
      full: "Autoridad Europea de Seguridad Alimentaria",
      body:
        "Da a la UE su asesoría científica sobre riesgo alimentario, y vuelve " +
        "a examinar aditivos que ya están a la venta. Suele ser el motivo por " +
        "el que el mismo ingrediente se trata de una manera en Europa y de " +
        "otra en Estados Unidos.",
    },
    {
      id: "iarc",
      full: "Agencia Internacional para la Investigación del Cáncer",
      body:
        "Forma parte de la OMS. Clasifica la solidez de la evidencia de que " +
        "algo pueda causar cáncer, lo cual no es lo mismo que el riesgo real " +
        "en las cantidades que de verdad comerías. Citamos la clasificación y " +
        "decimos cuál de las dos cosas mide.",
    },
    {
      id: "who",
      full: "Organización Mundial de la Salud",
      body:
        "Fija la orientación internacional sobre la que se construye casi " +
        "todo el consejo nacional en materia de dieta, incluidos los límites " +
        "de cosas como el sodio y los azúcares libres.",
    },
  ],

  profilesTitle: "Una foto, la respuesta de cada uno.",
  profilesBody:
    "Cambia a otro perfil y el escaneo que ya tienes en pantalla se revisa de " +
    "nuevo al instante. No hace falta volver a hacer la foto.",

  photoTitle: "Tu foto se usa una vez y desaparece.",
  photoBodyBefore:
    "No se guarda después de leerla. Sin publicidad, sin rastreadores, sin " +
    "vender nada. Lo que recogemos y cada empresa que recibe algo está " +
    "escrito en la ",
  photoLink: "política de privacidad",
  photoBodyAfter: ".",

  quotesEyebrow: "Lo que dice la gente",
  quotesTitle: "El pasillo se vuelve mucho más tranquilo.",
  testimonials: [
    {
      quote:
        "Mi hijo reacciona a los frutos secos de árbol, y el anacardo se " +
        "esconde bajo unos seis nombres distintos. Dejé de confiar en que los " +
        "vería todos a las cuatro de la tarde con el carrito. Ahora " +
        "simplemente lo escaneo.",
      name: "Maya R.",
      detail: "Madre de dos",
    },
    {
      quote:
        "Viví un año en España y nunca leí bien una etiqueta. Revely pone el " +
        "español impreso junto al inglés y por fin veo lo que he estado " +
        "comiendo.",
      name: "Tom W.",
      detail: "Lo usa en el extranjero",
    },
    {
      quote:
        "No soy alérgico a nada. Solo quería saber qué significaba la mitad " +
        "de las palabras. Me dice quién examinó un ingrediente y qué " +
        "encontró, y luego me deja decidir en paz.",
      name: "Priya S.",
      detail: "Lo lee todo",
    },
  ],

  closeTitle: "Entiende lo que comes.",
  closeLede:
    "Crea un perfil, mira un escaneo de ejemplo y llévatelo a la compra.",

  footPrivacy: "Política de Privacidad",
  footTerms: "Términos de Uso",
  footHealth: "Política de Privacidad de Datos de Salud del Consumidor",
  disclaimer:
    "Revely solo ofrece información sobre ingredientes. No es un producto " +
    "sanitario, no diagnostica ni trata ninguna condición, y no sustituye el " +
    "consejo de un profesional médico.",
  legalNote: "Los documentos legales están disponibles en inglés.",
};

const zh: Copy = {
  title: "Revely · 读懂任何语言的食品标签",
  description:
    "把相机对准任何一份配料表，不管是什么语言。Revely 会读出来，" +
    "并告诉你它对你的过敏、你的身体状况，以及你替谁买东西意味着什么。",
  // From the app catalogue, so the page and the app say the same sentence.
  ogTitle: "在哪买都行，吃什么心里有数。",

  switcherLabel: "语言",
  homeLabel: "Revely，首页",

  heroTitle: "在哪买都行，<br>吃什么心里有数。",
  heroLede:
    "把相机对准任何一份配料表，不管是什么语言。我们会告诉你它对你意味着什么，" +
    "也告诉你它对你替之购物的人意味着什么。",
  cue: "为什么这件事不容易",
  heroAlt: "一只手举着手机，对着一袋零食的背面。",
  badgeAlt: "从 App Store 下载",

  aisleEyebrow: "货架前",
  aisleTitle: "包装翻到背面，你还是不知道里面是什么。",
  aisleLede:
    "十二行小字，一半是实验室以外没人会用的词。你要避开的东西也许就在里面，" +
    "也许根本没有。站在货架前拿着它的时候，你没有办法判断。",
  pivotLine: "配料表并不总是容易看懂。",
  pivotBody: "只是想知道自己买的是什么，不该需要把每一种成分都上网查一遍。",
  cards: [
    {
      title: "同一种东西，十几个名字。",
      body: "乳清、酪蛋白、乳糖、酪蛋白酸钠。它们全都是奶，而只有一个名字说了出来。",
    },
    {
      title: "规则一直在变。",
      body:
        "芝麻直到 2023 年才成为美国强制标示的过敏原。欧盟在 2022 年把二氧化钛" +
        "从食品中撤了下来，美国至今仍然允许使用。",
    },
    {
      title: "而且未必是你看得懂的语言。",
      body: "亚洲超市买的一瓶酱料。别人从外地带回来的零食。为另一个市场印制的包装。",
    },
  ],
  aside: "于是你把它放回货架。或者买下来，然后指望没事。",

  doesEyebrow: "Revely 做什么",
  doesTitle: "告诉我们一次，之后每一张标签我们都照着核对。",
  doesLede: "设置大约需要一分钟。之后交给相机。",
  steps: [
    {
      num: "第一步",
      title: "告诉我们这是为谁建的。",
      body: "你自己、你的孩子、伴侣、你替之做饭的长辈。每个人都有自己的档案。",
      alt: "Revely 的一个界面，询问这份档案是为谁建立的，可选自己、孩子或你照顾的人。",
    },
    {
      num: "第二步",
      title: "告诉我们要留意什么。",
      body: "过敏，以及每一项要多小心。你正在应对的身体状况。你在坚持的饮食方式。",
      alt: "Revely 的一个界面，把过敏原列成可点选的标签，上方问这份档案有什么绝对不能碰。",
    },
    {
      num: "第三步",
      title: "然后把相机对上去。",
      body: "一个词，下面是理由。一边是印在包装上的原文，另一边是你的语言。",
      alt:
        "Revely 的结论卡显示「避免」，因为坚果在这份档案的清单上，" +
        "印在包装上的西班牙文与英文译文并排列出。",
    },
  ],

  sourcesTitle: "我们告诉你这是谁说的。",
  sourcesBody:
    "只要某种成分有已发表的结论，我们就把它引出来，并写明是谁发表的。" +
    "是他们的原话，不是我们的概括。你自己读，你自己决定。",
  agencies: [
    {
      id: "fda",
      full: "美国食品药品监督管理局",
      body:
        "决定在美国销售的食品里可以使用哪些添加剂，以及用量多少。" +
        "当它撤销某项许可或要求在标签上加警示时，我们引用的就是那个决定。",
    },
    {
      id: "efsa",
      full: "欧洲食品安全局",
      body:
        "为欧盟提供食品风险方面的科学意见，并重新评估已经在售的添加剂。" +
        "同一种成分在欧洲和美国被区别对待，通常就是因为它。",
    },
    {
      id: "iarc",
      full: "国际癌症研究机构",
      body:
        "隶属于世界卫生组织。它评的是「某种东西会致癌」这一点的证据有多强，" +
        "而不是按你实际会吃到的量算出来的风险有多高。" +
        "我们引用它的分级，并说明这个分级衡量的是哪一件事。",
    },
    {
      id: "who",
      full: "世界卫生组织",
      body:
        "制定国际层面的指导意见，各国的膳食建议大多以此为基础，" +
        "其中包括钠和游离糖之类的摄入上限。",
    },
  ],

  profilesTitle: "一张照片，每个人都有自己的答案。",
  profilesBody:
    "切换到另一份档案，屏幕上已有的扫描结果会立刻重新核对一遍。不用再拍一次。",

  photoTitle: "你的照片只用一次，然后就没了。",
  photoBodyBefore:
    "读完之后不会保留。没有广告，没有追踪，什么都不出售。" +
    "我们收集什么、以及每一家会收到任何东西的公司，都写在",
  photoLink: "隐私政策",
  photoBodyAfter: "里。",

  quotesEyebrow: "大家怎么说",
  quotesTitle: "在货架前，心里安静多了。",
  testimonials: [
    {
      quote:
        "我儿子对坚果有反应，而腰果能藏在六七个不同的名字底下。" +
        "下午四点推着购物车的时候，我不再相信自己每一个都能看出来。现在我直接扫一下。",
      name: "Maya R.",
      detail: "两个孩子的家长",
    },
    {
      quote:
        "我在西班牙住过一年，从来没有真正读懂过一张标签。" +
        "Revely 把印着的西班牙文和英文并排放在一起，我终于看清自己一直在吃什么。",
      name: "Tom W.",
      detail: "在国外使用",
    },
    {
      quote:
        "我什么都不过敏，只是想知道那一半的词到底是什么意思。" +
        "它告诉我谁研究过某种成分、结论是什么，然后就让我自己安静地决定。",
      name: "Priya S.",
      detail: "什么都要读一遍",
    },
  ],

  closeTitle: "吃什么心里有数。",
  closeLede: "建一份档案，看一次示例扫描，然后带着它去买东西。",

  footPrivacy: "隐私政策",
  footTerms: "使用条款",
  footHealth: "消费者健康数据隐私政策",
  disclaimer:
    "Revely 只提供成分信息。它不是医疗器械，不诊断也不治疗任何疾病，" +
    "也不能替代专业医疗建议。",
  legalNote: "法律文件目前仅提供英文版本。",
};

export const COPY: Record<Lang, Copy> = { en, zh, es };
