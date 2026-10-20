/**
 * Server writes for admin_tasks. Clients do not create these documents.
 * The API is the path that also appends admin_audit. Admin SDK bypasses
 * rules, so the reason check is repeated here before the write.
 */
import 'server-only';
import { type Firestore } from 'firebase-admin/firestore';
import { adminDb, isAdminConfigured } from '../firebase-admin';
import { canOpenDesk, isSuperDesk, type DeskActor } from '../admin/desk';
import {
  ADMIN_TASKS,
  adminInTaskScope,
  adminPushPrefsPath,
  androidChannel,
  buildAdminTask,
  digestDue,
  emailAllowed,
  inQuietHours,
  parseAdminTask,
  presentTask,
  pushDecision,
  pushData,
  readAdminPushPrefs,
  resolutionProblem,
  sortTasks,
  withResolution,
  type AdminPushPrefs,
  type AdminTask,
  type AdminTaskPriority,
  type AdminTaskScope,
  type AdminTaskType,
  type ResolutionAction,
} from '../admin/tasks';
import { sendMail } from '../mail';
import { sendPush, type PushCategory } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { ActionError } from './actions';

const MAX_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function db(): Firestore {
  return adminDb();
}

function scopeOf(actor: DeskActor) {
  return {
    role: actor.role,
    adminRole: actor.staffRole,
    institutionId: actor.institutionId,
    region: actor.region,
  };
}

function canSee(actor: DeskActor, scope: AdminTaskScope): boolean {
  return adminInTaskScope(scopeOf(actor), scope);
}

async function audit(actor: DeskActor, email: string, action: string, taskId: string, before: Record<string, unknown>, after: Record<string, unknown>): Promise<void> {
  await db().collection('admin_audit').add({
    actorId: actor.uid,
    actorEmail: email,
    action,
    targetId: taskId,
    at: Date.now(),
    before,
    after,
  });
}

async function fanout(task: AdminTask, now: number): Promise<void> {
  const channel = androidChannel(task);
  const payload = pushData(task);
  const [admins, supers] = await Promise.all([
    db().collection('users').where('role', '==', 'admin').limit(200).get(),
    db().collection('users').where('adminRole', '==', 'super_admin').limit(50).get(),
  ]);
  const seen = new Set<string>();
  const people = [...admins.docs, ...supers.docs];
  for (const person of people) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    const data = person.data();
    const admin = {
      role: typeof data.role === 'string' ? data.role : '',
      adminRole: typeof data.adminRole === 'string' ? data.adminRole : '',
      institutionId: typeof data.institutionId === 'string' ? data.institutionId : '',
      region: typeof data.region === 'string' ? data.region : (typeof data.state === 'string' ? data.state : ''),
    };
    if (!adminInTaskScope(admin, task.scope)) continue;
    const prefsSnap = await db().doc(adminPushPrefsPath(person.id)).get();
    const prefs = readAdminPushPrefs(prefsSnap.exists ? prefsSnap.data() : null);
    const decision = pushDecision(prefs, channel, now);
    const category: PushCategory = channel === 'emergency' ? 'emergency' : 'admin';
    const address = typeof data.email === 'string' ? data.email : '';
    const accountEmailOn = !(data.notificationPrefs && typeof data.notificationPrefs === 'object' && (data.notificationPrefs as { email?: boolean }).email === false);
    if (address && emailAllowed(accountEmailOn, prefs, channel, now)) {
      const mailed = await sendMail({
        to: address,
        subject: payload.title,
        text: `${task.summary || 'An admin task is waiting.'}\n${payload.deepLink}`,
      }).catch(() => ({ sent: false as const, reason: 'provider' }));
      if (!mailed.sent && mailed.reason !== 'not_configured') {
        console.error('admin task email skipped', mailed.reason);
      }
    }
    if (decision !== 'send') continue;
    await sendPush({
      recipientUid: person.id,
      category,
      title: payload.title,
      body: task.summary || 'An admin task is waiting.',
      link: payload.deepLink,
      channelId: channel,
      data: payload,
      force: channel === 'emergency',
      sound: channel === 'emergency' ? 'default' : undefined,
    }, { store: adminPushStore(), send: sendToDevice });
  }
}

export async function openAdminTask(input: {
  type: AdminTaskType;
  entityType: string;
  entityPath: string;
  title: string;
  summary: string;
  priority: AdminTaskPriority;
  slaTier?: AdminTaskPriority;
  scope?: AdminTaskScope;
  now?: number;
}): Promise<string | null> {
  if (!isAdminConfigured()) return null;
  const now = input.now ?? Date.now();
  const task = buildAdminTask({ ...input, now });
  const ref = db().collection(ADMIN_TASKS).doc(task.id);
  const existing = await ref.get();
  if (existing.exists) return task.id;
  await ref.set(task);
  try {
    await fanout(task, now);
  } catch (error) {
    console.error('admin task push failed', error);
  }
  return task.id;
}

