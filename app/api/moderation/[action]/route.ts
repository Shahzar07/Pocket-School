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
    if (action === 'appeal') {
      const { appealRemoval } = await import('@/lib/server/et-moderation');
      return appealRemoval(user.uid, str(body.queueId), str(body.note));
    }
    if (action === 'appeal-resolve') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can resolve an appeal.');
      const { resolveAppeal } = await import('@/lib/server/et-moderation');
      return resolveAppeal(user.uid, str(body.appealId), body.restore === true);
    }
    if (action === 'acknowledge') {
      const { acknowledgeAlert } = await import('@/lib/server/et-moderation');
      return acknowledgeAlert(user.uid, str(body.alertId));
    }
    if (action === 'case-note') {
      const { addCaseNote } = await import('@/lib/server/et-moderation');
      return addCaseNote(user.uid, str(body.caseId), str(body.note));
    }
    if (action === 'case-status') {
      const { setCaseStatus } = await import('@/lib/server/et-moderation');
      return setCaseStatus(user.uid, str(body.caseId), str(body.status), str(body.outcome));
    }
    if (action === 'false-positive') {
      const { recordFalsePositive } = await import('@/lib/server/et-moderation');
      return recordFalsePositive(user.uid, str(body.queueId));
    }
    if (action === 'escalate') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can run escalation.');
      const { escalateUnacked } = await import('@/lib/server/et-moderation');
      return escalateUnacked();
    }
    if (action === 'purge') {
      if (!(await callerIsAdmin(user.uid, user.email, user))) throw new ActionError('FORBIDDEN', 'Only an admin can purge the audit log.');
      const { purgeAudit } = await import('@/lib/server/et-moderation');
      return purgeAudit();
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
    if (action === 'case') {
      const { caseFile } = await import('@/lib/server/et-moderation');
      return caseFile(user.uid, _req.nextUrl.searchParams.get('id') ?? '');
    }
    if (action === 'case-pdf') {
      const { exportCasePdf } = await import('@/lib/server/et-moderation');
      return exportCasePdf(user.uid, _req.nextUrl.searchParams.get('id') ?? '');
    }
    throw new ActionError('NOT_FOUND', 'Unknown action.');
  });
}
