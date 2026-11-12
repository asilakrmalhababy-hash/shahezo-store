const CUSTOMER_NOTE_LIMIT = 1000;

export function buildMissingIngredientNote(recipeName: string, servings: number, missingIngredients: string[]) {
  const header = `طلب توفير أصناف للوجبة: ${recipeName.trim()}، تكفي ${servings} أشخاص.`;
  const prefix = `${header}\nالأصناف المطلوبة:\n`;
  const closing = "\nيرجى توفيرها أو التواصل معي قبل تجهيز الطلب.";
  const truncationNotice = "\n… بقية المقادير موضحة في محادثة المساعد.";
  const lines: string[] = [];
  let truncated = false;

  for (const ingredient of missingIngredients) {
    const clean = ingredient.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const line = `- ${clean}`;
    const candidate = `${prefix}${[...lines, line].join("\n")}${closing}`;
    if (candidate.length > CUSTOMER_NOTE_LIMIT) {
      truncated = true;
      break;
    }
    lines.push(line);
  }

  const build = () => `${prefix}${lines.join("\n")}${truncated ? truncationNotice : ""}${closing}`;
  while (build().length > CUSTOMER_NOTE_LIMIT && lines.length > 0) {
    lines.pop();
    truncated = true;
  }

  return { text: build(), truncated };
}
