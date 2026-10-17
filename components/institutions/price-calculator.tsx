'use client';

import { useEffect, useMemo, useState } from 'react';
import { BRAND } from '@/lib/brand-theme';
import { documentPdf } from '@/lib/institution-pricing';
import {
  catalogueDocumentLines,
  normalizeCatalogue,
  priceCatalogue,
  seedInstitutionCatalogue,
  tierForSeats,
  tierRangeLabel,
  tierUnitMonthly,
  TIER_ACCENTS,
  type CatalogueTier,
  type InstitutionCatalogue,
} from '@/lib/institution-catalogue';

function downloadPdf(name: string, lines: string[]) {
  const bytes = documentPdf(lines);
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function PriceCalculator({
  catalogue: given,
  country: initialCountry = 'MY',
  institutionName = 'North Academy',
  initialSeats = 80,
  initialActive = 90,
  initialIds = ['igcse', 'maths'],
  issuedOn = '2026-10-17',
  onApply,
}: {
  catalogue?: InstitutionCatalogue;
  country?: string;
  institutionName?: string;
  initialSeats?: number;
  initialActive?: number;
  initialIds?: string[];
  issuedOn?: string;
  onApply?: (selection: { itemIds: string[]; seats: number; active: number; interval: 'monthly' | 'annual' }) => void;
}) {
  const [catalogue, setCatalogue] = useState<InstitutionCatalogue>(given ?? seedInstitutionCatalogue());
  const [ids, setIds] = useState<string[]>(initialIds);
  const [seats, setSeats] = useState(initialSeats);
  const [active, setActive] = useState(initialActive);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('annual');
  const [country, setCountry] = useState(initialCountry);

  useEffect(() => {
    if (given) return;
    let cancelled = false;
    fetch('/api/institutions/catalogue')
      .then((res) => res.json())
      .then((data: { catalogue?: unknown }) => {
        if (!cancelled && data.catalogue) setCatalogue(normalizeCatalogue(data.catalogue));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [given]);

  const highlighted = tierForSeats(catalogue, seats);
  const programmes = catalogue.items.filter((item) => item.kind === 'programme');
  const categories = catalogue.items.filter((item) => item.kind === 'category');
  const quote = useMemo(() => priceCatalogue({
    catalogue,
    itemIds: ids,
    purchasedSeats: seats,
    activeSeats: active,
    interval,
    country,
    tender: 'card',
  }), [catalogue, ids, seats, active, interval, country]);
  const invoice = useMemo(() => priceCatalogue({
    catalogue,
    itemIds: ids,
    purchasedSeats: seats,
    activeSeats: active,
    interval,
    country,
    tender: 'invoice',
  }), [catalogue, ids, seats, active, interval, country]);

  const toggle = (id: string) => {
    setIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const pdf = (kind: 'quote' | 'invoice') => {
    const source = kind === 'invoice' ? invoice : quote;
    if ('error' in source) return;
    downloadPdf(
      kind === 'invoice' ? 'poket-school-invoice.pdf' : 'poket-school-quote.pdf',
      catalogueDocumentLines({ kind, institutionName, issuedOn, quote: source }),
    );
  };

  const pickTier = (tier: CatalogueTier) => {
    setSeats(Math.max(1, tier.minSeats));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {catalogue.tiers.map((tier) => {
          const selected = highlighted?.id === tier.id;
          const onLight = tier.accent === 'mist' || tier.accent === 'foam' || tier.accent === 'bright';
          const ink = onLight ? BRAND.ink : BRAND.card;
          const prices = catalogue.items.map((entry) => tierUnitMonthly(tier, entry));
          const from = prices.length ? Math.min(...prices) : 0;
          return (
            <article
              key={tier.id}
              className={`rounded-3xl p-4 shadow-sm ${onLight ? 'border border-line' : ''} ${selected ? 'ring-4 ring-blue-deep ring-offset-2 ring-offset-background' : ''}`}
              style={{ background: TIER_ACCENTS[tier.accent], color: ink }}
            >
              <button type="button" className="w-full text-left" onClick={() => pickTier(tier)}>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{tierRangeLabel(tier)} students</p>
                <h2 className="mt-1 font-heading text-2xl">{tier.name}</h2>
                <p className="mt-2 text-sm font-semibold">
                  {tier.quoteContact ? 'Custom pricing' : `From USD ${from.toFixed(2)} / seat`}
                  {tier.placeholder ? ' · placeholder' : ''}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {tier.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide">{selected ? 'This seat count' : 'Use this tier'}{tier.selfServe ? ' · self-serve checkout' : ''}</p>
              </button>
              {tier.quoteContact && tier.contactHref && (
                <a className="mt-2 inline-flex text-sm font-semibold underline" href={tier.contactHref}>Request a quote</a>
              )}
            </article>
          );
        })}
      </div>
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        {catalogue.placeholder && (
          <p className="mb-4 rounded-2xl bg-[#E9F7FA] px-4 py-3 text-sm text-[#203337]">{catalogue.note}</p>
        )}
        <fieldset>
          <legend className="text-sm font-semibold">Programmes</legend>
          <p className="mt-1 text-sm text-[#203337]/70">Select more than one. The price adds each programme. Micro, Starter, Growth, Pro, and Enterprise follow unique students, and the per-seat price steps down as the tier grows.</p>
          <div className="mt-2 space-y-2">
            {programmes.map((item) => (
              <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={ids.includes(item.id)} onChange={() => toggle(item.id)} />
                  {item.title}
                  <span className="text-[#203337]/60">{item.level}</span>
                </span>
                <span className="tabular-nums text-[#203337]/70">USD {(highlighted ? tierUnitMonthly(highlighted, item) : item.perSeatMonthly).toFixed(2)} / seat{item.placeholder ? ' · placeholder' : ''}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Categories</legend>
          <div className="mt-2 space-y-2">
            {categories.map((item) => (
              <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={ids.includes(item.id)} onChange={() => toggle(item.id)} />
                  {item.title}
                </span>
                <span className="tabular-nums text-[#203337]/70">USD {(highlighted ? tierUnitMonthly(highlighted, item) : item.perSeatMonthly).toFixed(2)} / seat{item.placeholder ? ' · placeholder' : ''}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Unique students: {seats}
            <input className="mt-2 w-full accent-[#1E6A83]" type="range" min={1} max={800} value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
          </label>
          <label className="text-sm font-medium">Active students
            <input className="mt-2 h-11 w-full rounded-xl border border-[#203337]/15 px-3" type="number" min={0} value={active} onChange={(event) => setActive(Number(event.target.value))} />
          </label>
          <label className="text-sm font-medium">Billing
            <select className="mt-2 h-11 w-full rounded-xl border border-[#203337]/15 px-3" value={interval} onChange={(event) => setInterval(event.target.value as 'monthly' | 'annual')}>
              <option value="annual">Annual</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="text-sm font-medium">Country
            <select className="mt-2 h-11 w-full rounded-xl border border-[#203337]/15 px-3" value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="MY">Malaysia</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
            </select>
          </label>
        </div>
      </section>
      <section className="rounded-3xl bg-[#203337] p-5 text-white" aria-live="polite">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#E9F7FA]">Live price</p>
        {'error' in quote ? (
          <p className="mt-3 text-sm">{quote.error}</p>
        ) : (
          <>
            <p className="mt-2 font-heading text-4xl tabular-nums">{quote.currency} {quote.total.toFixed(2)}</p>
            <p className="mt-1 text-sm text-white/75">{quote.tierLabel} · {quote.purchasedSeats} purchased seats · {quote.activeSeats} active</p>
            {quote.quoteContact && (
              <p className="mt-3 rounded-2xl bg-[#E9F7FA] px-3 py-2 text-sm text-[#203337]">
                Custom pricing. Request a quote{quote.selfServe ? ', or continue with self-serve checkout' : ''}.
              </p>
            )}
            <ul className="mt-4 space-y-2 text-sm">
              {quote.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-3 border-t border-white/10 pt-2">
                  <span>{line.title}<span className="block text-xs text-white/60">{line.seats} seats · {line.billingBasis === 'active_minimum' ? 'active, with a minimum' : 'purchased seats'}</span></span>
                  <span className="tabular-nums">{quote.currency} {line.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-white/80">Subtotal {quote.currency} {quote.subtotal.toFixed(2)} · tax {quote.currency} {quote.tax.toFixed(2)} · {quote.sparks.toLocaleString('en')} Sparks</p>
            {quote.notices.map((notice) => (
              <p key={notice} className="mt-3 rounded-2xl bg-[#E36A4F] px-3 py-2 text-sm">{notice}</p>
            ))}
            {seats >= catalogue.quoteMinSeats && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="inline-flex h-11 items-center rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-5 text-sm font-semibold text-[#203337]" onClick={() => pdf('quote')}>
                  Download quote PDF
                </button>
                <button type="button" className="inline-flex h-11 items-center rounded-full border border-white/30 px-5 text-sm font-semibold" onClick={() => pdf('invoice')}>
                  Download invoice PDF
                </button>
              </div>
            )}
            {onApply && highlighted?.selfServe !== false && (
              <button
                type="button"
                className="mt-3 inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-[#203337]"
                onClick={() => onApply({ itemIds: ids, seats, active, interval })}
              >
                Update this academy
              </button>
            )}
          </>
        )}
      </section>
    </div>
    </div>
  );
}
