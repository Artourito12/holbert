import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { GeneratedDocument } from "@holbert/core";
import { REFERENTIELS_REGISTRY } from "@holbert/core";
import { useToast } from "@holbert/ui";
import { apiPost } from "../lib/api";
import { telechargerDocx } from "../lib/docx";
import { useOrg } from "../context/OrgContext";

const VARIANTES = [
  { id: "protectrice_a", label: (a: string) => `Protectrice côté ${a}` },
  { id: "equilibree", label: () => "Équilibrée (standard de marché)" },
  { id: "protectrice_b", label: (b: string) => `Protectrice côté ${b}` },
] as const;

type Etape =
  | { phase: "type" }
  | { phase: "camp" }
  | { phase: "variante" }
  | { phase: "question"; index: number }
  | { phase: "generation" }
  | { phase: "fini"; doc: GeneratedDocument };

/**
 * Création de contrat conversationnelle : l'assistant pose les questions
 * UNE PAR UNE (avec leur pourquoi), dans le chat.
 */
export default function ContratAssistantWidget({
  prefill,
}: {
  prefill?: { type?: string | null; role?: string | null };
}) {
  const { currentOrg } = useOrg();
  const toast = useToast();
  const types = useMemo(() => REFERENTIELS_REGISTRY.filter((r) => r.id !== "generique"), []);

  const prefType = types.find((t) => t.id === prefill?.type) ?? null;
  const [typeId, setTypeId] = useState<string | null>(prefType?.id ?? null);
  const [role, setRole] = useState<string | null>(
    prefType && prefill?.role && prefType.roles.includes(prefill.role) ? prefill.role : null
  );
  const [variante, setVariante] = useState("equilibree");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [saisie, setSaisie] = useState("");
  const [etape, setEtape] = useState<Etape>(
    prefType ? { phase: "camp" } : { phase: "type" }
  );

  const type = types.find((t) => t.id === typeId) ?? null;
  const questionnaire = useMemo(() => {
    if (!type) return [];
    return [
      ...type.faits_requis.map((f) => ({ id: f.id, question: f.libelle, pourquoi: null as string | null })),
      ...(role ? (type.questions[role] ?? []).map((q) => ({ id: q.id, question: q.question, pourquoi: q.pourquoi })) : []),
    ];
  }, [type, role]);

  const generer = async (toutes: Record<string, string>) => {
    if (!currentOrg || !type) return;
    setEtape({ phase: "generation" });
    try {
      const r = await apiPost<{ document: GeneratedDocument }>("/api/contrats/generer", {
        org_id: currentOrg.id,
        type: type.id,
        role,
        variante,
        reponses: toutes,
      });
      setEtape({ phase: "fini", doc: r.document });
    } catch (e) {
      toast.error((e as Error).message);
      setEtape({ phase: "question", index: questionnaire.length - 1 });
    }
  };

  const repondre = (valeur: string) => {
    if (etape.phase !== "question") return;
    const q = questionnaire[etape.index];
    const maj = { ...reponses, [q.id]: valeur.trim() };
    setReponses(maj);
    setSaisie("");
    if (etape.index + 1 < questionnaire.length) {
      setEtape({ phase: "question", index: etape.index + 1 });
    } else {
      void generer(maj);
    }
  };

  const cadre = "mt-3 space-y-3 rounded-xl border border-brand-200 bg-white p-4 dark:border-brand-500/30 dark:bg-gray-900";
  const bouton = (actif: boolean) =>
    `rounded-lg border px-4 py-2 text-sm font-medium transition ${
      actif
        ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
        : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
    }`;

  // ---- Résultat ---------------------------------------------------------------
  if (etape.phase === "fini") {
    return (
      <div className={cadre}>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Votre contrat est prêt : {etape.doc.titre}
        </p>
        <p className="line-clamp-3 text-sm text-gray-500 dark:text-gray-400">
          {etape.doc.contenu.replace(/[#*]/g, "").slice(0, 250)}…
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/contrats/${etape.doc.id}`}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Relire le contrat complet →
          </Link>
          <button
            onClick={() => void telechargerDocx(etape.doc.titre, etape.doc.contenu)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            Télécharger en DOCX
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Relisez intégralement et complétez les champs [À COMPLÉTER] avant tout usage.
        </p>
      </div>
    );
  }

  if (etape.phase === "generation") {
    return (
      <div className={cadre}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Rédaction du contrat en cours — intégration de vos réponses, clauses du
          référentiel, variante {variante.replace("_", " ")}… (jusqu'à une minute)
        </p>
      </div>
    );
  }

  // ---- Étapes -------------------------------------------------------------------
  return (
    <div className={cadre}>
      {etape.phase === "type" && (
        <>
          <p className="text-xs font-semibold uppercase text-gray-400">Quel type de contrat ?</p>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTypeId(t.id);
                  setEtape({ phase: "camp" });
                }}
                className={bouton(false)}
              >
                {t.nom}
              </button>
            ))}
          </div>
        </>
      )}

      {etape.phase === "camp" && type && (
        <>
          <p className="text-xs font-semibold uppercase text-gray-400">
            {type.nom} — quel camp protégeons-nous ?
          </p>
          <div className="flex flex-wrap gap-2">
            {type.roles.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(r);
                  setEtape({ phase: "variante" });
                }}
                className={`${bouton(role === r)} capitalize`}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}

      {etape.phase === "variante" && type && (
        <>
          <p className="text-xs font-semibold uppercase text-gray-400">Niveau de protection ?</p>
          <div className="flex flex-wrap gap-2">
            {VARIANTES.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setVariante(v.id);
                  setEtape(
                    questionnaire.length
                      ? { phase: "question", index: 0 }
                      : { phase: "generation" }
                  );
                  if (!questionnaire.length) void generer({});
                }}
                className={bouton(variante === v.id)}
              >
                {v.label(
                  v.id === "protectrice_a" ? (type.roles[0] ?? "A") : (type.roles[1] ?? "B")
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {etape.phase === "question" && type && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-gray-400">
              Question {etape.index + 1} / {questionnaire.length}
            </p>
            <div className="h-1.5 w-24 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-1.5 rounded-full bg-brand-500"
                style={{ width: `${((etape.index + 1) / questionnaire.length) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {questionnaire[etape.index].question}
          </p>
          {questionnaire[etape.index].pourquoi && (
            <p className="text-xs text-gray-400">
              Pourquoi : {questionnaire[etape.index].pourquoi}
            </p>
          )}
          <textarea
            rows={2}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                repondre(saisie);
              }
            }}
            placeholder="Votre réponse… (Entrée pour valider)"
            className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <div className="flex justify-between">
            <button
              onClick={() => repondre("")}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Passer (le contrat portera [À COMPLÉTER])
            </button>
            <button
              onClick={() => repondre(saisie)}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              {etape.index + 1 === questionnaire.length ? "Générer le contrat" : "Suivant"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
