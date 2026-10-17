/**
 * Subscriptions shared by the web (Stripe, Touch 'n Go, FPX) and the app
 * (RevenueCat on Apple and Google). Prices stay in pricing_config. This
 * module decides; it does not charge a card or write Firestore.
 */

import { createHash, timingSafeEqual } from 'crypto';
import { ageTierFromDob, asAgeTier, isMinorTier, type AgeTier } from '../age-tier';
import type { AccessTier } from '../entitlements';
import { FAMILY_BUNDLE_DISCOUNT } from './discount';

export { FAMILY_BUNDLE_DISCOUNT };

export const BILLING_SOURCES = ['stripe', 'apple', 'google'] as const;
export type BillingSource = (typeof BILLING_SOURCES)[number];

export const ENTITLEMENT_STATUSES = ['active', 'grace', 'past_due', 'canceled', 'expired'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const AUDIT_TYPES = [
  'purchase',
  'renewal',
  'renewal_failed',
  'grace_period',
  'expired',
  'refunded',
  'cancelled',
  'uncancelled',
  'product_change',
  'transfer',
  'ask',
  'decline',
  'cap',
] as const;
export type BillingAuditType = (typeof AUDIT_TYPES)[number];

export const REMINDER_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

export const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
export const GOOGLE_MANAGE_URL = 'https://play.google.com/store/account/subscriptions';

/** RevenueCat subscriber attribute. Value is a comma-separated list of child uids. */
export const BENEFICIARY_ATTRIBUTE = 'beneficiaries';

export interface SponsoredBy {
  payerUid: string;
  subscriptionId: string;
  source: BillingSource;
}

export interface FamilyRate {
  placeholder: boolean;
  secondChildOff: number;
  furtherChildOff: number;
}

export interface QuotedChild {
  uid: string;
  tierId: string;
  accessTier: number;
  listUsd: number;
  chargeUsd: number;
  off: number;
  seat: number;
}

/** Store product id → tier. No prices live here. */
export const REVENUECAT_PRODUCTS: Record<string, { tierId: string; accessTier: AccessTier }> = {
  poket_primary_secondary_monthly: { tierId: 'primary_secondary', accessTier: 1 },
  poket_primary_secondary_annual: { tierId: 'primary_secondary', accessTier: 1 },
  poket_igcse_alevel_monthly: { tierId: 'igcse_alevel', accessTier: 2 },
  poket_igcse_alevel_annual: { tierId: 'igcse_alevel', accessTier: 2 },
  poket_professional_monthly: { tierId: 'professional', accessTier: 3 },
  poket_professional_annual: { tierId: 'professional', accessTier: 3 },
};

export function productTier(productId: string): { tierId: string; accessTier: AccessTier } | null {
  const row = REVENUECAT_PRODUCTS[productId];
  return row ?? null;
}

export function subscriptionDocId(payerUid: string): string {
  return `sub_${payerUid}`;
}

export function periodEndFrom(now: number, interval: 'month' | 'year'): number {
  const date = new Date(now);
  if (interval === 'year') date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.getTime();
}

/** Approved parent_link is the verified guardian. A numeric guardianTier, when stored, must be at least 2. */
export function guardianCanPay(link: { status?: unknown; guardianTier?: unknown } | null | undefined): boolean {
  if (!link || link.status !== 'approved') return false;
  if (typeof link.guardianTier === 'number' && link.guardianTier < 2) return false;
  return true;
}

const PAYER_ROLES = new Set(['parent', 'teacher', 'admin', 'institution_admin', 'super_admin']);

export function purchaseGate(input: {
  ageTier?: unknown;
  role?: unknown;
  dateOfBirth?: unknown;
  now: Date;
}): { ok: true } | { ok: false; reason: string } {
  const role = typeof input.role === 'string' ? input.role : '';
  if (PAYER_ROLES.has(role)) return { ok: true };
  let tier: AgeTier | null = null;
  if (input.ageTier === 'adult' || input.ageTier === 'teen' || input.ageTier === 'under13') tier = input.ageTier;
  if (!tier && typeof input.dateOfBirth === 'string') tier = ageTierFromDob(input.dateOfBirth, input.now);
  if (tier === 'adult') return { ok: true };
  if (tier && isMinorTier(tier)) {
    return { ok: false, reason: 'Under-18s cannot buy anything themselves. Ask a parent to approve and pay.' };
  }
  if (!tier && role === 'student') {
    return { ok: false, reason: 'Under-18s cannot buy anything themselves. Ask a parent to approve and pay.' };
  }
  if (!tier) return { ok: false, reason: 'Add a date of birth before paying. Under-18s ask a parent.' };
  return asAgeTier(tier) === 'adult'
    ? { ok: true }
    : { ok: false, reason: 'Under-18s cannot buy anything themselves. Ask a parent to approve and pay.' };
}

export function canTakeOverBilling(input: { ageTier?: unknown; dateOfBirth?: unknown; now: Date }): boolean {
  if (input.ageTier === 'adult') return true;
  if (typeof input.dateOfBirth === 'string') return ageTierFromDob(input.dateOfBirth, input.now) === 'adult';
  return false;
}

/** Children on the plan. The payer is not a learner. */
export function unlockUids(payerUid: string, beneficiaryUids: readonly string[]): string[] {
  return [...new Set(beneficiaryUids.filter((uid) => uid && uid !== payerUid))];
}

/**
 * Course access is written on the child. An adult who buys only for themselves
 * is the learner. A parent who also lists themselves still does not receive
 * the children's courses.
 */
export function courseUnlockUids(payerUid: string, beneficiaryUids: readonly string[]): string[] {
  const children = unlockUids(payerUid, beneficiaryUids);
  if (children.length > 0) return children;
  return beneficiaryUids.includes(payerUid) ? [payerUid] : [];
}

export function quoteFamily(
  lines: readonly { uid: string; tierId: string; accessTier: number; listUsd: number }[],
  rates: FamilyRate = FAMILY_BUNDLE_DISCOUNT,
): { lines: QuotedChild[]; subtotalUsd: number; placeholder: true } {
  const quoted: QuotedChild[] = lines.map((line, index) => {
    const off = index === 0 ? 0 : index === 1 ? rates.secondChildOff : rates.furtherChildOff;
    const listMinor = Math.round(line.listUsd * 100);
    const chargeMinor = Math.round(listMinor * (1 - off));
    return {
      uid: line.uid,
      tierId: line.tierId,
      accessTier: line.accessTier,
      listUsd: listMinor / 100,
      chargeUsd: chargeMinor / 100,
      off,
      seat: index + 1,
    };
  });
  const subtotalMinor = quoted.reduce((sum, line) => sum + Math.round(line.chargeUsd * 100), 0);
  return { lines: quoted, subtotalUsd: subtotalMinor / 100, placeholder: true };
}

export function withinSpendingCap(totalUsd: number, capUsd: number | null | undefined): boolean {
  if (capUsd == null || !Number.isFinite(capUsd)) return true;
  return totalUsd <= capUsd + 0.001;
}

/**
 * A school seat that already covers the plan blocks a second parent payment.
 * A higher plan than the seat only warns. Graduation onto an individual plan
 * is allowed and keeps the old records.
 */
export function parentPayDecision(input: {
  seatActive: boolean;
  seatTier: number;
  requestedTier: number;
  graduating?: boolean;
}): { action: 'allow' | 'warn' | 'block'; reason: string } {
  if (input.graduating) {
    return { action: 'allow', reason: 'The school seat is ending. A parent can switch this learner onto an individual plan without deleting records.' };
  }
  if (!input.seatActive || input.seatTier <= 0) return { action: 'allow', reason: '' };
  if (input.seatTier >= input.requestedTier) {
    return { action: 'block', reason: 'The school seat already covers this plan. A parent payment would duplicate it.' };
  }
  return { action: 'warn', reason: 'The school seat covers a lower plan. The parent payment only adds what the seat does not include.' };
}

export function reminderDue(input: {
  currentPeriodEnd: number | null;
  now: number;
  reminderSentFor: number | null;
  status: string;
}): boolean {
  if (input.currentPeriodEnd == null) return false;
  if (input.status !== 'active' && input.status !== 'grace' && input.status !== 'past_due') return false;
  if (input.reminderSentFor === input.currentPeriodEnd) return false;
  return input.now >= input.currentPeriodEnd - REMINDER_LEAD_MS && input.now < input.currentPeriodEnd;
}

export function manageDestination(source: BillingSource | string, portalUrl: string | null): { kind: 'portal' | 'store'; url: string } {
  if (source === 'apple') return { kind: 'store', url: APPLE_MANAGE_URL };
  if (source === 'google') return { kind: 'store', url: GOOGLE_MANAGE_URL };
  return { kind: 'portal', url: portalUrl || '/dashboard' };
}

export function payerRenewalCopy(renewsOn: string): { title: string; message: string } {
  return {
    title: 'Subscription renews soon',
    message: `Your Poket School plan renews on ${renewsOn}. Manage it from billing if you want to change or stop it.`,
  };
}

export function payerFailedCopy(): { title: string; message: string } {
  return {
    title: 'Payment needs an update',
    message: 'A payment did not go through. Update the payment method so the courses stay open.',
  };
}

/** Shown to the child. No amounts, card digits, or store receipts. */
export function childAccessCopy(): { title: string; message: string } {
  return {
    title: 'Course access may pause',
    message: 'A parent payment needs attention. Your courses may pause if it is not updated. You do not need to enter any payment details.',
  };
}

export function secretMatches(header: string | null | undefined, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

export function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((key) => obj[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`).join(',')}}`;
}

export function chainHash(prevHash: string, payload: Record<string, unknown>): string {
  return createHash('sha256').update(`${prevHash}|${canonical(payload)}`).digest('hex');
}

export function sourceFromStore(store: unknown): BillingSource {
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'apple';
  if (store === 'PLAY_STORE') return 'google';
  return 'stripe';
}

export function parseBeneficiaryList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()))];
  }
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean))];
}

