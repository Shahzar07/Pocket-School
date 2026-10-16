import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import { callOpenRouter } from '@/lib/openrouter';
import { ENGLISH_ESSAY_COACHING } from '@/lib/essays/coaching';
import { draftEssay, levelFromUnknown, markEssay, parseEssayMark } from '@/lib/essays/mark';

export const maxDuration = 60;

/**
 * ET Essays. The local coach always has an answer. A signed-in request can
 * ask the model to revise it, using the same ET English method.
 */
export async function POST(req: NextRequest) {
  const denied = await enforceAiAccess(req);
  if (denied) return denied;
  const payload = await req.json().catch(() => null) as {
    kind?: string;
    idea?: string;
    prompt?: string;
    level?: string;
    body?: string;
  } | null;
  if (!payload?.kind) return NextResponse.json({ error: 'kind is required' }, { status: 400 });

  const level = levelFromUnknown(payload.level);
  const prompt = String(payload.prompt ?? '').slice(0, 2000);
  const idea = String(payload.idea ?? '').slice(0, 2000);
  const body = String(payload.body ?? '').slice(0, 20000);

  if (payload.kind === 'draft') {
    const local = draftEssay({ idea, prompt, level });
    const model = await modelText([
      { role: 'system', content: ENGLISH_ESSAY_COACHING },
      { role: 'user', content: `Draft the essay. Return only the essay paragraphs.\nLevel: ${level}\nQuestion: ${prompt}\nIdea: ${idea}` },
    ]);
    return NextResponse.json(model ? { ...local, body: model } : local);
  }

  if (payload.kind === 'mark') {
    const local = markEssay({ body, prompt, level });
    const model = await modelText([
      { role: 'system', content: `${ENGLISH_ESSAY_COACHING}\nReturn JSON with percent, rubric, inline, fixNext, and summary. The summary must say ET AI.` },
      { role: 'user', content: `Question: ${prompt}\nLevel: ${level}\n\n${body}` },
    ]);
    if (!model) return NextResponse.json({ mark: local });
    try {
      return NextResponse.json({ mark: parseEssayMark(JSON.parse(model), local) });
    } catch {
      return NextResponse.json({ mark: local });
    }
  }

  return NextResponse.json({ error: 'kind must be draft or mark' }, { status: 400 });
}

async function modelText(messages: { role: 'system' | 'user'; content: string }[]): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  try {
    const text = await callOpenRouter(messages, { temperature: 0.4, maxTokens: 1200 });
    return text.trim() || null;
  } catch {
    return null;
  }
}
