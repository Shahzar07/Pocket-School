/**
 * Writes the entitlement fields the web and the app both read.
 * Clients cannot write these documents. The audit chain is append-only.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import { applyStripeSubscription } from '../server/actions';
import { notifyUser } from '../server/device-push';
import { claimDecision, eventDocId } from '../payments/idempotency';
import { parentLinkId } from '../parent-controls';
import { TIERS, tierDefinition, type AccessTier } from '../entitlements';
import { seedPricing } from '../pricing';
import { sendMail } from '../mail';
import { buildMyInvois } from '../payments/tax';
import {
  chainHash,
  childAccessCopy,
  courseUnlockUids,
  guardianCanPay,
  manageDestination,
  payerFailedCopy,
  payerRenewalCopy,
  periodEndFrom,
  reminderDue,
  subscriptionDocId,
  type BillingAuditType,
  type BillingSource,
  type EntitlementDecision,
  type EntitlementStatus,
} from './model';

function db() {
  return adminDb();
}

function asTier(value: number | null | undefined): AccessTier {
  const tier = tierDefinition((value ?? 0) as AccessTier);
  return tier.tier;
}

export async function appendBillingAudit(entry: {
  type: BillingAuditType;
  payerUid: string;
  beneficiaryUids: string[];
  subscriptionId: string;
  at: number;
  detail: string;
  source?: BillingSource | string;
  actorUid?: string;
}): Promise<void> {
  const headRef = db().doc('billing_audit_head/current');
  const eventRef = db().collection('billing_audit').doc();
  await db().runTransaction(async (tx) => {
    const head = await tx.get(headRef);
    const prevHash = head.exists ? String(head.data()?.hash ?? '') : '';
    const seq = head.exists ? Number(head.data()?.seq ?? 0) + 1 : 1;
    const payload = {
      seq,
      prevHash,
      type: entry.type,
      payerUid: entry.payerUid,
      beneficiaryUids: entry.beneficiaryUids,
      subscriptionId: entry.subscriptionId,
      at: entry.at,
      detail: entry.detail,
      source: entry.source ?? '',
      actorUid: entry.actorUid ?? entry.payerUid,
    };
    const hash = chainHash(prevHash, payload);
    tx.set(eventRef, { ...payload, hash });
    tx.set(headRef, { seq, hash, at: entry.at });
  });
}

export async function claimBillingEvent(provider: string, eventId: string, now = Date.now()): Promise<'process' | 'skip'> {
  const ref = db().doc(`billing_events/${eventDocId(provider, eventId)}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const existing = data
      ? { status: data.status as 'processing' | 'processed' | 'error', at: Number(data.at ?? 0) }
      : null;
    const decision = claimDecision(existing, now);
    if (decision === 'skip') return 'skip';
    tx.set(ref, { status: 'processing', at: now, provider, eventId });
    return 'process';
  });
}

export async function finishBillingEvent(provider: string, eventId: string, status: 'processed' | 'error'): Promise<void> {
  await db().doc(`billing_events/${eventDocId(provider, eventId)}`).set({ status, at: Date.now() }, { merge: true });
}

async function approvedLink(parentUid: string, childUid: string): Promise<boolean> {
  const snap = await db().doc(`parent_links/${parentLinkId(parentUid, childUid)}`).get();
  return guardianCanPay(snap.data());
}

export async function assertGuardian(parentUid: string, childUids: readonly string[]): Promise<void> {
  for (const childUid of childUids) {
    if (childUid === parentUid) continue;
    if (!(await approvedLink(parentUid, childUid))) {
      throw new Error('A parent can only pay for a child with an approved guardian link.');
    }
  }
}

export async function applyEntitlementDecision(decision: EntitlementDecision, now = Date.now()): Promise<void> {
  const payerUid = decision.payerUid;
  const subscriptionId = subscriptionDocId(payerUid);
  const beneficiaries = decision.beneficiaryUids.filter(Boolean);
  const learners = courseUnlockUids(payerUid, beneficiaries);
  const existing = await db().doc(`subscriptions/${subscriptionId}`).get();
  const previous = existing.data() ?? {};
  const tierId = decision.tierId || (typeof previous.tierId === 'string' ? previous.tierId : '');
  const accessTier = decision.dropAccess
    ? 0
    : decision.accessTier ?? (typeof previous.accessTier === 'number' ? previous.accessTier : null);
  const status: EntitlementStatus = decision.status;
  const currentPeriodEnd = decision.currentPeriodEnd ?? (typeof previous.currentPeriodEnd === 'number' ? previous.currentPeriodEnd : null);
  const cancelAtPeriodEnd = decision.cancelAtPeriodEnd;
  const source = decision.source;

  await db().doc(`subscriptions/${subscriptionId}`).set({
    payerUid,
    beneficiaryUids: beneficiaries,
    tierId: tierId || null,
    accessTier,
    plan: tierId || null,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    source,
    externalId: decision.externalId,
    productId: decision.productId || null,
    updatedAt: now,
  }, { merge: true });

  const shared = {
    payerUid,
    beneficiaryUids: beneficiaries,
    plan: tierId || null,
    tierId: tierId || null,
    accessTier,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    source,
    externalId: decision.externalId,
    updatedAt: now,
  };

  await db().doc(`entitlements/${payerUid}`).set({
    ...shared,
    uid: payerUid,
    sponsoredBy: null,
  }, { merge: true });

  for (const uid of beneficiaries) {
    if (uid === payerUid) continue;
    await db().doc(`entitlements/${uid}`).set({
      ...shared,
      uid,
      accessTier: accessTier ?? 0,
      sponsoredBy: { payerUid, subscriptionId, source },
    }, { merge: true });
  }

  if (decision.dropAccess || accessTier != null) {
    const tier = asTier(decision.dropAccess ? 0 : accessTier);
    for (const uid of learners) {
      await applyStripeSubscription(uid, tier);
    }
  }

  for (const type of decision.audit) {
    await appendBillingAudit({
      type,
      payerUid,
      beneficiaryUids: beneficiaries,
      subscriptionId,
      at: now,
      detail: decision.eventType,
      source,
      actorUid: payerUid,
    });
  }

  if (decision.notify === 'failed') {
    await notifyPaymentProblem({ payerUid, beneficiaryUids: beneficiaries, source });
  }
}

export async function mirrorSelfEntitlement(input: {
  uid: string;
  accessTier: number;
  tierId?: string;
  source: BillingSource;
  externalId: string;
  status?: EntitlementStatus;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  now?: number;
}): Promise<void> {
  const now = input.now ?? Date.now();
  const tier = TIERS.find((row) => row.tier === input.accessTier);
  await applyEntitlementDecision({
    eventId: input.externalId || `self_${input.uid}_${now}`,
    eventType: 'STRIPE',
    payerUid: input.uid,
    beneficiaryUids: [input.uid],
    tierId: input.tierId || tier?.id || null,
    accessTier: input.accessTier,
    status: input.status ?? (input.accessTier > 0 ? 'active' : 'canceled'),
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    source: input.source,
    externalId: input.externalId,
    productId: input.tierId || '',
    dropAccess: input.accessTier <= 0,
    audit: input.accessTier > 0 ? ['purchase'] : ['expired'],
    notify: 'none',
    nextPayerUid: null,
  }, now);
  if (input.stripeCustomerId) {
    await db().doc(`subscriptions/${subscriptionDocId(input.uid)}`).set({ stripeCustomerId: input.stripeCustomerId }, { merge: true });
  }
}

export interface FamilyLineRecord {
  uid: string;
  tierId: string;
  accessTier: number;
  listUsd: number;
  chargeUsd: number;
  off: number;
}

export async function applyFamilyPurchase(input: {
  payerUid: string;
  lines: FamilyLineRecord[];
  source: BillingSource;
  externalId: string;
  currentPeriodEnd: number;
  stripeCustomerId?: string;
  checkoutId?: string;
  currency: string;
  total: number;
  interval: 'month' | 'year';
  now?: number;
}): Promise<void> {
  const now = input.now ?? Date.now();
  const beneficiaries = input.lines.map((line) => line.uid);
  const subscriptionId = subscriptionDocId(input.payerUid);
  const learners = courseUnlockUids(input.payerUid, beneficiaries);
  await db().doc(`subscriptions/${subscriptionId}`).set({
    payerUid: input.payerUid,
    beneficiaryUids: beneficiaries,
    lines: input.lines,
    status: 'active',
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    source: input.source,
    externalId: input.externalId,
    stripeCustomerId: input.stripeCustomerId ?? null,
    checkoutId: input.checkoutId ?? null,
    currency: input.currency,
    monthlyRecurring: input.interval === 'year' ? Math.round((input.total / 12) * 100) / 100 : input.total,
    interval: input.interval,
    plan: 'family',
    tierId: 'family',
    updatedAt: now,
  }, { merge: true });

  await db().doc(`entitlements/${input.payerUid}`).set({
    uid: input.payerUid,
    payerUid: input.payerUid,
    beneficiaryUids: beneficiaries,
    plan: 'family',
    status: 'active',
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: false,
    source: input.source,
    externalId: input.externalId,
    sponsoredBy: null,
    updatedAt: now,
  }, { merge: true });

  for (const line of input.lines) {
    await db().doc(`entitlements/${line.uid}`).set({
      uid: line.uid,
      payerUid: input.payerUid,
      beneficiaryUids: beneficiaries,
      plan: line.tierId,
      tierId: line.tierId,
      accessTier: line.accessTier,
      status: 'active',
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      source: input.source,
      externalId: input.externalId,
      sponsoredBy: line.uid === input.payerUid ? null : { payerUid: input.payerUid, subscriptionId, source: input.source },
      updatedAt: now,
    }, { merge: true });
    if (learners.includes(line.uid)) await applyStripeSubscription(line.uid, asTier(line.accessTier));
  }

  await appendBillingAudit({
    type: 'purchase',
    payerUid: input.payerUid,
    beneficiaryUids: beneficiaries,
    subscriptionId,
    at: now,
    detail: input.checkoutId || input.externalId,
    source: input.source,
  });
}

export async function refreshFamilyPeriod(input: {
  payerUid: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd?: boolean;
  status?: EntitlementStatus;
  externalId?: string;
  stripeCustomerId?: string;
  audit: BillingAuditType;
  now?: number;
}): Promise<void> {
  const now = input.now ?? Date.now();
  const subscriptionId = subscriptionDocId(input.payerUid);
  const snap = await db().doc(`subscriptions/${subscriptionId}`).get();
  const data = snap.data() ?? {};
  const beneficiaries = Array.isArray(data.beneficiaryUids) ? data.beneficiaryUids.filter((id: unknown): id is string => typeof id === 'string') : [input.payerUid];
  const status = input.status ?? 'active';
  const patch = {
    status,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    externalId: input.externalId ?? data.externalId ?? null,
    stripeCustomerId: input.stripeCustomerId ?? data.stripeCustomerId ?? null,
    updatedAt: now,
  };
  await db().doc(`subscriptions/${subscriptionId}`).set(patch, { merge: true });
  const people = [...new Set([input.payerUid, ...beneficiaries])];
  for (const uid of people) {
    await db().doc(`entitlements/${uid}`).set({ ...patch, status }, { merge: true });
  }
  if (status === 'expired' || status === 'canceled') {
    const lines = Array.isArray(data.lines) ? data.lines : [];
    const learners = lines.length
      ? courseUnlockUids(input.payerUid, beneficiaries)
      : courseUnlockUids(input.payerUid, beneficiaries);
    for (const uid of learners) await applyStripeSubscription(uid, 0);
  }
  await appendBillingAudit({
    type: input.audit,
    payerUid: input.payerUid,
    beneficiaryUids: beneficiaries,
    subscriptionId,
    at: now,
    detail: input.externalId || status,
    source: typeof data.source === 'string' ? data.source : 'stripe',
  });
}

export async function notifyPaymentProblem(input: {
  payerUid: string;
  beneficiaryUids: string[];
  source: BillingSource | string;
}): Promise<void> {
  const destination = manageDestination(input.source, '/dashboard/parent/billing');
  const payer = payerFailedCopy();
  await notifyUser({
    userId: input.payerUid,
    title: payer.title,
    message: payer.message,
    type: 'general',
    pref: 'general',
    link: destination.url,
  });
  await emailUser(input.payerUid, payer.title, `${payer.message} ${destination.url}`);
  const child = childAccessCopy();
  for (const uid of input.beneficiaryUids) {
    if (uid === input.payerUid) continue;
    await notifyUser({
      userId: uid,
      title: child.title,
      message: child.message,
      type: 'general',
      pref: 'general',
      link: '/dashboard/student',
    });
  }
}

async function emailUser(uid: string, subject: string, text: string): Promise<void> {
  const snap = await db().doc(`users/${uid}`).get();
  const email = snap.data()?.email;
  if (typeof email !== 'string') return;
  await sendMail({ to: email, subject, text });
}

export async function runRenewalReminders(now: number): Promise<{ checked: number; reminded: number }> {
  const snap = await db().collection('subscriptions').where('status', 'in', ['active', 'grace', 'past_due']).limit(400).get();
  let reminded = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const currentPeriodEnd = typeof data.currentPeriodEnd === 'number' ? data.currentPeriodEnd : null;
    const reminderSentFor = typeof data.reminderSentFor === 'number' ? data.reminderSentFor : null;
    const status = typeof data.status === 'string' ? data.status : '';
    if (!reminderDue({ currentPeriodEnd, now, reminderSentFor, status })) continue;
    const payerUid = typeof data.payerUid === 'string' ? data.payerUid : doc.id.replace(/^sub_/, '');
    const beneficiaries = Array.isArray(data.beneficiaryUids)
      ? data.beneficiaryUids.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    const source = typeof data.source === 'string' ? data.source : 'stripe';
    const renewsOn = new Date(currentPeriodEnd ?? now).toISOString().slice(0, 10);
    const copy = payerRenewalCopy(renewsOn);
    const destination = manageDestination(source, '/dashboard/parent/billing');
    await notifyUser({
      userId: payerUid,
      title: copy.title,
      message: copy.message,
      type: 'general',
      pref: 'general',
      link: destination.url,
    });
    await emailUser(payerUid, copy.title, copy.message);
    const child = childAccessCopy();
    for (const uid of beneficiaries) {
      if (uid === payerUid) continue;
      await notifyUser({
        userId: uid,
        title: child.title,
        message: child.message,
        type: 'general',
        pref: 'general',
        link: '/dashboard/student',
      });
    }
    await doc.ref.set({ reminderSentFor: currentPeriodEnd }, { merge: true });
    await appendBillingAudit({
      type: 'renewal',
      payerUid,
      beneficiaryUids: beneficiaries,
      subscriptionId: doc.id,
      at: now,
      detail: `reminder:${renewsOn}`,
      source,
    });
    reminded += 1;
  }
  return { checked: snap.size, reminded };
}

export async function loadPlanPrice(tierId: string, interval: 'month' | 'year'): Promise<{ listUsd: number; accessTier: number } | null> {
  const tier = TIERS.find((row) => row.id === tierId);
  if (!tier || tier.tier >= 5 || tier.tier <= 0) return null;
  let monthly = 0;
  let annual = 0;
  const stored = await db().doc('pricing_config/current').get();
  const plans = stored.exists && Array.isArray(stored.data()?.plans) ? stored.data()?.plans as { id?: string; monthlyUsd?: number; annualUsd?: number }[] : null;
  const row = (plans ?? seedPricing().plans).find((item) => item.id === tierId);
  monthly = Number(row?.monthlyUsd ?? 0);
  annual = Number(row?.annualUsd ?? 0);
  const listUsd = interval === 'year' ? annual : monthly;
  if (!Number.isFinite(listUsd) || listUsd <= 0) return null;
  return { listUsd, accessTier: tier.tier };
}

export async function seatCoverage(childUid: string): Promise<{ seatActive: boolean; seatTier: number }> {
  const user = await db().doc(`users/${childUid}`).get();
  const data = user.data() ?? {};
  const institutionId = typeof data.institutionId === 'string' ? data.institutionId : '';
  const path = data.enrolPath === 'institution' || data.membership === 'institution';
  if (!institutionId || !path) return { seatActive: false, seatTier: 0 };
  const school = await db().doc(`institutions/${institutionId}`).get();
  const phase = school.data()?.billingPhase;
  const active = phase === 'active' || phase === 'grace';
  const planId = typeof data.institutionPlan === 'string'
    ? data.institutionPlan
    : typeof school.data()?.planId === 'string' ? school.data()?.planId as string : '';
  const tier = TIERS.find((row) => row.id === planId);
  return { seatActive: active, seatTier: tier?.tier ?? (active ? 1 : 0) };
}

export async function setSpendingCap(payerUid: string, capUsd: number | null, now = Date.now()): Promise<void> {
  const subscriptionId = subscriptionDocId(payerUid);
  await db().doc(`subscriptions/${subscriptionId}`).set({
    payerUid,
    spendingCapUsd: capUsd,
    updatedAt: now,
  }, { merge: true });
  const snap = await db().doc(`subscriptions/${subscriptionId}`).get();
  const beneficiaries = Array.isArray(snap.data()?.beneficiaryUids) ? snap.data()?.beneficiaryUids as string[] : [];
  await appendBillingAudit({
    type: 'cap',
    payerUid,
    beneficiaryUids: beneficiaries,
    subscriptionId,
    at: now,
    detail: capUsd == null ? 'cap cleared' : `cap ${capUsd}`,
    actorUid: payerUid,
  });
}

export async function transferSponsorship(input: {
  payerUid: string;
  childUid: string;
  nextPayerUid: string;
  now?: number;
}): Promise<void> {
  const now = input.now ?? Date.now();
  if (!(await approvedLink(input.payerUid, input.childUid))) throw new Error('The current payer is not an approved guardian.');
  if (input.nextPayerUid !== input.childUid && !(await approvedLink(input.nextPayerUid, input.childUid))) {
    throw new Error('Sponsorship can only move to another approved guardian.');
  }
  const fromId = subscriptionDocId(input.payerUid);
  const from = await db().doc(`subscriptions/${fromId}`).get();
  const data = from.data() ?? {};
  const beneficiaries = Array.isArray(data.beneficiaryUids) ? data.beneficiaryUids.filter((id: unknown): id is string => typeof id === 'string') : [];
  if (!beneficiaries.includes(input.childUid) && data.payerUid) {
    throw new Error('That child is not on this subscription.');
  }
  const remaining = beneficiaries.filter((id) => id !== input.childUid);
  const lines = Array.isArray(data.lines) ? data.lines.filter((line: { uid?: string }) => line.uid !== input.childUid) : [];
  const movedLine = Array.isArray(data.lines) ? data.lines.find((line: { uid?: string }) => line.uid === input.childUid) : null;
  await db().doc(`subscriptions/${fromId}`).set({ beneficiaryUids: remaining, lines, updatedAt: now }, { merge: true });
  const toId = subscriptionDocId(input.nextPayerUid);
  const source = (typeof data.source === 'string' ? data.source : 'stripe') as BillingSource;
  await db().doc(`subscriptions/${toId}`).set({
    payerUid: input.nextPayerUid,
    beneficiaryUids: FieldValue.arrayUnion(input.childUid),
    status: data.status ?? 'active',
    currentPeriodEnd: data.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: false,
    source,
    externalId: data.externalId ?? null,
    plan: movedLine?.tierId ?? data.plan ?? null,
    updatedAt: now,
  }, { merge: true });
  await db().doc(`entitlements/${input.childUid}`).set({
    payerUid: input.nextPayerUid,
    sponsoredBy: { payerUid: input.nextPayerUid, subscriptionId: toId, source },
    status: data.status ?? 'active',
    currentPeriodEnd: data.currentPeriodEnd ?? null,
    updatedAt: now,
  }, { merge: true });
  await appendBillingAudit({
    type: 'transfer',
    payerUid: input.nextPayerUid,
    beneficiaryUids: [input.childUid],
    subscriptionId: toId,
    at: now,
    detail: `from ${input.payerUid}`,
    source,
    actorUid: input.payerUid,
  });
}

export async function createAsk(input: {
  childUid: string;
  parentUid: string;
  kind: 'course' | 'plan';
  tierId?: string;
  courseId?: string;
  note?: string;
  now?: number;
}): Promise<string> {
  const now = input.now ?? Date.now();
  if (!(await approvedLink(input.parentUid, input.childUid))) throw new Error('Ask a parent who is already an approved guardian.');
  const ref = db().collection('purchase_requests').doc();
  await ref.set({
    childId: input.childUid,
    parentId: input.parentUid,
    studentId: input.childUid,
    kind: input.kind,
    tierId: input.tierId ?? null,
    courseId: input.courseId ?? null,
    note: (input.note ?? '').slice(0, 280),
    status: 'pending',
    createdAt: now,
  });
  await notifyUser({
    userId: input.parentUid,
    title: 'A child asked for a plan',
    message: input.kind === 'course'
      ? 'Your child asked you to pay for a course. You can approve and pay, or decline. They cannot enter payment details.'
      : 'Your child asked you to pay for a plan. You can approve and pay, or decline. They cannot enter payment details.',
    type: 'general',
    pref: 'general',
    link: '/dashboard/parent/billing',
  });
  await appendBillingAudit({
    type: 'ask',
    payerUid: input.parentUid,
    beneficiaryUids: [input.childUid],
    subscriptionId: subscriptionDocId(input.parentUid),
    at: now,
    detail: input.kind === 'course' ? `course ${input.courseId ?? ''}` : `plan ${input.tierId ?? ''}`,
    actorUid: input.childUid,
  });
  return ref.id;
}

export async function respondAsk(input: {
  parentUid: string;
  requestId: string;
  decision: 'approved' | 'rejected';
  now?: number;
}): Promise<{ kind: string; tierId: string; courseId: string; childUid: string }> {
  const now = input.now ?? Date.now();
  const ref = db().doc(`purchase_requests/${input.requestId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('That request was not found.');
  const data = snap.data() ?? {};
  if (data.parentId !== input.parentUid) throw new Error('Only the linked parent can answer this request.');
  if (data.status !== 'pending') throw new Error('That request is already answered.');
  await ref.set({ status: input.decision === 'approved' ? 'approved' : 'rejected', decidedAt: now }, { merge: true });
  const childUid = typeof data.childId === 'string' ? data.childId : typeof data.studentId === 'string' ? data.studentId : '';
  if (input.decision === 'rejected') {
    await notifyUser({
      userId: childUid,
      title: 'Request declined',
      message: 'Your parent declined the request. No payment details were shared.',
      type: 'general',
      pref: 'general',
      link: '/dashboard/student',
    });
    await appendBillingAudit({
      type: 'decline',
      payerUid: input.parentUid,
      beneficiaryUids: [childUid],
      subscriptionId: subscriptionDocId(input.parentUid),
      at: now,
      detail: input.requestId,
      actorUid: input.parentUid,
    });
  }
  return {
    kind: typeof data.kind === 'string' ? data.kind : 'plan',
    tierId: typeof data.tierId === 'string' ? data.tierId : '',
    courseId: typeof data.courseId === 'string' ? data.courseId : '',
    childUid,
  };
}

export function familyInvoiceFields(input: {
  currency: string;
  description: string;
  taxExclusive: number;
  tax: number;
  buyerName: string;
  buyerEmail: string | null;
}) {
  return buildMyInvois({
    currency: input.currency,
    description: input.description,
    taxExclusive: input.taxExclusive,
    tax: input.tax,
    buyer: { name: input.buyerName, email: input.buyerEmail, tin: null },
  });
}

export async function readFamily(payerUid: string): Promise<{
  subscription: Record<string, unknown> | null;
  children: Record<string, unknown>[];
  requests: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  placeholderDiscount: true;
}> {
  const sub = await db().doc(`subscriptions/${subscriptionDocId(payerUid)}`).get();
  const data = sub.exists ? sub.data() ?? {} : null;
  const beneficiaries = data && Array.isArray(data.beneficiaryUids)
    ? data.beneficiaryUids.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const children = [];
  for (const uid of beneficiaries) {
    const ent = await db().doc(`entitlements/${uid}`).get();
    const user = await db().doc(`users/${uid}`).get();
    const row = ent.data() ?? {};
    children.push({
      uid,
      name: typeof user.data()?.name === 'string' ? user.data()?.name : 'Learner',
      plan: row.plan ?? row.tierId ?? null,
      status: row.status ?? null,
      currentPeriodEnd: row.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
      source: row.source ?? null,
      sponsoredBy: row.sponsoredBy ?? null,
    });
  }
  const requestsSnap = await db().collection('purchase_requests').where('parentId', '==', payerUid).limit(40).get();
  const requests = requestsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const invoices = [];
  const ids = [payerUid, ...beneficiaries].slice(0, 10);
  if (ids.length) {
    const invoiceSnap = await db().collection('invoices').where('studentId', 'in', ids).limit(40).get();
    for (const doc of invoiceSnap.docs) {
      const row = doc.data();
      invoices.push({
        id: doc.id,
        description: row.description ?? '',
        amount: row.amount ?? 0,
        currency: row.currency ?? 'USD',
        status: row.status ?? '',
        receiptNumber: row.receiptNumber ?? null,
        myInvois: row.myInvois ?? null,
        studentId: row.studentId ?? '',
      });
    }
  }
  return {
    subscription: data ? {
      id: sub.id,
      payerUid: data.payerUid ?? payerUid,
      beneficiaryUids: beneficiaries,
      status: data.status ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
      source: data.source ?? null,
      spendingCapUsd: data.spendingCapUsd ?? null,
      lines: data.lines ?? [],
      externalId: data.externalId ?? null,
    } : null,
    children,
    requests,
    invoices,
    placeholderDiscount: true,
  };
}

export async function payerSource(uid: string): Promise<{ source: string; stripeCustomerId: string; email: string }> {
  const sub = await db().doc(`subscriptions/${subscriptionDocId(uid)}`).get();
  const user = await db().doc(`users/${uid}`).get();
  return {
    source: typeof sub.data()?.source === 'string' ? sub.data()?.source as string : 'stripe',
    stripeCustomerId: typeof sub.data()?.stripeCustomerId === 'string' ? sub.data()?.stripeCustomerId as string : '',
    email: typeof user.data()?.email === 'string' ? user.data()?.email as string : '',
  };
}

export async function saveStripeCustomer(uid: string, customerId: string): Promise<void> {
  await db().doc(`subscriptions/${subscriptionDocId(uid)}`).set({ payerUid: uid, stripeCustomerId: customerId, source: 'stripe' }, { merge: true });
}

export { periodEndFrom };
