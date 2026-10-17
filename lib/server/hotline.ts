/**
 * Parent-to-school hotline. Client writes are denied. The scheduled
 * escalate path is POST /api/cron/hotline.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { ActionError } from './actions';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import {
  DEFAULT_WORK,
  escalationTarget,
  isHotlineCategory,
  isHotlineStatus,
  isSensitiveCategory,
  kivReady,
  canReopen,
  reopenUntil,
  routeAddress,
  slaDueAt,
  staffCanSee,
  summariseHotline,
  type HotlineCategory,
  type HotlinePriority,
  type HotlineStatus,
  type TicketStat,
  type WorkCalendar,
} from '../hotline/policy';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

interface Actor {
  id: string;
  role: string;
  name: string;
  institutionId: string;
  childIds: string[];
  staffPost: string;
}

async function loadActor(uid: string): Promise<Actor> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = snap.data() ?? {};
  const childIds = Array.isArray(data.childIds) ? data.childIds.filter((id): id is string => typeof id === 'string') : [];
  return {
    id: uid,
    role: str(data.role) || 'student',
    name: str(data.name) || 'Member',
    institutionId: str(data.institutionId),
    childIds,
    staffPost: str(data.staffPost),
  };
}

async function calendarFor(institutionId: string): Promise<WorkCalendar> {
  if (!institutionId) return DEFAULT_WORK;
  const snap = await db().doc(`institutions/${institutionId}`).get();
  const data = snap.data() ?? {};
  const holidays = Array.isArray(data.holidays) ? data.holidays.filter((day): day is string => typeof day === 'string') : [];
  const start = typeof data.workStartMinutes === 'number' ? data.workStartMinutes : DEFAULT_WORK.startMinutes;
  const end = typeof data.workEndMinutes === 'number' ? data.workEndMinutes : DEFAULT_WORK.endMinutes;
  return {
    timezone: str(data.timezone) || DEFAULT_WORK.timezone,
    workingDays: DEFAULT_WORK.workingDays,
    startMinutes: start,
    endMinutes: end > start ? end : DEFAULT_WORK.endMinutes,
    holidays,
  };
}

async function notify(uid: string, title: string, body: string, link: string) {
  if (!uid) return;
  await sendPush(
    { recipientUid: uid, category: 'hotline', title, body, link },
    { store: adminPushStore(), send: sendToDevice },
  );
}

function parentOwns(actor: Actor, studentId: string): boolean {
  return actor.role === 'parent' && actor.childIds.includes(studentId);
}

export async function createTicket(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const studentId = str(input.studentId);
  const category = str(input.category);
  const body = str(input.body).slice(0, 4000);
  const priority = str(input.priority) as HotlinePriority;
  if (!parentOwns(actor, studentId)) throw new ActionError('FORBIDDEN', 'A parent opens a hotline ticket for their own child.');
  if (!isHotlineCategory(category)) throw new ActionError('BAD_REQUEST', 'Choose a category.');
  if (priority !== 'low' && priority !== 'medium' && priority !== 'high') {
    throw new ActionError('BAD_REQUEST', 'Choose a priority.');
  }
  if (body.length < 3) throw new ActionError('BAD_REQUEST', 'Describe what the school should know.');
  const student = await db().doc(`users/${studentId}`).get();
  const institutionId = str(student.data()?.institutionId) || actor.institutionId;
  if (!institutionId) throw new ActionError('BAD_REQUEST', 'This child is not linked to a school.');
  const calendar = await calendarFor(institutionId);
  const now = Date.now();
  const addressedTo = routeAddress(str(input.addressedTo), category);
  const ref = db().collection('hotline_tickets').doc();
  let safeguardingCaseId = '';
  if (isSensitiveCategory(category)) {
    const caseRef = db().collection('safeguarding_cases').doc();
    safeguardingCaseId = caseRef.id;
    await caseRef.set({
      source: 'hotline',
      ticketId: ref.id,
      institutionId,
      studentId,
      status: 'open',
      createdAt: now,
    });
  }
  const ticket = {
    institutionId,
    studentId,
    parentUid: actor.id,
    addressedTo,
    assigneeUid: '',
    category,
    priority,
    status: 'pending' as HotlineStatus,
    kivReason: '',
    kivFollowUpAt: 0,
    slaDueAt: slaDueAt(now, priority, calendar),
    escalationLevel: 0,
    reopenUntil: 0,
    solvedAt: 0,
    satisfaction: null,
    body,
    safeguardingCaseId,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(ticket);
  await ref.collection('events').add({ kind: 'created', actorId: actor.id, at: now, detail: category });
  return { id: ref.id, addressedTo, slaDueAt: ticket.slaDueAt, safeguardingCaseId };
}

async function loadTicket(id: string) {
  const snap = await db().doc(`hotline_tickets/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Ticket not found.');
  return { id: snap.id, data: snap.data() ?? {} };
}

function canRead(actor: Actor, data: FirebaseFirestore.DocumentData): boolean {
  if (data.parentUid === actor.id) return true;
  if (data.institutionId !== actor.institutionId && actor.role !== 'admin') return false;
  return staffCanSee(actor.role, actor.staffPost, str(data.category));
}

export async function listTickets(uid: string, status: string) {
  const actor = await loadActor(uid);
  const query = actor.role === 'parent'
    ? db().collection('hotline_tickets').where('parentUid', '==', actor.id).limit(50)
    : db().collection('hotline_tickets').where('institutionId', '==', actor.institutionId).limit(80);
  const snap = await query.get();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as FirebaseFirestore.DocumentData & { id: string })
    .filter(row => canRead(actor, row))
    .filter(row => !status || row.status === status);
}

export async function getTicket(uid: string, id: string) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!canRead(actor, ticket.data)) throw new ActionError('FORBIDDEN', 'You cannot open this ticket.');
  const [comments, events] = await Promise.all([
    ticket.id ? db().collection(`hotline_tickets/${id}/comments`).orderBy('at', 'asc').limit(100).get() : Promise.resolve(null),
    db().collection(`hotline_tickets/${id}/events`).orderBy('at', 'asc').limit(100).get(),
  ]);
  const staff = actor.role !== 'parent';
  return {
    id,
    ...ticket.data,
    comments: (comments?.docs ?? [])
      .map(doc => ({ id: doc.id, ...doc.data() }) as FirebaseFirestore.DocumentData & { id: string })
      .filter(row => staff || row.internal !== true),
    events: events.docs.map(doc => ({ id: doc.id, ...doc.data() })),
  };
}

export async function commentTicket(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!canRead(actor, ticket.data)) throw new ActionError('FORBIDDEN', 'You cannot comment on this ticket.');
  const text = str(input.body).slice(0, 4000);
  if (text.length < 1) throw new ActionError('BAD_REQUEST', 'Write a comment.');
  const internal = input.internal === true && actor.role !== 'parent';
  const now = Date.now();
  const ref = await db().collection(`hotline_tickets/${id}/comments`).add({
    authorId: actor.id,
    authorName: actor.name,
    body: text,
    internal,
    parentId: str(input.parentId),
    at: now,
  });
  await db().doc(`hotline_tickets/${id}`).set({ updatedAt: now }, { merge: true });
  if (!internal && actor.role !== 'parent') {
    await notify(str(ticket.data.parentUid), 'The school replied', 'Open the hotline for the latest note.', `/dashboard/parent/hotline`);
  }
  return { id: ref.id };
}

export async function assignTicket(uid: string, id: string, assigneeUid: string) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!staffCanSee(actor.role, actor.staffPost, str(ticket.data.category))) {
    throw new ActionError('FORBIDDEN', 'You cannot assign this ticket.');
  }
  const now = Date.now();
  await db().doc(`hotline_tickets/${id}`).set({ assigneeUid, updatedAt: now }, { merge: true });
  await db().collection(`hotline_tickets/${id}/events`).add({ kind: 'assigned', actorId: actor.id, at: now, detail: assigneeUid });
  await notify(assigneeUid, 'A hotline ticket is yours', str(ticket.data.category), `/dashboard/teacher/hotline`);
  return { ok: true };
}

export async function setTicketStatus(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!staffCanSee(actor.role, actor.staffPost, str(ticket.data.category))) {
    throw new ActionError('FORBIDDEN', 'You cannot change this ticket.');
  }
  const status = str(input.status);
  if (!isHotlineStatus(status)) throw new ActionError('BAD_REQUEST', 'Choose a status.');
  const now = Date.now();
  const patch: Record<string, unknown> = { status, updatedAt: now };
  if (status === 'kiv') {
    const followUpAt = Number(input.kivFollowUpAt);
    const reason = str(input.kivReason);
    const problem = kivReady(reason, followUpAt, now);
    if (problem) throw new ActionError('BAD_REQUEST', problem);
    patch.kivReason = reason;
    patch.kivFollowUpAt = followUpAt;
  }
  if (status === 'solved') {
    patch.solvedAt = now;
    patch.reopenUntil = reopenUntil(now);
  }
  await db().doc(`hotline_tickets/${id}`).set(patch, { merge: true });
  await db().collection(`hotline_tickets/${id}/events`).add({ kind: 'status_change', actorId: actor.id, at: now, detail: status });
  await notify(str(ticket.data.parentUid), 'Hotline update', `Status: ${status.replace('_', ' ')}`, '/dashboard/parent/hotline');
  return { ok: true };
}

export async function reopenTicket(uid: string, id: string) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (ticket.data.parentUid !== actor.id && actor.role !== 'admin') {
    throw new ActionError('FORBIDDEN', 'The parent can reopen this ticket.');
  }
  const solvedAt = Number(ticket.data.solvedAt) || null;
  if (!canReopen(str(ticket.data.status), solvedAt, Date.now())) {
    throw new ActionError('BAD_REQUEST', 'Reopening is open for 7 days after a ticket is solved.');
  }
  const now = Date.now();
  await db().doc(`hotline_tickets/${id}`).set({ status: 'pending', updatedAt: now }, { merge: true });
  await db().collection(`hotline_tickets/${id}/events`).add({ kind: 'reopened', actorId: actor.id, at: now, detail: '' });
  return { ok: true };
}

export async function rateTicket(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (ticket.data.parentUid !== actor.id) throw new ActionError('FORBIDDEN', 'The parent rates this ticket.');
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ActionError('BAD_REQUEST', 'Rate from 1 to 5.');
  const now = Date.now();
  const satisfaction = { rating, comment: str(input.comment).slice(0, 500) };
  await db().doc(`hotline_tickets/${id}`).set({ satisfaction, updatedAt: now }, { merge: true });
  await db().collection(`hotline_tickets/${id}/events`).add({ kind: 'rated', actorId: actor.id, at: now, detail: String(rating) });
  return { ok: true };
}

export async function hotlineAnalytics(uid: string) {
  const actor = await loadActor(uid);
  if (actor.role !== 'admin' && actor.role !== 'institution_admin' && actor.staffPost !== 'principal') {
    throw new ActionError('FORBIDDEN', 'School leads can see hotline analytics.');
  }
  const snap = await db().collection('hotline_tickets').where('institutionId', '==', actor.institutionId).limit(400).get();
  const rows: TicketStat[] = snap.docs
    .map(doc => doc.data())
    .filter(data => staffCanSee(actor.role, actor.staffPost, str(data.category)))
    .map(data => ({
      category: str(data.category),
      status: str(data.status),
      createdAt: Number(data.createdAt) || 0,
      solvedAt: Number(data.solvedAt) || null,
      slaDueAt: Number(data.slaDueAt) || 0,
      rating: typeof (data.satisfaction as { rating?: number } | null)?.rating === 'number'
        ? (data.satisfaction as { rating: number }).rating
        : null,
    }));
  return summariseHotline(rows, Date.now());
}

export async function escalateDueTickets(now = Date.now()) {
  const snap = await db().collection('hotline_tickets').where('status', 'in', ['pending', 'in_progress']).limit(100).get();
  let escalated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (Number(data.slaDueAt) >= now) continue;
    const level = Number(data.escalationLevel) || 0;
    const next = escalationTarget(level, isSensitiveCategory(str(data.category)));
    if (!next) continue;
    await doc.ref.set({ addressedTo: next, escalationLevel: level + 1, updatedAt: now }, { merge: true });
    await doc.ref.collection('events').add({ kind: 'escalated', actorId: 'system', at: now, detail: next });
    const staff = await db().collection('users')
      .where('institutionId', '==', str(data.institutionId))
      .limit(40)
      .get();
    for (const person of staff.docs.filter(doc => str(doc.data().staffPost) === next).slice(0, 10)) {
      await notify(person.id, 'Hotline ticket is overdue', `Escalated to ${next.replace('_', ' ')}.`, '/dashboard/teacher/hotline');
    }
    escalated += 1;
  }
  return { escalated };
}

export type { HotlineCategory };
