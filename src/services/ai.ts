// Progression analysis via any OpenAI-compatible chat-completions endpoint.
// Config-driven: defaults to OpenRouter with a free model. Override with
// LLM_BASE_URL / LLM_MODEL in .env — e.g. point it at Gemini's
// OpenAI-compatible endpoint with no code change. The call is client-side,
// so whatever key you use ships in the bundle — keep it a free / low-limit key.

const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'z-ai/glm-5.2:free';
const LLM_ENDPOINT = `${LLM_BASE_URL}/chat/completions`;

const IS_OPENROUTER = (() => {
  try {
    return /(^|\.)openrouter\.ai$/i.test(new URL(LLM_BASE_URL).hostname);
  } catch {
    return false;
  }
})();

const SYSTEM_INSTRUCTION =
  'You are a music-theory tutor for intermediate guitarists. Given a chord ' +
  'progression, explain its functional harmony and voice leading in two to ' +
  'four short sentences. Be concrete, specific and encouraging. Reply in ' +
  'plain prose — no markdown headings, bullet points or code fences.';

export interface AnalyzeParams {
  root: string;
  scaleType: string;
  style: string;
  chordNames: string[];
}

export const buildPrompt = ({ root, scaleType, style, chordNames }: AnalyzeParams): string =>
  `Analyze this chord progression in the key of ${root} ${scaleType} for an intermediate guitar student.
      Progression: ${chordNames.join(' -> ')}.
      Musical Style: ${style}.
      Explain the functional harmony and voice leading. Brief & concise.`;

export const analyzeProgression = async (params: AnalyzeParams): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('No API key configured. Set API_KEY in .env to enable the AI Analyst.');
  }

  const res = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter attribution headers only — other providers (e.g. Gemini's
      // OpenAI-compatible endpoint) reject unknown headers at CORS preflight.
      ...(IS_OPENROUTER && typeof location !== 'undefined'
        ? { 'HTTP-Referer': location.origin, 'X-Title': 'ChordLab' }
        : {}),
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: buildPrompt(params) },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LLM request failed: ${res.status} ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  // Some reasoning models put the answer in `content`, thinking in `reasoning`.
  return (msg?.content || msg?.reasoning || '').trim() || 'No feedback generated.';
};
