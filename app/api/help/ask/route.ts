import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { answerFromArticles } from '@/lib/help-centre';
import { listHelpArticles } from '@/lib/help-articles';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`help-ask:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many questions. Wait a moment and try again.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({})) as { question?: unknown };
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
  if (question.length < 2) {
    return NextResponse.json({ error: 'Ask a question in a few words.', code: 'QUESTION_REQUIRED' }, { status: 400 });
  }
  const articles = await listHelpArticles(true);
  const answer = answerFromArticles(question, articles);
  return NextResponse.json({
    confident: answer.confident,
    answer: answer.answer,
    sources: answer.sources,
    escalate: !answer.confident,
  });
}
