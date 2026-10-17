/**
 * Student safety reports and the one-tap danger alert.
 * Identity, parent exclusion, and the hash chain are enforced here.
 * Client writes stay denied.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { initialAuthorities } from '../authorities/policy';
import { GENESIS, emptyLegalHold, type ChainDevice, type ChainDiff } from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { slaDueAt, DEFAULT_WORK, type WorkCalendar } from '../hotline/policy';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { ActionError } from './actions';
import { appendChain } from './ledger';
import { notifyTicketStaff } from './staff-notify';
import { notifySafetyDesk } from './safety-desk';
import { lockScreenNotice } from '../staff-notice/copy';
import { addressedToDesk, deskAddress } from '../safety-desk/policy';
import { parentAlertAllowed, readVerification, staffCaseAllowed } from '../verification/policy';
import {
  DEFAULT_HELPLINES,
  cleanHelplines,
  dangerFanOut,
  dangerNeedsEscalation,
  dangerRepeatFlag,
  familyContactChoice,
  helplinesFor,
  isSafetyType,
  isWherePlace,
  parentsExcluded,
  placeOnce,
  safetyRateFlag,
  safetyView,
  trackerFor,
  type Helpline,
  type SafetyView,
} from '../safety/policy';

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
  staffPost: string;
  email: string;
  country: string;
  ageTier: string;
  dateOfBirth: string;
  classId: string;
  formTeacherUid: string;
  tier: number;
}

async function loadActor(uid: string): Promise<Actor> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = snap.data() ?? {};
  return {
    id: uid,
    role: str(data.role) || 'student',
    name: str(data.name) || 'Student',
    institutionId: str(data.institutionId),
    staffPost: str(data.staffPost),
    email: str(data.email),
    country: str(data.country),
    ageTier: str(data.ageTier),
    dateOfBirth: str(data.dateOfBirth),
    classId: str(data.classId),
    formTeacherUid: str(data.formTeacherUid),
    tier: readVerification(data.verification).tier,
  };
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

async function countryFor(actor: Actor): Promise<string> {
  if (actor.country) return actor.country;
  if (!actor.institutionId) return 'Malaysia';
  const snap = await db().doc(`institutions/${actor.institutionId}`).get();
  return str(snap.data()?.country) || 'Malaysia';
}

async function logEvent(ticketId: string, actor: { id: string; role: string }, action: string, diff: ChainDiff, device: ChainDevice) {
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

async function pushTo(uid: string, category: 'safety' | 'emergency', title: string, body: string, link: string, sound?: string) {
  if (!uid) return;
  try {
    await sendPush(
      { recipientUid: uid, category, title, body, link, force: true, sound },
      { store: adminPushStore(), send: sendToDevice },
    );
  } catch (error) {
    console.error('safety push failed', error);
  }
}

async function usersWithPost(institutionId: string, staffPost: string): Promise<Array<{ id: string; email: string }>> {
  const snap = await db().collection('users').where('institutionId', '==', institutionId).where('staffPost', '==', staffPost).limit(20).get();
  return snap.docs.map(doc => ({ id: doc.id, email: str(doc.data().email) }));
}

async function formTeacherUid(actor: Actor): Promise<string> {
  if (actor.formTeacherUid) return actor.formTeacherUid;
  if (!actor.classId || !actor.institutionId) return '';
  const snap = await db().collection('users').where('institutionId', '==', actor.institutionId).where('staffPost', '==', 'teacher').limit(30).get();
  const match = snap.docs.find(doc => {
    const data = doc.data();
    if (str(data.classId) === actor.classId) return true;
    return Array.isArray(data.classIds) && data.classIds.includes(actor.classId);
  });
  return match?.id ?? '';
}

function startOfUtcDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function viewOf(actor: Actor, data: FirebaseFirestore.DocumentData): SafetyView {
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

function trackerRow(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    source: str(data.source),
    safetyType: str(data.safetyType),
    tracker: trackerFor(str(data.status)),
    createdAt: Number(data.createdAt) || 0,
    flagged: data.flagged === true,
  };
}

function noticeRow(id: string, data: FirebaseFirestore.DocumentData) {
  const location = data.location && typeof data.location === 'object' ? data.location : null;
  return {
    id,
    source: str(data.source),
    safetyType: str(data.safetyType),
    studentName: str(data.reporterName),
    createdAt: Number(data.createdAt) || 0,
    tracker: trackerFor(str(data.status)),
    location,
    parentsExcluded: data.parentsExcluded === true,
    flagged: data.flagged === true,
    flagReason: str(data.flagReason),
    staffAckAt: Number(data.staffAckAt) || 0,
    parentAckAt: Number(data.parentAckAt) || 0,
  };
}

async function requireReporter(uid: string): Promise<Actor> {
  const actor = await loadActor(uid);
  if (!actor.institutionId) return actor;
  if (actor.role !== 'student') throw new ActionError('FORBIDDEN', 'A student sends this report.');
  return actor;
}

function assertCaseTier(actor: Actor, view: SafetyView, formTeacherUid: string) {
  if (view === 'full' || (view === 'notice' && actor.id === formTeacherUid)) {
    if (!staffCaseAllowed(actor.role, actor.tier)) {
      throw new ActionError('FORBIDDEN', 'Verified school staff open a safeguarding case.');
    }
  }
  if (view === 'notice' && actor.id !== formTeacherUid && !parentAlertAllowed(actor.tier)) {
    throw new ActionError('FORBIDDEN', 'A verified guardian can open this alert.');
  }
}

export async function fileSafetyReport(uid: string, input: Record<string, unknown>) {
  const actor = await requireReporter(uid);
  const safetyType = str(input.type) || str(input.safetyType);
  if (!isSafetyType(safetyType)) throw new ActionError('BAD_REQUEST', 'Choose a report type.');
  const description = str(input.description).slice(0, 4000);
  const who = str(input.who).slice(0, 200);
  const where = str(input.where).slice(0, 40);
  if (where && !isWherePlace(where)) throw new ActionError('BAD_REQUEST', 'Choose where this happened.');
  const when = str(input.when).slice(0, 200);
  const now = Date.now();
  const prior = await db().collection('hotline_tickets')
    .where('reporterUid', '==', actor.id)
    .where('createdAt', '>=', startOfUtcDay(now))
    .get();
  const rate = safetyRateFlag(prior.size + 1);
  const authorities = initialAuthorities('unsure', '');
  if ('error' in authorities) throw new ActionError('BAD_REQUEST', authorities.error);
  const calendar = await calendarFor(actor.institutionId);
  const desk = addressedToDesk(actor.institutionId);
  const excluded = desk && parentsExcluded({
    type: safetyType,
    who,
    concernRole: str(input.concernRole),
    dontTellParents: input.dontTellParents === true,
  });
  const caseRef = db().collection('safeguarding_cases').doc();
  const ref = db().collection('hotline_tickets').doc();
  await caseRef.set({
    source: 'student_safety_report',
    category: 'safeguarding',
    severity: 'high',
    ticketId: ref.id,
    institutionId: actor.institutionId,
    studentId: actor.id,
    status: 'open',
    createdAt: now,
  });
  const ticket = {
    source: 'student_safety_report',
    institutionId: actor.institutionId,
    studentId: actor.id,
    parentUid: '',
    reporterUid: actor.id,
    reporterName: actor.name,
    addressedTo: deskAddress(actor.institutionId, 'safeguarding_lead'),
    assigneeUid: '',
    category: 'safeguarding',
    safetyType,
    priority: 'high',
    status: 'pending',
    body: description,
    who,
    where,
    when,
    flagged: rate.flagged,
    throttled: rate.throttled,
    flagReason: rate.flagged ? 'rate' : '',
    parentsExcluded: excluded,
    notifiedParentUids: [] as string[],
    staffUids: [] as string[],
    formTeacherUid: '',
    location: null,
    slaDueAt: slaDueAt(now, 'high', calendar),
    escalationLevel: 0,
    safeguardingCaseId: caseRef.id,
    authorities: authorities.decision,
    authoritiesRemindedAt: 0,
    chainSeq: 0,
    chainHead: GENESIS,
    legalHold: emptyLegalHold(),
    internalRedacted: false,
    staffAckAt: 0,
    parentAckAt: 0,
    dangerEscalatedAt: 0,
    deskEscalatedAt: 0,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(ticket);
  const device = deviceOf(input);
  await logEvent(ref.id, actor, 'created', {
    before: {},
    after: { source: 'student_safety_report', safetyType, status: 'pending', flagged: rate.flagged, description, who, where, when },
  }, device);
  if (rate.flagged) {
    await logEvent(ref.id, { id: 'system', role: 'system' }, 'safety_report_flagged', {
      before: {},
      after: { flagged: true, throttled: true, flagReason: 'rate' },
    }, device);
  }

  try {
    if (desk) await notifySafetyDesk(ref.id);
    else await notifyTicketStaff(ref.id);
  } catch (error) {
    console.error('staff notice failed', error);
  }
  return { ...trackerRow(ref.id, ticket), throttled: rate.throttled };
}

export async function raiseDanger(uid: string, input: Record<string, unknown>) {
  const actor = await requireReporter(uid);
  const safetyType = str(input.type) || str(input.safetyType);
  const type = isSafetyType(safetyType) ? safetyType : 'unsafe_other';
  const who = str(input.who).slice(0, 200);
  const concernRole = str(input.concernRole).slice(0, 40);
  const dontTellParents = input.dontTellParents === true;
  const now = Date.now();
  const flags = await db().doc(`safety_flags/${actor.id}`).get();
  const previousFalse = Number(flags.data()?.falseDanger) || 0;
  const repeat = dangerRepeatFlag(previousFalse);
  const linkSnap = await db().collection('parent_links').where('studentId', '==', actor.id).limit(20).get();
  const links = linkSnap.docs.map(doc => ({
    parentId: str(doc.data().parentId),
    status: str(doc.data().status),
  }));
  const leads = await usersWithPost(actor.institutionId, 'safeguarding_lead');
  const principals = await usersWithPost(actor.institutionId, 'principal');
  const teacher = await formTeacherUid(actor);
  const staffUids = [...leads.map(row => row.id), ...principals.map(row => row.id), teacher].filter(Boolean);
  const fan = dangerFanOut({ type, who, concernRole, dontTellParents, links, staffUids });
  const share = input.shareLocation === true;
  const location = placeOnce(share, input.place, now);
  const authorities = initialAuthorities('unsure', '');
  if ('error' in authorities) throw new ActionError('BAD_REQUEST', authorities.error);
  const calendar = await calendarFor(actor.institutionId);
  const caseRef = db().collection('safeguarding_cases').doc();
  const ref = db().collection('hotline_tickets').doc();
  await caseRef.set({
    source: 'danger_now',
    category: 'safeguarding',
    severity: 'critical',
    status: 'open',
    ticketId: ref.id,
    dangerId: ref.id,
    institutionId: actor.institutionId,
    studentId: actor.id,
    createdAt: now,
  });
  const whenText = new Date(now).toISOString();
  const ticket = {
    source: 'danger_now',
    institutionId: actor.institutionId,
    studentId: actor.id,
    parentUid: '',
    reporterUid: actor.id,
    reporterName: actor.name,
    addressedTo: deskAddress(actor.institutionId, 'safeguarding_lead'),
    assigneeUid: '',
    category: 'safeguarding',
    safetyType: type,
    priority: 'high',
    status: 'pending',
    body: '',
    who,
    concernRole,
    dontTellParents,
    where: '',
    when: whenText,
    flagged: repeat,
    throttled: false,
    flagReason: repeat ? 'repeat_false' : '',
    parentsExcluded: fan.excluded,
    notifiedParentUids: addressedToDesk(actor.institutionId) ? [] : fan.parentUids,
    staffUids: addressedToDesk(actor.institutionId) ? [] : staffUids,
    formTeacherUid: teacher,
    location,
    slaDueAt: slaDueAt(now, 'high', calendar),
    escalationLevel: 0,
    safeguardingCaseId: caseRef.id,
    authorities: authorities.decision,
    authoritiesRemindedAt: 0,
    chainSeq: 0,
    chainHead: GENESIS,
    legalHold: emptyLegalHold(),
    internalRedacted: false,
    staffAckAt: 0,
    parentAckAt: 0,
    dangerEscalatedAt: 0,
    deskEscalatedAt: 0,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(ticket);
  await logEvent(ref.id, actor, 'created', {
    before: {},
    after: {
      source: 'danger_now',
      safetyType: type,
      status: 'pending',
      parentsExcluded: fan.excluded,
      recipientCount: fan.recipients.length,
      locationShared: location !== null,
      flagged: repeat,
    },
  }, deviceOf(input));
  const body = `${actor.name} needs help now. ${whenText}`;
  const desk = addressedToDesk(actor.institutionId);
  if (!desk) {
    for (const recipient of fan.parentUids) {
      await pushTo(recipient, 'emergency', 'A student is in danger', body, `/dashboard/safety/${ref.id}`, 'emergency');
    }
  }
  try {
    if (desk) await notifySafetyDesk(ref.id);
    else await notifyTicketStaff(ref.id);
  } catch (error) {
    console.error('staff notice failed', error);
  }
  return {
    id: ref.id,
    tracker: 'received' as const,
    parentsExcluded: fan.excluded,
    locationShared: location !== null,
    flagged: repeat,
    createdAt: now,
  };
}

export async function listSafetyTracker(uid: string) {
  const actor = await loadActor(uid);
  const snap = await db().collection('hotline_tickets').where('reporterUid', '==', actor.id).orderBy('createdAt', 'desc').limit(30).get();
  return {
    reports: snap.docs
      .filter(doc => viewOf(actor, doc.data()) === 'tracker')
      .map(doc => trackerRow(doc.id, doc.data())),
  };
}

export async function safetyNotice(uid: string, id: string) {
  const actor = await loadActor(uid);
  const snap = await db().doc(`hotline_tickets/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  const data = snap.data() ?? {};
  const view = viewOf(actor, data);
  if (view === 'hidden') throw new ActionError('FORBIDDEN', 'You cannot open this report.');
  assertCaseTier(actor, view, str(data.formTeacherUid));
  if (view === 'tracker') return trackerRow(id, data);
  const notice = noticeRow(id, data);
  return {
    ...notice,
    canAck: view === 'notice' || view === 'full',
    canDecideFamily: view === 'full' && data.parentsExcluded === true,
    canMarkFalse: view === 'full' && str(data.source) === 'danger_now',
  };
}

export async function acknowledgeDanger(uid: string, id: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  const snap = await db().doc(`hotline_tickets/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  const data = snap.data() ?? {};
  if (str(data.source) !== 'danger_now') throw new ActionError('BAD_REQUEST', 'This acknowledgement is for a danger alert.');
  const view = viewOf(actor, data);
  assertCaseTier(actor, view, str(data.formTeacherUid));
  const staff = view === 'full' || (view === 'notice' && actor.id === str(data.formTeacherUid));
  const parent = view === 'notice' && data.parentsExcluded !== true && stringList(data.notifiedParentUids).includes(actor.id);
  if (!staff && !parent) throw new ActionError('FORBIDDEN', 'You cannot acknowledge this alert.');
  const now = Date.now();
  if (staff && !Number(data.staffAckAt)) {
    await db().doc(`hotline_tickets/${id}`).set({ staffAckAt: now, updatedAt: now }, { merge: true });
    await logEvent(id, actor, 'acknowledged', { before: { staffAckAt: 0 }, after: { staffAckAt: now, who: 'staff' } }, device);
  }
  if (parent && !Number(data.parentAckAt)) {
    await db().doc(`hotline_tickets/${id}`).set({ parentAckAt: now, updatedAt: now }, { merge: true });
    await logEvent(id, actor, 'acknowledged', { before: { parentAckAt: 0 }, after: { parentAckAt: now, who: 'parent' } }, device);
  }
  return { ok: true };
}

export async function recordFamilyDecision(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const snap = await db().doc(`hotline_tickets/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  const data = snap.data() ?? {};
  if (viewOf(actor, data) !== 'full') throw new ActionError('FORBIDDEN', 'The safeguarding lead records this decision.');
  if (!staffCaseAllowed(actor.role, actor.tier)) throw new ActionError('FORBIDDEN', 'Verified school staff open a safeguarding case.');
  if (data.parentsExcluded !== true) throw new ActionError('BAD_REQUEST', 'Parents were already included in this alert.');
  const contact = familyContactChoice(str(input.contact));
  if (!contact) throw new ActionError('BAD_REQUEST', 'Choose whether to contact the family.');
  const reason = str(input.reason).slice(0, 500);
  if (reason.length < 3) throw new ActionError('BAD_REQUEST', 'Record why this decision was made.');
  const when = str(input.when).slice(0, 120);
  const now = Date.now();
  const decision = { contact, when, reason, by: actor.id, at: now };
  await db().doc(`hotline_tickets/${id}`).set({ familyDecision: decision, updatedAt: now }, { merge: true });
  await logEvent(id, actor, 'family_decision', { before: {}, after: decision }, deviceOf(input));
  return { ok: true };
}

export async function markDangerFalse(uid: string, id: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  const snap = await db().doc(`hotline_tickets/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  const data = snap.data() ?? {};
  if (str(data.source) !== 'danger_now') throw new ActionError('BAD_REQUEST', 'Only a danger alert can be marked false.');
  if (viewOf(actor, data) !== 'full') throw new ActionError('FORBIDDEN', 'The safeguarding lead marks a false trigger.');
  if (!staffCaseAllowed(actor.role, actor.tier)) throw new ActionError('FORBIDDEN', 'Verified school staff open a safeguarding case.');
  const studentId = str(data.reporterUid);
  const flagRef = db().doc(`safety_flags/${studentId}`);
  const flag = await flagRef.get();
  const next = (Number(flag.data()?.falseDanger) || 0) + 1;
  await flagRef.set({ falseDanger: next, updatedAt: Date.now() }, { merge: true });
  await db().doc(`hotline_tickets/${id}`).set({ falseTrigger: true, updatedAt: Date.now() }, { merge: true });
  await logEvent(id, actor, 'false_trigger', { before: {}, after: { falseDanger: next } }, device);
  return { ok: true, falseDanger: next };
}

export async function escalateUnackedDanger(now = Date.now()) {
  const snap = await db().collection('hotline_tickets').where('source', '==', 'danger_now').where('status', '==', 'pending').limit(50).get();
  let escalated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!dangerNeedsEscalation(Number(data.createdAt) || 0, Number(data.staffAckAt) || 0, Number(data.dangerEscalatedAt) || 0, now)) {
      continue;
    }
    await db().doc(`hotline_tickets/${doc.id}`).set({ dangerEscalatedAt: now, updatedAt: now }, { merge: true });
    await logEvent(doc.id, { id: 'system', role: 'system' }, 'danger_escalated', {
      before: { dangerEscalatedAt: 0 },
      after: { dangerEscalatedAt: now, reason: 'no staff acknowledgement in 5 minutes' },
    }, SERVER_DEVICE);
    const copy = lockScreenNotice({
      typeLabel: 'Danger now',
      fullName: str(data.reporterName),
      classLabel: '',
      at: now,
    });
    for (const staffId of stringList(data.staffUids)) {
      await pushTo(staffId, 'emergency', copy.title, copy.body, `/dashboard/safety/${doc.id}`, 'emergency');
    }
    escalated += 1;
  }
  return { dangerEscalated: escalated };
}

export async function readHelplines(uid: string) {
  const actor = await loadActor(uid);
  const country = await countryFor(actor);
  const snap = await db().doc('safety_helplines/catalog').get();
  const stored = cleanHelplines(snap.data()?.lines) ?? DEFAULT_HELPLINES;
  return { country, lines: helplinesFor(country, stored) };
}

export async function writeHelplines(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (actor.role !== 'admin') throw new ActionError('FORBIDDEN', 'A super admin updates helplines.');
  const lines = cleanHelplines(input.lines);
  if (!lines) throw new ActionError('BAD_REQUEST', 'Add at least one helpline with a country, name, and number.');
  await db().doc('safety_helplines/catalog').set({ lines, updatedBy: actor.id, updatedAt: Date.now() });
  return { ok: true, count: lines.length };
}

export function sampleHelplines(): Helpline[] {
  return helplinesFor('Malaysia', DEFAULT_HELPLINES);
}
