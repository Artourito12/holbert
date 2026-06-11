const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dimensions

/** Calcule les embeddings d'un tableau de textes (OpenAI). */
export async function embed(texts) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("[Holbert API] OPENAI_API_KEY manquante dans l'environnement");
  }
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings ${res.status} : ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
