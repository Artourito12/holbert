import mammoth from 'mammoth';
import { userSupabase } from '../_lib/supabase-admin.js';
import { ask, parseJson, SONNET } from '../_lib/claude.js';

// Pipeline multi-agents :
//   1. Contextualisation        -> reformule le contrat
//   2. Decomposition            -> liste des clauses cles a analyser
//   3. Sub_analysis (1 par clause) -> extraction + rappel theorique + risque + sources
//   4. Global_synthesis         -> resume exec, score global, recommendations
// Chaque etape est persistee dans analysis_steps pour breadcrumb UI et audit.

export const config = {
  maxDuration: 300, // 5 min (necessite Vercel Pro / Fluid Compute)
};

const SYSTEM_BASE =
  'Tu es un juriste senior francais, expert en droit des contrats. ' +
  "Tu raisonnes etape par etape, tu cites systematiquement les sources juridiques " +
  "(article de loi, jurisprudence, doctrine) avec un niveau de confiance honnete. " +
  'Tu reponds en francais clair, sans jargon inutile, oriente action. ' +
  'Tu utilises toujours le vouvoiement. ' +
  'Quand la question demande du JSON, tu reponds UNIQUEMENT du JSON strict, sans texte autour.';

async function loadContractAsAttachment(supabase, contract) {
  const { data: fileBlob, error } = await supabase.storage
    .from('contracts')
    .download(contract.storage_path);
  if (error || !fileBlob) throw new Error('Telechargement du fichier impossible');

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const filename = (contract.original_filename || '').toLowerCase();
  const isPdf =
    contract.mime_type === 'application/pdf' || filename.endsWith('.pdf');

  if (isPdf) {
    return {
      attachments: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: buffer.toString('base64'),
          },
        },
      ],
      docText: null,
    };
  }

  // DOCX / DOC -> mammoth
  const result = await mammoth.extractRawText({ buffer });
  return { attachments: [], docText: result.value };
}

