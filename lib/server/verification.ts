/**
 * Server-only verification writes. Clients cannot set users.verification.
 */

import { randomBytes } from 'node:crypto';
import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { CODE_TTL_MS, generateCode, getOtpSecret, signOtp, verifyOtpToken } from '../email-otp';
import { countryCodeOf } from '../emergency-numbers/catalog';
import { requestIdCheck } from '../verification/id-check';
import {
  emailDomainMatches,
  emptyVerification,
  raiseVerification,
  readVerification,
  type VerificationMethod,
  type VerificationRecord,
} from '../verification/policy';
import { ActionError } from './actions';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function user(uid: string) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  return snap;
}

async function actor(uid: string) {
  const snap = await user(uid);
  const data = snap.data() ?? {};
  return {
    id: uid,
    role: str(data.role),
    institutionId: str(data.institutionId),
    staffPost: str(data.staffPost),
    email: str(data.email),
    phone: str(data.phone),
    verification: readVerification(data.verification),
    emailVerified: data.emailVerified === true,
    phoneVerified: data.phoneVerified === true,
  };
}

async function writeVerification(uid: string, next: VerificationRecord, extra: Record<string, unknown> = {}) {
  await db().doc(`users/${uid}`).set({ verification: next, ...extra, updatedAt: Date.now() }, { merge: true });
  return next;
}

async function review(uid: string, by: string, method: VerificationMethod, note: string) {
  await db().collection('verification_reviews').add({
    uid,
    by,
    method,
    note: note.slice(0, 500),
    at: Date.now(),
  });
}

export async function readOwnVerification(uid: string) {
  const row = await actor(uid);
  return row.verification;
}

export async function confirmEmailCode(uid: string, code: string, token: string, expiresAt: number) {
  const row = await actor(uid);
  if (!row.email || !verifyOtpToken(row.email, code, expiresAt, token)) {
    throw new ActionError('BAD_REQUEST', 'That email code is not valid.');
  }
  const next = raiseVerification(row.verification, bothContacts(row.verification, true, row.phoneVerified, uid));
  await writeVerification(uid, next, { emailVerified: true });
  return next;
}

export async function sendPhoneCode(uid: string) {
  const row = await actor(uid);
  if (!row.phone) throw new ActionError('BAD_REQUEST', 'Add a phone number first.');
  if (!getOtpSecret()) throw new ActionError('BAD_REQUEST', 'Phone verification is not configured.');
  const code = generateCode();
  const expiresAt = Date.now() + CODE_TTL_MS;
  const token = signOtp(`phone:${row.phone}`, code, expiresAt);
  const hook = process.env.SMS_WEBHOOK_URL?.trim();
  if (hook) {
    const response = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: row.phone, code }),
    });
    if (!response.ok) throw new ActionError('BAD_REQUEST', 'The phone code could not be sent.');
  } else if (process.env.NODE_ENV === 'production') {
    throw new ActionError('BAD_REQUEST', 'Phone verification is not configured.');
  } else {
    console.info('phone verification code', { uid, phone: row.phone });
  }
  return { token, expiresAt };
}

export async function confirmPhoneCode(uid: string, code: string, token: string, expiresAt: number) {
  const row = await actor(uid);
  if (!row.phone || !verifyOtpToken(`phone:${row.phone}`, code, expiresAt, token)) {
    throw new ActionError('BAD_REQUEST', 'That phone code is not valid.');
  }
  const next = raiseVerification(row.verification, bothContacts(row.verification, row.emailVerified, true, uid));
  await writeVerification(uid, next, { phoneVerified: true });
  return next;
}

function bothContacts(current: VerificationRecord, email: boolean, phone: boolean, uid: string): VerificationRecord {
  if (!email || !phone) return current;
  return {
    tier: 1,
    method: 'otp',
    verifiedAt: Date.now(),
    verifiedBy: uid,
  };
}

export async function createGuardianCode(parentUid: string) {
  const row = await actor(parentUid);
  if (row.role !== 'parent' && row.role !== 'admin') {
    throw new ActionError('FORBIDDEN', 'A parent creates a guardian code.');
  }
  const code = randomBytes(4).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  await db().doc(`guardian_link_codes/${code}`).create({
    parentUid,
    expiresAt,
    used: false,
    createdAt: Date.now(),
  });
  return { code, expiresAt };
}

