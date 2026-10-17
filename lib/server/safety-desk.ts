/**
 * Poket School Safety Desk. Cases for people with no school, plus the on-call rota.
 * Delivery is appended to the same ticket hash chain. Entries are not updated.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { initialAuthorities } from '../authorities/policy';
import { GENESIS, emptyLegalHold, type ChainDevice } from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { DEFAULT_WORK, slaDueAt, zonedClock, type WorkCalendar } from '../hotline/policy';
import { currentMailAdapter, sendWithBackoff } from '../mail';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { dangerFanOut, isSafetyType, parentsExcluded } from '../safety/policy';
import {
  DESK_ADDRESS,
  cleanSlot,
  deskNeedsEscalation,
  deskRecipients,
  onCallAt,
  type RotaSlot,
} from '../safety-desk/policy';
import { deliveryExtra, fallbackChannel, lockScreenNotice } from '../staff-notice/copy';
import { caseCardHtml, caseCardSubject, caseCardText } from '../staff-notice/template';
import { readVerification } from '../verification/policy';
import { ActionError } from './actions';
import { appendChain } from './ledger';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function requireAdmin(uid: string) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  if (str(snap.data()?.role) !== 'admin') throw new ActionError('FORBIDDEN', 'The Safety Desk is for a Poket School super admin.');
  return snap;
}

async function logDelivery(ticketId: string, input: {
  channel: 'push' | 'email';
  recipientUid: string;
  status: 'queued' | 'sent' | 'failed';
  provider: string;
  providerId?: string;
  error?: string;
  fallback?: 'push' | 'email' | '';
  before?: string;
}) {
  await appendChain({
    parentPath: `hotline_tickets/${ticketId}`,
    collection: 'events',
    actorUid: 'system',
    actorRole: 'system',
    action: 'delivery',
    diff: {
      before: { status: input.before ?? '' },
      after: { status: input.status, channel: input.channel, recipientUid: input.recipientUid },
    },
    device: SERVER_DEVICE,
    extra: deliveryExtra({
      channel: input.channel,
      recipientUid: input.recipientUid,
      status: input.status,
      provider: input.provider,
      providerId: input.providerId ?? '',
      error: input.error,
      fallback: input.fallback,
    }),
  });
}

export async function readRota(uid?: string): Promise<{ timezone: string; slots: RotaSlot[] }> {
  if (uid) await requireAdmin(uid);
  const snap = await db().doc('safety_desk/rota').get();
  const data = snap.data() ?? {};
  const slots = Array.isArray(data.slots) ? data.slots.map(cleanSlot).filter((slot): slot is RotaSlot => slot !== null) : [];
  return { timezone: str(data.timezone) || DEFAULT_WORK.timezone, slots };
}

export async function saveRota(uid: string, input: Record<string, unknown>) {
  await requireAdmin(uid);
  const slots = Array.isArray(input.slots) ? input.slots.map(cleanSlot).filter((slot): slot is RotaSlot => slot !== null) : [];
  if (slots.length < 1) throw new ActionError('BAD_REQUEST', 'Add at least one on-call slot.');
  const timezone = str(input.timezone) || DEFAULT_WORK.timezone;
  await db().doc('safety_desk/rota').set({ timezone, slots, updatedBy: uid, updatedAt: Date.now() });
  return { timezone, slots };
}

async function superAdmins(): Promise<Array<{ id: string; email: string }>> {
  const snap = await db().collection('users').where('role', '==', 'admin').limit(20).get();
  return snap.docs.map(doc => ({ id: doc.id, email: str(doc.data().email) }));
}

async function tierTwoGuardians(studentId: string, excluded: boolean): Promise<Array<{ id: string; email: string; name: string; phone: string }>> {
  if (!studentId || excluded) return [];
  const links = await db().collection('parent_links').where('studentId', '==', studentId).limit(20).get();
  const people = [];
  for (const doc of links.docs) {
    if (str(doc.data().status) !== 'approved') continue;
    const parentId = str(doc.data().parentId);
    if (!parentId) continue;
    const parent = await db().doc(`users/${parentId}`).get();
    const data = parent.data() ?? {};
    if (readVerification(data.verification).tier < 2) continue;
    people.push({ id: parentId, email: str(data.email), name: str(data.name) || 'Guardian', phone: str(data.phone) });
  }
  return people;
}

export async function notifySafetyDesk(ticketId: string, escalate = false): Promise<{ recipients: number }> {
  const snap = await db().doc(`hotline_tickets/${ticketId}`).get();
  if (!snap.exists) return { recipients: 0 };
  const data = snap.data() ?? {};
  if (str(data.addressedTo) !== DESK_ADDRESS) return { recipients: 0 };
  const rota = await readRota();
  const clock = zonedClock(Date.now(), rota.timezone);
  const call = onCallAt(rota.slots, clock.weekday, clock.minutes);
  const admins = await superAdmins();
  const studentId = str(data.studentId) || str(data.reporterUid);
  const excluded = data.parentsExcluded === true;
  const guardians = await tierTwoGuardians(studentId, excluded);
  const excludedIds = excluded ? guardians.map(person => person.id) : [];
  const linkSnap = await db().collection('parent_links').where('studentId', '==', studentId).limit(20).get();
  const fan = dangerFanOut({
    type: str(data.safetyType),
    who: str(data.who),
    concernRole: str(data.concernRole),
    dontTellParents: data.dontTellParents === true,
    links: linkSnap.docs.map(doc => ({ parentId: str(doc.data().parentId), status: str(doc.data().status) })),
    staffUids: [],
  });
  const recipients = deskRecipients({
    superAdminUids: admins.map(row => row.id),
    primaryUid: call.primaryUid,
    backupUid: call.backupUid,
    guardianUids: guardians.map(person => person.id),
    excludedParentUids: fan.excluded ? [...fan.parentUids, ...linkSnap.docs.map(doc => str(doc.data().parentId))] : excludedIds,
    escalate,
  });
  const emails = new Map<string, string>();
  for (const row of admins) emails.set(row.id, row.email);
  for (const row of guardians) emails.set(row.id, row.email);
  for (const uid of [call.primaryUid, call.backupUid]) {
    if (uid && !emails.has(uid)) {
      const person = await db().doc(`users/${uid}`).get();
      emails.set(uid, str(person.data()?.email));
    }
  }
  const student = studentId ? await db().doc(`users/${studentId}`).get() : null;
  const studentData = student?.data() ?? {};
  const fullName = str(studentData.name) || str(data.reporterName);
  const classLabel = str(studentData.className) || str(studentData.classId) || str(studentData.yearGroup);
  const at = Number(data.createdAt) || Date.now();
  const copy = lockScreenNotice({ typeLabel: 'Safety Desk', fullName, classLabel, at });
  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://poketschool.ai').replace(/\/$/, '');
  const caseUrl = `${origin}/dashboard/admin/safety-desk?id=${ticketId}`;
  const card = {
    typeLabel: 'Safety Desk',
    fullName,
    studentNumber: str(studentData.studentNumber),
    classLabel,
    photoUrl: str(studentData.avatarUrl).startsWith('https://') ? str(studentData.avatarUrl) : '',
    guardians: await guardianContacts(studentId),
    description: str(data.body) || str(data.title),
    location: data.location && typeof data.location === 'object' ? str((data.location as { place?: unknown }).place) : '',
    atIso: new Date(at).toISOString(),
    caseId: ticketId,
    caseUrl,
    parentsExcluded: fan.excluded || excluded,
  };
  let failed = 0;
  for (const uid of recipients) {
    const pushed = await sendChannel(ticketId, uid, 'push', async () => {
      const report = await sendWithBackoff(async () => {
        const result = await sendPush({
          recipientUid: uid,
          category: 'emergency',
          title: copy.title,
          body: copy.body,
          link: caseUrl,
          force: true,
          sound: 'emergency',
        }, { store: adminPushStore(), send: sendToDevice });
        return { ok: result.sent > 0, provider: 'push' as const, providerId: '', error: result.sent > 0 ? '' : 'Push was not delivered.' };
      });
      return report;
    });
    const mailed = await sendChannel(ticketId, uid, 'email', async () => {
      const to = emails.get(uid) ?? '';
      if (!to) return { ok: false, provider: 'none' as const, providerId: '', error: 'No email address on file.' };
      return sendWithBackoff(() => currentMailAdapter().send({
        to,
        subject: caseCardSubject(card.typeLabel),
        text: caseCardText(card),
        html: caseCardHtml(card),
      }));
    });
    const fallback = fallbackChannel(!pushed.ok, !mailed.ok);
    if (!pushed.ok || !mailed.ok) failed += 1;
    if (fallback) {
      await logDelivery(ticketId, {
        channel: fallback,
        recipientUid: uid,
        status: 'sent',
        provider: fallback,
        fallback,
        before: 'failed',
      });
    }
  }
  await db().doc(`hotline_tickets/${ticketId}`).set({
    staffUids: recipients,
    deskPrimaryUid: call.primaryUid,
    deskBackupUid: call.backupUid,
  }, { merge: true });
  if (failed > 0 && admins[0]) {
    await sendPush({
      recipientUid: admins[0].id,
      category: 'safety',
      title: 'Staff notice failed',
      body: 'Open case.',
      link: caseUrl,
      force: true,
    }, { store: adminPushStore(), send: sendToDevice }).catch(() => undefined);
  }
  return { recipients: recipients.length };
}

async function guardianContacts(studentId: string) {
  if (!studentId) return [];
  const links = await db().collection('parent_links').where('studentId', '==', studentId).limit(10).get();
  const contacts = [];
  for (const doc of links.docs) {
    if (str(doc.data().status) !== 'approved') continue;
    const parent = await db().doc(`users/${str(doc.data().parentId)}`).get();
    const data = parent.data() ?? {};
    contacts.push({ name: str(data.name) || 'Guardian', phone: str(data.phone), email: str(data.email) });
  }
  return contacts;
}

async function sendChannel(
  ticketId: string,
  uid: string,
  channel: 'push' | 'email',
  run: () => Promise<{ ok: boolean; provider: string; providerId: string; error?: string }>,
) {
  await logDelivery(ticketId, { channel, recipientUid: uid, status: 'queued', provider: channel === 'push' ? 'push' : currentMailAdapter().name });
  let result: { ok: boolean; provider: string; providerId: string; error?: string };
  try {
    result = await run();
  } catch (error) {
    result = { ok: false, provider: 'none', providerId: '', error: error instanceof Error ? error.message : 'Send failed.' };
  }
  await logDelivery(ticketId, {
    channel,
    recipientUid: uid,
    status: result.ok ? 'sent' : 'failed',
    provider: result.provider,
    providerId: result.providerId,
    error: result.error,
    before: 'queued',
  });
  return result;
}

export async function listDeskQueue(uid: string) {
  await requireAdmin(uid);
  const snap = await db().collection('hotline_tickets').where('addressedTo', '==', DESK_ADDRESS).orderBy('createdAt', 'desc').limit(40).get();
  const now = Date.now();
  return {
    cases: snap.docs.map(doc => {
      const data = doc.data();
      const status = str(data.status) || 'pending';
      const due = Number(data.slaDueAt) || 0;
      return {
        id: doc.id,
        source: str(data.source),
        safetyType: str(data.safetyType) || str(data.type),
        title: str(data.title),
        status,
        assigneeUid: str(data.assigneeUid),
        createdAt: Number(data.createdAt) || 0,
        slaDueAt: due,
        overdue: due > 0 && due < now && status !== 'solved' && status !== 'closed',
        flagged: data.flagged === true,
        parentsExcluded: data.parentsExcluded === true,
      };
    }),
  };
}

export async function assignDeskCase(uid: string, ticketId: string, assigneeUid: string, device: ChainDevice = SERVER_DEVICE) {
  await requireAdmin(uid);
  const snap = await db().doc(`hotline_tickets/${ticketId}`).get();
  if (!snap.exists || str(snap.data()?.addressedTo) !== DESK_ADDRESS) throw new ActionError('NOT_FOUND', 'Case not found.');
  const previous = str(snap.data()?.assigneeUid);
  await snap.ref.set({ assigneeUid, status: 'in_progress', updatedAt: Date.now() }, { merge: true });
  await appendChain({
    parentPath: `hotline_tickets/${ticketId}`,
    collection: 'events',
    actorUid: uid,
    actorRole: 'admin',
    action: 'assigned',
    diff: { before: { assigneeUid: previous }, after: { assigneeUid } },
    device,
  });
  return { ok: true };
}

export async function escalateUnackedDesk(now = Date.now()) {
  const snap = await db().collection('hotline_tickets').where('addressedTo', '==', DESK_ADDRESS).orderBy('createdAt', 'desc').limit(40).get();
  let escalated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (str(data.status) !== 'pending') continue;
    if (!deskNeedsEscalation(Number(data.createdAt) || 0, Number(data.staffAckAt) || 0, Number(data.deskEscalatedAt) || 0, now)) continue;
    await doc.ref.set({ deskEscalatedAt: now, updatedAt: now }, { merge: true });
    await appendChain({
      parentPath: `hotline_tickets/${doc.id}`,
      collection: 'events',
      actorUid: 'system',
      actorRole: 'system',
      action: 'desk_escalated',
      diff: { before: { deskEscalatedAt: 0 }, after: { deskEscalatedAt: now } },
      device: SERVER_DEVICE,
    });
    await notifySafetyDesk(doc.id, true);
    escalated += 1;
  }
  return { deskEscalated: escalated };
}

export async function submitDeskAlert(uid: string, input: Record<string, unknown>) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = snap.data() ?? {};
  const institutionId = str(data.institutionId);
  if (institutionId && str(data.role) !== 'admin') {
    throw new ActionError('FORBIDDEN', 'A school publishes through its emergency desk. This form is for people without a school.');
  }
  const title = str(input.title).slice(0, 120);
  const description = str(input.description).slice(0, 2000);
  if (title.length < 3 || description.length < 3) throw new ActionError('BAD_REQUEST', 'Add a title and a description.');
  const safetyType = isSafetyType(str(input.type)) ? str(input.type) : 'unsafe_other';
  const now = Date.now();
  const excluded = parentsExcluded({
    type: safetyType,
    who: str(input.who),
    concernRole: str(input.concernRole),
    dontTellParents: input.dontTellParents === true,
  });
  const authorities = initialAuthorities('unsure', '');
  if ('error' in authorities) throw new ActionError('BAD_REQUEST', authorities.error);
  const calendar: WorkCalendar = DEFAULT_WORK;
  const ref = db().collection('hotline_tickets').doc();
  await ref.set({
    source: 'desk_alert',
    institutionId: '',
    studentId: uid,
    parentUid: '',
    reporterUid: uid,
    reporterName: str(data.name),
    addressedTo: DESK_ADDRESS,
    assigneeUid: '',
    category: 'safeguarding',
    safetyType,
    priority: 'high',
    status: 'pending',
    title,
    body: description,
    who: str(input.who).slice(0, 200),
    concernRole: str(input.concernRole).slice(0, 40),
    dontTellParents: input.dontTellParents === true,
    flagged: false,
    parentsExcluded: excluded,
    notifiedParentUids: [],
    staffUids: [],
    chainSeq: 0,
    chainHead: GENESIS,
    legalHold: emptyLegalHold(),
    internalRedacted: false,
    staffAckAt: 0,
    parentAckAt: 0,
    deskEscalatedAt: 0,
    slaDueAt: slaDueAt(now, 'high', calendar),
    createdAt: now,
    updatedAt: now,
    authorities: authorities.decision,
  });
  await appendChain({
    parentPath: `hotline_tickets/${ref.id}`,
    collection: 'events',
    actorUid: uid,
    actorRole: str(data.role) || 'student',
    action: 'created',
    diff: { before: {}, after: { source: 'desk_alert', addressedTo: DESK_ADDRESS, title } },
    device: SERVER_DEVICE,
  });
  try {
    await notifySafetyDesk(ref.id);
  } catch (error) {
    console.error('safety desk notice failed', error);
  }
  return { id: ref.id, addressedTo: DESK_ADDRESS };
}
