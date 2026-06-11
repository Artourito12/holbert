import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic(); // ANTHROPIC_API_KEY

/** Classification, routage : rapide et économique. */
export const MODEL_FAST = "claude-haiku-4-5-20251001";
/** Analyse et extraction juridique : qualité maximale. */
export const MODEL_SMART = "claude-fable-5";

/**
 * Appel Claude avec sortie structurée forcée (tool use).
 * Retourne directement l'objet `input` du tool call.
 */
export async function structured({ model, system, prompt, toolName, description, schema, maxTokens = 4000 }) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [{ name: toolName, description, input_schema: schema }],
    tool_choice: { type: "tool", name: toolName },
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block) throw new Error("Réponse Claude sans tool_use");
  return block.input;
}
