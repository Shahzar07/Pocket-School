/**
 * Applies the billing lifecycle to Firestore. The decisions live in
 * lib/institution-membership.ts. This file is imported from route handlers.
 */

import { adminDb } from '../firebase-admin';
import {
  advanceSubscription,
  failRenewal,
  institutionEmail,
  openSubscription,
  quoteForInstitution,
  recordPayment,
  type BillingNotice,
  type SubscriptionState,
} from '../institution-membership';
import type { VolumeInterval, VolumePlanId } from '../institution-pricing';

function todayIso(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function asState(data: Record<string, unknown> | undefined, fallback: SubscriptionState): SubscriptionState {
  if (!data) return fallback;
  const phase = data.phase === 'active' || data.phase === 'grace' || data.phase === 'suspended' || data.phase === 'pending_payment'
    ? data.phase
    : fallback.phase;
  return {
    subject: data.subject === 'individual' ? 'individual' : fallback.subject,
    phase,
    planId: data.planId === 'primary_secondary' || data.planId === 'igcse_alevel' || data.planId === 'professional' ? data.planId : fallback.planId,
    interval: data.interval === 'monthly' ? 'monthly' : 'annual',
    seats: typeof data.seats === 'number' ? data.seats : fallback.seats,
    currency: typeof data.currency === 'string' ? data.currency : fallback.currency,
    total: typeof data.total === 'number' ? data.total : fallback.total,
    periodEnd: typeof data.periodEnd === 'string' ? data.periodEnd : '',
    failedOn: typeof data.failedOn === 'string' ? data.failedOn : '',
    graceEndsOn: typeof data.graceEndsOn === 'string' ? data.graceEndsOn : '',
    suspendedOn: typeof data.suspendedOn === 'string' ? data.suspendedOn : '',
    remindersSent: Array.isArray(data.remindersSent) ? data.remindersSent.filter((item): item is string => typeof item === 'string') : [],
    payerEmail: typeof data.payerEmail === 'string' ? data.payerEmail : fallback.payerEmail,
  };
}

async function writeNotices(institutionId: string, notices: readonly BillingNotice[], name: string): Promise<void> {
  const db = adminDb();
  for (const notice of notices) {
    const mail = institutionEmail(
      notice.kind === 'payment_link' ? 'payment_link'
        : notice.kind === 'dunning' ? 'dunning'
          : notice.kind === 'suspend' ? 'suspended'
            : notice.kind === 'restore' ? 'restored'
              : 'invoice',
      { institutionName: name },
    );
    await db.collection('institutions').doc(institutionId).collection('notifications').add({
      kind: notice.kind,
      title: mail.subject,
      body: mail.text,
      audience: 'admins',
      at: notice.on,
    });
  }
}

export async function openInstitutionBill(input: {
  institutionId: string;
  institutionName: string;
  planId: VolumePlanId;
  interval: VolumeInterval;
  seats: number;
  payerEmail: string;
}): Promise<{ state: SubscriptionState; notices: BillingNotice[]; total: number; currency: string }> {
  const quote = quoteForInstitution({ seats: input.seats, planId: input.planId, interval: input.interval });
  const opened = openSubscription({
    subject: 'institution',
    planId: input.planId,
    interval: input.interval,
    seats: input.seats,
    currency: quote.currency,
    total: quote.total,
    payerEmail: input.payerEmail,
    on: todayIso(),
  });
  await adminDb().doc(`institutions/${input.institutionId}/billing/current`).set(opened.state);
  await adminDb().doc(`institutions/${input.institutionId}`).set({
    billingPhase: opened.state.phase,
  }, { merge: true });
  await writeNotices(input.institutionId, opened.notices, input.institutionName);
  return { ...opened, total: quote.total, currency: quote.currency };
}

export async function markInstitutionPaid(institutionId: string, interval: VolumeInterval, paidOn = todayIso()): Promise<BillingNotice[]> {
  const ref = adminDb().doc(`institutions/${institutionId}/billing/current`);
  const snap = await ref.get();
  const current = asState(snap.data() as Record<string, unknown> | undefined, openSubscription({
    subject: 'institution', planId: 'igcse_alevel', interval, seats: 0, currency: 'USD', total: 0, payerEmail: '', on: paidOn,
  }).state);
  const next = recordPayment({ ...current, interval }, paidOn, interval);
  await ref.set(next.state);
  await adminDb().doc(`institutions/${institutionId}`).set({ billingPhase: next.state.phase, status: 'active' }, { merge: true });
  const name = String((await adminDb().doc(`institutions/${institutionId}`).get()).data()?.name ?? 'Your institution');
  await writeNotices(institutionId, next.notices, name);
  return next.notices;
}

export async function markInstitutionFailed(institutionId: string, on = todayIso()): Promise<BillingNotice[]> {
  const ref = adminDb().doc(`institutions/${institutionId}/billing/current`);
  const snap = await ref.get();
  if (!snap.exists) return [];
  const current = asState(snap.data() as Record<string, unknown>, openSubscription({
    subject: 'institution', planId: 'igcse_alevel', interval: 'annual', seats: 0, currency: 'USD', total: 0, payerEmail: '', on,
  }).state);
  const next = current.phase === 'grace' ? advanceSubscription(current, on) : failRenewal(current, on);
  await ref.set(next.state);
  const patch: { billingPhase: string; status?: string } = { billingPhase: next.state.phase };
  if (next.state.phase === 'suspended') patch.status = 'suspended';
  await adminDb().doc(`institutions/${institutionId}`).set(patch, { merge: true });
  const name = String((await adminDb().doc(`institutions/${institutionId}`).get()).data()?.name ?? 'Your institution');
  await writeNotices(institutionId, next.notices, name);
  return next.notices;
}

export async function markIndividualPaid(uid: string, planId: string, interval: VolumeInterval, paidOn = todayIso()): Promise<void> {
  const known: VolumePlanId = planId === 'primary_secondary' || planId === 'professional' ? planId : 'igcse_alevel';
  const ref = adminDb().doc(`subscriber_billing/${uid}`);
  const snap = await ref.get();
  const current = asState(snap.data() as Record<string, unknown> | undefined, openSubscription({
    subject: 'individual', planId: known, interval, seats: 1, currency: 'USD', total: 0, payerEmail: '', on: paidOn,
  }).state);
  const next = recordPayment({ ...current, subject: 'individual', planId: known, seats: 1 }, paidOn, interval);
  await ref.set({ ...next.state, subject: 'individual', product: planId === 'teacher' ? 'teacher_plan' : 'plan' });
}

export async function markIndividualFailed(uid: string, on = todayIso()): Promise<void> {
  const ref = adminDb().doc(`subscriber_billing/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const current = asState(snap.data() as Record<string, unknown>, openSubscription({
    subject: 'individual', planId: 'igcse_alevel', interval: 'monthly', seats: 1, currency: 'USD', total: 0, payerEmail: '', on,
  }).state);
  const next = current.phase === 'grace' ? advanceSubscription(current, on) : failRenewal(current, on);
  await ref.set({ ...next.state, subject: 'individual' });
}

export async function advanceOpenBills(on = todayIso()): Promise<{ institutions: number; individuals: number }> {
  const db = adminDb();
  const academies = await db.collection('institutions').limit(200).get();
  let institutions = 0;
  for (const academy of academies.docs) {
    const billing = await academy.ref.collection('billing').doc('current').get();
    if (!billing.exists) continue;
    const state = asState(billing.data() as Record<string, unknown>, openSubscription({
      subject: 'institution', planId: 'igcse_alevel', interval: 'annual', seats: 0, currency: 'USD', total: 0, payerEmail: '', on,
    }).state);
    const due = state.phase === 'active' && state.periodEnd && on > state.periodEnd;
    if (!due && state.phase !== 'grace') continue;
    const next = due ? failRenewal(state, on) : advanceSubscription(state, on);
    if (next.state.phase === state.phase && next.notices.length === 0 && next.state.remindersSent.length === state.remindersSent.length) continue;
    await billing.ref.set(next.state);
    const patch: { billingPhase: string; status?: string } = { billingPhase: next.state.phase };
    if (next.state.phase === 'suspended') patch.status = 'suspended';
    if (next.state.phase === 'active') patch.status = 'active';
    await academy.ref.set(patch, { merge: true });
    await writeNotices(academy.id, next.notices, String(academy.data().name ?? 'Your institution'));
    institutions += 1;
  }
  const people = await db.collection('subscriber_billing').limit(200).get();
  let individuals = 0;
  for (const person of people.docs) {
    const state = asState(person.data() as Record<string, unknown>, openSubscription({
      subject: 'individual', planId: 'igcse_alevel', interval: 'monthly', seats: 1, currency: 'USD', total: 0, payerEmail: '', on,
    }).state);
    const due = state.phase === 'active' && state.periodEnd && on > state.periodEnd;
    if (!due && state.phase !== 'grace') continue;
    const next = due ? failRenewal(state, on) : advanceSubscription(state, on);
    await person.ref.set({ ...next.state, subject: 'individual' });
    individuals += 1;
  }
  return { institutions, individuals };
}
