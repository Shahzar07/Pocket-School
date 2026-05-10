const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const FAST_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
export const SMART_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export async function callOpenRouter(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts?: { model?: string; temperature?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://pocket-school.app',
      'X-Title': 'Pocket School',
    },
    body: JSON.stringify({
      model: opts?.model ?? SMART_MODEL,
      temperature: opts?.temperature ?? 0.7,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
