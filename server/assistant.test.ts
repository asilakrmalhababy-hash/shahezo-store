import { describe, expect, it } from "vitest";
import { assistantModelOutputSchema, parseAssistantModelContent, prepareAssistantResponse } from "./assistant";
import { buildMissingIngredientNote } from "../client/src/lib/assistant-note";

const catalog = [
  { id: 1, name: "تونة الغويزي", description: null, price: 800, unit: "علبة", stock: 6, minQuantity: 1, quantityStep: 1 },
  { id: 2, name: "شطة", description: null, price: 150, unit: "حبة", stock: 10, minQuantity: 1, quantityStep: 1 },
];

function output(overrides: Partial<ReturnType<typeof assistantModelOutputSchema.parse>> = {}) {
  return assistantModelOutputSchema.parse({
    message: "أكيد، خلينا نرتبها معًا.",
    recipeName: "",
    servings: 0,
    ingredients: [],
    steps: [],
    missingIngredients: [],
    cartAction: "none",
    cartItems: [],
    ...overrides,
  });
}

describe("assistant response safety", () => {
  it("parses structured JSON, including a fenced response", () => {
    const parsed = parseAssistantModelContent(`\`\`\`json\n${JSON.stringify(output())}\n\`\`\``);
    expect(parsed?.message).toBe("أكيد، خلينا نرتبها معًا.");
  });

  it("turns partial recipes into verified available items and a separate missing list", () => {
    const result = prepareAssistantResponse(output({
      message: "نقدر نسوي عشاء خفيف بالتونة.",
      recipeName: "سلطة تونة خفيفة",
      servings: 4,
      ingredients: [{ productId: 1, quantity: 2 }, { productId: 999, quantity: 1 }],
      steps: ["صفّي التونة ثم اخلطها."],
      missingIngredients: ["خس"],
    }), catalog, []);

    expect(result.recipe?.name).toBe("سلطة تونة خفيفة");
    expect(result.ingredients.map(item => item.name)).toEqual(["تونة الغويزي"]);
    expect(result.missingIngredients).toContain("خس");
    expect(result.missingIngredients).toContain("أحد مكونات الوصفة غير متوفر حاليًا");
  });

  it("never proposes additions above remaining stock and returns an explicit pending change", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 2, quantity: 5 }],
    }), catalog, [{ productId: 2, quantity: 7 }], "أضف 5 شطة");

    expect(result.cartAction?.type).toBe("add");
    expect(result.cartAction?.items[0]?.quantity).toBe(3);
    expect(result.message).toContain("3 حبة فقط");
  });

  it("only proposes removals that exist in the current cart", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "remove",
      cartItems: [{ productId: 2, quantity: 5 }],
    }), catalog, [{ productId: 2, quantity: 2 }], "احذف 5 شطة");

    expect(result.cartAction?.items[0]?.quantity).toBe(2);
  });

  it("does not propose a removal for an item that is absent from the current cart", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "remove",
      cartItems: [{ productId: 2, quantity: 1 }],
    }), catalog, [], "احذف 1 شطة");

    expect(result.cartAction).toBeNull();
    expect(result.message).toContain("غير موجود في سلتك");
  });

  it("does not match an unavailable requested product to a different store item", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 1, quantity: 2 }],
    }), catalog, [], "أضف 2 إندومي");

    expect(result.cartAction).toBeNull();
    expect(result.message).toContain("لم أغيّر السلة");
  });

  it("allows a clear addition request for the actual tuna product", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 1, quantity: 2 }],
    }), catalog, [], "أضف 2 تونة الغويزي إلى السلة");

    expect(result.cartAction?.type).toBe("add");
    expect(result.cartAction?.items[0]?.name).toBe("تونة الغويزي");
    expect(result.cartAction?.items[0]?.quantity).toBe(2);
  });

  it("does not treat a short yes as an instruction to change the cart", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 1, quantity: 1 }],
    }), catalog, [], "نعم", [{ role: "assistant", text: "هل تريد إضافة تونة الغويزي؟" }]);

    expect(result.cartAction).toBeNull();
    expect(result.message).toContain("لم أغيّر السلة");
  });

  it("allows a clear pronoun action only when the recent conversation names one matching product", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 1, quantity: 1 }],
    }), catalog, [], "أضفها للسلة", [{ role: "assistant", text: "هل تريد إضافة تونة الغويزي؟" }]);

    expect(result.cartAction?.type).toBe("add");
  });

  it("does not turn a previously rejected product into an addition through a pronoun", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 1, quantity: 1 }],
    }), catalog, [], "أضفها للسلة", [
      { role: "user", text: "لا أريد تونة الغويزي" },
      { role: "assistant", text: "حسنًا، لن أقترحها عليك." },
    ]);

    expect(result.cartAction).toBeNull();
    expect(result.message).toContain("رفضته");
  });

  it("treats a short no as rejecting the single product the assistant just offered", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 1, quantity: 1 }],
    }), catalog, [], "أضفها للسلة", [
      { role: "assistant", text: "هل ترغب في تحضير وجبة خفيفة بتونة الغويزي؟" },
      { role: "user", text: "لا" },
    ]);

    expect(result.cartAction).toBeNull();
    expect(result.message).toContain("رفضته");
  });

  it("allows the customer to explicitly name a product again after rejecting it", () => {
    const result = prepareAssistantResponse(output({
      cartAction: "add",
      cartItems: [{ productId: 1, quantity: 1 }],
    }), catalog, [], "أضف تونة الغويزي إلى السلة", [
      { role: "user", text: "لا أريد تونة الغويزي" },
      { role: "assistant", text: "حسنًا، لن أقترحها عليك." },
    ]);

    expect(result.cartAction?.type).toBe("add");
  });

  it("keeps copied missing-ingredient notes within the checkout field limit", () => {
    const short = buildMissingIngredientNote("سلطة خفيفة", 4, ["خس", "ليمون"]);
    expect(short.truncated).toBe(false);
    expect(short.text).toContain("خس");
    expect(short.text).toContain("ليمون");

    const long = buildMissingIngredientNote("وصفة منزلية", 8, Array.from({ length: 30 }, (_, index) => `مكوّن ${index + 1} ${"وصف".repeat(30)}`));
    expect(long.truncated).toBe(true);
    expect(long.text.length).toBeLessThanOrEqual(1000);
    expect(long.text).toContain("بقية المقادير");
  });
});
