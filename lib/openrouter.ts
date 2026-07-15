const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const FAST_MODEL = 'meta-llama/llama-3.1-8b-instruct';
export const SMART_MODEL = 'openai/gpt-4o-mini';

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 4096;

export async function callOpenRouter(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pocket-school.app',
          'X-Title': 'Pocket School',
        },
        body: JSON.stringify({
          model: opts?.model ?? SMART_MODEL,
          temperature: opts?.temperature ?? 0.7,
          max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(opts?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim()) return content;
        // Empty completion — treat as retryable so callers never receive ''.
        lastError = new Error('Empty completion from model');
        continue;
      }

      const err = await res.text();
      const shouldRetry = res.status === 429 || res.status >= 500;
      if (!shouldRetry) {
        throw new Error(`OpenRouter error ${res.status}: ${err}`);
      }
      lastError = new Error(`OpenRouter error ${res.status}: ${err}`);
    } catch (e: any) {
      // Network failures and timeouts are retryable; permanent 4xx above rethrows.
      if (e?.message?.startsWith('OpenRouter error')) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('OpenRouter request failed');
}
