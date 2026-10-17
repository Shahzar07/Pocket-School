import 'server-only';

import { randomBytes } from 'node:crypto';
import { publicName } from '@/lib/alumni';
import {
  isShareToken,
  readApplication,
  readShareLabel,
  readVisitorLabel,
  reminderDue,
  shareExpiresOn,
  shareIsOpen,
  shareTokenFrom,
  tailorBullets,
  viewTracker,
  type JobApplication,
  type ShareView,
} from '@/lib/linkedin';
import { adminDb } from '@/lib/firebase-admin';
import { loadEducation, buildPortfolio } from '@/lib/server/learner-record-store';

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function todayStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function schoolsFor(uid: string): Promise<string[]> {
  const [history, user] = await Promise.all([
    loadEducation(uid),
    adminDb().doc(`users/${uid}`).get(),
  ]);
  const ids = new Set<string>();
  for (const span of history) if (span.institutionId) ids.add(span.institutionId);
  const current = text(user.get('institutionId')).trim();
  const alumni = text(user.get('alumniOf')).trim();
  if (current) ids.add(current);
  if (alumni) ids.add(alumni);
  return [...ids];
}

async function viewsFor(token: string): Promise<ShareView[]> {
  const snap = await adminDb().collection(`share_links/${token}/views`).limit(50).get();
  return snap.docs.map((doc) => ({
    at: text(doc.get('at')),
    itemTitle: text(doc.get('itemTitle')),
    visitorLabel: text(doc.get('visitorLabel')),
  }));
}

export async function createShareLink(uid: string, label: unknown, days: unknown, now = new Date()): Promise<{
  token: string;
  label: string;
  expiresOn: string;
  urlPath: string;
} | { error: string }> {
  const named = readShareLabel(label);
  if ('error' in named) return named;
  const today = todayStamp(now);
  const span = typeof days === 'number' ? days : Number(days);
  const token = shareTokenFrom(randomBytes(24));
  const expiresOn = shareExpiresOn(today, Number.isFinite(span) ? span : 30);
  await adminDb().doc(`share_links/${token}`).set({
    studentId: uid,
    label: named.label,
    expiresOn,
    createdAt: now.toISOString(),
    revoked: false,
  });
  return { token, label: named.label, expiresOn, urlPath: `/record/${token}` };
}

export async function revokeShareLink(uid: string, token: string): Promise<{ ok: true } | { error: string }> {
  if (!isShareToken(token)) return { error: 'Choose a share link from this portfolio.' };
  const ref = adminDb().doc(`share_links/${token}`);
  const snap = await ref.get();
  if (!snap.exists || snap.get('studentId') !== uid) return { error: 'That share link is not on this account.' };
  await ref.set({ revoked: true }, { merge: true });
  return { ok: true };
}

export async function learnerJobDesk(uid: string, now = new Date()) {
  const today = todayStamp(now);
  const [linksSnap, appsSnap, requestsSnap, user] = await Promise.all([
    adminDb().collection('share_links').where('studentId', '==', uid).limit(40).get(),
    adminDb().collection(`users/${uid}/applications`).limit(40).get(),
    adminDb().collection('verification_requests').where('studentId', '==', uid).limit(40).get(),
    adminDb().doc(`users/${uid}`).get(),
  ]);
  const links = await Promise.all(linksSnap.docs.map(async (doc) => {
    const views = await viewsFor(doc.id);
    return {
      token: doc.id,
      label: text(doc.get('label')),
      expiresOn: text(doc.get('expiresOn')),
      revoked: doc.get('revoked') === true,
      open: shareIsOpen({ expiresOn: text(doc.get('expiresOn')), revoked: doc.get('revoked') === true, today }),
      tracker: viewTracker(views),
    };
  }));
  const applications: JobApplication[] = appsSnap.docs.flatMap((doc) => {
    const read = readApplication({
      id: doc.id,
      company: doc.get('company'),
      role: doc.get('role'),
      link: doc.get('link'),
      status: doc.get('status'),
      date: doc.get('date'),
      shareToken: doc.get('shareToken'),
      reminderOn: doc.get('reminderOn'),
    });
    return 'error' in read ? [] : [{ ...read, id: doc.id }];
  });
  const reminders = applications.filter((item) => reminderDue({ status: item.status, reminderOn: item.reminderOn, today }));
  const requests = requestsSnap.docs.map((doc) => ({
    id: doc.id,
    itemId: text(doc.get('itemId')),
    itemTitle: text(doc.get('itemTitle')),
    note: text(doc.get('note')),
    visitorLabel: text(doc.get('visitorLabel')),
    status: text(doc.get('status')) || 'open',
    confirmedBy: text(doc.get('confirmedBy')),
  }));
  return {
    links,
    applications,
    reminders,
    requests,
    linkedInLinked: Boolean(text(user.get('linkedInSub'))),
  };
}

