import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import {
  appoint, confirmLeadership, createEvent, createGroup, discover, inviteLink, joinGroup,
  moderateGroup, postToGroup, recordDues, rsvp,
} from '@/lib/server/groups';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'create') return createGroup(user.uid, body);
    if (action === 'join') return joinGroup(user.uid, str(body.groupId), str(body.code));
    if (action === 'post') return postToGroup(user.uid, str(body.groupId), body);
    if (action === 'event') return createEvent(user.uid, str(body.groupId), body);
    if (action === 'rsvp') return rsvp(user.uid, str(body.eventId), body.going !== false);
    if (action === 'appoint') return appoint(user.uid, str(body.groupId), str(body.targetId), str(body.role));
    if (action === 'confirm') return confirmLeadership(user.uid, str(body.groupId), str(body.targetId));
    if (action === 'moderate') return moderateGroup(user.uid, str(body.groupId), str(body.action), str(body.ownerId));
    if (action === 'invite') return inviteLink(user.uid, str(body.groupId));
    if (action === 'dues') return recordDues(user.uid, str(body.groupId), Number(body.amountCents) || 0);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'discover') return discover(user.uid);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
