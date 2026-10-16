import { NextRequest } from 'next/server';
import { callerIsAdmin } from '@/lib/api-guard';
import { roleForServerCheck } from '@/lib/admin-access';
import { runGet, runPost } from '@/lib/server/http';
import { ActionError } from '@/lib/server/actions';
import { allocateResource, createResource, listResources, moderateResource, submitResource } from '@/lib/server/scope-c';

export const dynamic = 'force-dynamic';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runPost(req, async (user, body) => {
    if (action === 'resources') return createResource(user.uid, {
      kind: str(body.kind), title: str(body.title), body: str(body.body), priceCents: Number(body.priceCents) || 0,
      audiences: body.audiences,
    });
    if (action === 'submit') return submitResource(user.uid, str(body.resourceId));
    if (action === 'moderate') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can approve a resource.');
      return moderateResource(user.uid, str(body.resourceId), body.approve === true);
    }
    if (action === 'allocate') {
      const role = roleForServerCheck(user, '');
      if (role && role !== 'admin' && role !== 'institution_admin') {
        throw new ActionError('FORBIDDEN', 'Only an admin can allocate a resource.');
      }
      return allocateResource(user.uid, str(body.resourceId), str(body.studentId));
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return runGet(_req, async (user) => {
    if (action === 'resources') return listResources(user.uid);
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
