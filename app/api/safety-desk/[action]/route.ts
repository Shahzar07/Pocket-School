import { NextRequest } from 'next/server';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { deviceFromHeaders } from '@/lib/ledger/device';
import { assignDeskCase, listDeskQueue, readRota, saveRota, submitDeskAlert } from '@/lib/server/safety-desk';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(req, async (user) => {
    if (action === 'queue') return listDeskQueue(user.uid);
    if (action === 'rota') return readRota(user.uid);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'rota') return saveRota(user.uid, body);
    if (action === 'assign') return assignDeskCase(user.uid, str(body.ticketId), str(body.assigneeUid), deviceFromHeaders(req.headers));
    if (action === 'submit') return submitDeskAlert(user.uid, body);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
