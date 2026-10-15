import { fromMinor, toMinor } from './minor';

export interface FinanceSubscription {
  status: string;
  monthlyRecurring: number;
}

export interface FinanceSummary {
  mrr: number;
  arr: number;
  arpu: number;
  activeSubscribers: number;
}

export function summariseFinance(subs: FinanceSubscription[]): FinanceSummary {
  const active = subs.filter((sub) => sub.status === 'active');
  const mrrMinor = active.reduce((sum, sub) => sum + toMinor(Number(sub.monthlyRecurring) || 0), 0);
  const count = active.length;
  return {
    mrr: fromMinor(mrrMinor),
    arr: fromMinor(mrrMinor * 12),
    arpu: count ? fromMinor(Math.round(mrrMinor / count)) : 0,
    activeSubscribers: count,
  };
}

export function reconcile(transactions: { invoiceId?: string | null }[]): {
  matched: number;
  unmatched: number;
  total: number;
} {
  const matched = transactions.filter((row) => !!row.invoiceId).length;
  return { matched, unmatched: transactions.length - matched, total: transactions.length };
}
