/**
 * Anti-bullying writes. Reports still go through fileSafetyReport.
 * Evidence, referrals, and check-ins are server-only. Clients cannot read them.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { tierOf } from './alert-directory';
import { alertPerson, resolveRecipients } from '../alerts/recipients';
import { GENESIS, emptyLegalHold, type ChainDevice } from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { casePdf } from '../moderation/pdf';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { parentsExcluded } from '../safety/policy';
import {
  NOT_A_COUNSELLOR,
  OFF_PLATFORM_STEPS,
  PLATFORM_REPORT_LINKS,
  SAMPLE_BULLYING_CODE,
  bullyingReceiveAllowed,
  canSeeEvidence,
  checkInDue,
  criticalNeedsEscalation,
  deskOpen,
  evidenceHash,
  guardianIdsFor,
  helpNearMe,
  helplinesForCountry,
  schoolReferralPayload,
  supportResponse,
} from '../bullying/policy';
import { ActionError } from './actions';
import { appendChain } from './ledger';
import { fileSafetyReport } from './safety';

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
  country: string;
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
    country: str(data.country),
    ageTier: str(data.ageTier),
  };
}

function deskLead(actor: Actor): boolean {
  return actor.role === 'admin' || actor.staffPost === 'safety_desk';
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

async function countryOf(actor: Actor): Promise<string> {
  if (actor.country) return actor.country;
  if (!actor.institutionId) return '';
  const snap = await db().doc(`institutions/${actor.institutionId}`).get();
  return str(snap.data()?.country);
}

async function pushTo(uid: string, title: string, body: string, link: string) {
  if (!uid) return;
  try {
    await sendPush(
      { recipientUid: uid, category: 'safety', title, body, link, force: true },
      { store: adminPushStore(), send: sendToDevice },
    );
  } catch (error) {
    console.error('bullying push failed', error);
  }
}

function imageBytes(value: unknown): Uint8Array {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return new Uint8Array();
  const body = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  if (body.length > 200_000) throw new ActionError('BAD_REQUEST', 'That screenshot is too large. Keep it under 150 KB.');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(body)) throw new ActionError('BAD_REQUEST', 'The screenshot must be a base64 image.');
  return new Uint8Array(Buffer.from(body.replace(/\s/g, ''), 'base64'));
}

const PLATFORMS = new Set(['whatsapp', 'instagram', 'tiktok', 'in_person', 'other']);

export async function bullyingGuide(uid: string) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const country = await countryOf(actor);
  const now = Date.now();
  return {
    label: NOT_A_COUNSELLOR,
    country,
    deskOpen: deskOpen(now),
    steps: [...OFF_PLATFORM_STEPS],
    platforms: PLATFORM_REPORT_LINKS.map(link => ({ ...link })),
    helplines: helplinesForCountry(country),
    near: helpNearMe(country),
    free: true,
  };
}

export async function supportChat(uid: string, input: Record<string, unknown>) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const text = str(input.text).slice(0, 4000);
  if (text.length < 1) throw new ActionError('BAD_REQUEST', 'Write a short message.');
  const country = await countryOf(actor);
  const now = Date.now();
  const response = supportResponse(text, country, now);
  let ticketId = '';
  if (response.severity === 'critical') {
    try {
      const filed = await fileSafetyReport(uid, {
        type: 'self_harm_concern',
        description: text,
        anonymous: input.anonymous === true,
        device: input.device,
      });
      ticketId = filed.id;
    } catch (error) {
      console.error('risk report failed', error);
    }
  }
  return {
    ...response,
    ticketId,
    helplines: response.showHelplines ? helplinesForCountry(country) : [],
    near: response.showHelpNearMe ? helpNearMe(country) : null,
  };
}

async function guardiansFor(actor: Actor, exclusion: {
  type: string;
  who: string;
  concernRole: string;
  dontTellParents: boolean;
}) {
  const linkSnap = await db().collection('parent_links').where('studentId', '==', actor.id).limit(20).get();
  const links = [];
  for (const doc of linkSnap.docs) {
    const parentId = str(doc.data().parentId);
    if (!parentId) continue;
    const parent = await db().doc(`users/${parentId}`).get();
    links.push({ parentId, status: str(doc.data().status), tier: tierOf(parent.data()) });
  }
  return guardianIdsFor({
    under18: actor.ageTier === 'under13' || actor.ageTier === 'teen',
    links,
    exclusion,
  });
}

export async function storeEvidence(uid: string, input: Record<string, unknown>) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const note = str(input.note).slice(0, 4000);
  const platform = str(input.platform) || 'other';
  if (!PLATFORMS.has(platform)) throw new ActionError('BAD_REQUEST', 'Choose WhatsApp, Instagram, TikTok, in person, or other.');
  if (note.length < 1 && !str(input.imageBase64)) throw new ActionError('BAD_REQUEST', 'Add a note or a screenshot.');
  const bytes = imageBytes(input.imageBase64);
  const at = Date.now();
  const hash = evidenceHash(note, bytes, at);
  const exclusion = {
    type: str(input.type) || 'bullying',
    who: str(input.who).slice(0, 200),
    concernRole: str(input.concernRole).slice(0, 40),
    dontTellParents: input.dontTellParents === true,
  };
  const guardians = await guardiansFor(actor, exclusion);
  const ref = db().collection('evidence_locker').doc();
  const imageBase64 = bytes.length > 0 ? Buffer.from(bytes).toString('base64') : '';
  await ref.set({
    ownerId: actor.id,
    note,
    platform,
    hash,
    createdAt: at,
    guardianIds: guardians.ids,
    parentsExcluded: guardians.excluded || parentsExcluded(exclusion),
    imageBase64,
    chainSeq: 0,
    chainHead: GENESIS,
    legalHold: emptyLegalHold(),
  });
  await appendChain({
    parentPath: `evidence_locker/${ref.id}`,
    collection: 'events',
    actorUid: actor.id,
    actorRole: actor.role,
    action: 'evidence_saved',
    diff: { before: {}, after: { hash, platform, at } },
    device: deviceOf(input),
  });
  return { id: ref.id, hash, createdAt: at, platform };
}

function evidenceView(id: string, data: FirebaseFirestore.DocumentData, includeImage: boolean) {
  return {
    id,
    note: str(data.note),
    platform: str(data.platform),
    hash: str(data.hash),
    createdAt: Number(data.createdAt) || 0,
    imageBase64: includeImage ? str(data.imageBase64) : '',
  };
}

export async function listEvidence(uid: string, ownerId = '') {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const requested = ownerId.trim();
  if (requested && requested !== actor.id && !deskLead(actor)) {
    throw new ActionError('FORBIDDEN', 'That locker is private.');
  }
  const owned = requested
    ? await db().collection('evidence_locker').where('ownerId', '==', requested).limit(30).get()
    : await db().collection('evidence_locker').where('ownerId', '==', actor.id).limit(30).get();
  const shared = requested
    ? { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }
    : await db().collection('evidence_locker').where('guardianIds', 'array-contains', actor.id).limit(30).get();
  const rows = [...owned.docs, ...shared.docs];
  const seen = new Set<string>();
  const items = [];
  for (const doc of rows) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const data = doc.data();
    const allowed = canSeeEvidence(
      { id: actor.id, role: actor.role, staffPost: actor.staffPost },
      {
        ownerId: str(data.ownerId),
        guardianIds: Array.isArray(data.guardianIds) ? data.guardianIds.filter((item): item is string => typeof item === 'string') : [],
        parentsExcluded: data.parentsExcluded === true,
      },
    );
    if (!allowed) continue;
    items.push(evidenceView(doc.id, data, false));
  }
  return { items };
}

async function loadVisibleEvidence(uid: string, id: string) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const snap = await db().doc(`evidence_locker/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Evidence not found.');
  const data = snap.data() ?? {};
  const allowed = canSeeEvidence(
    { id: actor.id, role: actor.role, staffPost: actor.staffPost },
    {
      ownerId: str(data.ownerId),
      guardianIds: Array.isArray(data.guardianIds) ? data.guardianIds.filter((item): item is string => typeof item === 'string') : [],
      parentsExcluded: data.parentsExcluded === true,
    },
  );
  if (!allowed) throw new ActionError('FORBIDDEN', 'That locker is private.');
  return { actor, data };
}

export async function evidencePdf(uid: string, id: string): Promise<Uint8Array> {
  const { data } = await loadVisibleEvidence(uid, id);
  const at = Number(data.createdAt) || 0;
  const note = str(data.note);
  const chunks: string[] = [];
  const clean = note.replace(/\s+/g, ' ').trim();
  for (let index = 0; index < clean.length && chunks.length < 8; index += 100) {
    chunks.push(clean.slice(index, index + 100));
  }
  return casePdf([
    'Poket School evidence record',
    `Platform: ${str(data.platform) || 'other'}`,
    `Recorded: ${at ? new Date(at).toISOString() : ''}`,
    `SHA-256: ${str(data.hash)}`,
    ...chunks,
    'For the saver, an allowed guardian, or the Safety Desk.',
  ]);
}

function otherId(uid: string, targetId: string): string {
  const id = targetId.trim();
  if (!id || id === uid) throw new ActionError('BAD_REQUEST', 'Choose another account.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ActionError('BAD_REQUEST', 'Choose another account.');
  return id;
}

export async function blockPerson(uid: string, targetId: string) {
  bullyingReceiveAllowed();
  const id = otherId(uid, targetId);
  await db().doc(`network_blocks/${uid}_${id}`).set({ userId: uid, targetId: id, createdAtMs: Date.now() });
  return { ok: true };
}

export async function mutePerson(uid: string, targetId: string) {
  bullyingReceiveAllowed();
  const id = otherId(uid, targetId);
  await db().doc(`network_mutes/${uid}_${id}`).set({ userId: uid, targetId: id, createdAtMs: Date.now() });
  return { ok: true };
}

export async function restrictPerson(uid: string, targetId: string) {
  bullyingReceiveAllowed();
  const id = otherId(uid, targetId);
  await db().doc(`network_restricts/${uid}_${id}`).set({ userId: uid, targetId: id, createdAtMs: Date.now() });
  return { ok: true };
}

export async function deskRestrictComments(uid: string, targetId: string, on: boolean) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'A Safety Desk lead sets this limit.');
  const id = otherId(uid, targetId);
  await db().doc(`account_limits/${id}`).set({
    commentRestricted: on,
    review: true,
    punish: false,
    updatedAt: Date.now(),
  }, { merge: true });
  return { ok: true, commentRestricted: on };
}

export async function sendSchoolReferral(uid: string, input: Record<string, unknown>) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  if (!deskLead(actor)) throw new ActionError('FORBIDDEN', 'The Safety Desk sends a school referral.');
  const built = schoolReferralPayload({
    bullySchoolId: str(input.bullySchoolId),
    consent: input.consent === true,
    where: str(input.where),
    summary: str(input.summary),
  });
  if (!built.ok) throw new ActionError('BAD_REQUEST', built.error);
  const school = await db().doc(`institutions/${built.payload.bullySchoolId}`).get();
  if (!school.exists) throw new ActionError('BAD_REQUEST', 'That school is not on Poket School.');
  const leads = await db().collection('users')
    .where('institutionId', '==', built.payload.bullySchoolId)
    .where('staffPost', '==', 'safeguarding_lead')
    .limit(5)
    .get();
  const leadUids = leads.docs.map(doc => doc.id);
  const ref = db().collection('school_referrals').doc();
  await ref.set({
    ...built.payload,
    leadUids,
    sentBy: actor.id,
    createdAt: Date.now(),
  });
  const ticketId = str(input.ticketId);
  if (ticketId && /^[A-Za-z0-9_-]{1,128}$/.test(ticketId)) {
    const ticket = await db().doc(`hotline_tickets/${ticketId}`).get();
    if (ticket.exists) {
      await appendChain({
        parentPath: `hotline_tickets/${ticketId}`,
        collection: 'events',
        actorUid: actor.id,
        actorRole: actor.role,
        action: 'school_referral',
        diff: {
          before: {},
          after: { referralId: ref.id, bullySchoolId: built.payload.bullySchoolId, reporterHidden: true },
        },
        device: deviceOf(input),
      });
    }
  }
  for (const leadId of leadUids) {
    await pushTo(
      leadId,
      'Safeguarding referral',
      'A referral arrived. The reporter is not named.',
      '/dashboard/safety',
    );
  }
  return { id: ref.id, leadCount: leadUids.length, reporterHidden: true as const };
}

export async function readSchoolReferral(uid: string, id: string) {
  bullyingReceiveAllowed();
  const actor = await loadActor(uid);
  const snap = await db().doc(`school_referrals/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Referral not found.');
  const data = snap.data() ?? {};
  const schoolId = str(data.bullySchoolId);
  const lead = actor.staffPost === 'safeguarding_lead' && actor.institutionId === schoolId;
  if (!deskLead(actor) && !lead) throw new ActionError('FORBIDDEN', 'You cannot open this referral.');
  return {
    id,
    bullySchoolId: schoolId,
    where: str(data.where),
    summary: str(data.summary),
    reporterHidden: true as const,
  };
}

export async function escalateCriticalDesk(now = Date.now()) {
  const snap = await db().collection('hotline_tickets').where('deskSeverity', '==', 'critical').limit(50).get();
  const rota = await db().doc('safety_desk/rota').get();
  const backupUid = str(rota.data()?.backupUid);
  const admins = await db().collection('users').where('role', '==', 'admin').limit(20).get();
  let escalated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (str(data.addressedTo) !== 'safety_desk') continue;
    if (str(data.status) === 'closed' || str(data.status) === 'resolved') continue;
    if (!criticalNeedsEscalation(
      Number(data.createdAt) || 0,
      Number(data.staffAckAt) || 0,
      Number(data.deskEscalatedAt) || 0,
      now,
    )) continue;
    const people = admins.docs.map(admin => alertPerson({ uid: admin.id, role: 'admin' }));
    const audience = resolveRecipients({
      kind: 'safety_desk',
      institutionId: '',
      people,
      primaryUid: str(rota.data()?.primaryUid),
      backupUid,
      escalate: true,
      exclusion: { type: 'bullying', who: '', concernRole: '', dontTellParents: false },
    });
    await doc.ref.set({ deskEscalatedAt: now, updatedAt: now }, { merge: true });
    await appendChain({
      parentPath: `hotline_tickets/${doc.id}`,
      collection: 'events',
      actorUid: 'system',
      actorRole: 'system',
      action: 'desk_escalated',
      diff: {
        before: { deskEscalatedAt: 0 },
        after: { deskEscalatedAt: now, reason: 'critical SLA with no acknowledgement' },
      },
      device: SERVER_DEVICE,
    });
    const targets = new Set<string>([...audience.staffUids, backupUid]);
    for (const staffId of targets) {
      if (!staffId) continue;
      await pushTo(staffId, 'Safety Desk', 'A critical report is past 15 minutes with no acknowledgement.', `/dashboard/safety/${doc.id}`);
    }
    escalated += 1;
  }
  return { deskEscalated: escalated };
}

export async function sendDueCheckIns(now = Date.now()) {
  const snap = await db().collection('hotline_tickets').orderBy('createdAt', 'desc').limit(80).get();
  let sent = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const source = str(data.source);
    if (source !== 'student_safety_report' && source !== 'danger_now') continue;
    const status = str(data.status);
    if (status === 'closed' || status === 'resolved') continue;
    const reporterUid = str(data.reporterUid);
    if (!reporterUid) continue;
    const checkIns = Array.isArray(data.checkIns) ? data.checkIns : [];
    let due = 0;
    const next = checkIns.map(row => {
      if (!row || typeof row !== 'object') return row;
      const item = row as { dueAt?: unknown; sentAt?: unknown };
      const dueAt = Number(item.dueAt) || 0;
      const sentAt = Number(item.sentAt) || 0;
      if (!checkInDue(dueAt, sentAt, now)) return { dueAt, sentAt };
      due += 1;
      return { dueAt, sentAt: now };
    });
    if (due === 0) continue;
    await db().runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const current = Array.isArray(fresh.data()?.checkIns) ? fresh.data()?.checkIns as unknown[] : [];
      const stamped = current.map(row => {
        if (!row || typeof row !== 'object') return row;
        const item = row as { dueAt?: unknown; sentAt?: unknown };
        const dueAt = Number(item.dueAt) || 0;
        const sentAt = Number(item.sentAt) || 0;
        if (!checkInDue(dueAt, sentAt, now)) return { dueAt, sentAt };
        return { dueAt, sentAt: now };
      });
      tx.set(doc.ref, { checkIns: stamped, updatedAt: now }, { merge: true });
    });
    await appendChain({
      parentPath: `hotline_tickets/${doc.id}`,
      collection: 'events',
      actorUid: 'system',
      actorRole: 'system',
      action: 'check_in_sent',
      diff: { before: {}, after: { sent, count: due } },
      device: SERVER_DEVICE,
    });
    for (let index = 0; index < due; index += 1) {
      await pushTo(reporterUid, 'How are you doing?', 'A check-in from Poket School. You can reply on your report.', '/dashboard/safety');
      sent += 1;
    }
  }
  return { checkInsSent: sent };
}

export async function ensureStandReferral(): Promise<string> {
  const code = SAMPLE_BULLYING_CODE;
  const ref = db().doc(`referrals/${code}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      code,
      ownerUid: '',
      kind: 'bullying',
      createdAt: Date.now(),
      signups: 0,
    });
  }
  return code;
}
