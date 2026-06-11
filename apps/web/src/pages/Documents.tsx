import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Document } from "@holbert/core";
import { REFERENTIELS_REGISTRY, referentielNom } from "@holbert/core";
import { Badge, useToast } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { apiPost, sha256 } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";

const ACCEPT = ".pdf,.docx,.doc,.txt,.eml";

const STATUT_LABEL: Record<Document["statut"], { label: string; color: "light" | "warning" | "info" | "success" | "error" }> = {
  uploaded: { label: "En attente", color: "light" },
  processing: { label: "Analyse en cours…", color: "warning" },
  classified: { label: "Type à confirmer", color: "info" },
  extracting: { label: "Extraction…", color: "warning" },
  ready: { label: "Prêt", color: "success" },
  error: { label: "Erreur", color: "error" },
};

function nettoyerNom(nom: string) {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function Documents() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [enCours, setEnCours] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [choixType, setChoixType] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(`Chargement impossible : ${error.message}`);
    setDocs((data as Document[]) ?? []);
    setLoading(false);
  }, [currentOrg, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploader = async (files: FileList | File[]) => {
    if (!currentOrg || !user) return;
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 50 Mo`);
        continue;
      }
      setEnCours((prev) => [...prev, file.name]);
      try {
        const id = crypto.randomUUID();
        const path = `${currentOrg.id}/${id}/${nettoyerNom(file.name)}`;
        const hash = await sha256(file);

        const { error: insertError } = await supabase.from("documents").insert({
          id,
          org_id: currentOrg.id,
          nom_fichier: file.name,
          mime: file.type || "application/octet-stream",
          taille: file.size,
          hash_sha256: hash,
          storage_path: path,
          uploaded_by: user.id,
        });
        if (insertError) throw new Error(insertError.message);

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: file.type || undefined });
        if (uploadError) throw new Error(uploadError.message);

        await load();
        await apiPost("/api/documents/process", { document_id: id });
        toast.success(`${file.name} analysé — confirmez son type`);
      } catch (e) {
        toast.error(`${file.name} : ${(e as Error).message}`);
      } finally {
        setEnCours((prev) => prev.filter((n) => n !== file.name));
        await load();
      }
    }
  };

  const confirmer = async (doc: Document, type: string) => {
    setEnCours((prev) => [...prev, doc.id]);
    try {
      const r = await apiPost<{ faits: number; echeances: number }>(
        "/api/documents/confirm-type",
        { document_id: doc.id, type }
      );
      toast.success(
        `${doc.nom_fichier} : ${r.faits} donnée(s) extraite(s), ${r.echeances} échéance(s) détectée(s)`
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnCours((prev) => prev.filter((n) => n !== doc.id));
      await load();
    }
  };

  if (!currentOrg) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
            Documents
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Déposez vos documents en vrac : ils sont classés, indexés et leurs
            échéances détectées automatiquement.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-11 items-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          + Importer des documents (PDF, DOCX — 50 Mo max)
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploader(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void uploader(e.dataTransfer.files);
        }}
        className={`mb-6 rounded-2xl border-2 border-dashed p-8 text-center text-sm transition ${
          dragOver
            ? "border-brand-400 bg-brand-25 text-brand-600"
            : "border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
        }`}
      >
        Glissez-déposez vos fichiers ici (mails, contrats, courriers…)
        {enCours.length > 0 && (
          <p className="mt-2 font-medium text-brand-600">
            Traitement en cours : {enCours.length} élément(s)…
          </p>
        )}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <p className="px-5 py-8 text-sm text-gray-500">Chargement…</p>
        ) : docs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            Aucun document pour le moment. Commencez par en importer — c'est la
            base de tout le reste.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {docs.map((doc) => {
              const statut = STATUT_LABEL[doc.statut];
              const busy = enCours.includes(doc.id);
              return (
                <li key={doc.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="block truncate text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white"
                      >
                        {doc.nom_fichier}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(doc.created_at).toLocaleDateString("fr-FR")} ·{" "}
                        {(doc.taille / 1024).toFixed(0)} Ko
                        {doc.type_confirme && ` · ${referentielNom(doc.type_confirme)}`}
                        {doc.version_de && " · doublon ou version d'un document existant"}
                      </p>
                    </div>
                    <Badge size="sm" color={statut.color}>
                      {busy ? "Traitement…" : statut.label}
                    </Badge>
                  </div>

                  {doc.statut === "classified" && !busy && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-blue-light-50 px-4 py-3 text-sm dark:bg-blue-light-500/10">
                      <span className="text-gray-700 dark:text-gray-200">
                        {doc.type_detecte && doc.type_detecte !== "inconnu" ? (
                          <>
                            Type détecté :{" "}
                            <strong>{referentielNom(doc.type_detecte)}</strong>
                            {doc.type_confiance != null &&
                              ` (confiance ${(doc.type_confiance * 100).toFixed(0)} %)`}
                            . C'est bien ça ?
                          </>
                        ) : (
                          <>Type non reconnu — choisissez-le ou laissez l'analyse générique.</>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {doc.type_detecte && doc.type_detecte !== "inconnu" && (
                          <button
                            onClick={() => confirmer(doc, doc.type_detecte!)}
                            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                          >
                            Confirmer
                          </button>
                        )}
                        <select
                          value={choixType[doc.id] ?? ""}
                          onChange={(e) =>
                            setChoixType((p) => ({ ...p, [doc.id]: e.target.value }))
                          }
                          className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                          <option value="">Autre type…</option>
                          {REFERENTIELS_REGISTRY.filter((r) => r.id !== "generique").map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nom}
                            </option>
                          ))}
                          <option value="generique">Document juridique (générique)</option>
                        </select>
                        {choixType[doc.id] && (
                          <button
                            onClick={() => confirmer(doc, choixType[doc.id])}
                            className="rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          >
                            Valider ce type
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {doc.statut === "error" && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
                      <span>{doc.erreur ?? "Erreur de traitement."}</span>
                      <button
                        onClick={async () => {
                          try {
                            await apiPost("/api/documents/process", { document_id: doc.id });
                            toast.success("Nouvelle analyse lancée");
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                          await load();
                        }}
                        className="rounded-lg border border-error-300 px-3 py-1.5 text-xs font-medium hover:bg-error-100"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
