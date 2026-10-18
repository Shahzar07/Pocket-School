/**
 * Poket SafeLine, the parent-to-school line. Client writes are denied. The scheduled
 * escalate path is POST /api/cron/hotline.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { ActionError } from './actions';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import {
  applyAuthorityUpdate,
  authorityOverdue,
  canCloseTicket,
  initialAuthorities,
  TICKET_AUTHORITY_REMINDER_MS,
  type AuthorityDecision,
} from '../authorities/policy';
import { authorityCloseMessage } from '../bullying/authority-referral';
import { canViewAttachment, hotlineStoragePath, isAttachmentLabel } from '../attachments/policy';
import { prepareAttachment } from '../attachments/prepare';
import { bytesFromBase64, imagePass, saveObject, signedRead } from './files';
import {
  GENESIS,
  canManageLegalHold,
  emptyLegalHold,
  internalRedactionBlocked,
  type ChainDevice,
  type ChainDiff,
  type LegalHold,
} from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { exportCsv, exportPdf, type ExportFile } from '../ledger/export';
import { appendChain, readChain, verifyStoredChain } from './ledger';
import { resolveRecipients } from '../alerts/recipients';
import { peopleAtInstitution } from './alert-directory';
import { notifyTicketStaff } from './staff-notify';
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
import { isSafetySource, safetyView, trackerFor, type SafetyView } from '../safety/policy';
import { parentAlertAllowed, readVerification, staffCaseAllowed } from '../verification/policy';

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
  tier: number;
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
    tier: readVerification(data.verification).tier,
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

function deviceOf(input: Record<string, unknown> | undefined): ChainDevice {
  const raw = input?.device;
  if (!raw || typeof raw !== 'object') return SERVER_DEVICE;
  const device = raw as Partial<ChainDevice>;
  if (typeof device.platform !== 'string' || typeof device.appVersion !== 'string' || typeof device.ipHash !== 'string') {
    return SERVER_DEVICE;
  }
  return { platform: device.platform.slice(0, 40), appVersion: device.appVersion.slice(0, 40), ipHash: device.ipHash };
}

async function logEvent(
  ticketId: string,
  actor: { id: string; role: string },
  action: string,
  diff: ChainDiff,
  device: ChainDevice = SERVER_DEVICE,
) {
  await appendChain({
    parentPath: `hotline_tickets/${ticketId}`,
    collection: 'events',
    actorUid: actor.id,
    actorRole: actor.role,
    action,
    diff,
    device,
  });
}

function schoolLead(actor: Actor): boolean {
  return actor.role === 'admin' || actor.role === 'institution_admin' || actor.staffPost === 'principal';
}

export async function createTicket(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const studentId = str(input.studentId);
  const rawCategory = str(input.category) === 'fees_billing' ? 'fees' : str(input.category);
  const category = rawCategory;
  const body = str(input.body).slice(0, 4000);
  const priority = str(input.priority) as HotlinePriority;
  if (!parentOwns(actor, studentId)) throw new ActionError('FORBIDDEN', 'A parent opens a SafeLine ticket for their own child.');
  if (!isHotlineCategory(category)) throw new ActionError('BAD_REQUEST', 'Choose a category.');
  if (priority !== 'low' && priority !== 'medium' && priority !== 'high') {
    throw new ActionError('BAD_REQUEST', 'Choose a priority.');
  }
  if (body.length < 3) throw new ActionError('BAD_REQUEST', 'Describe what the school should know.');
  const authority = input.authority && typeof input.authority === 'object' ? input.authority as Record<string, unknown> : null;
  const authorities = initialAuthorities(
    str(input.authoritiesRequired) || str(authority?.required) || 'unsure',
    str(input.authoritiesReason) || str(authority?.reason),
  );
  if ('error' in authorities) throw new ActionError('BAD_REQUEST', authorities.error);
  const student = await db().doc(`users/${studentId}`).get();
  const institutionId = str(student.data()?.institutionId) || actor.institutionId;
  if (!institutionId) throw new ActionError('BAD_REQUEST', 'This child is not linked to a school.');
  const calendar = await calendarFor(institutionId);
  const now = Date.now();
  const addressedTo = routeAddress(str(input.addressedTo), category);
  const sensitive = isSensitiveCategory(category);
  const directory = await peopleAtInstitution(institutionId);
  const recipients = resolveRecipients({
    kind: 'hotline',
    institutionId,
    people: directory,
    addressedTo,
    sensitive,
  });
  const ref = db().collection('hotline_tickets').doc();
  let safeguardingCaseId = '';
  if (sensitive) {
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
    authorities: authorities.decision,
    authoritiesRemindedAt: 0,
    recipientUids: recipients.uids,
    chainSeq: 0,
    chainHead: GENESIS,
    legalHold: emptyLegalHold(),
    internalRedacted: false,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(ticket);
  await logEvent(ref.id, actor, 'created', {
    before: {},
    after: { category, priority, status: 'pending', addressedTo, body },
  }, deviceOf(input));
  if (category === 'safeguarding' && priority === 'high') {
    try {
      await notifyTicketStaff(ref.id);
    } catch (error) {
      console.error('staff notice failed', error);
    }
  } else {
    for (const recipient of recipients.uids) {
      await notify(recipient, 'Poket SafeLine', 'A SafeLine ticket is waiting.', '/dashboard/teacher/hotline');
    }
  }
  return { id: ref.id, addressedTo, slaDueAt: ticket.slaDueAt, safeguardingCaseId };
}

async function loadTicket(id: string) {
  const snap = await db().doc(`hotline_tickets/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Ticket not found.');
  return { id: snap.id, data: snap.data() ?? {} };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function safetyTicketView(actor: Actor, data: FirebaseFirestore.DocumentData): SafetyView | null {
  if (!isSafetySource(str(data.source))) return null;
  return safetyView(
    { id: actor.id, role: actor.role, staffPost: actor.staffPost, institutionId: actor.institutionId },
    {
      source: str(data.source),
      reporterUid: str(data.reporterUid),
      formTeacherUid: str(data.formTeacherUid),
      institutionId: str(data.institutionId),
      parentsExcluded: data.parentsExcluded === true,
      notifiedParentUids: stringList(data.notifiedParentUids),
    },
  );
}

function trackerProjection(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    source: str(data.source),
    safetyType: str(data.safetyType),
    tracker: trackerFor(str(data.status)),
    createdAt: Number(data.createdAt) || 0,
    flagged: data.flagged === true,
  };
}

function noticeProjection(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    source: str(data.source),
    safetyType: str(data.safetyType),
    studentName: str(data.reporterName),
    createdAt: Number(data.createdAt) || 0,
    tracker: trackerFor(str(data.status)),
    location: data.location && typeof data.location === 'object' ? data.location : null,
    flagged: data.flagged === true,
  };
}

function staffMay(actor: Actor, category: string): boolean {
  if (!staffCanSee(actor.role, actor.staffPost, category)) return false;
  if (isSensitiveCategory(category) && !staffCaseAllowed(actor.role, actor.tier)) return false;
  return true;
}

function tierBlockMessage(actor: Actor, data: FirebaseFirestore.DocumentData): string | null {
  const view = safetyTicketView(actor, data);
  const staffMessage = 'Verified school staff open a safeguarding case.';
  if (view === 'full' && !staffCaseAllowed(actor.role, actor.tier)) return staffMessage;
  if (view === 'notice') {
    const teacher = actor.id === str(data.formTeacherUid);
    if (teacher && !staffCaseAllowed(actor.role, actor.tier)) return staffMessage;
    if (!teacher && !parentAlertAllowed(actor.tier)) return 'A verified guardian can open this alert.';
  }
  if (view === null && isSensitiveCategory(str(data.category)) && !staffCaseAllowed(actor.role, actor.tier)) {
    return staffMessage;
  }
  return null;
}

function canRead(actor: Actor, data: FirebaseFirestore.DocumentData): boolean {
  const view = safetyTicketView(actor, data);
  if (view) return view !== 'hidden' && !tierBlockMessage(actor, data);
  if (tierBlockMessage(actor, data)) return false;
  if (data.parentUid === actor.id) return true;
  if (data.institutionId !== actor.institutionId && actor.role !== 'admin') return false;
  return staffMay(actor, str(data.category));
}

function listedRow(actor: Actor, id: string, data: FirebaseFirestore.DocumentData) {
  const view = safetyTicketView(actor, data);
  if (tierBlockMessage(actor, data)) return null;
  if (view === 'hidden') return null;
  if (view === 'tracker') return trackerProjection(id, data);
  if (view === 'notice') return noticeProjection(id, data);
  if (view === null && !canRead(actor, data)) return null;
  return { id, ...data };
}

export async function listTickets(uid: string, status: string) {
  const actor = await loadActor(uid);
  const query = actor.role === 'student'
    ? db().collection('hotline_tickets').where('reporterUid', '==', actor.id).orderBy('createdAt', 'desc').limit(30)
    : actor.role === 'parent'
      ? db().collection('hotline_tickets').where('parentUid', '==', actor.id).limit(50)
      : db().collection('hotline_tickets').where('institutionId', '==', actor.institutionId).limit(80);
  const snap = await query.get();
  return snap.docs
    .map(doc => listedRow(actor, doc.id, doc.data()))
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter(row => !status || ('status' in row && row.status === status));
}

export async function getTicket(uid: string, id: string) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  const blocked = tierBlockMessage(actor, ticket.data);
  if (blocked) throw new ActionError('FORBIDDEN', blocked);
  if (!canRead(actor, ticket.data)) throw new ActionError('FORBIDDEN', 'You cannot open this ticket.');
  const view = safetyTicketView(actor, ticket.data);
  if (view === 'tracker') return trackerProjection(id, ticket.data);
  if (view === 'notice') return noticeProjection(id, ticket.data);
  const [comments, events] = await Promise.all([
    ticket.id ? db().collection(`hotline_tickets/${id}/comments`).orderBy('at', 'asc').limit(100).get() : Promise.resolve(null),
    db().collection(`hotline_tickets/${id}/events`).orderBy('seq', 'asc').limit(200).get(),
  ]);
  const staff = actor.role !== 'parent';
  const files = await db().collection(`hotline_tickets/${id}/attachments`).limit(40).get();
  return {
    id,
    ...ticket.data,
    comments: (comments?.docs ?? [])
      .map(doc => ({ id: doc.id, ...doc.data() }) as FirebaseFirestore.DocumentData & { id: string })
      .filter(row => staff || row.internal !== true),
    attachments: files.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as FirebaseFirestore.DocumentData & { id: string })
      .filter(row => canViewAttachment(viewInput(actor, ticket.data, str(row.label), row.internal === true)))
      .map(row => ({
        id: row.id,
        label: row.label,
        internal: row.internal === true,
        kind: row.kind,
        mime: row.mime,
        commentId: row.commentId ?? '',
        at: row.at,
      })),
    events: events.docs.map(doc => ({ id: doc.id, ...doc.data() })),
  };
}

export async function commentTicket(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!canRead(actor, ticket.data)) throw new ActionError('FORBIDDEN', 'You cannot comment on this ticket.');
  if (safetyTicketView(actor, ticket.data) !== null && safetyTicketView(actor, ticket.data) !== 'full') {
    throw new ActionError('FORBIDDEN', 'Safety reports do not show a staff thread here.');
  }
  const text = str(input.body).slice(0, 4000);
  if (text.length < 1) throw new ActionError('BAD_REQUEST', 'Write a comment.');
  const internal = input.internal === true && actor.role !== 'parent' && actor.role !== 'student';
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
    await notify(str(ticket.data.parentUid), 'The school replied', 'Open SafeLine for the latest note.', `/dashboard/parent/hotline`);
  }
  return { id: ref.id };
}

export async function assignTicket(uid: string, id: string, assigneeUid: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!staffMay(actor, str(ticket.data.category))) {
    throw new ActionError('FORBIDDEN', 'You cannot assign this ticket.');
  }
  const now = Date.now();
  const previous = str(ticket.data.assigneeUid);
  await db().doc(`hotline_tickets/${id}`).set({ assigneeUid, updatedAt: now }, { merge: true });
  await logEvent(id, actor, 'assigned', {
    before: { assigneeUid: previous },
    after: { assigneeUid },
  }, device);
  await notify(assigneeUid, 'Poket SafeLine', `A SafeLine ticket is yours. ${str(ticket.data.category)}`, `/dashboard/teacher/hotline`);
  return { ok: true };
}

export async function setTicketStatus(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!staffMay(actor, str(ticket.data.category))) {
    throw new ActionError('FORBIDDEN', 'You cannot change this ticket.');
  }
  const status = str(input.status);
  if (!isHotlineStatus(status)) throw new ActionError('BAD_REQUEST', 'Choose a status.');
  const authority = (ticket.data.authorities ?? {}) as { status?: string; required?: string };
  const authorityStatus = str(authority.status);
  const closing = status === 'solved' || status === 'closed';
  const safetyBlock = authorityCloseMessage({
    source: str(ticket.data.source),
    safetyType: str(ticket.data.safetyType),
    deskSeverity: str(ticket.data.deskSeverity),
    text: `${str(ticket.data.body)} ${str(ticket.data.who)}`,
    required: str(authority.required),
    status: authorityStatus,
    closing,
  });
  if (safetyBlock) throw new ActionError('BAD_REQUEST', safetyBlock);
  if (closing && !canCloseTicket(authorityStatus)) {
    throw new ActionError('BAD_REQUEST', 'Tell the authorities, or record that they are not required, before this ticket is solved or closed.');
  }
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
  await logEvent(id, actor, 'status_change', {
    before: { status: str(ticket.data.status) },
    after: { status, kivReason: patch.kivReason ?? '', kivFollowUpAt: patch.kivFollowUpAt ?? 0 },
  }, deviceOf(input));
  await notify(str(ticket.data.parentUid), 'Poket SafeLine', `Status: ${status.replace('_', ' ')}`, '/dashboard/parent/hotline');
  return { ok: true };
}

export async function reopenTicket(uid: string, id: string, device: ChainDevice = SERVER_DEVICE) {
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
  await logEvent(id, actor, 'reopened', {
    before: { status: str(ticket.data.status) },
    after: { status: 'pending' },
  }, device);
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
  await logEvent(id, actor, 'rated', {
    before: { satisfaction: ticket.data.satisfaction ?? null },
    after: { satisfaction },
  }, deviceOf(input));
  return { ok: true };
}

export async function hotlineAnalytics(uid: string) {
  const actor = await loadActor(uid);
  if (actor.role !== 'admin' && actor.role !== 'institution_admin' && actor.staffPost !== 'principal') {
    throw new ActionError('FORBIDDEN', 'School leads can see SafeLine analytics.');
  }
  const snap = await db().collection('hotline_tickets').where('institutionId', '==', actor.institutionId).limit(400).get();
  const rows: TicketStat[] = snap.docs
    .map(doc => doc.data())
    .filter(data => staffMay(actor, str(data.category)))
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
    await logEvent(doc.id, { id: 'system', role: 'system' }, 'escalated', {
      before: { addressedTo: str(data.addressedTo), escalationLevel: level },
      after: { addressedTo: next, escalationLevel: level + 1 },
    });
    const institutionId = str(data.institutionId);
    const chain = resolveRecipients({
      kind: 'hotline',
      institutionId,
      people: await peopleAtInstitution(institutionId),
      addressedTo: next,
      sensitive: isSensitiveCategory(str(data.category)),
    });
    for (const recipient of chain.uids) {
      await notify(recipient, 'Poket SafeLine', `A SafeLine ticket is overdue. Escalated to ${next.replaceAll('_', ' ')}.`, '/dashboard/teacher/hotline');
    }
    escalated += 1;
  }
  return { escalated };
}

function viewInput(actor: Actor, data: FirebaseFirestore.DocumentData, label: string, internal: boolean) {
  return {
    role: actor.role,
    staffPost: actor.staffPost,
    actorId: actor.id,
    assigneeUid: str(data.assigneeUid),
    addressedTo: str(data.addressedTo),
    category: str(data.category),
    parentUid: str(data.parentUid),
    reporterUid: str(data.reporterUid),
    label,
    internal,
  };
}

export async function attachTicket(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!canRead(actor, ticket.data)) throw new ActionError('FORBIDDEN', 'You cannot attach a file to this ticket.');
  const label = str(input.label);
  if (!isAttachmentLabel(label)) throw new ActionError('BAD_REQUEST', 'Choose a file label.');
  const bytes = bytesFromBase64(str(input.dataBase64));
  if (!bytes) throw new ActionError('BAD_REQUEST', 'Attach the file.');
  const prepared = await prepareAttachment({ declaredMime: str(input.mime), label, bytes });
  if (!prepared.ok) throw new ActionError('BAD_REQUEST', prepared.error);
  const stored = await imagePass(prepared.file.bytes, prepared.file.mime);
  const internal = input.internal === true && actor.role !== 'parent' && actor.id !== str(ticket.data.reporterUid);
  const fileRef = db().collection(`hotline_tickets/${id}/attachments`).doc();
  const storagePath = hotlineStoragePath(str(ticket.data.institutionId), id, fileRef.id, str(input.fileName) || 'file');
  await saveObject(storagePath, stored, prepared.file.mime);
  const now = Date.now();
  await fileRef.set({
    label,
    internal,
    mime: prepared.file.mime,
    kind: prepared.file.kind,
    bytes: stored.byteLength,
    storagePath,
    fileName: str(input.fileName).slice(0, 120),
    commentId: str(input.commentId),
    uploadedBy: actor.id,
    at: now,
    scanEngine: prepared.file.scan.engine,
    scanDetail: prepared.file.scan.detail,
    exifStripped: true,
  });
  await logEvent(id, actor, 'uploaded', {
    before: {},
    after: { attachmentId: fileRef.id, label, kind: prepared.file.kind },
  }, deviceOf(input));
  return { id: fileRef.id, kind: prepared.file.kind };
}

export async function viewTicketFile(uid: string, id: string, attachmentId: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  const file = await db().doc(`hotline_tickets/${id}/attachments/${attachmentId}`).get();
  if (!file.exists) throw new ActionError('NOT_FOUND', 'File not found.');
  const data = file.data() ?? {};
  if (!canViewAttachment(viewInput(actor, ticket.data, str(data.label), data.internal === true))) {
    throw new ActionError('FORBIDDEN', 'You cannot open this file.');
  }
  const storagePath = str(data.storagePath);
  if (!storagePath) throw new ActionError('NOT_FOUND', 'This file has been removed.');
  const signed = await signedRead(storagePath);
  await logEvent(id, actor, 'viewed', {
    before: {},
    after: { attachmentId },
  }, device);
  return signed;
}

export async function setTicketAuthorities(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!staffMay(actor, str(ticket.data.category))) {
    throw new ActionError('FORBIDDEN', 'You cannot update this ticket.');
  }
  const current = (ticket.data.authorities ?? { required: 'unsure', reason: '', status: 'to_be_informed', informed: null }) as AuthorityDecision;
  const next = applyAuthorityUpdate(current, {
    status: str(input.status),
    reason: str(input.reason),
    agency: str(input.agency),
    contact: str(input.contact),
    reference: str(input.reference),
    by: actor.id,
    at: Date.now(),
  });
  if ('error' in next) throw new ActionError('BAD_REQUEST', next.error);
  const now = Date.now();
  await db().doc(`hotline_tickets/${id}`).set({
    authorities: next.decision,
    authoritiesRemindedAt: next.decision.status === 'to_be_informed' ? 0 : now,
    updatedAt: now,
  }, { merge: true });
  await logEvent(id, actor, 'authorities', {
    before: { status: str(current.status) },
    after: { status: next.decision.status, agency: next.decision.informed?.agency ?? '' },
  }, deviceOf(input));
  return { status: next.decision.status };
}

export async function remindAuthorityTickets(now = Date.now()) {
  const snap = await db().collection('hotline_tickets').where('status', 'in', ['pending', 'in_progress', 'kiv']).limit(100).get();
  let reminded = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const status = str((data.authorities as { status?: string } | undefined)?.status);
    if (!authorityOverdue(Number(data.createdAt) || 0, status, now, TICKET_AUTHORITY_REMINDER_MS, Number(data.authoritiesRemindedAt) || 0)) {
      continue;
    }
    await doc.ref.set({ authoritiesRemindedAt: now, updatedAt: now }, { merge: true });
    await logEvent(doc.id, { id: 'system', role: 'system' }, 'authority_reminder', {
      before: { authoritiesRemindedAt: Number(data.authoritiesRemindedAt) || 0 },
      after: { authoritiesRemindedAt: now },
    });
    const target = str(data.assigneeUid);
    if (target) await notify(target, 'Authorities still to be informed', 'This SafeLine ticket has waited four hours.', '/dashboard/teacher/hotline');
    reminded += 1;
  }
  return { reminded };
}

function holdOf(value: unknown): LegalHold {
  const raw = (value ?? {}) as Partial<LegalHold>;
  return {
    on: raw.on === true,
    by: str(raw.by),
    at: Number(raw.at) || 0,
    reason: str(raw.reason),
  };
}

export async function setTicketLegalHold(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!canManageLegalHold(actor.role, actor.staffPost)) {
    throw new ActionError('FORBIDDEN', 'Only a super admin or the principal can set a legal hold.');
  }
  const ticket = await loadTicket(id);
  if (!canRead(actor, ticket.data)) throw new ActionError('FORBIDDEN', 'You cannot update this ticket.');
  const current = holdOf(ticket.data.legalHold);
  const on = input.on === true;
  const reason = str(input.reason).slice(0, 500);
  if (reason.length < 3) throw new ActionError('BAD_REQUEST', 'A legal hold needs a reason.');
  const now = Date.now();
  const next: LegalHold = { on, by: actor.id, at: now, reason };
  await db().doc(`hotline_tickets/${id}`).set({ legalHold: next, updatedAt: now }, { merge: true });
  await logEvent(id, actor, on ? 'legal_hold_set' : 'legal_hold_cleared', {
    before: { legalHold: current },
    after: { legalHold: next },
  }, deviceOf(input));
  return { legalHold: next };
}

export async function redactTicketInternal(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (!canRead(actor, ticket.data) || actor.role === 'parent') {
    throw new ActionError('FORBIDDEN', 'Staff redact an internal copy.');
  }
  if (internalRedactionBlocked(holdOf(ticket.data.legalHold))) {
    throw new ActionError('FORBIDDEN', 'A legal hold blocks redaction of the internal copy.');
  }
  const before = { body: str(ticket.data.body) };
  await logEvent(id, actor, 'internal_redacted', {
    before,
    after: { body: '' },
  }, deviceOf(input));
  await db().doc(`hotline_tickets/${id}`).set({
    body: '',
    internalRedacted: true,
    updatedAt: Date.now(),
  }, { merge: true });
  return { ok: true };
}

export async function verifyTicket(uid: string, id: string) {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (actor.role === 'parent' || !canRead(actor, ticket.data)) {
    throw new ActionError('FORBIDDEN', 'Staff verify this ticket.');
  }
  return verifyStoredChain('ticket', id);
}

export async function exportTicketLog(uid: string, id: string, format: string, device: ChainDevice = SERVER_DEVICE): Promise<ExportFile> {
  const actor = await loadActor(uid);
  const ticket = await loadTicket(id);
  if (format !== 'csv' && format !== 'pdf') throw new ActionError('BAD_REQUEST', 'Choose csv or pdf.');
  if (!schoolLead(actor) || !canRead(actor, ticket.data)) {
    throw new ActionError('FORBIDDEN', 'School leads can export a ticket log.');
  }
  const loaded = await readChain('ticket', id);
  const entries = [...loaded.entries].sort((left, right) => left.seq - right.seq);
  const file = format === 'pdf'
    ? exportPdf(id, 'ticket', entries, loaded.head)
    : exportCsv(id, 'ticket', entries, loaded.head);
  await logEvent(id, actor, 'exported', {
    before: {},
    after: { format: file.filename.endsWith('.pdf') ? 'pdf' : 'csv', verificationHash: file.verificationHash, chainHead: loaded.head },
  }, device);
  return file;
}

export type { HotlineCategory };
