/**
 * Institution volume pricing.
 *
 * Default money comes from the owner-supplied Pearson UK Secondary
 * Resources Price List 2023, sheet MASTER, and only from rows that state
 * a learner count. Amounts the lists do not publish stay 0. This file does
 * not convert currencies and does not divide a school licence by a headcount.
 */

export const VOLUME_PLANS = [
  { id: 'primary_secondary', name: 'Primary & Lower Secondary' },
  { id: 'igcse_alevel', name: 'IGCSE & A-Level' },
  { id: 'professional', name: 'Professional & Degrees' },
] as const;

export const VOLUME_ADDONS = [
  { id: 'et_ai_live', name: 'ET AI Live' },
  { id: 'poket_reads', name: 'Poket Reads' },
] as const;

export type VolumePlanId = (typeof VOLUME_PLANS)[number]['id'];
export type VolumeAddonId = (typeof VOLUME_ADDONS)[number]['id'];
export type VolumeInterval = 'monthly' | 'annual';

/**
 * Edexcel AS and A level Mathematics and Further Mathematics ActiveLearn
 * Digital Service Subscription. USD column, sheet MASTER.
 * GBP on the same rows: 271, 430, 680. EUR: 307.99, 488.99, 772.99.
 */
export const ALEVEL_MATHS_ACTIVELEARN_USD = {
  users1to10: 365.99,
  under100: 580.99,
  users100plus: 917.99,
} as const;

export interface VolumeTier {
  id: string;
  label: string;
  minStudents: number;
  maxStudents: number | null;
}

export interface TierPrice {
  tierId: string;
  monthlyPerStudent: number;
  annualPerStudent: number;
  flatMonthly: number;
  flatAnnual: number;
}

export interface PlanVolumePrice {
  id: VolumePlanId;
  tiers: TierPrice[];
}

export interface AddonVolumePrice {
  id: VolumeAddonId;
  monthlyPerStudent: number;
  annualPerStudent: number;
  flatMonthly: number;
  flatAnnual: number;
}

export interface InstitutionVolumeSchedule {
  currency: string;
  tiers: VolumeTier[];
  plans: PlanVolumePrice[];
  addons: AddonVolumePrice[];
}

export interface InstitutionPriceOverride {
  planId: VolumePlanId;
  interval: VolumeInterval;
  discountPercent: number;
  addons: VolumeAddonId[];
  waivePlatformFee: boolean;
  /** When set, replaces the schedule per-student price for the chosen interval. */
  customPerStudent: number | null;
}

export interface VolumeQuote {
  tierId: string;
  tierLabel: string;
  seats: number;
  planId: VolumePlanId;
  interval: VolumeInterval;
  currency: string;
  perStudent: number;
  studentTotal: number;
  platformFee: number;
  addonTotal: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
}

export type RenewalReminder = 'none' | 'ok' | 'soon' | 'due' | 'lapsed';

const PLAN_IDS = new Set<string>(VOLUME_PLANS.map((plan) => plan.id));
const ADDON_IDS = new Set<string>(VOLUME_ADDONS.map((addon) => addon.id));

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function nonNegative(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return round2(number);
}

function emptyTierPrice(tierId: string): TierPrice {
  return { tierId, monthlyPerStudent: 0, annualPerStudent: 0, flatMonthly: 0, flatAnnual: 0 };
}

function emptyAddon(id: VolumeAddonId): AddonVolumePrice {
  return { id, monthlyPerStudent: 0, annualPerStudent: 0, flatMonthly: 0, flatAnnual: 0 };
}

export function seedInstitutionPricing(): InstitutionVolumeSchedule {
  const tiers: VolumeTier[] = [
    { id: '0-10', label: '0–10', minStudents: 0, maxStudents: 10 },
    { id: '11-50', label: '11–50', minStudents: 11, maxStudents: 50 },
    { id: '51-99', label: '51–99', minStudents: 51, maxStudents: 99 },
    { id: '100-300', label: '100–300', minStudents: 100, maxStudents: 300 },
    { id: '301-plus', label: '301+', minStudents: 301, maxStudents: null },
  ];
  const zeros = tiers.map((tier) => emptyTierPrice(tier.id));
  const fee = (tierId: string, flatAnnual: number): TierPrice => ({
    ...emptyTierPrice(tierId),
    flatAnnual,
  });
  return {
    currency: 'USD',
    tiers,
    plans: [
      { id: 'primary_secondary', tiers: zeros.map((row) => ({ ...row })) },
      {
        id: 'igcse_alevel',
        tiers: [
          fee('0-10', ALEVEL_MATHS_ACTIVELEARN_USD.users1to10),
          fee('11-50', ALEVEL_MATHS_ACTIVELEARN_USD.under100),
          fee('51-99', ALEVEL_MATHS_ACTIVELEARN_USD.under100),
          fee('100-300', ALEVEL_MATHS_ACTIVELEARN_USD.users100plus),
          fee('301-plus', ALEVEL_MATHS_ACTIVELEARN_USD.users100plus),
        ],
      },
      { id: 'professional', tiers: zeros.map((row) => ({ ...row })) },
    ],
    addons: VOLUME_ADDONS.map((addon) => emptyAddon(addon.id)),
  };
}

