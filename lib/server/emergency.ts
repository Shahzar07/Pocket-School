/**
 * Emergency alerts. A verified principal or admin creates a draft.
 * A different verified staff member confirms it before it is public.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { ActionError } from './actions';
import { sendPush } from '../push';
import { adminPushStore } from '../push-store';
import { sendToDevice } from '../push-transport';
import { createHash } from 'crypto';
import {
  ALERT_AUTHORITY_REMINDER_MS,
  applyAuthorityUpdate,
  authorityOverdue,
  authorityShareReady,
  initialAuthorities,
  type AuthorityDecision,
} from '../authorities/policy';
import { alertAttachmentPublic, alertStoragePath, isAttachmentLabel } from '../attachments/policy';
import { prepareAttachment } from '../attachments/prepare';
import {
  anonymousReportAllowed,
  captchaRequired,
  clampReviewEvery,
  consentProblems,
  DEFAULT_REVIEW_MS,
  losesReportingRights,
  reportAllowed,
  reviewExpired,
  type GuardianConsent,
} from '../emergency/protections';
import {
  DAILY_PUBLISH_CAP,
  EMERGENCY_STATUSES,
  canConfirm,
  canCreate,
  isEmergencyType,
  publicView,
  regionMatch,
  type AuthorityNotice,
  type EmergencyRecord,
  type EmergencyStatus,
  type EmergencyType,
  type Region,
} from '../emergency/policy';
import { bytesFromBase64, imagePass, saveObject, signedRead } from './files';
import {
  GENESIS,
  canManageLegalHold,
  emptyLegalHold,
  internalRedactionBlocked,
  isShareChannel,
  shareRefusal,
  type ChainDevice,
  type ChainDiff,
  type LegalHold,
} from '../ledger/chain';
import { SERVER_DEVICE, hashActor } from '../ledger/device';
import { exportCsv, exportPdf, type ExportFile } from '../ledger/export';
import { appendChain, readChain, verifyStoredChain } from './ledger';

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
  verifiedStaff: boolean;
  country: string;
  state: string;
  city: string;
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
    verifiedStaff: data.verifiedStaff === true || str(data.role) === 'admin',
    country: str(data.country),
    state: str(data.state),
    city: str(data.city),
  };
}

async function institutionRegion(institutionId: string): Promise<Region> {
  const snap = await db().doc(`institutions/${institutionId}`).get();
  const data = snap.data() ?? {};
  return {
    country: str(data.country) || 'Malaysia',
    state: str(data.state),
    city: str(data.city),
  };
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
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

async function audit(
  alertId: string,
  actor: { id: string; role: string },
  action: string,
  diff: ChainDiff,
  device: ChainDevice = SERVER_DEVICE,
) {
  await appendChain({
    parentPath: `emergency_alerts/${alertId}`,
    collection: 'audit',
    actorUid: actor.id,
    actorRole: actor.role,
    action,
    diff,
    device,
  });
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

function statusOf(value: string): EmergencyStatus {
  return (EMERGENCY_STATUSES as readonly string[]).includes(value) ? value as EmergencyStatus : 'draft';
}

function authoritiesFrom(data: FirebaseFirestore.DocumentData): AuthorityDecision {
  const raw = data.authorities as Partial<AuthorityDecision> | undefined;
  if (raw && typeof raw.status === 'string') {
    return {
      required: raw.required === 'yes' || raw.required === 'no' || raw.required === 'unsure' ? raw.required : 'unsure',
      reason: str(raw.reason),
      status: raw.status === 'not_required' || raw.status === 'to_be_informed' || raw.status === 'informed' || raw.status === 'acknowledged' || raw.status === 'closed_by_authority'
        ? raw.status
        : 'to_be_informed',
      informed: raw.informed && str(raw.informed.agency)
        ? {
          agency: str(raw.informed.agency),
          contact: str(raw.informed.contact),
          reference: str(raw.informed.reference),
          at: Number(raw.informed.at) || 0,
          by: str(raw.informed.by),
        }
        : null,
    };
  }
  const legacy = data.authoritiesInformed as AuthorityNotice | null;
  if (legacy && str(legacy.agency)) {
    return {
      required: 'yes',
      reason: '',
      status: 'informed',
      informed: {
        agency: str(legacy.agency),
        contact: '',
        reference: str(legacy.referenceNumber),
        at: Number(legacy.informedAt) || 0,
        by: '',
      },
    };
  }
  return { required: 'unsure', reason: '', status: 'to_be_informed', informed: null };
}

function legacyNotice(decision: AuthorityDecision): AuthorityNotice | null {
  if (!decision.informed) return null;
  return {
    agency: decision.informed.agency,
    referenceNumber: decision.informed.reference,
    informedAt: decision.informed.at,
  };
}

function asRecord(id: string, data: FirebaseFirestore.DocumentData): EmergencyRecord {
  const region = (data.region ?? {}) as Region;
  const authorities = data.authoritiesInformed as AuthorityNotice | null;
  return {
    id,
    institutionId: str(data.institutionId),
    type: (isEmergencyType(str(data.type)) ? str(data.type) : 'general') as EmergencyType,
    title: str(data.title),
    description: str(data.description),
    subjectName: str(data.subjectName),
    region: { country: str(region.country), state: str(region.state), city: str(region.city) },
    photoUrl: str(data.photoUrl),
    guardianConsent: data.guardianConsent === true,
    consentId: str(data.consentId),
    consentWithdrawn: data.consentWithdrawn === true,
    publicRedacted: data.publicRedacted === true,
    authoritiesInformed: authorities && str(authorities.agency) ? authorities : null,
    authorities: authoritiesFrom(data),
    status: statusOf(str(data.status) || 'draft'),
    publishedBy: str(data.publishedBy),
    publishedAt: Number(data.publishedAt) || null,
    confirmedBy: str(data.confirmedBy),
    confirmedAt: Number(data.confirmedAt) || null,
    resolved: data.resolved ?? null,
    publicShareEnabled: data.publicShareEnabled === true,
    sharePaused: data.sharePaused === true,
    reviewEveryMs: Number(data.reviewEveryMs) || DEFAULT_REVIEW_MS,
    reviewDueAt: Number(data.reviewDueAt) || null,
    retractedReason: str(data.retractedReason),
    ogVersion: Number(data.ogVersion) || 1,
    counts: {
      views: Number(data.counts?.views) || 0,
      shares: Number(data.counts?.shares) || 0,
    },
  };
}

async function notifyPeople(record: EmergencyRecord, title: string, body: string, uids: string[]) {
  const seen = new Set<string>();
  for (const uid of uids) {
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    await sendPush({
      recipientUid: uid,
      category: 'emergency',
      title,
      body: body.slice(0, 140),
      link: `/alerts/${record.id}`,
      force: true,
      sound: 'emergency',
    }, { store: adminPushStore(), send: sendToDevice });
  }
  return [...seen];
}

async function audience(record: EmergencyRecord): Promise<string[]> {
  const members = await db().collection('users').where('institutionId', '==', record.institutionId).limit(200).get();
  const targets = members.docs.map(doc => doc.id);
  const nearby = await db().collection('users').where('country', '==', record.region.country).limit(200).get();
  for (const doc of nearby.docs) {
    const data = doc.data();
    if (regionMatch({
      country: str(data.country),
      state: str(data.state),
      city: str(data.city),
    }, record.region)) targets.push(doc.id);
  }
  return targets;
}

async function storeRecipients(alertId: string, uids: string[], now: number) {
  for (const uid of uids) {
    await db().collection(`emergency_alerts/${alertId}/recipients`).doc(uid).set({ uid, at: now });
  }
}

async function notifyRegion(record: EmergencyRecord) {
  const sent = await notifyPeople(record, record.title, record.description, await audience(record));
  await storeRecipients(record.id, sent, Date.now());
}

export async function createAlert(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!canCreate(actor.role, actor.staffPost, actor.verifiedStaff)) {
    throw new ActionError('FORBIDDEN', 'A verified principal or admin creates an emergency alert.');
  }
  const type = str(input.type) === 'missing' ? 'missing_child' : str(input.type);
  if (!isEmergencyType(type)) throw new ActionError('BAD_REQUEST', 'Choose an alert type.');
  const title = str(input.title).slice(0, 120);
  const description = str(input.description).slice(0, 2000);
  if (title.length < 3 || description.length < 3) throw new ActionError('BAD_REQUEST', 'Add a title and a description.');
  const now = Date.now();
  const rateRef = db().doc(`emergency_rate/${uid}_${dayKey(now)}`);
  const rate = await rateRef.get();
  const count = Number(rate.data()?.count) || 0;
  if (count >= DAILY_PUBLISH_CAP) throw new ActionError('BAD_REQUEST', 'The daily alert limit has been reached.');
  const built = initialAuthorities(
    str(input.authoritiesRequired) || (type === 'missing_child' ? 'yes' : 'unsure'),
    str(input.authoritiesReason),
  );
  if ('error' in built) throw new ActionError('BAD_REQUEST', built.error);
  let decision = built.decision;
  const agency = str(input.agency);
  const contact = str(input.contact);
  const referenceNumber = str(input.referenceNumber);
  if (agency || contact || referenceNumber) {
    const informed = applyAuthorityUpdate(decision, {
      status: 'informed',
      reason: '',
      agency,
      contact,
      reference: referenceNumber,
      by: actor.id,
      at: now,
    });
    if ('error' in informed) throw new ActionError('BAD_REQUEST', informed.error);
    decision = informed.decision;
  }
  if (type === 'missing_child' && !authorityShareReady(decision.status)) {
    throw new ActionError('BAD_REQUEST', 'A missing child alert needs the authority, a contact, and a reference before it can be drafted.');
  }
  const region = await institutionRegion(actor.institutionId);
  const reviewEveryMs = clampReviewEvery(
    typeof input.reconfirmHours === 'number'
      ? input.reconfirmHours * 60 * 60 * 1000
      : Number(input.reviewEveryMs),
  );
  const ref = db().collection('emergency_alerts').doc();
  await ref.set({
    institutionId: actor.institutionId,
    type,
    title,
    description,
    subjectName: str(input.subjectName).slice(0, 80),
    region,
    photoUrl: '',
    guardianConsent: false,
    consentId: '',
    consentWithdrawn: false,
    authorities: decision,
    authoritiesInformed: legacyNotice(decision),
    status: 'draft',
    publishedBy: actor.id,
    publishedAt: null,
    confirmedBy: '',
    confirmedAt: null,
    resolved: null,
    publicShareEnabled: false,
    sharePaused: false,
    reviewEveryMs,
    reviewDueAt: null,
    retractedReason: '',
    ogVersion: 1,
    counts: { views: 0, shares: 0 },
    chainSeq: 0,
    chainHead: GENESIS,
    legalHold: emptyLegalHold(),
    publicRedacted: false,
    internalRedacted: false,
    createdAt: now,
  });
  await rateRef.set({ count: count + 1, uid, day: dayKey(now) }, { merge: true });
  await audit(ref.id, actor, 'created', {
    before: {},
    after: { type, title, status: 'draft', subjectName: str(input.subjectName).slice(0, 80) },
  }, deviceOf(input));
  return { id: ref.id, status: 'draft' };
}

export async function confirmAlert(uid: string, id: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const record = asRecord(snap.id, snap.data() ?? {});
  if (record.status !== 'draft') throw new ActionError('BAD_REQUEST', 'This alert is already published.');
  const consentOnFile = Boolean(record.consentId);
  const problem = canConfirm({
    publisherId: record.publishedBy,
    confirmerId: actor.id,
    confirmerVerified: actor.verifiedStaff && (actor.role === 'admin' || actor.role === 'teacher' || actor.role === 'institution_admin'),
    type: record.type,
    authorities: authorityShareReady(record.authorities.status),
    consentOnFile,
  });
  if (problem) throw new ActionError('FORBIDDEN', problem);
  const now = Date.now();
  const reviewDueAt = now + record.reviewEveryMs;
  const next = { ...record, status: 'active' as const, confirmedBy: actor.id, confirmedAt: now, publishedAt: now, reviewDueAt, sharePaused: false, publicShareEnabled: true };
  await snap.ref.set({
    status: 'active',
    confirmedBy: actor.id,
    confirmedAt: now,
    publishedAt: now,
    reviewDueAt,
    lastReviewAt: now,
    lastReviewBy: actor.id,
    sharePaused: false,
    publicShareEnabled: true,
  }, { merge: true });
  await audit(id, actor, 'confirmed', {
    before: { status: 'draft' },
    after: { status: 'active', confirmedBy: actor.id },
  }, device);
  await db().collection('network_posts').add({
    kind: 'emergency',
    alertId: id,
    orgId: record.institutionId,
    pinned: true,
    authorId: actor.id,
    body: record.title,
    moderation: 'allow',
    ageTier: 'adult',
    institutionId: record.institutionId,
    createdAtMs: now,
  });
  await notifyRegion(next);
  return { id, status: 'active' };
}

export async function updateAlert(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const record = asRecord(snap.id, snap.data() ?? {});
  if (actor.role !== 'admin' && actor.id !== record.publishedBy && actor.id !== record.confirmedBy) {
    throw new ActionError('FORBIDDEN', 'The publisher or the confirming staff member can update this alert.');
  }
  const text = str(input.body).slice(0, 2000);
  if (text.length < 3) throw new ActionError('BAD_REQUEST', 'Write an update.');
  const nextStatus = record.status === 'active' ? 'updated' : record.status;
  if (record.status === 'active') await snap.ref.set({ status: 'updated' }, { merge: true });
  await appendChain({
    parentPath: `emergency_alerts/${id}`,
    collection: 'updates',
    actorUid: actor.id,
    actorRole: actor.role,
    action: 'updated',
    diff: {
      before: { status: record.status },
      after: { status: nextStatus, body: text },
    },
    device: deviceOf(input),
    extra: { body: text },
  });
  return { ok: true };
}

export async function resolveAlert(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!actor.verifiedStaff) throw new ActionError('FORBIDDEN', 'Verified staff close an alert.');
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const outcome = str(input.outcome).slice(0, 500);
  if (outcome.length < 3) throw new ActionError('BAD_REQUEST', 'Record the outcome.');
  const now = Date.now();
  const record = asRecord(snap.id, snap.data() ?? {});
  await snap.ref.set({
    status: 'resolved',
    publicRedacted: true,
    publicShareEnabled: false,
    ogVersion: record.ogVersion + 1,
    resolved: {
      by: actor.id,
      at: now,
      outcome,
      authoritiesClosed: input.authoritiesClosed === true,
    },
  }, { merge: true });
  const posts = await db().collection('network_posts').where('alertId', '==', id).limit(5).get();
  for (const post of posts.docs) {
    await post.ref.set({ body: 'Resolved. Personal details have been removed.', pinned: false }, { merge: true });
  }
  await audit(id, actor, 'resolved', {
    before: { status: record.status, publicRedacted: record.publicRedacted === true },
    after: { status: 'resolved', publicRedacted: true, outcome },
  }, deviceOf(input));
  return { ok: true, ogVersion: record.ogVersion + 1 };
}

export async function closeAlert(uid: string, id: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  if (actor.role !== 'admin' && actor.staffPost !== 'principal') {
    throw new ActionError('FORBIDDEN', 'A principal or admin archives an alert.');
  }
  const { record } = await loadAlert(id);
  const now = Date.now();
  await db().doc(`emergency_alerts/${id}`).set({
    status: 'closed',
    publicRedacted: true,
    publicShareEnabled: false,
    updatedAt: now,
  }, { merge: true });
  await audit(id, actor, 'closed', {
    before: { status: record.status },
    after: { status: 'closed', publicRedacted: true },
  }, device);
  return { ok: true };
}

export async function peekPublicAlert(id: string): Promise<ReturnType<typeof publicView>> {
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) return null;
  return publicView(asRecord(snap.id, snap.data() ?? {}));
}

export async function readPublicAlert(id: string): Promise<ReturnType<typeof publicView>> {
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) return null;
  const view = publicView(asRecord(snap.id, snap.data() ?? {}));
  if (view) {
    await snap.ref.set({
      counts: {
        views: (Number(snap.data()?.counts?.views) || 0) + 1,
        shares: Number(snap.data()?.counts?.shares) || 0,
      },
    }, { merge: true });
  }
  return view;
}

export async function recordShare(id: string, channel: string, actorUid: string, device: ChainDevice = SERVER_DEVICE) {
  if (!isShareChannel(channel)) throw new ActionError('BAD_REQUEST', 'Choose a share channel.');
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const record = asRecord(snap.id, snap.data() ?? {});
  const view = publicView(record);
  const refusal = shareRefusal('alert', record.status, view?.shareEnabled === true);
  if (refusal) throw new ActionError('FORBIDDEN', refusal);
  const shares = Number(snap.data()?.counts?.shares) || 0;
  const views = Number(snap.data()?.counts?.views) || 0;
  const at = Date.now();
  await appendChain({
    parentPath: `emergency_alerts/${id}`,
    collection: 'audit',
    actorUid: hashActor(actorUid),
    actorRole: actorUid ? 'member' : 'anonymous',
    action: 'shared',
    diff: {
      before: { shares },
      after: { shares: shares + 1, channel, at },
    },
    device,
  });
  await snap.ref.set({ counts: { views, shares: shares + 1 } }, { merge: true });
  return { ok: true, channel };
}

export async function alertStats(uid: string, id: string) {
  const actor = await loadActor(uid);
  if (actor.role !== 'admin' && actor.role !== 'institution_admin' && actor.staffPost !== 'principal') {
    throw new ActionError('FORBIDDEN', 'School leads can see alert stats.');
  }
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const data = snap.data() ?? {};
  return {
    id,
    status: str(data.status),
    counts: data.counts ?? { views: 0, shares: 0 },
    sharePaused: data.sharePaused === true,
    reviewDueAt: Number(data.reviewDueAt) || null,
    authorities: data.authorities ?? null,
  };
}

function lead(actor: Actor): boolean {
  return actor.role === 'admin' || actor.role === 'institution_admin' || actor.staffPost === 'principal' || actor.verifiedStaff;
}

async function loadAlert(id: string) {
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  return { snap, record: asRecord(snap.id, snap.data() ?? {}) };
}

async function redactPhotos(id: string) {
  const files = await db().collection(`emergency_alerts/${id}/attachments`).limit(40).get();
  for (const file of files.docs) {
    const data = file.data();
    if (data.public !== true) continue;
    await file.ref.set({ public: false }, { merge: true });
  }
}

export async function setAlertAuthorities(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Verified staff record the authority decision.');
  const { snap, record } = await loadAlert(id);
  const next = applyAuthorityUpdate(record.authorities, {
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
  const share = record.publicShareEnabled && authorityShareReady(next.decision.status) && !record.sharePaused && record.status !== 'retracted';
  await snap.ref.set({
    authorities: next.decision,
    authoritiesInformed: legacyNotice(next.decision),
    publicShareEnabled: share,
    authoritiesRemindedAt: next.decision.status === 'to_be_informed' ? 0 : now,
  }, { merge: true });
  await audit(id, actor, 'authorities', {
    before: { status: record.authorities.status },
    after: { status: next.decision.status, agency: next.decision.informed?.agency ?? '' },
  }, deviceOf(input));
  return { status: next.decision.status };
}

export async function recordConsent(uid: string, id: string, input: Record<string, unknown>, meta: { ip: string; device: string }) {
  const actor = await loadActor(uid);
  if (!canCreate(actor.role, actor.staffPost, actor.verifiedStaff)) {
    throw new ActionError('FORBIDDEN', 'A verified principal or admin records guardian consent.');
  }
  const { snap, record } = await loadAlert(id);
  const regions = Array.isArray(input.regions) ? input.regions.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
  const channels = Array.isArray(input.channels) ? input.channels.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
  const consent: GuardianConsent = {
    details: str(input.details).slice(0, 2000),
    photo: input.photo === true,
    regions: regions.map(item => item.slice(0, 80)),
    channels: channels.map(item => item.slice(0, 80)),
    disclaimer: str(input.disclaimer).slice(0, 500),
    guardianName: str(input.guardianName).slice(0, 120),
    relation: str(input.relation).slice(0, 80),
    signature: str(input.signature).slice(0, 200_000),
    signatureKind: input.signatureKind === 'drawn' ? 'drawn' : 'typed',
    at: Date.now(),
    ip: meta.ip.slice(0, 64),
    device: meta.device.slice(0, 200),
  };
  const problem = consentProblems(consent);
  if (problem) throw new ActionError('BAD_REQUEST', problem);
  const version = (await db().collection(`emergency_alerts/${id}/consent`).limit(20).get()).size + 1;
  const created = await appendChain({
    parentPath: `emergency_alerts/${id}`,
    collection: 'consent',
    actorUid: actor.id,
    actorRole: actor.role,
    action: 'consent',
    diff: {
      before: { consentId: record.consentId, guardianConsent: record.guardianConsent },
      after: { version, photo: consent.photo, guardianName: consent.guardianName },
    },
    device: deviceOf(input),
    extra: { ...consent, clientDevice: consent.device, version },
  });
  await snap.ref.set({
    consentId: created.id,
    guardianConsent: consent.photo,
    consentWithdrawn: false,
    subjectName: str(input.subjectName).slice(0, 80) || record.subjectName,
  }, { merge: true });
  return { id: created.id, version };
}

export async function withdrawConsent(uid: string, id: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Verified staff withdraw guardian consent.');
  const { snap, record } = await loadAlert(id);
  const now = Date.now();
  await redactPhotos(id);
  await snap.ref.set({
    guardianConsent: false,
    consentWithdrawn: true,
    publicRedacted: true,
    publicShareEnabled: false,
    ogVersion: record.ogVersion + 1,
  }, { merge: true });
  await audit(id, actor, 'consent_withdrawn', {
    before: { consentWithdrawn: record.consentWithdrawn === true, publicShareEnabled: record.publicShareEnabled },
    after: { consentWithdrawn: true, publicRedacted: true, publicShareEnabled: false },
  }, device);
  return { ok: true, at: now };
}

export async function reviewAlert(uid: string, id: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Verified staff re-confirm an alert.');
  const { snap, record } = await loadAlert(id);
  if (record.status !== 'active' && record.status !== 'updated') {
    throw new ActionError('BAD_REQUEST', 'Only a live alert is re-confirmed.');
  }
  if (record.consentId && snap.data()?.consentWithdrawn === true) {
    throw new ActionError('BAD_REQUEST', 'Sharing stays off after consent is withdrawn.');
  }
  const now = Date.now();
  const reviewDueAt = now + record.reviewEveryMs;
  const share = authorityShareReady(record.authorities.status);
  await snap.ref.set({
    lastReviewAt: now,
    lastReviewBy: actor.id,
    reviewDueAt,
    sharePaused: false,
    publicShareEnabled: share,
  }, { merge: true });
  await audit(id, actor, 'reviewed', {
    before: { reviewDueAt: record.reviewDueAt, sharePaused: record.sharePaused },
    after: { reviewDueAt, sharePaused: false, publicShareEnabled: share },
  }, device);
  return { reviewDueAt };
}

export async function retractAlert(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Verified staff retract an alert.');
  const reason = str(input.reason).slice(0, 500);
  if (reason.length < 3) throw new ActionError('BAD_REQUEST', 'A retraction needs a reason.');
  const { snap, record } = await loadAlert(id);
  if (record.status === 'draft') throw new ActionError('BAD_REQUEST', 'A draft is not public yet.');
  const now = Date.now();
  await redactPhotos(id);
  await snap.ref.set({
    status: 'retracted',
    retractedReason: reason,
    publicRedacted: true,
    publicShareEnabled: false,
    sharePaused: true,
    ogVersion: record.ogVersion + 1,
  }, { merge: true });
  const posts = await db().collection('network_posts').where('alertId', '==', id).limit(5).get();
  for (const post of posts.docs) {
    await post.ref.set({ body: `Correction: ${reason}`, pinned: true }, { merge: true });
  }
  await db().collection('network_posts').add({
    kind: 'emergency',
    alertId: id,
    orgId: record.institutionId,
    pinned: true,
    authorId: actor.id,
    body: `Correction: ${reason}`,
    moderation: 'allow',
    ageTier: 'adult',
    institutionId: record.institutionId,
    createdAtMs: now,
  });
  const recipients = await db().collection(`emergency_alerts/${id}/recipients`).limit(400).get();
  await notifyPeople(record, 'Correction', reason, recipients.docs.map(doc => doc.id));
  await audit(id, actor, 'retracted', {
    before: { status: record.status },
    after: { status: 'retracted', publicRedacted: true, reason },
  }, deviceOf(input));
  return { ok: true, ogVersion: record.ogVersion + 1 };
}

export async function attachAlert(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Verified staff attach a file.');
  const { record } = await loadAlert(id);
  const label = str(input.label);
  if (!isAttachmentLabel(label)) throw new ActionError('BAD_REQUEST', 'Choose a file label.');
  const bytes = bytesFromBase64(str(input.dataBase64));
  if (!bytes) throw new ActionError('BAD_REQUEST', 'Attach the file.');
  const prepared = await prepareAttachment({ declaredMime: str(input.mime), label, bytes });
  if (!prepared.ok) throw new ActionError('BAD_REQUEST', prepared.error);
  const stored = await imagePass(prepared.file.bytes, prepared.file.mime);
  const consentRecordId = record.consentId;
  const live = record.status === 'draft' || record.status === 'active' || record.status === 'updated';
  const wantsPublic = live && alertAttachmentPublic({
    label,
    mime: prepared.file.mime,
    internal: input.internal === true,
    guardianConsent: input.guardianConsent === true && record.guardianConsent && record.consentId !== '',
    consentRecordId,
  });
  const fileRef = db().collection(`emergency_alerts/${id}/attachments`).doc();
  const storagePath = alertStoragePath(record.institutionId, id, fileRef.id, str(input.fileName) || 'file');
  await saveObject(storagePath, stored, prepared.file.mime);
  const now = Date.now();
  await fileRef.set({
    label,
    internal: input.internal === true,
    mime: prepared.file.mime,
    kind: prepared.file.kind,
    bytes: stored.byteLength,
    storagePath,
    fileName: str(input.fileName).slice(0, 120),
    updateId: str(input.updateId),
    uploadedBy: actor.id,
    at: now,
    guardianConsent: wantsPublic,
    consentRecordId: wantsPublic ? consentRecordId : '',
    public: wantsPublic,
    scanEngine: prepared.file.scan.engine,
    scanDetail: prepared.file.scan.detail,
    exifStripped: true,
  });
  if (wantsPublic) {
    await db().doc(`emergency_alerts/${id}`).set({ photoUrl: `attachment:${fileRef.id}` }, { merge: true });
  }
  await audit(id, actor, 'uploaded', {
    before: {},
    after: { attachmentId: fileRef.id, label, public: wantsPublic },
  }, deviceOf(input));
  return { id: fileRef.id, public: wantsPublic };
}

export async function publicAlertFile(id: string, attachmentId: string) {
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) return null;
  const record = asRecord(snap.id, snap.data() ?? {});
  const view = publicView(record);
  if (!view?.photoUrl.startsWith('attachment:')) return null;
  const file = await db().doc(`emergency_alerts/${id}/attachments/${attachmentId}`).get();
  if (!file.exists || file.data()?.public !== true) return null;
  const storagePath = str(file.data()?.storagePath);
  if (!storagePath || str(file.data()?.consentRecordId) !== record.consentId) return null;
  await audit(id, { id: 'public', role: 'public' }, 'viewed', {
    before: {},
    after: { attachmentId },
  });
  return signedRead(storagePath);
}

export async function viewAlertFile(uid: string, id: string, attachmentId: string, device: ChainDevice = SERVER_DEVICE) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Verified staff open alert files.');
  const file = await db().doc(`emergency_alerts/${id}/attachments/${attachmentId}`).get();
  if (!file.exists) throw new ActionError('NOT_FOUND', 'File not found.');
  const storagePath = str(file.data()?.storagePath);
  if (!storagePath) throw new ActionError('NOT_FOUND', 'This file has been removed.');
  const signed = await signedRead(storagePath);
  await audit(id, actor, 'viewed', {
    before: {},
    after: { attachmentId },
  }, device);
  return signed;
}

export async function reportAlert(input: {
  alertId: string;
  reporterUid: string;
  reason: string;
  ip: string;
  captchaOk: boolean;
}) {
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 3) throw new ActionError('BAD_REQUEST', 'Say what is wrong with this alert.');
  const snap = await db().doc(`emergency_alerts/${input.alertId}`).get();
  if (!snap.exists || snap.data()?.status === 'draft') throw new ActionError('NOT_FOUND', 'Alert not found.');
  const now = Date.now();
  const day = dayKey(now);
  const anonymous = !input.reporterUid;
  const rateId = anonymous
    ? `anon_${createHash('sha256').update(input.ip || 'unknown').digest('hex').slice(0, 24)}_${day}`
    : `${input.reporterUid}_${day}`;
  const rateRef = db().doc(`alert_report_rate/${rateId}`);
  const rate = await rateRef.get();
  const count = Number(rate.data()?.count) || 0;
  if (anonymous) {
    const problem = anonymousReportAllowed({ countToday: count, captchaRequired: captchaRequired(), captchaOk: input.captchaOk });
    if (problem) throw new ActionError('BAD_REQUEST', problem);
  } else {
    const ban = await db().doc(`alert_report_bans/${input.reporterUid}`).get();
    const problem = reportAllowed({ countToday: count, banned: ban.data()?.banned === true });
    if (problem) throw new ActionError('BAD_REQUEST', problem);
  }
  const ref = await db().collection('alert_reports').add({
    alertId: input.alertId,
    reporterId: input.reporterUid,
    reason,
    falseReport: false,
    at: now,
    day,
  });
  await rateRef.set({ count: count + 1, day }, { merge: true });
  await db().collection('moderation_queue').add({
    surface: 'emergency_alert',
    authorId: input.reporterUid || 'anonymous',
    ageTier: 'adult',
    text: reason,
    decision: 'hold',
    reasons: ['alert_report'],
    category: 'safety',
    severity: 'high',
    status: 'open',
    subjectPath: `emergency_alerts/${input.alertId}`,
    institutionId: str(snap.data()?.institutionId),
    createdAtMs: now,
  });
  await audit(input.alertId, {
    id: input.reporterUid || 'anonymous',
    role: input.reporterUid ? 'reporter' : 'anonymous',
  }, 'reported', {
    before: {},
    after: { reportId: ref.id },
  }, {
    platform: 'web',
    appVersion: 'web',
    ipHash: createHash('sha256').update(input.ip || 'unknown').digest('hex'),
  });
  return { id: ref.id };
}

export async function flagFalseReport(uid: string, reportId: string) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Staff flag a false report.');
  const report = await db().doc(`alert_reports/${reportId}`).get();
  if (!report.exists) throw new ActionError('NOT_FOUND', 'Report not found.');
  if (report.data()?.falseReport === true) return { ok: true };
  const reporterId = str(report.data()?.reporterId);
  await report.ref.set({ falseReport: true, flaggedBy: actor.id, flaggedAt: Date.now() }, { merge: true });
  if (!reporterId) return { ok: true, banned: false };
  const banRef = db().doc(`alert_report_bans/${reporterId}`);
  const ban = await banRef.get();
  const previous = Number(ban.data()?.falseCount) || 0;
  const banned = losesReportingRights(previous);
  await banRef.set({ falseCount: previous + 1, banned, updatedAt: Date.now() }, { merge: true });
  return { ok: true, banned };
}

export async function listAlertReports(uid: string, id: string) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Staff can see who reported an alert.');
  const snap = await db().collection('alert_reports').where('alertId', '==', id).limit(50).get();
  return snap.docs.map(doc => ({
    id: doc.id,
    reporterId: str(doc.data().reporterId),
    reason: str(doc.data().reason),
    falseReport: doc.data().falseReport === true,
    at: Number(doc.data().at) || 0,
  }));
}

export async function runAlertMaintenance(now = Date.now()) {
  let paused = 0;
  let reminded = 0;
  for (const status of ['active', 'updated'] as const) {
    const snap = await db().collection('emergency_alerts').where('status', '==', status).limit(40).get();
    for (const doc of snap.docs) {
      const record = asRecord(doc.id, doc.data());
      if (record.sharePaused || !reviewExpired(record.reviewDueAt, now, record.status)) continue;
      await doc.ref.set({ publicShareEnabled: false, sharePaused: true, ogVersion: record.ogVersion + 1 }, { merge: true });
      await audit(doc.id, { id: 'system', role: 'system' }, 'review_paused', {
        before: { sharePaused: false, publicShareEnabled: record.publicShareEnabled },
        after: { sharePaused: true, publicShareEnabled: false },
      });
      const admins = await db().collection('users').where('institutionId', '==', record.institutionId).limit(30).get();
      for (const person of admins.docs.filter(item => item.data().role === 'admin' || item.data().role === 'institution_admin' || item.data().staffPost === 'principal').slice(0, 8)) {
        await notifyPeople(record, 'Alert sharing paused', 'Re-confirm this alert to share it again.', [person.id]);
      }
      paused += 1;
    }
  }
  for (const status of ['draft', 'active', 'updated'] as const) {
    const snap = await db().collection('emergency_alerts').where('status', '==', status).limit(40).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const decision = authoritiesFrom(data);
      if (!authorityOverdue(Number(data.createdAt) || 0, decision.status, now, ALERT_AUTHORITY_REMINDER_MS, Number(data.authoritiesRemindedAt) || 0)) {
        continue;
      }
      await doc.ref.set({ authoritiesRemindedAt: now }, { merge: true });
      await audit(doc.id, { id: 'system', role: 'system' }, 'authority_reminder', {
        before: { authoritiesRemindedAt: Number(data.authoritiesRemindedAt) || 0 },
        after: { authoritiesRemindedAt: now },
      });
      reminded += 1;
    }
  }
  return { paused, reminded };
}

export async function setAlertLegalHold(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!canManageLegalHold(actor.role, actor.staffPost)) {
    throw new ActionError('FORBIDDEN', 'Only a super admin or the principal can set a legal hold.');
  }
  const { snap } = await loadAlert(id);
  const current = holdOf(snap.data()?.legalHold);
  const on = input.on === true;
  const reason = str(input.reason).slice(0, 500);
  if (reason.length < 3) throw new ActionError('BAD_REQUEST', 'A legal hold needs a reason.');
  const now = Date.now();
  const next: LegalHold = { on, by: actor.id, at: now, reason };
  await snap.ref.set({ legalHold: next }, { merge: true });
  await audit(id, actor, on ? 'legal_hold_set' : 'legal_hold_cleared', {
    before: { legalHold: current },
    after: { legalHold: next },
  }, deviceOf(input));
  return { legalHold: next };
}

export async function redactAlertInternal(uid: string, id: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Verified staff redact an internal copy.');
  const { snap, record } = await loadAlert(id);
  if (internalRedactionBlocked(holdOf(snap.data()?.legalHold))) {
    throw new ActionError('FORBIDDEN', 'A legal hold blocks redaction of the internal copy.');
  }
  const before = { subjectName: record.subjectName, photoUrl: record.photoUrl };
  await audit(id, actor, 'internal_redacted', {
    before,
    after: { subjectName: '', photoUrl: '' },
  }, deviceOf(input));
  await snap.ref.set({ subjectName: '', photoUrl: '', internalRedacted: true }, { merge: true });
  return { ok: true };
}

export async function verifyAlert(uid: string, id: string) {
  const actor = await loadActor(uid);
  if (!lead(actor)) throw new ActionError('FORBIDDEN', 'Staff verify this alert.');
  await loadAlert(id);
  return verifyStoredChain('alert', id);
}

export async function exportAlertLog(uid: string, id: string, format: string, device: ChainDevice = SERVER_DEVICE): Promise<ExportFile> {
  const actor = await loadActor(uid);
  if (format !== 'csv' && format !== 'pdf') throw new ActionError('BAD_REQUEST', 'Choose csv or pdf.');
  if (actor.role !== 'admin' && actor.role !== 'institution_admin' && actor.staffPost !== 'principal') {
    throw new ActionError('FORBIDDEN', 'School leads can export an alert log.');
  }
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  if (actor.role !== 'admin' && str(snap.data()?.institutionId) !== actor.institutionId) {
    throw new ActionError('FORBIDDEN', 'School leads can export an alert log.');
  }
  const loaded = await readChain('alert', id);
  const entries = [...loaded.entries].sort((left, right) => left.seq - right.seq);
  const file = format === 'pdf'
    ? exportPdf(id, 'alert', entries, loaded.head)
    : exportCsv(id, 'alert', entries, loaded.head);
  await audit(id, actor, 'exported', {
    before: {},
    after: { format: file.filename.endsWith('.pdf') ? 'pdf' : 'csv', verificationHash: file.verificationHash, chainHead: loaded.head },
  }, device);
  return file;
}
