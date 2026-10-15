import 'server-only';
import { protectLatexInJson } from '@/lib/latex-json';

/**
 * Model access for the study features.
 *
 * Each job gets the model that suits it, not one model for everything:
 *  - SOLVER   maths needs to be right. A reasoning model solves each problem
 *             once, up front, and that answer key drives the whole tutoring
 *             conversation — so accuracy costs one slow call, not every turn.
 *  - VISION   reads photographed and handwritten problems.
 *  - FAST     structured generation the student is waiting on: plans,
 *             flashcards, quizzes. Streams quickly and follows JSON well.
 *  - TUTOR    the live conversation. Starts speaking almost immediately.
 */
export const MODELS = {
  SOLVER: ['openai/gpt-5-mini', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini'],
  VISION: ['google/gemini-2.5-flash', 'google/gemini-2.0-flash-001', 'openai/gpt-4o-mini'],
  FAST: ['google/gemini-2.0-flash-001', 'openai/gpt-4o-mini', 'google/gemini-2.5-flash'],
  TUTOR: ['google/gemini-2.0-flash-001', 'openai/gpt-4o-mini', 'google/gemini-2.5-flash'],
} as const;

export type ModelChain = readonly string[];

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

interface ChatOptions {
  models: ModelChain;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  /** Reasoning effort for reasoning models; ignored by others. */
  effort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function body(opts: ChatOptions, stream: boolean) {
  const [model, ...rest] = opts.models;
  const reasoning = model.startsWith('openai/gpt-5');
  return JSON.stringify({
    model,
    models: [model, ...rest].slice(0, 3),
    ...(reasoning
      ? { reasoning: { effort: opts.effort ?? 'low' } }
      : { temperature: opts.temperature ?? 0.4 }),
    max_tokens: opts.maxTokens ?? 4000,
    ...(opts.json && !reasoning ? { response_format: { type: 'json_object' } } : {}),
    ...(stream ? { stream: true } : {}),
    messages: opts.messages,
  });
}

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not configured on this server (OPENROUTER_API_KEY).');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://poketschool.ai',
    'X-Title': 'Poket School',
  };
}

/** One completion, retried on rate limits and transient failures. */
export async function chat(opts: ChatOptions): Promise<string> {
  let last: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 600 * 2 ** attempt));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    opts.signal?.addEventListener('abort', () => ctrl.abort());
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: headers(), body: body(opts, false), signal: ctrl.signal });
      if (res.ok) {
        const data = await res.json();
        const text: string | undefined = data.choices?.[0]?.message?.content;
        if (text?.trim()) return text;
        last = new Error('The AI returned an empty answer.');
        continue;
      }
      const err = await res.text();
      last = new Error(`AI provider error ${res.status}: ${err.slice(0, 200)}`);
      if (res.status !== 429 && res.status < 500) throw last;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      last = e instanceof Error ? e : new Error(String(e));
      if (last.message.startsWith('AI provider error 4') && !last.message.startsWith('AI provider error 429')) throw last;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last ?? new Error('The AI request failed.');
}

/**
 * Pull the first JSON object or array out of a model reply. Models wrap JSON
 * in fences, add a sentence before it, or leave trailing commas; this copes
 * with all three rather than failing the whole request.
 */
export function parseJSON<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const src = (fenced ? fenced[1] : text).trim();
  const start = src.search(/[[{]/);
  if (start === -1) throw new Error('The AI reply had no JSON in it.');
  const open = src[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) { end = i; break; }
  }
  const raw = protectLatexInJson(src.slice(start, end === -1 ? undefined : end + 1));
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Common repairs: trailing commas, and LaTeX backslashes that aren't
    // valid JSON escapes ("\frac" must be "\\frac").
    const repaired = raw
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
      .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u');
    return JSON.parse(repaired) as T;
  }
}

/** A completion that must come back as JSON, with one corrective retry. */
export async function chatJSON<T>(opts: ChatOptions): Promise<T> {
  const text = await chat({ ...opts, json: true });
  try {
    return parseJSON<T>(text);
  } catch {
    const retry = await chat({
      ...opts,
      json: true,
      messages: [
        ...opts.messages,
        { role: 'assistant', content: text.slice(0, 6000) },
        { role: 'user', content: 'That was not valid JSON. Reply again with ONLY the JSON, no prose, no code fences. Escape every backslash in LaTeX as \\\\.' },
      ],
    });
    return parseJSON<T>(retry);
  }
}

/** Stream a completion as plain text deltas. */
export async function streamChat(opts: ChatOptions): Promise<ReadableStream<Uint8Array>> {
  const upstream = await fetch(ENDPOINT, { method: 'POST', headers: headers(), body: body(opts, true), signal: opts.signal });
  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text().catch(() => '');
    throw new Error(`AI provider error ${upstream.status}: ${err.slice(0, 200)}`);
  }
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch { /* keep-alive comment */ }
          }
        }
      } catch { /* client went away */ }
      finally { controller.close(); }
    },
  });
}

export function textStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