export async function saveApplication(uid: string, input: {
  id?: unknown;
  company: unknown;
  role: unknown;
  link: unknown;
  status: unknown;
  date: unknown;
  shareToken?: unknown;
  reminderOn?: unknown;
}): Promise<JobApplication | { error: string }> {
  const read = readApplication(input);
  if ('error' in read) return read;
  if (read.shareToken) {
    const link = await adminDb().doc(`share_links/${read.shareToken}`).get();
    if (!link.exists || link.get('studentId') !== uid) return { error: 'Choose a share link from this portfolio.' };
  }
  const id = read.id || shareTokenFrom(randomBytes(12));
  const saved: JobApplication = { ...read, id };
  await adminDb().doc(`users/${uid}/applications/${id}`).set(saved);
  if (saved.status === 'hired' || saved.status === 'studying') await publishOutcome(uid, saved.status);
  return saved;
}

async function publishOutcome(uid: string, outcome: 'hired' | 'studying'): Promise<void> {
  const profile = await adminDb().doc(`users/${uid}/portfolio/profile`).get();
  if (profile.get('shareDestinationWithSchools') !== true) return;
  const current = await adminDb().doc(`users/${uid}/destination/current`).get();
  if (!current.exists || !text(current.get('name')).trim()) return;
  await current.ref.set({ outcome }, { merge: true });
  const rows = await adminDb().collection('learner_destinations').where('studentId', '==', uid).limit(50).get();
  for (const doc of rows.docs) await doc.ref.set({ outcome }, { merge: true });
}

