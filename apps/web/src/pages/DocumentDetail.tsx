import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Audit, Deadline, Document, ExtractedFact } from "@holbert/core";
import { REFERENTIELS_REGISTRY, referentielNom } from "@holbert/core";
import { Badge, Modal, useModal, useToast } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { useOrg } from "../context/OrgContext";

const OBJECTIFS = [
  { id: "signer", label: "Je m'apprête à le signer" },
  { id: "renegocier", label: "Je veux le renégocier" },
  { id: "sortir", label: "Je veux en sortir" },
  { id: "comprendre", label: "Je veux comprendre mes engagements" },
] as const;

function libelleFait(faitId: string) {
  const l = faitId.replace(/_/g, " ");
  return l.charAt(0).toUpperCase() + l.slice(1);
}

function valeurAffichee(f: ExtractedFact): string {
  if (f.valeur.items?.length) {
    return f.valeur.items
      .map((i) =>
        [i.libelle, i.date && new Date(i.date + "T00:00:00").toLocaleDateString("fr-FR"), i.montant != null && `${i.montant.toLocaleString("fr-FR")} €`]
          .filter(Boolean)
          .join(" — ")
      )
      .join(" · ");
  }
  if (f.valeur.date) {
    return `${f.valeur.texte} (${new Date(f.valeur.date + "T00:00:00").toLocaleDateString("fr-FR")})`;
  }
  if (f.valeur.montant != null) {
    return `${f.valeur.montant.toLocaleString("fr-FR")} € — ${f.valeur.texte}`;
  }
  return f.valeur.texte;
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentOrg, hasModule } = useOrg();
  const toast = useToast();
  const navigate = useNavigate();
  const auditModal = useModal();
  const [doc, setDoc] = useState<Document | null>(null);
  const [faits, setFaits] = useState<ExtractedFact[]>([]);
  const [echeances, setEcheances] = useState<Deadline[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [objectif, setObjectif] = useState<string>("signer");
  const [auditEnCours, setAuditEnCours] = useState(false);

  useEffect(() => {
    if (!id || !currentOrg) return;
    void (async () => {
      const [d, f, e, a] = await Promise.all([
        supabase.from("documents").select("*").eq("id", id).maybeSingle(),
        supabase.from("extracted_facts").select("*").eq("document_id", id),
        supabase.from("deadlines").select("*").eq("document_id", id).order("date_echeance"),
        supabase.from("audits").select("*").eq("document_id", id).order("created_at", { ascending: false }),
      ]);
      setDoc((d.data as Document) ?? null);
      setFaits((f.data as ExtractedFact[]) ?? []);
      setEcheances((e.data as Deadline[]) ?? []);
      setAudits((a.data as Audit[]) ?? []);
      setLoading(false);
    })();
  }, [id, currentOrg]);

  const registryEntry = REFERENTIELS_REGISTRY.find((r) => r.id === doc?.type_confirme);
  const auditable =
    !!doc &&
    doc.statut === "ready" &&
    hasModule("raader") &&
    (registryEntry?.roles.length ?? 0) > 0;

  const lancerAudit = async () => {
    if (!doc || !role) return;
    setAuditEnCours(true);
    try {
      const r = await apiPost<{ audit: Audit }>("/api/contrats/audit", {
        document_id: doc.id,
        role,
        objectif,
      });
      auditModal.closeModal();
      navigate(`/audits/${r.audit.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAuditEnCours(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;
  if (!doc) {
    return (
      <div>
        <p className="text-sm text-gray-500">Document introuvable.</p>
        <Link to="/documents" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Retour aux documents
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/documents"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ← Documents
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            {doc.nom_fichier}
          </h1>
          {doc.type_confirme && (
            <Badge color="primary">{referentielNom(doc.type_confirme)}</Badge>
          )}
          {doc.statut !== "ready" && <Badge color="warning">{doc.statut}</Badge>}
        </div>
        {auditable && (
          <button
            onClick={auditModal.openModal}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Auditer ce contrat
          </button>
        )}
      </div>

      {audits.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Audits :</span>
          {audits.map((a) => (
            <Link
              key={a.id}
              to={`/audits/${a.id}`}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
            >
              {new Date(a.created_at).toLocaleDateString("fr-FR")} · côté {a.role}
              {a.score != null && ` · risque ${a.score}/100`}
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={auditModal.isOpen} onClose={auditModal.closeModal} className="max-w-md p-8">
        <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
          Auditer ce contrat
        </h3>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          L'audit dépend de votre camp : les mêmes clauses ne présentent pas
          les mêmes risques des deux côtés.
        </p>

        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Votre camp</p>
        <div className="mb-5 flex gap-2">
          {(registryEntry?.roles ?? []).map((r) => (
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

        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Votre objectif</p>
        <div className="mb-6 space-y-2">
          {OBJECTIFS.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="objectif"
                checked={objectif === o.id}
                onChange={() => setObjectif(o.id)}
                className="text-brand-500"
              />
              {o.label}
            </label>
          ))}
        </div>

        <button
          onClick={() => void lancerAudit()}
          disabled={!role || auditEnCours}
          className="h-11 w-full rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {auditEnCours ? "Audit en cours… (jusqu'à une minute)" : "Lancer l'audit"}
        </button>
      </Modal>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Données extraites
              <span className="ml-2 text-sm font-normal text-gray-400">{faits.length}</span>
            </h2>
          </div>
          {faits.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">
              Aucune donnée extraite pour le moment
              {doc.statut === "classified" && " — confirmez d'abord le type du document"}.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {faits.map((f) => (
                <li key={f.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-400">
                        {libelleFait(f.fait_id)}
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {valeurAffichee(f)}
                      </p>
                      {f.passage_source && (
                        <blockquote className="mt-2 border-l-2 border-brand-200 pl-3 text-xs italic text-gray-500 dark:text-gray-400">
                          « {f.passage_source} »
                        </blockquote>
                      )}
                    </div>
                    {f.confiance != null && (
                      <span className="shrink-0 text-xs text-gray-400">
                        {(f.confiance * 100).toFixed(0)} %
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Échéances détectées
            </h2>
          </div>
          {echeances.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">Aucune échéance détectée.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {echeances.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(e.date_echeance + "T00:00:00").toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{e.titre}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
            <Link
              to="/echeancier"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Voir l'échéancier complet →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
