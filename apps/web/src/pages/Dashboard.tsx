import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { OrgStats } from "@holbert/core";
import {
  MODULES,
  MODULE_IDS,
  PLATFORM_NAME,
  onboardingPourModules,
  scoreOnboarding,
} from "@holbert/core";
import { ScoreGauge } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { useOrg } from "../context/OrgContext";

const STATS_VIDES: OrgStats = {
  documents_total: 0,
  documents_ready: 0,
  documents_par_type: {},
  echeances: 0,
  conversations: 0,
  audits: 0,
  documents_generes: 0,
  dossiers: 0,
  pieces: 0,
  evenements: 0,
  demandes: 0,
  reponses_types: 0,
};

async function compter(
  table: string,
  orgId: string,
  criteres: Record<string, string> = {}
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId);
  for (const [colonne, valeur] of Object.entries(criteres)) {
    q = colonne.endsWith("__lte") ? q.lte(colonne.replace("__lte", ""), valeur) : q.eq(colonne, valeur);
  }
  const { count } = await q;
  return count ?? 0;
}

export default function Dashboard() {
  const { currentOrg, hasModule } = useOrg();
  const [stats, setStats] = useState<OrgStats>(STATS_VIDES);
  const [loading, setLoading] = useState(true);

  const actifs = MODULE_IDS.filter((id) => hasModule(id));

  useEffect(() => {
    if (!currentOrg) return;
    void (async () => {
      const org = currentOrg.id;
      const dans30j = new Date();
      dans30j.setDate(dans30j.getDate() + 30);

      const [docs, echeances, conversations] = await Promise.all([
        supabase.from("documents").select("statut, type_confirme").eq("org_id", org),
        compter("deadlines", org, {
          statut: "a_venir",
          date_echeance__lte: dans30j.toISOString().slice(0, 10),
        }),
        compter("conversations", org),
      ]);

      const parType: Record<string, number> = {};
      let ready = 0;
      for (const d of docs.data ?? []) {
        if (d.statut === "ready") ready += 1;
        if (d.type_confirme) parType[d.type_confirme] = (parType[d.type_confirme] ?? 0) + 1;
      }

      const s: OrgStats = {
        ...STATS_VIDES,
        documents_total: docs.data?.length ?? 0,
        documents_ready: ready,
        documents_par_type: parType,
        echeances,
        conversations,
      };

      if (hasModule("raader")) {
        [s.audits, s.documents_generes] = await Promise.all([
          compter("audits", org),
          compter("generated_documents", org),
        ]);
      }
      if (hasModule("pleiter")) {
        [s.dossiers, s.pieces, s.evenements] = await Promise.all([
          compter("dossiers", org, { statut: "actif" }),
          compter("pieces", org),
          compter("evenements", org),
        ]);
      }
      if (hasModule("normer")) {
        [s.demandes, s.reponses_types] = await Promise.all([
          compter("demandes", org),
          compter("reponses_types", org),
        ]);
      }

      setStats(s);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg, actifs.join(",")]);

  if (!currentOrg) {
    return (
      <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
        Bienvenue dans {PLATFORM_NAME}
      </h1>
    );
  }

  const items = onboardingPourModules(actifs);
  const score = scoreOnboarding(items, stats);
  const manquants = items.filter((i) => !i.fait(stats));

  const kpis: { label: string; valeur: number; lien: string }[] = [
    { label: "Documents", valeur: stats.documents_total, lien: "/documents" },
    { label: "Échéances ≤ 30 jours", valeur: stats.echeances, lien: "/echeancier" },
    ...(hasModule("raader") ? [{ label: "Audits réalisés", valeur: stats.audits, lien: "/raader" }] : []),
    ...(hasModule("pleiter") ? [{ label: "Dossiers actifs", valeur: stats.dossiers, lien: "/pleiter" }] : []),
    ...(hasModule("normer") ? [{ label: "Demandes Front Door", valeur: stats.demandes, lien: "/normer" }] : []),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          Espace {currentOrg.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Votre plateforme d'information juridique et d'aide à la décision.
        </p>
      </div>

      {actifs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Aucun module activé pour le moment
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Votre espace est prêt. L'activation des modules ({MODULES.raader.name},{" "}
            {MODULES.normer.name}, {MODULES.pleiter.name}) est gérée par l'équipe{" "}
            {PLATFORM_NAME} — vous serez notifié dès qu'un module sera disponible.
          </p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((k) => (
              <Link
                key={k.label}
                to={k.lien}
                className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900"
              >
                <p className="text-xs uppercase text-gray-400">{k.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {loading ? "…" : k.valeur}
                </p>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Onboarding — score de complétude */}
            <section className="xl:col-span-2 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Mise en route de votre espace
                </h2>
                <p className="text-xs text-gray-400">
                  Déposez en vrac, la plateforme classe — voici ce qui manque
                  pour en tirer le maximum.
                </p>
              </div>
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
                <div className="shrink-0 self-center sm:self-start">
                  <ScoreGauge score={score} label="Complétude" />
                </div>
                <ul className="min-w-0 flex-1 space-y-2">
                  {items.map((i) => {
                    const fait = i.fait(stats);
                    return (
                      <li key={i.id}>
                        <Link
                          to={i.lien}
                          className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                            fait
                              ? "text-gray-400 line-through"
                              : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              fait
                                ? "bg-success-500 text-white"
                                : "border border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {fait ? "✓" : ""}
                          </span>
                          {i.libelle}
                        </Link>
                      </li>
                    );
                  })}
                  {manquants.length === 0 && (
                    <li className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700 dark:bg-success-500/10">
                      Votre espace est complètement opérationnel.
                    </li>
                  )}
                </ul>
              </div>
            </section>

            {/* Modules actifs */}
            <section className="space-y-4">
              {actifs.map((id) => {
                const mod = MODULES[id];
                return (
                  <Link
                    key={id}
                    to={`/${id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400">
                        Actif
                      </span>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {mod.name}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{mod.description}</p>
                  </Link>
                );
              })}
            </section>
          </div>
        </>
      )}

      <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
        {PLATFORM_NAME} fournit de l'information juridique et des outils d'aide à
        la décision, pas du conseil juridique individualisé. Pour un conseil
        adapté à votre situation, rapprochez-vous d'un professionnel du droit.
      </p>
    </div>
  );
}
