import { supabase } from "./supabase";

/** Appelle une fonction serverless avec le JWT de la session courante. */
export async function apiPost<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée — reconnectez-vous.");

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  }
  return json;
}

/** SHA-256 d'un fichier, côté navigateur (détection de doublons). */
export async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