export async function deleteApplication(uid: string, id: string): Promise<{ ok: true } | { error: string }> {
  if (!/^[a-f0-9]{16,40}$/.test(id)) return { error: 'Choose an application on this portfolio.' };
  const ref = adminDb().doc(`users/${uid}/applications/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return { error: 'That application is not on this account.' };
  await ref.delete();
  return { ok: true };
}

export async function tailorForLearner(uid: string, jobText: unknown) {
  const built = await buildPortfolio(uid);
  return tailorBullets({
    jobText: typeof jobText === 'string' ? jobText.slice(0, 4000) : '',
    items: built.items.map((item) => ({ title: item.title, detail: item.detail, source: item.source })),
  });
}

export async function openSharedRecord(input: {
  token: string;
  visitorLabel: unknown;
  itemTitle: unknown;
  now?: Date;
}): Promise<{ open: false; reason: string } | {
  open: true;
  name: string;
  studentNumber: string;
  items: { id: string; title: string; detail: string; when: string; source: string; verifyUrl: string; confirmation: string }[];
}> {
  if (!isShareToken(input.token)) return { open: false, reason: 'This link is not a Poket School record.' };
  const snap = await adminDb().doc(`share_links/${input.token}`).get();
  if (!snap.exists) return { open: false, reason: 'This link is not a Poket School record.' };
  const today = todayStamp(input.now);
  const open = shareIsOpen({
    expiresOn: text(snap.get('expiresOn')),
    revoked: snap.get('revoked') === true,
    today,
  });
  if (!open) return { open: false, reason: 'This link has expired. Ask the learner for a new one.' };
  const uid = text(snap.get('studentId'));
  const built = await buildPortfolio(uid);
  const visitorLabel = readVisitorLabel(input.visitorLabel);
  const requested = typeof input.itemTitle === 'string' ? input.itemTitle.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  await adminDb().collection(`share_links/${input.token}/views`).add({
    at: (input.now ?? new Date()).toISOString(),
    itemTitle: requested || 'Verified record',
    visitorLabel,
  });
  const items = built.items
    .filter((item) => item.kind !== 'score' || built.consent.includeScores)
    .map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      when: item.when,
      source: item.source,
      verifyUrl: /^https:\/\//i.test(item.verifyUrl) ? item.verifyUrl : '',
      confirmation: item.confirmation ?? '',
    }));
  return {
    open: true,
    name: publicName(built.name),
    studentNumber: built.studentNumber,
    items,
  };
}

export async function requestVerification(input: {
  token: string;
  itemId: unknown;
  note: unknown;
  visitorLabel: unknown;
}): Promise<{ ok: true } | { error: string }> {
  if (!isShareToken(input.token)) return { error: 'This link is not a Poket School record.' };
  const link = await adminDb().doc(`share_links/${input.token}`).get();
  if (!link.exists) return { error: 'This link is not a Poket School record.' };
  const today = todayStamp();
  if (!shareIsOpen({ expiresOn: text(link.get('expiresOn')), revoked: link.get('revoked') === true, today })) {
    return { error: 'This link has expired. Ask the learner for a new one.' };
  }
  const uid = text(link.get('studentId'));
  const itemId = typeof input.itemId === 'string' ? input.itemId.trim() : '';
  if (!itemId) return { error: 'Choose the self-reported item to verify.' };
  const item = await adminDb().doc(`users/${uid}/portfolio_items/${itemId}`).get();
  if (!item.exists || item.get('source') !== 'self_reported') {
    return { error: 'Verification can be requested for a self-reported item. Poket School already verifies its own records.' };
  }
  const schools = await schoolsFor(uid);
  const note = typeof input.note === 'string' ? input.note.replace(/\s+/g, ' ').trim().slice(0, 280) : '';
  await adminDb().collection('verification_requests').add({
    studentId: uid,
    itemId,
    itemTitle: text(item.get('title')).slice(0, 120),
    note,
    visitorLabel: readVisitorLabel(input.visitorLabel),
    status: 'open',
    schoolIds: schools,
    requestedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export async function confirmVerification(input: {
  requestId: string;
  actorId: string;
  by: 'learner' | 'school';
  institutionId?: string;
}): Promise<{ ok: true } | { error: string }> {
  if (!input.requestId) return { error: 'Choose a verification request.' };
  const ref = adminDb().collection('verification_requests').doc(input.requestId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('status') === 'confirmed') return { error: 'That request is already closed.' };
  const studentId = text(snap.get('studentId'));
  if (input.by === 'learner') {
    if (studentId !== input.actorId) return { error: 'This request belongs to another learner.' };
  } else {
    const institutionId = (input.institutionId ?? '').trim();
    const schools = Array.isArray(snap.get('schoolIds')) ? snap.get('schoolIds').filter((id: unknown) => typeof id === 'string') : [];
    if (!institutionId || !schools.includes(institutionId)) return { error: 'This school is not on that learner’s record.' };
  }
  const itemId = text(snap.get('itemId'));
  const itemRef = adminDb().doc(`users/${studentId}/portfolio_items/${itemId}`);
  const item = await itemRef.get();
  if (!item.exists) return { error: 'That item is no longer on the record.' };
  const confirmedAt = new Date().toISOString();
  await itemRef.set({ confirmation: input.by, confirmedAt: confirmedAt.slice(0, 10) }, { merge: true });
  await ref.set({ status: 'confirmed', confirmedBy: input.by, confirmedAt }, { merge: true });
  return { ok: true };
}

export async function schoolVerificationRequests(institutionId: string) {
  if (!institutionId) return [];
  const snap = await adminDb().collection('verification_requests').where('schoolIds', 'array-contains', institutionId).limit(20).get();
  return snap.docs
    .filter((doc) => doc.get('status') === 'open')
    .map((doc) => ({
      id: doc.id,
      itemTitle: text(doc.get('itemTitle')),
      note: text(doc.get('note')),
      visitorLabel: text(doc.get('visitorLabel')),
    }));
}
