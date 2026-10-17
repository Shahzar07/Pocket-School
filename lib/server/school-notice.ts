/**
 * Desk-reviewed notices to schools that are not on Poket School.
 * Drafts are created with a report. Email is sent only when a Desk member asks.
 */

import { createHash, randomBytes } from 'node:crypto';
import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  DESK_CONTACT,
  FIND_CONTACT,
  NOTICE_TOKEN_MS,
  SAFETY_FROM,
  cleanSchoolName,
  needsOffPlatformNotice,
  noticeConsent,
  noticeEscalationDue,
  noticeReminderDue,
  noticeSummary,
  publicHttpsUrl,
  schoolNoticeJoinUrl,
  schoolNoticeMessage,
  tokenOpen,
  verifiedSchoolEmail,
} from '../bullying/school-notice';
import { bullyingReceiveAllowed, guardianIdsFor } from '../bullying/policy';
import { GENESIS, emptyLegalHold, type ChainDevice } from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { currentMailAdapter, sendWithBackoff } from '../mail';
import { casePdf } from '../moderation/pdf';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { parentsExcluded } from '../safety/policy';
import { tierOf } from './alert-directory';
import { ActionError } from './actions';
import { appendChain } from './ledger';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function origin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  return (configured || 'https://poketschool.ai').replace(/\/$/, '');
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function schoolIdFor(name: string): string {
  return createHash('sha256').update(cleanSchoolName(name).toLowerCase()).digest('hex').slice(0, 20);
}

interface Actor {
  id: string;
  role: string;
  name: string;
  institutionId: string;
  staffPost: string;
  ageTier: string;
}

async function loadActor(uid: string): Promise<Actor> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const data = snap.data() ?? {};
  return {
    id: uid,
    role: str(data.role) || 'student',
    name: str(data.name) || 'Member',
    institutionId: str(data.institutionId),
    staffPost: str(data.staffPost),
    ageTier: str(data.ageTier),
  };
}

function deskLead(actor: Actor): boolean {
  return actor.role === 'admin' || actor.staffPost === 'safety_desk';
}

async function pushTo(uid: string, title: string, body: string, link: string) {
  if (!uid) return;
  try {
    await sendPush(
      { recipientUid: uid, category: 'safety', title, body, link, force: true },
      { store: adminPushStore(), send: sendToDevice },
    );
  } catch (error) {
    console.error('school notice push failed', error);
  }
}

async function deskTargets(): Promise<string[]> {
  const rota = await db().doc('safety_desk/rota').get();
  const leads = await db().collection('users').where('staffPost', '==', 'safety_desk').limit(10).get();
  const ids = [
    str(rota.data()?.primaryUid),
    str(rota.data()?.backupUid),
    ...leads.docs.map(doc => doc.id),
  ].filter(Boolean);
  return [...new Set(ids)];
}

