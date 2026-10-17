/**
 * Server writer for community partner applications.
 * A missing admin SDK or mail key does not throw. Applying never verifies anyone.
 */

import { randomBytes } from 'node:crypto';
import { type Firestore } from 'firebase-admin/firestore';
import { adminDb, isAdminConfigured } from '../firebase-admin';
import { DESK_CONTACT, SAFETY_FROM } from '../bullying/school-notice';
import { approvalRoute, cleanPartnerApplication, type PartnerApplicationInput } from '../community/partners';
import { currentMailAdapter, sendWithBackoff } from '../mail';
import { ActionError } from './actions';

function db(): Firestore {
  return adminDb();
}

export const COMING_SOON = 'Partner applications are coming soon.';

export async function submitPartnerApplication(input: Partial<PartnerApplicationInput>) {
  const cleaned = cleanPartnerApplication(input);
  if (!cleaned.ok) throw new ActionError('BAD_REQUEST', cleaned.error);
  if (cleaned.value.companyFax) return { ok: true as const, id: '', stored: false };
  if (!isAdminConfigured()) return { ok: false as const, comingSoon: true as const, message: COMING_SOON };
  const now = Date.now();
  const id = randomBytes(12).toString('hex');
  const value = cleaned.value;
  await db().doc(`communityPartnerApplications/${id}`).set({
    orgName: value.orgName,
    type: value.type,
    country: value.country,
    region: value.region,
    contactName: value.contactName,
    email: value.email,
    phone: value.phone,
    website: value.website,
    message: value.message,
    status: 'pending',
    route: '',
    createdAt: now,
    reviewedAt: 0,
    reviewedBy: '',
  });
  const mailed = await notifyReviewQueue(id, value).catch(() => false);
  return { ok: true as const, id, stored: true, mailed };
}

export async function reviewPartnerApplication(actorUid: string, id: string, decision: 'approved' | 'declined') {
  if (!isAdminConfigured()) throw new ActionError('BAD_REQUEST', COMING_SOON);
  if (!/^[a-f0-9]{24}$/.test(id)) throw new ActionError('BAD_REQUEST', 'That application is not available.');
  const ref = db().doc(`communityPartnerApplications/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'That application is not available.');
  const data = snap.data() ?? {};
  const type = typeof data.type === 'string' ? data.type : '';
  const route = decision === 'approved' ? approvalRoute(type) : null;
  if (decision === 'approved' && !route) throw new ActionError('BAD_REQUEST', 'Choose a partner type before approving.');
  const now = Date.now();
  await ref.set({
    status: decision,
    route: route?.route ?? '',
    nextPath: route?.nextPath ?? '',
    reviewedAt: now,
    reviewedBy: actorUid,
  }, { merge: true });
  return {
    ok: true as const,
    status: decision,
    route: route?.route ?? '',
    nextPath: route?.nextPath ?? '',
    granted: false as const,
  };
}

async function notifyReviewQueue(id: string, value: PartnerApplicationInput): Promise<boolean> {
  const to = process.env.SAFETY_ADMIN_EMAIL?.trim() || DESK_CONTACT;
  const text = [
    'A community partner asked to get involved. Nothing was granted.',
    `Organisation: ${value.orgName}`,
    `Type: ${value.type}`,
    `Country: ${value.country}`,
    `Region: ${value.region || 'Not stated'}`,
    `Contact: ${value.contactName}`,
    `Email: ${value.email}`,
    `Phone: ${value.phone || 'Not stated'}`,
    `Website: ${value.website || 'Not stated'}`,
    `Message: ${value.message || 'Not stated'}`,
    `Application: ${id}`,
    `From: ${SAFETY_FROM}`,
  ].join('\n');
  const sent = await sendWithBackoff(() => currentMailAdapter().send({
    to,
    from: SAFETY_FROM,
    subject: `Community partner application: ${value.orgName}`,
    text,
    html: text.split('\n').map(line => `<p>${line.replace(/</g, '')}</p>`).join(''),
  }));
  return sent.ok;
}
