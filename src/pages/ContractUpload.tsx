import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Upload, FileText, X, AlertCircle, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../context/OrganizationContext";
import { useAuth } from "../context/AuthContext";
import {
  CONTRACT_TYPES,
  isAllowedFile,
  formatBytes,
  type ContractType,
} from "../lib/types";

export default function ContractUpload() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [contractType, setContractType] = useState<ContractType | "">("");
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File) => {
    setError(null);
    if (!isAllowedFile(f)) {
      setError("Format non supporté. Acceptés : PDF, DOCX (max 50 Mo)");
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  }, [title]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !contractType || !title.trim() || !currentOrg || !user) return;

    setUploading(true);
    setError(null);

    try {
      const { data: contract, error: insertErr } = await supabase
        .from("contracts")
        .insert({
          org_id: currentOrg.id,
          title: title.trim(),
          contract_type: contractType,
          counterparty: counterparty.trim() || null,
          status: "draft",
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: file.type || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertErr || !contract) {
        throw new Error(insertErr?.message ?? "Création échouée");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${currentOrg.id}/${contract.id}/${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from("contracts")
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadErr) {
        await supabase.from("contracts").delete().eq("id", contract.id);
        throw new Error(uploadErr.message);
      }

      await supabase
        .from("contracts")
        .update({ storage_path: storagePath })
        .eq("id", contract.id);

      navigate(`/contrats/${contract.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setUploading(false);
    }
  };

  const canSubmit = !!file && !!contractType && title.trim().length > 0 && !uploading;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          Analyser un contrat
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Déposez votre contrat, notre IA vous livrera un rapport en moins de 60 secondes.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
              dragOver
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-gray-300 bg-white hover:border-brand-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500 dark:hover:bg-gray-800"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15">
              <Upload className="size-7" />
            </div>
            <p className="mt-4 text-base font-medium text-gray-900 dark:text-white">
              Déposez votre contrat ici
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              ou <span className="text-brand-600 underline">parcourez vos fichiers</span>
            </p>
            <p className="mt-3 text-xs text-gray-400">PDF ou DOCX • 50 Mo maximum</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) acceptFile(f);
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatBytes(file.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setTitle("");
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
              aria-label="Retirer le fichier"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type de contrat <span className="text-error-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CONTRACT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setContractType(t.value)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  contractType === t.value
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
                }`}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {t.label}
                </span>
                <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {t.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Titre du contrat <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex. NDA Société X — juin 2026"
              required
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contrepartie
            </label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="ex. ACME SAS"
              className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-error-50 px-3 py-2.5 text-sm text-error-700">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Votre document est chiffré et reste privé à votre organisation.
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Envoi en cours…" : "Analyser le contrat"}
            {!uploading && <ChevronRight className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