async function persistStep(supabase, base, partial) {
  await supabase.from('analysis_steps').insert({
    analysis_id: base.analysisId,
    org_id: base.orgId,
    ...partial,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { contractId } = req.body || {};
  if (!contractId) return res.status(400).json({ error: 'contractId required' });

  const supabase = userSupabase(authHeader);

  // Auth user
  const { data: userResp, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userResp?.user) {
    return res.status(401).json({ error: 'invalid token' });
  }
  const user = userResp.user;

  // Fetch contract (RLS enforces org membership)
  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single();
  if (cErr || !contract) {
    return res.status(404).json({ error: 'contract not found' });
  }
  if (!contract.storage_path) {
    return res.status(400).json({ error: 'contract has no uploaded file' });
  }

  // Create analysis row
  const { data: analysis, error: aErr } = await supabase
    .from('contract_analyses')
    .insert({
      org_id: contract.org_id,
      contract_id: contract.id,
      status: 'running',
      started_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single();
  if (aErr || !analysis) {
    return res.status(500).json({ error: aErr?.message ?? 'analysis insert failed' });
  }

  const base = { analysisId: analysis.id, orgId: contract.org_id };
  let stepIndex = 0;

  try {
    const { attachments, docText } = await loadContractAsAttachment(supabase, contract);
    const docBlock = docText
      ? `\n\n<contrat>\n${docText.slice(0, 250000)}\n</contrat>`
      : '\n\n(Le contrat est fourni en piece jointe PDF.)';

    // -----------------------------------------------------------------
    // STEP 1 - Contextualisation
    // -----------------------------------------------------------------
    stepIndex++;
    const ctxUser = `Contrat de type "${contract.contract_type ?? 'non specifie'}".
Titre : ${contract.title}.${contract.counterparty ? `\nContrepartie : ${contract.counterparty}.` : ''}

Etape 1 - Contextualisation.
Reformule en 4 a 6 phrases ce que tu comprends de ce contrat : parties identifiees, objet principal, duree apparente, structure generale, points particuliers reperes des la lecture. Reste factuel, sans encore evaluer le risque.${docBlock}`;

    const step1 = await ask({
      system: SYSTEM_BASE,
      user: ctxUser,
      attachments,
      maxTokens: 1500,
    });

    await persistStep(supabase, base, {
      kind: 'contextualization',
      step_index: stepIndex,
      prompt: ctxUser.slice(0, 4000),
      model: step1.model,
      output_text: step1.text,
      tokens_in: step1.tokens_in,
      tokens_out: step1.tokens_out,
      duration_ms: step1.duration_ms,
      status: 'done',
    });

    // -----------------------------------------------------------------
    // STEP 2 - Decomposition : liste des clauses a analyser
    // -----------------------------------------------------------------
    stepIndex++;
    const decompUser = `Etape 2 - Decomposition.
A partir du contrat ci-dessous, liste les clauses-cles a analyser independamment.
Pour chaque clause potentielle, indique si elle est presente ou non.

Reponds UNIQUEMENT en JSON strict :
{
  "clauses": [
    {"key": "duree", "label": "Duree et reconduction", "present": true},
    {"key": "resiliation", "label": "Conditions de resiliation", "present": true},
    {"key": "responsabilite", "label": "Responsabilite / plafond", "present": false},
    {"key": "confidentialite", "label": "Confidentialite", "present": true},
    {"key": "paiement", "label": "Paiement et facturation", "present": true},
    {"key": "penalites", "label": "Penalites de retard", "present": false},
    {"key": "propriete_intellectuelle", "label": "Propriete intellectuelle", "present": false},
    {"key": "loi_juridiction", "label": "Loi applicable et juridiction", "present": true},
    {"key": "force_majeure", "label": "Force majeure", "present": false},
    {"key": "non_concurrence", "label": "Non-concurrence / non-sollicitation", "present": false},
    {"key": "donnees_personnelles", "label": "Donnees personnelles / RGPD", "present": false}
  ]
}
Adapte la liste aux clauses pertinentes pour CE type de contrat (en ajoute, en retire). 8 a 12 entrees max.${docBlock}`;

    const step2 = await ask({
      system: SYSTEM_BASE,
      user: decompUser,
      attachments,
      maxTokens: 1500,
    });

    const decomposition = parseJson(step2.text) ?? { clauses: [] };

    await persistStep(supabase, base, {
      kind: 'decomposition',
      step_index: stepIndex,
      prompt: decompUser.slice(0, 4000),
      model: step2.model,
      output_text: step2.text,
      output_json: decomposition,
      tokens_in: step2.tokens_in,
      tokens_out: step2.tokens_out,
      duration_ms: step2.duration_ms,
      status: 'done',
    });

    // -----------------------------------------------------------------
    // STEP 3 - Sub-analyses : une par clause
    // -----------------------------------------------------------------
    const subResults = [];
    const clauses = Array.isArray(decomposition.clauses) ? decomposition.clauses : [];

    for (const clause of clauses) {
      stepIndex++;
      const subUser = `Etape 3 - Analyse approfondie d'une clause.

Clause : "${clause.label}" (cle: ${clause.key}).
Presence apparente : ${clause.present ? 'oui' : 'non'}.

Pour cette clause precise, produis une analyse en JSON strict :
{
  "clause_key": "${clause.key}",
  "clause_label": "${clause.label}",
  "present": true/false,
  "extracted_text": "citation exacte du contrat (max 600 caracteres) ou null si absente",
  "summary": "1-2 phrases en langage clair",
  "legal_basis": "rappel theorique : regle legale applicable (articles, jurisprudence). 2-3 phrases.",
  "evaluation": "favorable / equilibre / defavorable au signataire et pourquoi. 2-3 phrases.",
  "risk": "green" | "orange" | "red",
  "suggestion": "amelioration concrete a proposer (1 phrase) ou null",
  "sources": [
    {"ref": "Code civil art. 1240", "url": null, "excerpt": "extrait pertinent"}
  ],
  "confidence": "green" | "orange" | "red"
}

Si la clause est absente, "extracted_text" = null et l'evaluation explique le risque de l'absence.${docBlock}`;

      const sub = await ask({
        system: SYSTEM_BASE,
        user: subUser,
        attachments,
        maxTokens: 2000,
      });

      const subJson = parseJson(sub.text) ?? {
        clause_key: clause.key,
        clause_label: clause.label,
        present: false,
        summary: '(analyse non disponible)',
        risk: 'orange',
        confidence: 'red',
      };

      await persistStep(supabase, base, {
        kind: 'sub_analysis',
        step_index: stepIndex,
        prompt: subUser.slice(0, 4000),
        model: sub.model,
        output_text: sub.text,
        output_json: subJson,
        citations: Array.isArray(subJson.sources) ? subJson.sources : [],
        confidence_level: subJson.confidence ?? null,
        tokens_in: sub.tokens_in,
        tokens_out: sub.tokens_out,
        duration_ms: sub.duration_ms,
        status: 'done',
      });

      subResults.push(subJson);
    }

    // -----------------------------------------------------------------
    // STEP 4 - Synthese globale
    // -----------------------------------------------------------------
    stepIndex++;
    const globalUser = `Etape 4 - Synthese globale.

Voici les analyses individuelles de chaque clause :
${JSON.stringify(subResults, null, 2)}

Produis la synthese finale en JSON strict :
{
  "executive_summary": [
    "Point cle 1 (1 phrase)",
    "Point cle 2",
    "Point cle 3",
    "Point cle 4",
    "Point cle 5"
  ],
  "global_risk": "green" | "orange" | "red",
  "global_risk_score": 0-100,
  "improvement_suggestions": [
    {
      "priority": "high" | "medium" | "low",
      "clause": "nom de la clause",
      "suggestion": "amelioration concrete",
      "why": "pourquoi c'est important"
    }
  ],
  "confidence_level": "green" | "orange" | "red",
  "key_action_items": [
    "Action 1 a faire avant signature",
    "Action 2"
  ]
}

Sois precis sur le score : <40 = green, 40-69 = orange, >=70 = red. Hierarchise les suggestions.`;

    const step4 = await ask({
      system: SYSTEM_BASE,
      user: globalUser,
      maxTokens: 3000,
    });

    const globalJson = parseJson(step4.text) ?? {
      executive_summary: ['Synthese indisponible.'],
      global_risk: 'orange',
      global_risk_score: 50,
      improvement_suggestions: [],
      confidence_level: 'red',
      key_action_items: [],
    };

    await persistStep(supabase, base, {
      kind: 'global_synthesis',
      step_index: stepIndex,
      prompt: globalUser.slice(0, 4000),
      model: step4.model,
      output_text: step4.text,
      output_json: globalJson,
      confidence_level: globalJson.confidence_level ?? null,
      tokens_in: step4.tokens_in,
      tokens_out: step4.tokens_out,
      duration_ms: step4.duration_ms,
      status: 'done',
    });

    // -----------------------------------------------------------------
    // Update analysis + contract
    // -----------------------------------------------------------------
    const summary = Array.isArray(globalJson.executive_summary)
      ? globalJson.executive_summary.map((s) => `• ${s}`).join('\n')
      : null;

    await supabase
      .from('contract_analyses')
      .update({
        status: 'done',
        finished_at: new Date().toISOString(),
        executive_summary: summary,
        extracted_clauses: subResults,
        improvement_suggestions: globalJson.improvement_suggestions ?? [],
        global_risk: globalJson.global_risk ?? 'unknown',
        global_risk_score: globalJson.global_risk_score ?? null,
        confidence_level: globalJson.confidence_level ?? null,
      })
      .eq('id', analysis.id);

    await supabase
      .from('contracts')
      .update({
        risk_level: globalJson.global_risk ?? 'unknown',
        risk_score: globalJson.global_risk_score ?? null,
        status: 'active',
      })
      .eq('id', contract.id);

    return res.status(200).json({
      analysis_id: analysis.id,
      global_risk: globalJson.global_risk,
      global_risk_score: globalJson.global_risk_score,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    await supabase
      .from('contract_analyses')
      .update({
        status: 'error',
        error_message: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq('id', analysis.id);
    return res.status(500).json({ error: message });
  }
}
