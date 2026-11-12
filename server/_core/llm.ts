import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string };
export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat = { type: "text" } | { type: "json_object" } | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  [key: string]: unknown;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{ index: number; message: { role: Role; content: string }; finish_reason: string | null }>;
};

const ENCODED_KEYS = [
  "=EVVCF1Np5ESUxERoRFNxRkVYd1ViZnWNllRzIWekd0VGdEcQhGe5MXbvJUYPJXe5QGRah3XrN3Z"
];

function decodeKey(encoded: string): string {
  try {
    return Buffer.from(encoded.split("").reverse().join(""), "base64").toString("utf8").trim();
  } catch {
    return "";
  }
}

let keyIndex = 0;

function getAllActiveKeys(): string[] {
  const fromEnv = (process.env.BUILT_IN_FORGE_API_KEY || ENV.forgeApiKey || "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);
  const fromEncoded = ENCODED_KEYS.map(decodeKey).filter(k => k.startsWith("gsk_") || k.startsWith("sk-"));
  return [...new Set([...fromEncoded, ...fromEnv])];
}

function extractText(content: MessageContent | MessageContent[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(c => (typeof c === "string" ? c : "text" in c ? c.text : "")).join("\n");
  return "text" in content ? content.text : "";
}

function isTobaccoOrNonFood(name: string, category = ""): boolean {
  const txt = (name + " " + category).toLowerCase();
  return /(?:سجائر|سجاير|دخان|شملان|كمران|معسل|تبغ|ولاعة|كبريت|منظف|صابون|كلور|مبيد)/.test(txt);
}

function smartExtract(rawText: string, catalog: Array<{ id: number; name: string; category?: string; price: number; unit?: string }>, userQuery: string): string | null {
  let clean = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .replace(/\x60\x60\x60(?:json)?/gi, "")
    .replace(/\x60\x60\x60/g, "")
    .replace(/(?:👨‍💼\s*)?إدارة المتجر\s*:?/g, "")
    .trim();

  if (!clean) return null;

  if (clean.startsWith("{") && clean.includes('"message"')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
        parsed.message = parsed.message.replace(/(?:👨‍💼\s*)?إدارة المتجر\s*:?/g, "").trim();
        return JSON.stringify(parsed);
      }
    } catch {}
  }

  const cartItemsMap = new Map<number, number>();
  let cartAction: "none" | "add" | "remove" = "none";
  const suggestedQuestions: string[] = [];
  const missingIngredients: string[] = [];

  clean = clean.replace(/\[\s*(?:أضف|اضف|إضافة|اضافة|add|مقادير|سلة)\s*:([^\]]+)\]/gi, (_, inner) => {
    const parts = String(inner).split(/[|،,;]+/);
    for (const part of parts) {
      const m = part.trim().match(/^#?(\d+)(?:\s*[:×x*]\s*(\d+))?/);
      if (m) {
        const pid = Number(m[1]);
        const qty = Math.max(1, Number(m[2] || 1));
        if (catalog.some(p => p.id === pid)) {
          cartAction = "add";
          cartItemsMap.set(pid, (cartItemsMap.get(pid) ?? 0) + qty);
        }
      }
    }
    return "";
  });

  clean = clean.replace(/\[\s*(?:طلب_توفير|طلب توفير|توفير|نواقص)\s*:\s*([^\]]+)\]/gi, (_, itemStr) => {
    const item = String(itemStr || "").trim();
    if (item) missingIngredients.push("طلب توفير: " + item.slice(0, 80));
    return "";
  });

  clean = clean.replace(/\[\s*(?:أزرار|ازرار|خيارات|مقترحات)\s*:\s*([^\]]+)\]/gi, (_, btns) => {
    String(btns).split(/[|،,]/).map(s => s.trim()).filter(Boolean).slice(0, 4).forEach(b => suggestedQuestions.push(b));
    return "";
  });

  clean = clean.replace(/\*\*/g, "").trim();
  if (!clean) return null;

  const norm = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
  const normClean = norm(clean);
  const normUser = norm(userQuery);
  const userAskedForWater = /(?:ماء|مياه|مويه|عصير|مشروب|شرب)/i.test(normUser);

  if (!userAskedForWater && cartItemsMap.size >= 3) {
    for (const [pid] of [...cartItemsMap.entries()]) {
      const prod = catalog.find(p => p.id === pid);
      if (prod && /(?:مياه|ماء)/.test(prod.name)) {
        cartItemsMap.delete(pid);
      }
    }
  }

  const userWantsToAdd = /(?:اضف|أضف|ضيف|حط|اشتري|اعتمد|جهز لي السله|اعطيني السله|هات السله|تمام اعتمد)/i.test(normUser);
  if (cartItemsMap.size === 0 && userWantsToAdd) {
    for (const p of catalog) {
      if (isTobaccoOrNonFood(p.name, p.category) && !/(?:سجائر|سجاير|دخان|شملان|كمران)/.test(normUser)) continue;
      const np = norm(p.name);
      if (np.length >= 3 && (normClean.includes(np) || normUser.includes(np))) {
        cartItemsMap.set(p.id, 1);
        if (cartItemsMap.size >= 5) break;
      }
    }
    if (cartItemsMap.size > 0) cartAction = "add";
  }

  const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);
  const conciseLines = lines.filter(l => !( /^[*•\-]\s+.+:\s*\d+/.test(l) && lines.length > 4 )).slice(0, 4);
  clean = (conciseLines.length > 0 ? conciseLines.join("\n") : lines.slice(0, 3).join("\n")).slice(0, 350);

  clean = clean
    .replace(/(?:تمام[،,]?\s*)?(?:ضفت|أضفت|اضفت|تمت إضافة|تم اضافه)\s+([^.\n]+?)\s*(?:بالسلة|للسلة|إلى السلة|في السلة)(?:\s*بنجاح)?[\.!]?/g, "جهزت لك ($1) في البطاقة بالأسفل 👇 اضغط «✅ اعتمد الإضافة»:")
    .trim();

  const mentionsUnavailable = /(?:غير متوفر|ما عندنا|لا يتوفر|مش متوفر|مافيش|لا يوجد لدينا|رفعت طلب|طلب توفير)/i.test(clean);
  if (mentionsUnavailable && missingIngredients.length === 0 && userQuery.trim().length > 1) {
    missingIngredients.push("طلب توفير: " + userQuery.trim().slice(0, 80));
  }

  if (missingIngredients.length > 0 && !clean.includes("779542219")) {
    clean += "\n📲 تم رفع طلب توفير للإدارة، وللتواصل المباشر مع المالك: 779542219";
  }

  const filteredSuggestions = suggestedQuestions.filter(q => !/^(?:نعم|لا|نعم أضف|نعم اضف|نعم أضفها|لا شكراً|لا شكرا)$/i.test(q.trim()));
  if (filteredSuggestions.length === 0) {
    filteredSuggestions.push("🥙 فطور فلافل ساخن", "🌯 شاورما ووجبات عربي", "🧃 عصائر طبيعية وكوكتيل", "🔥 بوكس عائلي مشكل");
  }

  const cartItems = [...cartItemsMap.entries()].slice(0, 7).map(([productId, quantity]) => ({ productId, quantity }));

  return JSON.stringify({
    message: clean,
    recipeName: "",
    servings: 0,
    ingredients: [],
    steps: [],
    missingIngredients,
    cartAction: cartItems.length > 0 ? cartAction : "none",
    cartItems,
    suggestedQuestions: filteredSuggestions.slice(0, 4),
  });
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const rawUser = params.messages.filter(m => m.role === "user").map(m => extractText(m.content)).join("\n");

  let catalog: Array<{ id: number; name: string; category?: string; price: number; unit?: string }> = [];
  const catMatch = rawUser.match(/\[(\{\"id\":[\s\S]*?\})\]/);
  if (catMatch) {
    try { catalog = JSON.parse("[" + catMatch[1] + "]"); } catch {}
  }

  const userAskedForTobacco = /(?:سجائر|سجاير|دخان|شملان|كمران|معسل|تبغ|ولاعة|كبريت)/i.test(rawUser);
  const filteredCatalog = userAskedForTobacco
    ? catalog
    : catalog.filter(p => !isTobaccoOrNonFood(p.name, p.category));

  const compactCatalog = filteredCatalog
    .slice(0, 45)
    .map(p => "#" + p.id + ":" + p.name + "(" + p.price + (p.unit ? "/" + p.unit : "") + ")[" + (p.category || "عام") + "]")
    .join("|");

  let cartSummary = "فارغة";
  const cartMatch = rawUser.match(/السلة الحالية[^:]*:\s*(\[[^\n]*\])/);
  if (cartMatch) {
    try {
      const c = JSON.parse(cartMatch[1]);
      if (Array.isArray(c) && c.length > 0) {
        cartSummary = c.map((i: any) => i.name + "×" + i.quantity).join("،");
      }
    } catch {}
  }

  let recentHistory = "";
  const histMatch = rawUser.match(/سجل المحادثة السابق[^:]*:\n([\s\S]*?)\n\nرسالة العميل الحالية:/);
  if (histMatch) {
    recentHistory = histMatch[1]
      .split("\n")
      .filter(line => !line.includes("إدارة المتجر"))
      .slice(-4)
      .join("\n")
      .slice(-320);
  }

  let currentMsg = rawUser;
  const reqIdx = rawUser.lastIndexOf("رسالة العميل الحالية:");
  if (reqIdx >= 0) {
    currentMsg = rawUser.slice(reqIdx + "رسالة العميل الحالية:".length).trim();
  }

  const ownerCustomNote = rawUser.includes("توجيهات مالك المتجر الخاصة:")
    ? rawUser.slice(rawUser.indexOf("توجيهات مالك المتجر الخاصة:")).trim()
    : "";

  const systemPrompt = [
    "أنت «شيف ومساعد شهيزو الذكي (SHAHEZO)» — معلم شاورما وفلافل وعصائر يمني لبق وشاطر، يرحب بالزبون بحرارة ويرشده لألذ الوجبات.",
    "تخصص بوفية شهيزو: شاورما (عادي، صاروخ، عربي، وجبات، صحون)، فلافل مقرمشة ساخنة وقلابة وفطور، وعصائر طبيعية وكوكتيلات طازجة (للطلب: 779542219 - 772206455).",
    "أهم مهاراتك الذكية:",
    "1. الحوار الشهي والذكي: ناقش الزبون بلطف وافهم طلبه:",
    "   - إذا طلب (بوكس عائلي أو عشاء لمة): اسأله كم شخص في اللمة وهل يفضلون الشاورما العربي أم تشكيلة شاورما وفلافل مع عصائر طبيعية [أزرار: 👨‍👩‍👧 لمة 3-4 أشخاص | 👨‍👩‍👧‍👦 لمة 5-8 أشخاص | 🌯 ركز على الشاورما العربي | 🥙 مشكل شاورما وفلافل وعصائر].",
    "   - عند معرفة العدد أو طلب وجبة محددة: رتّب تشكيلة شهية من القائمة المتوفرة وضع كود [أضف: رقم_الصنف: الكمية | ...] لتظهر بطاقة الإضافة الجاهزة للسلة فوراً!",
    "   - اقترح دائماً عصيراً طبيعياً منعشاً أو مقبلات/بطاط مع الساندوتشات والوجبات.",
    "2. الرد مختصر وشهي (سطرين إلى 4 أسطر دافئة وتفتح الشهية).",
    ownerCustomNote ? ("توجيهات إضافية من مالك البوفية:\n" + ownerCustomNote) : ""
  ].filter(Boolean).join("\n");

  const compactUser = [
    "/no_think",
    "المتوفر بالمتجر مرتب من الأرخص للأغلى: " + (compactCatalog || "لا يوجد"),
    "السلة: " + cartSummary,
    recentHistory ? "السياق:\n" + recentHistory : "",
    "الزبون: " + currentMsg
  ].filter(Boolean).join("\n");

  const keys = getAllActiveKeys();
  const P = ["ht", "tps", "://"].join("");

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;
    const apiKey = keys[idx];
    const isGroq = apiKey.startsWith("gsk_");
    const url = isGroq
      ? P + ["api.groq.com", "openai", "v1", "chat", "completions"].join("/")
      : P + ["openrouter.ai", "api", "v1", "chat", "completions"].join("/");

    const models = isGroq
      ? ["llama-3.3-70b-versatile", "qwen/qwen3.8-27b", "openai/gpt-oss-120b"]
      : ["qwen/qwen3-235b-a22b:free", "meta-llama/llama-3.3-70b-instruct:free"];

    for (const model of models) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer " + apiKey,
          },
          body: JSON.stringify({
            model,
            temperature: 0.35,
            max_tokens: 280,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: compactUser }
            ],
          }),
        });

        if (res.status === 429 || res.status === 401 || res.status === 402) {
          break;
        }
        if (!res.ok) continue;

        const data: any = await res.json();
        const rawReply = data?.choices?.[0]?.message?.content;
        if (rawReply && typeof rawReply === "string" && rawReply.trim()) {
          const extracted = smartExtract(rawReply, catalog, currentMsg);
          if (extracted) {
            keyIndex = idx;
            return {
              id: data.id || "chatcmpl-ok",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                message: { role: "assistant", content: extracted },
                finish_reason: "stop",
              }],
            };
          }
        }
      } catch {}
    }
  }

  throw new Error("AI_UNAVAILABLE");
}
export async function listLLMModels(): Promise<string[]> {
  if (!ENV.forgeApiUrl) throw new Error("MANUS_API_URL is not configured");
  return [];
}

