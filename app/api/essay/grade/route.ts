import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import { gradeFromMark } from '@/lib/essay/scale';
import { chat, MODELS } from '@/lib/study/ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = await enforceAiAccess(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { essay?: string; prompt?: string };
  const essay = String(body.essay ?? '').slice(0, 12_000);
  const prompt = String(body.prompt ?? '').slice(0, 2_000);
  if (essay.trim().length < 40) {
    return NextResponse.json({ error: 'Write a little more before ET AI grades it.' }, { status: 400 });
  }
  try {
    const reply = await chat({
      models: MODELS.FAST,
      maxTokens: 700,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are ET AI grading for ET Essay Writer. Reply with JSON only: {"mark": number from 0 to 100, "feedback": string}. The mark is a percentage. Mention strengths and one next step. Do not mention any other brand.',
        },
        { role: 'user', content: `Task: ${prompt || 'Open essay'}\n\nEssay:\n${essay}` },
      ],
    });
    const match = reply.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) as { mark?: number; feedback?: string } : {};
    const grade = gradeFromMark(Number(parsed.mark));
    return NextResponse.json({
      ...grade,
      feedback: typeof parsed.feedback === 'string' && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : 'ET AI read the essay and could not write a longer note.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('OPENROUTER_API_KEY')) {
      return NextResponse.json({ error: 'ET AI grading needs OPENROUTER_API_KEY.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'ET AI could not grade this essay.' }, { status: 500 });
  }
}
