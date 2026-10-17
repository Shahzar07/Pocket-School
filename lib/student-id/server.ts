/**
 * Server writes for the free student ID. The QR token and the checkout code
 * are issued for every account. Student standing is a label, not a lock.
 */

import { randomInt } from 'node:crypto';
import type { DocumentData } from 'firebase-admin/firestore';
import { asAgeTier } from '../age-tier';
import { seatCoverage } from '../billing/store';
import { adminDb } from '../firebase-admin';
import { notifyUser } from '../server/device-push';
import { ActionError } from '../server/actions';
import {
  CODE_TTL_MS,
  codeDecision,
  displayStanding,
  issuePaceAllowed,
  newPerkPush,
  nextCodeFailure,
  nextStandingRecord,
  offerVisible,
  publicVerification,
  reviewOffer,
  standingFor,
  type CodeType,
  type PublicVerification,
} from './model';
import { codeDigest, perkAuditHash, readStudentToken, signStudentToken } from './token';

function db() {
  return adminDb();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function words(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

export function cardTokenSecret(): string {
  return text(process.env.CARD_TOKEN_SECRET);
}

function secret(): string {
  const value = cardTokenSecret();
  if (value.length < 16) throw new ActionError('INVALID', 'The student ID check is coming soon.');
  return value;
}

async function enrolled(uid: string): Promise<boolean> {
  const snap = await db().collectionGroup('enrollments').where('studentId', '==', uid).limit(1).get();
  return !snap.empty;
}

export async function refreshStanding(uid: string, now = Date.now()): Promise<'verified' | 'member'> {
  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  const data = snap.data() ?? {};
  const role = text(data.role);
  const tier = role === 'admin' || role === 'teacher' || role === 'institution_admin'
    ? 5
    : typeof data.accessTier === 'number'
      ? data.accessTier
      : text(data.subscriptionTier) === 'academic'
        ? 2
        : 0;
  const seat = await seatCoverage(uid);
  const standing = standingFor({ tier, seatActive: seat.seatActive, enrolled: await enrolled(uid) });
  const previous = data.studentStatus && typeof data.studentStatus === 'object'
    ? data.studentStatus as { status?: string; verifiedAt?: number | null; validUntil?: number }
    : null;
  await ref.set({ studentStatus: nextStandingRecord(standing, previous, now) }, { merge: true });
  return standing;
}

export async function issueCardProof(uid: string, now = Date.now()): Promise<{
  token: string;
  validUntil: number;
  verifyPath: string;
  code: string;
  codeValidUntil: number;
  standing: 'verified' | 'member';
}> {
  const key = secret();
  const standing = await refreshStanding(uid, now).catch(() => 'member' as const);
  const token = signStudentToken(uid, now, key);
  const limitRef = db().doc(`student_code_limits/${uid}`);
  const limitSnap = await limitRef.get();
  const recent = Array.isArray(limitSnap.data()?.times)
    ? (limitSnap.data()?.times as unknown[]).filter((item): item is number => typeof item === 'number')
    : [];
  if (!issuePaceAllowed(recent, now)) throw new ActionError('LOCKED', 'Too many codes. Wait a minute and try again.');
  let code = '';
  let digest = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    digest = codeDigest(code, key);
    const existing = await db().doc(`student_codes/${digest}`).get();
    if (!existing.exists || Number(existing.data()?.validUntil ?? 0) <= now) break;
  }
  const previous = text(limitSnap.data()?.currentHash);
  if (previous && previous !== digest) await db().doc(`student_codes/${previous}`).delete().catch(() => undefined);
  const codeValidUntil = now + CODE_TTL_MS;
  await db().doc(`student_codes/${digest}`).set({ uid, validUntil: codeValidUntil, attempts: 0, lockedUntil: 0 });
  await limitRef.set({ times: [...recent.filter((at) => now - at < 60_000), now].slice(-8), currentHash: digest }, { merge: true });
  return { ...token, verifyPath: `/verify/${token.token}`, code, codeValidUntil, standing };
}

async function userFace(uid: string, active: boolean, validUntil: number, now: number): Promise<PublicVerification | null> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const stored = data.studentStatus && typeof data.studentStatus === 'object'
    ? data.studentStatus as { status?: string; validUntil?: number }
    : null;
  return publicVerification({
    name: text(data.name) || text(data.displayName),
    ageTier: asAgeTier(data.ageTier),
    avatarUrl: text(data.avatarUrl),
    standing: displayStanding(stored, now),
    active,
    validUntil,
  });
}

