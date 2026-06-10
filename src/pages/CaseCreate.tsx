import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft, ChevronRight, MessageSquare } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../context/OrganizationContext";
import { useAuth } from "../context/AuthContext";
import { LEGAL_DOMAINS, type LegalDomain } from "../lib/types";

export default function CaseCreate() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<LegalDomain>("autre");
  const [situation, setSituation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !user) return;
    if (!title.trim() || !situation.trim()) {
      setError("Le titre et la description sont requis");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data: created, error: cErr } = await supabase
        .from("cases")
        .insert({
          org_id: currentOrg.id,
          title: title.trim(),
          domain,
          initial_question: situation.trim(),
          created_by: user.id,
        })
        .select()
        .single();
      if (cErr || !created) throw new Error(cErr?.message ?? "Création échouée");

      // Le 1er message user = la situation décrite, position 0
      await supabase.from("case_messages").insert({
        case_id: created.id,
        org_id: currentOrg.id,
        role: "user",
        content: situation.trim(),
        position: 0,
        created_by: user.id,
      });

      navigate(`/dossiers/${created.id}?autostart=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/dossiers" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
        <ArrowLeft className="size-4" /> Retour
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <MessageSquare className="size-6" />
        </div>
        <div>
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            Nouveau dossier de cas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Décrivez votre situation. L'IA analysera, sourcera, et vous proposera des actions concrètes.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Titre du dossier <span className="text-error-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex. Mise en demeure reçue de SAS X — clause non-concurrence ancien CTO"
            required
            autoFocus
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Domaine juridique
          </label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as LegalDomain)}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {LEGAL_DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Décrivez votre situation <span className="text-error-500">*</span>
          </label>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Exemple : Nous avons reçu ce matin un courrier de mise en demeure de la part de SAS X au sujet d'une clause de non-concurrence signée par notre ancien CTO… Le contrat de travail prévoyait une durée de 12 mois et une zone géographique limitée à la France. Le CTO a rejoint un concurrent il y a 3 mois. Qu'est-ce qu'on risque et quelles sont nos options ?"
            rows={8}
            required
            className="w-full rounded-lg border border-gray-300 bg-white p-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Plus vous donnez de contexte (parties, dates, montants, documents), plus l'analyse sera précise.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-error-50 px-3 py-2.5 text-sm text-error-700">{error}</div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/dossiers"
            className="inline-flex h-11 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? "Création…" : "Lancer l'analyse"}
            {!submitting && <ChevronRight className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