export interface RevenueCatEvent {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  product_id?: unknown;
  expiration_at_ms?: unknown;
  store?: unknown;
  cancel_reason?: unknown;
  subscriber_attributes?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
  original_transaction_id?: unknown;
  transaction_id?: unknown;
}

export interface EntitlementDecision {
  eventId: string;
  eventType: string;
  payerUid: string;
  beneficiaryUids: string[];
  tierId: string | null;
  accessTier: number | null;
  status: EntitlementStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  source: BillingSource;
  externalId: string;
  productId: string;
  dropAccess: boolean;
  audit: BillingAuditType[];
  notify: 'none' | 'failed';
  nextPayerUid: string | null;
}

function attributeValue(attributes: unknown, key: string): unknown {
  if (!attributes || typeof attributes !== 'object') return undefined;
  const row = (attributes as Record<string, unknown>)[key];
  if (row && typeof row === 'object' && 'value' in row) return (row as { value: unknown }).value;
  return row;
}

export function mapRevenueCatEvent(event: RevenueCatEvent): { ok: true; decision: EntitlementDecision } | { ok: false; reason: string } {
  const eventId = typeof event.id === 'string' ? event.id : '';
  const eventType = typeof event.type === 'string' ? event.type : '';
  const payerUid = typeof event.app_user_id === 'string' ? event.app_user_id : '';
  if (!eventId || !eventType || !payerUid) return { ok: false, reason: 'RevenueCat event is missing an id, type, or app user.' };
  const known = new Set([
    'INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'UNCANCELLATION',
    'EXPIRATION', 'BILLING_ISSUE', 'PRODUCT_CHANGE', 'TRANSFER', 'REFUND',
  ]);
  if (!known.has(eventType)) return { ok: false, reason: `Ignored RevenueCat event ${eventType}.` };

  const productId = typeof event.product_id === 'string' ? event.product_id : '';
  const mapped = productId ? productTier(productId) : null;
  const beneficiaries = parseBeneficiaryList(attributeValue(event.subscriber_attributes, BENEFICIARY_ATTRIBUTE));
  const beneficiaryUids = beneficiaries.length > 0 ? beneficiaries : [payerUid];
  const expiration = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null;
  const externalId = typeof event.original_transaction_id === 'string' && event.original_transaction_id
    ? event.original_transaction_id
    : typeof event.transaction_id === 'string' && event.transaction_id
      ? event.transaction_id
      : eventId;
  const base = {
    eventId,
    eventType,
    payerUid,
    beneficiaryUids,
    tierId: mapped?.tierId ?? null,
    accessTier: mapped?.accessTier ?? null,
    source: sourceFromStore(event.store),
    externalId,
    productId,
    currentPeriodEnd: expiration,
    nextPayerUid: null as string | null,
  };

  if ((eventType === 'INITIAL_PURCHASE' || eventType === 'RENEWAL' || eventType === 'PRODUCT_CHANGE') && !mapped) {
    return { ok: false, reason: `No tier is configured for product ${productId || '(missing)'}.` };
  }

  if (eventType === 'INITIAL_PURCHASE') {
    return { ok: true, decision: { ...base, status: 'active', cancelAtPeriodEnd: false, dropAccess: false, audit: ['purchase'], notify: 'none' } };
  }
  if (eventType === 'RENEWAL') {
    return { ok: true, decision: { ...base, status: 'active', cancelAtPeriodEnd: false, dropAccess: false, audit: ['renewal'], notify: 'none' } };
  }
  if (eventType === 'CANCELLATION') {
    return { ok: true, decision: { ...base, status: 'active', cancelAtPeriodEnd: true, dropAccess: false, audit: ['cancelled'], notify: 'none' } };
  }
  if (eventType === 'UNCANCELLATION') {
    return { ok: true, decision: { ...base, status: 'active', cancelAtPeriodEnd: false, dropAccess: false, audit: ['uncancelled'], notify: 'none' } };
  }
  if (eventType === 'EXPIRATION') {
    return { ok: true, decision: { ...base, status: 'expired', cancelAtPeriodEnd: false, dropAccess: true, accessTier: 0, audit: ['expired'], notify: 'none' } };
  }
  if (eventType === 'BILLING_ISSUE') {
    return { ok: true, decision: { ...base, status: 'grace', cancelAtPeriodEnd: false, dropAccess: false, audit: ['renewal_failed', 'grace_period'], notify: 'failed' } };
  }
  if (eventType === 'PRODUCT_CHANGE') {
    return { ok: true, decision: { ...base, status: 'active', cancelAtPeriodEnd: false, dropAccess: false, audit: ['product_change'], notify: 'none' } };
  }
  if (eventType === 'REFUND') {
    return { ok: true, decision: { ...base, status: 'expired', cancelAtPeriodEnd: false, dropAccess: true, accessTier: 0, audit: ['refunded'], notify: 'none' } };
  }
  const next = parseBeneficiaryList(event.transferred_to)[0] ?? null;
  return {
    ok: true,
    decision: {
      ...base,
      payerUid: next || payerUid,
      nextPayerUid: next,
      status: 'active',
      cancelAtPeriodEnd: false,
      dropAccess: false,
      audit: ['transfer'],
      notify: 'none',
    },
  };
}

export function splitFamilyTransfer(input: {
  payerUid: string;
  beneficiaryUids: readonly string[];
  childUid: string;
  nextPayerUid: string;
}): { previous: string[]; moved: string[] } | { error: string } {
  if (!input.beneficiaryUids.includes(input.childUid)) return { error: 'That child is not on this subscription.' };
  if (input.nextPayerUid === input.payerUid) return { error: 'Choose a different guardian.' };
  return {
    previous: input.beneficiaryUids.filter((uid) => uid !== input.childUid),
    moved: [input.childUid],
  };
}
