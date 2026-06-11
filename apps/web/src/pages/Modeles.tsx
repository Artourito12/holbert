import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, useToast } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { useOrg } from "../context/OrgContext";

type ActeTemplate = {
  id: string;
  nom_fichier: string;
  storage_path: string;
  type_acte: string | null;
  description: string | null;
  analyse_ia: {
    en_tete?: string;
    structure?: { section: string; role: string; adaptable: boolean }[];
    champs_variables?: string[];
    style?: string;
  } | null;
  statut: "processing" | "ready" | "error";
  erreur: string | null;
  created_at: string;
};

const MIMES_OK = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "text/plain",
];

/**
 * Modèles d'actes du cabinet : l'utilisateur dépose ses propres documents
 * types (assignation, conclusions, courriers…) ; l'IA les analyse (en-tête,
 * structure, champs variables, style) puis les IMITE à chaque génération.
 */
export default function Modeles() {
  const { currentOrg } = useOrg();
  const toast = useToast();
  const [templates, setTemplates] = useState<ActeTemplate[]>([]);
  const [upload, setUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("actes_templates")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setTemplates((data as ActeTemplate[]) ?? []);
  }, [currentOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  const deposer = async (file: File) => {
    if (!currentOrg) return;
    if (!MIMES_OK.includes(file.type)) {
      toast.error("Formats acceptés : PDF, DOCX, PNG, JPEG, TXT");
      return;
    }
    setUpload(true);
    try {
      const id = crypto.randomUUID();
      const path = `${currentOrg.id}/templates/${id}/${file.name}`;
      const { error: upError } = await supabase.storage.from("documents").upload(path, file);
      if (upError) throw new Error(upError.message);

      const { data: row, error: insError } = await supabase
        .from("actes_templates")
        .insert({
          id,
          org_id: currentOrg.id,
          nom_fichier: file.name,
          storage_path: path,
          mime: file.type,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();
      if (insError) throw new Error(insError.message);

      setTemplates((t) => [row as ActeTemplate, ...t]);
      toast.success("Modèle déposé — analyse en cours (l'IA capture structure, en-tête et style)");
      await apiPost("/api/templates/analyser", { template_id: id });
      await load();
      toast.success("Modèle analysé : il sera imité à la prochaine génération d'acte");
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    } finally {
      setUpload(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const supprimer = async (tpl: ActeTemplate) => {
    await supabase.storage.from("documents").remove([tpl.storage_path]);
    await supabase.from("actes_templates").delete().eq("id", tpl.id);
    setTemplates((t) => t.filter((x) => x.id !== tpl.id));
    toast.success("Modèle supprimé");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Modèles d'actes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Déposez vos propres documents types (assignations, conclusions, courriers, mises en
          demeure…). L'IA en capture l'en-tête, la structure, les champs variables et le style —
          puis <strong>imite votre modèle</strong> à chaque création d'acte dans le chat, en
          l'adaptant au cas traité.
        </p>
      </div>

      <label
        className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-8 text-center transition hover:border-brand-400 dark:border-gray-700 dark:bg-gray-900 ${
          upload ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void deposer(f);
          }}
        />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {upload ? "Analyse du modèle en cours…" : "Déposer un modèle (PDF, DOCX, image, TXT)"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Idéalement un acte réel et abouti — l'IA distingue ce qui est fixe (cabinet, formules)
          de ce qui est propre au dossier d'origine.
        </p>
      </label>

      {templates.length === 0 ? (
        <p className="text-sm text-gray-400">
          Aucun modèle pour l'instant. Sans modèle, les actes sont générés au format
          professionnel standard.
        </p>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {tpl.nom_fichier}
                </p>
                {tpl.type_acte && <Badge size="sm" color="primary">{tpl.type_acte.replace(/_/g, " ")}</Badge>}
                <Badge
                  size="sm"
                  color={tpl.statut === "ready" ? "success" : tpl.statut === "error" ? "error" : "warning"}
                >
                  {tpl.statut === "ready" ? "prêt" : tpl.statut === "error" ? "erreur" : "analyse…"}
                </Badge>
                <button
                  onClick={() => void supprimer(tpl)}
                  className="ml-auto text-xs text-gray-400 hover:text-error-500"
                >
                  Supprimer
                </button>
              </div>
              {tpl.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tpl.description}</p>
              )}
              {tpl.statut === "error" && tpl.erreur && (
                <p className="mt-1 text-xs text-error-600">
                  {tpl.erreur}{" "}
                  <button
                    onClick={() => void apiPost("/api/templates/analyser", { template_id: tpl.id }).then(load)}
                    className="font-medium underline"
                  >
                    Relancer l'analyse
                  </button>
                </p>
              )}
              {tpl.statut === "ready" && tpl.analyse_ia && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">
                    Ce que l'IA a capturé
                  </summary>
                  <div className="mt-2 space-y-2 text-xs text-gray-500 dark:text-gray-400">
                    {tpl.analyse_ia.en_tete && (
                      <p>
                        <span className="font-medium text-gray-600 dark:text-gray-300">En-tête :</span>{" "}
                        {tpl.analyse_ia.en_tete.slice(0, 300)}
                      </p>
                    )}
                    {tpl.analyse_ia.structure && (
                      <p>
                        <span className="font-medium text-gray-600 dark:text-gray-300">Structure :</span>{" "}
                        {tpl.analyse_ia.structure.map((s) => s.section).join(" → ")}
                      </p>
                    )}
                    {tpl.analyse_ia.champs_variables && (
                      <p>
                        <span className="font-medium text-gray-600 dark:text-gray-300">Variables :</span>{" "}
                        {tpl.analyse_ia.champs_variables.join(", ")}
                      </p>
                    )}
                    {tpl.analyse_ia.style && (
                      <p>
                        <span className="font-medium text-gray-600 dark:text-gray-300">Style :</span>{" "}
                        {tpl.analyse_ia.style.slice(0, 300)}
                      </p>
                    )}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
