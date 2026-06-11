import { useCallback, useEffect, useState } from "react";
import type { Invitation, OrgProfil, Profile } from "@holbert/core";
import { Badge, useToast } from "@holbert/ui";
import { supabase } from "../lib/supabase";
import { apiPost } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useOrg } from "../context/OrgContext";

type Membre = { user_id: string; role: string; profiles: Profile | null };

const inputCls =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white";

const PROFIL_CHAMPS: { id: keyof OrgProfil; libelle: string; placeholder: string }[] = [
  { id: "activite", libelle: "Activité", placeholder: "Imprimerie B2B, 3 sites de production…" },
  { id: "forme_juridique", libelle: "Forme juridique", placeholder: "SAS, SARL, profession libérale…" },
  { id: "effectif", libelle: "Effectif", placeholder: "12 salariés" },
  { id: "convention_collective", libelle: "Convention collective", placeholder: "Imprimeries de labeur (IDCC 0184)" },
  { id: "implantations", libelle: "Implantations", placeholder: "Lyon (siège), Villeurbanne, Saint-Étienne" },
];

export default function Organisation() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const toast = useToast();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [profil, setProfil] = useState<Partial<OrgProfil>>({});
  const [monRole, setMonRole] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [travail, setTravail] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [m, i, p, r] = await Promise.all([
      supabase
        .from("org_members")
        .select("user_id, role, profiles(user_id, email, full_name, created_at)")
        .eq("org_id", currentOrg.id),
      supabase
        .from("invitations")
        .select("*")
        .eq("org_id", currentOrg.id)
        .is("accepted_at", null),
      supabase.from("org_profils").select("*").eq("org_id", currentOrg.id).maybeSingle(),
      supabase.rpc("org_role", { p_org: currentOrg.id }),
    ]);
    setMembres((m.data as unknown as Membre[]) ?? []);
    setInvitations((i.data as Invitation[]) ?? []);
    setProfil((p.data as OrgProfil) ?? {});
    setMonRole((r.data as string) ?? null);
  }, [currentOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentOrg) return null;
  const estAdmin = monRole === "owner" || monRole === "admin";

  const enregistrerProfil = async () => {
    setTravail(true);
    const { error } = await supabase.from("org_profils").upsert({
      org_id: currentOrg.id,
      activite: profil.activite ?? null,
      forme_juridique: profil.forme_juridique ?? null,
      effectif: profil.effectif ?? null,
      convention_collective: profil.convention_collective ?? null,
      implantations: profil.implantations ?? null,
      contexte_ia: profil.contexte_ia ?? null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    });
    setTravail(false);
    if (error) toast.error(error.message);
    else toast.success("Profil enregistré — l'IA l'utilisera dans toutes ses analyses");
  };

  const inviter = async () => {
    if (!inviteEmail.trim()) return;
    setTravail(true);
    try {
      const r = await apiPost<{ statut: string }>("/api/orgs/inviter", {
        org_id: currentOrg.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success(
        r.statut === "ajoute"
          ? "Membre ajouté — il a été notifié"
          : "Invitation envoyée par email"
      );
      setInviteEmail("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTravail(false);
    }
  };

  const retirer = async (m: Membre) => {
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", currentOrg.id)
      .eq("user_id", m.user_id);
    if (error) toast.error(error.message);
    else {
      toast.success("Membre retiré");
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
        Organisation — {currentOrg.name}
      </h1>
      <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">
        Votre équipe et le profil de votre entreprise. Tout ce que vous
        renseignez ici nourrit les analyses de l'IA.
      </p>

      {/* ---- Profil entreprise (contexte IA) ---- */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Profil de l'entreprise
          </h2>
          <p className="text-xs text-gray-400">
            Utilisé par l'IA dans chaque analyse : audits, chat, Front Door,
            générations. Plus c'est précis, plus les réponses sont adaptées.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {PROFIL_CHAMPS.map((c) => (
              <div key={c.id}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {c.libelle}
                </label>
                <input
                  value={(profil[c.id] as string) ?? ""}
                  onChange={(e) => setProfil((p) => ({ ...p, [c.id]: e.target.value }))}
                  placeholder={c.placeholder}
                  disabled={!estAdmin}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contexte libre pour l'IA
            </label>
            <p className="mb-1.5 text-xs text-gray-400">
              Tout ce que l'IA doit savoir sur votre situation : positions
              prises, contraintes internes, partenaires sensibles, historique…
            </p>
            <textarea
              rows={5}
              value={profil.contexte_ia ?? ""}
              onChange={(e) => setProfil((p) => ({ ...p, contexte_ia: e.target.value }))}
              placeholder="Ex. : nous refusons systématiquement les clauses d'exclusivité ; notre client principal représente 40 % du CA ; contentieux en cours avec un ancien associé…"
              disabled={!estAdmin}
              className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
          {estAdmin && (
            <button
              onClick={() => void enregistrerProfil()}
              disabled={travail}
              className="h-11 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              Enregistrer le profil
            </button>
          )}
        </div>
      </section>

      {/* ---- Membres ---- */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Membres
            <span className="ml-2 text-sm font-normal text-gray-400">{membres.length}</span>
          </h2>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {membres.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {m.profiles?.full_name ?? m.profiles?.email ?? "Membre"}
                  {m.user_id === user?.id && (
                    <span className="ml-2 text-xs font-normal text-gray-400">(vous)</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{m.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge size="sm" color={m.role === "owner" ? "primary" : m.role === "admin" ? "info" : "light"}>
                  {m.role === "owner" ? "Propriétaire" : m.role === "admin" ? "Administrateur" : "Membre"}
                </Badge>
                {estAdmin && m.role !== "owner" && m.user_id !== user?.id && (
                  <button
                    onClick={() => void retirer(m)}
                    className="text-xs text-gray-400 hover:text-error-500"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {estAdmin && (
          <div className="border-t border-gray-200 p-5 dark:border-gray-800">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Inviter un membre
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="collegue@entreprise.fr"
                className={`${inputCls} max-w-xs`}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <option value="member">Membre (opérationnel)</option>
                <option value="admin">Administrateur (juriste)</option>
              </select>
              <button
                onClick={() => void inviter()}
                disabled={travail || !inviteEmail.trim()}
                className="h-11 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                Inviter
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              S'il a déjà un compte, il est ajouté immédiatement ; sinon il
              reçoit un email d'inscription et rejoint l'organisation à sa
              première connexion.
            </p>
          </div>
        )}

        {invitations.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
            <p className="mb-1 text-xs font-medium uppercase text-gray-400">
              Invitations en attente
            </p>
            <ul className="space-y-1">
              {invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>
                    {i.email} · {i.role === "admin" ? "administrateur" : "membre"}
                  </span>
                  {estAdmin && (
                    <button
                      onClick={async () => {
                        await supabase.from("invitations").delete().eq("id", i.id);
                        await load();
                      }}
                      className="text-xs text-gray-400 hover:text-error-500"
                    >
                      Annuler
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