export async function verifyCardToken(token: string, now = Date.now()): Promise<PublicVerification | null> {
  const key = secret();
  const read = readStudentToken(token, now, key);
  if (!read) return null;
  return userFace(read.uid, read.active, read.validUntil, now);
}

async function bumpFailure(actor: string, now: number): Promise<'missing' | 'locked'> {
  const ref = db().doc(`student_code_attempts/${actor}`);
  const snap = await ref.get();
  const attempts = Number(snap.data()?.attempts ?? 0);
  const lockedUntil = Number(snap.data()?.lockedUntil ?? 0);
  if (lockedUntil > now) return 'locked';
  const next = nextCodeFailure(attempts, now);
  await ref.set({ attempts: next.attempts, lockedUntil: next.lockedUntil, at: now });
  return next.lockedUntil > now ? 'locked' : 'missing';
}

export async function verifyCheckoutCode(actor: string, code: string, now = Date.now()): Promise<PublicVerification | 'locked' | null> {
  const key = secret();
  const attemptRef = db().doc(`student_code_attempts/${actor}`);
  const attempt = await attemptRef.get();
  if (Number(attempt.data()?.lockedUntil ?? 0) > now) return 'locked';
  const digest = codeDigest(code, key);
  const snap = await db().doc(`student_codes/${digest}`).get();
  const gate = snap.exists
    ? { attempts: Number(snap.data()?.attempts ?? 0), lockedUntil: Number(snap.data()?.lockedUntil ?? 0), validUntil: Number(snap.data()?.validUntil ?? 0) }
    : null;
  const decision = codeDecision(gate, now, snap.exists);
  if (decision === 'locked') return 'locked';
  if (decision !== 'ok') {
    const failed = await bumpFailure(actor, now);
    return failed === 'locked' ? 'locked' : null;
  }
  await attemptRef.set({ attempts: 0, lockedUntil: 0, at: now });
  const uid = text(snap.data()?.uid);
  return userFace(uid, true, gate?.validUntil ?? now, now);
}

function offerCategories(offer: DocumentData, partner: DocumentData): string[] {
  const own = text(offer.category);
  return own ? [own] : words(partner.categories);
}

export async function listVisibleOffers(uid: string, now = Date.now()): Promise<Array<Record<string, unknown>>> {
  const user = await db().doc(`users/${uid}`).get();
  const data = user.data() ?? {};
  const minor = asAgeTier(data.ageTier) !== 'adult';
  const viewer = { minor, country: text(data.country), city: text(data.city) };
  const snap = await db().collection('offers').where('status', '==', 'live').limit(80).get();
  const rows: Array<Record<string, unknown>> = [];
  for (const doc of snap.docs) {
    const offer = doc.data();
    const partnerSnap = await db().doc(`partners/${text(offer.partnerId)}`).get();
    if (!partnerSnap.exists || partnerSnap.data()?.verified !== true) continue;
    const partner = partnerSnap.data() ?? {};
    const categories = offerCategories(offer, partner);
    const face = {
      status: 'live',
      ageMin: Number(offer.ageMin ?? 0),
      countries: words(offer.countries),
      cities: words(offer.cities),
      startsAt: Number(offer.startsAt ?? 0),
      endsAt: Number(offer.endsAt ?? 0),
      categories,
    };
    if (!offerVisible(face, viewer, now)) continue;
    rows.push({
      id: doc.id,
      partnerId: text(offer.partnerId),
      partnerName: text(partner.name),
      logo: text(partner.logo),
      title: text(offer.title),
      discount: text(offer.discount),
      terms: text(offer.terms),
      codeType: text(offer.codeType),
      staticCode: text(offer.codeType) === 'static' ? text(offer.staticCode) : '',
      category: categories[0] ?? 'study',
      categories,
    });
  }
  return rows;
}

