// ============================================================================
// Org de démo Holbert — crée (ou recrée) une organisation "Démo Holbert"
// peuplée de données réalistes pour les tests et les démos commerciales.
// Usage : node scripts/seed-demo.mjs [email-du-proprietaire]
// Prérequis : migrations 001→007 appliquées, .env.local complet.
// Re-exécutable : supprime et recrée l'org de démo à chaque lancement.
// ============================================================================
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const l of readFileSync(join(root, ".env.local"), "utf8").replace(/^﻿/, "").split("\n")) {
  const m = l.trim().match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const EMAIL = process.argv[2] ?? "arthur.arrazoladeonate@gmail.com";
const NOM_ORG = "Démo Holbert";

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function embed(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return (await res.json()).data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function chunker(texte, taille = 3000) {
  const chunks = [];
  for (let i = 0; i < texte.length; i += taille - 400) {
    const c = texte.slice(i, i + taille).trim();
    if (c) chunks.push(c);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Contenus réalistes
// ---------------------------------------------------------------------------
const BAIL = `BAIL COMMERCIAL

ENTRE LES SOUSSIGNÉS
La SCI DES TROIS PLATANES, société civile immobilière au capital de 150 000 euros, immatriculée au RCS de Lyon sous le n° 488 123 456, dont le siège est 12 quai Saint-Antoine, 69002 Lyon, représentée par M. Bernard FAVIER, gérant,
ci-après dénommée « le Bailleur »,
ET
La SARL CAFÉ DES LUMIÈRES, société à responsabilité limitée au capital de 10 000 euros, immatriculée au RCS de Lyon sous le n° 912 345 678, dont le siège est 8 rue de la République, 69001 Lyon, représentée par Mme Inès KHELIFI, gérante,
ci-après dénommée « le Preneur »,

IL A ÉTÉ CONVENU CE QUI SUIT :

ARTICLE 1 — DÉSIGNATION
Le Bailleur donne à bail au Preneur un local commercial situé 8 rue de la République, 69001 Lyon, d'une surface d'environ 95 m² en rez-de-chaussée, avec une réserve de 20 m² en sous-sol.

ARTICLE 2 — DURÉE
Le présent bail est consenti pour une durée de NEUF (9) années entières et consécutives à compter du 1er mars 2025 pour se terminer le 28 février 2034.
Le Preneur renonce expressément à sa faculté de donner congé à l'expiration de chaque période triennale.

ARTICLE 3 — DESTINATION
Les lieux loués sont destinés exclusivement à l'activité de salon de café, petite restauration sans extraction.

ARTICLE 4 — LOYER
Le bail est consenti moyennant un loyer annuel de TRENTE-SIX MILLE EUROS (36 000 €) hors taxes et hors charges, payable par trimestre d'avance.

ARTICLE 5 — INDEXATION
Le loyer sera révisé automatiquement chaque année à la date anniversaire du bail en fonction de la variation de l'indice des loyers commerciaux (ILC) publié par l'INSEE. Il est expressément convenu que cette indexation ne pourra jouer qu'à la hausse, le loyer ne pouvant en aucun cas être diminué.

ARTICLE 6 — DÉPÔT DE GARANTIE
Le Preneur verse ce jour la somme de NEUF MILLE EUROS (9 000 €) correspondant à un trimestre de loyer, à titre de dépôt de garantie.

ARTICLE 7 — CHARGES ET TRAVAUX
Le Preneur supportera l'intégralité des charges, impôts, taxes et redevances liés à l'immeuble, y compris la taxe foncière, ainsi que l'ensemble des travaux de réparation et d'entretien, y compris les grosses réparations visées à l'article 606 du code civil.

ARTICLE 8 — CESSION
Toute cession du droit au bail est interdite sans l'accord préalable et écrit du Bailleur, y compris à l'acquéreur du fonds de commerce du Preneur.

Fait à Lyon, le 12 février 2025, en deux exemplaires.`;

const PRESTATION = `CONTRAT DE PRESTATION DE SERVICES

ENTRE
La SAS NOVAPRINT, au capital de 50 000 euros, RCS Villeurbanne 539 876 543, 4 avenue des Canuts, 69100 Villeurbanne, représentée par M. Karim BELAÏD, président, ci-après « le Client »,
ET
Mme Sofia MARCHETTI, entrepreneure individuelle, SIREN 902 111 222, 17 rue des Capucins, 69001 Lyon, exerçant sous le nom commercial « SM Studio », ci-après « le Prestataire ».

ARTICLE 1 — OBJET
Le Prestataire s'engage à concevoir et développer le nouveau site internet vitrine et catalogue du Client, comprenant : maquettes graphiques, intégration, développement d'un module de demande de devis, formation de deux salariés du Client.

ARTICLE 2 — DURÉE ET CALENDRIER
La mission débute le 1er avril 2026. Les livrables intermédiaires sont fixés comme suit : maquettes au 30 avril 2026, recette du site au 15 juillet 2026, mise en production au 1er septembre 2026.

ARTICLE 3 — PRIX
La prestation est facturée au forfait de DIX-HUIT MILLE EUROS HT (18 000 € HT), payable comme suit : 30 % à la signature, 40 % à la recette, 30 % à la mise en production. Les factures sont payables à 30 jours.

ARTICLE 4 — PROPRIÉTÉ INTELLECTUELLE
L'ensemble des droits de propriété intellectuelle sur tous les travaux présents et futurs du Prestataire réalisés pour le Client, quels qu'ils soient, sont cédés au Client sans limitation de durée ni de territoire.

ARTICLE 5 — OBLIGATIONS DU PRESTATAIRE
Le Prestataire exécutera sa mission dans les locaux du Client, du lundi au vendredi de 9 h à 17 h, sous la supervision directe du directeur marketing du Client, qui lui donnera ses instructions quotidiennes. Le Prestataire s'engage à une exclusivité totale au profit du Client pendant toute la durée de la mission.

ARTICLE 6 — PÉNALITÉS
Tout retard de livraison imputable au Prestataire entraînera une pénalité de 500 € par jour calendaire de retard, sans plafond.

ARTICLE 7 — RÉSILIATION
Le Client peut résilier le présent contrat à tout moment, sans préavis ni indemnité.

Fait à Villeurbanne, le 15 mars 2026.`;

const MISE_EN_DEMEURE = `LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION

Sofia MARCHETTI — SM Studio
17 rue des Capucins, 69001 Lyon

À l'attention de M. Karim BELAÏD
SAS NOVAPRINT
4 avenue des Canuts, 69100 Villeurbanne

Lyon, le 2 mai 2026

Objet : mise en demeure de payer la facture n° 2026-014

Monsieur,

Ma facture n° 2026-014 du 30 avril 2026, d'un montant de 7 200 € TTC correspondant à la livraison des maquettes graphiques validées par vos équipes le 28 avril 2026, demeure impayée à ce jour malgré l'échéance contractuelle.

Je vous mets en demeure de procéder au règlement intégral de cette somme sous huit (8) jours à compter de la réception de la présente.

À défaut, je me réserve le droit de suspendre l'exécution de la mission et de saisir le tribunal des activités économiques de Lyon, conformément à l'article 1344 du code civil. Cette mise en demeure fait courir les intérêts de retard prévus à l'article L. 441-10 du code de commerce ainsi que l'indemnité forfaitaire de recouvrement de 40 euros.

Veuillez agréer, Monsieur, mes salutations distinguées.

Sofia MARCHETTI`;

const MAIL_RELANCE = `De : karim.belaid@novaprint.fr
À : sofia@smstudio.fr
Date : 12 mai 2026 09:41
Objet : RE: mise en demeure facture 2026-014

Bonjour Sofia,

J'accuse réception de votre courrier du 2 mai. Je reconnais bien devoir la somme de 7 200 € au titre des maquettes, qui ont effectivement été validées fin avril.

Nous traversons une passe difficile de trésorerie. Je vous propose un règlement en trois fois : 2 400 € au 30 mai, 2 400 € au 30 juin, 2 400 € au 30 juillet 2026.

Sans réponse de votre part, je considérerai cet échéancier comme accepté.

Cordialement,
Karim Belaïd — Président, NOVAPRINT`;

// ---------------------------------------------------------------------------
async function main() {
  console.log("— Seed de l'organisation de démo —");

  // Vérifier le schéma
  const { error: schemaErr } = await admin.from("documents").select("id").limit(1);
  if (schemaErr) {
    console.error(`✗ Schéma incomplet (${schemaErr.message}).`);
    console.error("  Exécutez d'abord les migrations 001→007 dans le SQL Editor Supabase.");
    process.exit(1);
  }

  // Propriétaire
  const { data: usersData, error: userErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (userErr) throw new Error(userErr.message);
  const user = usersData.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!user) {
    console.error(`✗ Aucun utilisateur ${EMAIL} — créez d'abord votre compte dans l'app.`);
    process.exit(1);
  }

  // Recréation propre
  const { data: existante } = await admin
    .from("orgs")
    .select("id")
    .eq("name", NOM_ORG)
    .eq("created_by", user.id)
    .maybeSingle();
  if (existante) {
    await admin.from("orgs").delete().eq("id", existante.id);
    console.log("• Ancienne org de démo supprimée");
  }

  const { data: org, error: orgErr } = await admin
    .from("orgs")
    .insert({ name: NOM_ORG, created_by: user.id })
    .select()
    .single();
  if (orgErr) throw new Error(orgErr.message);
  await admin.from("org_members").insert({ org_id: org.id, user_id: user.id, role: "owner" });
  await admin.from("entitlements").insert(
    ["raader", "pleiter", "normer"].map((module) => ({ org_id: org.id, module, active: true }))
  );
  console.log(`• Org "${NOM_ORG}" créée, 3 modules activés`);

  // ---- Documents ----------------------------------------------------------
  const docs = [
    {
      nom: "Bail commercial - Café des Lumières.pdf",
      type: "bail-commercial",
      texte: BAIL,
      faits: [
        { fait_id: "parties", type: "parties", valeur: { texte: "SCI des Trois Platanes (bailleur) / SARL Café des Lumières (preneur)" }, passage: "La SCI DES TROIS PLATANES […] La SARL CAFÉ DES LUMIÈRES" },
        { fait_id: "loyer_annuel", type: "montant", valeur: { texte: "36 000 € HT/an", montant: 36000 }, passage: "loyer annuel de TRENTE-SIX MILLE EUROS (36 000 €) hors taxes" },
        { fait_id: "date_prise_effet", type: "date", valeur: { texte: "1er mars 2025", date: "2025-03-01" }, passage: "à compter du 1er mars 2025" },
        { fait_id: "echeance_triennale_1", type: "date", valeur: { texte: "Première échéance triennale", date: "2028-02-29" }, passage: "neuf années entières et consécutives à compter du 1er mars 2025" },
      ],
      deadlines: [
        { fait_id: "echeance_triennale_1", titre: "Échéance triennale (congé possible, préavis 6 mois)", date: "2028-02-29", paliers: [365, 270, 210] },
        { fait_id: "fin_bail", titre: "Terme du bail commercial", date: "2034-02-28", paliers: [365, 270, 180] },
      ],
    },
    {
      nom: "Contrat prestation - SM Studio x Novaprint.docx",
      type: "prestation-services",
      texte: PRESTATION,
      faits: [
        { fait_id: "parties", type: "parties", valeur: { texte: "SAS Novaprint (client) / Sofia Marchetti — SM Studio (prestataire)" }, passage: "La SAS NOVAPRINT […] Mme Sofia MARCHETTI" },
        { fait_id: "prix", type: "montant", valeur: { texte: "18 000 € HT au forfait", montant: 18000 }, passage: "forfait de DIX-HUIT MILLE EUROS HT (18 000 € HT)" },
        { fait_id: "date_fin", type: "date", valeur: { texte: "Mise en production", date: "2026-09-01" }, passage: "mise en production au 1er septembre 2026" },
      ],
      deadlines: [
        { fait_id: "jalons", titre: "Recette du site — SM Studio x Novaprint", date: "2026-07-15", paliers: [14, 3] },
        { fait_id: "date_fin", titre: "Mise en production — SM Studio x Novaprint", date: "2026-09-01", paliers: [60, 30, 7] },
      ],
    },
    {
      nom: "Mise en demeure facture 2026-014.pdf",
      type: "generique",
      texte: MISE_EN_DEMEURE,
      faits: [
        { fait_id: "montants", type: "liste_montants", valeur: { texte: "7 200 € TTC (facture 2026-014)", montant: 7200 }, passage: "d'un montant de 7 200 € TTC" },
        { fait_id: "dates_cles", type: "liste_dates", valeur: { texte: "Mise en demeure du 2 mai 2026, délai de 8 jours", items: [{ libelle: "Mise en demeure", date: "2026-05-02" }] }, passage: "Lyon, le 2 mai 2026" },
      ],
      deadlines: [],
    },
    {
      nom: "Mail Novaprint - reconnaissance de dette.eml",
      type: "generique",
      texte: MAIL_RELANCE,
      faits: [
        { fait_id: "obligations_principales", type: "texte", valeur: { texte: "Reconnaissance de la dette de 7 200 € et proposition d'échéancier en 3 fois" }, passage: "Je reconnais bien devoir la somme de 7 200 €" },
      ],
      deadlines: [],
    },
  ];

  const docIds = {};
  let embeddingsKo = null;
  for (const d of docs) {
    const { data: doc, error } = await admin
      .from("documents")
      .insert({
        org_id: org.id,
        nom_fichier: d.nom,
        mime: d.nom.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : d.nom.endsWith(".eml")
            ? "message/rfc822"
            : "application/pdf",
        taille: d.texte.length,
        hash_sha256: `demo-${Math.abs([...d.nom].reduce((a, c) => a * 31 + c.charCodeAt(0), 7))}`,
        storage_path: `${org.id}/demo/${d.nom}`,
        statut: "ready",
        type_detecte: d.type,
        type_confiance: 0.95,
        indices: ["Document de démonstration"],
        type_confirme: d.type,
        referentiel_version: 1,
        texte: d.texte,
        uploaded_by: user.id,
      })
      .select()
      .single();
    if (error) throw new Error(`document ${d.nom} : ${error.message}`);
    docIds[d.nom] = doc.id;

    if (d.faits.length) {
      await admin.from("extracted_facts").insert(
        d.faits.map((f) => ({
          document_id: doc.id,
          org_id: org.id,
          fait_id: f.fait_id,
          type: f.type,
          valeur: { texte: f.valeur.texte, date: f.valeur.date ?? null, montant: f.valeur.montant ?? null, items: f.valeur.items ?? null },
          passage_source: f.passage,
          confiance: 0.9,
        }))
      );
    }
    if (d.deadlines.length) {
      await admin.from("deadlines").insert(
        d.deadlines.map((dl) => ({
          org_id: org.id,
          document_id: doc.id,
          fait_id: dl.fait_id,
          titre: `${dl.titre} — ${d.nom}`,
          date_echeance: dl.date,
          paliers_alerte: dl.paliers,
        }))
      );
    }

    // Indexation sémantique réelle (le chat répond sur ces documents).
    // Tolérant : sans crédits OpenAI, le seed continue sans embeddings.
    try {
      const chunks = chunker(d.texte);
      const embeddings = await embed(chunks);
      await admin.from("document_chunks").insert(
        chunks.map((contenu, i) => ({
          document_id: doc.id,
          org_id: org.id,
          contenu,
          position: i,
          embedding: embeddings[i],
        }))
      );
    } catch (e) {
      embeddingsKo = e.message;
    }
  }
  console.log(
    `• ${docs.length} documents classés et extraits` +
      (embeddingsKo
        ? ` — ⚠ indexation sémantique SAUTÉE (${embeddingsKo}) : ajoutez des crédits OpenAI puis relancez ce script`
        : ", indexés pour la recherche")
  );

  // ---- Dossier Pleiter ------------------------------------------------------
  const { data: dossier } = await admin
    .from("dossiers")
    .insert({
      org_id: org.id,
      nom: "SM Studio c/ Novaprint — impayés",
      parties: { demandeur: "Sofia Marchetti (SM Studio)", defendeur: "SAS Novaprint" },
      juridiction: "Tribunal des activités économiques de Lyon",
      type_procedure: "Injonction de payer puis fond",
      enjeu_financier: 7200,
      created_by: user.id,
    })
    .select()
    .single();

  const piecesDef = [
    ["Contrat prestation - SM Studio x Novaprint.docx", 1, "Contrat de prestation du 15 mars 2026"],
    ["Mise en demeure facture 2026-014.pdf", 2, "Mise en demeure du 2 mai 2026 (LRAR)"],
    ["Mail Novaprint - reconnaissance de dette.eml", 3, "Courriel Novaprint du 12 mai 2026 — reconnaissance de dette"],
  ];
  const pieceIds = {};
  for (const [nomDoc, numero, intitule] of piecesDef) {
    const { data: piece } = await admin
      .from("pieces")
      .insert({ dossier_id: dossier.id, org_id: org.id, document_id: docIds[nomDoc], numero, intitule })
      .select()
      .single();
    pieceIds[numero] = piece.id;
  }

  await admin.from("evenements").insert(
    [
      { date: "2026-03-15", titre: "Signature du contrat de prestation", piece: 1, passage: "Fait à Villeurbanne, le 15 mars 2026" },
      { date: "2026-04-28", titre: "Validation des maquettes par Novaprint", piece: 2, passage: "validées par vos équipes le 28 avril 2026" },
      { date: "2026-04-30", titre: "Émission de la facture n° 2026-014 (7 200 € TTC)", piece: 2, passage: "Ma facture n° 2026-014 du 30 avril 2026" },
      { date: "2026-05-02", titre: "Mise en demeure de payer (LRAR, délai 8 jours)", piece: 2, passage: "Je vous mets en demeure de procéder au règlement intégral" },
      { date: "2026-05-12", titre: "Reconnaissance de dette et proposition d'échéancier par Novaprint", piece: 3, passage: "Je reconnais bien devoir la somme de 7 200 €" },
      { date: "2026-05-30", titre: "Première échéance proposée (2 400 €) — non honorée", piece: 3, passage: "2 400 € au 30 mai" },
    ].map((e) => ({
      dossier_id: dossier.id,
      org_id: org.id,
      date: e.date,
      titre: e.titre,
      piece_id: pieceIds[e.piece],
      source_passage: e.passage,
      origine: "ia",
      created_by: user.id,
    }))
  );
  console.log("• Dossier contentieux : 3 pièces au bordereau, 6 événements de chronologie");

  // ---- Front Door Normer ------------------------------------------------------
  await admin.from("demandes").insert([
    {
      org_id: org.id,
      created_by: user.id,
      objet: "Un client veut signer un NDA avant notre rendez-vous, je peux ?",
      description: "RDV commercial mardi avec un prospect grand compte, ils nous envoient leur NDA standard de 6 pages.",
      categorie: "contrats",
      priorite: "normale",
      statut: "repondue",
      reponse_ia: "Oui sous réserve de vérifier la durée de confidentialité et la clause de non-sollicitation…",
      reponse_finale:
        "Oui, vous pouvez signer un NDA avant un rendez-vous commercial — c'est une pratique courante. Trois points à vérifier avant signature :\n\n1. **Réciprocité** : l'accord doit protéger les informations des deux parties.\n2. **Durée** : 2 à 5 ans est standard ; au-delà, demandez une réduction.\n3. **Pas de clause cachée** : vérifiez l'absence de clause de non-sollicitation ou d'exclusivité glissée dans le NDA.\n\nSi le document dépasse ce cadre, transmettez-le via la plateforme pour un audit avant signature.",
      validee_par: user.id,
      validee_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      org_id: org.id,
      created_by: user.id,
      objet: "Délai légal pour rembourser un client qui se rétracte ?",
      description: "Vente en ligne B2C, le client a annulé 3 jours après commande, déjà expédiée.",
      categorie: "commercial",
      priorite: "haute",
      statut: "a_valider",
      reponse_ia:
        "Le client dispose de 14 jours pour se rétracter (art. L. 221-18 c. consom.). Le remboursement doit intervenir sous 14 jours à compter de la rétractation, mais peut être différé jusqu'à récupération du bien ou preuve d'expédition du retour (art. L. 221-24 c. consom.). Les frais de retour peuvent rester à la charge du client si vos CGV le prévoient.",
    },
  ]);

  await admin.from("reponses_types").insert([
    {
      org_id: org.id,
      question: "Signature d'un NDA avant rendez-vous commercial",
      reponse: "Pratique courante — vérifier réciprocité, durée (2-5 ans) et absence de clauses cachées (non-sollicitation, exclusivité).",
      categorie: "contrats",
      valide_par: user.id,
      usage_count: 3,
    },
    {
      org_id: org.id,
      question: "Délais de paiement maximum entre professionnels",
      reponse: "60 jours date de facture, ou 45 jours fin de mois si le contrat le stipule (art. L. 441-10 c. com.). Pénalités et indemnité de 40 € exigibles de plein droit en cas de retard.",
      categorie: "commercial",
      valide_par: user.id,
      usage_count: 1,
    },
  ]);
  console.log("• Front Door : 2 demandes (1 répondue, 1 à valider), 2 réponses types");

  console.log(`\n✓ Org de démo prête. Sélectionnez "${NOM_ORG}" dans le sélecteur d'organisation de l'app.`);
  console.log("  À essayer : audit du bail (clauses pièges incluses volontairement), chronologie du");
  console.log("  dossier SM Studio, analyse prescription (la reconnaissance de dette du 12/05 interrompt !),");
  console.log("  question au chat : « que dit mon bail sur l'indexation du loyer ? »");
}

main().catch((e) => {
  console.error("✗ Seed échoué :", e.message);
  process.exit(1);
});
