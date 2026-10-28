/**
 * Versioned community safety terms. The server writes the document.
 * Clients may read it and cannot write it. Each acknowledgement is one audit entry.
 */

import { type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  COMPANY_LEGAL_NAME,
  FULL_CLAUSES,
  PENDING_LEGAL_REVIEW,
  SAFETY_TERMS_STATUS,
  SAFETY_TERMS_TITLE,
  SAFETY_TERMS_VERSION,
  NO_LEGAL_DUTY,
  NO_LEGAL_DUTY_LOCALES_PENDING,
  SHORT_BODY,
  SHORT_HEADLINE,
  UNDER_13_DISCLAIMER,
  ackMatchesVersion,
} from '../safety/disclaimer';
import { GENESIS, emptyLegalHold, type ChainDevice } from '../ledger/chain';
import { SERVER_DEVICE } from '../ledger/device';
import { emergencyNumber } from '../emergency/policy';
import { ActionError } from './actions';
import { appendChain } from './ledger';

function db(): Firestore {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function safetyTermsPath(version = SAFETY_TERMS_VERSION): string {
  return `legal/safetyTerms/versions/${version}`;
}

export async function ensureCurrentTerms() {
  const ref = db().doc(safetyTermsPath());
  const snap = await ref.get();
  const now = Date.now();
  const body = {
    version: SAFETY_TERMS_VERSION,
    title: SAFETY_TERMS_TITLE,
    status: 'draft' as const,
    pendingLegalReview: true,
    marker: PENDING_LEGAL_REVIEW,
    statusLine: SAFETY_TERMS_STATUS,
    companyLegalName: COMPANY_LEGAL_NAME,
    under13: UNDER_13_DISCLAIMER,
    shortHeadline: SHORT_HEADLINE,
    shortBody: SHORT_BODY,
    noLegalDuty: NO_LEGAL_DUTY,
    noLegalDutyLocalesPending: [...NO_LEGAL_DUTY_LOCALES_PENDING],
    clauses: [...FULL_CLAUSES],
    updatedAt: now,
  };
  if (!snap.exists) {
    await ref.set({
      ...body,
      chainSeq: 0,
      chainHead: GENESIS,
      legalHold: emptyLegalHold(),
      createdAt: now,
    });
    return;
  }
  await ref.set(body, { merge: true });
}

export async function safetyTermsStatus(uid: string) {
  const snap = await db().doc(`users/${uid}`).get();
  const data = snap.data() ?? {};
  const version = str(data.safetyTermsAckVersion);
  const ageTier = str(data.ageTier);
  const country = str(data.country) || str(data.homeCountry) || 'Malaysia';
  return {
    version: SAFETY_TERMS_VERSION,
    ackedVersion: version,
    needsAck: !ackMatchesVersion(version),
    under13: ageTier === 'under13' || ageTier === '',
    emergencyNumber: emergencyNumber(country),
    pendingLegalReview: true,
    marker: PENDING_LEGAL_REVIEW,
  };
}

export async function acknowledgeSafetyTerms(uid: string, device: ChainDevice = SERVER_DEVICE) {
  const userRef = db().doc(`users/${uid}`);
  const user = await userRef.get();
  if (!user.exists) throw new ActionError('NOT_FOUND', 'Account not found.');
  const current = str(user.data()?.safetyTermsAckVersion);
  if (ackMatchesVersion(current)) return { ok: true as const, version: SAFETY_TERMS_VERSION };
  await ensureCurrentTerms();
  const now = Date.now();
  await appendChain({
    parentPath: safetyTermsPath(),
    collection: 'audit',
    actorUid: uid,
    actorRole: str(user.data()?.role) || 'student',
    action: 'safety_terms_ack',
    diff: {
      before: { version: current },
      after: { version: SAFETY_TERMS_VERSION, uid, timestamp: now },
    },
    extra: { uid, version: SAFETY_TERMS_VERSION, timestamp: now },
    device,
  });
  await userRef.set({
    safetyTermsAckVersion: SAFETY_TERMS_VERSION,
    safetyTermsAckAt: now,
    updatedAt: now,
  }, { merge: true });
  return { ok: true as const, version: SAFETY_TERMS_VERSION, at: now };
}

export async function requireSafetyTerms(uid: string) {
  const snap = await db().doc(`users/${uid}`).get();
  if (!ackMatchesVersion(str(snap.data()?.safetyTermsAckVersion))) {
    throw new ActionError('BAD_REQUEST', 'Read the safety terms and tap I understand. An emergency call does not wait for this.');
  }
}
