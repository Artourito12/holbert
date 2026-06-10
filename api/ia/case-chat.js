import { userSupabase } from '../_lib/supabase-admin.js';
import { ask, parseJson, SONNET } from '../_lib/claude.js';

// Pipeline multi-agents pour un dossier de cas :
//   1. Contextualisation     - l'IA reformule ce qu'elle comprend de la situation
//   2. Decomposition         - identifie les sous-questions independantes
//   3. Sub-analyses          - une analyse par sous-question, avec sources
//   4. Synthese globale      - structure la reponse finale (contexte, analyse, risques, recos, sources)
//
// Chaque etape est persistee dans case_message_steps pour audit + breadcrumb UI.
// La memoire = tous les messages precedents du dossier.

export const config = {
  maxDuration: 300,
};

const MODE_DIRECTIVES = {
  standard:
    'Vue d\'ensemble equilibree : contexte, analyse juridique, risques, recommandations.',
  contradictoire:
    'Analyse contradictoire : presente les arguments POUR et CONTRE de chaque position, puis conclus sur la position la plus solide en droit.',
  risque_contentieux:
    'Concentre-toi sur l\'evaluation du risque contentieux : probabilite de contentieux, enjeu financier estime (fourchette), procedure probable.',
  negociation:
    'Concentre-toi sur la strategie de negociation : leviers de notre cote, points de blocage probables, fallbacks acceptables.',
  memo:
    'Redige une note juridique formelle structuree (faits, analyse, risques, recommandations, conclusion). Style professionnel pour transmission a un avocat.',
};

const SYSTEM_BASE = (mode) =>
  `Tu es un juriste senior francais, expert en droit (Code civil, Code du travail, Code de commerce, jurisprudence Cour de cassation, doctrine Dalloz/LexisNexis).
Ton raisonnement est rigoureux et etape par etape.
Tu cites SYSTEMATIQUEMENT les sources juridiques : articles de code (avec numero), arrets (Cass. + date + numero), decisions admin (CNIL, AMF, Autorite de la concurrence).
Tu indiques honnetement le niveau de confiance : "green" (jurisprudence constante / texte clair), "orange" (sujet debattu), "red" (zone d'incertitude).
Tu reponds en francais clair, sans jargon inutile, oriente action.
Tu utilises toujours le vouvoiement.
Quand on te demande du JSON, tu reponds UNIQUEMENT du JSON strict, sans texte autour, sans fence \`\`\`.
Mode d'analyse demande : ${mode} -> ${MODE_DIRECTIVES[mode] ?? MODE_DIRECTIVES.standard}`;

