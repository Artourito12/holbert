import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { Demande, ReponseType } from "@holbert/core";
import { MODULES } from "@holbert/core";
import { Badge } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { useOrg } from "../../context/OrgContext";

type Onglet = "demandes" | "reponses" | "reporting";

export const STATUT_DEMANDE: Record<
  Demande["statut"],
  { label: string; color: "light" | "warning" | "success" | "info" }
> = {
  nouvelle: { label: "Qualification…", color: "light" },
  a_valider: { label: "À valider", color: "warning" },
  repondue: { label: "Répondue", color: "success" },
  cloturee: { label: "Clôturée", color: "info" },
};

export const PRIORITE_COLOR: Record<Demande["priorite"], "light" | "info" | "warning" | "error"> = {
  basse: "light",
  normale: "info",
  haute: "warning",
  critique: "error",
};

function moyenneHeures(demandes: Demande[]): string {
  const repondues = demandes.filter((d) => d.validee_at);
  if (!repondues.length) return "—";
  const totalH =
    repondues.reduce(
      (acc, d) => acc + (new Date(d.validee_at!).getTime() - new Date(d.created_at).getTime()),
      0
    ) /
    repondues.length /
    3600000;
  return totalH < 48 ? `${totalH.toFixed(1)} h` : `${(totalH / 24).toFixed(1)} j`;
}

export default function NormerHub() {
  const { currentOrg } = useOrg();
  const [onglet, setOnglet] = useState<Onglet>("demandes");
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [reponses, setReponses] = useState<ReponseType[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [d, r] = await Promise.all([
      supabase
        .from("demandes")
        .select("*")
        .eq("org_id", currentOrg.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reponses_types")
        .select("*")
        .eq("org_id", currentOrg.id)
        .order("usage_count", { ascending: false }),
    ]);
    setDemandes((d.data as Demande[]) ?? []);
    setReponses((r.data as ReponseType[]) ?? []);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const parStatut = Object.fromEntries(
      (Object.keys(STATUT_DEMANDE) as Demande["statut"][]).map((s) => [
        s,
        demandes.filter((d) => d.statut === s).length,
      ])
    );
    const parCategorie = new Map<string, number>();
    for (const d of demandes) {
      const c = d.categorie ?? "non qualifiée";
      parCategorie.set(c, (parCategorie.get(c) ?? 0) + 1);
    }
    return { parStatut, parCategorie: [...parCategorie.entries()].sort((a, b) => b[1] - a[1]) };
  }, [demandes]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            {MODULES.normer.name} — Front Door
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Les demandes entrent, sont qualifiées et proposées à la validation
            d'un juriste. Chaque réponse validée enrichit la mémoire de la
            direction juridique.
          </p>
        </div>
        <Link
          to="/demandes/nouvelle"
          className="inline-flex h-11 items-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          + Nouvelle demande
        </Link>
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(
          [
            ["demandes", `Demandes (${demandes.length})`],
            ["reponses", `Réponses types (${reponses.length})`],
            ["reporting", "Reporting"],
          ] as [Onglet, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setOnglet(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              onglet === key
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {onglet === "demandes" && (
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <p className="px-5 py-8 text-sm text-gray-500">Chargement…</p>
          ) : demandes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              Aucune demande. Les opérationnels déposent leurs questions ici —
              et la direction juridique garde la main sur chaque réponse.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {demandes.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/demandes/${d.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {d.objet}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(d.created_at).toLocaleDateString("fr-FR")}
                        {d.categorie && ` · ${d.categorie}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge size="sm" color={PRIORITE_COLOR[d.priorite]}>
                        {d.priorite}
                      </Badge>
                      <Badge size="sm" color={STATUT_DEMANDE[d.statut].color}>
                        {STATUT_DEMANDE[d.statut].label}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {onglet === "reponses" && (
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {reponses.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              La base de réponses types se construit automatiquement : cochez
              « Ajouter aux réponses types » en validant une demande.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {reponses.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
                      {r.question}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {r.categorie && `${r.categorie} · `}réutilisée {r.usage_count} fois
                      </span>
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
                      {r.reponse}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {onglet === "reporting" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Demandes totales", valeur: String(demandes.length) },
              { label: "En attente de validation", valeur: String(stats.parStatut.a_valider ?? 0) },
              { label: "Répondues", valeur: String(stats.parStatut.repondue ?? 0) },
              { label: "Délai moyen de réponse", valeur: moyenneHeures(demandes) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <p className="text-xs uppercase text-gray-400">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                  {kpi.valeur}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
              Typologie des demandes
            </h2>
            {stats.parCategorie.length === 0 ? (
              <p className="text-sm text-gray-500">Pas encore de données.</p>
            ) : (
              <div className="space-y-3">
                {stats.parCategorie.map(([cat, n]) => (
                  <div key={cat}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{cat}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{n}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-2 rounded-full bg-brand-500"
                        style={{ width: `${(n / demandes.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-gray-400">
              Le tableau de bord que la direction juridique présente à sa
              direction générale : volumes, délais, typologies.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
