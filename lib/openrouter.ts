/** Overridable so tests can point the client at a local stand-in. */
const BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions';

/** Cheapest tier — trivial checks (deterministic-style grading fallbacks). */
export const FAST_MODEL = 'meta-llama/llama-3.1-8b-instruct';

/** Content generation (lesson text, quizzes, flashcards, notes, tutor…) —
 * newest ultra-low-cost tier: GPT-5 nano is ~$0.05/M input tokens with
 * strong accuracy on structured educational content. */
export const CONTENT_MODEL = 'openai/gpt-5-nano';

/** Video & audio script generation — creative narrative writing benefits
 * from a slightly stronger model; GPT-5 mini is still budget-tier. */
export const VIDEO_MODEL = 'openai/gpt-5-mini';

/**
 * Live conversation — the AI teachers and the tutor.
 *
 * Deliberately NOT a reasoning model. GPT-5 nano thinks before it emits a
 * single token, which adds seconds of silence before a reply starts. That is
 * fine for generating a lesson in the background and completely wrong for a
 * conversation, where the teacher felt broken because nothing happened for
 * several seconds. Gemini 2.0 Flash starts streaming almost immediately and
 * costs less per token.
 */
export const LIVE_MODEL = 'google/gemini-2.0-flash-001';

/** Back-compat alias — existing routes import SMART_MODEL. */
export const SMART_MODEL = CONTENT_MODEL;

/** OpenRouter routing fallbacks per primary model: if the primary is down,
 * unavailable, or rejected, OpenRouter tries the next id in the list.
 * HARD LIMIT: OpenRouter rejects `models` arrays longer than 3 items. */
const FALLBACKS: Record<string, string[]> = {
  [CONTENT_MODEL]: [CONTENT_MODEL, 'google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'z-ai/glm-4.6', 'google/gemini-2.0-flash-001'],
  [VIDEO_MODEL]: [VIDEO_MODEL, 'google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'z-ai/glm-4.6'],
  [LIVE_MODEL]: [LIVE_MODEL, 'google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'z-ai/glm-4.6'],
  [FAST_MODEL]: [FAST_MODEL, 'openai/gpt-4o-mini', 'google/gemini-2.5-flash'],
};

/** The fallback chain for a model id (the id itself first). */
export function modelChain(model: string): string[] {
  return FALLBACKS[model] ?? [model, 'openai/gpt-4o-mini', 'google/gemini-2.5-flash'];
}

const MAX_RETRIES = 3;
/** One attempt. Kept under the 60 second limit the AI routes run with. */
const REQUEST_TIMEOUT_MS = 50_000;
/** After this long there is no room for another attempt inside one request. */
const RETRY_BUDGET_MS = 35_000;
/** Reasoning models spend part of max_tokens thinking, so they get headroom. */
const REASONING_MAX_TOKENS = 8000;
const DEFAULT_MAX_TOKENS = 4096;

export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/** GPT-5 family models only accept the default temperature and control
 * effort via `reasoning`; sending temperature causes a 400. */
export function isReasoningModel(model: string): boolean {
  return model.startsWith('openai/gpt-5');
}

/**
 * Model ids the provider refused in this server instance (retired, renamed,
 * or not enabled for the key). They are skipped for a while so a retired
 * primary does not cost every request a wasted round trip.
 */
const deadModels = new Map<string, number>();
const DEAD_MODEL_TTL_MS = 30 * 60_000;

function isDead(model: string): boolean {
  const until = deadModels.get(model);
  if (!until) return false;
  if (until < Date.now()) { deadModels.delete(model); return false; }
  return true;
}

/** A 4xx that is about the model itself, not about the request or the key. */
function isModelUnavailable(status: number, text: string): boolean {
  if (status === 404) return true;
  if (status !== 400 && status !== 403 && status !== 422) return false;
  return /model|endpoint|provider|not (?:available|supported|found)|deprecat|unsupported|region/i.test(text);
}

export interface OpenRouterAttempt {
  /** Build the JSON body for one model. `fallbacks` is the rest of the chain,
   * capped at what OpenRouter accepts in `models`. */
  build: (model: string, fallbacks: string[]) => Record<string, unknown>;
  chain: readonly string[];
  signal?: AbortSignal;
}

/**
 * POST a chat completion, walking the model chain when the provider says a
 * model id is gone. OpenRouter's own `models` routing covers outages, but it
 * rejects the whole request when an id in the list no longer exists, which is
 * what used to take every AI feature down at once when a model was retired.
 * Returns the first response that is not a model-availability refusal.
 */
export async function openRouterFetch({ build, chain, signal }: OpenRouterAttempt): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  const unique = [...new Set(chain)];
  const live = unique.filter((m) => !isDead(m));
  const candidates = live.length ? live : unique;
  let last: Response | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    // First try uses OpenRouter routing across the next two models. Later
    // tries send a single model so one bad id cannot fail the request again.
    const fallbacks = i === 0 ? candidates.slice(1, 3) : [];
    const res = await fetch(BASE_URL, {
      method: 'POST',
      signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://poketschool.ai',
        'X-Title': 'Poket School',
      },
      body: JSON.stringify(build(model, fallbacks)),
    });
    if (res.ok) return res;
    if (res.status === 401 || res.status === 402 || res.status === 429 || res.status >= 500) return res;
    const text = await res.clone().text().catch(() => '');
    if (!isModelUnavailable(res.status, text)) return res;
    // With routing on we cannot tell which id was refused, so only a
    // single-model refusal marks that model dead.
    if (!fallbacks.length) deadModels.set(model, Date.now() + DEAD_MODEL_TTL_MS);
    else if (i === 0) {
      // Retry the primary alone before moving on.
      const solo = await fetch(BASE_URL, {
        method: 'POST',
        signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://poketschool.ai',
          'X-Title': 'Poket School',
        },
        body: JSON.stringify(build(model, [])),
      });
      if (solo.ok) return solo;
      if (solo.status === 401 || solo.status === 402 || solo.status === 429 || solo.status >= 500) return solo;
      const soloText = await solo.clone().text().catch(() => '');
      if (!isModelUnavailable(solo.status, soloText)) return solo;
      deadModels.set(model, Date.now() + DEAD_MODEL_TTL_MS);
      last = solo;
      continue;
    }
    last = res;
  }
  return last!;
}

