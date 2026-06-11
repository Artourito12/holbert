import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { Audit, Document } from "@holbert/core";
import { REFERENTIELS_REGISTRY, referentielNom } from "@holbert/core";
import { ScoreGauge, useToast } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { useOrg } from "../context/OrgContext";

const OBJECTIFS = [
  { id: "signer", label: "Je m'apprête à le signer" },
  { id: "renegocier", label: "Je veux le renégocier" },
  { id: "sortir", label: "Je veux en sortir" },
  { id: "comprendre", label: "Comprendre mes engagements" },
] as const;

export default function AuditContexteWidget({
  prefill,
}: {
  prefill?: { document_hint?: string | null; role?: string | null; objectif?: string | null };
}) {
  const { currentOrg } = useOrg();
  const toast = useToast();
  const [docs, setDocs] = useState<Document[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(prefill?.role ?? null);
  const [objectif, setObjectif] = useState<string>(prefill?.objectif ?? "signer");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Audit | null>(null);

  const typesAuditables = useMemo(
    () => REFERENTIELS_REGISTRY.filter((r) => r.roles.length > 0).map((r) => r.id),
    []
  );

  useEffect(() => {
    if (!currentOrg) return;
    void supabase
      .from("documents")
      .select("*")
      .eq("org_id", currentOrg.id)
      .eq("statut", "ready")
      .in("type_confirme", typesAuditables)
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data }) => {
        const liste = (data as Document[]) ?? [];
        setDocs(liste);
        // Présélection : indice de nom donné dans la conversation, sinon document unique
        const hint = prefill?.document_hint?.toLowerCase();
        const trouve = hint
          ? liste.find((d) => d.nom_fichier.toLowerCase().includes(hint))
          : liste.length === 1
            ? liste[0]
            : null;
        if (trouve) setDocId(trouve.id);
      });
  }, [currentOrg, typesAuditables, prefill?.document_hint]);

  const docChoisi = docs.find((d) => d.id === docId) ?? null;
  const roles = REFERENTIELS_REGISTRY.find((r) => r.id === docChoisi?.type_confirme)?.roles ?? [];

  const lancer = async () => {
    if (!docChoisi || !role) return;
    setEnCours(true);
    try {
      const r = await apiPost<{ audit: Audit }>("/api/contrats/audit", {
        document_id: docChoisi.id,
        role,
        objectif,
      });
      setResultat(r.audit);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  if (resultat) {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-5">
          <ScoreGauge score={resultat.score ?? 0} size={110} label="Risque" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Audit terminé — {docChoisi?.nom_fichier}
            </p>
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
              {resultat.synthese}
            </p>
            <Link
              to={`/audits/${resultat.id}`}
              className="mt-2 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Ouvrir le document annoté (surlignage + notes) →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-brand-200 bg-white p-4 dark:border-brand-500/30 dark:bg-gray-900">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase text-gray-400">1. Le contrat</p>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun contrat auditable dans votre base —{" "}
            <Link to="/documents" className="font-medium text-brand-600">
              importez-le d'abord dans Documents
            </Link>{" "}
            (il sera classé puis auditable ici).
          </p>
        ) : (
          <select
            value={docId ?? ""}
            onChange={(e) => {
              setDocId(e.target.value || null);
              setRole(null);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">Choisissez le contrat…</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom_fichier} — {referentielNom(d.type_confirme)}
              </option>
            ))}
          </select>
        )}
      </div>

      {docChoisi && (
        <>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase text-gray-400">
              2. Qui je défends
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${
                    role === r
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                      : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase text-gray-400">3. L'objectif</p>
            <div className="flex flex-wrap gap-2">
              {OBJECTIFS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setObjectif(o.id)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    objectif === o.id
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                      : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void lancer()}
            disabled={!role || enCours}
            className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {enCours
              ? "Audit en cours — analyse clause par clause… (1 à 3 minutes)"
              : "Lancer l'audit"}
          </button>
          {enCours && (
            <p className="text-xs text-gray-400">
              Si vous quittez cette page, l'audit continue : retrouvez-le dans la
              fiche du document.
            </p>
          )}
        </>
      )}
    </div>
  );
}