export function blankPriceOverride(partial: Partial<InstitutionPriceOverride> = {}): InstitutionPriceOverride {
  const addons = (partial.addons ?? []).filter((id): id is VolumeAddonId => ADDON_IDS.has(id));
  return {
    planId: 'igcse_alevel',
    interval: 'annual',
    discountPercent: 0,
    waivePlatformFee: false,
    customPerStudent: null,
    ...partial,
    addons,
  };
}

export function planName(id: string): string {
  return VOLUME_PLANS.find((plan) => plan.id === id)?.name ?? id;
}

export function addonName(id: string): string {
  return VOLUME_ADDONS.find((addon) => addon.id === id)?.name ?? id;
}

export function tierForSeats(schedule: InstitutionVolumeSchedule, seats: number): VolumeTier | null {
  const count = Math.max(0, Math.floor(Number.isFinite(seats) ? seats : 0));
  const ordered = [...schedule.tiers].sort((a, b) => a.minStudents - b.minStudents);
  return ordered.find((tier) => count >= tier.minStudents && (tier.maxStudents == null || count <= tier.maxStudents)) ?? null;
}

export function tierPrice(schedule: InstitutionVolumeSchedule, planId: VolumePlanId, tierId: string): TierPrice {
  const plan = schedule.plans.find((item) => item.id === planId);
  return plan?.tiers.find((row) => row.tierId === tierId) ?? emptyTierPrice(tierId);
}

export function validateVolumeSchedule(schedule: InstitutionVolumeSchedule): string | null {
  if (!/^[A-Z]{3}$/.test(schedule.currency.trim().toUpperCase())) return 'Currency is a three-letter code.';
  if (schedule.tiers.length === 0) return 'Add at least one student tier.';
  const ordered = [...schedule.tiers].sort((a, b) => a.minStudents - b.minStudents);
  let previousMax = -1;
  const ids = new Set<string>();
  for (const tier of ordered) {
    if (!tier.id.trim()) return 'Each tier needs an id.';
    if (ids.has(tier.id)) return 'Tier ids must be unique.';
    ids.add(tier.id);
    if (!Number.isInteger(tier.minStudents) || tier.minStudents < 0) return 'Tier minimums are whole numbers from 0.';
    if (tier.maxStudents != null && (!Number.isInteger(tier.maxStudents) || tier.maxStudents < tier.minStudents)) {
      return 'A tier maximum is at least its minimum.';
    }
    if (tier.minStudents <= previousMax) return 'Student tiers cannot overlap.';
    previousMax = tier.maxStudents ?? Number.POSITIVE_INFINITY;
  }
  for (const plan of schedule.plans) {
    if (!PLAN_IDS.has(plan.id)) return 'Unknown plan level.';
    for (const row of plan.tiers) {
      if (!ids.has(row.tierId)) return 'A plan price points at a missing tier.';
      if ([row.monthlyPerStudent, row.annualPerStudent, row.flatMonthly, row.flatAnnual].some((value) => value < 0 || !Number.isFinite(value))) {
        return 'Prices are zero or greater.';
      }
    }
  }
  return null;
}

export function quoteInstitution(input: {
  schedule: InstitutionVolumeSchedule;
  seats: number;
  override?: Partial<InstitutionPriceOverride>;
}): VolumeQuote {
  const override = blankPriceOverride(input.override);
  const seats = Math.max(0, Math.floor(Number.isFinite(input.seats) ? input.seats : 0));
  const tier = tierForSeats(input.schedule, seats);
  const price = tier ? tierPrice(input.schedule, override.planId, tier.id) : emptyTierPrice('');
  const schedulePerStudent = override.interval === 'annual' ? price.annualPerStudent : price.monthlyPerStudent;
  const perStudent = override.customPerStudent == null ? schedulePerStudent : round2(Math.max(0, override.customPerStudent));
  const platformFee = override.waivePlatformFee
    ? 0
    : (override.interval === 'annual' ? price.flatAnnual : price.flatMonthly);
  let addonTotal = 0;
  for (const addonId of override.addons) {
    const addon = input.schedule.addons.find((item) => item.id === addonId) ?? emptyAddon(addonId);
    const per = override.interval === 'annual' ? addon.annualPerStudent : addon.monthlyPerStudent;
    const flat = override.interval === 'annual' ? addon.flatAnnual : addon.flatMonthly;
    addonTotal += flat + seats * per;
  }
  const studentTotal = round2(seats * perStudent);
  const subtotal = round2(studentTotal + platformFee + addonTotal);
  const discountPercent = Math.min(100, Math.max(0, override.discountPercent));
  const discountAmount = round2(subtotal * (discountPercent / 100));
  return {
    tierId: tier?.id ?? '',
    tierLabel: tier?.label ?? 'No tier',
    seats,
    planId: override.planId,
    interval: override.interval,
    currency: input.schedule.currency.trim().toUpperCase() || 'USD',
    perStudent,
    studentTotal,
    platformFee: round2(platformFee),
    addonTotal: round2(addonTotal),
    subtotal,
    discountPercent,
    discountAmount,
    total: round2(subtotal - discountAmount),
  };
}

