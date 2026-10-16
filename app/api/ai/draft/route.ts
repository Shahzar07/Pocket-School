import { NextRequest, NextResponse } from 'next/server';
import { enforceAiAccess } from '@/lib/api-guard';
import { chat, MODELS } from '@/lib/study/ai';

export const runtime = 'nodejs';

/** ET AI draft for a message or announcement. Fails clearly when the key is missing. */
export async function POST(req: NextRequest) {
  const denied = await enforceAiAccess(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { prompt?: string } | null;
  const prompt = String(body?.prompt ?? '').trim().slice(0, 2000);
  if (!prompt) return NextResponse.json({ error: 'Write a prompt first.' }, { status: 400 });
  try {
    const text = await chat({
      models: MODELS.FAST,
      maxTokens: 600,
      messages: [
        { role: 'system', content: 'You are ET AI, drafting a short school message for Poket School. Return only the message the sender can edit. No greeting that names a product other than Poket School.' },
        { role: 'user', content: prompt },
      ],
    });
    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ET AI is unavailable.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
