import { z } from "zod";

export const assistantModelOutputSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  recipeName: z.string().trim().max(160),
  servings: z.number().int().min(0).max(50),
  ingredients: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive().max(10000),
  }).strict()).max(40),
  steps: z.array(z.string().trim().min(1).max(500)).max(20),
  missingIngredients: z.array(z.string().trim().min(1).max(120)).max(30),
  cartAction: z.enum(["none", "add", "remove"]),
  suggestedQuestions: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  cartItems: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(0).max(10000),
  }).strict()).max(20),
}).strict();

export type AssistantModelOutput = z.infer<typeof assistantModelOutputSchema>;

export type AssistantCatalogProduct = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  stock: number | null;
  minQuantity: number;
  quantityStep: number;
};

export type AssistantCartInputLine = { productId: number; quantity: number };
export type AssistantHistoryTurn = { role: "user" | "assistant"; text: string };
export type AssistantProductLine = Omit<AssistantCatalogProduct, "id" | "description"> & { productId: number; quantity: number };
export type PreparedAssistantResponse = {
  message: string;
  recipe: { name: string; servings: number; steps: string[] } | null;
  ingredients: AssistantProductLine[];
  missingIngredients: string[];
  cartAction: { type: "add" | "remove"; items: AssistantProductLine[] } | null;
  suggestedQuestions?: string[];
};

export const assistantResponseJsonSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    recipeName: { type: "string" },
    servings: { type: "integer", minimum: 0, maximum: 50 },
    ingredients: {
      type: "array", maxItems: 40,
      items: { type: "object", properties: {
        productId: { type: "integer", minimum: 1 },
        quantity: { type: "integer", minimum: 1, maximum: 10000 },
      }, required: ["productId", "quantity"], additionalProperties: false },
    },
    steps: { type: "array", maxItems: 20, items: { type: "string", maxLength: 500 } },
    missingIngredients: { type: "array", maxItems: 30, items: { type: "string", maxLength: 120 } },
    cartAction: { type: "string", enum: ["none", "add", "remove"] },
    cartItems: {
      type: "array", maxItems: 20,
      items: { type: "object", properties: {
        productId: { type: "integer", minimum: 1 },
        quantity: { type: "integer", minimum: 0, maximum: 10000 },
      }, required: ["productId", "quantity"], additionalProperties: false },
    },
  },
  required: ["message", "recipeName", "servings", "ingredients", "steps", "missingIngredients", "cartAction", "cartItems"],
  additionalProperties: false,
} as const;

export function contentToText(content: unknown): string | null {
  if (typeof content === "string") return content.trim() || null;
  if (!Array.isArray(content)) return null;
  const text = content.flatMap(part => {
    if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return [part.text];
    return [];
  }).join("\n").trim();
  return text || null;
}

export function parseAssistantModelContent(content: unknown): AssistantModelOutput | null {
  const text = contentToText(content);
  if (!text) return null;
  const unfenced = text.replace(/^\s*\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60\s*$/, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const raw: any = JSON.parse(unfenced.slice(start, end + 1));
      if (raw && typeof raw === "object") {
        let msg = "";
        for (const k of ["message", "reply", "response", "answer", "text", "content", "greeting", "description", "summary"]) {
          if (typeof raw[k] === "string" && raw[k].trim()) {
            msg = raw[k].trim();
            break;
          }
        }
        if (!msg && Array.isArray(raw.methods)) {
          msg = raw.methods.map((m: any, i: number) => typeof m === "string" ? (i + 1) + ". " + m : (i + 1) + ". " + (m.name || m.title || "") + ": " + (m.description || m.steps || "")).join("\n\n");
        }
        if (!msg) {
          const stringVals = Object.values(raw).filter((v): v is string => typeof v === "string" && v.trim().length > 3);
          if (stringVals.length > 0) msg = stringVals.join("\n\n");
        }
        if (!msg && Array.isArray(raw.steps) && raw.steps.length > 0) {
          msg = "إليك طريقة تحضير " + (raw.recipeName || "الوصفة") + " بالتفصيل:";
        }
        if (msg) {
          return {
            message: msg.replace(/\*\*/g, "").slice(0, 1200),
            recipeName: typeof raw.recipeName === "string" ? raw.recipeName.replace(/\*\*/g, "").trim().slice(0, 160) : "",
            servings: typeof raw.servings === "number" && raw.servings >= 0 ? Math.min(50, Math.floor(raw.servings)) : (Array.isArray(raw.steps) && raw.steps.length > 0 ? 3 : 0),
            ingredients: Array.isArray(raw.ingredients)
              ? raw.ingredients
                  .filter((i: any) => i && Number.isInteger(Number(i.productId)) && Number(i.productId) > 0)
                  .map((i: any) => ({ productId: Number(i.productId), quantity: Math.max(1, Math.min(10000, Math.floor(Number(i.quantity) || 1))) }))
                  .slice(0, 40)
              : [],
            steps: Array.isArray(raw.steps)
              ? raw.steps.filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.replace(/\*\*/g, "").trim().slice(0, 500)).slice(0, 20)
              : [],
            missingIngredients: Array.isArray(raw.missingIngredients)
              ? raw.missingIngredients.filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.trim().slice(0, 120)).slice(0, 30)
              : [],
            cartAction: raw.cartAction === "add" || raw.cartAction === "remove" ? raw.cartAction : "none",
            suggestedQuestions: Array.isArray(raw.suggestedQuestions) ? raw.suggestedQuestions.filter((s: any) => typeof s === "string" && s.trim()).map((s: string) => s.trim().slice(0, 100)).slice(0, 4) : [],
            cartItems: Array.isArray(raw.cartItems)
              ? raw.cartItems
                  .filter((i: any) => i && Number.isInteger(Number(i.productId)) && Number(i.productId) > 0)
                  .map((i: any) => ({ productId: Number(i.productId), quantity: Math.max(0, Math.min(10000, Math.floor(Number(i.quantity) ?? 1))) }))
                  .slice(0, 20)
              : [],
          };
        }
      }
    } catch {}
  }
  const cleanPlain = unfenced
    .replace(/^[^{]*\{[\s\S]*?"message"\s*:\s*"([^"]+)"[\s\S]*$/, "$1")
    .replace(/\*\*/g, "")
    .trim();
  if (cleanPlain.length > 1) {
    return {
      message: cleanPlain.slice(0, 1200),
      recipeName: "",
      servings: 0,
      ingredients: [],
      steps: [],
      missingIngredients: [],
      cartAction: "none",
      cartItems: [],
    };
  }
  return null;
}