async function persistStep(supabase, base, partial) {
  await supabase.from('case_message_steps').insert({
    message_id: base.messageId,
    case_id: base.caseId,
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

  const { caseId, mode = 'standard' } = req.body || {};
  if (!caseId) return res.status(400).json({ error: 'caseId required' });

  const supabase = userSupabase(authHeader);

  const { data: userResp, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userResp?.user) {
    return res.status(401).json({ error: 'invalid token' });
  }
  const user = userResp.user;

  // Load case
  const { data: theCase, error: cErr } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();
  if (cErr || !theCase) return res.status(404).json({ error: 'case not found' });

  // Load all messages
  const { data: msgs } = await supabase
    .from('case_messages')
    .select('*')
    .eq('case_id', caseId)
    .order('position', { ascending: true });
  const messages = msgs ?? [];

  // The latest user message is what we answer
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return res.status(400).json({ error: 'no user message to answer' });
  }

  // Build conversation memory for Claude (all messages except the very last user one, which is the question)
  const memory = messages
    .filter((m) => m.id !== lastUser.id)
    .map((m) => `[${m.role === 'user' ? 'Utilisateur' : 'Assistant'}] ${m.content}`)
    .join('\n\n');

  // Optional: case documents text extracts (concatenated, truncated)
  const { data: docs } = await supabase
    .from('case_documents')
    .select('filename, doc_kind, extracted_text')
    .eq('case_id', caseId);
  const docsBlock = (docs ?? [])
    .filter((d) => d.extracted_text)
    .map((d) => `<doc filename="${d.filename}" kind="${d.doc_kind ?? 'autre'}">\n${(d.extracted_text || '').slice(0, 30000)}\n</doc>`)
    .join('\n\n');

  // Create the assistant message placeholder (will be updated at end)
  const nextPosition = messages.length;
  const { data: assistantMsg, error: msgErr } = await supabase
    .from('case_messages')
    .insert({
      case_id: caseId,
      org_id: theCase.org_id,
      role: 'assistant',
      content: '…',
      position: nextPosition,
      mode,
      model: SONNET,
      created_by: user.id,
    })
    .select()
    .single();
  if (msgErr || !assistantMsg) {
    return res.status(500).json({ error: msgErr?.message ?? 'message insert failed' });
  }

  const base = { messageId: assistantMsg.id, caseId, orgId: theCase.org_id };
  let stepIndex = 0;

  const baseContext = `Dossier : "${theCase.title}".
Domaine juridique : ${theCase.domain}.
${memory ? `\nHistorique de la conversation :\n${memory}\n` : ''}
${docsBlock ? `\nPieces jointes au dossier :\n${docsBlock}\n` : ''}

Question actuelle de l'utilisateur :
"""
${lastUser.content}
"""`;

  try {
    // -----------------------------------------------------------------
    // STEP 1 - Contextualisation
    // -----------------------------------------------------------------
    stepIndex++;
    const ctxUser = `${baseContext}

Etape 1 - Contextualisation.
Reformule en 3 a 5 phrases ce que tu comprends de la situation et de la question precise posee. Identifie les faits importants, les parties en presence, les enjeux apparents. Reste factuel, sans encore donner d'analyse juridique.`;

    const step1 = await ask({
      system: SYSTEM_BASE(mode),
      user: ctxUser,
      maxTokens: 1200,
    });
    await persistStep(supabase, base, {
      kind: 'contextualization',
      step_index: stepIndex,
      prompt: ctxUser.slice(0, 5000),
      model: step1.model,
      output_text: step1.text,
      tokens_in: step1.tokens_in,
      tokens_out: step1.tokens_out,
      duration_ms: step1.duration_ms,
    });

    // -----------------------------------------------------------------
    // STEP 2 - Decomposition en sous-questions
    // -----------------------------------------------------------------
    stepIndex++;
    const decompUser = `${baseContext}

Etape 2 - Decomposition.
Identifie les sous-questions juridiques INDEPENDANTES contenues dans la demande. Si la demande est mono-thematique, renvoie une seule sous-question.

Reponds en JSON strict :
{
  "questions": [
    {"id": "q1", "label": "Question juridique courte et precise", "discipline": "ex. droit du travail, art. L1226-..."}
  ]
}
Maximum 5 sous-questions. Sois precis sur la formulation juridique de chaque question.`;

    const step2 = await ask({
      system: SYSTEM_BASE(mode),
      user: decompUser,
      maxTokens: 1200,
    });
    const decomposition = parseJson(step2.text) ?? { questions: [{ id: 'q1', label: lastUser.content, discipline: theCase.domain }] };
    await persistStep(supabase, base, {
      kind: 'decomposition',
      step_index: stepIndex,
      prompt: decompUser.slice(0, 5000),
      model: step2.model,
      output_text: step2.text,
      output_json: decomposition,
      tokens_in: step2.tokens_in,
      tokens_out: step2.tokens_out,
      duration_ms: step2.duration_ms,
    });

    // -----------------------------------------------------------------
    // STEP 3 - Sub-analyses (une par sous-question)
    // -----------------------------------------------------------------
    const subQuestions = Array.isArray(decomposition.questions) ? decomposition.questions : [];
    const subResults = [];

    for (const q of subQuestions) {
      stepIndex++;
      const subUser = `${baseContext}

Etape 3 - Analyse approfondie de la sous-question.

Sous-question : "${q.label}"
Discipline : ${q.discipline ?? theCase.domain}

Produis une analyse complete en JSON strict :
{
  "question_id": "${q.id}",
  "question_label": "${q.label}",
  "rappel_theorique": "expose la regle de droit applicable : article(s) de code precis, jurisprudence de reference (Cass. + date + numero si possible), doctrine. 3-5 phrases.",
  "application_aux_faits": "applique la regle aux faits du dossier. Sois precis et factuel. 3-5 phrases.",
  "risques": ["risque 1 identifie", "risque 2"],
  "recommandations": ["action concrete 1", "action concrete 2"],
  "sources": [
    {"type": "article", "ref": "Code du travail art. L1234-1", "url": null, "excerpt": "texte court de l'article", "confidence": "green"},
    {"type": "jurisprudence", "ref": "Cass. soc. 12 mars 2019, n° 17-..", "url": null, "excerpt": "principe pose par l'arret", "confidence": "green"}
  ],
  "confidence": "green" | "orange" | "red"
}`;

      const sub = await ask({
        system: SYSTEM_BASE(mode),
        user: subUser,
        maxTokens: 2500,
      });
      const subJson = parseJson(sub.text) ?? {
        question_id: q.id,
        question_label: q.label,
        rappel_theorique: '(analyse non disponible)',
        application_aux_faits: '',
        risques: [],
        recommandations: [],
        sources: [],
        confidence: 'red',
      };
      await persistStep(supabase, base, {
        kind: 'sub_analysis',
        step_index: stepIndex,
        prompt: subUser.slice(0, 5000),
        model: sub.model,
        output_text: sub.text,
        output_json: subJson,
        citations: Array.isArray(subJson.sources) ? subJson.sources : [],
        confidence_level: subJson.confidence ?? null,
        tokens_in: sub.tokens_in,
        tokens_out: sub.tokens_out,
        duration_ms: sub.duration_ms,
      });
      subResults.push(subJson);
    }

    // -----------------------------------------------------------------
    // STEP 4 - Synthese globale
    // -----------------------------------------------------------------
    stepIndex++;
    const globalUser = `${baseContext}

Etape 4 - Synthese globale.

Voici les analyses individuelles par sous-question :
${JSON.stringify(subResults, null, 2)}

Produis la reponse finale a presenter a l'utilisateur, en JSON strict :
{
  "context_reconstruit": "1-2 phrases sur ce que tu as compris du dossier",
  "analyse": "synthese juridique structuree, qui croise les sous-analyses. Sois clair et oriente action. 4-8 phrases.",
  "risques_principaux": ["risque 1 hiérarchise", "risque 2"],
  "recommandations": [
    {"priority": "high" | "medium" | "low", "action": "action concrete", "delai": "ex. dans les 48h, avant le 30 juin..."}
  ],
  "questions_de_clarification": ["question 1 si besoin de plus d'info, sinon liste vide"],
  "sources_principales": [
    {"ref": "...", "url": null, "excerpt": "...", "confidence": "green"}
  ],
  "confidence_level": "green" | "orange" | "red",
  "need_lawyer": true | false,
  "need_lawyer_reason": "1 phrase si true, null sinon"
}`;

    const step4 = await ask({
      system: SYSTEM_BASE(mode),
      user: globalUser,
      maxTokens: 3500,
    });
    const globalJson = parseJson(step4.text) ?? {
      context_reconstruit: '',
      analyse: step4.text,
      risques_principaux: [],
      recommandations: [],
      questions_de_clarification: [],
      sources_principales: [],
      confidence_level: 'red',
      need_lawyer: false,
      need_lawyer_reason: null,
    };
    await persistStep(supabase, base, {
      kind: 'global_synthesis',
      step_index: stepIndex,
      prompt: globalUser.slice(0, 5000),
      model: step4.model,
      output_text: step4.text,
      output_json: globalJson,
      citations: Array.isArray(globalJson.sources_principales) ? globalJson.sources_principales : [],
      confidence_level: globalJson.confidence_level ?? null,
      tokens_in: step4.tokens_in,
      tokens_out: step4.tokens_out,
      duration_ms: step4.duration_ms,
    });

    // -----------------------------------------------------------------
    // Update assistant message with the final content
    // -----------------------------------------------------------------
    // Generate human-readable text from globalJson (this is the "content" of the bulle assistant)
    const lines = [];
    if (globalJson.context_reconstruit) {
      lines.push(`**Contexte :** ${globalJson.context_reconstruit}`);
      lines.push('');
    }
    if (globalJson.analyse) {
      lines.push('**Analyse juridique :**');
      lines.push(globalJson.analyse);
      lines.push('');
    }
    if (Array.isArray(globalJson.risques_principaux) && globalJson.risques_principaux.length) {
      lines.push('**Risques identifies :**');
      globalJson.risques_principaux.forEach((r) => lines.push(`- ${r}`));
      lines.push('');
    }
    if (Array.isArray(globalJson.recommandations) && globalJson.recommandations.length) {
      lines.push('**Recommandations :**');
      globalJson.recommandations.forEach((r) => {
        const tag = r.priority === 'high' ? '[Prio haute]' : r.priority === 'medium' ? '[Prio moyenne]' : '[Prio basse]';
        const delai = r.delai ? ` _(${r.delai})_` : '';
        lines.push(`- ${tag} ${r.action}${delai}`);
      });
      lines.push('');
    }
    if (globalJson.need_lawyer) {
      lines.push(`**Avocat externe recommande :** ${globalJson.need_lawyer_reason ?? ''}`);
      lines.push('');
    }
    if (Array.isArray(globalJson.questions_de_clarification) && globalJson.questions_de_clarification.length) {
      lines.push('**Pour affiner mon analyse :**');
      globalJson.questions_de_clarification.forEach((q) => lines.push(`- ${q}`));
    }
    const finalContent = lines.join('\n').trim() || step4.text;

    await supabase
      .from('case_messages')
      .update({
        content: finalContent,
        content_json: globalJson,
        citations: Array.isArray(globalJson.sources_principales) ? globalJson.sources_principales : [],
        confidence_level: globalJson.confidence_level ?? null,
        tokens_in: (step1.tokens_in ?? 0) + (step2.tokens_in ?? 0) + (step4.tokens_in ?? 0),
        tokens_out: (step1.tokens_out ?? 0) + (step2.tokens_out ?? 0) + (step4.tokens_out ?? 0),
        duration_ms: (step1.duration_ms ?? 0) + (step2.duration_ms ?? 0) + (step4.duration_ms ?? 0),
      })
      .eq('id', assistantMsg.id);

    // Bump case updated_at
    await supabase
      .from('cases')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', caseId);

    return res.status(200).json({
      message_id: assistantMsg.id,
      confidence_level: globalJson.confidence_level,
      need_lawyer: globalJson.need_lawyer,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    await supabase
      .from('case_messages')
      .update({
        content: `[Erreur] ${message}`,
        content_json: { error: message },
      })
      .eq('id', assistantMsg.id);
    return res.status(500).json({ error: message });
  }
}