async function appendPerkAudit(entry: Record<string, unknown>, now: number): Promise<void> {
  const headRef = db().doc('perk_audit_head/current');
  const eventRef = db().collection('perk_audit').doc();
  await db().runTransaction(async (tx) => {
    const head = await tx.get(headRef);
    const prevHash = head.exists ? text(head.data()?.hash) : '';
    const seq = head.exists ? Number(head.data()?.seq ?? 0) + 1 : 1;
    const payload = { seq, prevHash, at: now, ...entry };
    const hash = perkAuditHash(prevHash, payload);
    tx.set(eventRef, { ...payload, hash });
    tx.set(headRef, { seq, hash, at: now });
  });
}

export async function redeemOffer(uid: string, offerId: string, method: CodeType, now = Date.now()): Promise<{ ok: true; code: string }> {
  const offerSnap = await db().doc(`offers/${offerId}`).get();
  if (!offerSnap.exists) throw new ActionError('NOT_FOUND', 'That perk is not available.');
  const offer = offerSnap.data() ?? {};
  const partnerSnap = await db().doc(`partners/${text(offer.partnerId)}`).get();
  const partner = partnerSnap.data() ?? {};
  const user = await db().doc(`users/${uid}`).get();
  const data = user.data() ?? {};
  const minor = asAgeTier(data.ageTier) !== 'adult';
  const categories = offerCategories(offer, partner);
  const visible = offerVisible({
    status: text(offer.status),
    ageMin: Number(offer.ageMin ?? 0),
    countries: words(offer.countries),
    cities: words(offer.cities),
    startsAt: Number(offer.startsAt ?? 0),
    endsAt: Number(offer.endsAt ?? 0),
    categories,
  }, { minor, country: text(data.country), city: text(data.city) }, now);
  if (!visible) throw new ActionError('FORBIDDEN', 'This perk is not available on your card.');
  const code = method === 'static'
    ? text(offer.staticCode)
    : String(randomInt(0, 1_000_000)).padStart(6, '0');
  const redemption = {
    offerId,
    uid,
    partnerId: text(offer.partnerId),
    at: now,
    method,
  };
  const ref = db().collection('redemptions').doc();
  await ref.set(redemption);
  await appendPerkAudit({ type: 'redeemed', ...redemption, redemptionId: ref.id }, now);
  return { ok: true, code };
}

export async function applyPartner(uid: string, input: {
  name: string;
  logo: string;
  categories: string[];
  countries: string[];
  contact: string;
}, now = Date.now()): Promise<string> {
  const name = input.name.trim();
  const contact = input.contact.trim();
  if (name.length < 2 || contact.length < 3) throw new ActionError('VALIDATION', 'Add a business name and a contact.');
  const ref = db().collection('partners').doc();
  await ref.set({
    name,
    logo: input.logo.trim(),
    categories: input.categories.map((item) => item.trim()).filter(Boolean).slice(0, 8),
    countries: input.countries.map((item) => item.trim()).filter(Boolean).slice(0, 20),
    verified: false,
    contact,
    ownerUid: uid,
    status: 'pending',
    at: now,
  });
  return ref.id;
}