function normalizeProductQuantity(product: AssistantCatalogProduct, quantity: number) {
  const minimum = Math.max(1, product.minQuantity || 1);
  const step = Math.max(1, product.quantityStep || 1);
  return minimum + Math.ceil(Math.max(0, quantity - minimum) / step) * step;
}

function maximumValidQuantity(product: AssistantCatalogProduct, available: number) {
  const minimum = Math.max(1, product.minQuantity || 1);
  const step = Math.max(1, product.quantityStep || 1);
  if (available < minimum) return 0;
  return minimum + Math.floor((available - minimum) / step) * step;
}

function productLine(product: AssistantCatalogProduct, quantity: number): AssistantProductLine {
  return {
    productId: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
    stock: product.stock,
    minQuantity: product.minQuantity,
    quantityStep: product.quantityStep,
    quantity,
  };
}

function uniqueNames(values: string[]) {
  const seen = new Set<string>();
  return values.map(value => value.trim()).filter(value => {
    if (!value) return false;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

function normalizeArabic(value: string) {
  return value.toLocaleLowerCase().normalize("NFKD")
    .replace(/\p{M}/gu, "").replace(/ـ/g, "")
    .replace(/[آأإٱ]/gu, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function explicitCartIntent(value: string): "add" | "remove" | null {
  const words = normalizeArabic(value).split(/\s+/u).filter(Boolean);
  const add = words.some(word => /^(?:اضف|اضيف|اضافه|ضيف|ضف|حط|زيد|زد|زود|ادخل|دخل|زودني)/u.test(word));
  const remove = words.some(word => /^(?:احذف|حذف|شيل|امسح|نقص|استبعد|اسحب)/u.test(word) || ["الغ", "الغاء", "الغي", "الغى"].includes(word));
  if (add === remove) return null;
  return add ? "add" : "remove";
}

function isPronounReference(value: string) {
  const words = normalizeArabic(value).split(/\s+/u).filter(Boolean);
  return words.some(word => ["هذا", "هذه", "ذلك", "تلك", "ها", "ه"].includes(word) || /(?:ها|ه)$/u.test(word));
}

function mentionedProductIds(texts: string[], catalog: AssistantCatalogProduct[]) {
  const normalizedTexts = texts.map(normalizeArabic).filter(Boolean);
  const tokens = new Set(normalizedTexts.flatMap(text => text.split(/\s+/u)));
  const keywordOwners = new Map<string, Set<number>>();
  const ignored = new Set(["من", "في", "على", "الى", "عن", "مع", "هذا", "هذه", "حبه", "علبه", "قطعه", "عبوه", "كيس", "كرتون", "كيلو", "جرام", "غرام", "لتر", "صنف", "منتج", "السله", "سله"]);
  for (const product of catalog) {
    for (const token of new Set(normalizeArabic(product.name).split(/\s+/u).filter(word => word.length >= 3 && !ignored.has(word)))) {
      const owners = keywordOwners.get(token) ?? new Set<number>();
      owners.add(product.id);
      keywordOwners.set(token, owners);
    }
  }
  const result = new Set<number>();
  for (const product of catalog) {
    const normalizedName = normalizeArabic(product.name);
    if (normalizedName && normalizedTexts.some(text => (" " + text + " ").includes(" " + normalizedName + " "))) {
      result.add(product.id);
      continue;
    }
    const uniqueTokens = [...keywordOwners.entries()].filter(([, owners]) => owners.size === 1).map(([token]) => token);
    if (uniqueTokens.some(token => keywordOwners.get(token)?.has(product.id) && tokens.has(token))) result.add(product.id);
  }
  return result;
}

function rejectedProductIds(history: AssistantHistoryTurn[], catalog: AssistantCatalogProduct[]) {
  const rejected = new Set<number>();
  for (let index = 0; index < history.length; index += 1) {
    const turn = history[index];
    if (turn.role !== "user") continue;
    const normalized = normalizeArabic(turn.text);
    const mentioned = mentionedProductIds([turn.text], catalog);
    const explicitRejection = /(?:^|\s)(?:لا|ما|مش|مو)\s+(?:اريد|ابي|ابغي|احب|ارغب|حاب|حابه|راغب|راغبه)(?:$|\s)/u.test(normalized);
    const shortRejection = /^(?:لا|لا شكرا(?: لك)?|ما اريد|ما ابي|ما ابغي|مش حاب|مو حاب)$/u.test(normalized);
    if (explicitRejection && mentioned.size > 0) {
      for (const productId of mentioned) rejected.add(productId);
      continue;
    }
    if (shortRejection) {
      const previousAssistant = [...history.slice(0, index)].reverse().find(item => item.role === "assistant");
      if (previousAssistant) {
        const offeredProducts = mentionedProductIds([previousAssistant.text], catalog);
        if (offeredProducts.size === 1) for (const productId of offeredProducts) rejected.add(productId);
      }
      continue;
    }
    for (const productId of mentioned) rejected.delete(productId);
  }
  return rejected;
}

export function prepareAssistantResponse(
  output: AssistantModelOutput,
  catalog: AssistantCatalogProduct[],
  cartLines: AssistantCartInputLine[],
  _requestText = "",
  _history: AssistantHistoryTurn[] = [],
): PreparedAssistantResponse {
  const catalogById = new Map(catalog.map(product => [product.id, product]));
  const cartQuantityById = new Map<number, number>();
  for (const line of cartLines) {
    if (!Number.isSafeInteger(line.productId) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) continue;
    if (!catalogById.has(line.productId)) continue;
    cartQuantityById.set(line.productId, Math.min(100000, (cartQuantityById.get(line.productId) ?? 0) + line.quantity));
  }

  const missing = [...output.missingIngredients];
  const ingredientQuantities = new Map<number, number>();
  for (const ingredient of output.ingredients) {
    ingredientQuantities.set(ingredient.productId, Math.min(10000, (ingredientQuantities.get(ingredient.productId) ?? 0) + ingredient.quantity));
  }
  const ingredients: AssistantProductLine[] = [];
  for (const [productId, requestedQuantity] of ingredientQuantities) {
    const product = catalogById.get(productId);
    if (!product) continue;
    const quantity = normalizeProductQuantity(product, requestedQuantity);
    if (product.stock !== null && quantity > product.stock) {
      const availableQuantity = maximumValidQuantity(product, product.stock);
      if (availableQuantity > 0) ingredients.push(productLine(product, availableQuantity));
      continue;
    }
    ingredients.push(productLine(product, quantity));
  }

  const missingIngredients = uniqueNames(missing);
  const hasRecipe = Boolean(output.recipeName && (output.steps.length > 0 || ingredients.length > 0));
  const message = output.message;

  let cartAction: PreparedAssistantResponse["cartAction"] = null;
  if (output.cartAction !== "none" && output.cartItems.length > 0) {
    const requestedById = new Map<number, number>();
    for (const item of output.cartItems) {
      if (!catalogById.has(item.productId)) continue;
      requestedById.set(item.productId, Math.min(10000, (requestedById.get(item.productId) ?? 0) + item.quantity));
    }
    const preparedItems: AssistantProductLine[] = [];
    for (const [productId, requestedQuantity] of requestedById) {
      const product = catalogById.get(productId)!;
      const inCart = cartQuantityById.get(productId) ?? 0;
      if (output.cartAction === "remove") {
        if (inCart <= 0) continue;
        const quantity = requestedQuantity === 0 ? inCart : Math.min(requestedQuantity, inCart);
        preparedItems.push(productLine(product, quantity));
        continue;
      }
      if (requestedQuantity <= 0) continue;
      const normalized = normalizeProductQuantity(product, requestedQuantity);
      const remaining = product.stock === null ? Number.POSITIVE_INFINITY : Math.max(0, product.stock - inCart);
      const allowed = maximumValidQuantity(product, remaining);
      if (allowed <= 0) continue;
      const quantity = Math.min(normalized, allowed);
      preparedItems.push(productLine(product, quantity));
    }
    if (preparedItems.length > 0) {
      cartAction = { type: output.cartAction, items: preparedItems };
    }
  }

  return {
    message,
    recipe: hasRecipe ? { name: output.recipeName, servings: output.servings || 2, steps: output.steps } : null,
    ingredients,
    missingIngredients,
    cartAction,
    suggestedQuestions: output.suggestedQuestions ?? [],
  };
}