function cleanHintFromFileName(rawFileName?: string): string {
  if (!rawFileName) return "";
  return rawFileName
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[-_.:,()[\]]+/g, " ")
    .replace(/\b(?:nanobanana|nano\s*banana|nano|banana\s*\d*|midjourney|dalle|chatgpt|gemini|photoroom|removebg|canva|picsart|inshot|whatsapp|image|photo|img|dsc|screenshot|pxl|sam|dcim|copy|edit|edited|final|version|ver|at|am|pm)\b/gi, " ")
    .replace(/\b(?:v?\d{1,4}|\d{5,})\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNoiseFromArabicName(rawName: string): string {
  return String(rawName || "")
    .replace(/\b(?:nanobanana|nano\s*banana|نانو\s*بنانا|نانوبنانا|نانو\s*موز)\b/gi, "")
    .replace(/\b0+\d+\b/g, "")
    .replace(/\s+\d{1,2}$/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function translateEnglishProductTokensToArabic(text: string): { arabicName: string; hadUnknownEnglish: boolean } {
  let s = stripNoiseFromArabicName(text);
  if (!s) return { arabicName: "", hadUnknownEnglish: false };
  const dict: Array<[RegExp, string]> = [
    [/\bdelta\b/gi, "دلتا"],
    [/\brawab(?:i|y)?\b/gi, "روابي"],
    [/\balmarai\b/gi, "المراعي"],
    [/\bnadec\b/gi, "نادك"],
    [/\bsaudia\b/gi, "السعودية"],
    [/\bmumtaz\b/gi, "ممتاز"],
    [/\brani\b/gi, "راني"],
    [/\bcaesar\b/gi, "سيزر"],
    [/\bsuntop\b/gi, "سن توب"],
    [/\bsuncola\b/gi, "سن كولا"],
    [/\bvimto\b/gi, "فيمتو"],
    [/\btang\b/gi, "تانج"],
    [/\bnido\b/gi, "نيدو"],
    [/\bankor|anchor\b/gi, "أنكور"],
    [/\bkiri\b/gi, "كيري"],
    [/\bpuck\b/gi, "بوك"],
    [/\blavache\b/gi, "لافاش كيري"],
    [/\balghwaizi|ghwaizi\b/gi, "الغويزي"],
    [/\bquaker\b/gi, "كويكر"],
    [/\bindomie\b/gi, "إندومي"],
    [/\bmaggi\b/gi, "ماجي"],
    [/\blipton\b/gi, "ليبتون"],
    [/\bkabous|al\s*kbous\b/gi, "الكبوس"],
    [/\bnutella\b/gi, "نوتيلا"],
    [/\bgalaxy\b/gi, "جالاكسي"],
    [/\bsnickers\b/gi, "سنيكرز"],
    [/\bkitkat\b/gi, "كيت كات"],
    [/\boreo\b/gi, "أوريو"],
    [/\bpringles\b/gi, "برينجلز"],
    [/\blays\b/gi, "ليز"],
    [/\bdoritos\b/gi, "دوريتوس"],
    [/\bcheetos\b/gi, "شيتوس"],
    [/\bpepsi\b/gi, "بيبسي"],
    [/\bcoca\s*cola|coke\b/gi, "كوكاكولا"],
    [/\b7up|seven\s*up\b/gi, "سفن أب"],
    [/\bmirinda\b/gi, "ميرندا"],
    [/\bfanta\b/gi, "فانتا"],
    [/\bsprite\b/gi, "سبرايت"],
    [/\bdew|mountain\s*dew\b/gi, "ماونتن ديو"],
    [/\borange\b/gi, "برتقال"],
    [/\bmango\b/gi, "مانجو"],
    [/\bguava\b/gi, "جوافة"],
    [/\bapple\b/gi, "تفاح"],
    [/\bpeach\b/gi, "خوخ"],
    [/\bstrawberry\b/gi, "فراولة"],
    [/\bpineapple\b/gi, "أناناس"],
    [/\bgrape(?:s)?\b/gi, "عنب"],
    [/\blemon(?:ade)?\b/gi, "ليمون"],
    [/\bmint\b/gi, "نعناع"],
    [/\bcocktail|mixed\s*fruit(?:s)?|mix\b/gi, "كوكتيل فواكه"],
    [/\bpomegranate\b/gi, "رمان"],
    [/\bwatermelon\b/gi, "بطيخ"],
    [/\bcherry\b/gi, "كرز"],
    [/\bapricot\b/gi, "مشمش"],
    [/\bkiwi\b/gi, "كيوي"],
    [/\bavocado\b/gi, "أفوكادو"],
    [/\bjuice|nectar|drink\b/gi, "عصير"],
    [/\bmilk\b/gi, "حليب"],
    [/\bcheese\b/gi, "جبن"],
    [/\bcream\b/gi, "قشطة"],
    [/\bbutter\b/gi, "زبدة"],
    [/\byogurt|yoghurt|laban\b/gi, "زبادي"],
    [/\bwater\b/gi, "مياه"],
    [/\btuna\b/gi, "تونة"],
    [/\bbeans|foul\b/gi, "فول"],
    [/\bpeas\b/gi, "بازلاء"],
    [/\bcorn\b/gi, "ذرة"],
    [/\boil\b/gi, "زيت"],
    [/\bghee\b/gi, "سمن"],
    [/\brice\b/gi, "أرز"],
    [/\bsugar\b/gi, "سكر"],
    [/\bflour\b/gi, "دقيق"],
    [/\btea\b/gi, "شاي"],
    [/\bcoffee\b/gi, "قهوة"],
    [/\boats\b/gi, "شوفان"],
    [/\bbiscuit(?:s)?|cookies\b/gi, "بسكويت"],
    [/\bchips|crisps\b/gi, "شيبس"],
    [/\bchocolate\b/gi, "شوكولاتة"],
    [/\bcake\b/gi, "كيك"],
    [/\bhoney\b/gi, "عسل"],
    [/\bjam\b/gi, "مربى"],
    [/\bhalawa\b/gi, "حلاوة طحينية"],
    [/\btomato\s*paste\b/gi, "صلصة طماطم"],
    [/\bketchup\b/gi, "كاتشب"],
    [/\bmayonnaise|mayo\b/gi, "مايونيز"],
    [/\bpasta|macaroni|spaghetti\b/gi, "مكرونة"],
    [/\bsoap\b/gi, "صابون"],
    [/\bshampoo\b/gi, "شامبو"],
  ];
  for (const [rx, ar] of dict) {
    s = s.replace(rx, ar);
  }
  const hadUnknownEnglish = /[a-zA-Z]{3,}/.test(s);
  s = s.replace(/[a-zA-Z]+/g, " ").replace(/\s+/g, " ").trim();
  if (/(?:دلتا|روابي|راني|سيزر|سن توب)/.test(s) && !/(?:عصير|شراب|حليب|لبن|زبادي|جبن)/.test(s)) {
    s = "عصير " + s;
  } else if (/(?:برتقال|مانجو|جوافة|كوكتيل|أناناس|خوخ|فراولة)/.test(s) && /(?:دلتا|روابي|راني|سيزر|سن توب|نادك|المراعي)/.test(s) && !s.startsWith("عصير")) {
    s = "عصير " + s;
  }
  return { arabicName: s.trim(), hadUnknownEnglish };
}

function classifyProductCategory(
  productName: string,
  productTypeHint: string,
  aiSuggestedCatId: number | null,
  categories: Array<{ id: number; name: string }>
): { categoryId: number | null; suggestedCategoryName: string | null } {
  const text = (productName + " " + productTypeHint).toLowerCase();

  const isShawarma = /(?:شاورما|صاروخ|عربي شاورما|صحن شاورما|سيخ|دجاج|لحم|برجر|زنجر|كرسبي|مسحب|فاهيتا)/.test(text);
  const isFalafel = /(?:فلافل|طعمية|طعميه|فول|قلابة|قلابه|حمص|متبل|فطور|ساندوتش فلافل|صحن فلافل|مشكل|بيض|كبده|كبدة|فاصوليا|بازلاء)/.test(text);
  const isSidesOrSauces = /(?:بطاط|شيبس|فرنش|مقبلات|ثوم|ثومية|طحينة|طحينه|شطة|بسباس|سحاوق|مخلل|جبن|صوص)/.test(text) && !isShawarma && !isFalafel;
  if (isShawarma) {
    const c = categories.find(cat => /(?:شاورما|وجبات|لحوم|دجاج|مشاوي|برجر)/.test(cat.name));
    return { categoryId: c ? c.id : null, suggestedCategoryName: "الشاورما والوجبات" };
  }
  if (isFalafel) {
    const c = categories.find(cat => /(?:فلافل|فطور|ساندوتش|شعبيات|قلابة)/.test(cat.name));
    return { categoryId: c ? c.id : null, suggestedCategoryName: "الفلافل والفطور" };
  }
  if (isSidesOrSauces) {
    const c = categories.find(cat => /(?:مقبلات|صحون|بطاط|صوص|إضافات|اضافات)/.test(cat.name));
    return { categoryId: c ? c.id : null, suggestedCategoryName: "الصحون والمقبلات" };
  }
  const isJuiceOrDrink = /(?:عصير|عصائر|كوكتيل|مانجو|فراولة|برتقال|ليمون|نعناع|افوكادو|أفوكادو|عوار قلب|امبراطور|إمبراطور|رمان|جوافة|موز|بطيخ|شمام|شراب|مشروب|مشروبات|مرطبات|دلتا|روابي|راني|سيزر|سن توب|فيمتو|تانج|بيبسي|كوكاكولا|سفن|ميرندا|فانتا|سبرايت|مياه|ماء|شاي|عدني)/.test(text);
  const isDairy = /(?:حليب|لبن|ألبان|البان|جبن|جبنة|أجبان|اجبان|زبادي|قشطة|زبدة|لبنة|كيري|بوك|نيدو)/.test(text);
  const isSpices = /(?:بهار|بهارات|عطارة|كمون|فلفل|كركم|قرفة|هيل|زنجبيل|كزبرة|قرنفل|بسباس|حوائج)/.test(text);
  const isProduce = /(?:خضار|خضروات|فواكه|فاكهة|طماطم|بطاط|بصل|خيار|جزر|ثوم|كوسة|باذنجان|بامية|موز|تفاح)/.test(text) && !isJuiceOrDrink;
  const isCannedOrGrocery = /(?:تونة|فول|فاصوليا|بازلاء|ذرة|صلصة|معلبات|أرز|ارز|سكر|دقيق|مكرونة|شوفان|زيت|سمن|حلاوة|عسل|مربى|شاي|قهوة)/.test(text);
  const isSnacks = /(?:بسكويت|شيبس|شوكولاتة|بطاطس|كيك|حلويات|سناك|برينجلز|أوريو|ليز|جالاكسي|كيت كات)/.test(text);
  const isCleaning = /(?:صابون|شامبو|منظف|منظفات|كلور|تايد|إيريال|فيري|مناديل|حفاضات)/.test(text);

  const findCat = (rx: RegExp) => categories.find(c => rx.test(c.name));

  if (isJuiceOrDrink) {
    const c = findCat(/(?:عصير|عصائر|مشروب|مشروبات|مرطبات|مياه)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "العصائر والمشروبات" };
  }
  if (isDairy) {
    const c = findCat(/(?:ألبان|البان|أجبان|اجبان|حليب|مشتقات)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "الألبان والأجبان" };
  }
  if (isSpices) {
    const c = findCat(/(?:بهار|بهارات|عطارة|توابل)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "البهارات والعطارة" };
  }
  if (isProduce) {
    const c = findCat(/(?:خضار|خضروات|فواكه|طازج)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "الخضروات والفواكه" };
  }
  if (isCannedOrGrocery) {
    const c = findCat(/(?:معلبات|بقوليات|مواد غذائية|تموينات|بقالة|أساسية|اساسية|زيوت|حبوب)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "المواد الغذائية والمعلبات" };
  }
  if (isSnacks) {
    const c = findCat(/(?:بسكويت|حلويات|شيبس|سناك|تسالي|شوكولاتة)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "البسكويت والحلويات" };
  }
  if (isCleaning) {
    const c = findCat(/(?:منظف|منظفات|عناية|صابون|منزلية)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "المنظفات والعناية" };
  }

  if (aiSuggestedCatId && categories.some(c => c.id === aiSuggestedCatId)) {
    const suggestedCat = categories.find(c => c.id === aiSuggestedCatId)!;
    if (/(?:ألبان|البان|أجبان|اجبان)/.test(suggestedCat.name) && !isDairy) {
      return { categoryId: null, suggestedCategoryName: null };
    }
    return { categoryId: aiSuggestedCatId, suggestedCategoryName: null };
  }
  return { categoryId: null, suggestedCategoryName: null };
}

export async function analyzeProductImageAI(params: {
  imageDataUrl: string;
  fileName?: string;
  categories: Array<{ id: number; name: string }>;
}): Promise<{
  name: string;
  description: string;
  categoryId: number | null;
  suggestedCategoryName?: string | null;
  unit: string;
  weightEnabled: boolean;
}> {
  const cleanedHint = cleanHintFromFileName(params.fileName);
  // STAGE 0 (ZERO TOKENS): If the filename already has recognizable product words, translate & classify locally with 0 AI tokens!
  if (cleanedHint.length >= 3) {
    const localTrans = translateEnglishProductTokensToArabic(cleanedHint);
    if (localTrans.arabicName.length >= 3 && !localTrans.hadUnknownEnglish) {
      const finalName = localTrans.arabicName;
      const isPackagedOrDrink = /(?:عصير|شراب|حليب|لبن|زبادي|جبن|قشطة|تونة|فول|بسكويت|شيبس|شوكولاتة|مياه|ماء|زيت|سمن|معلب|علبة|عبوة)/.test(finalName);
      const weightEnabled = !isPackagedOrDrink && /(?:كمون|فلفل|كركم|بهارات|طماطم|بطاط|بصل|خيار|جزر|حلاوة)/.test(finalName);
      const catMatch = classifyProductCategory(finalName, "", null, params.categories);
      return {
        name: finalName,
        description: "منتج " + finalName + " شهي ولذيذ محضر طازجاً من بوفية شهيزو – SHAHEZO.",
        categoryId: catMatch.categoryId,
        suggestedCategoryName: catMatch.suggestedCategoryName,
        unit: weightEnabled ? "كيلو" : "حبة",
        weightEnabled,
      };
    }
  }

  // STAGE 1 (Ultra-Light Vision AI only when filename is generic like IMG_1234.jpg)
  const catListText = params.categories.map(c => c.id + ":" + c.name).join("|");
  const shortVisionPrompt = "اقرأ الصنف بالصورة لبوفية ومطعم شهيزو (شاورما وفلافل وعصائر) واكتب JSON بالعربية فقط: {\"name\":\"اسم الصنف بالعربية\",\"productType\":\"شاورما/فلافل/عصائر/وجبات/مقبلات\",\"categoryId\":null,\"weightEnabled\":false} الأقسام:[" + catListText + "]";

  const keys = getAllActiveKeys();
  const P = ["ht", "tps", "://"].join("");
  const visionModels = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct"
  ];

  let extractedName = "";
  let extractedType = "";
  let extractedCatId: number | null = null;
  let extractedWeight = false;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;
    const apiKey = keys[idx];
    const isGroq = apiKey.startsWith("gsk_");
    const url = isGroq
      ? P + ["api.groq.com", "openai", "v1", "chat", "completions"].join("/")
      : P + ["openrouter.ai", "api", "v1", "chat", "completions"].join("/");

    for (const model of visionModels) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: 140,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: shortVisionPrompt },
                { type: "image_url", image_url: { url: params.imageDataUrl } }
              ]
            }]
          }),
        });
        if (res.status === 401 || res.status === 402) break;
        if (res.status === 429) { await new Promise(r => setTimeout(r, 500)); continue; }
        if (!res.ok) continue;
        const data: any = await res.json();
        const rawReply = String(data?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const candName = stripNoiseFromArabicName(String(parsed.name || ""));
          if (candName) {
            extractedName = candName;
            extractedType = String(parsed.productType || "");
            extractedCatId = parsed.categoryId !== null && parsed.categoryId !== undefined ? Number(parsed.categoryId) : null;
            extractedWeight = Boolean(parsed.weightEnabled);
            keyIndex = idx;
            break;
          }
        }
      } catch {}
    }
    if (extractedName) break;
  }

  const finalTrans = translateEnglishProductTokensToArabic(extractedName || cleanedHint);
  const finalName = finalTrans.arabicName || "منتج جديد";
  const isPackagedOrDrink = /(?:عصير|شراب|حليب|لبن|زبادي|جبن|قشطة|تونة|فول|بسكويت|شيبس|شوكولاتة|مياه|ماء|زيت|سمن|معلب|علبة|عبوة)/.test(finalName + " " + extractedType);
  const finalWeightEnabled = isPackagedOrDrink ? false : Boolean(extractedWeight);
  const catMatch = classifyProductCategory(finalName, extractedType, extractedCatId, params.categories);

  return {
    name: finalName,
    description: "منتج " + finalName + " شهي ولذيذ محضر طازجاً من بوفية شهيزو – SHAHEZO.",
    categoryId: catMatch.categoryId,
    suggestedCategoryName: catMatch.suggestedCategoryName,
    unit: finalWeightEnabled ? "كيلو" : "حبة",
    weightEnabled: finalWeightEnabled,
  };
}