export async function decidePartner(partnerId: string, approve: boolean): Promise<void> {
  const ref = db().doc(`partners/${partnerId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Partner not found.');
  const ownerUid = text(snap.data()?.ownerUid);
  await ref.set({ verified: approve, status: approve ? 'approved' : 'rejected' }, { merge: true });
  if (approve && ownerUid) {
    await db().doc(`users/${ownerUid}`).set({ role: 'partner_merchant', partnerId }, { merge: true });
  }
}

export async function createOffer(uid: string, input: {
  title: string;
  discount: string;
  terms: string;
  codeType: string;
  ageMin: number;
  countries: string[];
  cities: string[];
  startsAt: number;
  endsAt: number;
  category: string;
  staticCode: string;
}, now = Date.now()): Promise<string> {
  const partner = await db().collection('partners').where('ownerUid', '==', uid).where('status', '==', 'approved').limit(1).get();
  if (partner.empty) throw new ActionError('FORBIDDEN', 'An approved partner account is required.');
  const partnerDoc = partner.docs[0];
  if (!partnerDoc) throw new ActionError('FORBIDDEN', 'An approved partner account is required.');
  const codeType: CodeType = input.codeType === 'unique' || input.codeType === 'scan' || input.codeType === 'static' ? input.codeType : 'scan';
  const categories = [input.category.trim() || words(partnerDoc.data().categories)[0] || 'study'];
  const review = reviewOffer(categories, input.ageMin);
  if (!review.ok) throw new ActionError('VALIDATION', review.reason);
  const ref = db().collection('offers').doc();
  await ref.set({
    partnerId: partnerDoc.id,
    title: input.title.trim(),
    discount: input.discount.trim(),
    terms: input.terms.trim(),
    codeType,
    ageMin: Math.max(0, Math.round(input.ageMin)),
    countries: input.countries,
    cities: input.cities,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: 'review',
    category: categories[0],
    staticCode: codeType === 'static' ? input.staticCode.trim() : '',
    at: now,
  });
  return ref.id;
}

export async function decideOffer(offerId: string, approve: boolean, now = Date.now()): Promise<void> {
  const ref = db().doc(`offers/${offerId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Offer not found.');
  const offer = snap.data() ?? {};
  const partner = await db().doc(`partners/${text(offer.partnerId)}`).get();
  const categories = offerCategories(offer, partner.data() ?? {});
  if (approve) {
    const review = reviewOffer(categories, Number(offer.ageMin ?? 0));
    if (!review.ok) throw new ActionError('VALIDATION', review.reason);
  }
  await ref.set({ status: approve ? 'live' : 'rejected' }, { merge: true });
  if (!approve) return;
  const push = newPerkPush(text(offer.title) || 'A partner perk', offerId);
  const students = await db().collection('users').where('role', '==', 'student').limit(25).get();
  for (const student of students.docs) {
    await notifyUser({
      userId: student.id,
      title: push.title,
      message: push.body,
      type: 'general',
      link: push.link,
      pref: 'general',
    }).catch(() => undefined);
  }
}

export async function partnerDesk(uid: string): Promise<{ partner: Record<string, unknown> | null; offers: Array<Record<string, unknown>> }> {
  const snap = await db().collection('partners').where('ownerUid', '==', uid).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return { partner: null, offers: [] };
  const offers = await db().collection('offers').where('partnerId', '==', doc.id).limit(40).get();
  const rows: Array<Record<string, unknown>> = [];
  for (const offer of offers.docs) {
    const count = await db().collection('redemptions').where('offerId', '==', offer.id).count().get();
    rows.push({
      id: offer.id,
      title: text(offer.data().title),
      discount: text(offer.data().discount),
      status: text(offer.data().status),
      redemptions: count.data().count,
    });
  }
  const data = doc.data();
  return {
    partner: { id: doc.id, name: text(data.name), status: text(data.status), verified: data.verified === true },
    offers: rows,
  };
}

export async function adminQueue(): Promise<{ partners: Array<Record<string, unknown>>; offers: Array<Record<string, unknown>> }> {
  const partners = await db().collection('partners').where('status', '==', 'pending').limit(40).get();
  const offers = await db().collection('offers').where('status', '==', 'review').limit(40).get();
  return {
    partners: partners.docs.map((doc) => ({ id: doc.id, name: text(doc.data().name), contact: text(doc.data().contact), categories: words(doc.data().categories) })),
    offers: offers.docs.map((doc) => ({
      id: doc.id,
      title: text(doc.data().title),
      partnerId: text(doc.data().partnerId),
      ageMin: Number(doc.data().ageMin ?? 0),
      category: text(doc.data().category),
    })),
  };
}
