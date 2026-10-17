import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { roleForServerCheck } from '../../admin-access';
import { adminDb } from '../../firebase-admin';
import type { AccessTier } from '../../entitlements';
import {
  ActionError,
  applyStripeSubscription,
  enrollFromPayment,
  grantPurchasedSparks,
  sendNotification,
} from '../../server/actions';
import { fixedPriceItem, sparkPackItem, subscriptionItem, walletTopUpItem } from '../catalog';
import { alumniCheckoutCoupon } from '../../graduation';
import { couponRejection, normaliseCode, referralCode, type Coupon } from '../coupons';
import { parsePromo, promoLive, type PromoDraft } from '../../promos';
import { summariseFinance, reconcile } from '../finance';
import { planGrants, planReversal, type FulfillmentInput, type PlannedGrant } from '../fulfillment';
import { eventDocId, claimDecision } from '../idempotency';
import { toMinor } from '../minor';
import { canonicalMethod, methodsFor, stripeTypesForCharge, type MethodId } from '../methods';
import { buildQuote, type CheckoutKind, type PricedItem, type Quote } from '../quote';
import { quoteCourse, readsPriceUsd } from '../../pricing';
import { loadPricingConfig } from '../../pricing-store';
import { quoteCheckout } from '../../platform/wallet';
import { readsBookItem, readsPlanItem } from '../reads';
import { buildMyInvois } from '../tax';
import { purchaseGate } from '../../billing/model';
import { gatewayMode, providerForMethod, stripeMode, type GatewayVendor, type ProviderMode } from '../providers';
import { ipay88Amount, ipay88Signature } from '../signatures';
import { missingRequired } from '../secrets';
import {
  clearSecret,
  loadSettings,
  noteWebhook,
  saveFlagOverrides,
  savePaymentsPatch,
  saveSpendCap,
  secretValue,
  secretViews,
  taxFrom,
  webhookHealth,
  writeSecret,
  type PaymentsSettings,
} from './settings';

const KINDS = new Set<CheckoutKind>(['subscription', 'sparks', 'course', 'book', 'reads', 'booking', 'resource', 'wallet', 'invoice']);

/** iPay88 Malaysia e-wallet payment ids from their API 2.0 method list. */
const IPAY88_IDS: Record<string, string> = { tng: '4538', boost: '4210', shopeepay: '4801' };

