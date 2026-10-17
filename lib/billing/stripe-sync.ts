/** Stripe events that should land on the same entitlement fields as RevenueCat. */

import { adminDb } from '../firebase-admin';
import type { ParsedStripeEvent } from '../payments/stripe-events';
import { tierFromId } from '../server/actions';
import type { AccessTier } from '../entitlements';
import {
  appendBillingAudit,
  claimBillingEvent,
  finishBillingEvent,
  mirrorSelfEntitlement,
  notifyPaymentProblem,
  refreshFamilyPeriod,
} from './store';

async function payerFor(uid: string | undefined, checkoutId: string | undefined): Promise<string> {
  if (uid) return uid;
  if (!checkoutId) return '';
  const snap = await adminDb().doc(`checkouts/${checkoutId}`).get();
  const userId = snap.data()?.userId;
  return typeof userId === 'string' ? userId : '';
}

export async function syncStripeEntitlement(parsed: ParsedStripeEvent): Promise<void> {
  const claimable = parsed.type === 'legacy_subscription'
    || parsed.type === 'subscription_sync'
    || parsed.type === 'subscription_renewed'
    || parsed.type === 'subscription_payment_failed'
    || parsed.type === 'subscription_ended'
    || parsed.type === 'individual_payment_failed'
    || parsed.type === 'refund';
  if (!claimable) return;
  const decision = await claimBillingEvent('stripe', parsed.eventId);
  if (decision === 'skip') return;
  try {
    if (parsed.type === 'legacy_subscription') {
      const tier = tierFromId(parsed.tierId) ?? (Number.isFinite(parsed.accessTier) ? parsed.accessTier as AccessTier : 0);
      await mirrorSelfEntitlement({
        uid: parsed.uid,
        accessTier: tier,
        tierId: parsed.tierId,
        source: 'stripe',
        externalId: parsed.eventId,
      });
    } else if (parsed.type === 'subscription_sync' || parsed.type === 'subscription_renewed') {
      const payerUid = await payerFor(parsed.uid, parsed.checkoutId);
      if (payerUid) {
        const existing = await adminDb().doc(`subscriptions/sub_${payerUid}`).get();
        const cancel = parsed.type === 'subscription_sync' ? parsed.cancelAtPeriodEnd : false;
        const ended = parsed.type === 'subscription_sync' && (parsed.status === 'canceled' || parsed.status === 'unpaid' || parsed.status === 'incomplete_expired');
        await refreshFamilyPeriod({
          payerUid,
          currentPeriodEnd: parsed.currentPeriodEnd,
          cancelAtPeriodEnd: cancel,
          status: ended ? 'canceled' : 'active',
          externalId: parsed.subscriptionId,
          stripeCustomerId: parsed.customerId,
          audit: ended ? 'expired' : parsed.type === 'subscription_renewed' ? 'renewal' : cancel ? 'cancelled' : existing.exists ? 'renewal' : 'purchase',
        });
      }
    } else if (parsed.type === 'subscription_payment_failed' || parsed.type === 'individual_payment_failed') {
      const payerUid = await payerFor(parsed.type === 'individual_payment_failed' ? parsed.uid : parsed.uid, parsed.type === 'subscription_payment_failed' ? parsed.checkoutId : undefined);
      if (payerUid) {
        const snap = await adminDb().doc(`subscriptions/sub_${payerUid}`).get();
        const beneficiaries = Array.isArray(snap.data()?.beneficiaryUids) ? snap.data()?.beneficiaryUids as string[] : [payerUid];
        await refreshFamilyPeriod({
          payerUid,
          currentPeriodEnd: typeof snap.data()?.currentPeriodEnd === 'number' ? snap.data()?.currentPeriodEnd as number : null,
          status: 'grace',
          externalId: parsed.type === 'subscription_payment_failed' ? parsed.subscriptionId : undefined,
          audit: 'renewal_failed',
        });
        await notifyPaymentProblem({ payerUid, beneficiaryUids: beneficiaries, source: 'stripe' });
        await appendBillingAudit({
          type: 'grace_period',
          payerUid,
          beneficiaryUids: beneficiaries,
          subscriptionId: `sub_${payerUid}`,
          at: Date.now(),
          detail: parsed.eventId,
          source: 'stripe',
        });
      }
    } else if (parsed.type === 'subscription_ended') {
      const payerUid = await payerFor(parsed.uid, undefined);
      if (payerUid) {
        await refreshFamilyPeriod({
          payerUid,
          currentPeriodEnd: Date.now(),
          status: 'expired',
          externalId: parsed.subscriptionId,
          audit: 'expired',
        });
      }
    } else if (parsed.type === 'refund') {
      const payerUid = await payerFor(undefined, parsed.checkoutId);
      if (payerUid) {
        await refreshFamilyPeriod({
          payerUid,
          currentPeriodEnd: Date.now(),
          status: 'expired',
          externalId: parsed.chargeId,
          audit: 'refunded',
        });
      }
    }
    await finishBillingEvent('stripe', parsed.eventId, 'processed');
  } catch (error) {
    await finishBillingEvent('stripe', parsed.eventId, 'error');
    throw error;
  }
}