export async function classifySchool(id: string, name: string): Promise<{ id: string; name: string; onPoket: boolean }> {
  const clean = cleanSchoolName(name);
  const schoolId = id.trim();
  if (schoolId && /^[A-Za-z0-9_-]{1,128}$/.test(schoolId)) {
    const institution = await db().doc(`institutions/${schoolId}`).get();
    if (institution.exists) {
      return { id: schoolId, name: cleanSchoolName(str(institution.data()?.name)) || clean, onPoket: true };
    }
    const directory = await db().doc(`schools/${schoolId}`).get();
    if (directory.exists) {
      return { id: schoolId, name: cleanSchoolName(str(directory.data()?.name)) || clean, onPoket: false };
    }
  }
  if (clean.length < 2) return { id: '', name: '', onPoket: false };
  const storedId = schoolIdFor(clean);
  const existing = await db().doc(`schools/${storedId}`).get();
  if (!existing.exists) {
    await db().doc(`schools/${storedId}`).set({
      name: clean,
      nameLower: clean.toLowerCase(),
      onPoket: false,
      contactEmail: '',
      contactSource: '',
      contactVerified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return { id: storedId, name: clean, onPoket: false };
}

async function logNotice(noticeId: string, actor: { id: string; role: string }, action: string, after: Record<string, unknown>, device: ChainDevice = SERVER_DEVICE) {
  await appendChain({
    parentPath: `schoolNotices/${noticeId}`,
    collection: 'events',
    actorUid: actor.id,
    actorRole: actor.role,
    action,
    diff: { before: {}, after },
    device,
  });
}

async function logTicket(ticketId: string, actor: { id: string; role: string }, action: string, after: Record<string, unknown>, device: ChainDevice = SERVER_DEVICE) {
  const parent = await db().doc(`hotline_tickets/${ticketId}`).get();
  if (!parent.exists) return;
  await appendChain({
    parentPath: `hotline_tickets/${ticketId}`,
    collection: 'events',
    actorUid: actor.id,
    actorRole: actor.role,
    action,
    diff: { before: {}, after },
    device,
  });
}

export async function queueOffPlatformDrafts(input: {
  reportId: string;
  victim: { id: string; name: string; onPoket: boolean };
  bully: { id: string; name: string; onPoket: boolean };
  incidentType: string;
  when: string;
}): Promise<{ drafted: number }> {
  const sides = [
    { side: 'victim' as const, school: input.victim },
    { side: 'bully' as const, school: input.bully },
  ].filter(row => needsOffPlatformNotice(row.school));
  if (sides.length === 0) return { drafted: 0 };
  const existing = await db().collection('schoolNotices').where('reportId', '==', input.reportId).limit(10).get();
  const have = new Set(existing.docs.map(doc => str(doc.data().side)));
  let drafted = 0;
  for (const row of sides) {
    if (have.has(row.side)) continue;
    const ref = db().collection('schoolNotices').doc();
    const now = Date.now();
    await ref.set({
      reportId: input.reportId,
      schoolName: row.school.name,
      schoolId: row.school.id,
      side: row.side,
      contact: '',
      contactSource: '',
      consentBy: '',
      sentBy: '',
      sentAt: 0,
      ackAt: 0,
      actionTaken: '',
      status: 'find_contact',
      channel: '',
      incidentType: input.incidentType.slice(0, 80),
      dates: input.when.slice(0, 200),
      summary: '',
      tokenHash: '',
      tokenExpiresAt: 0,
      remindedAt: 0,
      escalatedAt: 0,
      chainSeq: 0,
      chainHead: GENESIS,
      legalHold: emptyLegalHold(),
      createdAt: now,
      updatedAt: now,
    });
    await logNotice(ref.id, { id: 'system', role: 'system' }, 'school_notice_drafted', {
      reportId: input.reportId,
      schoolName: row.school.name,
      side: row.side,
      status: 'find_contact',
    });
    drafted += 1;
  }
  if (drafted > 0) {
    for (const uid of await deskTargets()) {
      await pushTo(uid, 'Safety Desk', `${FIND_CONTACT}. A school notice is waiting for review. Nothing was sent.`, '/dashboard/safety');
    }
  }
  return { drafted };
}

export async function searchSchools(uid: string, query: string) {
  bullyingReceiveAllowed();
  await loadActor(uid);
  const q = query.trim().toLowerCase().slice(0, 80);
  if (q.length < 2) return { schools: [] as { id: string; name: string; onPoket: boolean }[] };
  const [directory, institutions] = await Promise.all([
    db().collection('schools').limit(50).get(),
    db().collection('institutions').limit(40).get(),
  ]);
  const schools = [
    ...institutions.docs.flatMap(doc => {
      const name = cleanSchoolName(str(doc.data().name));
      if (!name.toLowerCase().includes(q)) return [];
      return [{ id: doc.id, name, onPoket: true }];
    }),
    ...directory.docs.flatMap(doc => {
      const name = cleanSchoolName(str(doc.data().name));
      if (!name.toLowerCase().includes(q)) return [];
      return [{ id: doc.id, name, onPoket: false }];
    }),
  ].slice(0, 8);
  return { schools };
}

async function guardiansFor(studentId: string, ticket: FirebaseFirestore.DocumentData) {
  const exclusion = {
    type: str(ticket.safetyType),
    who: str(ticket.who),
    concernRole: str(ticket.concernRole),
    dontTellParents: ticket.dontTellParents === true || ticket.parentsExcluded === true,
  };
  const linkSnap = await db().collection('parent_links').where('studentId', '==', studentId).limit(20).get();
  const links = [];
  for (const doc of linkSnap.docs) {
    const parentId = str(doc.data().parentId);
    if (!parentId) continue;
    const parent = await db().doc(`users/${parentId}`).get();
    links.push({ parentId, status: str(doc.data().status), tier: tierOf(parent.data()) });
  }
  const reporter = await db().doc(`users/${studentId}`).get();
  const ageTier = str(reporter.data()?.ageTier);
  return {
    ageTier,
    reporterName: str(reporter.data()?.name),
    ...guardianIdsFor({
      under18: ageTier === 'under13' || ageTier === 'teen',
      links,
      exclusion,
    }),
  };
}

export async function schoolConsentOffer(uid: string, reportId: string): Promise<{ canGrant: boolean }> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) return { canGrant: false };
  try {
    const ticket = await db().doc(`hotline_tickets/${reportId}`).get();
    if (!ticket.exists) return { canGrant: false };
    const data = ticket.data() ?? {};
    const studentId = str(data.reporterUid);
    if (!studentId || studentId === uid) return { canGrant: false };
    const guardians = await guardiansFor(studentId, data);
    if (guardians.ageTier !== 'under13' || guardians.excluded || !guardians.ids.includes(uid)) return { canGrant: false };
    if (str(data.schoolNoticeGuardianId) === uid) return { canGrant: false };
    const offPlatform = needsOffPlatformNotice({ name: str(data.victimSchoolName), onPoket: data.victimSchoolOnPoket === true })
      || needsOffPlatformNotice({ name: str(data.bullySchoolName), onPoket: data.bullySchoolOnPoket === true });
    return { canGrant: offPlatform };
  } catch (error) {
    console.error('school consent offer', error);
    return { canGrant: false };
  }
}

export async function grantSchoolNoticeConsent(uid: string, reportId: string) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const ticket = await db().doc(`hotline_tickets/${reportId}`).get();
  if (!ticket.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  const data = ticket.data() ?? {};
  const studentId = str(data.reporterUid);
  const guardians = await guardiansFor(studentId, data);
  if (guardians.ageTier !== 'under13') throw new ActionError('BAD_REQUEST', 'The student agrees for themselves from age 13.');
  if (guardians.excluded || !guardians.ids.includes(actor.id)) {
    throw new ActionError('FORBIDDEN', 'A guardian who is allowed to be told has to agree.');
  }
  await ticket.ref.set({ schoolNoticeGuardianId: actor.id, updatedAt: Date.now() }, { merge: true });
  await logTicket(reportId, actor, 'school_notice_guardian_consent', { consentBy: 'guardian' });
  return { ok: true };
}

async function pageText(url: string): Promise<string> {
  const clean = publicHttpsUrl(url);
  if (!clean) return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(clean, { signal: controller.signal, redirect: 'manual' });
    if (!response.ok) return '';
    return (await response.text()).slice(0, 200_000);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function publicNotice(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    schoolName: str(data.schoolName),
    incidentType: str(data.incidentType),
    dates: str(data.dates),
    summary: str(data.summary),
    status: str(data.status),
    deskContact: DESK_CONTACT,
    reporterHidden: true as const,
  };
}

export async function reviewSchoolNotice(uid: string, input: Record<string, unknown>) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'The Safety Desk reviews a school notice.');
  const reportId = str(input.reportId);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) throw new ActionError('BAD_REQUEST', 'Choose a report.');
  const side = str(input.side) === 'bully' ? 'bully' : 'victim';
  const ticketSnap = await db().doc(`hotline_tickets/${reportId}`).get();
  if (!ticketSnap.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  const ticket = ticketSnap.data() ?? {};
  const school = side === 'bully'
    ? { id: str(ticket.bullySchoolId), name: str(ticket.bullySchoolName), onPoket: ticket.bullySchoolOnPoket === true }
    : { id: str(ticket.victimSchoolId), name: str(ticket.victimSchoolName), onPoket: ticket.victimSchoolOnPoket === true };
  if (school.onPoket) throw new ActionError('BAD_REQUEST', 'That school is on Poket School. Use the safeguarding referral.');
  if (!needsOffPlatformNotice(school)) throw new ActionError('BAD_REQUEST', 'Add the school name on the report first.');
  const reporterUid = str(ticket.reporterUid);
  const guardians = await guardiansFor(reporterUid, ticket);
  const decision = noticeConsent({
    ageTier: guardians.ageTier,
    studentConsent: ticket.schoolNoticeConsent === true,
    guardianConsent: guardians.ids.includes(str(ticket.schoolNoticeGuardianId)),
    guardianExcluded: guardians.excluded || ticket.parentsExcluded === true,
    seriousRisk: input.seriousRisk === true,
    overrideReason: str(input.overrideReason),
  });
  if (!decision.ok) throw new ActionError('BAD_REQUEST', decision.error);
  const summary = noticeSummary(str(input.summary), guardians.reporterName);
  if (!summary.ok) throw new ActionError('BAD_REQUEST', summary.error);
  const existing = await db().collection('schoolNotices').where('reportId', '==', reportId).limit(10).get();
  const current = existing.docs.find(doc => str(doc.data().side) === side);
  const ref = current?.ref ?? db().collection('schoolNotices').doc();
  const now = Date.now();
  const channel = str(input.channel) === 'phone' || str(input.channel) === 'letter' ? str(input.channel) : 'email';
  const consentUid = decision.consentBy === 'desk_override'
    ? actor.id
    : decision.consentBy === 'guardian'
      ? str(ticket.schoolNoticeGuardianId)
      : reporterUid;
  const base = {
    reportId,
    schoolName: school.name,
    schoolId: school.id,
    side,
    consentBy: consentUid,
    incidentType: str(input.incidentType).slice(0, 80) || str(ticket.safetyType) || 'bullying',
    dates: str(input.dates).slice(0, 200) || str(ticket.when),
    summary: summary.summary,
    updatedAt: now,
  };
  const logOverride = async () => {
    if (decision.consentBy !== 'desk_override') return;
    const reason = str(input.overrideReason).slice(0, 500);
    await logTicket(reportId, actor, 'school_notice_override', { reason, side });
    await logNotice(ref.id, actor, 'school_notice_override', { reason });
  };
  if (channel !== 'email') {
    const source = publicHttpsUrl(str(input.sourceUrl));
    if (!source) throw new ActionError('BAD_REQUEST', 'Add the https page you used. A phone number or address is not guessed.');
    if (input.reached !== true) {
      await ref.set({
        ...base,
        contact: '',
        contactSource: source,
        status: 'find_contact',
        channel,
        sentBy: '',
        sentAt: 0,
        ackAt: 0,
        actionTaken: '',
        ...(current ? {} : { chainSeq: 0, chainHead: GENESIS, legalHold: emptyLegalHold(), createdAt: now, remindedAt: 0, escalatedAt: 0, tokenHash: '', tokenExpiresAt: 0 }),
      }, { merge: true });
      await logNotice(ref.id, actor, 'school_notice_attempt', { channel, status: 'find_contact', task: FIND_CONTACT });
      return { id: ref.id, status: 'find_contact' as const, task: FIND_CONTACT };
    }
    const token = randomBytes(24).toString('hex');
    await ref.set({
      ...base,
      contact: channel,
      contactSource: source,
      status: 'sent',
      channel,
      sentBy: actor.id,
      sentAt: now,
      ackAt: 0,
      actionTaken: '',
      token,
      tokenHash: tokenHash(token),
      tokenExpiresAt: now + NOTICE_TOKEN_MS,
      remindedAt: 0,
      escalatedAt: 0,
      ...(current ? {} : { chainSeq: 0, chainHead: GENESIS, legalHold: emptyLegalHold(), createdAt: now }),
    }, { merge: true });
    await ticketSnap.ref.set({ schoolInformedAt: now, updatedAt: now }, { merge: true });
    await logNotice(ref.id, actor, 'school_notice_logged', { channel, schoolName: school.name });
    await logTicket(reportId, actor, 'school_notice_logged', { channel, schoolName: school.name, side, reporterHidden: true });
    await logOverride();
    return { id: ref.id, status: 'sent' as const, ackUrl: `${origin()}/school-notice/${token}` };
  }
  if (input.send !== true) {
    await ref.set({
      ...base,
      contact: '',
      contactSource: '',
      status: 'draft',
      channel: 'email',
      sentBy: '',
      sentAt: 0,
      ...(current ? {} : { ackAt: 0, actionTaken: '', chainSeq: 0, chainHead: GENESIS, legalHold: emptyLegalHold(), createdAt: now, remindedAt: 0, escalatedAt: 0, tokenHash: '', tokenExpiresAt: 0 }),
    }, { merge: true });
    await logNotice(ref.id, actor, 'school_notice_reviewed', { status: 'draft', schoolName: school.name });
    return { id: ref.id, status: 'draft' as const };
  }
  const email = str(input.email).toLowerCase();
  const sourceUrl = str(input.sourceUrl);
  const text = await pageText(sourceUrl);
  const verified = verifiedSchoolEmail({ email, sourceUrl, pageText: text });
  if (!verified.ok) {
    await ref.set({
      ...base,
      contact: '',
      contactSource: publicHttpsUrl(sourceUrl),
      status: 'find_contact',
      channel: 'email',
      sentBy: '',
      sentAt: 0,
      ...(current ? {} : { ackAt: 0, actionTaken: '', chainSeq: 0, chainHead: GENESIS, legalHold: emptyLegalHold(), createdAt: now, remindedAt: 0, escalatedAt: 0, tokenHash: '', tokenExpiresAt: 0 }),
    }, { merge: true });
    await logNotice(ref.id, actor, 'school_notice_find_contact', { task: FIND_CONTACT });
    return { id: ref.id, status: 'find_contact' as const, task: FIND_CONTACT };
  }
  if (school.id) {
    await db().doc(`schools/${school.id}`).set({
      contactEmail: verified.email,
      contactSource: verified.sourceUrl,
      contactVerified: true,
      updatedAt: now,
    }, { merge: true });
  }
  const token = randomBytes(24).toString('hex');
  const ackUrl = `${origin()}/school-notice/${token}`;
  let evidenceAttached = false;
  const attachments: { filename: string; content: string }[] = [];
  const evidenceId = str(input.evidenceId);
  if (evidenceId && /^[A-Za-z0-9_-]{1,128}$/.test(evidenceId)) {
    const evidence = await db().doc(`evidence_locker/${evidenceId}`).get();
    if (!evidence.exists) throw new ActionError('BAD_REQUEST', 'That evidence cannot be attached.');
    const note = str(evidence.data()?.note);
    if (guardians.reporterName && note.toLowerCase().includes(guardians.reporterName.toLowerCase())) {
      throw new ActionError('BAD_REQUEST', 'That evidence names the reporter. Leave it off the notice.');
    }
    const bytes = casePdf([
      'Poket School evidence record',
      `Platform: ${str(evidence.data()?.platform) || 'other'}`,
      `Recorded: ${new Date(Number(evidence.data()?.createdAt) || now).toISOString()}`,
      `SHA-256: ${str(evidence.data()?.hash)}`,
      note.slice(0, 100),
      'The reporter is not named.',
    ]);
    attachments.push({ filename: 'poket-school-evidence.pdf', content: Buffer.from(bytes).toString('base64') });
    evidenceAttached = true;
  }
  const message = schoolNoticeMessage({
    schoolName: school.name,
    incidentType: base.incidentType,
    dates: base.dates,
    summary: summary.summary,
    ackUrl,
    joinUrl: schoolNoticeJoinUrl(origin()),
    evidenceAttached,
  });
  if (guardians.reporterName && message.text.toLowerCase().includes(guardians.reporterName.toLowerCase())) {
    throw new ActionError('BAD_REQUEST', 'Take the reporter’s name out of the notice.');
  }
  const mailed = await sendWithBackoff(() => currentMailAdapter().send({
    to: verified.email,
    from: SAFETY_FROM,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments,
  }));
  if (!mailed.ok) throw new ActionError('BAD_REQUEST', 'The notice was not sent. The school was not emailed.');
  await ref.set({
    ...base,
    contact: verified.email,
    contactSource: verified.sourceUrl,
    status: 'sent',
    channel: 'email',
    sentBy: actor.id,
    sentAt: now,
    ackAt: 0,
    actionTaken: '',
    token,
    tokenHash: tokenHash(token),
    tokenExpiresAt: now + NOTICE_TOKEN_MS,
    remindedAt: 0,
    escalatedAt: 0,
    ...(current ? {} : { chainSeq: 0, chainHead: GENESIS, legalHold: emptyLegalHold(), createdAt: now }),
  }, { merge: true });
  await ticketSnap.ref.set({ schoolInformedAt: now, updatedAt: now }, { merge: true });
  const audit = { schoolName: school.name, side, channel: 'email', reporterHidden: true };
  await logNotice(ref.id, actor, 'school_notice_sent', audit);
  await logTicket(reportId, actor, 'school_notice_sent', audit);
  await logOverride();
  return { id: ref.id, status: 'sent' as const };
}