export function renewalReminder(renewalOn: string, today: string): RenewalReminder {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(renewalOn) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 'none';
  if (today > renewalOn) return 'lapsed';
  if (today === renewalOn) return 'due';
  const days = Math.round((Date.parse(`${renewalOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days <= 45 ? 'soon' : 'ok';
}

export interface SeatNotices {
  overLimit: boolean;
  upgradeFrom: string | null;
  upgradeTo: string | null;
  renewal: RenewalReminder;
}

/**
 * A higher band must not cost less than the band below it.
 * The fee is the published band total, so one extra student does not fall off a cliff.
 */
export function tierCliff(
  schedule: InstitutionVolumeSchedule,
  planId: VolumePlanId,
  interval: VolumeInterval,
): { fromLabel: string; toLabel: string } | null {
  const ordered = [...schedule.tiers].sort((a, b) => a.minStudents - b.minStudents);
  let previousTotal = -1;
  let previousLabel = '';
  for (const tier of ordered) {
    const quote = quoteInstitution({
      schedule,
      seats: tier.minStudents,
      override: { planId, interval, discountPercent: 0, addons: [], waivePlatformFee: false, customPerStudent: null },
    });
    if (previousLabel && quote.total + 0.001 < previousTotal) {
      return { fromLabel: previousLabel, toLabel: tier.label };
    }
    previousTotal = quote.total;
    previousLabel = tier.label;
  }
  return null;
}

/** Purchased seats pick the tier. Usage above that tier asks for the next one. */
export function seatNotices(input: {
  schedule: InstitutionVolumeSchedule;
  seatsPurchased: number;
  seatsUsed: number;
  renewalOn: string;
  today: string;
}): SeatNotices {
  const purchased = tierForSeats(input.schedule, input.seatsPurchased);
  const used = tierForSeats(input.schedule, input.seatsUsed);
  const upgrade = purchased && used && used.minStudents > purchased.minStudents;
  return {
    overLimit: input.seatsPurchased > 0 && input.seatsUsed > input.seatsPurchased,
    upgradeFrom: upgrade ? purchased.label : null,
    upgradeTo: upgrade ? used.label : null,
    renewal: renewalReminder(input.renewalOn, input.today),
  };
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** A one-page text PDF. Lines are the quote or the invoice; no prices are added here. */
export function documentPdf(lines: readonly string[]): Uint8Array {
  const body = lines.slice(0, 42).map((line) => pdfEscape(line).slice(0, 100));
  const commands = ['BT', '/F1 11 Tf', '14 TL', '48 760 Td'];
  body.forEach((line, index) => {
    commands.push(index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`);
  });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let cursor = '%PDF-1.4\n'.length;
  const offsets = objects.map((object) => {
    const offset = cursor;
    cursor += object.length;
    return offset;
  });
  const xref = [
    'xref\n',
    '0 6\n',
    '0000000000 65535 f \n',
    ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    'trailer << /Size 6 /Root 1 0 R >>\n',
    'startxref\n',
    `${cursor}\n`,
    '%%EOF',
  ].join('');
  return new TextEncoder().encode(`%PDF-1.4\n${objects.join('')}${xref}`);
}

export function quoteLines(input: {
  kind: 'quote' | 'invoice';
  institutionName: string;
  issuedOn: string;
  quote: VolumeQuote;
  poNumber?: string;
}): string[] {
  const money = (amount: number) => `${input.quote.currency} ${amount.toFixed(2)}`;
  const period = input.quote.interval === 'annual' ? 'per year' : 'per month';
  return [
    input.kind === 'invoice' ? 'Poket School invoice' : 'Poket School quote',
    input.institutionName,
    `Issued ${input.issuedOn}`,
    input.poNumber ? `Reference ${input.poNumber}` : '',
    `Plan ${planName(input.quote.planId)}`,
    `Students ${input.quote.seats} · tier ${input.quote.tierLabel}`,
    `Per student ${money(input.quote.perStudent)} ${period}`,
    `Student total ${money(input.quote.studentTotal)}`,
    `Platform fee ${money(input.quote.platformFee)}`,
    `Add-ons ${money(input.quote.addonTotal)}`,
    `Subtotal ${money(input.quote.subtotal)}`,
    `Discount ${input.quote.discountPercent}% ${money(input.quote.discountAmount)}`,
    `Total ${money(input.quote.total)}`,
  ].filter((line) => line.length > 0);
}

