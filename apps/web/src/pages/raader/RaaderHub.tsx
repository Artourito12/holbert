import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Audit, GeneratedDocument } from "@holbert/core";
import { MODULES, referentielNom } from "@holbert/core";
import { Badge } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { useOrg } from "../../context/OrgContext";

export default function RaaderHub() {
  const { currentOrg } = useOrg();
  const [audits, setAudits] = useState<(Audit & { documents: { nom_fichier: string } | null })[]>([]);
  const [generes, setGeneres] = useState<GeneratedDocument[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    void (async () => {
      const [a, g] = await Promise.all([
        supabase
          .from("audits")
          .select("*, documents(nom_fichier)")
          .eq("org_id", currentOrg.id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("generated_documents")
          .select("*")
          .eq("org_id", currentOrg.id)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      setAudits((a.data as typeof audits) ?? []);
      setGeneres((g.data as GeneratedDocument[]) ?? []);
    })();
  }, [currentOrg]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          {MODULES.raader.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {MODULES.raader.description}
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          to="/documents"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-gray-900"
        >
          <h2 className="text-base font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white">
            Auditer un contrat →
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Votre camp, votre objectif : clauses manquantes, illégales,
            défavorables, score de risque et reformulations.
          </p>
        </Link>
        <Link
          to="/contrats/nouveau"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-gray-900"
        >
          <h2 className="text-base font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white">
            Créer un contrat →
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Questionnaire guidé, variantes par camp, export DOCX.
          </p>
        </Link>
        <Link
          to="/calculateurs"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-gray-900"
        >
          <h2 className="text-base font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white">
            Calculateurs →
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Licenciement, pension et arriérés, prescription — détail du calcul
            et sources inclus.
          </p>
        </Link>
        <Link
          to="/courriers/nouveau"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-theme-md dark:border-gray-800 dark:bg-gray-900"
        >
          <h2 className="text-base font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white">
            Rédiger un courrier →
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Mise en demeure, résiliations, dépôt de garantie — avec leurs
            fondements juridiques.
          </p>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Derniers audits
            </h2>
          </div>
          {audits.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">Aucun audit pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {audits.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/audits/${a.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {a.documents?.nom_fichier ?? referentielNom(a.referentiel_id)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {referentielNom(a.referentiel_id)} · côté {a.role} ·{" "}
                        {new Date(a.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    {a.statut === "done" && a.score != null ? (
                      <Badge
                        size="sm"
                        color={a.score >= 67 ? "error" : a.score >= 34 ? "warning" : "success"}
                      >
                        Risque {a.score}/100
                      </Badge>
                    ) : (
                      <Badge size="sm" color={a.statut === "error" ? "error" : "warning"}>
                        {a.statut === "error" ? "Erreur" : "En cours"}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Contrats générés
            </h2>
          </div>
          {generes.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">Aucun contrat généré pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {generes.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/contrats/${g.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {g.titre}
                      </p>
                      <p className="text-xs text-gray-400">
                        {g.variante === "equilibree"
                          ? "Équilibré"
                          : g.variante === "protectrice_a"
                            ? "Protecteur côté A"
                            : "Protecteur côté B"}
                        {g.role && ` · côté ${g.role}`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(g.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
