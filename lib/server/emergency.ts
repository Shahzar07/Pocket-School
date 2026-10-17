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
import {
  DAILY_PUBLISH_CAP,
  canConfirm,
  canCreate,
  isEmergencyType,
  publicView,
  regionMatch,
  shareAllowed,
  type AuthorityNotice,
  type EmergencyRecord,
  type EmergencyType,
  type Region,
} from '../emergency/policy';

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

async function audit(alertId: string, actorId: string, action: string, detail: string) {
  await db().collection(`emergency_alerts/${alertId}/audit`).add({
    actorId,
    action,
    detail,
    at: Date.now(),
  });
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
    authoritiesInformed: authorities && str(authorities.agency) ? authorities : null,
    status: (str(data.status) || 'draft') as EmergencyRecord['status'],
    publishedBy: str(data.publishedBy),
    publishedAt: Number(data.publishedAt) || null,
    confirmedBy: str(data.confirmedBy),
    confirmedAt: Number(data.confirmedAt) || null,
    resolved: data.resolved ?? null,
    publicShareEnabled: data.publicShareEnabled === true,
    ogVersion: Number(data.ogVersion) || 1,
    counts: {
      views: Number(data.counts?.views) || 0,
      shares: Number(data.counts?.shares) || 0,
    },
  };
}

async function notifyRegion(record: EmergencyRecord) {
  const members = await db().collection('users').where('institutionId', '==', record.institutionId).limit(200).get();
  const seen = new Set<string>();
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
  for (const uid of targets) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    await sendPush({
      recipientUid: uid,
      category: 'emergency',
      title: record.title,
      body: record.description.slice(0, 140),
      link: `/alerts/${record.id}`,
      force: true,
      sound: 'emergency',
    }, { store: adminPushStore(), send: sendToDevice });
  }
}

export async function createAlert(uid: string, input: Record<string, unknown>) {
  const actor = await loadActor(uid);
  if (!canCreate(actor.role, actor.staffPost, actor.verifiedStaff)) {
    throw new ActionError('FORBIDDEN', 'A verified principal or admin creates an emergency alert.');
  }
  const type = str(input.type);
  if (!isEmergencyType(type)) throw new ActionError('BAD_REQUEST', 'Choose an alert type.');
  const title = str(input.title).slice(0, 120);
  const description = str(input.description).slice(0, 2000);
  if (title.length < 3 || description.length < 3) throw new ActionError('BAD_REQUEST', 'Add a title and a description.');
  const now = Date.now();
  const rateRef = db().doc(`emergency_rate/${uid}_${dayKey(now)}`);
  const rate = await rateRef.get();
  const count = Number(rate.data()?.count) || 0;
  if (count >= DAILY_PUBLISH_CAP) throw new ActionError('BAD_REQUEST', 'The daily alert limit has been reached.');
  const consent = input.guardianConsent === true;
  const consentId = str(input.consentId);
  const photoUrl = consent && consentId ? str(input.photoUrl).slice(0, 500) : '';
  const agency = str(input.agency);
  const referenceNumber = str(input.referenceNumber);
  const authorities: AuthorityNotice | null = agency && referenceNumber
    ? { agency, referenceNumber, informedAt: now }
    : null;
  if (type === 'missing_child' && !authorities) {
    throw new ActionError('BAD_REQUEST', 'A missing child alert needs the authority name and reference before it can be drafted.');
  }
  const region = await institutionRegion(actor.institutionId);
  const ref = db().collection('emergency_alerts').doc();
  await ref.set({
    institutionId: actor.institutionId,
    type,
    title,
    description,
    subjectName: str(input.subjectName).slice(0, 80),
    region,
    photoUrl,
    guardianConsent: consent && Boolean(consentId),
    consentId,
    authoritiesInformed: authorities,
    status: 'draft',
    publishedBy: actor.id,
    publishedAt: null,
    confirmedBy: '',
    confirmedAt: null,
    resolved: null,
    publicShareEnabled: shareAllowed(Boolean(authorities), input.publicShareEnabled === true),
    ogVersion: 1,
    counts: { views: 0, shares: 0 },
    createdAt: now,
  });
  await rateRef.set({ count: count + 1, uid, day: dayKey(now) }, { merge: true });
  await audit(ref.id, actor.id, 'created', type);
  return { id: ref.id, status: 'draft' };
}

export async function confirmAlert(uid: string, id: string) {
  const actor = await loadActor(uid);
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const record = asRecord(snap.id, snap.data() ?? {});
  if (record.status !== 'draft') throw new ActionError('BAD_REQUEST', 'This alert is already published.');
  const problem = canConfirm({
    publisherId: record.publishedBy,
    confirmerId: actor.id,
    confirmerVerified: actor.verifiedStaff && (actor.role === 'admin' || actor.role === 'teacher' || actor.role === 'institution_admin'),
    type: record.type,
    authorities: Boolean(record.authoritiesInformed),
  });
  if (problem) throw new ActionError('FORBIDDEN', problem);
  const now = Date.now();
  const next = { ...record, status: 'active' as const, confirmedBy: actor.id, confirmedAt: now, publishedAt: now };
  await snap.ref.set({
    status: 'active',
    confirmedBy: actor.id,
    confirmedAt: now,
    publishedAt: now,
  }, { merge: true });
  await audit(id, actor.id, 'confirmed', '');
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
  const now = Date.now();
  await db().collection(`emergency_alerts/${id}/updates`).add({ body: text, actorId: actor.id, at: now });
  if (record.status === 'active') await snap.ref.set({ status: 'updated' }, { merge: true });
  await audit(id, actor.id, 'updated', text.slice(0, 140));
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
    subjectName: '',
    photoUrl: '',
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
  await audit(id, actor.id, 'resolved', outcome);
  return { ok: true, ogVersion: record.ogVersion + 1 };
}

export async function closeAlert(uid: string, id: string) {
  const actor = await loadActor(uid);
  if (actor.role !== 'admin' && actor.staffPost !== 'principal') {
    throw new ActionError('FORBIDDEN', 'A principal or admin archives an alert.');
  }
  const now = Date.now();
  await db().doc(`emergency_alerts/${id}`).set({ status: 'closed', publicShareEnabled: false, updatedAt: now }, { merge: true });
  await audit(id, actor.id, 'closed', 'archived');
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

export async function recordShare(id: string) {
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) return { ok: false };
  const shares = Number(snap.data()?.counts?.shares) || 0;
  const views = Number(snap.data()?.counts?.views) || 0;
  await snap.ref.set({ counts: { views, shares: shares + 1 } }, { merge: true });
  return { ok: true };
}

export async function alertStats(uid: string, id: string) {
  const actor = await loadActor(uid);
  if (actor.role !== 'admin' && actor.role !== 'institution_admin' && actor.staffPost !== 'principal') {
    throw new ActionError('FORBIDDEN', 'School leads can see alert stats.');
  }
  const snap = await db().doc(`emergency_alerts/${id}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Alert not found.');
  const data = snap.data() ?? {};
  return { id, status: str(data.status), counts: data.counts ?? { views: 0, shares: 0 } };
}