function asTier(value: unknown): VolumeTier | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { id?: unknown; label?: unknown; minStudents?: unknown; maxStudents?: unknown };
  const min = nonNegative(row.minStudents);
  const max = row.maxStudents == null || row.maxStudents === '' ? null : nonNegative(row.maxStudents);
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  if (!id || min == null || !Number.isInteger(min)) return null;
  if (max != null && !Number.isInteger(max)) return null;
  return {
    id,
    label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : id,
    minStudents: min,
    maxStudents: max,
  };
}

function asTierPrice(value: unknown): TierPrice | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<TierPrice>;
  const tierId = typeof row.tierId === 'string' ? row.tierId : '';
  const monthlyPerStudent = nonNegative(row.monthlyPerStudent);
  const annualPerStudent = nonNegative(row.annualPerStudent);
  const flatMonthly = nonNegative(row.flatMonthly);
  const flatAnnual = nonNegative(row.flatAnnual);
  if (!tierId || monthlyPerStudent == null || annualPerStudent == null || flatMonthly == null || flatAnnual == null) return null;
  return { tierId, monthlyPerStudent, annualPerStudent, flatMonthly, flatAnnual };
}

/** Missing or damaged documents fall back field by field to the seed. */
export function normalizeVolumeSchedule(value: unknown): InstitutionVolumeSchedule {
  const seed = seedInstitutionPricing();
  if (!value || typeof value !== 'object') return seed;
  const raw = value as Partial<InstitutionVolumeSchedule>;
  const tiers = Array.isArray(raw.tiers) ? raw.tiers.map(asTier).filter((tier): tier is VolumeTier => tier != null) : [];
  const currency = typeof raw.currency === 'string' && /^[A-Za-z]{3}$/.test(raw.currency.trim())
    ? raw.currency.trim().toUpperCase()
    : seed.currency;
  if (tiers.length === 0) return { ...seed, currency };
  const plans = VOLUME_PLANS.map((plan) => {
    const incoming = Array.isArray(raw.plans)
      ? raw.plans.find((item) => item && typeof item === 'object' && (item as PlanVolumePrice).id === plan.id)
      : undefined;
    const rows = Array.isArray(incoming?.tiers) ? incoming.tiers.map(asTierPrice).filter((row): row is TierPrice => row != null) : [];
    return {
      id: plan.id,
      tiers: tiers.map((tier) => rows.find((row) => row.tierId === tier.id) ?? emptyTierPrice(tier.id)),
    };
  });
  const addons = VOLUME_ADDONS.map((addon) => {
    const incoming = Array.isArray(raw.addons)
      ? raw.addons.find((item) => item && typeof item === 'object' && (item as AddonVolumePrice).id === addon.id)
      : undefined;
    if (!incoming) return emptyAddon(addon.id);
    return {
      id: addon.id,
      monthlyPerStudent: nonNegative(incoming.monthlyPerStudent) ?? 0,
      annualPerStudent: nonNegative(incoming.annualPerStudent) ?? 0,
      flatMonthly: nonNegative(incoming.flatMonthly) ?? 0,
      flatAnnual: nonNegative(incoming.flatAnnual) ?? 0,
    };
  });
  const schedule = { currency, tiers, plans, addons };
  return validateVolumeSchedule(schedule) ? seed : schedule;
}

export function normalizePriceOverride(value: unknown): InstitutionPriceOverride {
  if (!value || typeof value !== 'object') return blankPriceOverride();
  const raw = value as Partial<InstitutionPriceOverride>;
  const planId = PLAN_IDS.has(String(raw.planId)) ? raw.planId as VolumePlanId : 'igcse_alevel';
  const interval = raw.interval === 'monthly' ? 'monthly' : 'annual';
  const discount = nonNegative(raw.discountPercent);
  const custom = raw.customPerStudent == null ? null : nonNegative(raw.customPerStudent);
  const addons = Array.isArray(raw.addons)
    ? raw.addons.filter((id): id is VolumeAddonId => typeof id === 'string' && ADDON_IDS.has(id))
    : [];
  return {
    planId,
    interval,
    discountPercent: discount == null ? 0 : Math.min(100, discount),
    addons,
    waivePlatformFee: raw.waivePlatformFee === true,
    customPerStudent: custom,
  };
}
