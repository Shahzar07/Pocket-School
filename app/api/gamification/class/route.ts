import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { classBoards } from '@/lib/gamification/engine';
import { saveClassBoards } from '@/lib/server/gamification';

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { limit: 20, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const institutionId = typeof body?.institutionId === 'string' ? body.institutionId : '';
  const classId = typeof body?.classId === 'string' ? body.classId : '';
  if (!institutionId || !classId) {
    return NextResponse.json({ error: 'Choose a class.', code: 'BAD_CLASS' }, { status: 400 });
  }
  const settings = classBoards({
    leaderboardEnabled: body?.leaderboardEnabled === false ? false : true,
    competitionsEnabled: body?.competitionsEnabled === true,
  });
  try {
    await saveClassBoards(user.uid, institutionId, classId, settings);
    return NextResponse.json(settings);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'FORBIDDEN') {
      return NextResponse.json({ error: 'You cannot change this class.', code }, { status: 403 });
    }
    console.error('[gamification] class', error);
    return NextResponse.json({ error: 'Could not save the class settings.', code: 'CLASS_FAILED' }, { status: 500 });
  }
}