export async function confirmGuardianCode(childUid: string, code: string) {
  const clean = code.trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(clean)) throw new ActionError('BAD_REQUEST', 'Enter the guardian code.');
  const ref = db().doc(`guardian_link_codes/${clean}`);
  const snap = await ref.get();
  const data = snap.data() ?? {};
  if (!snap.exists || data.used === true || Number(data.expiresAt) < Date.now()) {
    throw new ActionError('BAD_REQUEST', 'That guardian code is not valid.');
  }
  const parentUid = str(data.parentUid);
  const parent = await actor(parentUid);
  const next = raiseVerification(parent.verification, {
    tier: 2,
    method: 'guardian_link',
    verifiedAt: Date.now(),
    verifiedBy: childUid,
  });
  await writeVerification(parentUid, next);
  await ref.set({ used: true, confirmedBy: childUid, confirmedAt: Date.now() }, { merge: true });
  const linkId = `${parentUid}_${childUid}`;
  await db().doc(`parent_links/${linkId}`).set({
    parentId: parentUid,
    studentId: childUid,
    status: 'approved',
    updatedAt: Date.now(),
  }, { merge: true });
  return { ok: true, parentUid };
}

export async function runOptionalIdCheck(uid: string) {
  const result = await requestIdCheck({ uid });
  if (result.skipped || !result.ok) return result;
  const row = await actor(uid);
  const next = raiseVerification(row.verification, {
    tier: 2,
    method: 'id_check',
    verifiedAt: Date.now(),
    verifiedBy: 'id_check',
  });
  await writeVerification(uid, next);
  return result;
}

export async function verifyStaff(actorUid: string, targetUid: string, method: 'admin_invite' | 'email_domain') {
  const caller = await actor(actorUid);
  const target = await actor(targetUid);
  const sameSchool = caller.institutionId && caller.institutionId === target.institutionId;
  const allowed = caller.role === 'admin' || (caller.role === 'institution_admin' && sameSchool);
  if (!allowed) throw new ActionError('FORBIDDEN', 'A school admin verifies staff.');
  if (target.staffPost === 'principal') {
    throw new ActionError('BAD_REQUEST', 'A principal is verified by a Poket School super admin.');
  }
  if (method === 'email_domain') {
    const school = await db().doc(`institutions/${target.institutionId}`).get();
    const domain = str(school.data()?.emailDomain);
    if (!emailDomainMatches(target.email, domain)) {
      throw new ActionError('BAD_REQUEST', 'The email domain does not match the school.');
    }
  }
  const next = raiseVerification(target.verification, {
    tier: 3,
    method,
    verifiedAt: Date.now(),
    verifiedBy: actorUid,
  });
  await writeVerification(targetUid, next);
  await review(targetUid, actorUid, method, '');
  return next;
}

export async function verifyPrincipal(actorUid: string, targetUid: string, note: string) {
  const caller = await actor(actorUid);
  if (caller.role !== 'admin') throw new ActionError('FORBIDDEN', 'A Poket School super admin verifies a principal.');
  if (note.trim().length < 3) throw new ActionError('BAD_REQUEST', 'Record the school registration documents you checked.');
  const target = await actor(targetUid);
  if (target.staffPost !== 'principal') throw new ActionError('BAD_REQUEST', 'That account is not a principal.');
  const next = raiseVerification(target.verification, {
    tier: 3,
    method: 'school_documents',
    verifiedAt: Date.now(),
    verifiedBy: actorUid,
  });
  await writeVerification(targetUid, next);
  await review(targetUid, actorUid, 'school_documents', note.trim());
  return next;
}

export async function verifyPartner(actorUid: string, targetUid: string, kind: 'police' | 'ngo') {
  const caller = await actor(actorUid);
  if (caller.role !== 'admin') throw new ActionError('FORBIDDEN', 'A Poket School super admin verifies a partner.');
  const target = await actor(targetUid);
  const next = raiseVerification(target.verification, {
    tier: 4,
    method: 'partner_review',
    verifiedAt: Date.now(),
    verifiedBy: actorUid,
  });
  await writeVerification(targetUid, next, { partnerKind: kind });
  await review(targetUid, actorUid, 'partner_review', kind);
  return next;
}

export async function saveCountries(uid: string, currentCountry: string, homeCountry: string) {
  await user(uid);
  const current = countryCodeOf(currentCountry);
  const home = countryCodeOf(homeCountry);
  if (currentCountry && !current) throw new ActionError('BAD_REQUEST', 'Choose a current country.');
  if (homeCountry && !home) throw new ActionError('BAD_REQUEST', 'Choose a home country.');
  const patch: Record<string, string | number> = { updatedAt: Date.now() };
  if (current) patch.currentCountry = current;
  if (home) patch.homeCountry = home;
  await db().doc(`users/${uid}`).set(patch, { merge: true });
  return { currentCountry: current, homeCountry: home };
}