/** A failed task write must not fail the source document. */
export async function rememberAdminTask(input: Parameters<typeof openAdminTask>[0]): Promise<void> {
  try {
    await openAdminTask(input);
  } catch (error) {
    console.error('admin task open failed', error);
  }
}

export async function listAdminTasks(actor: DeskActor, now = Date.now()): Promise<AdminTask[]> {
  if (!isAdminConfigured() || !canOpenDesk(actor)) return [];
  const { syncPendingAdminTasks } = await import('./admin-task-sync');
  await syncPendingAdminTasks().catch(error => {
    console.error('admin task sync failed', error instanceof Error ? error.message : error);
  });
  const snap = await db().collection(ADMIN_TASKS).where('status', 'in', ['open', 'claimed', 'snoozed']).limit(100).get();
  const tasks = snap.docs
    .map(doc => parseAdminTask(doc.id, doc.data()))
    .filter((task): task is AdminTask => task !== null)
    .filter(task => canSee(actor, task.scope))
    .map(task => presentTask(task, actor));
  return sortTasks(tasks, now);
}

export async function visibleAdminTask(actor: DeskActor, id: string): Promise<AdminTask> {
  const snap = await db().collection(ADMIN_TASKS).doc(id).get();
  const task = snap.exists ? parseAdminTask(snap.id, snap.data()) : null;
  if (!task) throw new ActionError('NOT_FOUND', 'That task was not found.');
  if (!canSee(actor, task.scope)) throw new ActionError('FORBIDDEN', 'That task is outside your institution or region.');
  return task;
}

function assertOpen(task: AdminTask): void {
  if (task.status === 'done' || task.status === 'dismissed') {
    throw new ActionError('BAD_REQUEST', 'That task is already resolved.');
  }
}

export async function actOnAdminTask(
  actor: DeskActor,
  email: string,
  input: { id: string; action: string; reason?: string; snoozedUntil?: number },
  now = Date.now(),
): Promise<AdminTask> {
  if (!isAdminConfigured()) throw new ActionError('BAD_REQUEST', 'The admin task list is coming soon.');
  if (!canOpenDesk(actor)) throw new ActionError('FORBIDDEN', 'This account cannot use the Action Centre.');
  const task = await visibleAdminTask(actor, input.id);
  assertOpen(task);
  if (task.claimedBy && task.claimedBy !== actor.uid && !isSuperDesk(actor) && input.action !== 'claim') {
    throw new ActionError('FORBIDDEN', 'Another admin has claimed this task.');
  }

  let next = task;
  if (input.action === 'claim') {
    next = { ...task, status: 'claimed', claimedBy: actor.uid, claimedAt: now, snoozedUntil: null };
  } else if (input.action === 'unsnooze') {
    next = { ...task, status: task.claimedBy ? 'claimed' : 'open', snoozedUntil: null };
  } else if (input.action === 'snooze') {
    const until = input.snoozedUntil;
    if (typeof until !== 'number' || until <= now || until > now + MAX_SNOOZE_MS) {
      throw new ActionError('BAD_REQUEST', 'Snooze until a time in the next 7 days.');
    }
    next = { ...task, status: 'snoozed', snoozedUntil: until };
  } else if (input.action === 'done' || input.action === 'dismiss' || input.action === 'reject') {
    const action = input.action as ResolutionAction;
    const reason = (input.reason ?? '').trim();
    const problem = resolutionProblem(action, reason);
    if (problem) throw new ActionError('BAD_REQUEST', problem);
    next = withResolution(task, { action, reason, by: actor.uid, at: now }, action === 'done' ? 'done' : 'dismissed');
    next = { ...next, snoozedUntil: null };
  } else {
    throw new ActionError('BAD_REQUEST', 'Choose claim, snooze, done, dismiss, or reject.');
  }

  await db().collection(ADMIN_TASKS).doc(task.id).set(next);
  await audit(actor, email, `admin_task.${input.action}`, task.id, { status: task.status }, {
    status: next.status,
    resolution: next.resolution,
  });
  return presentTask(next, actor);
}

export async function resolveAdminTasksForPath(input: {
  entityPath: string;
  action: 'done' | 'dismiss' | 'reject';
  by: string;
  reason: string;
  now?: number;
}): Promise<number> {
  if (!isAdminConfigured()) return 0;
  const now = input.now ?? Date.now();
  if (resolutionProblem(input.action, input.reason)) return 0;
  const snap = await db().collection(ADMIN_TASKS).where('entityPath', '==', input.entityPath).limit(20).get();
  let count = 0;
  for (const doc of snap.docs) {
    const task = parseAdminTask(doc.id, doc.data());
    if (!task || task.status === 'done' || task.status === 'dismissed') continue;
    const next = withResolution(
      { ...task, snoozedUntil: null },
      { action: input.action, reason: input.reason.trim(), by: input.by, at: now },
      input.action === 'done' ? 'done' : 'dismissed',
    );
    await doc.ref.set(next);
    await db().collection('admin_audit').add({
      actorId: input.by,
      actorEmail: '',
      action: `admin_task.${input.action}`,
      targetId: task.id,
      at: now,
      before: { status: task.status },
      after: { status: next.status, resolution: next.resolution, entityPath: input.entityPath },
    });
    count += 1;
  }
  return count;
}

