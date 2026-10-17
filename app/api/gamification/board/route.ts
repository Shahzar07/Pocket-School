import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { isoWeekKey } from '@/lib/gamification/engine';
import { readBoard } from '@/lib/server/gamification';

const SCOPES = new Set(['class', 'institution', 'house']);

export async function GET(req: NextRequest) {
  const user = await requireUser(req, { limit: 30, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  const scope = req.nextUrl.searchParams.get('scope') ?? '';
  const scopeId = req.nextUrl.searchParams.get('scopeId') ?? '';
  const period = req.nextUrl.searchParams.get('period') ?? 'all';
  if (!SCOPES.has(scope) || !scopeId || scopeId.length > 80) {
    return NextResponse.json({ error: 'Choose a class, school, or house.', code: 'BAD_SCOPE' }, { status: 400 });
  }
  const key = period === 'week' ? isoWeekKey(new Date().toISOString().slice(0, 10)) : 'all';
  try {
    const rows = await readBoard(scope, scopeId, key);
    return NextResponse.json({ rows, period: key });
  } catch (error) {
    console.error('[gamification] board', error);
    return NextResponse.json({ error: 'Could not load the board.', code: 'BOARD_FAILED' }, { status: 500 });
  }
}
