/**
 * Self-serve institution checkout decisions.
 * Pricing, tax, and day-based proration stay in the modules that already own them.
 */

import {
  catalogueItemsFor,
  priceCatalogue,
  seedInstitutionCatalogue,
  type CatalogueLine,
  type InstitutionCatalogue,
} from './institution-catalogue';
import { scaleSeats, type CourseAccessMode } from './institution-commerce';
import { addIsoDays, periodStartFor } from './institution-membership';
import { planName, type VolumeInterval, type VolumePlanId } from './institution-pricing';

export type ApprovalMode = 'auto' | 'manual' | 'auto_review';
export type InstitutionTender = 'card' | 'fpx' | 'invoice' | 'trial';
export type OrderAccess = 'subscription' | 'a_la_carte';

export const INVOICE_MIN_SEATS = 50;
export const SEAT_MIN = 1;
/** High enough that Enterprise (500+ students) can still check out. */
export const SEAT_MAX = 2000;

export const SANDBOX_BANNER =
  'Payment keys are not configured. This checkout is in test mode and will not charge a card. A completed test payment still opens the academy.';

export const ORGANISATION_SIZES = [
  { id: '1-50', label: '1–50 people', seats: 25 },
  { id: '51-200', label: '51–200 people', seats: 100 },
  { id: '201-500', label: '201–500 people', seats: 250 },
  { id: '500+', label: '500+ people', seats: 500 },
] as const;

export type OrganisationSize = (typeof ORGANISATION_SIZES)[number]['id'];

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
]);

export interface ProgrammeOffer {
  id: string;
  title: string;
  level: VolumePlanId;
  /** Per-seat monthly placeholder, until a super admin saves a catalogue price. */
  alaCarteUsd: number;
  access: CourseAccessMode;
  kind: 'programme' | 'category';
  placeholder: boolean;
  perSeatMonthly: number;
  sparksPerSeat: number;
  billingBasis: 'purchased' | 'active_minimum';
}

/** Names only. Money lives on the editable catalogue, not in this list. */
export function programmeOffers(catalogue: InstitutionCatalogue = seedInstitutionCatalogue()): ProgrammeOffer[] {
  return catalogue.items.map((entry) => ({
    id: entry.id,
    title: entry.title,
    level: entry.planId === 'any' ? 'primary_secondary' : entry.planId,
    alaCarteUsd: entry.perSeatMonthly,
    access: entry.access === 'both' ? 'both' : entry.access,
    kind: entry.kind,
    placeholder: entry.placeholder,
    perSeatMonthly: entry.perSeatMonthly,
    sparksPerSeat: entry.sparksPerSeat,
    billingBasis: entry.billingBasis,
  }));
}

export interface ApprovalSettings {
  mode: ApprovalMode;
  trialDays: number;
  trialSeatCap: number;
  freeEmailSeatLimit: number;
  holdInvoice: boolean;
  holdCustomDomain: boolean;
  holdCobrand: boolean;
  holdMarketplace: boolean;
  holdFreeEmail: boolean;
}

