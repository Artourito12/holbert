import { useCallback, useEffect, useState } from "react";
import type { Conversation } from "@holbert/core";
import { PLATFORM_NAME } from "@holbert/core";
import { supabase } from "../../lib/supabase";
import { useOrg } from "../../context/OrgContext";
import ChatPanel from "../../components/ChatPanel";

/**
 * Hofraad dans le dossier (docs/10 phase 3) : conversations rattachées au
 * dossier — le chat connaît le scan, le bordereau, la chronologie et les
 * pièces, et peut produire des actes (avec les modèles du cabinet).
 */
export default function DossierChatTab({ dossierId }: { dossierId: string }) {
  const { currentOrg } = useOrg();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false })
      .limit(20);
    const liste = (data as Conversation[]) ?? [];
    setConversations(liste);
    setConvId((prev) => prev ?? liste[0]?.id ?? null);
  }, [currentOrg, dossierId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-[calc(100vh-16rem)] flex-col gap-3">
      {conversations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setConvId(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              convId === null
                ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            + Nouvelle discussion
          </button>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setConvId(c.id)}
              className={`max-w-60 truncate rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                convId === c.id
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                  : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
              }`}
            >
              {c.titre}
            </button>
          ))}
        </div>
      )}

      <ChatPanel
        key={convId ?? "new"}
        conversationId={convId}
        dossierId={dossierId}
        onConversationCreated={(id) => {
          setConvId(id);
          void load();
        }}
        placeholder="Interrogez le dossier, demandez un acte, la prochaine étape… (Entrée pour envoyer)"
        emptyState={
          <div className="mx-auto mt-10 max-w-md text-center">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {PLATFORM_NAME} connaît ce dossier
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Pièces, chronologie, bordereau et dernier scan sont dans mon
              contexte. Je vise les pièces par leur numéro et je produis des
              actes avec vos modèles.
            </p>
            <div className="mt-4 space-y-2 text-left">
              {[
                "Quelle est la prochaine étape et son délai ?",
                "Rédige le projet d'assignation",
                "Quels sont nos points faibles si l'adversaire conteste ?",
              ].map((s) => (
                <p key={s} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {s}
                </p>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