function db() {
  return adminDb();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface CheckoutInput {
  uid: string;
  email?: string;
  kind: string;
  sku: string;
  country?: string;
  currency?: string;
  interval?: string;
  seats?: number;
  coupon?: string;
  childIds?: string[];
  method?: string;
  idempotencyKey?: string;
  origin: string;
  /** Relative path Stripe or the gateway sends the buyer back to. */
  successPath?: string;
  cancelPath?: string;
  /** Parent-paid plans. One line per child. Prices come from pricing config. */
  familyLines?: { uid: string; tierId: string }[];
  acknowledgeWarning?: boolean;
}

interface CheckoutDoc {
  id: string;
  userId: string;
  email: string;
  buyerName: string;
  quote: Quote;
  method: string;
  provider: string;
  providerMode: ProviderMode;
  status: 'pending' | 'paid' | 'refunded';
  childIds: string[];
  providerRef?: string;
  paymentIntentId?: string;
  url?: string;
}

function asCheckout(id: string, data: DocumentData): CheckoutDoc {
  return {
    id,
    userId: str(data.userId),
    email: str(data.email),
    buyerName: str(data.buyerName) || 'Learner',
    quote: data.quote as Quote,
    method: str(data.method),
    provider: str(data.provider),
    providerMode: (data.providerMode as ProviderMode) || 'mock',
    status: (data.status as CheckoutDoc['status']) || 'pending',
    childIds: Array.isArray(data.childIds) ? data.childIds.filter((id) => typeof id === 'string') : [],
    providerRef: str(data.providerRef) || undefined,
    paymentIntentId: str(data.paymentIntentId) || undefined,
    url: str(data.url) || undefined,
  };
}

function safeReturn(origin: string, path: string | undefined, fallback: string): string {
  const candidate = path && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !path.includes('://')
    ? path
    : fallback;
  return `${origin}${candidate}`;
}

function shelfPriced(sku: string, title: string, amount: number, currency: string): PricedItem | null {
  const item = fixedPriceItem({ kind: 'book', sku, title, amount, currency, ownerId: 'platform' });
  if (!item) return null;
  return { ...item, shelf: true };
}

async function readsShelfItem(sku: string, currency: string): Promise<PricedItem | null> {
  const snap = await db().doc(`books/${sku}`).get();
  const data = snap.exists ? (snap.data() ?? {}) : null;
  if (data && data.status && data.status !== 'published') {
    throw new ActionError('INVALID', 'That book is not on the shelf yet.');
  }
  const code = currency.toUpperCase() === 'MYR' ? 'MYR' : 'USD';
  const config = await loadPricingConfig();
  const quoted = quoteCheckout({ kind: 'book', id: sku, currency: code }, config);
  if (quoted) {
    const item = shelfPriced(sku, data ? str(data.title) || quoted.name : quoted.name, quoted.amount, quoted.currency);
    if (item) return item;
  }
  if (data) {
    const shelfMyr = Number(data.priceRM ?? data.priceMyr ?? 0);
    const shelfUsd = Number(data.priceUsd ?? data.price ?? 0);
    if (code === 'MYR' && shelfMyr > 0) {
      const item = shelfPriced(sku, str(data.title) || 'Book', shelfMyr, 'MYR');
      if (item) return item;
    }
    if (shelfUsd > 0) {
      const money = quoteCourse(config, shelfUsd, 'USD', code);
      const item = shelfPriced(sku, str(data.title) || 'Book', money.amount, money.currency);
      if (item) return item;
    }
    throw new ActionError('INVALID', 'That book is included with Reads. Open it from the shelf.');
  }
  return readsBookItem(sku, currency);
}

async function profileOf(uid: string): Promise<DocumentData> {
  const snap = await db().doc(`users/${uid}`).get();
  if (!snap.exists) throw new ActionError('USER_NOT_FOUND', 'We could not find that account.');
  return snap.data() ?? {};
}

function shareBps(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n <= 100 ? Math.round(n * 100) : Math.round(n);
}

async function resolveItem(input: CheckoutInput, settings: PaymentsSettings, payer: DocumentData): Promise<PricedItem> {
  const kind = input.kind as CheckoutKind;
  if (!KINDS.has(kind)) throw new ActionError('INVALID', 'Choose what you are paying for.');
  const sku = input.sku.trim();
  if (!sku) throw new ActionError('INVALID', 'Choose an item first.');
  const interval = input.interval === 'year' ? 'year' : 'month';

  if (kind === 'subscription') {
    const item = subscriptionItem(sku, interval, await loadPricingConfig());
    if (!item) throw new ActionError('INVALID', 'That plan is not sold online.');
    return item;
  }
  if (kind === 'sparks') {
    const item = sparkPackItem(sku);
    if (!item) throw new ActionError('INVALID', 'Choose a Sparks pack.');
    return item;
  }
  if (kind === 'wallet') {
    const item = walletTopUpItem(sku, input.currency || 'USD');
    if (!item) throw new ActionError('INVALID', 'Choose a wallet top-up of 10, 25, 50 or 100.');
    return item;
  }
  if (kind === 'reads') {
    const item = readsPlanItem(sku, interval, readsPriceUsd(await loadPricingConfig(), sku));
    if (!item) throw new ActionError('INVALID', 'Choose Poket Reads or Poket Reads Family.');
    return item;
  }
  if (kind === 'book') {
    const shelf = await readsShelfItem(sku, input.currency || 'USD');
    if (shelf) return shelf;
  }
  if (kind === 'course' || kind === 'book') {
    const snap = await db().doc(`courses/${sku}`).get();
    if (!snap.exists) throw new ActionError('NOT_FOUND', 'That title was not found.');
    const data = snap.data() ?? {};
    if (kind === 'book' && data.type !== 'ebook') throw new ActionError('INVALID', 'That item is not a book.');
    const split = data.revenueSplit as { teacher?: number } | undefined;
    const item = fixedPriceItem({
      kind, sku, title: str(data.title) || 'Course', amount: Number(data.price ?? 0),
      currency: str(data.currency), ownerId: str(data.ownerId) || 'platform',
      teacherShareBps: shareBps(split?.teacher, settings.teacherShareBps),
    });
    if (!item) throw new ActionError('INVALID', 'This one is free. Open it from the course page.');
    return item;
  }
  if (kind === 'booking') {
    const snap = await db().doc(`tutor_offers/${sku}`).get();
    const data = snap.data();
    if (!snap.exists || data?.active === false) throw new ActionError('NOT_FOUND', 'That tutoring session is not available.');
    const item = fixedPriceItem({
      kind, sku, title: str(data?.title) || 'Tutoring session', amount: Number(data?.price ?? 0),
      currency: str(data?.currency), ownerId: str(data?.tutorId) || 'platform',
      teacherShareBps: settings.teacherShareBps,
    });
    if (!item) throw new ActionError('INVALID', 'That session has no price.');
    return item;
  }
  if (kind === 'resource') {
    const snap = await db().doc(`resources/${sku}`).get();
    if (!snap.exists) throw new ActionError('NOT_FOUND', 'That resource was not found.');
    const data = snap.data() ?? {};
    const item = fixedPriceItem({
      kind, sku, title: str(data.title) || 'Resource', amount: Number(data.price ?? 0),
      currency: str(data.currency), ownerId: str(data.uploadedBy) || 'platform',
      teacherShareBps: settings.teacherShareBps,
    });
    if (!item) throw new ActionError('INVALID', 'That resource is not for sale.');
    return item;
  }
  const snap = await db().doc(`invoices/${sku}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'That invoice was not found.');
  const data = snap.data() ?? {};
  const studentId = str(data.studentId);
  const children = Array.isArray(payer.childIds) ? payer.childIds : [];
  if (studentId !== input.uid && !children.includes(studentId)) {
    throw new ActionError('FORBIDDEN', 'That invoice belongs to someone else.');
  }
  if (data.status !== 'sent' && data.status !== 'overdue') {
    throw new ActionError('INVALID', 'That invoice is not waiting for payment.');
  }
  const item = fixedPriceItem({
    kind: 'invoice', sku, title: str(data.description) || 'School invoice',
    amount: Number(data.amount ?? 0), currency: str(data.currency),
  });
  if (!item) throw new ActionError('INVALID', 'That invoice has no amount due.');
  return item;
}

async function loadCoupon(code: string | undefined, currency: string, settings: PaymentsSettings): Promise<Coupon | null> {
  const normalised = normaliseCode(code ?? '');
  if (!normalised) return null;
  if (!settings.flags['payments.affiliates']) throw new ActionError('FORBIDDEN', 'Referral codes are switched off.');
  const snap = await db().doc(`coupons/${normalised}`).get();
  if (!snap.exists) throw new ActionError('INVALID', 'That code was not found.');
  const data = snap.data() ?? {};
  const coupon: Coupon = {
    code: normalised,
    percentOff: typeof data.percentOff === 'number' ? data.percentOff : undefined,
    amountOff: typeof data.amountOff === 'number' ? data.amountOff : undefined,
    currency: str(data.currency) || undefined,
    affiliateId: str(data.affiliateId) || undefined,
    revenueShareBps: Number(data.revenueShareBps ?? settings.affiliateShareBps),
    active: data.active !== false,
    expiresAt: str(data.expiresAt) || undefined,
    maxRedemptions: typeof data.maxRedemptions === 'number' ? data.maxRedemptions : undefined,
    redemptions: Number(data.redemptions ?? 0),
  };
  const reason = couponRejection(coupon, currency, new Date().toISOString().slice(0, 10));
  if (reason) throw new ActionError('INVALID', reason);
  return coupon;
}

async function quoted(input: CheckoutInput): Promise<{ quote: Quote; settings: PaymentsSettings; payer: DocumentData }> {
  const settings = await loadSettings();
  const payer = await profileOf(input.uid);
  const item = await resolveItem(input, settings, payer);
  const coupon = await loadCoupon(input.coupon, item.currency, settings)
    ?? (item.kind === 'subscription'
      ? alumniCheckoutCoupon(typeof payer.alumniDiscount === 'number' ? payer.alumniDiscount : 0)
      : null);
  const country = (input.country || 'MY').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new ActionError('INVALID', 'Choose a country.');
  const quote = buildQuote({
    item, seats: input.seats, coupon, country, tax: taxFrom(settings),
  });
  return { quote, settings, payer };
}

export async function quoteFor(input: CheckoutInput) {
  const { quote, settings } = await quoted(input);
  const methods = methodsFor({ country: input.country || 'MY', currency: quote.currency, overrides: settings.flags })
    .map((method) => ({ id: method.id, label: method.label, blurb: method.blurb, provider: method.provider }));
  return { quote, methods };
}

function checkoutIdFor(uid: string, key: string | undefined): string {
  if (!key) return `chk_${randomBytes(9).toString('hex')}`;
  const hash = createHash('sha256').update(`${uid}:${key}`).digest('hex').slice(0, 20);
  return `chk_${hash}`;
}

async function gatewaySecrets() {
  const [code, key, api, collection, merchant, secret] = await Promise.all([
    secretValue('ipay88_code'), secretValue('ipay88_key'), secretValue('billplz_key'),
    secretValue('billplz_collection'), secretValue('rms_merchant'), secretValue('rms_secret'),
  ]);
  return {
    ipay88MerchantCode: code, ipay88MerchantKey: key, billplzApiKey: api,
    billplzCollectionId: collection, rmsMerchantId: merchant, rmsSecret: secret,
  };
}

export async function startCheckout(input: CheckoutInput) {
  if (input.familyLines && input.familyLines.length > 0) return startFamilyCheckout(input);
  const { quote, settings, payer } = await quoted(input);
  const gate = purchaseGate({
    ageTier: payer.ageTier,
    role: payer.role,
    dateOfBirth: payer.dateOfBirth,
    now: new Date(),
  });
  if (!gate.ok) throw new ActionError('MINOR', gate.reason);
  const country = (input.country || 'MY').toUpperCase();
  const method = canonicalMethod(input.method || 'card') as MethodId;
  const available = methodsFor({ country, currency: quote.currency, overrides: settings.flags });
  if (!available.some((item) => item.id === method)) {
    throw new ActionError('INVALID', 'That payment method is not available for this country and currency.');
  }
  const provider = providerForMethod(method);
  if (!provider) throw new ActionError('INVALID', 'Choose a payment method.');
  const childIds = (input.childIds ?? []).filter((id) => typeof id === 'string' && id.trim());
  if (quote.kind === 'subscription') {
    const linked = Array.isArray(payer.childIds) ? payer.childIds : [];
    for (const id of childIds) {
      if (!linked.includes(id)) throw new ActionError('FORBIDDEN', 'That sibling is not linked to this account.');
    }
    if (childIds.length + 1 > quote.seats) throw new ActionError('INVALID', 'Add a seat for each sibling.');
  }

  const id = checkoutIdFor(input.uid, input.idempotencyKey);
  const existingSnap = await db().doc(`checkouts/${id}`).get();
  if (existingSnap.exists) {
    const existing = asCheckout(id, existingSnap.data() ?? {});
    if (existing.status === 'paid') {
      return { checkoutId: id, mode: existing.providerMode, alreadyPaid: true, sandbox: false, amount: existing.quote.total, currency: existing.quote.currency };
    }
    if (existing.url) {
      return {
        checkoutId: id, mode: existing.providerMode, url: existing.url, sandbox: existing.providerMode === 'mock',
        amount: existing.quote.total, currency: existing.quote.currency,
      };
    }
  }

  const buyerName = str(payer.name) || 'Learner';
  const done = safeReturn(input.origin, input.successPath, `/dashboard/checkout?paid=${id}`);
  const cancel = safeReturn(input.origin, input.cancelPath, `/dashboard/checkout?kind=${quote.kind}&sku=${encodeURIComponent(quote.sku)}`);
  const secrets = await gatewaySecrets();
  const stripeSecret = await secretValue('stripe_secret');
  let mode: ProviderMode = 'mock';
  let url: string | undefined;
  let postUrl: string | undefined;
  let fields: Record<string, string> | undefined;

  if (provider === 'wallet') {
    mode = 'mock';
  } else if (provider === 'stripe') {
    mode = stripeMode(stripeSecret);
    if (mode !== 'mock' && stripeSecret) {
      url = await stripeSession({
        secret: stripeSecret, quote, checkoutId: id, email: input.email, method, uid: input.uid, done, cancel,
      });
    }
  } else {
    mode = gatewayMode(settings.gateway, secrets, settings.gatewayExplicit);
    if (mode !== 'mock') {
      const hosted = await gatewaySession({
        vendor: settings.gateway, secrets, quote, checkoutId: id, method, email: input.email,
        name: buyerName, origin: input.origin, mode, done,
      });
      url = hosted.url;
      postUrl = hosted.postUrl;
      fields = hosted.fields;
    }
  }

  // No Stripe or gateway key: do not open a sandbox that grants a real plan.
  if (provider !== 'wallet' && mode === 'mock') {
    return {
      checkoutId: id,
      mode,
      sandbox: false,
      available: false,
      alreadyPaid: false,
      amount: quote.total,
      currency: quote.currency,
      message: 'Payments are coming soon.',
    };
  }

  await db().doc(`checkouts/${id}`).set({
    userId: input.uid,
    email: input.email ?? '',
    buyerName,
    quote,
    method,
    provider,
    providerMode: mode,
    status: 'pending',
    childIds: quote.kind === 'subscription' ? childIds : [],
    url: url ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (provider === 'wallet') {
    await debitWallet(input.uid, quote.currency, quote.total, id);
    try {
      await fulfillCheckout(id, { eventId: `wallet:${id}`, provider: 'wallet' });
    } catch (error) {
      await moveWallet(input.uid, quote.currency, toMinor(quote.total), `undo_${id}`);
      throw error;
    }
    return { checkoutId: id, mode: 'mock' as const, sandbox: false, alreadyPaid: true, url: done, amount: quote.total, currency: quote.currency };
  }

  return { checkoutId: id, mode, url, postUrl, fields, sandbox: mode === 'mock', alreadyPaid: false, amount: quote.total, currency: quote.currency };
}

async function startFamilyCheckout(input: CheckoutInput) {
  const lines = (input.familyLines ?? []).filter((line) => line.uid && line.tierId);
  if (lines.length === 0 || lines.length > 6) throw new ActionError('INVALID', 'Choose between 1 and 6 children.');
  const payer = await profileOf(input.uid);
  const gate = purchaseGate({ ageTier: payer.ageTier, role: payer.role, dateOfBirth: payer.dateOfBirth, now: new Date() });
  if (!gate.ok) throw new ActionError('MINOR', gate.reason);
  const {
    assertGuardian, loadFamilyRates, loadPlanPrice, seatCoverage,
  } = await import('../../billing/store');
  const { quoteFamily, parentPayDecision, withinSpendingCap } = await import('../../billing/model');
  await assertGuardian(input.uid, lines.map((line) => line.uid));
  const interval = input.interval === 'year' ? 'year' : 'month';
  const priced = [];
  for (const line of lines) {
    const price = await loadPlanPrice(line.tierId, interval);
    if (!price) throw new ActionError('INVALID', 'That plan has no config price yet.');
    const seat = await seatCoverage(line.uid);
    const decision = parentPayDecision({ seatActive: seat.seatActive, seatTier: seat.seatTier, requestedTier: price.accessTier });
    if (decision.action === 'block') throw new ActionError('DUPLICATE_SEAT', decision.reason);
    if (decision.action === 'warn' && !input.acknowledgeWarning) throw new ActionError('DUPLICATE_WARN', decision.reason);
    priced.push({ uid: line.uid, tierId: line.tierId, accessTier: price.accessTier, listUsd: price.listUsd });
  }
  const family = quoteFamily(priced, await loadFamilyRates());
  const sub = await db().doc(`subscriptions/sub_${input.uid}`).get();
  const spendingCap = typeof sub.data()?.spendingCapUsd === 'number' ? sub.data()?.spendingCapUsd as number : null;
  if (!withinSpendingCap(family.subtotalUsd, spendingCap)) {
    throw new ActionError('SPENDING_CAP', 'This checkout is above the spending cap.');
  }
  const country = (input.country || 'MY').toUpperCase();
  const item: PricedItem = {
    kind: 'subscription',
    sku: 'family',
    title: `Poket School family plan`,
    unitAmount: family.subtotalUsd,
    currency: 'USD',
    interval,
    accessTier: Math.max(...family.lines.map((line) => line.accessTier)),
  };
  const settings = await loadSettings();
  const quote = buildQuote({ item, seats: 1, country, tax: taxFrom(settings) });
  const method = canonicalMethod(input.method || 'card') as MethodId;
  const available = methodsFor({ country, currency: quote.currency, overrides: settings.flags });
  if (!available.some((row) => row.id === method)) throw new ActionError('INVALID', 'That payment method is not available for this country and currency.');
  const provider = providerForMethod(method);
  if (!provider || provider === 'wallet') throw new ActionError('INVALID', 'Choose card, FPX, or Touch \'n Go.');
  const id = checkoutIdFor(input.uid, input.idempotencyKey || `family:${lines.map((line) => line.uid).join(',')}:${interval}`);
  const buyerName = str(payer.name) || 'Parent';
  const done = safeReturn(input.origin, input.successPath, '/dashboard/parent/billing?paid=1');
  const cancel = safeReturn(input.origin, input.cancelPath, '/dashboard/parent/billing');
  const secrets = await gatewaySecrets();
  const stripeSecret = await secretValue('stripe_secret');
  let mode: ProviderMode = 'mock';
  let url: string | undefined;
  const extraMetadata = {
    kind: 'family_plan',
    checkoutId: id,
    uid: input.uid,
    payerUid: input.uid,
    beneficiary_uids: lines.map((line) => line.uid).join(','),
    beneficiaries: lines.map((line) => line.uid).join(','),
  };
  if (provider === 'stripe') {
    mode = stripeMode(stripeSecret);
    if (mode !== 'mock' && stripeSecret) {
      url = await stripeSession({
        secret: stripeSecret,
        quote,
        checkoutId: id,
        email: input.email,
        method,
        uid: input.uid,
        done,
        cancel,
        extraMetadata,
        forcePayment: method !== 'card',
      });
    }
  } else {
    mode = gatewayMode(settings.gateway, secrets, settings.gatewayExplicit);
    if (mode !== 'mock') {
      const hosted = await gatewaySession({
        vendor: settings.gateway, secrets, quote, checkoutId: id, method, email: input.email,
        name: buyerName, origin: input.origin, mode, done,
      });
      url = hosted.url;
    }
  }
  if (mode === 'mock') {
    return { checkoutId: id, mode, sandbox: false, available: false, alreadyPaid: false, amount: quote.total, currency: quote.currency, message: 'Payments are coming soon.' };
  }
  await db().doc(`checkouts/${id}`).set({
    userId: input.uid,
    email: input.email ?? '',
    buyerName,
    quote,
    method,
    provider,
    providerMode: mode,
    status: 'pending',
    childIds: lines.map((line) => line.uid),
    familyLines: family.lines,
    familyPlaceholder: true,
    url: url ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { checkoutId: id, mode, url, sandbox: false, alreadyPaid: false, amount: quote.total, currency: quote.currency, placeholderDiscount: true };
}

async function stripeSession(input: {
  secret: string; quote: Quote; checkoutId: string; email?: string; method: string; uid: string; done: string; cancel: string;
  extraMetadata?: Record<string, string>;
  forcePayment?: boolean;
}): Promise<string> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(input.secret);
  const subscription = !input.forcePayment && (input.quote.kind === 'subscription' || input.quote.kind === 'reads');
  const types = stripeTypesForCharge(input.method, input.quote.currency, input.quote.kind);
  const session = await stripe.checkout.sessions.create({
    mode: subscription ? 'subscription' : 'payment',
    customer_email: input.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: input.quote.currency.toLowerCase(),
        unit_amount: toMinor(input.quote.total),
        product_data: {
          name: input.quote.tax > 0 ? `${input.quote.title} (incl. SST)` : input.quote.title,
          ...(input.quote.highlights?.length ? { description: input.quote.highlights.join(' · ') } : {}),
        },
        ...(subscription ? { recurring: { interval: input.quote.interval === 'year' ? 'year' : 'month' } } : {}),
      },
    }],
    metadata: {
      checkoutId: input.checkoutId,
      kind: input.extraMetadata?.kind || (input.quote.kind === 'reads' ? 'plan' : input.quote.kind),
      id: input.quote.sku,
      bookId: input.quote.shelf ? input.quote.sku : '',
      studentId: input.uid,
      uid: input.uid,
      ...input.extraMetadata,
    },
    ...(subscription ? { subscription_data: { metadata: { checkoutId: input.checkoutId, uid: input.uid, accessTier: String(input.quote.accessTier ?? ''), ...input.extraMetadata } } } : {}),
    ...(!subscription ? { payment_intent_data: { metadata: { checkoutId: input.checkoutId } } } : {}),
    ...(types !== 'dynamic' && !subscription
      ? { payment_method_types: types as Array<'card' | 'fpx' | 'grabpay'> }
      : {}),
    success_url: input.done,
    cancel_url: input.cancel,
  });
  if (!session.url) throw new ActionError('PROVIDER', 'Stripe did not return a checkout page.');
  return session.url;
}

async function gatewaySession(input: {
  vendor: GatewayVendor;
  secrets: Awaited<ReturnType<typeof gatewaySecrets>>;
  quote: Quote;
  checkoutId: string;
  method: string;
  email?: string;
  name: string;
  origin: string;
  mode: ProviderMode;
  done: string;
}): Promise<{ url?: string; postUrl?: string; fields?: Record<string, string> }> {
  if (input.quote.currency !== 'MYR') throw new ActionError('INVALID', 'This gateway charges in Malaysian ringgit.');
  if (input.vendor === 'billplz') {
    const host = input.mode === 'live' ? 'https://www.billplz.com' : 'https://www.billplz-sandbox.com';
    const body = new URLSearchParams({
      collection_id: input.secrets.billplzCollectionId ?? '',
      email: input.email || 'learner@poketschool.ai',
      name: input.name,
      amount: String(toMinor(input.quote.total)),
      description: input.quote.title.slice(0, 200),
      callback_url: `${input.origin}/api/payments/webhook/gateway`,
      redirect_url: input.done,
      reference_1_label: 'Checkout',
      reference_1: input.checkoutId,
    });
    const response = await fetch(`${host}/api/v3/bills`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.secrets.billplzApiKey}:`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const payload = await response.json().catch(() => ({})) as { url?: string; error?: { message?: string } };
    if (!response.ok || !payload.url) {
      throw new ActionError('PROVIDER', payload.error?.message || 'Billplz did not start the payment.');
    }
    return { url: payload.url };
  }
  if (input.vendor === 'ipay88') {
    const amount = ipay88Amount(input.quote.total);
    const paymentId = IPAY88_IDS[input.method] || process.env.IPAY88_DUITNOW_PAYMENT_ID || '';
    const fields: Record<string, string> = {
      MerchantCode: input.secrets.ipay88MerchantCode ?? '',
      PaymentId: paymentId,
      RefNo: input.checkoutId,
      Amount: input.quote.total.toFixed(2),
      Currency: 'MYR',
      ProdDesc: input.quote.title.slice(0, 100),
      UserName: input.name,
      UserEmail: input.email || 'learner@poketschool.ai',
      Signature: ipay88Signature({
        merchantKey: input.secrets.ipay88MerchantKey ?? '',
        merchantCode: input.secrets.ipay88MerchantCode ?? '',
        paymentId,
        refNo: input.checkoutId,
        amount,
        currency: 'MYR',
      }),
      ResponseURL: input.done,
      BackendURL: `${input.origin}/api/payments/webhook/gateway`,
    };
    return { postUrl: 'https://payment.ipay88.com.my/ePayment/entry.asp', fields };
  }
  const host = input.mode === 'live' ? 'https://pay.merchant.razer.com' : 'https://sandbox.merchant.razer.com';
  return {
    postUrl: `${host}/RMS/pay/${input.secrets.rmsMerchantId}/`,
    fields: {
      amount: input.quote.total.toFixed(2),
      orderid: input.checkoutId,
      bill_name: input.name,
      bill_email: input.email || 'learner@poketschool.ai',
      bill_desc: input.quote.title.slice(0, 100),
      currency: 'MYR',
      returnurl: input.done,
      callbackurl: `${input.origin}/api/payments/webhook/gateway`,
    },
  };
}

async function moveWallet(uid: string, currency: string, deltaMinor: number, entryId: string): Promise<void> {
  const ref = db().doc(`wallets/${uid}`);
  const ledger = db().doc(`wallets/${uid}/ledger/${entryId}`);
  await db().runTransaction(async (tx) => {
    const [wallet, entry] = await Promise.all([tx.get(ref), tx.get(ledger)]);
    if (entry.exists) return;
    const balances = (wallet.data()?.balances ?? {}) as Record<string, number>;
    const current = Number(balances[currency] ?? 0);
    if (deltaMinor < 0 && current + deltaMinor < 0) {
      throw new ActionError('INSUFFICIENT_WALLET', 'Your wallet does not cover this.');
    }
    tx.set(ref, { [`balances.${currency}`]: current + deltaMinor, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(ledger, { amountMinor: deltaMinor, currency, createdAt: FieldValue.serverTimestamp() });
  });
}

async function debitWallet(uid: string, currency: string, amount: number, checkoutId: string) {
  await moveWallet(uid, currency, -toMinor(amount), checkoutId);
}

function fulfillmentFrom(checkout: CheckoutDoc, provider: string, providerRef?: string): FulfillmentInput {
  const quote = checkout.quote;
  return {
    checkoutId: checkout.id,
    userId: checkout.userId,
    buyerName: checkout.buyerName,
    kind: quote.kind,
    sku: quote.sku,
    title: quote.title,
    currency: quote.currency,
    total: quote.total,
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
    taxRate: quote.taxRate,
    accessTier: quote.accessTier,
    sparks: quote.sparks,
    seats: quote.seats,
    childIds: checkout.childIds,
    ownerId: quote.ownerId,
    teacherShareBps: quote.teacherShareBps,
    affiliateId: quote.affiliateId,
    commission: quote.commission,
    couponCode: quote.couponCode,
    interval: quote.interval,
    recurringMonthly: quote.recurringMonthly,
    shelf: quote.shelf,
    permission: quote.permission,
    provider,
    providerRef,
  };
}

async function claim(provider: string, eventId: string): Promise<'process' | 'skip'> {
  const id = eventDocId(provider, eventId);
  const ref = db().doc(`payment_events/${id}`);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const existing = data
      ? { status: data.status as 'processing' | 'processed' | 'error', at: Number(data.at ?? 0) }
      : null;
    const decision = claimDecision(existing, Date.now());
    if (decision === 'skip') return 'skip';
    tx.set(ref, { status: 'processing', at: Date.now(), provider, eventId });
    return 'process';
  });
}

async function finishClaim(provider: string, eventId: string, status: 'processed' | 'error') {
  await db().doc(`payment_events/${eventDocId(provider, eventId)}`).set({ status, at: Date.now() }, { merge: true });
}

export async function fulfillCheckout(checkoutId: string, source: {
  eventId: string;
  provider: string;
  providerRef?: string;
  paymentIntentId?: string;
  currentPeriodEnd?: number;
  customerId?: string;
  subscriptionId?: string;
}) {
  const decision = await claim(source.provider, source.eventId);
  if (decision === 'skip') return { duplicate: true };
  try {
    const snap = await db().doc(`checkouts/${checkoutId}`).get();
    if (!snap.exists) throw new ActionError('NOT_FOUND', 'Checkout not found.');
    const checkout = asCheckout(checkoutId, snap.data() ?? {});
    if (checkout.status === 'paid') {
      await finishClaim(source.provider, source.eventId, 'processed');
      return { duplicate: true };
    }
    const plan = fulfillmentFrom(checkout, source.provider, source.providerRef);
    const familyLines = Array.isArray(snap.data()?.familyLines) ? snap.data()?.familyLines as {
      uid: string; tierId: string; accessTier: number; listUsd: number; chargeUsd: number; off: number;
    }[] : [];
    if (familyLines.length > 0) {
      const { applyFamilyPurchase } = await import('../../billing/store');
      const { periodEndFrom } = await import('../../billing/model');
      const interval = checkout.quote.interval === 'year' ? 'year' : 'month';
      await applyFamilyPurchase({
        payerUid: checkout.userId,
        lines: familyLines,
        source: 'stripe',
        externalId: source.subscriptionId || source.providerRef || checkout.id,
        currentPeriodEnd: source.currentPeriodEnd || periodEndFrom(Date.now(), interval),
        stripeCustomerId: source.customerId,
        checkoutId: checkout.id,
        currency: checkout.quote.currency,
        total: checkout.quote.total,
        interval,
      });
    } else {
      for (const grant of planGrants(plan)) await applyGrant(grant, checkout, false);
    }
    const invoiceId = plan.kind === 'invoice' ? plan.sku : checkoutId;
    if (plan.kind !== 'invoice') await writePaidInvoice(checkout, invoiceId);
    await db().doc(`transactions/${checkoutId}`).set({
      userId: checkout.userId, kind: plan.kind, title: plan.title, currency: plan.currency,
      subtotal: plan.subtotal, discount: plan.discount, tax: plan.tax, total: plan.total,
      status: 'paid', provider: source.provider, providerRef: source.providerRef ?? null,
      invoiceId, createdAt: FieldValue.serverTimestamp(),
    });
    if (plan.couponCode) {
      await db().doc(`coupons/${plan.couponCode}`).set({ redemptions: FieldValue.increment(1) }, { merge: true });
    }
    await db().doc(`checkouts/${checkoutId}`).set({
      status: 'paid', providerRef: source.providerRef ?? null, paymentIntentId: source.paymentIntentId ?? null,
      paidAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (source.paymentIntentId) {
      await db().doc(`payment_links/${source.paymentIntentId}`).set({ checkoutId });
    }
    await finishClaim(source.provider, source.eventId, 'processed');
    await noteWebhook(source.provider === 'stripe' ? 'stripe' : 'gateway', true, source.eventId).catch(() => undefined);
    return { duplicate: false, invoiceId };
  } catch (error) {
    await finishClaim(source.provider, source.eventId, 'error').catch(() => undefined);
    throw error;
  }
}

async function writePaidInvoice(checkout: CheckoutDoc, invoiceId: string) {
  const quote = checkout.quote;
  const myInvois = buildMyInvois({
    currency: quote.currency,
    description: quote.title,
    taxExclusive: quote.subtotal - quote.discount,
    tax: quote.tax,
    buyer: { name: checkout.buyerName, email: checkout.email },
    config: taxFrom(await loadSettings()),
  });
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await db().doc(`invoices/${invoiceId}`).set({
    studentId: checkout.userId,
    studentName: checkout.buyerName,
    courseId: quote.kind === 'course' || quote.kind === 'book' ? quote.sku : null,
    description: quote.title,
    amount: quote.total,
    currency: quote.currency,
    status: 'paid',
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
    taxRate: quote.taxRate,
    taxLabel: 'SST',
    myInvois,
    receiptNumber: `PS-${day}-${checkout.id.slice(-6).toUpperCase()}`,
    checkoutId: checkout.id,
    paidAt: FieldValue.serverTimestamp(),
    createdBy: quote.ownerId || 'platform',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  try {
    const { enqueuePaidInvoice } = await import('./myinvois-queue');
    await enqueuePaidInvoice(invoiceId, myInvois);
  } catch (error) {
    console.error('MyInvois queue skipped', error);
  }
}

async function applyGrant(grant: PlannedGrant, checkout: CheckoutDoc, reversing: boolean): Promise<void> {
  const quote = checkout.quote;
  if (grant.action === 'set_subscription' && grant.userId) {
    const tier = (grant.accessTier ?? 0) as AccessTier;
    await applyStripeSubscription(grant.userId, tier);
    const primary = grant.userId === checkout.userId;
    await db().doc(`subscriptions/${grant.userId}`).set({
      userId: grant.userId,
      accessTier: tier,
      status: tier === 0 ? 'canceled' : primary ? 'active' : 'family',
      monthlyRecurring: primary && tier > 0 ? quote.recurringMonthly ?? 0 : 0,
      currency: quote.currency,
      seats: quote.seats,
      interval: quote.interval ?? null,
      checkoutId: checkout.id,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  if (grant.action === 'grant_sparks' && grant.userId && grant.sparks) {
    const marker = db().doc(`users/${grant.userId}/spark_purchases/${checkout.id}_${grant.sparks > 0 ? 'buy' : 'refund'}`);
    const seen = await marker.get();
    if (seen.exists) return;
    await grantPurchasedSparks(grant.userId, grant.sparks, grant.title);
    await marker.set({ sparks: grant.sparks, createdAt: FieldValue.serverTimestamp() });
    return;
  }
  if (grant.action === 'grant_library' && grant.bookId) {
    await db().doc(`users/${checkout.userId}`).set({
      permissions: FieldValue.arrayUnion(`alloc:marketplace:${grant.bookId}`),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db().doc(`library/${checkout.userId}/books/${grant.bookId}`).set({
      bookId: grant.bookId,
      source: 'purchase',
      title: grant.title,
      purchasedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  if (grant.action === 'revoke_library' && grant.bookId) {
    await db().doc(`users/${checkout.userId}`).set({
      permissions: FieldValue.arrayRemove(`alloc:marketplace:${grant.bookId}`),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db().doc(`library/${checkout.userId}/books/${grant.bookId}`).set({
      source: 'refunded', refundedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  if (grant.action === 'grant_reads' && grant.userId) {
    const tier = (grant.accessTier ?? 1) as AccessTier;
    await applyStripeSubscription(grant.userId, tier);
    await db().doc(`users/${grant.userId}`).set({
      permissions: FieldValue.arrayUnion(grant.permission || 'plan:reads'),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db().doc(`subscriptions/${grant.userId}`).set({
      userId: grant.userId,
      accessTier: tier,
      status: 'active',
      sku: checkout.quote.sku,
      monthlyRecurring: checkout.quote.recurringMonthly ?? 0,
      currency: checkout.quote.currency,
      interval: checkout.quote.interval ?? null,
      checkoutId: checkout.id,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  if (grant.action === 'revoke_reads' && grant.userId) {
    if (grant.permission) {
      await db().doc(`users/${grant.userId}`).set({
        permissions: FieldValue.arrayRemove(grant.permission),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const sub = await db().doc(`subscriptions/${grant.userId}`).get();
    if (str(sub.data()?.checkoutId) === checkout.id) {
      await applyStripeSubscription(grant.userId, 0);
      await db().doc(`subscriptions/${grant.userId}`).set({
        status: 'canceled', monthlyRecurring: 0, updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return;
  }
  if (grant.action === 'enroll_course' && grant.courseId) {
    await enrollFromPayment({
      studentId: checkout.userId, courseId: grant.courseId, amount: quote.total,
      currency: quote.currency, description: quote.title, skipInvoice: true,
    });
    return;
  }
  if (grant.action === 'revoke_course' && grant.courseId) {
    await db().doc(`users/${checkout.userId}`).set({
      permissions: FieldValue.arrayRemove(`alloc:marketplace:${grant.courseId}`),
    }, { merge: true });
    await db().doc(`courses/${grant.courseId}/enrollments/${checkout.userId}`).set({ status: 'refunded' }, { merge: true });
    return;
  }
  if (grant.action === 'record_booking') {
    await db().doc(`bookings/${checkout.id}`).set({
      studentId: checkout.userId, offerId: quote.sku, tutorId: quote.ownerId ?? null,
      title: quote.title, amount: quote.total, currency: quote.currency, status: 'paid',
      createdAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  if (grant.action === 'cancel_booking') {
    await db().doc(`bookings/${checkout.id}`).set({ status: 'refunded' }, { merge: true });
    return;
  }
  if (grant.action === 'record_resource' && grant.resourceId) {
    await db().doc(`resource_purchases/${checkout.userId}_${grant.resourceId}`).set({
      userId: checkout.userId, resourceId: grant.resourceId, checkoutId: checkout.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    await db().doc(`users/${checkout.userId}`).set({
      permissions: FieldValue.arrayUnion(`alloc:resource:${grant.resourceId}`),
    }, { merge: true });
    return;
  }
  if (grant.action === 'revoke_resource' && grant.resourceId) {
    await db().doc(`users/${checkout.userId}`).set({
      permissions: FieldValue.arrayRemove(`alloc:resource:${grant.resourceId}`),
    }, { merge: true });
    return;
  }
  if (grant.action === 'credit_wallet') {
    await moveWallet(checkout.userId, quote.currency, toMinor(quote.total), `credit_${checkout.id}`);
    return;
  }
  if (grant.action === 'debit_wallet') {
    await moveWallet(checkout.userId, quote.currency, -toMinor(quote.total), `debit_${checkout.id}`);
    return;
  }
  if (grant.action === 'mark_invoice' && grant.invoiceId) {
    await db().doc(`invoices/${grant.invoiceId}`).set({ status: 'paid', paidAt: FieldValue.serverTimestamp(), checkoutId: checkout.id }, { merge: true });
    return;
  }
  if (grant.action === 'refund_invoice' && grant.invoiceId) {
    await db().doc(`invoices/${grant.invoiceId}`).set({ status: 'cancelled', refunded: true }, { merge: true });
    return;
  }
  if ((grant.action === 'affiliate' || grant.action === 'reverse_affiliate') && grant.affiliateId) {
    await db().doc(`affiliate_ledger/${checkout.id}`).set({
      affiliateId: grant.affiliateId, amount: grant.amount ?? 0, currency: quote.currency,
      status: reversing || grant.action === 'reverse_affiliate' ? 'reversed' : 'earned',
      title: grant.title, checkoutId: checkout.id, createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }
  if ((grant.action === 'payout' || grant.action === 'reverse_payout') && grant.payeeId) {
    await db().doc(`payouts/${checkout.id}`).set({
      payeeId: grant.payeeId, amount: grant.amount ?? 0, currency: quote.currency,
      status: grant.action === 'reverse_payout' ? 'reversed' : 'awaiting_connect',
      title: grant.title, checkoutId: checkout.id, createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (grant.action === 'payout') await maybeTransfer(checkout, grant.payeeId, grant.amount ?? 0, quote.currency);
    return;
  }
  if (grant.action === 'notify' && grant.userId && grant.message) {
    await sendNotification(grant.userId, grant.title, grant.message, grant.link);
  }
}

async function maybeTransfer(checkout: CheckoutDoc, payeeId: string, amount: number, currency: string) {
  const settings = await loadSettings();
  if (!settings.flags['payments.stripe_connect']) return;
  const payee = await db().doc(`users/${payeeId}`).get();
  const account = str(payee.data()?.stripeAccountId);
  const secret = await secretValue('stripe_secret');
  if (!account || account.startsWith('acct_mock_') || stripeMode(secret) === 'mock' || !secret) return;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(secret);
    await stripe.transfers.create({
      amount: toMinor(amount),
      currency: currency.toLowerCase(),
      destination: account,
      transfer_group: checkout.id,
    }, { idempotencyKey: `transfer_${checkout.id}` });
    await db().doc(`payouts/${checkout.id}`).set({ status: 'transferred' }, { merge: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transfer failed';
    await db().doc(`payouts/${checkout.id}`).set({ status: 'transfer_failed', detail: message.slice(0, 240) }, { merge: true });
  }
}

export async function completeSandbox(uid: string, checkoutId: string) {
  if (process.env.PAYMENTS_SANDBOX !== '1') {
    throw new ActionError('UNAVAILABLE', 'Payments are coming soon.');
  }
  const snap = await db().doc(`checkouts/${checkoutId}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Checkout not found.');
  const checkout = asCheckout(checkoutId, snap.data() ?? {});
  if (checkout.userId !== uid) throw new ActionError('FORBIDDEN', 'That checkout belongs to someone else.');
  if (checkout.providerMode !== 'mock') throw new ActionError('FORBIDDEN', 'Sandbox completion is only for checkouts with no live keys.');
  if (checkout.status === 'paid') return { alreadyPaid: true, checkoutId };
  await fulfillCheckout(checkoutId, { eventId: `sandbox:${checkoutId}`, provider: checkout.provider || 'mock' });
  return { alreadyPaid: false, checkoutId };
}

export async function applyReversal(checkoutId: string, eventId: string) {
  const decision = await claim('refund', eventId);
  if (decision === 'skip') return { duplicate: true };
  const snap = await db().doc(`checkouts/${checkoutId}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Checkout not found.');
  const checkout = asCheckout(checkoutId, snap.data() ?? {});
  if (checkout.status === 'refunded') {
    await finishClaim('refund', eventId, 'processed');
    return { duplicate: true };
  }
  const plan = fulfillmentFrom(checkout, checkout.provider);
  for (const grant of planReversal(plan)) await applyGrant(grant, checkout, true);
  await db().doc(`checkouts/${checkoutId}`).set({ status: 'refunded', refundedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db().doc(`transactions/${checkoutId}`).set({ status: 'refunded' }, { merge: true });
  await db().doc(`invoices/${checkout.quote.kind === 'invoice' ? checkout.quote.sku : checkoutId}`).set({
    status: 'cancelled', refunded: true,
  }, { merge: true });
  await finishClaim('refund', eventId, 'processed');
  return { duplicate: false };
}

export async function refundCheckout(
  actorUid: string,
  checkoutId: string,
  claims?: { email?: string | null; role?: string | null; adminRole?: string | null },
) {
  const actor = await profileOf(actorUid);
  if (roleForServerCheck(claims ?? {}, actor.role as string | undefined) !== 'admin') {
    throw new ActionError('FORBIDDEN', 'Only a super admin can refund.');
  }
  const snap = await db().doc(`checkouts/${checkoutId}`).get();
  if (!snap.exists) throw new ActionError('NOT_FOUND', 'Checkout not found.');
  const checkout = asCheckout(checkoutId, snap.data() ?? {});
  if (checkout.status !== 'paid') throw new ActionError('INVALID', 'Only a paid checkout can be refunded.');
  if (checkout.provider === 'stripe' && checkout.providerMode !== 'mock' && checkout.paymentIntentId) {
    const secret = await secretValue('stripe_secret');
    if (!secret) throw new ActionError('PROVIDER', 'Stripe is not configured.');
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(secret);
    await stripe.refunds.create({ payment_intent: checkout.paymentIntentId }, { idempotencyKey: `refund_${checkoutId}` });
  } else if (checkout.provider === 'my_gateway' && checkout.providerMode !== 'mock') {
    await db().doc(`refund_requests/${checkoutId}`).set({
      checkoutId, amount: checkout.quote.total, currency: checkout.quote.currency,
      status: 'requested', createdAt: FieldValue.serverTimestamp(),
    });
    return { status: 'requested', message: 'The refund is recorded. Complete it in the gateway dashboard. Entitlements stay until you mark the sandbox or Stripe refund.' };
  }
  await applyReversal(checkoutId, `admin:${checkoutId}`);
  return { status: 'refunded' };
}

export async function walletView(uid: string) {
  const snap = await db().doc(`wallets/${uid}`).get();
  const balances = (snap.data()?.balances ?? {}) as Record<string, number>;
  const ledger = await db().collection(`wallets/${uid}/ledger`).limit(20).get();
  return {
    balances: {
      USD: Number(balances.USD ?? 0) / 100,
      MYR: Number(balances.MYR ?? 0) / 100,
    },
    ledger: ledger.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, amountMinor: Number(data.amountMinor ?? 0), currency: str(data.currency) };
    }),
  };
}

export async function connectOnboarding(uid: string, email: string | undefined, origin: string) {
  const settings = await loadSettings();
  if (!settings.flags['payments.stripe_connect']) throw new ActionError('FORBIDDEN', 'Payouts are switched off.');
  const secret = await secretValue('stripe_secret');
  const mode = stripeMode(secret);
  if (mode === 'mock') {
    await db().doc(`users/${uid}`).set({ stripeAccountId: `acct_mock_${uid.slice(0, 8)}` }, { merge: true });
    return { mode, message: 'Sandbox payout account linked. Nothing is sent to a bank until a Stripe secret key is saved.' };
  }
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(secret!);
  const user = await db().doc(`users/${uid}`).get();
  let accountId = str(user.data()?.stripeAccountId);
  if (!accountId || accountId.startsWith('acct_mock_')) {
    const account = await stripe.accounts.create({
      type: 'express', email, capabilities: { transfers: { requested: true } }, metadata: { uid },
    });
    accountId = account.id;
    await db().doc(`users/${uid}`).set({ stripeAccountId: accountId }, { merge: true });
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/teacher/earnings?connect=refresh`,
    return_url: `${origin}/dashboard/teacher/earnings?connect=return`,
    type: 'account_onboarding',
  });
  return { mode, url: link.url };
}

export async function createOffer(uid: string, body: { title?: string; price?: number; currency?: string; minutes?: number }) {
  const payer = await profileOf(uid);
  if (payer.role !== 'teacher' && payer.role !== 'admin') throw new ActionError('FORBIDDEN', 'Only a teacher can offer a session.');
  const title = str(body.title).trim();
  const price = Number(body.price);
  const currency = (str(body.currency) || 'USD').toUpperCase();
  if (!title) throw new ActionError('INVALID', 'Name the session.');
  if (!Number.isFinite(price) || price <= 0) throw new ActionError('INVALID', 'Set a price.');
  if (currency !== 'USD' && currency !== 'MYR') throw new ActionError('INVALID', 'Price the session in USD or MYR.');
  const ref = await db().collection('tutor_offers').add({
    tutorId: uid, title, price, currency, minutes: Number(body.minutes) || 60, active: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function referralState(
  uid: string,
  name: string,
  create: boolean,
  promo?: { item?: string; kind?: string; percentOff?: number; quantityLimit?: number; expiresAt?: string },
) {
  const settings = await loadSettings();
  if (!settings.flags['payments.affiliates']) return { enabled: false, code: null, ledger: [], total: 0, clicks: 0, conversions: 0 };
  const existing = await db().collection('coupons').where('affiliateId', '==', uid).limit(1).get();
  let code = existing.empty ? null : existing.docs[0].id;
  let percentOff = existing.empty ? 10 : Number(existing.docs[0].data().percentOff ?? 10);
  if (!code && create) {
    code = referralCode(name || 'Poket', uid.slice(0, 4));
    percentOff = 10;
    await db().doc(`coupons/${code}`).set({
      code, percentOff, affiliateId: uid, revenueShareBps: settings.affiliateShareBps,
      active: true, redemptions: 0, clicks: 0, createdAt: FieldValue.serverTimestamp(),
    });
  }
  if (code && promo?.item) {
    const parsed = parsePromo(promo);
    if (!parsed.ok) throw new ActionError('INVALID', parsed.error);
    percentOff = parsed.promo.percentOff;
    await db().doc(`coupons/${code}`).set({
      item: parsed.promo.item,
      kind: parsed.promo.kind,
      percentOff: parsed.promo.percentOff,
      maxRedemptions: parsed.promo.quantityLimit,
      expiresAt: parsed.promo.expiresAt,
      banner: true,
    }, { merge: true });
  }
  const coupon = code ? (await db().doc(`coupons/${code}`).get()).data() : undefined;
  const ledger = code
    ? await db().collection('affiliate_ledger').where('affiliateId', '==', uid).limit(30).get()
    : null;
  const rows = ledger?.docs.map((doc) => doc.data()) ?? [];
  const total = rows.filter((row) => row.status === 'earned').reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const awaiting = rows.filter((row) => row.status === 'awaiting_connect').reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return {
    enabled: true,
    code,
    percentOff: Number(coupon?.percentOff ?? percentOff),
    shareBps: settings.affiliateShareBps,
    total,
    awaiting,
    clicks: Number(coupon?.clicks ?? 0),
    conversions: Number(coupon?.redemptions ?? 0),
    item: str(coupon?.item),
    kind: str(coupon?.kind),
    quantityLimit: Number(coupon?.maxRedemptions ?? 0),
    expiresAt: str(coupon?.expiresAt),
    shortPath: code ? `/r/${code}` : null,
    ledger: rows,
  };
}

export async function recordReferralClick(code: string) {
  const normalised = normaliseCode(code);
  if (normalised.length < 4) return { ok: false };
  const ref = db().doc(`coupons/${normalised}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.active === false) return { ok: false };
  await ref.set({ clicks: FieldValue.increment(1) }, { merge: true });
  return { ok: true, code: normalised };
}

export async function activePromoBanners(today = new Date().toISOString().slice(0, 10)) {
  const snap = await db().collection('coupons').where('banner', '==', true).limit(12).get();
  const rows: PromoDraft[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      item: str(data.item),
      kind: data.kind === 'programme' || data.kind === 'book' ? data.kind : 'course',
      percentOff: Number(data.percentOff ?? 0),
      quantityLimit: Number(data.maxRedemptions ?? 0),
      redeemed: Number(data.redemptions ?? 0),
      endsAt: str(data.expiresAt),
      banner: true,
      active: data.active !== false,
      code: doc.id,
    } as PromoDraft & { code: string };
  });
  return rows
    .filter((row) => promoLive(row, today))
    .map((row) => ({
      code: (row as PromoDraft & { code: string }).code,
      item: row.item,
      kind: row.kind,
      percentOff: row.percentOff,
      remaining: Math.max(0, row.quantityLimit - row.redeemed),
      endsAt: row.endsAt,
    }));
}

export async function recordDispute(input: { disputeId: string; amount: number; currency: string; reason: string; chargeId: string }) {
  await db().doc(`disputes/${input.disputeId}`).set({ ...input, status: 'open', createdAt: FieldValue.serverTimestamp() }, { merge: true });
}

/** Sessions created by the Reads client before they carried a checkout id. */
export async function grantLegacyBook(input: { eventId: string; studentId: string; bookId: string }) {
  const decision = await claim('stripe', input.eventId);
  if (decision === 'skip') return { duplicate: true };
  await db().doc(`users/${input.studentId}`).set({
    permissions: FieldValue.arrayUnion(`alloc:marketplace:${input.bookId}`),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db().doc(`library/${input.studentId}/books/${input.bookId}`).set({
    bookId: input.bookId,
    source: 'purchase',
    purchasedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await finishClaim('stripe', input.eventId, 'processed');
  return { duplicate: false };
}

export async function grantLegacyReads(input: { eventId: string; uid: string; planId: string }) {
  const decision = await claim('stripe', input.eventId);
  if (decision === 'skip') return { duplicate: true };
  const permission = input.planId === 'reads-family' ? 'plan:reads-family' : 'plan:reads';
  await applyStripeSubscription(input.uid, 1);
  await db().doc(`users/${input.uid}`).set({
    permissions: FieldValue.arrayUnion(permission),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await finishClaim('stripe', input.eventId, 'processed');
  return { duplicate: false };
}

export async function endSubscription(uid: string | undefined, subscriptionId: string) {
  if (!uid) return;
  const snap = await db().doc(`subscriptions/${uid}`).get();
  const current = str(snap.data()?.stripeSubscriptionId);
  if (current && current !== subscriptionId) return;
  await applyStripeSubscription(uid, 0);
  await db().doc(`subscriptions/${uid}`).set({ status: 'canceled', monthlyRecurring: 0, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function paymentsAdmin() {
  const [settings, secrets, health] = await Promise.all([loadSettings(), secretViews(), webhookHealth()]);
  const preview = (country: string, currency: string) =>
    methodsFor({ country, currency, overrides: settings.flags }).map((method) => method.label);
  return {
    stripeMode: stripeMode(await secretValue('stripe_secret')),
    gateway: settings.gateway,
    gatewayMode: gatewayMode(settings.gateway, await gatewaySecrets(), settings.gatewayExplicit),
    flags: settings.flags,
    tax: { sstRate: settings.sstRate, tin: settings.tin, brn: settings.brn, classification: settings.classification },
    commission: { teacherShareBps: settings.teacherShareBps, affiliateShareBps: settings.affiliateShareBps },
    methods: { myMyr: preview('MY', 'MYR'), myUsd: preview('MY', 'USD'), usUsd: preview('US', 'USD') },
    webhook: health,
    endpoints: { stripe: '/api/stripe/webhook', gateway: '/api/payments/webhook/gateway' },
    secrets: secrets.filter((slot) => slot.group === 'payments' || slot.group === 'tax'),
    missing: missingRequired(secrets),
  };
}

export async function integrationsAdmin() {
  const [settings, secrets] = await Promise.all([loadSettings(), secretViews()]);
  return {
    flags: settings.flags,
    caps: {
      openrouterCapUsd: settings.openrouterCapUsd,
      geminiCapUsd: settings.geminiCapUsd,
      openrouterSpentUsd: settings.openrouterSpentUsd,
      geminiSpentUsd: settings.geminiSpentUsd,
    },
    secrets: secrets.filter((slot) => slot.group !== 'payments'),
    missing: missingRequired(secrets),
  };
}

export async function financeAdmin() {
  const [subs, transactions, disputes, payouts] = await Promise.all([
    db().collection('subscriptions').where('status', '==', 'active').limit(500).get(),
    db().collection('transactions').orderBy('createdAt', 'desc').limit(40).get(),
    db().collection('disputes').limit(20).get(),
    db().collection('payouts').limit(20).get(),
  ]);
  const subRows = subs.docs.map((doc) => ({ status: 'active', monthlyRecurring: Number(doc.data().monthlyRecurring ?? 0) }));
  const tx = transactions.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return {
    summary: summariseFinance(subRows),
    reconciliation: reconcile(tx.map((row) => ({ invoiceId: (row as { invoiceId?: string }).invoiceId }))),
    transactions: tx,
    disputes: disputes.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    payouts: payouts.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

export async function updatePayments(body: Record<string, unknown>) {
  const action = str(body.action);
  if (action === 'flags' && body.overrides && typeof body.overrides === 'object') {
    const overrides: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(body.overrides as Record<string, unknown>)) {
      if (typeof value === 'boolean') overrides[key] = value;
    }
    await saveFlagOverrides(overrides);
    return { ok: true };
  }
  if (action === 'tax') {
    await savePaymentsPatch({
      sstRate: Number(body.sstRate),
      tin: str(body.tin),
      brn: str(body.brn),
      classification: str(body.classification) || '022',
    });
    return { ok: true };
  }
  if (action === 'gateway') {
    const gateway = str(body.gateway);
    if (gateway !== 'billplz' && gateway !== 'ipay88' && gateway !== 'rms') throw new ActionError('INVALID', 'Choose Billplz, iPay88 or RMS.');
    await savePaymentsPatch({ gateway, gatewayMode: str(body.gatewayMode) === 'live' ? 'live' : 'test' });
    return { ok: true };
  }
  if (action === 'commission') {
    await savePaymentsPatch({
      teacherShareBps: Number(body.teacherShareBps),
      affiliateShareBps: Number(body.affiliateShareBps),
    });
    return { ok: true };
  }
  if (action === 'secret') {
    if (body.clear === true) await clearSecret(str(body.slot));
    else await writeSecret(str(body.slot), str(body.value));
    return { ok: true };
  }
  if (action === 'coupon') {
    const code = normaliseCode(str(body.code));
    if (code.length < 4) throw new ActionError('INVALID', 'Use a code of at least 4 characters.');
    const ref = db().doc(`coupons/${code}`);
    const snap = await ref.get();
    await ref.set({
      code,
      percentOff: Number(body.percentOff) || null,
      affiliateId: str(body.affiliateId) || null,
      revenueShareBps: Number(body.revenueShareBps) || 1000,
      active: body.active !== false,
      ...(snap.exists ? {} : { redemptions: 0, createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return { ok: true, code };
  }
  throw new ActionError('INVALID', 'Unknown payments action.');
}

export async function updateIntegrations(body: Record<string, unknown>) {
  const action = str(body.action);
  if (action === 'secret') {
    if (body.clear === true) await clearSecret(str(body.slot));
    else await writeSecret(str(body.slot), str(body.value));
    return { ok: true };
  }
  if (action === 'cap') {
    const provider = str(body.provider) === 'gemini' ? 'gemini' : 'openrouter';
    const raw = body.monthlyUsd;
    const monthly = raw === null || raw === '' ? null : Number(raw);
    if (monthly !== null && (!Number.isFinite(monthly) || monthly < 0)) throw new ActionError('INVALID', 'Enter a spend cap in dollars.');
    await saveSpendCap(provider, monthly);
    return { ok: true };
  }
  if (action === 'flags' && body.overrides && typeof body.overrides === 'object') {
    const overrides: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(body.overrides as Record<string, unknown>)) {
      if (typeof value === 'boolean') overrides[key] = value;
    }
    await saveFlagOverrides(overrides);
    return { ok: true };
  }
  throw new ActionError('INVALID', 'Unknown integrations action.');
}
