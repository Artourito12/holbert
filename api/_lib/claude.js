import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic(); // ANTHROPIC_API_KEY

/** Classification, routage : rapide et économique — pas de réflexion étendue. */
export const MODEL_FAST = "claude-haiku-4-5-20251001";
/** Analyse et rédaction juridique — Opus 4.8 (décision coût/qualité, docs/09 §2). */
export const MODEL_SMART = "claude-opus-4-8";

/**
 * Sortie structurée FORCÉE (tool use), sans réflexion étendue.
 * À réserver aux tâches rapides : classification, routage d'intention.
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

/**
 * Opus 4.8 : la réflexion se pilote en mode adaptatif (thinking.type "adaptive")
 * + output_config.effort — l'ancien format budget_tokens renvoie une erreur 400.
 * On conserve thinkingBudget dans les signatures (les appelants expriment une
 * intention de profondeur) et on le traduit ici en niveau d'effort.
 */
function effortDepuisBudget(thinkingBudget) {
  if (thinkingBudget >= 6000) return "high";
  if (thinkingBudget >= 2500) return "medium";
  return "low";
}

/**
 * Sortie structurée AVEC réflexion adaptative : le modèle raisonne avant de
 * remplir l'outil — pour les analyses juridiques lourdes (audit de contrat,
 * extraction, vices de procédure, segmentation de cas).
 * tool_choice auto : si le modèle ne rend pas l'outil, repli automatique
 * sur l'appel forcé sans réflexion.
 */
export async function structuredDeep({
  model = MODEL_SMART,
  system,
  prompt,
  toolName,
  description,
  schema,
  thinkingBudget = 6000,
  maxTokens = 16000,
}) {
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: effortDepuisBudget(thinkingBudget) },
      system:
        system +
        `\nIMPORTANT : après votre réflexion, restituez TOUJOURS votre analyse via l'outil ${toolName} — jamais en texte libre.`,
      messages: [{ role: "user", content: prompt }],
      tools: [{ name: toolName, description, input_schema: schema }],
      tool_choice: { type: "auto" },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (block) return block.input;
    console.error("[Holbert API] structuredDeep sans tool_use — repli sans réflexion");
  } catch (e) {
    console.error("[Holbert API] structuredDeep:", e.message, "— repli sans réflexion");
  }
  return structured({ model, system, prompt, toolName, description, schema, maxTokens });
}

/**
 * Génération de texte, réflexion adaptative optionnelle — rédactions à enjeu
 * (réponses juridiques sourcées, contrats, conclusions, synthèses).
 * thinkingBudget = 0 → pas de réflexion (réponse rapide, questions simples).
 */
export async function deepText({
  model = MODEL_SMART,
  system,
  prompt,
  thinkingBudget = 3000,
  maxTokens = 8000,
}) {
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  };
  if (thinkingBudget >= 1024) {
    params.thinking = { type: "adaptive" };
    params.output_config = { effort: effortDepuisBudget(thinkingBudget) };
  } else {
    // Réponse rapide : pas de réflexion, effort minimal, réponse directe
    params.output_config = { effort: "low" };
  }
  const res = await anthropic.messages.create(params);
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
