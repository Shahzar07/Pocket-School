import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/api-guard';
import { isAdminConfigured } from '@/lib/firebase-admin';
import { loadAutomation, logAutomation } from '@/lib/server/automation-store';
import { answerSupport, defaultAutomation } from '@/lib/site-automation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0]?.trim() || 'local';
  if (!rateLimit(`support:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many questions. Please wait a moment.' }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const question = body && typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length < 3) {
    return NextResponse.json({ error: 'Ask a question in a sentence.' }, { status: 400 });
  }
  const settings = isAdminConfigured() ? await loadAutomation() : defaultAutomation();
  const result = answerSupport(question.slice(0, 500), settings);
  if (isAdminConfigured()) {
    await logAutomation({
      rule: result.matched ? 'help_et' : 'help_faq',
      outcome: result.escalate ? 'held' : 'auto',
      summary: result.escalate ? 'ET escalated a question to a ticket.' : `ET answered ${result.topic}.`,
    }).catch(() => undefined);
  }
  return NextResponse.json(result);
}
