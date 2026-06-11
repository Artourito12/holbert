import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { GeneratedDocument } from "@holbert/core";
import { supabase } from "../lib/supabase";
import { telechargerDocx } from "../lib/docx";
import RenduTexte from "../components/RenduTexte";

/** Acte rédigé dans la conversation : aperçu repliable + DOCX + lien fiche. */
export default function DocumentGenereWidget({
  documentId,
  titre,
}: {
  documentId: string;
  titre: string;
}) {
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    void supabase
      .from("generated_documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle()
      .then(({ data }) => setDoc(data as GeneratedDocument));
  }, [documentId]);

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-sm font-semibold capitalize text-gray-900 dark:text-white">
          📄 {titre}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setOuvert((v) => !v)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            {ouvert ? "Replier" : "Lire ici"}
          </button>
          {doc && (
            <>
              <button
                onClick={() => void telechargerDocx(doc.titre, doc.contenu)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                DOCX
              </button>
              <Link
                to={`/contrats/${doc.id}`}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
              >
                Ouvrir la fiche →
              </Link>
            </>
          )}
        </div>
      </div>
      {ouvert && doc && (
        <div className="custom-scrollbar max-h-[60vh] overflow-y-auto border-t border-gray-100 px-4 py-4 dark:border-gray-800">
          <RenduTexte texte={doc.contenu} />
        </div>
      )}
    </div>
  );
}