export async function finishAdminTask(entityPath: string, by: string, action: 'done' | 'dismiss' | 'reject', reason = ''): Promise<void> {
  try {
    await resolveAdminTasksForPath({ entityPath, action, by, reason });
  } catch (error) {
    console.error('admin task resolve failed', error);
  }
}

export async function reopenAdminTask(entityPath: string): Promise<void> {
  try {
    if (!isAdminConfigured()) return;
    const snap = await db().collection(ADMIN_TASKS).where('entityPath', '==', entityPath).limit(20).get();
    for (const doc of snap.docs) {
      const task = parseAdminTask(doc.id, doc.data());
      if (!task || task.status !== 'done' || task.resolution?.action !== 'done') continue;
      const next = withResolution({ ...task, snoozedUntil: null }, null, task.claimedBy ? 'claimed' : 'open');
      await doc.ref.set(next);
    }
  } catch (error) {
    console.error('admin task reopen failed', error);
  }
}

export async function readStoredAdminPushPrefs(uid: string): Promise<AdminPushPrefs> {
  if (!isAdminConfigured()) return readAdminPushPrefs(null);
  const snap = await db().doc(adminPushPrefsPath(uid)).get();
  return readAdminPushPrefs(snap.exists ? snap.data() : null);
}

export async function saveAdminPushPrefs(uid: string, raw: unknown): Promise<AdminPushPrefs> {
  if (!isAdminConfigured()) throw new ActionError('BAD_REQUEST', 'Notification preferences are coming soon.');
  const incoming = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  delete incoming.lastDigestAt;
  const prefs = readAdminPushPrefs(incoming);
  const ref = db().doc(adminPushPrefsPath(uid));
  const existing = await ref.get();
  const lastDigestAt = existing.get('lastDigestAt');
  const stored: AdminPushPrefs = { ...prefs };
  if (typeof lastDigestAt === 'number') stored.lastDigestAt = lastDigestAt;
  else delete stored.lastDigestAt;
  await ref.set(stored);
  return readAdminPushPrefs(stored);
}

export async function runAdminTaskCron(now = Date.now()): Promise<{ unsnoozed: number; digests: number; opened: number; closed: number }> {
  if (!isAdminConfigured()) return { unsnoozed: 0, digests: 0, opened: 0, closed: 0 };
  const { syncPendingAdminTasks } = await import('./admin-task-sync');
  const synced = await syncPendingAdminTasks(true).catch(() => ({ opened: 0, closed: 0 }));
  const snoozed = await db().collection(ADMIN_TASKS).where('status', '==', 'snoozed').limit(200).get();
  let unsnoozed = 0;
  for (const doc of snoozed.docs) {
    const until = doc.get('snoozedUntil');
    if (typeof until !== 'number' || until > now) continue;
    const claimedBy = typeof doc.get('claimedBy') === 'string' ? doc.get('claimedBy') : '';
    await doc.ref.set({ status: claimedBy ? 'claimed' : 'open', snoozedUntil: null }, { merge: true });
    unsnoozed += 1;
  }

  const admins = await db().collection('users').where('role', '==', 'admin').limit(200).get();
  let digests = 0;
  for (const admin of admins.docs) {
    const ref = db().doc(adminPushPrefsPath(admin.id));
    const snap = await ref.get();
    const prefs = readAdminPushPrefs(snap.exists ? snap.data() : null);
    if (!digestDue(prefs, now) || inQuietHours(prefs, now)) continue;
    const data = admin.data();
    const actor: DeskActor = {
      uid: admin.id,
      role: typeof data.role === 'string' ? data.role : 'admin',
      staffRole: data.adminRole === 'super_admin' ? 'super_admin' : 'admin',
      institutionId: typeof data.institutionId === 'string' ? data.institutionId : '',
      region: typeof data.region === 'string' ? data.region : '',
      country: typeof data.country === 'string' ? data.country : '',
      staffPost: typeof data.staffPost === 'string' ? data.staffPost : '',
    };
    const tasks = await listAdminTasks(actor, now);
    const first = tasks[0];
    if (first) {
      const payload = pushData(first);
      await sendPush({
        recipientUid: admin.id,
        category: 'admin',
        title: 'Admin tasks',
        body: tasks.length === 1 ? '1 admin task is waiting.' : `${tasks.length} admin tasks are waiting.`,
        link: '/dashboard/admin/tasks',
        channelId: 'admin',
        data: { ...payload, title: 'Admin tasks', deepLink: '/dashboard/admin/tasks' },
      }, { store: adminPushStore(), send: sendToDevice });
      digests += 1;
    }
    await ref.set({ lastDigestAt: now }, { merge: true });
  }
  return { unsnoozed, digests, opened: synced.opened, closed: synced.closed };
}
