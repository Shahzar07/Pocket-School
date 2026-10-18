/**
 * Single source for plan, add-on and display prices.
 *
 * Numbers in `seedPricing()` are the fallback used when Firestore has no
 * `pricing_config/current` document. Every public surface formats money
 * through `formatMoney`. USD is the base currency. Other currencies are
 * either a stored rate (local units per 1 USD) plus a rounding rule, or a
 * fixed local amount. Disabled currencies display and charge as USD.
 */

export const PRICING_VERSION = 1 as const;

export const CURRENCY_STORAGE_KEY = 'poket-currency';
export const CURRENCY_SOURCE_KEY = 'poket-currency-source';
export const CURRENCY_EVENT = 'poket-currency-change';

export type Rounding = 'none' | 'whole' | 'charm';
export type CurrencyMode = 'base' | 'rate' | 'fixed';
export type BillingInterval = 'monthly' | 'annual';
export type CurrencySource = 'user' | 'auto';

export interface PlanPrice {
  id: string;
  /** Null until a super admin sets a price. Checkout refuses a null price. */
  monthlyUsd: number | null;
  annualUsd: number | null;
  sparks: number;
}

export interface ReadsPlanPrice {
  id: string;
  monthlyUsd: number;
}

export interface FamilyBundleDiscount {
  secondChildOff: number;
  furtherChildOff: number;
}

export interface AddonPrice {
  id: string;
  monthlyUsd: number;
}

export interface CurrencyPrice {
  code: string;
  enabled: boolean;
  mode: CurrencyMode;
  /** Local currency units for 1 USD. */
  rate: number;
  rounding: Rounding;
  fixedMonthly: Record<string, number>;
  fixedAnnual: Record<string, number>;
}

export interface PricingConfig {
  version: 1;
  /** Fraction off the monthly run-rate, e.g. 0.25 for 25%. */
  annualDiscount: number;
  plans: PlanPrice[];
  addons: AddonPrice[];
  currencies: CurrencyPrice[];
  /** Null until a super admin saves a family bundle discount. */
  familyBundleDiscount: FamilyBundleDiscount | null;
  reads: ReadsPlanPrice[];
}

export interface MoneyQuote {
  amount: number;
  currency: string;
  usd: number;
}

/** Stripe zero-decimal currencies. Unit amounts are the major unit. */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * Country → currency. A mapping is used only when that currency is enabled
 * on the pricing document. Unknown countries, and the United States, stay USD.
 */
const COUNTRY_CURRENCY: Record<string, string> = {
  MY: 'MYR',
  GB: 'GBP',
  UK: 'GBP',
  US: 'USD',
  AT: 'EUR', BE: 'EUR', DE: 'EUR', FR: 'EUR', IE: 'EUR', IT: 'EUR',
  ES: 'EUR', NL: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
  AU: 'AUD', NZ: 'NZD', CA: 'CAD', SG: 'SGD', JP: 'JPY', KR: 'KRW',
  IN: 'INR', CN: 'CNY', HK: 'HKD', AE: 'AED', SA: 'SAR',
  NG: 'NGN', PK: 'PKR', BD: 'BDT', GH: 'GHS', ZA: 'ZAR', KE: 'KES',
  ID: 'IDR', TH: 'THB', VN: 'VND', PH: 'PHP', TR: 'TRY', RU: 'RUB',
  BR: 'BRL', MX: 'MXN', CH: 'CHF',
};

const ROUNDINGS = new Set<Rounding>(['none', 'whole', 'charm']);
const MODES = new Set<CurrencyMode>(['base', 'rate', 'fixed']);

export function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL.has(currency.trim().toUpperCase());
}

export function annualFromMonthly(monthlyUsd: number, discount: number): number {
  const monthly = finite(monthlyUsd, 0);
  const rate = clamp(finite(discount, 0), 0, 1);
  return round2(monthly * 12 * (1 - rate));
}

