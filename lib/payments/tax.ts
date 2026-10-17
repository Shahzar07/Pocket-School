import { fromMinor, toMinor } from './minor';
import type { CheckoutKind } from './quote';

/**
 * Malaysian service tax (SST) on digital services supplied to Malaysia.
 * Education supplied outside Malaysia, wallet top-ups, and school invoices
 * that already carry their own tax are not taxed again.
 */
export interface TaxConfig {
  sstRate: number;
  /** Buyer countries that attract SST even when the charge is in USD. */
  countries: readonly string[];
  supplierName: string;
  tin?: string | null;
  brn?: string | null;
  /** LHDN classification. 022 is the placeholder until Harry confirms the code. */
  classification: string;
}

export const DEFAULT_TAX: TaxConfig = {
  sstRate: 0.08,
  countries: ['MY'],
  supplierName: 'Poket School',
  tin: null,
  brn: null,
  classification: '022',
};

export function taxRateFor(
  kind: CheckoutKind,
  country: string,
  currency: string,
  config: TaxConfig = DEFAULT_TAX,
): number {
  if (kind === 'wallet' || kind === 'invoice') return 0;
  const code = country.trim().toUpperCase();
  const cur = currency.trim().toUpperCase();
  if (config.countries.includes(code) || cur === 'MYR') return config.sstRate;
  return 0;
}

export function taxOnMinor(subtotalMinor: number, rate: number): { taxMinor: number; totalMinor: number } {
  const taxMinor = Math.round(subtotalMinor * rate);
  return { taxMinor, totalMinor: subtotalMinor + taxMinor };
}

export interface MyInvoisParty {
  name: string;
  email?: string | null;
  tin?: string | null;
}

export interface MyInvoisDocument {
  version: '1.0';
  /** Ready to submit. Building the document does not call LHDN; the queue does. */
  status: 'ready' | 'missing_supplier';
  typeCode: '01';
  currency: string;
  supplier: { name: string; tin: string | null; brn: string | null };
  buyer: { name: string; email: string | null; tin: string | null };
  classification: string;
  lines: { description: string; taxExclusiveAmount: number; taxAmount: number }[];
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
}

export function buildMyInvois(input: {
  currency: string;
  description: string;
  taxExclusive: number;
  tax: number;
  config?: TaxConfig;
  buyer: MyInvoisParty;
}): MyInvoisDocument {
  const config = input.config ?? DEFAULT_TAX;
  const tin = config.tin?.trim() || null;
  const brn = config.brn?.trim() || null;
  return {
    version: '1.0',
    status: tin ? 'ready' : 'missing_supplier',
    typeCode: '01',
    currency: input.currency,
    supplier: { name: config.supplierName, tin, brn },
    buyer: {
      name: input.buyer.name,
      email: input.buyer.email ?? null,
      tin: input.buyer.tin ?? null,
    },
    classification: config.classification,
    lines: [{
      description: input.description,
      taxExclusiveAmount: round2(input.taxExclusive),
      taxAmount: round2(input.tax),
    }],
    taxExclusiveAmount: round2(input.taxExclusive),
    taxAmount: round2(input.tax),
    taxInclusiveAmount: round2(input.taxExclusive + input.tax),
  };
}

function round2(amount: number): number {
  return fromMinor(toMinor(amount));
}
