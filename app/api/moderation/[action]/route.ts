import { NextRequest } from 'next/server';
import { callerIsAdmin } from '@/lib/api-guard';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { listQueue, resolveQueue } from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'resolve') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can resolve the queue.');
      return resolveQueue(user.uid, str(body.itemId), body.approve === true);
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(_req, async (user) => {
    if (action === 'queue') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can open the queue.');
      return listQueue(user.uid);
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
