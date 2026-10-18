/**
 * Server-only writes for the free member card, its share link, and referrals.
 * Clients cannot write these documents. The card audit chain is append-only.
 * Nothing here reads a plan or a paid feature.
 */

import { randomBytes } from 'node:crypto';
import { FieldPath, FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { asAgeTier } from '../age-tier';
import { chainHash } from '../billing/model';
import { parentLinkId } from '../parent-controls';
import { recordActivity } from '../audit/server';
import { ActionError } from '../server/actions';
import { brandFromSchool, poketBrand, type IdCardBrand } from './id-face';
import {
  hasInstitution,
  issuedNumber,
  normaliseReferralCode,
  publicCard,
  redeemDecision,
  referralCodeFromBytes,
  shareIdAccepts,
  withRedemption,
  type CardAuditType,
  type CardSource,
  type PublicCard,
  type ReferralRecord,
  type ShareChannel,
} from './model';

function db() {
  return adminDb();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function newShareId(): string {
  return randomBytes(18).toString('base64url');
}

async function appendCardAudit(entry: {
  type: CardAuditType;
  uid: string;
  shareId: string;
  at: number;
  actorUid: string;
  channel?: string;
  viewCount?: number;
}): Promise<void> {
  const headRef = db().doc('card_audit_head/current');
  const eventRef = db().collection('card_audit').doc();
  await db().runTransaction(async (tx) => {
    const head = await tx.get(headRef);
    const prevHash = head.exists ? text(head.data()?.hash) : '';
    const seq = head.exists ? Number(head.data()?.seq ?? 0) + 1 : 1;
    const payload = {
      seq,
      prevHash,
      type: entry.type,
      uid: entry.uid,
      shareId: entry.shareId,
      at: entry.at,
      actorUid: entry.actorUid,
      channel: entry.channel ?? '',
      viewCount: entry.viewCount ?? 0,
    };
    const hash = chainHash(prevHash, payload);
    tx.set(eventRef, { ...payload, hash });
    tx.set(headRef, { seq, hash, at: entry.at });
  });
}

async function activity(uid: string, action: string, shareId: string, after: Record<string, unknown>): Promise<void> {
  await recordActivity({
    action,
    actorId: uid,
    actorRole: 'member',
    targetType: 'card_share',
    targetId: shareId,
    after,
  });
}

export async function issueStudentNumber(uid: string): Promise<string> {
  const userRef = db().doc(`users/${uid}`);
  return db().runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
    const data = userSnap.data() ?? {};
    const current = text(data.studentNumber);
    if (current) return current;
    const institution = hasInstitution(data.institutionId);
    const seqRef = db().doc(`number_sequences/${institution ? 'student' : 'member'}`);
    const seqSnap = await tx.get(seqRef);
    let seq = Number(seqSnap.data()?.seq ?? 1000);
    const candidates: string[] = [];
    for (let step = 1; step <= 8; step += 1) candidates.push(issuedNumber(institution, seq + step));
    const taken = await Promise.all(candidates.map((candidate) => tx.get(db().doc(`student_numbers/${candidate}`))));
    const free = candidates.findIndex((_, index) => !taken[index]?.exists);
    if (free < 0) throw new ActionError('INVALID', 'Could not issue a member number.');
    const studentNumber = candidates[free] ?? '';
    const nextSeq = seq + free + 1;
    tx.set(seqRef, { seq: nextSeq });
    tx.set(db().doc(`student_numbers/${studentNumber}`), { uid, at: Date.now() });
    tx.set(userRef, { studentNumber }, { merge: true });
    return studentNumber;
  });
}

export async function ensureReferral(uid: string, now = Date.now()): Promise<string> {
  const userRef = db().doc(`users/${uid}`);
  const existing = await userRef.get();
  const current = normaliseReferralCode(existing.data()?.referralCode);
  if (current) return current;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = referralCodeFromBytes(randomBytes(8));
    const created = await db().runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const already = normaliseReferralCode(userSnap.data()?.referralCode);
      if (already) return already;
      const ref = db().doc(`referrals/${code}`);
      const snap = await tx.get(ref);
      if (snap.exists) return '';
      const record: ReferralRecord = { inviterUid: uid, createdAt: now, redeemedBy: [] };
      tx.set(ref, record);
      tx.set(userRef, { referralCode: code }, { merge: true });
      return code;
    });
    if (created) return created;
  }
  throw new ActionError('INVALID', 'Could not create a referral code.');
}

