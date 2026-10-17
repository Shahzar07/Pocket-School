import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import { callOpenRouter } from '@/lib/openrouter';
import { ENGLISH_ESSAY_COACHING } from '@/lib/essays/coaching';
import { levelFromUnknown, markEssay, parseEssayMark } from '@/lib/essays/mark';
import {
  EXEMPLAR_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  guardPlan,
  planEssay,
  type EssayPlan,
} from '@/lib/essays/plan';
import {
  acceptGeneratedQuestion,
  generateEssayQuestion,
  isEssayType,
  isExamBoard,
  topicsFromText,
} from '@/lib/essays/questions';

export const maxDuration = 60;

/**
 * ET Essays. Planning returns a brainstorm, an outline, and one thesis.
 * It never returns the student's essay. Marking is separate.
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
    planningEnabled?: boolean;
    subject?: string;
    topics?: string;
    essayType?: string;
    board?: string;
    recent?: string[];
    nonce?: number;
  } | null;
  if (!payload?.kind) return NextResponse.json({ error: 'kind is required' }, { status: 400 });

  const level = levelFromUnknown(payload.level);
  const prompt = String(payload.prompt ?? '').slice(0, 2000);
  const idea = String(payload.idea ?? '').slice(0, 2000);
  const body = String(payload.body ?? '').slice(0, 20000);

  if (payload.kind === 'question') {
    const type = typeof payload.essayType === 'string' && isEssayType(payload.essayType) ? payload.essayType : 'argumentative';
    const board = typeof payload.board === 'string' && isExamBoard(payload.board) ? payload.board : 'none';
    const recent = Array.isArray(payload.recent) ? payload.recent.filter((item): item is string => typeof item === 'string').slice(0, 12) : [];
    const local = generateEssayQuestion({
      subject: String(payload.subject ?? ''),
      level,
      topics: topicsFromText(String(payload.topics ?? '')),
      type,
      board,
      recent,
      nonce: typeof payload.nonce === 'number' ? payload.nonce : 0,
    });
    const model = await modelText([
      { role: 'system', content: 'You are ET AI in ET Essays. Return one essay question only. Do not write an essay, a paragraph, or a school year. Do not use another name.' },
      {
        role: 'user',
        content: [
          `Subject: ${local.subject}`,
          `Level: ${level}`,
          `Topics: ${local.topics.join(', ') || 'the main idea'}`,
          `Essay type: ${type}`,
          `Exam board style: ${board}`,
          `Do not repeat: ${recent.join(' | ') || 'none'}`,
          local.guidance,
        ].join('\n'),
      },
    ], 180);
    const question = model ? acceptGeneratedQuestion(model, recent, local.question) : local.question;
    return NextResponse.json({ question: { ...local, question } });
  }

  if (payload.kind === 'plan') {
    if (payload.planningEnabled === false) {
      return NextResponse.json({ error: 'Planning help is off for this assessment.' }, { status: 403 });
    }
    const local = planEssay({ idea, prompt, level });
    const model = await modelText([
      { role: 'system', content: `${PLAN_SYSTEM_PROMPT}\n${EXEMPLAR_SYSTEM_PROMPT}` },
      {
        role: 'user',
        content: [
          'Return JSON only, with short lines. Do not write the student\'s essay.',
          '{"brainstorm":["line"],"outline":["line"],"thesis":"one sentence","exemplarQuestion":"a different question","exemplar":"one short paragraph answering only exemplarQuestion"}',
          `Level: ${level}`,
          `Student question: ${prompt}`,
          `Idea: ${idea}`,
        ].join('\n'),
      },
    ], 500);
    return NextResponse.json({ plan: model ? parsePlan(model, local, prompt) : local });
  }

  if (payload.kind === 'mark') {
    const local = markEssay({ body, prompt, level });
    const model = await modelText([
      { role: 'system', content: `${ENGLISH_ESSAY_COACHING}\nReturn JSON with percent, rubric, inline, fixNext, and summary. The summary must say ET AI.` },
      { role: 'user', content: `Question: ${prompt}\nLevel: ${level}\n\n${body}` },
    ], 900);
    if (!model) return NextResponse.json({ mark: local });
    try {
      return NextResponse.json({ mark: parseEssayMark(JSON.parse(model), local) });
    } catch {
      return NextResponse.json({ mark: local });
    }
  }

  return NextResponse.json({ error: 'kind must be question, plan, or mark' }, { status: 400 });
}

function parsePlan(raw: string, fallback: EssayPlan, studentPrompt: string): EssayPlan {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const value = JSON.parse(match[0]) as Partial<EssayPlan>;
    const lines = (item: unknown) => Array.isArray(item)
      ? item.filter((line): line is string => typeof line === 'string')
      : [];
    return guardPlan({
      brainstorm: lines(value.brainstorm),
      outline: lines(value.outline),
      thesis: typeof value.thesis === 'string' ? value.thesis : '',
      exemplarQuestion: typeof value.exemplarQuestion === 'string' ? value.exemplarQuestion : '',
      exemplar: typeof value.exemplar === 'string' ? value.exemplar : '',
    }, fallback, studentPrompt);
  } catch {
    return fallback;
  }
}

async function modelText(
  messages: { role: 'system' | 'user'; content: string }[],
  maxTokens: number,
): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  try {
    const text = await callOpenRouter(messages, { temperature: 0.2, maxTokens });
    return text.trim() || null;
  } catch {
    return null;
  }
}