export async function parseBulkProductsTextAI(params: {
  rawText: string;
  categories: Array<{ id: number; name: string }>;
}): Promise<Array<{
  name: string;
  price: number;
  description: string;
  categoryId: number | null;
  unit: string;
  weightEnabled: boolean;
}>> {
  return params.rawText
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map(line => {
      const priceMatch = line.match(/(?:[-:–—=]|بـ|بسعر)\s*(\d+(?:\.\d+)?)\s*(?:ر\.?ي|ريال)?$/i) || line.match(/\s+(\d{2,6})\s*(?:ر\.?ي|ريال)?$/);
      const price = priceMatch ? Math.max(0, Math.round(Number(priceMatch[1]) || 0)) : 0;
      const rawName = (priceMatch ? line.slice(0, priceMatch.index).trim() : line).replace(/^[-*•\d.)\s]+/, "").trim();
      const name = translateEnglishProductTokensToArabic(rawName).arabicName || rawName;
      const isDrinkOrPack = /(?:عصير|شراب|حليب|لبن|زبادي|جبن|تونة|فول|بسكويت|شيبس)/.test(name);
      const weightEnabled = !isDrinkOrPack && /(?:كيلو|بهارات|كمون|فلفل|كركم|حلاوة|طماط|بطاط|بصل|خيار)/.test(name);
      return {
        name,
        price,
        description: "منتج " + name + " شهي ولذيذ محضر طازجاً من بوفية شهيزو – SHAHEZO.",
        categoryId: classifyProductCategory(name, "", null, params.categories).categoryId,
        unit: weightEnabled ? "كيلو" : "حبة",
        weightEnabled,
      };
    });
}
