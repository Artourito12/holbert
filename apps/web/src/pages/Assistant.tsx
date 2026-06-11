import { useCallback, useEffect, useState } from "react";
import type { Conversation } from "@holbert/core";
import { supabase } from "../lib/supabase";
import { useOrg } from "../context/OrgContext";
import ChatPanel from "../components/ChatPanel";

export default function Assistant() {
  const { currentOrg } = useOrg();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [saisieSuggeree, setSaisieSuggeree] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("org_id", currentOrg.id)
      .is("dossier_id", null)
      .order("created_at", { ascending: false })
      .limit(30);
    setConversations((data as Conversation[]) ?? []);
  }, [currentOrg]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      {/* Conversations */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:flex">
        <div className="border-b border-gray-200 p-3 dark:border-gray-800">
          <button
            onClick={() => setConvId(null)}
            className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + Nouvelle conversation
          </button>
        </div>
        <ul className="custom-scrollbar flex-1 overflow-y-auto p-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setConvId(c.id)}
                className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                  c.id === convId
                    ? "bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                {c.titre}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <ChatPanel
        key={`${convId ?? "new"}-${saisieSuggeree ?? ""}`}
        saisieInitiale={saisieSuggeree ?? undefined}
        conversationId={convId}
        onConversationCreated={(id) => {
          setConvId(id);
          void loadConversations();
        }}
        emptyState={
          <div className="mx-auto mt-12 max-w-md text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Posez votre question juridique
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Je cherche d'abord dans les documents de votre organisation, puis
              je réponds en citant mes sources.
            </p>
            <div className="mt-4 space-y-2">
              {[
                "Quelle est la durée de mon bail commercial ?",
                "Rédige-moi une mise en demeure de payer",
                "Que disent mes CGV sur les délais de paiement ?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setSaisieSuggeree(s)}
                  className="block w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
