import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { announce, channelMessages, createChannel, listChannels, sendChannelMessage } from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'channels') return createChannel(user.uid, {
      kind: str(body.kind), title: str(body.title), ageTier: str(body.ageTier),
      memberIds: ids(body.memberIds), classId: str(body.classId),
    });
    if (action === 'send') return sendChannelMessage(user.uid, { channelId: str(body.channelId), body: str(body.body), language: str(body.language) });
    if (action === 'announce') return announce(user.uid, { channelId: str(body.channelId), body: str(body.body), language: str(body.language) });
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'channels') return listChannels(user.uid);
    if (action === 'messages') return channelMessages(user.uid, req.nextUrl.searchParams.get('channelId') ?? '');
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
