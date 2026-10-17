import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { readGameSummary } from '@/lib/server/gamification';

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { limit: 30, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  try {
    return NextResponse.json(await readGameSummary(user.uid));
  } catch (error) {
    console.error('[gamification] state', error);
    return NextResponse.json({ error: 'Could not load progress.', code: 'STATE_FAILED' }, { status: 500 });
  }
}