export function defaultApprovalSettings(): ApprovalSettings {
  return {
    mode: 'auto',
    trialDays: 14,
    trialSeatCap: 25,
    freeEmailSeatLimit: 10,
    holdInvoice: true,
    holdCustomDomain: true,
    holdCobrand: true,
    holdMarketplace: true,
    holdFreeEmail: true,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return fallback;
  return number;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function readApprovalSettings(data: unknown): ApprovalSettings {
  const base = defaultApprovalSettings();
  const row = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const mode: ApprovalMode = row.mode === 'manual' || row.mode === 'auto_review' ? row.mode : 'auto';
  return {
    mode,
    trialDays: clampInt(row.trialDays, 1, 90, base.trialDays),
    trialSeatCap: clampInt(row.trialSeatCap, 1, SEAT_MAX, base.trialSeatCap),
    freeEmailSeatLimit: clampInt(row.freeEmailSeatLimit, 0, SEAT_MAX, base.freeEmailSeatLimit),
    holdInvoice: flag(row.holdInvoice, base.holdInvoice),
    holdCustomDomain: flag(row.holdCustomDomain, base.holdCustomDomain),
    holdCobrand: flag(row.holdCobrand, base.holdCobrand),
    holdMarketplace: flag(row.holdMarketplace, base.holdMarketplace),
    holdFreeEmail: flag(row.holdFreeEmail, base.holdFreeEmail),
  };
}

export function parseOrganisationSize(value: unknown): { ok: true; size: OrganisationSize } | { ok: false; error: string } {
  const size = typeof value === 'string' ? value : '';
  if (ORGANISATION_SIZES.some((item) => item.id === size)) return { ok: true, size: size as OrganisationSize };
  return { ok: false, error: 'Choose an organisation size.' };
}

export function seatsForOrganisationSize(size: string): number {
  return ORGANISATION_SIZES.find((item) => item.id === size)?.seats ?? 25;
}

export function isFreeEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return FREE_EMAIL_DOMAINS.has(domain);
}

export function programmesForLevel(planId: VolumePlanId, access: OrderAccess, catalogue: InstitutionCatalogue = seedInstitutionCatalogue()): ProgrammeOffer[] {
  const offers = new Map(programmeOffers(catalogue).map((item) => [item.id, item]));
  return catalogueItemsFor(catalogue, planId, access).map((entry) => offers.get(entry.id)!);
}

export interface PricedOrder {
  planId: VolumePlanId;
  planLabel: string;
  interval: VolumeInterval;
  access: OrderAccess;
  seats: number;
  programmeIds: string[];
  programmeTitles: string[];
  currency: string;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  sparks: number;
  tender: InstitutionTender;
  lines: CatalogueLine[];
  tierLabel: string;
  quoteContact: boolean;
  selfServe: boolean;
  placeholder: boolean;
  notices: string[];
  activeSeats: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function priceInstitutionOrder(input: {
  planId: VolumePlanId;
  interval: VolumeInterval;
  seats: number;
  access: OrderAccess;
  programmeIds: readonly string[];
  country: string;
  tender: InstitutionTender;
  catalogue?: InstitutionCatalogue;
  activeSeats?: number;
}): PricedOrder | { error: string } {
  const seats = Math.floor(input.seats);
  if (!Number.isInteger(seats) || seats < SEAT_MIN || seats > SEAT_MAX) {
    return { error: `Choose between ${SEAT_MIN} and ${SEAT_MAX} seats.` };
  }
  if (input.tender === 'invoice' && seats < INVOICE_MIN_SEATS) {
    return { error: `Invoice and purchase orders are available from ${INVOICE_MIN_SEATS} seats.` };
  }
  const catalogue = input.catalogue ?? seedInstitutionCatalogue();
  const offers = programmeOffers(catalogue);
  const selected = input.programmeIds.length
    ? offers.filter((item) => input.programmeIds.includes(item.id))
    : input.access === 'subscription' ? programmesForLevel(input.planId, input.access, catalogue) : [];
  if (input.programmeIds.length && selected.length !== input.programmeIds.length) {
    return { error: 'One of those programmes is not on the catalogue.' };
  }
  if (selected.some((item) => item.access !== 'both' && item.access !== input.access)) {
    return { error: 'One of those programmes is not sold that way.' };
  }
  if (selected.length === 0) {
    return { error: 'Choose at least one programme or category.' };
  }
  const quote = priceCatalogue({
    catalogue,
    itemIds: selected.map((item) => item.id),
    purchasedSeats: seats,
    activeSeats: input.activeSeats ?? seats,
    interval: input.interval,
    country: input.country,
    tender: input.tender,
  });
  if ('error' in quote) return quote;
  return {
    planId: input.planId,
    planLabel: planName(input.planId),
    interval: input.interval,
    access: input.access,
    seats,
    programmeIds: quote.itemIds,
    programmeTitles: quote.itemTitles,
    currency: quote.currency,
    subtotal: quote.subtotal,
    taxRate: quote.taxRate,
    tax: quote.tax,
    total: quote.total,
    sparks: quote.sparks,
    tender: input.tender,
    lines: quote.lines,
    tierLabel: quote.tierLabel,
    quoteContact: quote.quoteContact,
    selfServe: quote.selfServe,
    placeholder: quote.placeholder,
    notices: quote.notices,
    activeSeats: quote.activeSeats,
  };
}

export interface ReviewRequest {
  tender: InstitutionTender;
  seats: number;
  email: string;
  wantsCustomDomain: boolean;
  wantsCobrand: boolean;
  wantsMarketplace: boolean;
}

/** Auto activates on payment. Manual always holds. Auto with review holds the listed cases. */
export function approvalDecision(settings: ApprovalSettings, request: ReviewRequest): { activate: boolean; reasons: string[] } {
  if (request.tender === 'trial') return { activate: true, reasons: [] };
  if (settings.mode === 'manual') {
    return { activate: false, reasons: ['Institution approval mode is manual.'] };
  }
  if (settings.mode === 'auto') return { activate: true, reasons: [] };
  const reasons: string[] = [];
  if (settings.holdInvoice && request.tender === 'invoice') reasons.push('Invoice or purchase order.');
  if (settings.holdCustomDomain && request.wantsCustomDomain) reasons.push('Custom domain requested.');
  if (settings.holdCobrand && request.wantsCobrand) reasons.push('Co-branded certificates requested.');
  if (settings.holdMarketplace && request.wantsMarketplace) reasons.push('Marketplace course publishing requested.');
  if (settings.holdFreeEmail && isFreeEmailDomain(request.email) && request.seats > settings.freeEmailSeatLimit) {
    reasons.push(`Free email domain with more than ${settings.freeEmailSeatLimit} seats.`);
  }
  return { activate: reasons.length === 0, reasons };
}

export function trialTerms(
  settings: ApprovalSettings,
  requestedSeats: number,
  today: string,
): { seats: number; periodEnd: string; days: number } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return { error: 'Trial start date is missing.' };
  const asked = Math.floor(requestedSeats);
  const seats = Math.min(settings.trialSeatCap, Math.max(1, Number.isInteger(asked) ? asked : 1));
  return { seats, periodEnd: addIsoDays(today, settings.trialDays), days: settings.trialDays };
}

export type CheckoutChannel = 'stripe' | 'gateway' | 'invoice' | 'trial' | 'sandbox' | 'free' | 'unsupported';

export function checkoutChannel(input: {
  stripe: boolean;
  gateway: boolean;
  currency: string;
  tender: InstitutionTender;
  total: number;
}): CheckoutChannel {
  if (input.tender === 'trial') return 'trial';
  if (input.tender === 'invoice') return 'invoice';
  if (!(input.total > 0)) return 'free';
  const myr = input.currency.trim().toUpperCase() === 'MYR';
  if (input.tender === 'fpx' && !myr) return input.stripe || input.gateway ? 'unsupported' : 'sandbox';
  if (input.tender === 'card' && input.stripe) return 'stripe';
  if (input.tender === 'fpx' && input.stripe) return 'stripe';
  if (input.tender === 'fpx' && input.gateway) return 'gateway';
  if (input.tender === 'card' && input.gateway) return 'gateway';
  return 'sandbox';
}

export function sandboxBannerFor(channel: CheckoutChannel): string {
  return channel === 'sandbox' ? SANDBOX_BANNER : '';
}

export function quoteSelfServeChange(input: {
  currentSeats: number;
  currentTotal: number;
  currentInterval: VolumeInterval;
  currentPeriodEnd: string;
  nextSeats: number;
  nextTotal: number;
  planChanged: boolean;
  on: string;
}): { charge: number; credit: number; net: number } | { error: string } {
  const periodStart = periodStartFor(input.currentPeriodEnd, input.currentInterval);
  if (!input.planChanged) {
    const scaled = scaleSeats({
      seats: input.currentSeats,
      activeStudents: input.nextSeats,
      periodStart,
      periodEnd: input.currentPeriodEnd,
      on: input.on,
      perSeat: input.currentSeats > 0 ? input.currentTotal / input.currentSeats : 0,
    });
    if ('error' in scaled) return scaled;
    return { charge: scaled.charge, credit: scaled.credit, net: round2(scaled.charge - scaled.credit) };
  }
  const probe = scaleSeats({
    seats: input.currentSeats,
    activeStudents: input.currentSeats,
    periodStart,
    periodEnd: input.currentPeriodEnd,
    on: input.on,
    perSeat: 0,
  });
  if ('error' in probe) return probe;
  const net = round2((input.nextTotal - input.currentTotal) * (probe.daysRemaining / probe.daysInPeriod));
  return { charge: net > 0 ? net : 0, credit: net < 0 ? round2(-net) : 0, net };
}

export function cancellationDate(periodEnd: string): { cancelOn: string } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) return { error: 'The current period has no end date.' };
  return { cancelOn: periodEnd };
}

