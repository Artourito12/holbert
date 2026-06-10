import Anthropic from '@anthropic-ai/sdk';

const SONNET = 'claude-sonnet-4-6';
const OPUS = 'claude-opus-4-7';

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// Appel Claude unifie pour le pipeline.
// attachments = liste de content blocks (ex. PDF en base64) a injecter avant le texte user.
export async function ask({
  system,
  user,
  model = SONNET,
  maxTokens = 4096,
  attachments = [],
  temperature = 0.2,
}) {
  const start = Date.now();
  const userContent = [...attachments, { type: 'text', text: user }];
  const response = await client().messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const text = response.content
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('');
  return {
    text,
    tokens_in: response.usage.input_tokens,
    tokens_out: response.usage.output_tokens,
    duration_ms: Date.now() - start,
    model,
  };
}

// Parse le premier bloc JSON trouve dans la reponse (Claude entoure parfois de ```json).
export function parseJson(text) {
  if (!text) return null;
  // Try fenced first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  // Find first { ... matching }
  const start = candidate.indexOf('{');
  const startArr = candidate.indexOf('[');
  const realStart = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  if (realStart === -1) return null;
  const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  if (end === -1) return null;
  try {
    return JSON.parse(candidate.slice(realStart, end + 1));
  } catch {
    return null;
  }
}

export { SONNET, OPUS };
