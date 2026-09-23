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
 * The closing headline, "Know what you're eating.", is the app's own welcome
 * line in all three languages, so the site uses those exact translations
 * rather than a second opinion on the same sentence. The hero used to carry
 * the whole of that line too. It moved to the close on 2026-09-22, after a
 * conversion review pointed out that "Shop anywhere" evokes the app without
 * saying what it does, and the page's own <title> already said it better.
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
interface Question {
  q: string;
  /** May carry a link. Stripped to text for the structured data. */
  a: string;
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
  qrCaption: string;

  androidSummary: string;
  emailLabel: string;
  androidSubmit: string;
  androidThanks: string;
  androidInvalid: string;
  androidFailed: string;
  /** The same offer, shortened to fit the bar that follows the page down. */
  dockAndroid: string;

  aisleEyebrow: string;
  aisleTitle: string;
  aisleLede: string;
  cards: [Card, Card, Card];
  aside: string;

  doesEyebrow: string;
  doesTitle: string;
  doesLede: string;
  steps: [Step, Step, Step];

  proofEyebrow: string;
  sourcesTitle: string;
  sourcesBody: string;
  agencies: Agency[];

  profilesTitle: string;
  profilesBody: string;

  faqEyebrow: string;
  faqTitle: string;
  faq: Question[];

  closeTitle: string;
  closeLede: string;

  footPrivacy: string;
  footTerms: string;
  footHealth: string;
  disclaimer: string;
  /** Shown only where the documents are not in the page's language. */
  legalNote?: string;
}

/*
 * WHERE THE TESTIMONIALS WENT
 *
 * Three invented quotes sat here from 2026-09-08 to 2026-09-22, and the page
 * source carried a comment saying so to anyone who looked. They were replaced
 * by the questions below. Beyond the credibility problem, fake consumer
 * testimonials are exactly what the FTC's 2024 rule on reviews prohibits.
 *
 * When real quotes arrive they should probably NOT be translated. A quote is
 * somebody's own words, and putting a sentence in their mouth in a language
 * they did not say it in is a different kind of invention. Show the original
 * and, if it matters, a translation beside it.
 *
 * THE PRICE QUESTION. The page used to say nothing about money at all, on the
 * reasoning that half a line naming the trial without the price is a claim
 * needing its own qualifier. The answer below is the whole of it instead:
 * what is free, what needs a subscription, which plan has the trial, where
 * the price is shown and where you cancel. It names no figure, because the
 * figure differs by country and the app shows the real one before anyone pays.
 */
