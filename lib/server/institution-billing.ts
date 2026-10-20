/**
 * Applies the billing lifecycle to Firestore. The decisions live in
 * lib/institution-membership.ts. This file is imported from route handlers.
 */

import { adminDb } from '../firebase-admin';
import { finishAdminTask, rememberAdminTask } from './admin-tasks';
import {
  asVolumePlanId,
  billingMoved,
  blankSubscription,
  cycleSubscription,
  institutionEmail,
  onPaymentFailed,
  openSubscription,
  readSubscription,
  recordPayment,
  type BillingNotice,
  type SubscriptionState,
} from '../institution-membership';
import type { VolumeInterval, VolumePlanId } from '../institution-pricing';
import { scheduledCancellation } from '../institution-self-serve';
import { institutionReadsBill } from '../platform/licence';
import { reviewInstitutionTier } from './institution-tier';

function todayIso(date = new Date()): string {
  return date.toISOString().slice(0, 10);
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
}): Promise<{ state: SubscriptionState; notices: BillingNotice[]; total: number; currency: string; addonTotal: number }> {
  const quote = institutionReadsBill({ seats: input.seats, planId: input.planId, interval: input.interval });
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
  return { ...opened, total: quote.total, currency: quote.currency, addonTotal: quote.reads.addonTotal };
}

export async function markInstitutionPaid(institutionId: string, interval: VolumeInterval, paidOn = todayIso()): Promise<BillingNotice[]> {
  const ref = adminDb().doc(`institutions/${institutionId}/billing/current`);
  const snap = await ref.get();
  const current = readSubscription(snap.data() as Record<string, unknown> | undefined, blankSubscription('institution', paidOn));
  const next = recordPayment({ ...current, interval }, paidOn, interval);
  await ref.set(next.state);
  await adminDb().doc(`institutions/${institutionId}`).set({ billingPhase: next.state.phase, status: 'active' }, { merge: true });
  await finishAdminTask(`institutions/${institutionId}/billing/current`, 'system', 'done');
  const name = String((await adminDb().doc(`institutions/${institutionId}`).get()).data()?.name ?? 'Your institution');
  await writeNotices(institutionId, next.notices, name);
  return next.notices;
}

export async function markInstitutionFailed(institutionId: string, on = todayIso()): Promise<BillingNotice[]> {
  const ref = adminDb().doc(`institutions/${institutionId}/billing/current`);
  const snap = await ref.get();
  if (!snap.exists) return [];
  const current = readSubscription(snap.data() as Record<string, unknown>, blankSubscription('institution', on));
  const next = onPaymentFailed(current, on);
  await ref.set(next.state);
  const patch: { billingPhase: string; status?: string } = { billingPhase: next.state.phase };
  if (next.state.phase === 'suspended') patch.status = 'suspended';
  await adminDb().doc(`institutions/${institutionId}`).set(patch, { merge: true });
  const name = String((await adminDb().doc(`institutions/${institutionId}`).get()).data()?.name ?? 'Your institution');
  await writeNotices(institutionId, next.notices, name);
  await rememberAdminTask({
    type: 'other',
    entityType: 'billing',
    entityPath: `institutions/${institutionId}/billing/current`,
    title: 'Failed payment',
    summary: 'A school payment needs attention.',
    priority: 'high',
    scope: { institutionId },
  });
  return next.notices;
}

export async function markIndividualPaid(uid: string, planId: string, interval: VolumeInterval, paidOn = todayIso()): Promise<void> {
  const known: VolumePlanId = asVolumePlanId(planId) || 'igcse_alevel';
  const ref = adminDb().doc(`subscriber_billing/${uid}`);
  const snap = await ref.get();
  const current = readSubscription(snap.data() as Record<string, unknown> | undefined, {
    ...blankSubscription('individual', paidOn),
    planId: known,
    interval,
  });
  const next = recordPayment({ ...current, subject: 'individual', planId: known, seats: 1 }, paidOn, interval);
  await ref.set({ ...next.state, subject: 'individual', product: planId === 'teacher' ? 'teacher_plan' : 'plan' });
  await finishAdminTask(`subscriber_billing/${uid}`, 'system', 'done');
}

export async function markIndividualFailed(uid: string, on = todayIso()): Promise<void> {
  const ref = adminDb().doc(`subscriber_billing/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const current = readSubscription(snap.data() as Record<string, unknown>, blankSubscription('individual', on));
  const next = onPaymentFailed(current, on);
  await ref.set({ ...next.state, subject: 'individual' }, { merge: true });
  await rememberAdminTask({
    type: 'other',
    entityType: 'subscriber_billing',
    entityPath: `subscriber_billing/${uid}`,
    title: 'Failed payment',
    summary: 'A subscription payment needs attention.',
    priority: 'high',
  });
}

export async function advanceOpenBills(on = todayIso()): Promise<{ institutions: number; individuals: number }> {
  const db = adminDb();
  // billingPhase is a single field on the academy, so this uses Firestore's automatic index
  // and skips academies that are pending or already suspended.
  const academies = await db.collection('institutions').where('billingPhase', 'in', ['active', 'grace']).limit(200).get();
  let institutions = 0;
  for (const academy of academies.docs) {
    const billing = await academy.ref.collection('billing').doc('current').get();
    if (!billing.exists) continue;
    const raw = billing.data() as Record<string, unknown>;
    const state = readSubscription(raw, blankSubscription('institution', on));
    const cancelOn = typeof raw.cancelOn === 'string' ? raw.cancelOn : '';
    if (scheduledCancellation({ phase: state.phase, cancelOn, today: on })) {
      await billing.ref.set({ phase: 'suspended', suspendedOn: on, cancelOn: '' }, { merge: true });
      await academy.ref.set({ billingPhase: 'suspended', status: 'suspended' }, { merge: true });
      await academy.ref.collection('notifications').add({
        kind: 'suspend',
        title: `${String(academy.data().name ?? 'Your institution')} subscription ended`,
        body: 'The subscription was cancelled and the paid period has ended.',
        audience: 'admins',
        at: on,
      });
      institutions += 1;
      continue;
    }
    const next = cycleSubscription(state, on);
    const moved = billingMoved(state, next);
    if (moved) {
      await billing.ref.set(next.state, { merge: true });
      const patch: { billingPhase: string; status?: string } = { billingPhase: next.state.phase };
      if (next.state.phase === 'suspended') patch.status = 'suspended';
      if (next.state.phase === 'active') patch.status = 'active';
      await academy.ref.set(patch, { merge: true });
      await writeNotices(academy.id, next.notices, String(academy.data().name ?? 'Your institution'));
      institutions += 1;
    }
    if ((moved ? next.state.phase : state.phase) === 'active') {
      await reviewInstitutionTier(academy.id, on);
    }
  }
  const people = await db.collection('subscriber_billing').where('phase', 'in', ['active', 'grace']).limit(200).get();
  let individuals = 0;
  for (const person of people.docs) {
    const state = readSubscription(person.data() as Record<string, unknown>, blankSubscription('individual', on));
    const next = cycleSubscription(state, on);
    if (!billingMoved(state, next)) continue;
    await person.ref.set({ ...next.state, subject: 'individual' }, { merge: true });
    individuals += 1;
  }
  return { institutions, individuals };
}