export function seedPricing(): PricingConfig {
  const annualDiscount = 0.25;
  const drafts: Array<{ id: string; monthlyUsd: number | null; sparks: number; annualUsd: number | null }> = [
    { id: 'preview', monthlyUsd: 0, sparks: 0, annualUsd: 0 },
    { id: 'primary_secondary', monthlyUsd: null, sparks: 300, annualUsd: null },
    // $59 × 12 matches the public IGCSE annual price. A strict 25% of the
    // year would be $711 ($59.25 a month).
    { id: 'igcse_alevel', monthlyUsd: 79, sparks: 800, annualUsd: 708 },
    { id: 'professional', monthlyUsd: null, sparks: 1000, annualUsd: null },
  ];
  return {
    version: 1,
    annualDiscount,
    plans: drafts.map(plan => ({
      id: plan.id,
      monthlyUsd: plan.monthlyUsd,
      sparks: plan.sparks,
      annualUsd: plan.annualUsd,
    })),
    addons: [
      { id: 'et_ai_live', monthlyUsd: 49 },
      { id: 'cms', monthlyUsd: 29 },
    ],
    familyBundleDiscount: null,
    reads: [
      { id: 'reads', monthlyUsd: 9 },
      { id: 'reads-family', monthlyUsd: 15 },
    ],
    currencies: [
      emptyCurrency('USD', { enabled: true, mode: 'base', rate: 1, rounding: 'none' }),
      emptyCurrency('MYR', { enabled: true, mode: 'rate', rate: 4.7, rounding: 'charm' }),
      emptyCurrency('GBP', { enabled: true, mode: 'rate', rate: 0.79, rounding: 'charm' }),
    ],
  };
}

export function roundMoney(amount: number, rounding: Rounding, currency: string): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const zero = isZeroDecimal(currency);
  if (zero || rounding === 'whole') return Math.round(amount);
  if (rounding === 'charm') {
    if (Math.abs(amount) < 1) return round2(amount);
    const sign = amount < 0 ? -1 : 1;
    return sign * (Math.floor(Math.abs(amount)) + 0.99);
  }
  return round2(amount);
}

