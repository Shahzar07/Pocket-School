'use client';

import { formatMoney } from '@/lib/money';

export interface MethodChoice {
  id: string;
  label: string;
  blurb: string;
}

export interface QuoteView {
  title: string;
  currency: string;
  lines: { label: string; amount: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  total: number;
  seats: number;
  highlights?: string[];
}

const COUNTRIES = [
  { id: 'MY', label: 'Malaysia' },
  { id: 'SG', label: 'Singapore' },
  { id: 'US', label: 'United States' },
  { id: 'GB', label: 'United Kingdom' },
];

export function CheckoutPanel({
  quote, methods, method, onMethod, country, onCountry, coupon, onCoupon,
  seats, onSeats, showSeats, notice, busy, onPay, payLabel,
}: {
  quote: QuoteView;
  methods: MethodChoice[];
  method: string;
  onMethod: (id: string) => void;
  country: string;
  onCountry: (code: string) => void;
  coupon: string;
  onCoupon: (value: string) => void;
  seats?: number;
  onSeats?: (seats: number) => void;
  showSeats?: boolean;
  notice?: string;
  busy?: boolean;
  onPay?: () => void;
  payLabel?: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Checkout</p>
            <h2 className="font-heading text-2xl tracking-tight mt-1">{quote.title}</h2>
            {quote.highlights && quote.highlights.length > 0 ? (
              <ul className="mt-3 max-w-xl space-y-1 text-sm text-muted-foreground">
                {quote.highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <label className="text-sm">
            <span className="block text-[11px] font-semibold text-muted-foreground mb-1">Country</span>
            <select
              aria-label="Country"
              value={country}
              onChange={(event) => onCountry(event.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {COUNTRIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>

        {showSeats && onSeats && (
          <label className="block text-sm">
            <span className="block text-[11px] font-semibold text-muted-foreground mb-1">Family seats (you are seat 1)</span>
            <input
              aria-label="Family seats"
              type="number"
              min={1}
              max={6}
              value={seats ?? 1}
              onChange={(event) => onSeats(Number(event.target.value))}
              className="h-10 w-24 rounded-xl border border-border bg-background px-3"
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="block text-[11px] font-semibold text-muted-foreground mb-1">Referral code</span>
          <input
            aria-label="Referral code"
            value={coupon}
            onChange={(event) => onCoupon(event.target.value)}
            placeholder="Optional"
            className="h-10 w-full max-w-xs rounded-xl border border-border bg-background px-3"
          />
        </label>

        <fieldset>
          <legend className="text-[11px] font-semibold text-muted-foreground mb-2">Payment method</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {methods.map((item) => (
              <label
                key={item.id}
                className={`rounded-xl border p-3 cursor-pointer ${method === item.id ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="method"
                    value={item.id}
                    checked={method === item.id}
                    onChange={() => onMethod(item.id)}
                  />
                  {item.label}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      </section>

      <aside className="bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] p-5 h-fit space-y-3">
        <h3 className="text-[15px] font-semibold">Receipt</h3>
        <ul className="space-y-1 text-sm">
          {quote.lines.map((line) => (
            <li key={line.label} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{line.label}</span>
              <span>{formatMoney(line.amount, quote.currency)}</span>
            </li>
          ))}
          {quote.discount > 0 && (
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatMoney(quote.discount, quote.currency)}</span>
            </li>
          )}
          <li className="flex justify-between gap-3">
            <span className="text-muted-foreground">SST {Math.round(quote.taxRate * 100)}%</span>
            <span>{formatMoney(quote.tax, quote.currency)}</span>
          </li>
        </ul>
        <p className="flex justify-between border-t border-border pt-3 text-lg font-semibold">
          <span>Total</span>
          <span>{formatMoney(quote.total, quote.currency)}</span>
        </p>
        {onPay && (
          <button
            type="button"
            onClick={onPay}
            disabled={busy || methods.length === 0}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60"
          >
            {busy ? 'Starting…' : payLabel ?? 'Pay now'}
          </button>
        )}
      </aside>
    </div>
  );
}
