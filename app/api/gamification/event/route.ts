import { NextRequest, NextResponse } from 'next/server';
import { isNextResponse, requireUser } from '@/lib/api-guard';
import { LEARNING_EVENTS, isClientLearningEvent } from '@/lib/events';
import { applyLearningEvent } from '@/lib/server/gamification';

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { limit: 40, windowMs: 60_000 });
  if (isNextResponse(user)) return user;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const event = typeof body?.event === 'string' ? body.event : '';
  if (event === LEARNING_EVENTS.lessonFirstComplete) {
    return NextResponse.json({ error: 'The server records the first lesson.', code: 'SERVER_EVENT' }, { status: 400 });
  }
  if (!isClientLearningEvent(event)) {
    return NextResponse.json({ error: 'Unknown learning event.', code: 'BAD_EVENT' }, { status: 400 });
  }
  const day = typeof body?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day)
    ? body.day
    : new Date().toISOString().slice(0, 10);
  const hour = typeof body?.hour === 'number' ? body.hour : undefined;
  const eventId = typeof body?.eventId === 'string' ? body.eventId.slice(0, 80) : undefined;
  const payload = body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
    ? body.payload as Record<string, unknown>
    : {};
  try {
    const result = await applyLearningEvent(user.uid, { event, day, hour, eventId, payload });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[gamification] event', error);
    return NextResponse.json({ error: 'Could not record that activity.', code: 'EVENT_FAILED' }, { status: 500 });
  }
}
