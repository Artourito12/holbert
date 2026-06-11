import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { Demande } from "@holbert/core";
import { Badge, useToast } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { apiPost } from "../../lib/api";
import { useOrg } from "../../context/OrgContext";
import RenduTexte from "../../components/RenduTexte";
import { PRIORITE_COLOR, STATUT_DEMANDE } from "./NormerHub";

export default function DemandeDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentOrg, currentOrg: org } = useOrg();
  const toast = useToast();
  const [demande, setDemande] = useState<Demande | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [reponse, setReponse] = useState("");
  const [enrichir, setEnrichir] = useState(true);
  const [validation, setValidation] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !org) return;
    const [{ data: d }, { data: m }] = await Promise.all([
      supabase.from("demandes").select("*").eq("id", id).maybeSingle(),
      supabase.rpc("org_role", { p_org: org.id }),
    ]);
    setDemande((d as Demande) ?? null);
    setRole((m as string) ?? null);
    if (d?.reponse_ia && !d.reponse_finale) setReponse(d.reponse_ia);
    setLoading(false);
  }, [id, org]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;
  if (!demande || !currentOrg) {
    return (
      <div>
        <p className="text-sm text-gray-500">Demande introuvable.</p>
        <Link to="/normer" className="text-sm font-medium text-brand-600">← Front Door</Link>
      </div>
    );
  }

  const estJuriste = role === "owner" || role === "admin";

  const valider = async () => {
    setValidation(true);
    try {
      await apiPost("/api/normer/valider", {
        demande_id: demande.id,
        reponse_finale: reponse,
        enrichir_base: enrichir,
      });
      toast.success("Réponse validée et transmise au demandeur");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setValidation(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/normer" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Front Door
      </Link>
      <div className="mt-2 mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          {demande.objet}
        </h1>
        <Badge size="sm" color={PRIORITE_COLOR[demande.priorite]}>{demande.priorite}</Badge>
        <Badge size="sm" color={STATUT_DEMANDE[demande.statut].color}>
          {STATUT_DEMANDE[demande.statut].label}
        </Badge>
      </div>
      <p className="mb-6 text-xs text-gray-400">
        Déposée le {new Date(demande.created_at).toLocaleDateString("fr-FR")}
        {demande.categorie && ` · ${demande.categorie}`}
      </p>

      {demande.description && (
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-2 text-sm font-semibold uppercase text-gray-400">La demande</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {demande.description}
          </p>
        </section>
      )}

      {demande.statut === "repondue" && demande.reponse_finale && (
        <section className="mb-6 rounded-xl border border-success-200 bg-success-25 p-5 dark:border-success-500/30 dark:bg-success-500/10">
          <h2 className="mb-2 text-sm font-semibold uppercase text-success-700">
            Réponse de la direction juridique
          </h2>
          <RenduTexte texte={demande.reponse_finale} />
          <p className="mt-3 text-xs text-gray-400">
            Validée le {demande.validee_at && new Date(demande.validee_at).toLocaleDateString("fr-FR")}
          </p>
        </section>
      )}

      {demande.statut === "a_valider" && (
        <>
          {estJuriste ? (
            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-1 text-sm font-semibold uppercase text-gray-400">
                Réponse proposée — à valider
              </h2>
              <p className="mb-3 text-xs text-gray-400">
                Relisez, corrigez si besoin : c'est VOTRE réponse qui part au
                demandeur, pas celle de l'IA.
              </p>
              <textarea
                rows={12}
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={enrichir}
                  onChange={(e) => setEnrichir(e.target.checked)}
                />
                Ajouter aux réponses types (réutilisable pour les prochaines
                demandes similaires)
              </label>
              <button
                onClick={() => void valider()}
                disabled={validation || reponse.trim().length < 10}
                className="mt-4 h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {validation ? "Validation…" : "Valider et répondre au demandeur"}
              </button>
            </section>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
              Votre demande est qualifiée et attend la validation d'un juriste.
              Vous serez notifié dès que la réponse sera prête.
            </p>
          )}
        </>
      )}

      {demande.statut === "nouvelle" && (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
          Qualification en cours…
        </p>
      )}
    </div>
  );
}