/** A cancelled academy suspends on this date. A failed payment still uses the 7-day grace. */
export function scheduledCancellation(input: { phase: string; cancelOn: string; today: string }): boolean {
  return input.phase === 'active'
    && /^\d{4}-\d{2}-\d{2}$/.test(input.cancelOn)
    && /^\d{4}-\d{2}-\d{2}$/.test(input.today)
    && input.today >= input.cancelOn;
}

export interface InstitutionOrderInput {
  planId: VolumePlanId;
  interval: VolumeInterval;
  seats: number;
  access: OrderAccess;
  programmeIds: string[];
  tender: Exclude<InstitutionTender, 'trial'>;
  poNumber: string;
  wantsCustomDomain: boolean;
  wantsCobrand: boolean;
  wantsMarketplace: boolean;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function bool(value: unknown): boolean {
  return value === true;
}

export function parseInstitutionOrder(input: Record<string, unknown>): { ok: true; value: InstitutionOrderInput } | { ok: false; error: string } {
  const planId = text(input.planId);
  if (planId !== 'primary_secondary' && planId !== 'igcse_alevel' && planId !== 'professional') {
    return { ok: false, error: 'Choose a plan.' };
  }
  const access = input.access === 'a_la_carte' ? 'a_la_carte' : input.access === 'subscription' ? 'subscription' : '';
  if (!access) return { ok: false, error: 'Choose subscription or a la carte.' };
  const tender = input.tender === 'fpx' || input.tender === 'invoice' || input.tender === 'card' ? input.tender : '';
  if (!tender) return { ok: false, error: 'Choose card, FPX, or invoice.' };
  const seats = Math.floor(Number(input.seats));
  const programmeIds = Array.isArray(input.programmeIds)
    ? input.programmeIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const poNumber = text(input.poNumber);
  if (tender === 'invoice' && poNumber.length < 2) return { ok: false, error: 'Enter a purchase order or invoice reference.' };
  return {
    ok: true,
    value: {
      planId,
      interval: input.interval === 'monthly' ? 'monthly' : 'annual',
      seats,
      access,
      programmeIds,
      tender,
      poNumber,
      wantsCustomDomain: bool(input.wantsCustomDomain),
      wantsCobrand: bool(input.wantsCobrand),
      wantsMarketplace: bool(input.wantsMarketplace),
    },
  };
}

export function gatewayVendor(value: string | undefined): 'billplz' | 'ipay88' | 'rms' {
  if (value === 'ipay88' || value === 'rms') return value;
  return 'billplz';
}
