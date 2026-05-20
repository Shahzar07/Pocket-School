const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const FAST_MODEL = 'meta-llama/llama-3.1-8b-instruct';
export const SMART_MODEL = 'openai/gpt-4o-mini';

const MAX_RETRIES = 3;

export async function callOpenRouter(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts?: { model?: string; temperature?: number }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    }

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

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    }

    const shouldRetry = res.status === 429 || res.status >= 500;
    const err = await res.text();

    if (!shouldRetry) {
      throw new Error(`OpenRouter error ${res.status}: ${err}`);
    }

    lastError = new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  throw lastError!;
}