export function formatMoney(amount: number, currency: string): string {
  const code = (currency || 'USD').trim().toUpperCase();
  const digits = isZeroDecimal(code) ? 0 : 2;
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(digits)}`;
  }
}

export function stripeUnitAmount(amount: number, currency: string): number {
  if (isZeroDecimal(currency)) return Math.round(amount);
  return Math.round(round2(amount) * 100);
}

export function planById(config: PricingConfig, id: string): PlanPrice | undefined {
  return config.plans.find(plan => plan.id === id);
}

export function addonById(config: PricingConfig, id: string): AddonPrice | undefined {
  return config.addons.find(addon => addon.id === id);
}

export function enabledCurrencies(config: PricingConfig): CurrencyPrice[] {
  const list = config.currencies.filter(currency => currency.enabled);
  const usd = list.find(currency => currency.code === 'USD');
  const rest = list.filter(currency => currency.code !== 'USD');
  return usd ? [usd, ...rest] : list;
}

export function isCurrencyEnabled(config: PricingConfig, code: string): boolean {
  const upper = code.trim().toUpperCase();
  if (upper === 'USD') return true;
  return config.currencies.some(currency => currency.code === upper && currency.enabled);
}

export function currencyForCountry(country: string | null | undefined, config: PricingConfig): string {
  const mapped = COUNTRY_CURRENCY[country?.trim().toUpperCase() ?? ''];
  if (mapped && isCurrencyEnabled(config, mapped)) return mapped;
  return 'USD';
}

export function resolveDisplayCurrency(
  config: PricingConfig,
  input: { stored?: string | null; source?: CurrencySource | null; country?: string | null },
): string {
  const stored = input.stored?.trim().toUpperCase() ?? '';
  if (input.source === 'user' && stored && isCurrencyEnabled(config, stored)) return stored;
  return 'USD';
}

/**
 * A local amount beside the price the reader is actually shown.
 * Absent when the local currency is the display currency, or the amount is free.
 * `country` is only used for this conversion — it does not change the price.
 */
export function optionalLocalAmount(
  config: PricingConfig,
  usd: number,
  displayCurrency: string,
  country: string | null | undefined,
): { amount: number; currency: string } | null {
  if (!(usd > 0)) return null;
  const local = currencyForCountry(country, config);
  const display = (displayCurrency || 'USD').trim().toUpperCase() || 'USD';
  if (!local || local === display) return null;
  const quote = quoteCourse(config, usd, 'USD', local);
  return { amount: quote.amount, currency: quote.currency };
}

export function quotePlan(
  config: PricingConfig,
  planId: string,
  interval: BillingInterval,
  requestedCurrency: string | null | undefined,
): MoneyQuote | null {
  const plan = planById(config, planId);
  if (!plan) return null;
  const usd = interval === 'annual' ? plan.annualUsd : plan.monthlyUsd;
  if (usd == null) return null;
  return priceInCurrency(config, usd, planId, interval, requestedCurrency);
}

/** Reads monthly USD from config, or the published $9 / $15 shelf when that row is absent. */
export function readsPriceUsd(config: PricingConfig, id: string): number | null {
  const row = config.reads.find(item => item.id === id);
  if (row) return Number.isFinite(row.monthlyUsd) && row.monthlyUsd > 0 ? row.monthlyUsd : null;
  if (id === 'reads') return 9;
  if (id === 'reads-family') return 15;
  return null;
}

export function quoteAddon(
  config: PricingConfig,
  addonId: string,
  requestedCurrency: string | null | undefined,
): MoneyQuote | null {
  const addon = addonById(config, addonId);
  if (!addon) return null;
  return priceInCurrency(config, addon.monthlyUsd, addonId, 'monthly', requestedCurrency);
}

/**
 * Course prices stay on the course document. A missing currency is USD.
 * A known currency converts through the stored rate. The same currency is
 * shown as stored, so a charm rule does not rewrite the course's own price.
 */
export function quoteCourse(
  config: PricingConfig,
  price: number,
  courseCurrency: string | null | undefined,
  displayCurrency: string | null | undefined,
): MoneyQuote {
  const baseCode = (courseCurrency ?? 'USD').trim().toUpperCase() || 'USD';
  const stored = finite(price, 0);
  const usd = toUsd(config, stored, baseCode);
  const display = shownCurrency(config, displayCurrency).code;
  if (display === baseCode) {
    return {
      amount: isZeroDecimal(display) ? Math.round(stored) : round2(stored),
      currency: display,
      usd,
    };
  }
  return priceInCurrency(config, usd, '', 'monthly', display);
}

export function formatCoursePrice(
  config: PricingConfig,
  price: number | null | undefined,
  courseCurrency: string | null | undefined,
  displayCurrency: string | null | undefined,
): string {
  if (!price || price <= 0) return 'Free';
  const quote = quoteCourse(config, price, courseCurrency, displayCurrency);
  return formatMoney(quote.amount, quote.currency);
}

export function discountLabel(config: PricingConfig): string {
  const percent = Math.round(config.annualDiscount * 1000) / 10;
  return Number.isInteger(percent) ? `${percent.toFixed(0)}%` : `${percent}%`;
}

export function validatePricing(config: PricingConfig): string | null {
  if (!Number.isFinite(config.annualDiscount) || config.annualDiscount < 0 || config.annualDiscount > 1) {
    return 'Annual discount must be between 0 and 100.';
  }
  if (config.plans.length === 0) return 'Add at least one plan.';
  for (const plan of config.plans) {
    if (!plan.id.trim()) return 'Every plan needs an id.';
    if (!priceOk(plan.monthlyUsd) || !priceOk(plan.annualUsd) || !Number.isFinite(plan.sparks) || plan.sparks < 0) {
      return `${plan.id}: prices must be blank or zero or more, and Sparks must be a number.`;
    }
  }
  if (config.familyBundleDiscount) {
    const { secondChildOff, furtherChildOff } = config.familyBundleDiscount;
    if (![secondChildOff, furtherChildOff].every(rate => Number.isFinite(rate) && rate >= 0 && rate <= 1)) {
      return 'Family bundle discount must be between 0 and 100%, or blank.';
    }
  }
  for (const plan of config.reads) {
    if (!plan.id.trim()) return 'Every Reads plan needs an id.';
    if (!Number.isFinite(plan.monthlyUsd) || plan.monthlyUsd <= 0) {
      return `${plan.id}: Reads price must be greater than zero.`;
    }
  }
  for (const addon of config.addons) {
    if (!addon.id.trim()) return 'Every add-on needs an id.';
    if (!Number.isFinite(addon.monthlyUsd) || addon.monthlyUsd < 0) {
      return `${addon.id}: monthly price must be zero or more.`;
    }
  }
  const codes = new Set<string>();
  let sawUsd = false;
  for (const currency of config.currencies) {
    if (!/^[A-Z]{3}$/.test(currency.code)) return 'Currency codes are three letters.';
    if (codes.has(currency.code)) return `${currency.code} is listed twice.`;
    codes.add(currency.code);
    if (currency.code === 'USD') sawUsd = true;
    if (!Number.isFinite(currency.rate) || currency.rate <= 0) {
      return `${currency.code}: exchange rate must be greater than zero.`;
    }
    for (const table of [currency.fixedMonthly, currency.fixedAnnual]) {
      for (const [id, amount] of Object.entries(table)) {
        if (!Number.isFinite(amount) || amount < 0) {
          return `${currency.code} ${id}: fixed price must be zero or more.`;
        }
      }
    }
  }
  if (!sawUsd) return 'USD is required.';
  return null;
}

export function normalizePricing(raw: unknown): PricingConfig {
  const seed = seedPricing();
  if (!raw || typeof raw !== 'object') return seed;
  const record = raw as Record<string, unknown>;
  const annualDiscount = clamp(finite(record.annualDiscount, seed.annualDiscount), 0, 1);
  const plans = mergePlans(record.plans, seed.plans);
  const addons = mergeAddons(record.addons, seed.addons);
  const currencies = mergeCurrencies(record.currencies, seed.currencies);
  return {
    version: 1,
    annualDiscount,
    plans,
    addons,
    currencies,
    familyBundleDiscount: asFamilyDiscount(record.familyBundleDiscount, seed.familyBundleDiscount),
    reads: mergeReads(record.reads, seed.reads),
  };
}

export function diffPricing(before: PricingConfig, after: PricingConfig): string[] {
  const lines: string[] = [];
  if (before.annualDiscount !== after.annualDiscount) {
    lines.push(`Annual discount ${discountLabel(before)} → ${discountLabel(after)}`);
  }
  const beforePlans = new Map(before.plans.map(plan => [plan.id, plan]));
  const afterPlans = new Map(after.plans.map(plan => [plan.id, plan]));
  for (const [id, next] of afterPlans) {
    const prev = beforePlans.get(id);
    if (!prev) {
      lines.push(`${id} plan added`);
      continue;
    }
    if (prev.monthlyUsd !== next.monthlyUsd) {
      lines.push(`${id} monthly USD ${usdLabel(prev.monthlyUsd)} → ${usdLabel(next.monthlyUsd)}`);
    }
    if (prev.annualUsd !== next.annualUsd) {
      lines.push(`${id} annual USD ${usdLabel(prev.annualUsd)} → ${usdLabel(next.annualUsd)}`);
    }
    if (prev.sparks !== next.sparks) {
      lines.push(`${id} monthly Sparks ${prev.sparks} → ${next.sparks}`);
    }
  }
  for (const id of beforePlans.keys()) {
    if (!afterPlans.has(id)) lines.push(`${id} plan removed`);
  }

  const beforeAddons = new Map(before.addons.map(addon => [addon.id, addon]));
  const afterAddons = new Map(after.addons.map(addon => [addon.id, addon]));
  for (const [id, next] of afterAddons) {
    const prev = beforeAddons.get(id);
    if (!prev) lines.push(`${id} add-on added`);
    else if (prev.monthlyUsd !== next.monthlyUsd) {
      lines.push(`${id} monthly USD ${prev.monthlyUsd} → ${next.monthlyUsd}`);
    }
  }
  for (const id of beforeAddons.keys()) {
    if (!afterAddons.has(id)) lines.push(`${id} add-on removed`);
  }

  const beforeDiscount = discountText(before.familyBundleDiscount);
  const afterDiscount = discountText(after.familyBundleDiscount);
  if (beforeDiscount !== afterDiscount) lines.push(`Family bundle discount ${beforeDiscount} → ${afterDiscount}`);
  const beforeReads = new Map(before.reads.map(plan => [plan.id, plan]));
  const afterReads = new Map(after.reads.map(plan => [plan.id, plan]));
  for (const [id, next] of afterReads) {
    const prev = beforeReads.get(id);
    if (!prev) lines.push(`${id} Reads plan added`);
    else if (prev.monthlyUsd !== next.monthlyUsd) lines.push(`${id} monthly USD ${prev.monthlyUsd} → ${next.monthlyUsd}`);
  }

  const beforeCurrencies = new Map(before.currencies.map(currency => [currency.code, currency]));
  const afterCurrencies = new Map(after.currencies.map(currency => [currency.code, currency]));
  for (const [code, next] of afterCurrencies) {
    const prev = beforeCurrencies.get(code);
    if (!prev) {
      lines.push(`${code} added`);
      continue;
    }
    if (prev.enabled !== next.enabled) lines.push(`${code} ${next.enabled ? 'enabled' : 'disabled'}`);
    if (prev.mode !== next.mode) lines.push(`${code} mode ${prev.mode} → ${next.mode}`);
    if (prev.rate !== next.rate) lines.push(`${code} rate ${prev.rate} → ${next.rate}`);
    if (prev.rounding !== next.rounding) lines.push(`${code} rounding ${prev.rounding} → ${next.rounding}`);
    lines.push(...diffFixed(code, 'monthly', prev.fixedMonthly, next.fixedMonthly));
    lines.push(...diffFixed(code, 'annual', prev.fixedAnnual, next.fixedAnnual));
  }
  for (const code of beforeCurrencies.keys()) {
    if (!afterCurrencies.has(code)) lines.push(`${code} removed`);
  }
  return lines;
}

export function readCurrencyChoice(): { code: string | null; source: CurrencySource | null } {
  if (typeof window === 'undefined') return { code: null, source: null };
  try {
    const code = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    const source = window.localStorage.getItem(CURRENCY_SOURCE_KEY);
    return {
      code,
      source: source === 'user' || source === 'auto' ? source : null,
    };
  } catch {
    return { code: null, source: null };
  }
}

export function writeCurrencyChoice(code: string, explicit: boolean): void {
  if (typeof window === 'undefined') return;
  const upper = code.trim().toUpperCase();
  window.localStorage.setItem(CURRENCY_STORAGE_KEY, upper);
  window.localStorage.setItem(CURRENCY_SOURCE_KEY, explicit ? 'user' : 'auto');
  window.dispatchEvent(new CustomEvent(CURRENCY_EVENT));
}

function priceInCurrency(
  config: PricingConfig,
  usd: number,
  id: string,
  interval: BillingInterval,
  requested: string | null | undefined,
): MoneyQuote {
  const currency = shownCurrency(config, requested);
  const baseUsd = round2(finite(usd, 0));
  if (currency.code !== 'USD' && currency.mode === 'fixed' && id) {
    const table = interval === 'annual' ? currency.fixedAnnual : currency.fixedMonthly;
    const fixed = table[id];
    if (typeof fixed === 'number' && Number.isFinite(fixed)) {
      const amount = isZeroDecimal(currency.code) ? Math.round(fixed) : round2(fixed);
      return { amount, currency: currency.code, usd: baseUsd };
    }
  }
  if (currency.code === 'USD' || currency.mode === 'base') {
    return { amount: round2(baseUsd), currency: 'USD', usd: baseUsd };
  }
  return {
    amount: roundMoney(baseUsd * currency.rate, currency.rounding, currency.code),
    currency: currency.code,
    usd: baseUsd,
  };
}

function shownCurrency(config: PricingConfig, requested: string | null | undefined): CurrencyPrice {
  const code = (requested ?? '').trim().toUpperCase();
  const found = config.currencies.find(currency => currency.code === code && currency.enabled);
  if (found) return found;
  return config.currencies.find(currency => currency.code === 'USD')
    ?? emptyCurrency('USD', { enabled: true, mode: 'base', rate: 1, rounding: 'none' });
}

function toUsd(config: PricingConfig, amount: number, currencyCode: string): number {
  if (currencyCode === 'USD') return round2(amount);
  const currency = config.currencies.find(item => item.code === currencyCode);
  if (!currency || !(currency.rate > 0)) return round2(amount);
  return round2(amount / currency.rate);
}

function emptyCurrency(
  code: string,
  patch: Pick<CurrencyPrice, 'enabled' | 'mode' | 'rate' | 'rounding'>,
): CurrencyPrice {
  return { code, ...patch, fixedMonthly: {}, fixedAnnual: {} };
}

function mergePlans(raw: unknown, seed: PlanPrice[]): PlanPrice[] {
  const incoming = Array.isArray(raw) ? raw : [];
  const seedById = new Map(seed.map(plan => [plan.id, plan]));
  const byId = new Map<string, PlanPrice>();
  for (const item of incoming) {
    const id = item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
      ? (item as { id: string }).id.trim()
      : '';
    const plan = asPlan(item, seedById.get(id));
    if (plan) byId.set(plan.id, plan);
  }
  const merged = seed.map(plan => byId.get(plan.id) ?? plan);
  for (const [id, plan] of byId) {
    if (!seed.some(item => item.id === id)) merged.push(plan);
  }
  return merged;
}

function mergeAddons(raw: unknown, seed: AddonPrice[]): AddonPrice[] {
  const incoming = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, AddonPrice>();
  for (const item of incoming) {
    const addon = asAddon(item);
    if (addon) byId.set(addon.id, addon);
  }
  const merged = seed.map(addon => byId.get(addon.id) ?? addon);
  for (const [id, addon] of byId) {
    if (!seed.some(item => item.id === id)) merged.push(addon);
  }
  return merged;
}

function mergeCurrencies(raw: unknown, seed: CurrencyPrice[]): CurrencyPrice[] {
  const incoming = Array.isArray(raw) ? raw : [];
  const byCode = new Map<string, CurrencyPrice>();
  for (const item of incoming) {
    const currency = asCurrency(item);
    if (currency) byCode.set(currency.code, currency);
  }
  const merged = seed.map(currency => lockUsd(byCode.get(currency.code) ?? currency));
  for (const [code, currency] of byCode) {
    if (!seed.some(item => item.code === code)) merged.push(lockUsd(currency));
  }
  if (!merged.some(currency => currency.code === 'USD')) {
    merged.unshift(emptyCurrency('USD', { enabled: true, mode: 'base', rate: 1, rounding: 'none' }));
  }
  return merged.map(lockUsd);
}

function lockUsd(currency: CurrencyPrice): CurrencyPrice {
  if (currency.code !== 'USD') return currency;
  return { ...currency, enabled: true, mode: 'base', rate: 1, rounding: 'none' };
}

function asPlan(raw: unknown, seed: PlanPrice | undefined): PlanPrice | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!id) return null;
  const monthlyUsd = priceField(item.monthlyUsd, seed?.monthlyUsd ?? null);
  const annualUsd = priceField(item.annualUsd, seed?.annualUsd ?? null);
  const sparks = nonNegative(item.sparks) ?? seed?.sparks ?? null;
  if (monthlyUsd === undefined || annualUsd === undefined || sparks == null) return null;
  return { id, monthlyUsd, annualUsd, sparks };
}

function mergeReads(raw: unknown, seed: ReadsPlanPrice[]): ReadsPlanPrice[] {
  const incoming = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, ReadsPlanPrice>();
  for (const item of incoming) {
    const plan = asReads(item);
    if (plan) byId.set(plan.id, plan);
  }
  const merged = seed.map(plan => byId.get(plan.id) ?? plan);
  for (const [id, plan] of byId) {
    if (!seed.some(item => item.id === id)) merged.push(plan);
  }
  return merged;
}

function asReads(raw: unknown): ReadsPlanPrice | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const monthlyUsd = nonNegative(item.monthlyUsd);
  if (!id || monthlyUsd == null || monthlyUsd <= 0) return null;
  return { id, monthlyUsd };
}

function asFamilyDiscount(raw: unknown, seed: FamilyBundleDiscount | null): FamilyBundleDiscount | null {
  if (raw === undefined) return seed;
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object') return seed;
  const item = raw as Record<string, unknown>;
  const secondChildOff = nonNegative(item.secondChildOff);
  const furtherChildOff = nonNegative(item.furtherChildOff);
  if (secondChildOff == null || furtherChildOff == null || secondChildOff > 1 || furtherChildOff > 1) return seed;
  return { secondChildOff, furtherChildOff };
}

function priceOk(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function usdLabel(value: number | null): string {
  return value == null ? 'unset' : String(value);
}

function discountText(value: FamilyBundleDiscount | null): string {
  if (!value) return 'unset';
  return `${value.secondChildOff}/${value.furtherChildOff}`;
}

/** Null stays null. A missing field uses the seed. An invalid number is rejected. */
function priceField(value: unknown, seed: number | null): number | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === '') return seed;
  const number = nonNegative(value);
  return number == null ? undefined : number;
}

function asAddon(raw: unknown): AddonPrice | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const monthlyUsd = nonNegative(item.monthlyUsd);
  if (!id || monthlyUsd == null) return null;
  return { id, monthlyUsd };
}

function asCurrency(raw: unknown): CurrencyPrice | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const code = typeof item.code === 'string' ? item.code.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) return null;
  const mode = MODES.has(item.mode as CurrencyMode) ? item.mode as CurrencyMode : 'rate';
  const rounding = ROUNDINGS.has(item.rounding as Rounding) ? item.rounding as Rounding : 'charm';
  const rate = finite(item.rate, 1);
  return {
    code,
    enabled: item.enabled !== false,
    mode: code === 'USD' ? 'base' : mode === 'base' ? 'rate' : mode,
    rate: rate > 0 ? rate : 1,
    rounding: code === 'USD' ? 'none' : rounding,
    fixedMonthly: numberMap(item.fixedMonthly),
    fixedAnnual: numberMap(item.fixedAnnual),
  };
}

function numberMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const amount = nonNegative(value);
    if (amount != null) out[key] = amount;
  }
  return out;
}

function diffFixed(
  code: string,
  interval: 'monthly' | 'annual',
  before: Record<string, number>,
  after: Record<string, number>,
): string[] {
  const lines: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const prev = before[key];
    const next = after[key];
    if (prev === next) continue;
    lines.push(`${code} ${key} ${interval} fixed ${prev ?? '—'} → ${next ?? '—'}`);
  }
  return lines;
}

function nonNegative(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function finite(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
