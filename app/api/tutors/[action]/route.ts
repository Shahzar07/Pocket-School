import { NextRequest } from 'next/server';
import { callerIsAdmin } from '@/lib/api-guard';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { bookTutor, listMyBookings, listPendingTutors, listTutors, reviewTutor, saveTutorProfile, verifyTutor } from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'profile') return saveTutorProfile(user.uid, {
      bio: str(body.bio),
      subjects: Array.isArray(body.subjects) ? body.subjects.filter((s): s is string => typeof s === 'string') : [],
      hourlyCents: Number(body.hourlyCents) || 0,
      slots: body.slots,
    });
    if (action === 'verify') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can verify a tutor.');
      return verifyTutor(user.uid, str(body.tutorId), body.approve === true);
    }
    if (action === 'book') return bookTutor(user.uid, {
      tutorId: str(body.tutorId), kind: str(body.kind), startAtMs: Number(body.startAtMs) || Date.now(),
      minutes: Number(body.minutes) || 60, seats: Number(body.seats) || 1,
    });
    if (action === 'review') return reviewTutor(user.uid, { bookingId: str(body.bookingId), rating: Number(body.rating) || 0, body: str(body.body) });
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(_req, async (user) => {
    if (action === 'list') return listTutors();
    if (action === 'mine') return listMyBookings(user.uid);
    if (action === 'pending') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can review tutors.');
      return listPendingTutors(user.uid);
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
