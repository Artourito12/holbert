import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import type { Deadline } from "@holbert/core";
import { Badge, useToast } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { useOrg } from "../context/OrgContext";

function joursRestants(date: string) {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + "T00:00:00").getTime() - aujourdhui.getTime()) / 86400000);
}

function badgeUrgence(jours: number): { label: string; color: "error" | "warning" | "info" | "light" } {
  if (jours < 0) return { label: "Dépassée", color: "error" };
  if (jours <= 7) return { label: `J-${jours}`, color: "error" };
  if (jours <= 30) return { label: `J-${jours}`, color: "warning" };
  return { label: `J-${jours}`, color: "light" };
}

export default function Echeancier() {
  const { currentOrg } = useOrg();
  const toast = useToast();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [filtre, setFiltre] = useState<"a_venir" | "toutes">("a_venir");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    let q = supabase
      .from("deadlines")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("date_echeance");
    if (filtre === "a_venir") q = q.eq("statut", "a_venir");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setDeadlines((data as Deadline[]) ?? []);
    setLoading(false);
  }, [currentOrg, filtre, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const changerStatut = async (d: Deadline, statut: Deadline["statut"]) => {
    const { error } = await supabase.from("deadlines").update({ statut }).eq("id", d.id);
    if (error) toast.error(error.message);
    else toast.success(statut === "traitee" ? "Échéance marquée comme traitée" : "Échéance ignorée");
    await load();
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            Échéancier
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Toutes les dates détectées dans vos documents, avec alertes automatiques.
          </p>
        </div>
        <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
          {(["a_venir", "toutes"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                filtre === f
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              {f === "a_venir" ? "À venir" : "Toutes"}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <p className="px-5 py-8 text-sm text-gray-500">Chargement…</p>
        ) : deadlines.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            Aucune échéance {filtre === "a_venir" ? "à venir" : ""}. Les dates
            extraites de vos documents apparaîtront ici automatiquement.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {deadlines.map((d) => {
              const jours = joursRestants(d.date_echeance);
              const urgence = badgeUrgence(jours);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 shrink-0 text-center">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {new Date(d.date_echeance + "T00:00:00").toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(d.date_echeance + "T00:00:00").getFullYear()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {d.titre}
                      </p>
                      {d.document_id && (
                        <Link
                          to={`/documents/${d.document_id}`}
                          className="text-xs text-brand-600 hover:text-brand-700"
                        >
                          Voir le document source →
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.statut === "a_venir" ? (
                      <>
                        <Badge size="sm" color={urgence.color}>
                          {urgence.label}
                        </Badge>
                        <button
                          onClick={() => changerStatut(d, "traitee")}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Traitée
                        </button>
                        <button
                          onClick={() => changerStatut(d, "ignoree")}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600"
                        >
                          Ignorer
                        </button>
                      </>
                    ) : (
                      <Badge size="sm" color={d.statut === "traitee" ? "success" : "light"}>
                        {d.statut === "traitee" ? "Traitée" : "Ignorée"}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
