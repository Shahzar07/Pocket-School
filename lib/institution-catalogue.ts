/**
 * Hybrid institution catalogue.
 * Every money figure in the seed is a placeholder. A super admin replaces it.
 * This module does not publish a price list.
 */

import { BRAND } from './brand-theme';
import type { VolumePlanId } from './institution-pricing';
import { taxRateFor } from './payments/tax';

export const CATALOGUE_PLACEHOLDER = 'PLACEHOLDER';

export const CATALOGUE_NOTE =
  'PLACEHOLDER prices, discounts, and currency rates. They are not a published price list. A super admin replaces them on the institution pricing page.';

export type CatalogueKind = 'programme' | 'category';
export type BillingBasis = 'purchased' | 'active_minimum';
export type SeatOverage = 'prompt' | 'auto_add';
export type CatalogueAccess = 'subscription' | 'a_la_carte' | 'both';
export type CataloguePlan = VolumePlanId | 'any';

export interface CatalogueItem {
  id: string;
  title: string;
  kind: CatalogueKind;
  /** Level name a student must match. Categories can leave this empty. */
  level: string;
  planId: CataloguePlan;
  access: CatalogueAccess;
  /** Per student per month in USD before the tier and the annual discount. */
  perSeatMonthly: number;
  placeholder: boolean;
  sparksPerSeat: number;
  billingBasis: BillingBasis;
  minimumSeats: number;
  overage: SeatOverage;
}

/** Stored catalogues may still say cream, forest, gold, blue, or coral. */
export const TIER_ACCENTS = {
  mist: BRAND.wash,
  foam: BRAND.bg,
  deep: BRAND.blueDeep,
  mid: BRAND.primary,
  bright: BRAND.blueBright,
} as const;

export type TierAccent = keyof typeof TIER_ACCENTS;

const LEGACY_TIER_ACCENT: Record<string, TierAccent> = {
  cream: 'mist',
  forest: 'deep',
  gold: 'mid',
  blue: 'bright',
  coral: 'bright',
};

export function readTierAccent(value: unknown): TierAccent {
  if (typeof value === 'string' && value in TIER_ACCENTS) return value as TierAccent;
  if (typeof value === 'string' && LEGACY_TIER_ACCENT[value]) return LEGACY_TIER_ACCENT[value];
  return 'deep';
}

export interface TierSeatPrice {
  itemId: string;
  /** USD per student per month for this item on this tier. */
  perSeatMonthly: number;
}

export interface CatalogueTier {
  id: string;
  name: string;
  /** Same as the name, so older readers still show the tier. */
  label: string;
  minSeats: number;
  maxSeats: number | null;
  /** Used when a programme has no per-tier seat price. */
  discount: number;
  seatPrices: TierSeatPrice[];
  features: string[];
  /** Shows a quote and contact path. Checkout can stay open beside it. */
  quoteContact: boolean;
  selfServe: boolean;
  contactHref: string;
  accent: TierAccent;
  placeholder: boolean;
}

export interface CatalogueCurrency {
  code: string;
  /** Local units for 1 USD. */
  rate: number;
  enabled: boolean;
  placeholder: boolean;
  countries: string[];
}

export interface BundleRule {
  id: string;
  /** Applies when at least this many programmes are selected. Categories do not count. */
  minProgrammes: number;
  /** Fraction off each selected programme, for example 0.05 for 5%. */
  discount: number;
  placeholder: boolean;
}

export interface InstitutionCatalogue {
  placeholder: boolean;
  note: string;
  baseCurrency: 'USD';
  /** Fraction off twelve months of the monthly seat price. */
  annualDiscount: number;
  quoteMinSeats: number;
  trialDays: number;
  trialSeatCap: number;
  tiers: CatalogueTier[];
  /** Optional. The highest matching rule applies. A zero discount turns that step off. */
  bundleRules: BundleRule[];
  currencies: CatalogueCurrency[];
  items: CatalogueItem[];
}

export interface CatalogueLine {
  id: string;
  title: string;
  kind: CatalogueKind;
  seats: number;
  unit: number;
  amount: number;
  sparks: number;
  billingBasis: BillingBasis;
  overage: 'within' | SeatOverage;
  extraSeats: number;
}

export interface CatalogueQuote {
  currency: string;
  baseCurrency: 'USD';
  interval: 'monthly' | 'annual';
  tierId: string;
  tierLabel: string;
  tierDiscount: number;
  quoteContact: boolean;
  selfServe: boolean;
  features: string[];
  annualDiscount: number;
  /** Students counted once, even when they take several programmes. This picks the tier. */
  uniqueStudents: number;
  programmeCount: number;
  bundleDiscount: number;
  purchasedSeats: number;
  activeSeats: number;
  subtotalUsd: number;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  sparks: number;
  placeholder: boolean;
  lines: CatalogueLine[];
  notices: string[];
  itemIds: string[];
  itemTitles: string[];
}