export async function listSchoolNotices(uid: string, reportId: string) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'The Safety Desk reviews school notices.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) return { notices: [] };
  const snap = await db().collection('schoolNotices').where('reportId', '==', reportId).limit(10).get();
  return {
    notices: snap.docs.map(doc => {
      const data = doc.data();
      const status = str(data.status);
      return {
        id: doc.id,
        schoolName: str(data.schoolName),
        side: str(data.side),
        status,
        task: status === 'find_contact' ? FIND_CONTACT : '',
        contact: status === 'sent' || status === 'reminded' || status === 'escalated' || status === 'acknowledged' ? str(data.contact) : '',
        contactSource: str(data.contactSource),
        sentAt: Number(data.sentAt) || 0,
        ackAt: Number(data.ackAt) || 0,
      };
    }),
  };
}

export async function readPublicSchoolNotice(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const snap = await db().collection('schoolNotices').where('tokenHash', '==', tokenHash(token)).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  if (!tokenOpen(Number(data.tokenExpiresAt) || 0, Date.now())) return { expired: true as const };
  return { expired: false as const, ...publicNotice(doc.id, data) };
}

export async function acknowledgeSchoolNotice(token: string, actionTaken: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new ActionError('NOT_FOUND', 'This link is not available.');
  const snap = await db().collection('schoolNotices').where('tokenHash', '==', tokenHash(token)).limit(1).get();
  if (snap.empty) throw new ActionError('NOT_FOUND', 'This link is not available.');
  const doc = snap.docs[0];
  const data = doc.data();
  if (!tokenOpen(Number(data.tokenExpiresAt) || 0, Date.now())) throw new ActionError('BAD_REQUEST', 'This link has expired.');
  const action = actionTaken.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (action.length < 2) throw new ActionError('BAD_REQUEST', 'Write the action the school took.');
  const now = Date.now();
  await doc.ref.set({ ackAt: now, actionTaken: action, status: 'acknowledged', updatedAt: now }, { merge: true });
  await logNotice(doc.id, { id: 'school', role: 'school' }, 'school_notice_ack', { ackAt: now });
  const reportId = str(data.reportId);
  if (reportId) await logTicket(reportId, { id: 'school', role: 'school' }, 'school_notice_ack', { schoolName: str(data.schoolName) });
  return { ok: true };
}

