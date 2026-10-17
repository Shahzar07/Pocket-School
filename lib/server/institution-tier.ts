/**
 * Applies a tier move for one academy. The decision lives in planTierReview.
 */

import { adminDb } from '../firebase-admin';
import { planTierReview, type TierReview } from '../institution-catalogue';
import { blankSubscription, institutionEmail, periodStartFor, readSubscription } from '../institution-membership';
import { loadAutomation, logAutomation } from './automation-store';
import { countInstitutionStudents, loadInstitutionCatalogue } from './institution-catalogue';
import { sendInstitutionMail } from './institution-mail';

function todayIso(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

async function notifyAdmin(institutionId: string, name: string, review: TierReview, email: string, kind: 'tier_upgrade' | 'tier_renewal' = review.action === 'upgrade' ? 'tier_upgrade' : 'tier_renewal'): Promise<void> {
  const mail = institutionEmail(kind, {
    institutionName: name,
    plan: review.toName,
    seats: review.students,
    total: kind === 'tier_upgrade'
      ? (review.charge > 0 ? `${review.currency} ${review.charge.toFixed(2)}` : '')
      : `${review.currency} ${review.savings.toFixed(2)}`,
    renewalOn: review.periodEnd,
  });
  await adminDb().collection('institutions').doc(institutionId).collection('notifications').add({
    kind,
    title: mail.subject,
    body: mail.text,
    audience: 'admins',
    at: todayIso(),
  });
  if (email) await sendInstitutionMail(email, mail);
}

/** Moves the academy up when the roster crosses a tier. A smaller roster is a renewal suggestion. */
export async function reviewInstitutionTier(institutionId: string, on = todayIso()): Promise<TierReview['action'] | 'held'> {
  const db = adminDb();
  const academy = await db.doc(`institutions/${institutionId}`).get();
  if (!academy.exists) return 'stay';
  const billingRef = academy.ref.collection('billing').doc('current');
  const billing = await billingRef.get();
  if (!billing.exists) return 'stay';
  const raw = billing.data() as Record<string, unknown>;
  const state = readSubscription(raw, blankSubscription('institution', on));
  if (state.phase !== 'active') return 'stay';
  const programmeIds = Array.isArray(raw.programmeIds)
    ? raw.programmeIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  if (programmeIds.length === 0) return 'stay';
  const students = await countInstitutionStudents(institutionId);
  const periodStart = periodStartFor(state.periodEnd, state.interval);
  const country = typeof academy.get('country') === 'string' ? academy.get('country') as string : '';
  const review = planTierReview({
    catalogue: await loadInstitutionCatalogue(),
    currentTierId: typeof raw.tierId === 'string' ? raw.tierId : '',
    currentSeats: state.seats,
    currentTotal: state.total,
    students,
    itemIds: programmeIds,
    interval: state.interval,
    country,
    tender: 'card',
    periodStart,
    periodEnd: state.periodEnd,
    on,
  });
  if ('error' in review || review.action === 'stay') return 'stay';
  const noticeKey = typeof raw.tierNoticeKey === 'string' ? raw.tierNoticeKey : '';
  const name = String(academy.get('name') ?? 'Your institution');
  const email = state.payerEmail;
  if (review.action === 'suggest_downgrade') {
    if (noticeKey === review.noticeKey) return 'stay';
    await billingRef.set({
      renewalSuggestion: {
        tierId: review.toId,
        tierName: review.toName,
        students: review.students,
        nextTotal: review.nextTotal,
        savings: review.savings,
        currency: review.currency,
        periodEnd: review.periodEnd,
        message: review.message,
      },
      tierNoticeKey: review.noticeKey,
    }, { merge: true });
    await notifyAdmin(institutionId, name, review, email);
    return 'suggest_downgrade';
  }
  const automation = await loadAutomation();
  if (!automation.rules.tier_upgrade) {
    const heldKey = `held:${review.noticeKey}`;
    if (noticeKey !== heldKey) {
      await billingRef.set({ tierNoticeKey: heldKey }, { merge: true });
      await adminDb().collection('institutions').doc(institutionId).collection('notifications').add({
        kind: 'tier_upgrade',
        title: `${name} is ready for ${review.toName}`,
        body: `${review.students} unique students match ${review.toName}. Automatic tier changes are off, so a super admin applies this one. The difference is prorated.`,
        audience: 'admins',
        at: todayIso(),
      });
    }
    await logAutomation({ rule: 'tier_upgrade', outcome: 'held', summary: `${name} is ready for ${review.toName}.`, refId: institutionId });
    return 'held';
  }
  await billingRef.set({
    seats: review.nextSeats,
    total: review.nextTotal,
    currency: review.currency,
    tierId: review.toId,
    programmeIds: review.itemIds,
    lines: review.lines,
    tierNoticeKey: review.noticeKey,
    renewalSuggestion: null,
  }, { merge: true });
  await academy.ref.set({ seatCount: review.nextSeats }, { merge: true });
  await academy.ref.collection('settings').doc('profile').set({ seatCount: review.nextSeats }, { merge: true });
  await db.doc(`institutions/${institutionId}/sparks_guard/current`).set({
    cap: review.sparks,
    allowance: review.sparks,
    lowAtPercent: 20,
  }, { merge: true });
  await notifyAdmin(institutionId, name, review, email);
  await logAutomation({
    rule: 'tier_upgrade',
    outcome: 'auto',
    summary: `${name} moved to ${review.toName} for ${review.students} unique students.`,
    refId: institutionId,
  });
  return 'upgrade';
}
