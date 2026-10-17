import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import {
  answerWelcome,
  reopenWelcome,
  skipWelcome,
  syncWelcome,
  visitWelcome,
  welcomeProfile,
} from '@/lib/server/onboarding-store';

export const dynamic = 'force-dynamic';

async function actor(uid: string, mode: unknown) {
  return welcomeProfile(uid, typeof mode === 'string' ? mode : '');
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  try {
    const state = await syncWelcome(user.uid, await actor(user.uid, req.nextUrl.searchParams.get('mode')));
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The welcome course could not be opened.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => ({})) as {
    op?: unknown;
    mode?: unknown;
    lessonId?: unknown;
    choice?: unknown;
    href?: unknown;
  };
  const profile = await actor(user.uid, body.mode);
  try {
    if (body.op === 'answer') {
      const lessonId = typeof body.lessonId === 'string' ? body.lessonId : '';
      const choice = typeof body.choice === 'number' ? body.choice : Number(body.choice);
      const state = await answerWelcome(user.uid, profile, lessonId, choice);
      return NextResponse.json(state);
    }
    if (body.op === 'visit') {
      const href = typeof body.href === 'string' ? body.href : '';
      if (!href.startsWith('/')) return NextResponse.json({ error: 'That page is not part of Poket School.' }, { status: 400 });
      const state = await visitWelcome(user.uid, profile, href);
      return NextResponse.json(state);
    }
    if (body.op === 'skip') return NextResponse.json(await skipWelcome(user.uid, profile));
    if (body.op === 'reopen') return NextResponse.json(await reopenWelcome(user.uid, profile));
    return NextResponse.json(await syncWelcome(user.uid, profile));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The welcome course could not be updated.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
