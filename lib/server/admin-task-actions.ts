/**
 * Bulk workflow and the registration quick action.
 * Approving a registration updates the join request, then the task closes with it.
 */
import 'server-only';
import { type DeskActor } from '../admin/desk';
import { resolutionProblem } from '../admin/tasks';
import type { AdminTask } from '../admin/tasks';
import { ActionError } from './actions';
import { actOnAdminTask, visibleAdminTask } from './admin-tasks';
import { decideInstitutionMembership } from './institution-membership-api';

const JOIN = /^institutions\/([^/]+)\/join_requests\/([^/]+)$/;

async function registrationDecision(
  actor: DeskActor,
  taskId: string,
  decision: 'approved' | 'rejected',
  reason: string,
): Promise<AdminTask> {
  const task = await visibleAdminTask(actor, taskId);
  if (task.type !== 'registration' && task.type !== 'teacher_verification') {
    throw new ActionError('BAD_REQUEST', 'That task is not a registration.');
  }
  const match = JOIN.exec(task.entityPath);
  if (!match) throw new ActionError('BAD_REQUEST', 'That registration is not linked to a join request.');
  if (decision === 'rejected') {
    const problem = resolutionProblem('reject', reason);
    if (problem) throw new ActionError('BAD_REQUEST', problem);
  }
  try {
    await decideInstitutionMembership({
      actorId: actor.uid,
      institutionId: match[1] ?? '',
      userId: match[2] ?? '',
      decision,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That registration could not be updated.';
    if (message === 'This request has already been decided.') {
      return visibleAdminTask(actor, taskId);
    }
    throw new ActionError('BAD_REQUEST', message);
  }
  return visibleAdminTask(actor, taskId);
}

export async function actOnOneAdminTask(
  actor: DeskActor,
  email: string,
  input: { id: string; action: string; reason?: string; snoozedUntil?: number },
): Promise<AdminTask> {
  if (input.action === 'approve_registration') {
    return registrationDecision(actor, input.id, 'approved', '');
  }
  if (input.action === 'reject_registration') {
    return registrationDecision(actor, input.id, 'rejected', input.reason ?? '');
  }
  return actOnAdminTask(actor, email, input);
}

export async function actOnManyAdminTasks(
  actor: DeskActor,
  email: string,
  input: { ids: string[]; action: string; reason?: string; snoozedUntil?: number },
): Promise<{ tasks: AdminTask[]; failures: Array<{ id: string; error: string }> }> {
  const tasks: AdminTask[] = [];
  const failures: Array<{ id: string; error: string }> = [];
  for (const id of input.ids.slice(0, 40)) {
    try {
      tasks.push(await actOnOneAdminTask(actor, email, { ...input, id }));
    } catch (error) {
      failures.push({
        id,
        error: error instanceof Error ? error.message : 'That action did not save.',
      });
    }
  }
  return { tasks, failures };
}
