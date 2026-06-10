import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, FileText, Sparkles, Clock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatBytes, type Contract } from "../lib/types";

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setContract(data as Contract);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Chargement…
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="space-y-4">
        <Link
          to="/contrats"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="size-4" /> Retour
        </Link>
        <div className="rounded-lg bg-error-50 p-4 text-sm text-error-700">
          {error ?? "Contrat introuvable"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/contrats"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Tous les contrats
      </Link>

      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <FileText className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
            {contract.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {contract.original_filename}
            {contract.file_size_bytes != null && ` • ${formatBytes(contract.file_size_bytes)}`}
            {contract.counterparty && ` • ${contract.counterparty}`}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 dark:border-brand-800/50 dark:bg-brand-500/5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
          <Sparkles className="size-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Analyse en attente
            </h2>
            <Clock className="size-4 text-gray-400" />
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Le pipeline d'analyse IA sera disponible très bientôt. Vous pourrez relancer une
            analyse complète depuis cette page (contextualisation, extraction des clauses,
            score de risque, suggestions).
          </p>
        </div>
      </div>
    </div>
  );
}
