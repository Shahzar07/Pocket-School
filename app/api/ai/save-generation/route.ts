import { NextRequest, NextResponse } from 'next/server';
import { saveAiGeneration } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { userId?: string; type?: string; prompt?: string; result?: string; subject?: string; level?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { userId, type, prompt, result, subject, level } = body;
  if (!userId || !type || !prompt || !result) {
    return NextResponse.json({ error: 'userId, type, prompt and result are required.' }, { status: 400 });
  }
  try {
    const id = await saveAiGeneration(userId, {
      type,
      prompt,
      result: typeof result === 'string' ? result : JSON.stringify(result),
      subject,
      level,
    });
    return NextResponse.json({ id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
