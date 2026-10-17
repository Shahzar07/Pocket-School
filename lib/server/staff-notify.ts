/**
 * Confidential case card for safety reports, danger alerts, and high
 * safeguarding tickets. Who is notified comes from resolveRecipients.
 * Parents are pushed and are not emailed the case card. Amber and
 * emergency alerts use the community audience, not this card.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { ageTierFromDob } from '../age-tier';
import { SERVER_DEVICE } from '../ledger/device';
import { currentMailAdapter, currentMailEnv, sendWithBackoff, type MailSendResult } from '../mail';
import { sendPush, type PushReport } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { alertPerson, resolveRecipients, type AlertPerson } from '../alerts/recipients';
import { parentsExcluded } from '../safety/policy';
import {
  deliveryExtra,
  fallbackChannel,
  lockScreenNotice,
  noticeCategory,
  noticeTypeLabel,
  type NoticeKind,
} from '../staff-notice/copy';
import { caseCardHtml, caseCardSubject, caseCardText, type GuardianContact } from '../staff-notice/template';
import { peopleAtInstitution } from './alert-directory';
import { appendChain } from './ledger';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) return '';
  return value;
}

function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  return (configured || 'https://poketschool.ai').replace(/\/$/, '');
}

function publicPhoto(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

async function usersWithPost(institutionId: string, staffPost: string): Promise<Array<{ id: string; email: string }>> {
  if (!institutionId) return [];
  const snap = await db().collection('users').where('institutionId', '==', institutionId).where('staffPost', '==', staffPost).limit(20).get();
  return snap.docs.map(doc => ({ id: doc.id, email: str(doc.data().email) }));
}

async function formTeacherFor(student: FirebaseFirestore.DocumentData, studentId: string): Promise<string> {
  const direct = str(student.formTeacherUid);
  if (direct) return direct;
  const classId = str(student.classId);
  const institutionId = str(student.institutionId);
  if (!classId || !institutionId) return '';
  const snap = await db().collection('users').where('institutionId', '==', institutionId).where('staffPost', '==', 'teacher').limit(30).get();
  const match = snap.docs.find(doc => {
    const data = doc.data();
    if (str(data.classId) === classId) return true;
    return Array.isArray(data.classIds) && data.classIds.includes(classId);
  });
  return match?.id ?? (studentId ? '' : '');
}

async function guardians(studentId: string): Promise<{ contacts: GuardianContact[]; parentUids: string[] }> {
  if (!studentId) return { contacts: [], parentUids: [] };
  const snap = await db().collection('parent_links').where('studentId', '==', studentId).limit(20).get();
  const contacts: GuardianContact[] = [];
  const parentUids: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (str(data.status) !== 'approved') continue;
    const parentId = str(data.parentId);
    if (!parentId) continue;
    parentUids.push(parentId);
    const parent = await db().doc(`users/${parentId}`).get();
    const row = parent.data() ?? {};
    contacts.push({
      name: str(row.name) || 'Guardian',
      phone: str(row.phone),
      email: str(row.email),
    });
  }
  return { contacts, parentUids };
}

async function logDelivery(input: {
  parentPath: string;
  collection: 'events' | 'audit';
  channel: 'push' | 'email';
  recipientUid: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'opened';
  provider: string;
  providerId: string;
  error?: string;
  fallback?: 'push' | 'email' | '';
  before?: string;
}) {
  const extra = deliveryExtra({
    channel: input.channel,
    recipientUid: input.recipientUid,
    status: input.status,
    provider: input.provider,
    providerId: input.providerId,
    error: input.error,
    fallback: input.fallback,
  });
  await appendChain({
    parentPath: input.parentPath,
    collection: input.collection,
    actorUid: 'system',
    actorRole: 'system',
    action: 'delivery',
    diff: {
      before: { status: input.before ?? '' },
      after: { status: input.status, channel: input.channel, recipientUid: input.recipientUid },
    },
    device: SERVER_DEVICE,
    extra,
  });
}

async function pushOnce(uid: string, category: 'safety' | 'emergency', title: string, body: string, link: string, force: boolean, sound?: string): Promise<PushReport> {
  return sendPush(
    { recipientUid: uid, category, title, body, link, force, sound },
    { store: adminPushStore(), send: sendToDevice },
  );
}

async function rememberEmail(providerId: string, parentPath: string, collection: 'events' | 'audit', recipientUid: string, caseId: string) {
  if (!providerId || providerId.startsWith('console-')) return;
  const id = providerId.replace(/[^\w.-]/g, '').slice(0, 128);
  if (!id) return;
  await db().doc(`mail_deliveries/${id}`).create({
    providerId,
    parentPath,
    collection,
    recipientUid,
    channel: 'email',
    caseId,
    createdAt: Date.now(),
  }).catch(() => undefined);
}

interface BuiltNotice {
  kind: NoticeKind;
  parentPath: string;
  collection: 'events' | 'audit';
  institutionId: string;
  caseId: string;
  caseUrl: string;
  typeLabel: string;
  fullName: string;
  studentNumber: string;
  classLabel: string;
  photoUrl: string;
  description: string;
  location: string;
  at: number;
  parentsExcluded: boolean;
  force: boolean;
  sound?: 'emergency';
  category: 'safety' | 'emergency';
  formTeacherUid: string;
  headUids: string[];
  principalUids: string[];
  guardians: GuardianContact[];
  parentUids: string[];
  under13: boolean;
}

async function safetyRoster(institutionId: string, student: FirebaseFirestore.DocumentData | null, studentId: string) {
  const leads = await usersWithPost(institutionId, 'safeguarding_lead');
  const principals = await usersWithPost(institutionId, 'principal');
  const formTeacherUid = student ? await formTeacherFor(student, studentId) : '';
  const family = await guardians(studentId);
  return { leads, principals, formTeacherUid, family };
}

function rosterPeople(institutionId: string, leads: Array<{ id: string }>, principals: Array<{ id: string }>, formTeacherUid: string): AlertPerson[] {
  const people = [
    ...leads.map(row => alertPerson({ uid: row.id, institutionId, role: 'teacher', staffPost: 'safeguarding_lead' })),
    ...principals.map(row => alertPerson({ uid: row.id, institutionId, role: 'teacher', staffPost: 'principal' })),
  ];
  if (formTeacherUid) people.push(alertPerson({ uid: formTeacherUid, institutionId, role: 'teacher', staffPost: 'teacher' }));
  return people;
}

function studentFields(data: FirebaseFirestore.DocumentData | null) {
  if (!data) {
    return { fullName: '', studentNumber: '', classLabel: '', photoUrl: '', ageTier: '', dateOfBirth: '' };
  }
  return {
    fullName: str(data.name),
    studentNumber: str(data.studentNumber),
    classLabel: str(data.className) || str(data.classId) || str(data.yearGroup),
    photoUrl: publicPhoto(str(data.avatarUrl)),
    ageTier: str(data.ageTier),
    dateOfBirth: str(data.dateOfBirth),
  };
}

export async function notifyTicketStaff(ticketId: string): Promise<{ recipients: number; failed: number; skipped?: boolean }> {
  const id = safeId(ticketId);
  if (!id) return { recipients: 0, failed: 0, skipped: true };
  const snap = await db().doc(`hotline_tickets/${id}`).get();
  if (!snap.exists) return { recipients: 0, failed: 0, skipped: true };
  const data = snap.data() ?? {};
  const source = str(data.source);
  const category = str(data.category);
  const priority = str(data.priority);
  let kind: NoticeKind | null = null;
  if (source === 'danger_now') kind = 'danger_now';
  else if (source === 'student_safety_report') kind = 'student_safety_report';
  else if (category === 'safeguarding' && priority === 'high') kind = 'safeguarding_ticket';
  if (!kind) return { recipients: 0, failed: 0, skipped: true };
  const studentId = str(data.studentId) || str(data.reporterUid);
  const studentSnap = studentId ? await db().doc(`users/${studentId}`).get() : null;
  const student = studentSnap?.data() ?? null;
  const fields = studentFields(student);
  const institutionId = str(data.institutionId);
  const roster = await safetyRoster(institutionId, student, studentId);
  const under13 = fields.ageTier === 'under13' || ageTierFromDob(fields.dateOfBirth, new Date()) === 'under13';
  const location = data.location && typeof data.location === 'object' ? str((data.location as { place?: unknown }).place) : '';
  const excluded = data.parentsExcluded === true || parentsExcluded({
    type: str(data.safetyType),
    who: str(data.who),
    concernRole: str(data.concernRole),
    dontTellParents: data.dontTellParents === true,
  });
  const resolved = kind === 'safeguarding_ticket'
    ? resolveRecipients({
      kind: 'hotline',
      institutionId,
      people: await peopleAtInstitution(institutionId),
      addressedTo: str(data.addressedTo),
      addressedUid: str(data.assigneeUid),
      sensitive: true,
    })
    : resolveRecipients({
      kind: kind === 'danger_now' ? 'danger_now' : 'student_safety_report',
      institutionId,
      people: rosterPeople(institutionId, roster.leads, roster.principals, roster.formTeacherUid),
      formTeacherUid: roster.formTeacherUid,
      parentUids: roster.family.parentUids,
      parentsExcluded: excluded,
    });
  const notice: BuiltNotice = {
    kind,
    parentPath: `hotline_tickets/${id}`,
    collection: 'events',
    institutionId: str(data.institutionId),
    caseId: id,
    caseUrl: `${appOrigin()}/dashboard/safety/${id}`,
    typeLabel: noticeTypeLabel(str(data.safetyType) || (kind === 'danger_now' ? 'danger_now' : 'safeguarding')),
    fullName: fields.fullName || str(data.reporterName),
    studentNumber: fields.studentNumber,
    classLabel: fields.classLabel,
    photoUrl: fields.photoUrl,
    description: str(data.body) || str(data.who),
    location,
    at: Number(data.createdAt) || Date.now(),
    parentsExcluded: excluded,
    force: kind !== 'student_safety_report' || under13,
    sound: kind === 'student_safety_report' ? undefined : 'emergency',
    category: noticeCategory(kind),
    formTeacherUid: roster.formTeacherUid,
    headUids: roster.leads.map(row => row.id),
    principalUids: roster.principals.map(row => row.id),
    guardians: roster.family.contacts,
    parentUids: roster.family.parentUids,
    under13,
  };
  const staffEmails = new Map<string, string>();
  for (const row of [...roster.leads, ...roster.principals]) staffEmails.set(row.id, row.email);
  if (roster.formTeacherUid && !staffEmails.has(roster.formTeacherUid)) {
    const teacher = await db().doc(`users/${roster.formTeacherUid}`).get();
    staffEmails.set(roster.formTeacherUid, str(teacher.data()?.email));
  }
  if (kind === 'safeguarding_ticket') {
    const directory = await peopleAtInstitution(institutionId);
    for (const person of directory) staffEmails.set(person.uid, person.email);
  }
  for (const parentUid of resolved.parentUids) {
    const title = kind === 'danger_now' ? 'A student is in danger' : 'Safety report';
    const body = kind === 'danger_now'
      ? `${notice.fullName || 'A student'} needs help now.`
      : `${notice.fullName || 'A student'} sent a safety report.`;
    await sendChannel(notice, parentUid, 'push', async () => sendWithBackoff(async () => {
      const report = await pushOnce(
        parentUid,
        kind === 'danger_now' ? 'emergency' : 'safety',
        title,
        body,
        notice.caseUrl,
        kind === 'danger_now' || under13,
        kind === 'danger_now' ? 'emergency' : undefined,
      );
      const ok = report.sent > 0;
      return { ok, provider: 'push', providerId: '', error: ok ? '' : 'Push was not delivered.' };
    }));
  }
  return deliver(notice, staffEmails, resolved.staffUids);
}

export async function notifyAlertStaff(alertId: string): Promise<{ recipients: number; failed: number; skipped?: boolean }> {
  const id = safeId(alertId);
  if (!id) return { recipients: 0, failed: 0, skipped: true };
  return { recipients: 0, failed: 0, skipped: true };
}

async function deliver(notice: BuiltNotice, emails: Map<string, string>, recipients: string[]): Promise<{ recipients: number; failed: number }> {
  const pushCopy = lockScreenNotice({
    typeLabel: notice.typeLabel,
    fullName: notice.fullName,
    classLabel: notice.classLabel,
    at: notice.at,
  });
  const card = {
    typeLabel: notice.typeLabel,
    fullName: notice.fullName,
    studentNumber: notice.studentNumber,
    classLabel: notice.classLabel,
    photoUrl: notice.photoUrl,
    guardians: notice.guardians,
    description: notice.description,
    location: notice.location,
    atIso: new Date(notice.at).toISOString(),
    caseId: notice.caseId,
    caseUrl: notice.caseUrl,
    parentsExcluded: notice.parentsExcluded,
  };
  const text = caseCardText(card);
  const html = caseCardHtml(card);
  const subject = caseCardSubject(notice.typeLabel);
  let failed = 0;
  for (const uid of recipients) {
    const pushResult = await sendChannel(notice, uid, 'push', async () => sendWithBackoff(async () => {
      const report = await pushOnce(uid, notice.category, pushCopy.title, pushCopy.body, notice.caseUrl, notice.force, notice.sound);
      const ok = report.sent > 0;
      return { ok, provider: 'push', providerId: '', error: ok ? '' : 'Push was not delivered.' };
    }));
    const emailResult = await sendChannel(notice, uid, 'email', async () => {
      const to = emails.get(uid) ?? '';
      if (!to) return { ok: false, provider: 'none' as const, providerId: '', error: 'No email address on file.' };
      const sent = await sendWithBackoff(() => currentMailAdapter().send({ to, subject, text, html }));
      if (sent.ok) await rememberEmail(sent.providerId, notice.parentPath, notice.collection, uid, notice.caseId);
      return sent;
    });
    const pushFailed = !pushResult.ok;
    const emailFailed = !emailResult.ok;
    if (pushFailed || emailFailed) failed += 1;
    const fallback = fallbackChannel(pushFailed, emailFailed);
    if (fallback) {
      await logDelivery({
        parentPath: notice.parentPath,
        collection: notice.collection,
        channel: fallback,
        recipientUid: uid,
        status: 'sent',
        provider: fallback === 'email' ? emailResult.provider : 'push',
        providerId: fallback === 'email' ? emailResult.providerId : '',
        fallback,
        before: 'failed',
      });
    }
  }
  if (recipients.length === 0) failed += 1;
  if (failed > 0) await alertInstitutionAdmins(notice);
  if (notice.collection === 'events') {
    await db().doc(notice.parentPath).set({
      staffUids: recipients,
      formTeacherUid: notice.formTeacherUid,
    }, { merge: true });
  }
  return { recipients: recipients.length, failed };
}

async function sendChannel(
  notice: BuiltNotice,
  uid: string,
  channel: 'push' | 'email',
  run: () => Promise<MailSendResult | { ok: boolean; provider: 'push' | 'none'; providerId: string; error: string }>,
): Promise<{ ok: boolean; provider: string; providerId: string }> {
  await logDelivery({
    parentPath: notice.parentPath,
    collection: notice.collection,
    channel,
    recipientUid: uid,
    status: 'queued',
    provider: channel === 'push' ? 'push' : currentMailAdapter().name,
    providerId: '',
  });
  let result: { ok: boolean; provider: string; providerId: string; error: string };
  try {
    result = await run();
  } catch (error) {
    result = { ok: false, provider: 'none', providerId: '', error: error instanceof Error ? error.message : 'Send failed.' };
  }
  await logDelivery({
    parentPath: notice.parentPath,
    collection: notice.collection,
    channel,
    recipientUid: uid,
    status: result.ok ? 'sent' : 'failed',
    provider: result.provider,
    providerId: result.providerId,
    error: result.error,
    before: 'queued',
  });
  if (!result.ok && channel === 'email' && currentMailEnv().NODE_ENV === 'production') {
    console.error('staff case email failed', { caseId: notice.caseId, recipientUid: uid });
  }
  return result;
}

async function alertInstitutionAdmins(notice: BuiltNotice) {
  const snap = await db().collection('users').where('institutionId', '==', notice.institutionId).limit(40).get();
  const admins = snap.docs.filter(doc => str(doc.data().role) === 'institution_admin');
  const title = 'Staff notice failed';
  const body = 'Open case.';
  if (admins.length === 0) {
    await logDelivery({
      parentPath: notice.parentPath,
      collection: notice.collection,
      channel: 'push',
      recipientUid: '',
      status: 'failed',
      provider: 'push',
      providerId: '',
      error: 'No institution admin is on file.',
    });
    return;
  }
  for (const admin of admins) {
    const report = await pushOnce(admin.id, 'safety', title, body, notice.caseUrl, true).catch(() => null);
    const pushed = (report?.sent ?? 0) > 0;
    await logDelivery({
      parentPath: notice.parentPath,
      collection: notice.collection,
      channel: pushed ? 'push' : 'email',
      recipientUid: admin.id,
      status: pushed ? 'sent' : 'failed',
      provider: pushed ? 'push' : 'none',
      providerId: '',
      error: pushed ? '' : 'Institution admin was not reached.',
    });
    if (!pushed) {
      const email = str(admin.data().email);
      if (!email) continue;
      const sent = await sendWithBackoff(() => currentMailAdapter().send({
        to: email,
        subject: 'Confidential: a staff notice failed',
        text: `A staff notice could not be delivered. Open the case: ${notice.caseUrl}\n\nConfidential, do not forward`,
        html: caseCardHtml({
          typeLabel: 'Staff notice failed',
          fullName: '',
          studentNumber: '',
          classLabel: '',
          photoUrl: '',
          guardians: [],
          description: 'A staff notice could not be delivered. Open the case on a private screen.',
          location: '',
          atIso: new Date(notice.at).toISOString(),
          caseId: notice.caseId,
          caseUrl: notice.caseUrl,
          parentsExcluded: notice.parentsExcluded,
        }),
      })).catch(() => null);
      if (sent?.ok) {
        await logDelivery({
          parentPath: notice.parentPath,
          collection: notice.collection,
          channel: 'email',
          recipientUid: admin.id,
          status: 'sent',
          provider: sent.provider,
          providerId: sent.providerId,
          fallback: 'email',
          before: 'failed',
        });
      }
    }
  }
}

export async function recordMailWebhook(providerId: string, status: 'delivered' | 'opened' | 'failed'): Promise<{ ok: boolean }> {
  const id = providerId.replace(/[^\w.-]/g, '').slice(0, 128);
  if (!id) return { ok: false };
  const snap = await db().doc(`mail_deliveries/${id}`).get();
  if (!snap.exists) return { ok: false };
  const data = snap.data() ?? {};
  const parentPath = str(data.parentPath);
  const collection = data.collection === 'audit' ? 'audit' : 'events';
  if (!parentPath.startsWith('hotline_tickets/') && !parentPath.startsWith('emergency_alerts/')) return { ok: false };
  await logDelivery({
    parentPath,
    collection,
    channel: 'email',
    recipientUid: str(data.recipientUid),
    status,
    provider: 'resend',
    providerId,
    before: 'sent',
    error: status === 'failed' ? 'The provider reported a bounce.' : '',
  });
  return { ok: true };
}
