'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  VOLUME_ADDONS,
  VOLUME_PLANS,
  blankPriceOverride,
  documentPdf,
  quoteInstitution,
  quoteLines,
  seatNotices,
  type InstitutionPriceOverride,
  type InstitutionVolumeSchedule,
  type VolumeAddonId,
  type VolumePlanId,
} from '@/lib/institution-pricing';

function downloadPdf(filename: string, lines: string[]) {
  const blob = new Blob([new Uint8Array(documentPdf(lines))], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function VolumeQuote({
  name,
  schedule,
  override,
  seatsPurchased,
  seatsUsed,
  renewalOn,
  today,
  superAdmin,
  busy,
  onSaveOverride,
  onRecord,
}: {
  name: string;
  schedule: InstitutionVolumeSchedule;
  override: InstitutionPriceOverride;
  seatsPurchased: number;
  seatsUsed: number;
  renewalOn: string;
  today: string;
  superAdmin: boolean;
  busy?: boolean;
  onSaveOverride: (override: InstitutionPriceOverride) => Promise<void>;
  onRecord: (input: { kind: 'quote' | 'invoice'; amount: number; seats: number; description: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState(override);
  const [seats, setSeats] = useState(String(seatsPurchased || 10));
  const count = Math.max(0, Math.floor(Number(seats) || 0));
  const quote = useMemo(
    () => quoteInstitution({ schedule, seats: count, override: draft }),
    [schedule, count, draft],
  );
  const notices = seatNotices({ schedule, seatsPurchased, seatsUsed, renewalOn, today });
  const issuedOn = today;
  const linesFor = (kind: 'quote' | 'invoice') => quoteLines({ kind, institutionName: name, issuedOn, quote });

  const toggleAddon = (id: VolumeAddonId) => {
    setDraft((current) => ({
      ...current,
      addons: current.addons.includes(id) ? current.addons.filter((item) => item !== id) : [...current.addons, id],
    }));
  };

  return (
    <section className="rounded-3xl border border-border p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Volume quote</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {seatsUsed} students in use · {seatsPurchased} seats purchased · {schedule.currency}
        </p>
      </div>
      {notices.overLimit && (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Seat limit reached. {seatsUsed} students are on a licence for {seatsPurchased}.
        </p>
      )}
      {notices.upgradeTo && (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Usage is in tier {notices.upgradeTo}. The purchased seats are in tier {notices.upgradeFrom}. Raise the seat count to move the quote onto the higher tier.
        </p>
      )}
      {notices.renewal === 'soon' && <p className="text-sm">Renewal on {renewalOn} is inside 45 days.</p>}
      {notices.renewal === 'due' && <p className="text-sm">Renewal is due today ({renewalOn}).</p>}
      {notices.renewal === 'lapsed' && <p className="text-sm">Renewal date {renewalOn} has passed.</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Students to quote
          <Input aria-label="Students to quote" type="number" min={0} value={seats} onChange={(event) => setSeats(event.target.value)} className="mt-1 h-11 rounded-xl" />
        </label>
        <label className="text-sm">Plan level
          <select aria-label="Quote plan" value={draft.planId} onChange={(event) => setDraft({ ...draft, planId: event.target.value as VolumePlanId })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" disabled={!superAdmin}>
            {VOLUME_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Interval
          <select aria-label="Quote interval" value={draft.interval} onChange={(event) => setDraft({ ...draft, interval: event.target.value === 'monthly' ? 'monthly' : 'annual' })} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" disabled={!superAdmin}>
            <option value="annual">Per year</option>
            <option value="monthly">Per month</option>
          </select>
        </label>
        <label className="text-sm">Discount %
          <Input aria-label="Discount percent" type="number" min={0} max={100} value={draft.discountPercent} onChange={(event) => setDraft({ ...draft, discountPercent: Number(event.target.value) })} className="mt-1 h-11 rounded-xl" disabled={!superAdmin} />
        </label>
        <label className="text-sm">Custom per-student price
          <Input aria-label="Custom per student" type="number" min={0} step="0.01" value={draft.customPerStudent ?? ''} placeholder="Schedule price" onChange={(event) => setDraft({ ...draft, customPerStudent: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 h-11 rounded-xl" disabled={!superAdmin} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.waivePlatformFee} onChange={(event) => setDraft({ ...draft, waivePlatformFee: event.target.checked })} disabled={!superAdmin} />
        Waive the platform fee
      </label>
      <div className="flex flex-wrap gap-3 text-sm">
        {VOLUME_ADDONS.map((addon) => (
          <label key={addon.id} className="flex items-center gap-2">
            <input type="checkbox" checked={draft.addons.includes(addon.id)} onChange={() => toggleAddon(addon.id)} disabled={!superAdmin} />
            {addon.name}
          </label>
        ))}
      </div>

      <dl className="grid sm:grid-cols-2 gap-2 text-sm">
        <div>Tier <span className="font-semibold">{quote.tierLabel}</span></div>
        <div>Per student <span className="font-semibold">{quote.currency} {quote.perStudent.toFixed(2)}</span></div>
        <div>Student total <span className="font-semibold">{quote.currency} {quote.studentTotal.toFixed(2)}</span></div>
        <div>Platform fee <span className="font-semibold">{quote.currency} {quote.platformFee.toFixed(2)}</span></div>
        <div>Add-ons <span className="font-semibold">{quote.currency} {quote.addonTotal.toFixed(2)}</span></div>
        <div>Discount <span className="font-semibold">{quote.discountPercent}% · {quote.currency} {quote.discountAmount.toFixed(2)}</span></div>
        <div className="sm:col-span-2 text-base">Total <span className="font-semibold">{quote.currency} {quote.total.toFixed(2)}</span></div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={() => downloadPdf(`${name}-quote.pdf`, linesFor('quote'))}>Download quote PDF</Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => downloadPdf(`${name}-invoice.pdf`, linesFor('invoice'))}>Download invoice PDF</Button>
        {superAdmin && (
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => void onSaveOverride(blankPriceOverride(draft))}>Save this academy&apos;s price</Button>
        )}
        <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onRecord({
          kind: superAdmin ? 'quote' : 'quote',
          amount: quote.total,
          seats: quote.seats,
          description: linesFor('quote').join(' · '),
        })}>{superAdmin ? 'Record quote' : 'Request this quote'}</Button>
        {superAdmin && (
          <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => void onRecord({
            kind: 'invoice',
            amount: quote.total,
            seats: quote.seats,
            description: linesFor('invoice').join(' · '),
          })}>Record invoice</Button>
        )}
      </div>
    </section>
  );
}
