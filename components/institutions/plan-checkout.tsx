'use client';

import { useMemo, useState } from 'react';
import { journeyButton, journeyField } from '@/components/institutions/journey-frame';
import { VOLUME_PLANS, type VolumeInterval, type VolumePlanId } from '@/lib/institution-pricing';
import {
  INVOICE_MIN_SEATS,
  SEAT_MAX,
  SEAT_MIN,
  priceInstitutionOrder,
  programmesForCheckout,
  type OrderAccess,
} from '@/lib/institution-self-serve';

export interface CheckoutDraft {
  planId: VolumePlanId;
  interval: VolumeInterval;
  seats: number;
  access: OrderAccess;
  programmeIds: string[];
  tender: 'card' | 'fpx' | 'invoice';
  poNumber: string;
  wantsCustomDomain: boolean;
  wantsCobrand: boolean;
  wantsMarketplace: boolean;
}

export function PlanCheckout({
  country,
  email,
  initialSeats,
  banner,
  trialDays,
  trialSeatCap,
  busy,
  error,
  paidNotice,
  onCheckout,
  onTrial,
}: {
  country: string;
  email: string;
  initialSeats: number;
  banner: string;
  trialDays: number;
  trialSeatCap: number;
  busy?: boolean;
  error?: string;
  paidNotice?: string;
  onCheckout?: (draft: CheckoutDraft) => void;
  onTrial?: (draft: Pick<CheckoutDraft, 'planId' | 'seats' | 'programmeIds'>) => void;
}) {
  const [planId, setPlanId] = useState<VolumePlanId>('igcse_alevel');
  const [interval, setInterval] = useState<VolumeInterval>('annual');
  const [seats, setSeats] = useState(Math.min(SEAT_MAX, Math.max(SEAT_MIN, initialSeats || 25)));
  const [access, setAccess] = useState<OrderAccess>('subscription');
  const [programmeIds, setProgrammeIds] = useState<string[]>(['igcse']);
  const [tender, setTender] = useState<'card' | 'fpx' | 'invoice'>('card');
  const [poNumber, setPoNumber] = useState('');
  const [wantsCustomDomain, setWantsCustomDomain] = useState(false);
  const [wantsCobrand, setWantsCobrand] = useState(false);
  const [wantsMarketplace, setWantsMarketplace] = useState(false);

  const offers = useMemo(() => programmesForCheckout(access), [access]);
  const programmes = offers.filter((item) => item.kind === 'programme');
  const categories = offers.filter((item) => item.kind === 'category');
  const priced = useMemo(() => priceInstitutionOrder({
    planId,
    interval,
    seats,
    access,
    programmeIds: programmeIds.filter((id) => offers.some((item) => item.id === id)),
    country,
    tender,
  }), [planId, interval, seats, access, programmeIds, offers, country, tender]);

  const toggleProgramme = (id: string) => {
    setProgrammeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const draft = (): CheckoutDraft => ({
    planId,
    interval,
    seats,
    access,
    programmeIds: programmeIds.filter((id) => offers.some((item) => item.id === id)),
    tender,
    poNumber,
    wantsCustomDomain,
    wantsCobrand,
    wantsMarketplace,
  });

  return (
    <div className="space-y-4">
      {banner && (
        <p role="status" className="rounded-2xl bg-[#F8E7C4] px-4 py-3 text-sm">
          {banner}
        </p>
      )}
      {paidNotice && <p className="rounded-2xl bg-[#F6F1E7] px-4 py-3 text-sm">{paidNotice}</p>}
      {error && <p role="alert" className="rounded-2xl bg-[#F8E7C4] px-4 py-3 text-sm">{error}</p>}

      <label className="block text-sm font-medium">
        Plan
        <select className={journeyField} value={planId} onChange={(event) => setPlanId(event.target.value as VolumePlanId)}>
          {VOLUME_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Billing
        <select className={journeyField} value={interval} onChange={(event) => setInterval(event.target.value as VolumeInterval)}>
          <option value="annual">Annual</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Unique students: {seats}
        <span className="mt-1 block font-normal text-[#1A3C34]/70">This count picks Starter, Growth, Pro, or Enterprise. Each selected programme is billed for these students.</span>
        <input
          className="mt-2 w-full accent-[#C8922A]"
          type="range"
          min={SEAT_MIN}
          max={SEAT_MAX}
          value={seats}
          onChange={(event) => setSeats(Number(event.target.value))}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How courses are bought</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="access" checked={access === 'subscription'} onChange={() => setAccess('subscription')} />
          Subscription, while the academy is paid
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="access" checked={access === 'a_la_carte'} onChange={() => setAccess('a_la_carte')} />
          A la carte, one payment for lifetime access
        </label>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Programmes</legend>
        <p className="text-sm text-[#1A3C34]/70">Select every programme this academy needs. More than one is fine, including programmes from different levels.</p>
        {programmes.map((programme) => (
          <label key={programme.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={programmeIds.includes(programme.id)} onChange={() => toggleProgramme(programme.id)} />
              {programme.title}
            </span>
            <span className="tabular-nums text-[#1A3C34]/70">USD {programme.perSeatMonthly.toFixed(2)} / seat{programme.placeholder ? ' · placeholder' : ''}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Categories</legend>
        {categories.map((programme) => (
          <label key={programme.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={programmeIds.includes(programme.id)} onChange={() => toggleProgramme(programme.id)} />
              {programme.title}
            </span>
            <span className="tabular-nums text-[#1A3C34]/70">USD {programme.perSeatMonthly.toFixed(2)} / seat{programme.placeholder ? ' · placeholder' : ''}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Also requested</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wantsCustomDomain} onChange={(event) => setWantsCustomDomain(event.target.checked)} /> Custom domain</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wantsCobrand} onChange={(event) => setWantsCobrand(event.target.checked)} /> Co-branded certificates</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wantsMarketplace} onChange={(event) => setWantsMarketplace(event.target.checked)} /> Publish courses on the marketplace</label>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Pay with</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="tender" checked={tender === 'card'} onChange={() => setTender('card')} /> Card</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="tender" checked={tender === 'fpx'} onChange={() => setTender('fpx')} /> FPX, Malaysia</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="tender" checked={tender === 'invoice'} onChange={() => setTender('invoice')} /> Invoice or purchase order, from {INVOICE_MIN_SEATS} seats</label>
      </fieldset>
      {tender === 'invoice' && (
        <label className="block text-sm font-medium">
          PO or invoice reference
          <input className={journeyField} value={poNumber} onChange={(event) => setPoNumber(event.target.value)} />
        </label>
      )}

      <div className="rounded-2xl bg-[#F6F1E7] px-4 py-4">
        {'error' in priced ? (
          <p className="text-sm">{priced.error}</p>
        ) : (
          <>
            {priced.placeholder && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#C8922A]">Placeholder prices</p>}
            <p className="text-2xl font-semibold tabular-nums">{priced.currency} {priced.total.toFixed(2)}</p>
            <p className="mt-1 text-sm text-[#1A3C34]/75">
              {priced.tierLabel} · {priced.uniqueStudents} unique students. {priced.currency} {priced.subtotal.toFixed(2)} plus {priced.currency} {priced.tax.toFixed(2)} tax
              {country.trim().toUpperCase() === 'MY' && tender !== 'invoice' ? ' (SST)' : ''}. {priced.sparks.toLocaleString('en')} Sparks.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {priced.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-3">
                  <span>{line.title} · {line.seats} seats</span>
                  <span className="tabular-nums">{priced.currency} {line.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {priced.bundleDiscount > 0 && (
              <p className="mt-2 text-sm text-[#1A3C34]">{priced.programmeCount} programmes include a {(priced.bundleDiscount * 100).toFixed(0)}% bundle discount.</p>
            )}
            {priced.quoteContact && (
              <p className="mt-2 text-sm text-[#1A3C34]">Custom pricing. Request a quote from Poket School{priced.selfServe ? ', or continue with self-serve checkout' : ''}.</p>
            )}
            <p className="mt-1 text-sm text-[#1A3C34]/75">{email}</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={journeyButton} disabled={busy || ('error' in priced) || (!('error' in priced) && priced.selfServe === false)} onClick={() => onCheckout?.(draft())}>
          {busy ? 'Working…' : banner ? 'Complete test payment' : tender === 'invoice' ? 'Place invoice order' : 'Pay and open the academy'}
        </button>
        <button
          type="button"
          className="h-11 rounded-full border border-[#1A3C34]/15 px-5 text-sm font-semibold"
          disabled={busy}
          onClick={() => onTrial?.({ planId, seats, programmeIds: draft().programmeIds })}
        >
          {trialDays}-day trial, up to {trialSeatCap} seats, no card
        </button>
      </div>
    </div>
  );
}
