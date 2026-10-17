'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authedFetch } from '@/lib/api-client';
import {
  normalizeCatalogue,
  seedInstitutionCatalogue,
  type InstitutionCatalogue,
} from '@/lib/institution-catalogue';

export function CatalogueEditor() {
  const [draft, setDraft] = useState<InstitutionCatalogue>(seedInstitutionCatalogue());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/institutions/catalogue')
      .then((res) => res.json())
      .then((data: { catalogue?: unknown }) => {
        if (!cancelled && data.catalogue) setDraft(normalizeCatalogue(data.catalogue));
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = { ...draft, placeholder: false, items: draft.items.map((item) => ({ ...item, placeholder: false })), tiers: draft.tiers.map((tier) => ({ ...tier, placeholder: false })) };
      const data = await authedFetch('/api/institutions/catalogue', { method: 'PUT', body: JSON.stringify(saved) });
      if (data.catalogue) setDraft(normalizeCatalogue(data.catalogue));
      toast.success('Institution prices saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save prices.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-[#1A3C34]">Loading the catalogue.</p>;

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-[#F8E7C4] px-4 py-3 text-sm text-[#1A3C34]">{draft.note}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Annual discount
          <Input className="mt-1" type="number" min={0} max={1} step="0.01" value={draft.annualDiscount} onChange={(event) => setDraft({ ...draft, annualDiscount: Number(event.target.value) })} />
        </label>
        <label className="text-sm">Quote PDF from seats
          <Input className="mt-1" type="number" min={1} value={draft.quoteMinSeats} onChange={(event) => setDraft({ ...draft, quoteMinSeats: Number(event.target.value) })} />
        </label>
        <label className="text-sm">Trial days
          <Input className="mt-1" type="number" min={1} max={90} value={draft.trialDays} onChange={(event) => setDraft({ ...draft, trialDays: Number(event.target.value) })} />
        </label>
        <label className="text-sm">Trial seat cap
          <Input className="mt-1" type="number" min={1} value={draft.trialSeatCap} onChange={(event) => setDraft({ ...draft, trialSeatCap: Number(event.target.value) })} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#1A3C34]/70">
              <th className="py-2">Tier</th>
              <th>From</th>
              <th>To</th>
              <th>Discount</th>
            </tr>
          </thead>
          <tbody>
            {draft.tiers.map((tier) => (
              <tr key={tier.id}>
                <td className="py-1 pr-2">{tier.label}</td>
                <td className="pr-2"><Input type="number" value={tier.minSeats} onChange={(event) => setDraft({ ...draft, tiers: draft.tiers.map((row) => row.id === tier.id ? { ...row, minSeats: Number(event.target.value) } : row) })} /></td>
                <td className="pr-2"><Input type="number" value={tier.maxSeats ?? ''} placeholder="open" onChange={(event) => setDraft({ ...draft, tiers: draft.tiers.map((row) => row.id === tier.id ? { ...row, maxSeats: event.target.value === '' ? null : Number(event.target.value) } : row) })} /></td>
                <td><Input type="number" min={0} max={1} step="0.01" value={tier.discount} onChange={(event) => setDraft({ ...draft, tiers: draft.tiers.map((row) => row.id === tier.id ? { ...row, discount: Number(event.target.value) } : row) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#1A3C34]/70">
              <th className="py-2">Item</th>
              <th>Per seat / month</th>
              <th>Sparks / seat</th>
              <th>Billing</th>
              <th>Minimum</th>
              <th>Over seats</th>
            </tr>
          </thead>
          <tbody>
            {draft.items.map((item) => (
              <tr key={item.id}>
                <td className="py-1 pr-2">{item.title}</td>
                <td className="pr-2"><Input type="number" min={0} step="0.01" value={item.perSeatMonthly} onChange={(event) => setDraft({ ...draft, items: draft.items.map((row) => row.id === item.id ? { ...row, perSeatMonthly: Number(event.target.value) } : row) })} /></td>
                <td className="pr-2"><Input type="number" min={0} value={item.sparksPerSeat} onChange={(event) => setDraft({ ...draft, items: draft.items.map((row) => row.id === item.id ? { ...row, sparksPerSeat: Number(event.target.value) } : row) })} /></td>
                <td className="pr-2">
                  <select className="h-10 rounded-xl border px-2" value={item.billingBasis} onChange={(event) => setDraft({ ...draft, items: draft.items.map((row) => row.id === item.id ? { ...row, billingBasis: event.target.value === 'active_minimum' ? 'active_minimum' : 'purchased' } : row) })}>
                    <option value="purchased">Purchased seats</option>
                    <option value="active_minimum">Active, with a minimum</option>
                  </select>
                </td>
                <td className="pr-2"><Input type="number" min={0} value={item.minimumSeats} onChange={(event) => setDraft({ ...draft, items: draft.items.map((row) => row.id === item.id ? { ...row, minimumSeats: Number(event.target.value) } : row) })} /></td>
                <td>
                  <select className="h-10 rounded-xl border px-2" value={item.overage} onChange={(event) => setDraft({ ...draft, items: draft.items.map((row) => row.id === item.id ? { ...row, overage: event.target.value === 'auto_add' ? 'auto_add' : 'prompt' } : row) })}>
                    <option value="prompt">Prompt to add seats</option>
                    <option value="auto_add">Add seats automatically</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {draft.currencies.map((currency) => (
          <label key={currency.code} className="text-sm">{currency.code} per 1 USD
            <Input className="mt-1" type="number" min={0} step="0.01" value={currency.rate} onChange={(event) => setDraft({ ...draft, currencies: draft.currencies.map((row) => row.code === currency.code ? { ...row, rate: Number(event.target.value) } : row) })} />
          </label>
        ))}
      </div>
      <Button className="h-11 rounded-full bg-[#1A3C34]" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save catalogue'}</Button>
    </div>
  );
}