async function mailReminder(data: FirebaseFirestore.DocumentData, ackUrl: string) {
  const contact = str(data.contact);
  if (!contact.includes('@')) return false;
  const message = schoolNoticeMessage({
    schoolName: str(data.schoolName),
    incidentType: str(data.incidentType),
    dates: str(data.dates),
    summary: str(data.summary),
    ackUrl,
    joinUrl: schoolNoticeJoinUrl(origin()),
    reminder: true,
  });
  const mailed = await sendWithBackoff(() => currentMailAdapter().send({
    to: contact,
    from: SAFETY_FROM,
    subject: message.subject,
    text: message.text,
    html: message.html,
  }));
  return mailed.ok;
}

export async function remindSchoolNotices(now = Date.now()) {
  const snap = await db().collection('schoolNotices').where('status', '==', 'sent').limit(40).get();
  let reminded = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!noticeReminderDue(Number(data.sentAt) || 0, Number(data.remindedAt) || 0, Number(data.ackAt) || 0, now)) continue;
    let emailed = false;
    const savedToken = str(data.token);
    if (str(data.channel) === 'email' && str(data.contact).includes('@') && /^[a-f0-9]{48}$/.test(savedToken)) {
      emailed = await mailReminder(data, `${origin()}/school-notice/${savedToken}`);
    }
    await doc.ref.set({ status: 'reminded', remindedAt: now, updatedAt: now }, { merge: true });
    await logNotice(doc.id, { id: 'system', role: 'system' }, 'school_notice_reminder', { emailed });
    if (!emailed) {
      for (const uid of await deskTargets()) {
        await pushTo(uid, 'Safety Desk', 'Remind the school. No acknowledgement yet, and no email is on file.', '/dashboard/safety');
      }
    }
    reminded += 1;
  }
  return { schoolReminded: reminded };
}

export async function escalateSchoolNotices(now = Date.now()) {
  const snap = await db().collection('schoolNotices').where('status', 'in', ['sent', 'reminded']).limit(40).get();
  let escalated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!noticeEscalationDue(Number(data.sentAt) || 0, Number(data.ackAt) || 0, Number(data.escalatedAt) || 0, now)) continue;
    await doc.ref.set({ status: 'escalated', escalatedAt: now, updatedAt: now }, { merge: true });
    await logNotice(doc.id, { id: 'system', role: 'system' }, 'school_notice_escalated', { schoolName: str(data.schoolName) });
    for (const uid of await deskTargets()) {
      await pushTo(uid, 'Safety Desk', 'A school notice has had no acknowledgement for 7 working days.', `/dashboard/safety/${str(data.reportId)}`);
    }
    escalated += 1;
  }
  return { schoolEscalated: escalated };
}