/** A short sentence a learner can read, from any AI failure. */
export function friendlyAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/OPENROUTER_API_KEY/.test(raw)) return 'ET AI is not switched on yet. Ask an admin to add the AI key.';
  if (/\b401\b/.test(raw)) return 'ET AI could not sign in to its model provider. Ask an admin to check the AI key.';
  if (/\b402\b|credit|insufficient/i.test(raw)) return 'ET AI has run out of model credit. Ask an admin to top up.';
  if (/\b429\b|rate.?limit/i.test(raw)) return 'ET AI is busy right now. Wait a few seconds and try again.';
  if (/abort|timed? ?out|timeout/i.test(raw)) return 'ET AI took too long to answer. Try again, or try a shorter request.';
  if (/fetch failed|network|ECONN|ENOTFOUND/i.test(raw)) return 'ET AI could not reach its model provider. Check the connection and try again.';
  return 'ET AI could not answer that. Try again in a moment.';
}

export async function callOpenRouter(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');

  const primary = opts?.model ?? CONTENT_MODEL;
  let lastError: Error | null = null;
  const started = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // A second try that cannot finish before the route is cut off only turns
    // a readable error into a blank gateway timeout.
    if (attempt > 0 && Date.now() - started > RETRY_BUDGET_MS) break;
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await openRouterFetch({
        chain: modelChain(primary),
        signal: controller.signal,
        build: (model, fallbacks) => ({
          model,
          ...(fallbacks.length ? { models: [model, ...fallbacks] } : {}),
          ...(isReasoningModel(model)
            ? { reasoning: { effort: 'low' } } // keep latency + cost minimal
            : { temperature: opts?.temperature ?? 0.7 }),
          max_tokens: opts?.maxTokens ?? (isReasoningModel(model) ? REASONING_MAX_TOKENS : DEFAULT_MAX_TOKENS),
          ...(opts?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) return content;
        // Empty completion — treat as retryable so callers never receive ''.
        lastError = new Error('Empty completion from model');
        continue;
      }

      const err = await res.text();
      const shouldRetry = res.status === 429 || res.status >= 500;
      if (!shouldRetry) {
        throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 400)}`);
      }
      lastError = new Error(`OpenRouter error ${res.status}: ${err.slice(0, 400)}`);
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