export interface ProgrammeGrant {
  itemId: string;
  studentIds: string[];
  levels: string[];
}

export interface CatalogueCourse {
  programmeId?: string;
  categoryId?: string;
  category?: string;
  level?: string;
  subject?: string;
  tags?: readonly string[];
}

export interface RevenueInput {
  institutionId: string;
  name: string;
  currency: string;
  lines: readonly { id: string; title: string; amount: number }[];
}

export interface RevenueCell {
  institutionId: string;
  name: string;
  itemId: string;
  title: string;
  currency: string;
  amount: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function item(partial: Omit<CatalogueItem, 'placeholder'> & { placeholder?: boolean }): CatalogueItem {
  return { placeholder: true, ...partial };
}

const ENTERPRISE_CONTACT = 'mailto:institutions@poketschool.ai?subject=Enterprise%20pricing';

function namedTier(partial: Omit<CatalogueTier, 'label' | 'placeholder' | 'seatPrices'> & { seatPrices?: TierSeatPrice[] }): CatalogueTier {
  const { seatPrices, ...rest } = partial;
  return { ...rest, label: rest.name, placeholder: true, seatPrices: seatPrices ?? [] };
}

/** Seed only. Amounts are placeholders for the super admin to replace. */
export function seedInstitutionCatalogue(): InstitutionCatalogue {
  const items = [
    item({ id: 'igcse', title: 'IGCSE core', kind: 'programme', level: 'IGCSE', planId: 'igcse_alevel', access: 'both', perSeatMonthly: 10, sparksPerSeat: 8, billingBasis: 'purchased', minimumSeats: 1, overage: 'prompt' }),
    item({ id: 'primary', title: 'Primary', kind: 'programme', level: 'Primary', planId: 'primary_secondary', access: 'both', perSeatMonthly: 8, sparksPerSeat: 6, billingBasis: 'purchased', minimumSeats: 1, overage: 'prompt' }),
    item({ id: 'lower-secondary', title: 'Lower Secondary', kind: 'programme', level: 'Lower Secondary', planId: 'primary_secondary', access: 'subscription', perSeatMonthly: 8, sparksPerSeat: 6, billingBasis: 'purchased', minimumSeats: 1, overage: 'prompt' }),
    item({ id: 'law-school', title: 'Law School', kind: 'programme', level: 'Law', planId: 'professional', access: 'both', perSeatMonthly: 12, sparksPerSeat: 10, billingBasis: 'purchased', minimumSeats: 1, overage: 'prompt' }),
    item({ id: 'rise-sen', title: 'RISE SEN', kind: 'programme', level: 'RISE', planId: 'primary_secondary', access: 'both', perSeatMonthly: 9, sparksPerSeat: 8, billingBasis: 'active_minimum', minimumSeats: 5, overage: 'auto_add' }),
    item({ id: 'maths', title: 'Mathematics', kind: 'category', level: '', planId: 'any', access: 'both', perSeatMonthly: 4, sparksPerSeat: 2, billingBasis: 'purchased', minimumSeats: 1, overage: 'prompt' }),
    item({ id: 'english', title: 'English', kind: 'category', level: '', planId: 'any', access: 'both', perSeatMonthly: 3, sparksPerSeat: 2, billingBasis: 'purchased', minimumSeats: 1, overage: 'prompt' }),
    item({ id: 'science', title: 'Science', kind: 'category', level: '', planId: 'any', access: 'both', perSeatMonthly: 3, sparksPerSeat: 2, billingBasis: 'purchased', minimumSeats: 1, overage: 'prompt' }),
    item({ id: 'sen-support', title: 'SEN support', kind: 'category', level: 'RISE', planId: 'any', access: 'both', perSeatMonthly: 5, sparksPerSeat: 3, billingBasis: 'active_minimum', minimumSeats: 5, overage: 'prompt' }),
  ];
  const prices = (discount: number): TierSeatPrice[] => items.map((entry) => ({
    itemId: entry.id,
    perSeatMonthly: round2(entry.perSeatMonthly * (1 - discount)),
  }));
  const tiers: CatalogueTier[] = [
    namedTier({
      id: 'micro',
      name: 'Micro',
      minSeats: 1,
      maxSeats: 20,
      discount: 0,
      seatPrices: prices(0),
      features: ['Programmes for the levels you choose', 'Sparks allowance per seat', 'Self-serve checkout'],
      quoteContact: false,
      selfServe: true,
      contactHref: '',
      accent: 'mist',
    }),
    namedTier({
      id: 'starter',
      name: 'Starter',
      minSeats: 21,
      maxSeats: 50,
      discount: 0.05,
      seatPrices: prices(0.05),
      features: ['A lower per-seat price', 'Assign programmes by level', 'Self-serve checkout'],
      quoteContact: false,
      selfServe: true,
      contactHref: '',
      accent: 'deep',
    }),
    namedTier({
      id: 'growth',
      name: 'Growth',
      minSeats: 51,
      maxSeats: 100,
      discount: 0.1,
      seatPrices: prices(0.1),
      features: ['A lower per-seat price', 'Assign programmes by level', 'Quote PDF for larger orders'],
      quoteContact: false,
      selfServe: true,
      contactHref: '',
      accent: 'mid',
    }),
    namedTier({
      id: 'pro',
      name: 'Pro',
      minSeats: 101,
      maxSeats: 300,
      discount: 0.18,
      seatPrices: prices(0.18),
      features: ['A lower per-seat price', 'Active-student billing where configured', 'Invoice PDF'],
      quoteContact: false,
      selfServe: true,
      contactHref: '',
      accent: 'bright',
    }),
    namedTier({
      id: 'enterprise',
      name: 'Enterprise',
      minSeats: 301,
      maxSeats: null,
      discount: 0.25,
      seatPrices: prices(0.25),
      features: ['The lowest per-seat price', 'Custom pricing and a quote', 'Self-serve checkout stays open'],
      quoteContact: true,
      selfServe: true,
      contactHref: ENTERPRISE_CONTACT,
      accent: 'bright',
    }),
  ];
  return {
    placeholder: true,
    note: CATALOGUE_NOTE,
    baseCurrency: 'USD',
    annualDiscount: 0.2,
    quoteMinSeats: 50,
    trialDays: 14,
    trialSeatCap: 25,
    tiers,
    bundleRules: [
      { id: 'two-programmes', minProgrammes: 2, discount: 0.05, placeholder: true },
      { id: 'three-programmes', minProgrammes: 3, discount: 0.1, placeholder: true },
    ],
    currencies: [
      { code: 'USD', rate: 1, enabled: true, placeholder: true, countries: [] },
      { code: 'MYR', rate: 4.7, enabled: true, placeholder: true, countries: ['MY'] },
      { code: 'GBP', rate: 0.79, enabled: true, placeholder: true, countries: ['GB', 'UK'] },
    ],
    items,
  };
}

export function tierRangeLabel(tier: Pick<CatalogueTier, 'minSeats' | 'maxSeats'>): string {
  if (tier.maxSeats == null) return `${Math.max(0, tier.minSeats - 1)}+`;
  return `${tier.minSeats}–${tier.maxSeats}`;
}

/** The strongest bundle whose programme minimum the selection meets. */
export function bundleFor(catalogue: InstitutionCatalogue, programmeCount: number): BundleRule | null {
  const matches = catalogue.bundleRules
    .filter((rule) => programmeCount >= rule.minProgrammes && rule.discount > 0)
    .sort((a, b) => b.minProgrammes - a.minProgrammes || b.discount - a.discount);
  return matches[0] ?? null;
}

/** Per-seat monthly USD for one programme on a tier. A listed tier price wins. */
export function tierUnitMonthly(tier: CatalogueTier, entry: Pick<CatalogueItem, 'id' | 'perSeatMonthly'>): number {
  const listed = tier.seatPrices.find((row) => row.itemId === entry.id);
  if (listed && Number.isFinite(listed.perSeatMonthly)) return Math.max(0, listed.perSeatMonthly);
  return entry.perSeatMonthly * (1 - Math.min(1, Math.max(0, tier.discount)));
}

export function billableSeats(entry: Pick<CatalogueItem, 'billingBasis' | 'minimumSeats'>, purchased: number, active: number): number {
  const bought = Math.max(0, Math.floor(purchased));
  const live = Math.max(0, Math.floor(active));
  if (entry.billingBasis === 'active_minimum') return Math.max(entry.minimumSeats, live);
  return bought;
}

export function seatOverage(
  entry: Pick<CatalogueItem, 'overage'>,
  purchased: number,
  active: number,
): { status: 'within' | SeatOverage; extra: number } {
  const extra = Math.max(0, Math.floor(active) - Math.floor(purchased));
  if (extra === 0) return { status: 'within', extra: 0 };
  return { status: entry.overage, extra };
}

export function proratedSeatAdd(input: {
  perSeat: number;
  extra: number;
  daysRemaining: number;
  daysInPeriod: number;
}): number | { error: string } {
  if (!Number.isFinite(input.perSeat) || input.perSeat < 0) return { error: 'The per-student price is missing.' };
  if (!Number.isInteger(input.extra) || input.extra < 0) return { error: 'Extra seats are a whole number.' };
  if (!Number.isInteger(input.daysRemaining) || !Number.isInteger(input.daysInPeriod) || input.daysInPeriod <= 0) {
    return { error: 'The billing period needs a start and an end date.' };
  }
  if (input.daysRemaining < 0 || input.daysRemaining > input.daysInPeriod) return { error: 'Seat changes apply inside the current period.' };
  return round2(input.perSeat * input.extra * (input.daysRemaining / input.daysInPeriod));
}

export function tierForSeats(catalogue: InstitutionCatalogue, seats: number): CatalogueTier | null {
  const count = Math.max(0, Math.floor(seats));
  const ordered = [...catalogue.tiers].sort((a, b) => a.minSeats - b.minSeats);
  return ordered.find((tier) => count >= tier.minSeats && (tier.maxSeats == null || count <= tier.maxSeats)) ?? null;
}

export interface TierReview {
  action: 'stay' | 'upgrade' | 'suggest_downgrade';
  students: number;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  nextSeats: number;
  nextTotal: number;
  charge: number;
  savings: number;
  currency: string;
  sparks: number;
  lines: CatalogueLine[];
  itemIds: string[];
  periodEnd: string;
  message: string;
  noticeKey: string;
}

function isoDays(from: string, to: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function stayReview(students: number, from: CatalogueTier | null, periodEnd: string): TierReview {
  return {
    action: 'stay',
    students,
    fromId: from?.id ?? '',
    fromName: from?.name ?? '',
    toId: from?.id ?? '',
    toName: from?.name ?? '',
    nextSeats: students,
    nextTotal: 0,
    charge: 0,
    savings: 0,
    currency: '',
    sparks: 0,
    lines: [],
    itemIds: [],
    periodEnd,
    message: '',
    noticeKey: '',
  };
}

/**
 * A larger student count moves the academy up a tier now.
 * A smaller count waits, and the cheaper tier is suggested at renewal.
 */
export function planTierReview(input: {
  catalogue?: InstitutionCatalogue;
  currentTierId?: string;
  currentSeats: number;
  currentTotal: number;
  students: number;
  itemIds: readonly string[];
  interval: 'monthly' | 'annual';
  country: string;
  tender?: 'card' | 'fpx' | 'invoice' | 'trial';
  periodStart: string;
  periodEnd: string;
  on: string;
}): TierReview | { error: string } {
  const catalogue = input.catalogue ?? seedInstitutionCatalogue();
  const students = Math.floor(input.students);
  const currentSeats = Math.floor(input.currentSeats);
  const current = (input.currentTierId ? catalogue.tiers.find((tier) => tier.id === input.currentTierId) : undefined)
    ?? tierForSeats(catalogue, currentSeats);
  if (!Number.isInteger(students) || students < 1 || !current) return stayReview(Math.max(0, students), current, input.periodEnd);
  const destination = tierForSeats(catalogue, students);
  if (!destination || destination.id === current.id) return stayReview(students, current, input.periodEnd);
  const upgrade = destination.minSeats > current.minSeats;
  const nextSeats = upgrade ? Math.max(currentSeats, students) : students;
  const priced = priceCatalogue({
    catalogue,
    itemIds: input.itemIds,
    purchasedSeats: nextSeats,
    activeSeats: students,
    interval: input.interval,
    country: input.country,
    tender: input.tender ?? 'card',
  });
  if ('error' in priced) return priced;
  if (!upgrade) {
    const savings = round2(input.currentTotal - priced.total);
    if (!(savings > 0)) return stayReview(students, current, input.periodEnd);
    const when = /^\d{4}-\d{2}-\d{2}$/.test(input.periodEnd) ? input.periodEnd : 'renewal';
    return {
      action: 'suggest_downgrade',
      students,
      fromId: current.id,
      fromName: current.name,
      toId: destination.id,
      toName: destination.name,
      nextSeats,
      nextTotal: priced.total,
      charge: 0,
      savings,
      currency: priced.currency,
      sparks: priced.sparks,
      lines: priced.lines,
      itemIds: priced.itemIds,
      periodEnd: input.periodEnd,
      message: `At renewal on ${when}, ${destination.name} matches ${students} unique students and is ${priced.currency} ${savings.toFixed(2)} less for the period.`,
      noticeKey: `suggest:${destination.id}:${input.periodEnd}`,
    };
  }
  const daysInPeriod = isoDays(input.periodStart, input.periodEnd);
  const daysRemaining = isoDays(input.on, input.periodEnd);
  if (daysInPeriod == null || daysRemaining == null || daysInPeriod <= 0 || daysRemaining < 0 || daysRemaining > daysInPeriod) {
    return { error: 'The billing period needs a start and an end date.' };
  }
  const net = round2((priced.total - input.currentTotal) * (daysRemaining / daysInPeriod));
  const charge = net > 0 ? net : 0;
  const money = charge > 0
    ? ` The prorated charge for the days left is ${priced.currency} ${charge.toFixed(2)}.`
    : ' The new tier applies for the days left in this period.';
  return {
    action: 'upgrade',
    students,
    fromId: current.id,
    fromName: current.name,
    toId: destination.id,
    toName: destination.name,
    nextSeats,
    nextTotal: priced.total,
    charge,
    savings: 0,
    currency: priced.currency,
    sparks: priced.sparks,
    lines: priced.lines,
    itemIds: priced.itemIds,
    periodEnd: input.periodEnd,
    message: `${destination.name} matches ${students} unique students.${money}`,
    noticeKey: `upgrade:${destination.id}:${nextSeats}`,
  };
}

export function currencyForCountry(catalogue: InstitutionCatalogue, country: string): { code: string; rate: number } {
  const code = country.trim().toUpperCase();
  const match = catalogue.currencies.find((row) => row.enabled && row.countries.includes(code) && row.rate > 0);
  if (!match) return { code: 'USD', rate: 1 };
  return { code: match.code, rate: match.rate };
}

function listed(entry: CatalogueItem, planId: VolumePlanId, access: 'subscription' | 'a_la_carte'): boolean {
  if (entry.planId !== 'any' && entry.planId !== planId) return false;
  if (entry.access === 'both') return true;
  return entry.access === access;
}

export function catalogueItemsFor(catalogue: InstitutionCatalogue, planId: VolumePlanId, access: 'subscription' | 'a_la_carte'): CatalogueItem[] {
  return catalogue.items.filter((entry) => listed(entry, planId, access));
}

export function priceCatalogue(input: {
  catalogue?: InstitutionCatalogue;
  itemIds: readonly string[];
  purchasedSeats: number;
  activeSeats?: number;
  interval: 'monthly' | 'annual';
  country: string;
  tender: 'card' | 'fpx' | 'invoice' | 'trial';
}): CatalogueQuote | { error: string } {
  const catalogue = input.catalogue ?? seedInstitutionCatalogue();
  const purchased = Math.floor(input.purchasedSeats);
  const active = Math.floor(input.activeSeats ?? purchased);
  if (!Number.isInteger(purchased) || purchased < 1) return { error: 'Choose at least one seat.' };
  if (!Number.isInteger(active) || active < 0) return { error: 'Active students are a whole number.' };
  const wanted = input.itemIds.filter((id) => id.trim());
  if (wanted.length === 0) return { error: 'Choose at least one programme or category.' };
  const byId = new Map(catalogue.items.map((entry) => [entry.id, entry]));
  const selected: CatalogueItem[] = [];
  for (const id of wanted) {
    const entry = byId.get(id);
    if (!entry) return { error: 'One of those programmes is not on the catalogue.' };
    selected.push(entry);
  }
  const tier = tierForSeats(catalogue, purchased);
  if (!tier) return { error: 'That seat count is outside the configured tiers.' };
  const annual = input.interval === 'annual';
  const discount = Math.min(1, Math.max(0, tier.discount));
  const annualDiscount = Math.min(1, Math.max(0, catalogue.annualDiscount));
  const programmeCount = selected.filter((entry) => entry.kind === 'programme').length;
  const bundle = bundleFor(catalogue, programmeCount);
  const bundleDiscount = bundle ? Math.min(1, Math.max(0, bundle.discount)) : 0;
  const notices: string[] = [];
  if (bundle) {
    notices.push(`${programmeCount} programmes: ${(bundleDiscount * 100).toFixed(0)}% bundle discount. The tier still follows ${purchased} unique students.`);
  }
  const lines: CatalogueLine[] = selected.map((entry) => {
    const seats = billableSeats(entry, purchased, active);
    const bundled = entry.kind === 'programme' ? (1 - bundleDiscount) : 1;
    const monthly = tierUnitMonthly(tier, entry) * bundled;
    const unit = round2(annual ? monthly * 12 * (1 - annualDiscount) : monthly);
    const over = seatOverage(entry, purchased, active);
    if (over.status === 'prompt') {
      notices.push(`${entry.title}: ${over.extra} active students are above the purchased seats. Add seats and the extra is prorated for the days left.`);
    }
    if (over.status === 'auto_add') {
      notices.push(`${entry.title}: ${over.extra} seats will be added automatically and prorated for the days left.`);
    }
    return {
      id: entry.id,
      title: entry.title,
      kind: entry.kind,
      seats,
      unit,
      amount: round2(unit * seats),
      sparks: entry.sparksPerSeat * seats,
      billingBasis: entry.billingBasis,
      overage: over.status,
      extraSeats: over.extra,
    };
  });
  const subtotalUsd = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const fx = currencyForCountry(catalogue, input.country);
  const subtotal = round2(subtotalUsd * fx.rate);
  const taxKind = input.tender === 'invoice' || input.tender === 'trial' ? 'invoice' : 'course';
  const taxRate = taxRateFor(taxKind, input.country, fx.code);
  const tax = round2(subtotal * taxRate);
  return {
    currency: fx.code,
    baseCurrency: 'USD',
    interval: input.interval,
    tierId: tier.id,
    tierLabel: tier.name,
    tierDiscount: discount,
    quoteContact: tier.quoteContact,
    selfServe: tier.selfServe,
    features: tier.features,
    annualDiscount: annual ? annualDiscount : 0,
    uniqueStudents: purchased,
    programmeCount,
    bundleDiscount,
    purchasedSeats: purchased,
    activeSeats: active,
    subtotalUsd,
    subtotal,
    taxRate,
    tax,
    total: round2(subtotal + tax),
    sparks: lines.reduce((sum, line) => sum + line.sparks, 0),
    placeholder: catalogue.placeholder || selected.some((entry) => entry.placeholder),
    lines,
    notices,
    itemIds: selected.map((entry) => entry.id),
    itemTitles: selected.map((entry) => entry.title),
  };
}

export function catalogueDocumentLines(input: {
  kind: 'quote' | 'invoice';
  institutionName: string;
  issuedOn: string;
  quote: CatalogueQuote;
  poNumber?: string;
}): string[] {
  const money = (amount: number) => `${input.quote.currency} ${amount.toFixed(2)}`;
  const period = input.quote.interval === 'annual' ? 'per year' : 'per month';
  const lines = [
    input.kind === 'invoice' ? 'Poket School invoice' : 'Poket School quote',
    input.quote.placeholder ? 'PLACEHOLDER prices. A super admin can replace them.' : '',
    input.institutionName,
    `Issued ${input.issuedOn}`,
    input.poNumber ? `Reference ${input.poNumber}` : '',
    `Seats purchased ${input.quote.purchasedSeats}`,
    `Active students ${input.quote.activeSeats}`,
    `Tier ${input.quote.tierLabel}`,
    `Unique students ${input.quote.uniqueStudents}`,
    input.quote.bundleDiscount > 0 ? `Bundle ${input.quote.programmeCount} programmes ${(input.quote.bundleDiscount * 100).toFixed(0)}%` : '',
    input.quote.quoteContact ? 'Custom pricing. Request a quote, or continue with self-serve checkout.' : '',
  ];
  for (const line of input.quote.lines) {
    lines.push(`${line.title} · ${line.seats} seats · ${money(line.unit)} ${period} · ${money(line.amount)}`);
  }
  lines.push(
    `Subtotal ${money(input.quote.subtotal)}`,
    `Tax ${money(input.quote.tax)}`,
    `Total ${money(input.quote.total)}`,
    `Sparks ${input.quote.sparks}`,
  );
  return lines.filter((line) => line.length > 0);
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function matchingItemIds(catalogue: InstitutionCatalogue, course: CatalogueCourse): string[] {
  const ids = new Set<string>();
  for (const entry of catalogue.items) {
    if (course.programmeId && course.programmeId === entry.id) ids.add(entry.id);
    if (course.categoryId && course.categoryId === entry.id) ids.add(entry.id);
    if (course.category && (sameName(course.category, entry.id) || sameName(course.category, entry.title))) ids.add(entry.id);
    if (course.subject && entry.kind === 'category' && sameName(course.subject, entry.title)) ids.add(entry.id);
    if (course.tags?.some((tag) => sameName(tag, entry.id) || sameName(tag, entry.title))) ids.add(entry.id);
    if (course.level && entry.level && sameName(course.level, entry.level) && entry.kind === 'programme') ids.add(entry.id);
  }
  return [...ids];
}

export function institutionOffersCourse(catalogue: InstitutionCatalogue, paidIds: readonly string[], course: CatalogueCourse): boolean {
  const paid = new Set(paidIds);
  return matchingItemIds(catalogue, course).some((id) => paid.has(id));
}

/** A course stays in the library when it matches no catalogue item, or when a paid item covers it. */
export function institutionLibraryIncludes(catalogue: InstitutionCatalogue, paidIds: readonly string[], course: CatalogueCourse): boolean {
  const matches = matchingItemIds(catalogue, course);
  if (matches.length === 0) return true;
  return matches.some((id) => paidIds.includes(id));
}

export function sameSelection(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function grantCovers(grant: ProgrammeGrant | undefined, studentId: string, studentLevel: string): boolean {
  if (!grant) return false;
  if (grant.studentIds.includes(studentId)) return true;
  return Boolean(studentLevel) && grant.levels.some((level) => sameName(level, studentLevel));
}

/** A student sees a course when the academy paid for it and the student or their level is assigned. */
export function studentSeesPaidCourse(input: {
  catalogue?: InstitutionCatalogue;
  paidIds: readonly string[];
  grants: readonly ProgrammeGrant[];
  studentId: string;
  studentLevel: string;
  course: CatalogueCourse;
}): boolean {
  const catalogue = input.catalogue ?? seedInstitutionCatalogue();
  const matches = matchingItemIds(catalogue, input.course);
  if (matches.length === 0) return true;
  if (input.course.level && input.studentLevel && !sameName(input.course.level, input.studentLevel)) return false;
  const paid = matches.filter((id) => input.paidIds.includes(id));
  if (paid.length === 0) return false;
  return paid.some((id) => grantCovers(input.grants.find((grant) => grant.itemId === id), input.studentId, input.studentLevel));
}

export function programmeRevenue(rows: readonly RevenueInput[]): RevenueCell[] {
  const cells: RevenueCell[] = [];
  for (const row of rows) {
    for (const line of row.lines) {
      const found = cells.find((cell) => cell.institutionId === row.institutionId && cell.itemId === line.id && cell.currency === row.currency);
      if (found) found.amount = round2(found.amount + line.amount);
      else cells.push({
        institutionId: row.institutionId,
        name: row.name,
        itemId: line.id,
        title: line.title,
        currency: row.currency,
        amount: round2(line.amount),
      });
    }
  }
  return cells.sort((a, b) => a.name.localeCompare(b.name) || a.title.localeCompare(b.title));
}

function finite(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function validateCatalogue(catalogue: InstitutionCatalogue): string | null {
  if (catalogue.annualDiscount < 0 || catalogue.annualDiscount > 1) return 'The annual discount is between 0 and 100%.';
  const bundleMins = new Set<number>();
  for (const rule of catalogue.bundleRules) {
    if (!Number.isInteger(rule.minProgrammes) || rule.minProgrammes < 2) return 'A bundle discount starts at 2 programmes.';
    if (bundleMins.has(rule.minProgrammes)) return 'Each bundle step needs its own programme count.';
    bundleMins.add(rule.minProgrammes);
    if (rule.discount < 0 || rule.discount > 1) return 'A bundle discount is between 0 and 100%.';
  }
  if (!Number.isInteger(catalogue.trialDays) || catalogue.trialDays < 1 || catalogue.trialDays > 90) return 'Trial length is between 1 and 90 days.';
  if (!Number.isInteger(catalogue.trialSeatCap) || catalogue.trialSeatCap < 1) return 'The trial needs a seat cap.';
  if (!Number.isInteger(catalogue.quoteMinSeats) || catalogue.quoteMinSeats < 1) return 'The quote minimum is a whole number of seats.';
  if (catalogue.items.length === 0) return 'Add at least one programme or category.';
  if (catalogue.tiers.length === 0) return 'Add at least one seat tier.';
  const ordered = [...catalogue.tiers].sort((a, b) => a.minSeats - b.minSeats);
  let previous = 0;
  const tierIds = new Set<string>();
  for (const tier of ordered) {
    if (!tier.id.trim() || tierIds.has(tier.id)) return 'Each tier needs its own id.';
    tierIds.add(tier.id);
    if (!Number.isInteger(tier.minSeats) || tier.minSeats < previous) return 'Seat tiers cannot overlap.';
    if (tier.maxSeats != null && (!Number.isInteger(tier.maxSeats) || tier.maxSeats < tier.minSeats)) return 'A tier maximum is at least its minimum.';
    if (!tier.name.trim()) return 'Each tier needs a name.';
    if (tier.discount < 0 || tier.discount > 1) return 'A tier discount is between 0 and 100%.';
    if (tier.seatPrices.some((row) => row.perSeatMonthly < 0)) return 'A per-tier seat price is zero or greater.';
    if (tier.quoteContact && !tier.contactHref.trim()) return 'A quote tier needs a contact link.';
    previous = (tier.maxSeats ?? tier.minSeats) + 1;
  }
  const ids = new Set<string>();
  for (const entry of catalogue.items) {
    if (!entry.id.trim() || ids.has(entry.id)) return 'Each programme needs its own id.';
    ids.add(entry.id);
    if (entry.perSeatMonthly < 0) return 'A per-seat price is zero or greater.';
    if (entry.sparksPerSeat < 0 || !Number.isInteger(entry.sparksPerSeat)) return 'Sparks per seat are a whole number.';
    if (!Number.isInteger(entry.minimumSeats) || entry.minimumSeats < 0) return 'A minimum seat count is a whole number.';
  }
  for (const currency of catalogue.currencies) {
    if (!/^[A-Z]{3}$/.test(currency.code)) return 'Currency is a three-letter code.';
    if (currency.enabled && currency.rate <= 0) return 'An enabled currency needs a rate above zero.';
  }
  return null;
}

export function normalizeCatalogue(value: unknown): InstitutionCatalogue {
  const seed = seedInstitutionCatalogue();
  if (!value || typeof value !== 'object') return seed;
  const raw = value as Partial<InstitutionCatalogue>;
  if (!Array.isArray(raw.items) || !Array.isArray(raw.tiers)) return seed;
  const catalogue: InstitutionCatalogue = {
    placeholder: raw.placeholder !== false,
    note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : seed.note,
    baseCurrency: 'USD',
    annualDiscount: Math.min(1, Math.max(0, finite(raw.annualDiscount, seed.annualDiscount))),
    quoteMinSeats: Math.floor(finite(raw.quoteMinSeats, seed.quoteMinSeats)),
    trialDays: Math.floor(finite(raw.trialDays, seed.trialDays)),
    trialSeatCap: Math.floor(finite(raw.trialSeatCap, seed.trialSeatCap)),
    bundleRules: Array.isArray(raw.bundleRules)
      ? raw.bundleRules.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const rule = row as Partial<BundleRule>;
        const id = typeof rule.id === 'string' ? rule.id.trim() : '';
        if (!id) return [];
        return [{
          id,
          minProgrammes: Math.floor(finite(rule.minProgrammes, 2)),
          discount: Math.min(1, Math.max(0, finite(rule.discount, 0))),
          placeholder: rule.placeholder !== false,
        }];
      })
      : seed.bundleRules,
    tiers: raw.tiers.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const tier = row as Partial<CatalogueTier>;
      const id = typeof tier.id === 'string' ? tier.id.trim() : '';
      if (!id) return [];
      const max = tier.maxSeats == null || tier.maxSeats === undefined ? null : Math.floor(finite(tier.maxSeats, 0));
      const name = typeof tier.name === 'string' && tier.name.trim()
        ? tier.name.trim()
        : typeof tier.label === 'string' && tier.label.trim() ? tier.label.trim() : id;
      const accent = readTierAccent(tier.accent);
      const href = typeof tier.contactHref === 'string' ? tier.contactHref.trim() : '';
      const safeHref = href.startsWith('/') || href.startsWith('mailto:') || href.startsWith('https://') ? href : '';
      return [{
        id,
        name,
        label: name,
        minSeats: Math.max(0, Math.floor(finite(tier.minSeats, 0))),
        maxSeats: max,
        discount: Math.min(1, Math.max(0, finite(tier.discount, 0))),
        seatPrices: Array.isArray(tier.seatPrices)
          ? tier.seatPrices.flatMap((row) => {
            if (!row || typeof row !== 'object') return [];
            const price = row as Partial<TierSeatPrice>;
            const itemId = typeof price.itemId === 'string' ? price.itemId.trim() : '';
            if (!itemId) return [];
            return [{ itemId, perSeatMonthly: Math.max(0, finite(price.perSeatMonthly, 0)) }];
          })
          : [],
        features: Array.isArray(tier.features)
          ? tier.features.filter((feature): feature is string => typeof feature === 'string' && feature.trim().length > 0).map((feature) => feature.trim()).slice(0, 12)
          : [],
        quoteContact: tier.quoteContact === true,
        selfServe: tier.selfServe !== false,
        contactHref: safeHref,
        accent,
        placeholder: tier.placeholder !== false,
      }];
    }),
    currencies: Array.isArray(raw.currencies) && raw.currencies.length
      ? raw.currencies.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const currency = row as Partial<CatalogueCurrency>;
        const code = typeof currency.code === 'string' ? currency.code.trim().toUpperCase() : '';
        if (!/^[A-Z]{3}$/.test(code)) return [];
        return [{
          code,
          rate: finite(currency.rate, 1),
          enabled: currency.enabled !== false,
          placeholder: currency.placeholder !== false,
          countries: Array.isArray(currency.countries) ? currency.countries.filter((item): item is string => typeof item === 'string') : [],
        }];
      })
      : seed.currencies,
    items: raw.items.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const entry = row as Partial<CatalogueItem>;
      const id = typeof entry.id === 'string' ? entry.id.trim() : '';
      if (!id) return [];
      const basis: BillingBasis = entry.billingBasis === 'active_minimum' ? 'active_minimum' : 'purchased';
      const overage: SeatOverage = entry.overage === 'auto_add' ? 'auto_add' : 'prompt';
      const access: CatalogueAccess = entry.access === 'subscription' || entry.access === 'a_la_carte' ? entry.access : 'both';
      const planId: CataloguePlan = entry.planId === 'any' || entry.planId === 'primary_secondary' || entry.planId === 'igcse_alevel' || entry.planId === 'professional'
        ? entry.planId
        : 'any';
      return [{
        id,
        title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : id,
        kind: entry.kind === 'category' ? 'category' : 'programme',
        level: typeof entry.level === 'string' ? entry.level.trim() : '',
        planId,
        access,
        perSeatMonthly: Math.max(0, finite(entry.perSeatMonthly, 0)),
        placeholder: entry.placeholder !== false,
        sparksPerSeat: Math.max(0, Math.floor(finite(entry.sparksPerSeat, 0))),
        billingBasis: basis,
        minimumSeats: Math.max(0, Math.floor(finite(entry.minimumSeats, 1))),
        overage,
      }];
    }),
  };
  return validateCatalogue(catalogue) ? seed : catalogue;
}
