import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { GeneratedDocument } from "@holbert/core";
import { referentielNom } from "@holbert/core";
import { Badge, useToast } from "@holbert/ui";
import { supabase } from "../../lib/supabase";
import { telechargerDocx } from "../../lib/docx";
import { useOrg } from "../../context/OrgContext";
import RenduTexte from "../../components/RenduTexte";

export default function ContratGenere() {
  const { id } = useParams<{ id: string }>();
  const { currentOrg } = useOrg();
  const toast = useToast();
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !currentOrg) return;
    void supabase
      .from("generated_documents")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setDoc((data as GeneratedDocument) ?? null);
        setLoading(false);
      });
  }, [id, currentOrg]);

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;
  if (!doc) {
    return (
      <div>
        <p className="text-sm text-gray-500">Contrat introuvable.</p>
        <Link to="/raader" className="text-sm font-medium text-brand-600">← Raader</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/raader" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Raader
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            {doc.titre}
          </h1>
          <Badge color="primary">{referentielNom(doc.type)}</Badge>
          {doc.role && <Badge color="light">côté {doc.role}</Badge>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(doc.contenu);
              toast.success("Contrat copié");
            }}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Copier
          </button>
          <button
            onClick={() => void telechargerDocx(doc.titre, doc.contenu)}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Télécharger en DOCX
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <RenduTexte texte={doc.contenu} />
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Document généré automatiquement à partir de vos réponses — relisez-le
        intégralement et complétez les champs [À COMPLÉTER] avant tout usage.
        Information juridique, pas un conseil individualisé.
      </p>
    </div>
  );
}