const en: Copy = {
  title: "Revely · Scan any food label, in any language",
  description:
    "Point your camera at any ingredient list, in any language. Revely reads " +
    "it and tells you what it means for your allergies, your conditions, and " +
    "anyone you shop for.",
  ogTitle: "Scan any food label, in any language.",

  switcherLabel: "Language",
  homeLabel: "Revely, home",

  heroTitle: "Scan any food label,<br>in any language.",
  heroLede:
    "Point your camera at the ingredients. Revely reads them, translates " +
    "them, and tells you what they mean for your allergies, your diet, and " +
    "anyone you shop for.",
  cue: "See how it works",
  heroAlt: "A hand holding a phone up to the back of a snack pouch.",
  badgeAlt: "Download on the App Store",
  qrCaption: "Or scan this with your iPhone camera.",

  androidSummary: "On Android? Get told when it’s ready.",
  emailLabel: "Email address",
  androidSubmit: "Notify me",
  androidThanks: "Done. We’ll write once, when Revely is on Android.",
  androidInvalid: "That doesn’t look like an email address. Check it and try again.",
  androidFailed: "That didn’t go through. Try again in a moment.",
  dockAndroid: "Notify me",

  aisleEyebrow: "The aisle",
  aisleTitle: "Reading a label shouldn’t be this hard.",
  aisleLede:
    "Twelve lines of small print, half of them words from a lab. What you " +
    "avoid might be in there, or it might not. Standing in the aisle, " +
    "there’s no way to tell.",
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

  doesEyebrow: "How it works",
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

  proofEyebrow: "Who we quote",
  sourcesTitle: "We show you who says so.",
  sourcesBody:
    "Where there is a published finding on an ingredient, we quote it and " +
    "name who published it. Their words, not our summary. You read it, and " +
    "you decide.",
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
    "Switch to another profile and the scan on screen is checked again " +
    "straight away. No second photo.",

  faqEyebrow: "Questions",
  faqTitle: "Before you download.",
  faq: [
    {
      q: "How accurate is it?",
      a:
        "Revely reads the list printed on the pack in your hand, so a quiet " +
        "recipe change can’t slip past it. A photo can still lose a word to " +
        "glare or a crease, so for a severe allergy, use Revely as a second " +
        "check, not the only one.",
    },
    {
      q: "Does it work without a signal?",
      a:
        "No. Labels are read on our servers, not on the phone, so scanning " +
        "needs a data connection.",
    },
    {
      q: "What happens to my photo?",
      a:
        "It’s read, then deleted. It isn’t kept on our servers or in your " +
        "history. We keep only a fingerprint of the image, which can’t be " +
        "turned back into the photo. The details are in the " +
        "<a href=\"/privacy\">privacy policy</a>.",
    },
    {
      q: "What does it cost?",
      a:
        "Setting up profiles is free, and you’ll see an example scan before " +
        "you pay anything. Scanning your own labels needs a monthly or annual " +
        "subscription, and the annual plan starts with a free trial. The " +
        "price in your currency is shown before you buy, and you can cancel " +
        "any time in your Apple ID settings.",
    },
    {
      q: "Which languages can it read?",
      a:
        "Labels in most languages, shown next to a translation in yours. The " +
        "app itself is in English, Simplified Chinese, and Spanish.",
    },
    {
      q: "Is there an Android version?",
      a:
        "Not yet. <a href=\"#android\">Leave your email</a> and we’ll send one " +
        "message when it’s out, then delete your address.",
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
  ogTitle: "Escanea cualquier etiqueta, en cualquier idioma.",

  switcherLabel: "Idioma",
  homeLabel: "Revely, inicio",

  heroTitle: "Escanea cualquier etiqueta,<br>en cualquier idioma.",
  heroLede:
    "Apunta la cámara a los ingredientes. Revely los lee, los traduce y te " +
    "dice qué significan para tus alergias, tu dieta y para quien tú compras.",
  cue: "Mira cómo funciona",
  heroAlt: "Una mano sostiene un teléfono frente al reverso de una bolsa de snacks.",
  badgeAlt: "Consíguelo en el App Store",
  qrCaption: "O escanea esto con la cámara del iPhone.",

  androidSummary: "¿Tienes Android? Te avisamos cuando esté lista.",
  emailLabel: "Correo electrónico",
  androidSubmit: "Avísame",
  androidThanks: "Listo. Te escribiremos una vez, cuando Revely llegue a Android.",
  androidInvalid:
    "Eso no parece un correo electrónico. Revísalo y vuelve a intentarlo.",
  androidFailed: "No se ha podido enviar. Inténtalo de nuevo en un momento.",
  dockAndroid: "Avísame",

  aisleEyebrow: "El pasillo",
  aisleTitle: "Leer una etiqueta no debería ser tan difícil.",
  aisleLede:
    "Doce líneas de letra pequeña, la mitad con palabras de laboratorio. Lo " +
    "que evitas puede estar ahí, o no. De pie en el pasillo, no hay forma " +
    "de saberlo.",
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

  doesEyebrow: "Cómo funciona",
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

  proofEyebrow: "A quién citamos",
  sourcesTitle: "Te mostramos quién lo dice.",
  sourcesBody:
    "Cuando existe un dictamen publicado sobre un ingrediente, lo citamos y " +
    "decimos quién lo publicó. Sus palabras, no nuestro resumen. Tú lo lees " +
    "y tú decides.",
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
    "Cambia a otro perfil y el escaneo que tienes en pantalla se revisa de " +
    "nuevo al instante. Sin repetir la foto.",

  faqEyebrow: "Preguntas",
  faqTitle: "Antes de descargarla.",
  faq: [
    {
      q: "¿Es fiable?",
      a:
        "Revely lee la lista impresa en el paquete que tienes en la mano, así " +
        "que un cambio discreto de receta no se le escapa. Aun así, un " +
        "reflejo o una arruga pueden tapar una palabra, así que si tu alergia " +
        "es grave, usa Revely como una segunda revisión, no como la única.",
    },
    {
      q: "¿Funciona sin cobertura?",
      a:
        "No. Las etiquetas se leen en nuestros servidores, no en el teléfono, " +
        "así que para escanear necesitas conexión de datos.",
    },
    {
      q: "¿Qué pasa con mi foto?",
      a:
        "Se lee y se borra. No se guarda en nuestros servidores ni en tu " +
        "historial. Solo guardamos una huella de la imagen, que no permite " +
        "reconstruir la foto. Los detalles están en la " +
        "<a href=\"/privacy\">política de privacidad</a> (en inglés).",
    },
    {
      q: "¿Cuánto cuesta?",
      a:
        "Crear perfiles es gratis, y verás un escaneo de ejemplo antes de " +
        "pagar nada. Para escanear tus propias etiquetas necesitas una " +
        "suscripción mensual o anual, y la anual empieza con una prueba " +
        "gratuita. Verás el precio en tu moneda antes de comprar, y puedes " +
        "cancelar cuando quieras en los ajustes de tu Apple ID.",
    },
    {
      q: "¿Qué idiomas puede leer?",
      a:
        "Etiquetas en la mayoría de los idiomas, junto a una traducción al " +
        "tuyo. La app está en inglés, chino simplificado y español.",
    },
    {
      q: "¿Hay versión para Android?",
      a:
        "Todavía no. <a href=\"#android\">Deja tu correo</a> y te enviaremos " +
        "un solo mensaje cuando salga. Después borramos tu dirección.",
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
  ogTitle: "任何语言的食品标签，扫一下就能读懂。",

  switcherLabel: "语言",
  homeLabel: "Revely，首页",

  heroTitle: "任何语言的食品标签，<br>扫一下就能读懂。",
  heroLede:
    "把相机对准配料表。Revely 会读出来、翻译成你的语言，" +
    "并告诉你它对你的过敏、饮食，以及你替之购物的人意味着什么。",
  cue: "看看怎么用",
  heroAlt: "一只手举着手机，对着一袋零食的背面。",
  badgeAlt: "从 App Store 下载",
  qrCaption: "也可以用 iPhone 相机扫这个码。",

  androidSummary: "用安卓手机？上线时通知你。",
  emailLabel: "邮箱地址",
  androidSubmit: "通知我",
  androidThanks: "好了。Revely 上线安卓时，我们会给你发一封邮件。",
  androidInvalid: "这看起来不像邮箱地址，请检查后再试。",
  androidFailed: "没有提交成功，请稍后再试。",
  dockAndroid: "上线通知我",

  aisleEyebrow: "货架前",
  aisleTitle: "看懂配料表，不该这么难。",
  aisleLede:
    "十二行小字，一半是实验室里的词。你要避开的东西可能在里面，也可能不在。" +
    "站在货架前，你没法判断。",
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

  doesEyebrow: "怎么用",
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

  proofEyebrow: "我们引用谁",
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
  profilesBody: "切换到另一份档案，屏幕上的扫描结果会立刻重新核对。不用再拍一次。",

  faqEyebrow: "常见问题",
  faqTitle: "下载之前。",
  faq: [
    {
      q: "准确吗？",
      a:
        "Revely 读的是你手里这包东西上印着的配料表，所以配方悄悄改了也瞒不过它。" +
        "不过照片里的字可能被反光或折痕挡住。如果过敏很严重，" +
        "请把 Revely 当作多一道检查，而不是唯一的检查。",
    },
    {
      q: "没有信号能用吗？",
      a: "不能。标签是在我们的服务器上读取的，不在手机上，所以扫描时需要网络连接。",
    },
    {
      q: "我的照片会怎样？",
      a:
        "读完就删除。我们的服务器和你的扫描记录都不会保留。" +
        "我们只保留图片的一个指纹，它无法还原成照片。" +
        "详情见<a href=\"/privacy\">隐私政策</a>（英文）。",
    },
    {
      q: "要花钱吗？",
      a:
        "建档案是免费的，付费之前你会先看到一次示例扫描。" +
        "扫描你自己的标签需要按月或按年订阅，年订阅从免费试用开始。" +
        "购买前会显示你所在地区货币的价格，你可以随时在 Apple ID 设置里取消。",
    },
    {
      q: "能读哪些语言？",
      a:
        "大多数语言的标签都能读，原文旁边附上你的语言的译文。" +
        "App 本身支持英文、简体中文和西班牙文。",
    },
    {
      q: "有安卓版吗？",
      a:
        "还没有。<a href=\"#android\">留下邮箱</a>，" +
        "上线时我们发一封邮件，然后删除你的地址。",
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
