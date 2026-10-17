/**
 * Turns a paid self-serve order into an academy, or holds it for review.
 * Super-admin payment links do not call this. They keep markInstitutionPaid.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  institutionEmail,
  openSubscription,
  quoteForInstitution,
  readSubscription,
  recordPayment,
  blankSubscription,
} from '../institution-membership';
import type { VolumeInterval, VolumePlanId } from '../institution-pricing';
import { normaliseSubdomain } from '../tenant-host';
import { secretValue } from '../payments/server/settings';
import {
  approvalDecision,
  defaultApprovalSettings,
  gatewayVendor,
  priceInstitutionOrder,
  readApprovalSettings,
  trialTerms,
  type ApprovalSettings,
  type InstitutionOrderInput,
  type PricedOrder,
} from '../institution-self-serve';
import { sendInstitutionMail } from './institution-mail';

const LOGIN_LINK = 'https://poketschool.ai/institutions/login';

function todayIso(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function callerOwnsInstitution(uid: string, institutionId: string): Promise<boolean> {
  if (!uid || !institutionId) return false;
  const snap = await adminDb().doc(`users/${uid}`).get();
  const data = snap.data() ?? {};
  if (data.institutionId !== institutionId) return false;
  const roles = Array.isArray(data.roles) ? data.roles : [];
  return data.role === 'institution_admin' || roles.includes('institution_admin');
}

export async function loadApprovalSettings(): Promise<ApprovalSettings> {
  try {
    const snap = await adminDb().doc('settings/institution_signup').get();
    if (!snap.exists) return defaultApprovalSettings();
    return readApprovalSettings(snap.data());
  } catch {
    return defaultApprovalSettings();
  }
}

export async function institutionPaymentKeys(): Promise<{ stripe: boolean; gateway: boolean; vendor: 'billplz' | 'ipay88' | 'rms' }> {
  const vendor = gatewayVendor(process.env.MY_GATEWAY_PROVIDER);
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const pair = vendor === 'ipay88'
    ? ['ipay88_code', 'ipay88_key']
    : vendor === 'rms'
      ? ['rms_merchant', 'rms_secret']
      : ['billplz_key', 'billplz_collection'];
  let gateway = false;
  try {
    const [first, second] = await Promise.all(pair.map((id) => secretValue(id).catch(() => undefined)));
    gateway = Boolean(first && second);
  } catch {
    gateway = false;
  }
  return { stripe, gateway, vendor };
}

interface AcademyRecord {
  name: string;
  country: string;
  adminId: string;
  email: string;
  personName: string;
  subdomain: string;
  branding: Record<string, unknown>;
  setupComplete: boolean;
}

async function loadAcademy(institutionId: string): Promise<AcademyRecord | null> {
  const snap = await adminDb().doc(`institutions/${institutionId}`).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const adminId = typeof data.adminId === 'string' ? data.adminId : '';
  let email = '';
  let personName = '';
  if (adminId) {
    const admin = await adminDb().doc(`users/${adminId}`).get();
    const profile = admin.data() ?? {};
    email = typeof profile.email === 'string' ? profile.email : '';
    personName = typeof profile.name === 'string' ? profile.name : '';
  }
  const branding = data.branding && typeof data.branding === 'object' ? data.branding as Record<string, unknown> : {};
  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Your institution',
    country: typeof data.country === 'string' ? data.country : '',
    adminId,
    email,
    personName,
    subdomain: typeof data.subdomain === 'string' ? data.subdomain : '',
    branding,
    setupComplete: data.setupComplete === true,
  };
}

async function claim(refPath: string): Promise<boolean> {
  const ref = adminDb().doc(refPath);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const status = snap.data()?.status;
    if (status === 'settled' || status === 'settling') return false;
    tx.set(ref, { status: 'settling' }, { merge: true });
    return true;
  });
}

async function suggestSlug(institutionId: string, name: string, current: string): Promise<string> {
  if (current) return current;
  const slug = normaliseSubdomain(name);
  if (!slug) return '';
  const taken = await adminDb().collection('institutions').where('subdomain', '==', slug).limit(1).get();
  if (!taken.empty && taken.docs[0]?.id !== institutionId) return '';
  return slug;
}

async function provision(input: {
  institutionId: string;
  academy: AcademyRecord;
  priced: PricedOrder;
  periodEnd: string;
  activate: boolean;
  reasons: string[];
  tenderLabel: string;
  trial: boolean;
  providerRef?: string;
  paymentIntentId?: string;
  emailKind: 'welcome_receipt' | 'under_review' | 'none';
  feed?: boolean;
}): Promise<{ emailed: boolean; text: string }> {
  const db = adminDb();
  const on = todayIso();
  const phase = input.activate ? 'active' : 'pending_payment';
  const opened = openSubscription({
    subject: 'institution',
    planId: input.priced.planId,
    interval: input.priced.interval,
    seats: input.priced.seats,
    currency: input.priced.currency,
    total: input.priced.total,
    payerEmail: input.academy.email,
    on,
  });
  const billed = input.activate
    ? recordPayment({ ...opened.state, interval: input.priced.interval }, on, input.priced.interval)
    : { state: opened.state, notices: [] };
  if (input.priced.tender === 'trial' || input.trial) {
    billed.state.periodEnd = input.periodEnd;
    billed.state.total = 0;
    billed.state.phase = 'active';
  } else if (input.activate) {
    billed.state.periodEnd = input.periodEnd || billed.state.periodEnd;
  }
  await db.doc(`institutions/${input.institutionId}/billing/current`).set({
    ...billed.state,
    access: input.priced.access,
    programmeIds: input.priced.programmeIds,
    tender: input.priced.tender,
    trial: input.trial,
    providerRef: input.providerRef ?? '',
    paymentIntentId: input.paymentIntentId ?? '',
  });
  const slug = input.activate ? await suggestSlug(input.institutionId, input.academy.name, input.academy.subdomain) : input.academy.subdomain;
  const branding = {
    ...input.academy.branding,
    displayName: typeof input.academy.branding.displayName === 'string' && input.academy.branding.displayName
      ? input.academy.branding.displayName
      : input.academy.name,
    loginPublished: false,
  };
  const patch: Record<string, unknown> = {
    billingPhase: input.activate ? 'active' : 'pending_payment',
    reviewHold: !input.activate,
    reviewReasons: input.activate ? [] : input.reasons,
    planId: input.priced.planId,
    accessMode: input.priced.access,
    programmeIds: input.priced.programmeIds,
  };
  if (input.activate) {
    patch.status = 'active';
    if (!input.academy.setupComplete) patch.setupComplete = false;
    if (!input.academy.subdomain) {
      patch.branding = branding;
      if (slug) patch.subdomain = slug;
    }
  }
  await db.doc(`institutions/${input.institutionId}`).set(patch, { merge: true });
  if (input.activate) {
    await db.doc(`institutions/${input.institutionId}/settings/profile`).set({
      seatCount: input.priced.seats,
    }, { merge: true });
    await db.doc(`institutions/${input.institutionId}/settings/access`).set({
      planId: input.priced.planId,
      access: input.priced.access,
      programmeIds: input.priced.programmeIds,
    });
    await db.doc(`institutions/${input.institutionId}/sparks_guard/current`).set({
      cap: input.priced.sparks,
      allowance: input.priced.sparks,
      lowAtPercent: 20,
    });
  }
  if (input.activate && input.feed !== false) {
    await db.collection('institution_activations').add({
      institutionId: input.institutionId,
      name: input.academy.name,
      at: new Date().toISOString(),
      planId: input.priced.planId,
      seats: input.priced.seats,
      total: input.priced.total,
      currency: input.priced.currency,
      tender: input.priced.tender,
      trial: input.trial,
    });
  }
  if (input.emailKind === 'none') return { emailed: false, text: '' };
  const money = `${input.priced.currency} ${input.priced.total.toFixed(2)}`;
  const tax = `${input.priced.currency} ${input.priced.tax.toFixed(2)}`;
  const mail = institutionEmail(input.emailKind, {
    institutionName: input.academy.name,
    personName: input.academy.personName,
    plan: input.priced.planLabel,
    seats: input.priced.seats,
    sparks: input.priced.sparks,
    tender: input.tenderLabel,
    tax,
    total: money,
    reasons: input.reasons.join('\n'),
    link: input.activate ? 'https://poketschool.ai/dashboard/institution/onboarding' : LOGIN_LINK,
  });
  return sendInstitutionMail(input.academy.email, mail);
}

export async function saveInstitutionOrder(
  institutionId: string,
  order: InstitutionOrderInput,
  priced: PricedOrder,
): Promise<void> {
  await adminDb().doc(`institutions/${institutionId}/billing/order`).set({
    ...order,
    ...priced,
    status: 'open',
    savedAt: FieldValue.serverTimestamp(),
  });
}

export async function settleInstitutionOrder(
  institutionId: string,
  extra: { providerRef?: string; paymentIntentId?: string; interval?: VolumeInterval } = {},
): Promise<{ activate: boolean; destination: string; emailed: boolean; text: string; already: boolean }> {
  const orderRef = `institutions/${institutionId}/billing/order`;
  const changeRef = `institutions/${institutionId}/billing/change`;
  const changeSnap = await adminDb().doc(changeRef).get();
  const academySnap = await adminDb().doc(`institutions/${institutionId}`).get();
  const status = academySnap.data()?.status;
  if (status === 'active' && changeSnap.exists && changeSnap.data()?.status === 'open') {
    const claimed = await claim(changeRef);
    if (!claimed) return { activate: true, destination: '/dashboard/institution/billing', emailed: false, text: '', already: true };
    await applyOpenChange(institutionId);
    await adminDb().doc(changeRef).set({ status: 'settled', providerRef: extra.providerRef ?? '' }, { merge: true });
    return { activate: true, destination: '/dashboard/institution/billing', emailed: false, text: '', already: false };
  }
  const claimed = await claim(orderRef);
  if (!claimed) {
    const held = academySnap.data()?.reviewHold === true;
    return {
      activate: !held && status === 'active',
      destination: held ? '/institutions/pending' : '/dashboard/institution/onboarding',
      emailed: false,
      text: '',
      already: true,
    };
  }
  const orderSnap = await adminDb().doc(orderRef).get();
  const order = orderSnap.data() ?? {};
  const academy = await loadAcademy(institutionId);
  if (!academy) {
    await adminDb().doc(orderRef).set({ status: 'open' }, { merge: true });
    throw new Error('That academy was not found.');
  }
  const planId = (order.planId === 'primary_secondary' || order.planId === 'igcse_alevel' || order.planId === 'professional'
    ? order.planId
    : 'igcse_alevel') as VolumePlanId;
  const interval: VolumeInterval = extra.interval === 'monthly' || order.interval === 'monthly' ? 'monthly' : 'annual';
  const access = order.access === 'a_la_carte' ? 'a_la_carte' : 'subscription';
  const tender = order.tender === 'invoice' || order.tender === 'fpx' || order.tender === 'trial' ? order.tender : 'card';
  const programmeIds = Array.isArray(order.programmeIds) ? order.programmeIds.filter((item): item is string => typeof item === 'string') : [];
  const seats = typeof order.seats === 'number' ? order.seats : 1;
  const priced = priceInstitutionOrder({
    planId,
    interval,
    seats,
    access,
    programmeIds,
    country: academy.country,
    tender: tender === 'trial' ? 'card' : tender,
  });
  if ('error' in priced) {
    await adminDb().doc(orderRef).set({ status: 'open' }, { merge: true });
    throw new Error(priced.error);
  }
  const settings = await loadApprovalSettings();
  const decision = approvalDecision(settings, {
    tender,
    seats: priced.seats,
    email: academy.email,
    wantsCustomDomain: order.wantsCustomDomain === true,
    wantsCobrand: order.wantsCobrand === true,
    wantsMarketplace: order.wantsMarketplace === true,
  });
  const mailed = await provision({
    institutionId,
    academy,
    priced: { ...priced, tender },
    periodEnd: '',
    activate: decision.activate,
    reasons: decision.reasons,
    tenderLabel: tender,
    trial: false,
    providerRef: extra.providerRef,
    paymentIntentId: extra.paymentIntentId,
    emailKind: decision.activate ? 'welcome_receipt' : 'under_review',
  });
  await adminDb().doc(orderRef).set({ status: 'settled', providerRef: extra.providerRef ?? '' }, { merge: true });
  return {
    activate: decision.activate,
    destination: decision.activate ? '/dashboard/institution/onboarding' : '/institutions/pending',
    emailed: mailed.emailed,
    text: mailed.text,
    already: false,
  };
}

async function applyOpenChange(institutionId: string): Promise<void> {
  const change = (await adminDb().doc(`institutions/${institutionId}/billing/change`).get()).data() ?? {};
  const ref = adminDb().doc(`institutions/${institutionId}/billing/current`);
  const current = readSubscription((await ref.get()).data() as Record<string, unknown> | undefined, blankSubscription('institution', todayIso()));
  const planId = (change.planId === 'primary_secondary' || change.planId === 'igcse_alevel' || change.planId === 'professional'
    ? change.planId
    : current.planId) as VolumePlanId;
  const interval: VolumeInterval = change.interval === 'monthly' ? 'monthly' : change.interval === 'annual' ? 'annual' : current.interval;
  const seats = typeof change.seats === 'number' ? change.seats : current.seats;
  const total = typeof change.total === 'number' ? change.total : current.total;
  await ref.set({
    ...current,
    planId,
    interval,
    seats,
    total,
    phase: 'active',
    cancelOn: '',
  });
  await adminDb().doc(`institutions/${institutionId}`).set({
    billingPhase: 'active',
    status: 'active',
    planId,
  }, { merge: true });
  await adminDb().doc(`institutions/${institutionId}/settings/profile`).set({ seatCount: seats }, { merge: true });
  const sparks = typeof change.sparks === 'number' ? change.sparks : 0;
  if (sparks > 0) {
    await adminDb().doc(`institutions/${institutionId}/sparks_guard/current`).set({
      cap: sparks,
      allowance: sparks,
      lowAtPercent: 20,
    }, { merge: true });
  }
}

export async function startInstitutionTrial(institutionId: string, requestedSeats: number, planId: VolumePlanId, programmeIds: string[]): Promise<{
  destination: string;
  seats: number;
  periodEnd: string;
  emailed: boolean;
  text: string;
}> {
  const settings = await loadApprovalSettings();
  const terms = trialTerms(settings, requestedSeats, todayIso());
  if ('error' in terms) throw new Error(terms.error);
  const academy = await loadAcademy(institutionId);
  if (!academy) throw new Error('That academy was not found.');
  const priced = priceInstitutionOrder({
    planId,
    interval: 'annual',
    seats: terms.seats,
    access: 'subscription',
    programmeIds,
    country: academy.country,
    tender: 'card',
  });
  if ('error' in priced) throw new Error(priced.error);
  const mailed = await provision({
    institutionId,
    academy,
    priced: { ...priced, tender: 'trial', total: 0, tax: 0, subtotal: 0 },
    periodEnd: terms.periodEnd,
    activate: true,
    reasons: [],
    tenderLabel: `Free trial, ${terms.days} days`,
    trial: true,
    emailKind: 'welcome_receipt',
  });
  await adminDb().doc(`institutions/${institutionId}/billing/order`).set({
    status: 'settled',
    tender: 'trial',
    planId,
    seats: terms.seats,
    programmeIds: priced.programmeIds,
    access: 'subscription',
  });
  return { destination: '/dashboard/institution/onboarding', seats: terms.seats, periodEnd: terms.periodEnd, emailed: mailed.emailed, text: mailed.text };
}

/** Super admin approval of a held academy also opens the paid bill. */
export async function releaseHeldInstitution(institutionId: string): Promise<void> {
  const snap = await adminDb().doc(`institutions/${institutionId}`).get();
  if (snap.data()?.reviewHold !== true) return;
  const order = (await adminDb().doc(`institutions/${institutionId}/billing/order`).get()).data() ?? {};
  if (order.status !== 'settled') return;
  const academy = await loadAcademy(institutionId);
  if (!academy) return;
  const planId = (order.planId === 'primary_secondary' || order.planId === 'igcse_alevel' || order.planId === 'professional'
    ? order.planId
    : 'igcse_alevel') as VolumePlanId;
  const priced = priceInstitutionOrder({
    planId,
    interval: order.interval === 'monthly' ? 'monthly' : 'annual',
    seats: typeof order.seats === 'number' ? order.seats : 1,
    access: order.access === 'a_la_carte' ? 'a_la_carte' : 'subscription',
    programmeIds: Array.isArray(order.programmeIds) ? order.programmeIds.filter((item): item is string => typeof item === 'string') : [],
    country: academy.country,
    tender: order.tender === 'invoice' || order.tender === 'fpx' ? order.tender : 'card',
  });
  if ('error' in priced) return;
  await provision({
    institutionId,
    academy,
    priced,
    periodEnd: '',
    activate: true,
    reasons: [],
    tenderLabel: 'Approved after review',
    trial: false,
    emailKind: 'none',
    feed: false,
  });
}

export function recurringTotal(planId: VolumePlanId, interval: VolumeInterval, seats: number): number {
  return quoteForInstitution({ planId, interval, seats }).total;
}