export async function ensureMemberIdentity(uid: string, now = Date.now()): Promise<{ studentNumber: string; referralCode: string }> {
  const studentNumber = await issueStudentNumber(uid);
  const referralCode = await ensureReferral(uid, now);
  return { studentNumber, referralCode };
}

export async function redeemReferral(uid: string, rawCode: unknown, now = Date.now()): Promise<'missing' | 'self' | 'already' | 'ok'> {
  const code = normaliseReferralCode(rawCode);
  if (!code) return 'missing';
  const ref = db().doc(`referrals/${code}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'missing';
    const data = snap.data() ?? {};
    const record: ReferralRecord = {
      inviterUid: text(data.inviterUid),
      createdAt: Number(data.createdAt ?? 0),
      redeemedBy: Array.isArray(data.redeemedBy)
        ? data.redeemedBy.flatMap((row) => {
          if (!row || typeof row !== 'object') return [];
          const item = row as { uid?: unknown; at?: unknown };
          return typeof item.uid === 'string' ? [{ uid: item.uid, at: Number(item.at ?? 0) }] : [];
        })
        : [],
    };
    const decision = redeemDecision(record, uid);
    if (decision !== 'ok') return decision;
    tx.set(ref, withRedemption(record, uid, now));
    return 'ok';
  });
}

async function badgeLabels(uid: string): Promise<string[]> {
  const snap = await db().collection('certificates').where('studentId', '==', uid).limit(8).get();
  return snap.docs.flatMap((item) => {
    const data = item.data();
    if (data.status === 'revoked') return [];
    const label = text(data.moduleTitle) || text(data.courseTitle);
    return label ? [label] : [];
  }).slice(0, 3);
}

async function schoolRecord(data: DocumentData): Promise<{ name: string; brand: IdCardBrand }> {
  const named = text(data.institutionName) || text(data.institution);
  const id = text(data.institutionId);
  if (!id && !named) return { name: '', brand: poketBrand() };
  if (!id) return { name: named, brand: brandFromSchool(named, null) };
  const school = await db().doc(`institutions/${id}`).get();
  const schoolData = school.data() ?? {};
  const branding = schoolData.branding && typeof schoolData.branding === 'object'
    ? schoolData.branding as Record<string, unknown>
    : null;
  const name = text(branding?.displayName) || text(schoolData.name) || named;
  return { name, brand: brandFromSchool(name, branding) };
}

function sourceFrom(data: DocumentData, badges: string[], referralCode: string, revoked: boolean): CardSource {
  return {
    name: text(data.name) || text(data.displayName),
    level: text(data.level),
    pathway: text(data.pathway),
    institutionId: text(data.institutionId),
    institutionName: '',
    ageTier: asAgeTier(data.ageTier),
    avatarUrl: text(data.avatarUrl),
    studyDates: Array.isArray(data.studyDates) ? data.studyDates.filter((day): day is string => typeof day === 'string') : [],
    badges,
    referralCode,
    cardIndexed: data.cardIndexed === true,
    cardSharing: data.cardSharing === true,
    revoked,
  };
}

export interface OwnerCard {
  studentNumber: string;
  referralCode: string;
  shareId: string;
  sharePath: string;
  publicCard: PublicCard;
  ageTier: CardSource['ageTier'];
  parentRequired: boolean;
  canShare: boolean;
  indexed: boolean;
  schoolName: string;
  holderName: string;
  brand: IdCardBrand;
}

async function ownerFromUser(uid: string, now: number): Promise<OwnerCard> {
  const identity = await ensureMemberIdentity(uid, now);
  const snap = await db().doc(`users/${uid}`).get();
  const data = snap.data() ?? {};
  const shareId = text(data.cardShareId);
  let revoked = !shareId;
  if (shareId) {
    const share = await db().doc(`card_shares/${shareId}`).get();
    revoked = !share.exists || share.data()?.revoked === true || text(share.data()?.uid) !== uid;
  }
  const badges = await badgeLabels(uid);
  const school = await schoolRecord(data);
  const built = sourceFrom(data, badges, identity.referralCode, revoked);
  built.institutionName = school.name;
  const face = publicCard(built, dayKey(now));
  const under13 = built.ageTier === 'under13';
  return {
    studentNumber: identity.studentNumber,
    referralCode: identity.referralCode,
    shareId: revoked ? '' : shareId,
    sharePath: revoked ? '' : `/card/${shareId}`,
    publicCard: face,
    ageTier: built.ageTier,
    parentRequired: under13,
    canShare: !under13 || built.cardSharing,
    indexed: built.cardIndexed,
    schoolName: school.name,
    holderName: text(data.name) || text(data.displayName) || face.firstName,
    brand: school.name ? school.brand : poketBrand(),
  };
}

export async function ownerCard(uid: string, now = Date.now()): Promise<OwnerCard> {
  return ownerFromUser(uid, now);
}

async function approvedParent(parentUid: string, childUid: string): Promise<boolean> {
  const snap = await db().doc(`parent_links/${parentLinkId(parentUid, childUid)}`).get();
  return snap.exists && snap.data()?.status === 'approved' && snap.data()?.parentId === parentUid && snap.data()?.studentId === childUid;
}

export async function linkedUnder13(parentUid: string): Promise<{ uid: string; name: string; sharing: boolean; sharePath: string }[]> {
  const links = await db().collection('parent_links').where('parentId', '==', parentUid).limit(40).get();
  const rows = [];
  for (const link of links.docs) {
    const data = link.data();
    if (data.status !== 'approved' || typeof data.studentId !== 'string') continue;
    const child = await db().doc(`users/${data.studentId}`).get();
    const profile = child.data();
    if (!profile || asAgeTier(profile.ageTier) !== 'under13') continue;
    const shareId = text(profile.cardShareId);
    rows.push({
      uid: data.studentId,
      name: text(profile.name) || text(profile.displayName) || 'Member',
      sharing: profile.cardSharing === true && shareId.length > 0,
      sharePath: profile.cardSharing === true && shareId ? `/card/${shareId}` : '',
    });
  }
  return rows;
}

async function writeShare(uid: string, actorUid: string, type: 'created' | 'regenerated', now: number): Promise<string> {
  const userRef = db().doc(`users/${uid}`);
  const shareId = newShareId();
  const previous = text((await userRef.get()).data()?.cardShareId);
  if (previous) {
    await db().doc(`card_shares/${previous}`).set({ revoked: true, revokedAt: now }, { merge: true });
  }
  await db().doc(`card_shares/${shareId}`).set({
    uid,
    createdAt: now,
    revoked: false,
    viewCount: 0,
  });
  await userRef.set({ cardShareId: shareId }, { merge: true });
  await appendCardAudit({ type, uid, shareId, at: now, actorUid });
  await activity(actorUid, type === 'created' ? 'card.created' : 'card.regenerated', shareId, { uid });
  return shareId;
}

export async function createShare(uid: string, actorUid: string, now = Date.now()): Promise<string> {
  const card = await ownerFromUser(uid, now);
  if (!card.canShare) throw new ActionError('FORBIDDEN', 'A verified parent turns sharing on for someone under 13.');
  if (card.shareId) return card.shareId;
  return writeShare(uid, actorUid, 'created', now);
}

export async function regenerateShare(uid: string, actorUid: string, now = Date.now()): Promise<string> {
  const card = await ownerFromUser(uid, now);
  if (!card.canShare) throw new ActionError('FORBIDDEN', 'A verified parent turns sharing on for someone under 13.');
  return writeShare(uid, actorUid, card.shareId ? 'regenerated' : 'created', now);
}

export async function revokeShare(uid: string, actorUid: string, now = Date.now()): Promise<void> {
  const snap = await db().doc(`users/${uid}`).get();
  const shareId = text(snap.data()?.cardShareId);
  if (!shareId) return;
  await db().doc(`card_shares/${shareId}`).set({ revoked: true, revokedAt: now }, { merge: true });
  await db().doc(`users/${uid}`).set({ cardShareId: FieldValue.delete() }, { merge: true });
  await appendCardAudit({ type: 'revoked', uid, shareId, at: now, actorUid });
  await activity(actorUid, 'card.revoked', shareId, { uid });
}

export async function setParentSharing(parentUid: string, childUid: string, enabled: boolean, now = Date.now()): Promise<void> {
  if (!(await approvedParent(parentUid, childUid))) {
    throw new ActionError('FORBIDDEN', 'Sharing for someone under 13 needs an approved parent link.');
  }
  const child = await db().doc(`users/${childUid}`).get();
  if (asAgeTier(child.data()?.ageTier) !== 'under13') {
    throw new ActionError('INVALID', 'That member can share their own card.');
  }
  await db().doc(`users/${childUid}`).set({ cardSharing: enabled }, { merge: true });
  if (enabled) await createShare(childUid, parentUid, now);
  else await revokeShare(childUid, parentUid, now);
}

export async function setCardIndexed(uid: string, indexed: boolean): Promise<void> {
  const snap = await db().doc(`users/${uid}`).get();
  if (asAgeTier(snap.data()?.ageTier) !== 'adult') {
    throw new ActionError('FORBIDDEN', 'Only an adult can choose whether the card is indexed.');
  }
  await db().doc(`users/${uid}`).set({ cardIndexed: indexed }, { merge: true });
}

export async function recordShareChannel(uid: string, channel: ShareChannel, now = Date.now()): Promise<void> {
  const shareId = text((await db().doc(`users/${uid}`).get()).data()?.cardShareId);
  if (!shareId) throw new ActionError('INVALID', 'Create a share link first.');
  await appendCardAudit({ type: 'channel', uid, shareId, at: now, actorUid: uid, channel });
  await activity(uid, 'card.channel', shareId, { channel });
}

export async function loadPublicCard(shareId: string, now = Date.now()): Promise<PublicCard | null> {
  if (!shareIdAccepts(shareId)) return null;
  const share = await db().doc(`card_shares/${shareId}`).get();
  if (!share.exists || share.data()?.revoked === true) return null;
  const uid = text(share.data()?.uid);
  if (!uid) return null;
  const user = await db().doc(`users/${uid}`).get();
  if (!user.exists || text(user.data()?.cardShareId) !== shareId) return null;
  const data = user.data() ?? {};
  const badges = await badgeLabels(uid);
  const built = sourceFrom(data, badges, text(data.referralCode), false);
  built.institutionName = (await schoolRecord(data)).name;
  const face = publicCard(built, dayKey(now));
  return face.visible ? face : null;
}

export async function recordCardView(shareId: string, now = Date.now()): Promise<void> {
  if (!shareIdAccepts(shareId)) return;
  const ref = db().doc(`card_shares/${shareId}`);
  const viewCount = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.revoked === true) return 0;
    const next = Number(snap.data()?.viewCount ?? 0) + 1;
    tx.set(ref, { viewCount: next }, { merge: true });
    return next;
  });
  if (!viewCount) return;
  const uid = text((await ref.get()).data()?.uid);
  await appendCardAudit({ type: 'view', uid, shareId, at: now, actorUid: 'public', viewCount });
}

export async function backfillMemberNumbers(limit = 40): Promise<{ checked: number; issued: number }> {
  const cursorRef = db().doc('number_sequences/backfill');
  const cursorSnap = await cursorRef.get();
  const cursor = text(cursorSnap.data()?.cursor);
  let query = db().collection('users').orderBy(FieldPath.documentId()).limit(limit);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  let issued = 0;
  for (const item of page.docs) {
    if (!text(item.data().studentNumber) || !normaliseReferralCode(item.data().referralCode)) {
      await ensureMemberIdentity(item.id);
      issued += 1;
    }
  }
  const last = page.docs[page.docs.length - 1]?.id ?? cursor;
  await cursorRef.set({ cursor: page.empty ? '' : last, at: Date.now(), done: page.empty });
  return { checked: page.docs.length, issued };
}
