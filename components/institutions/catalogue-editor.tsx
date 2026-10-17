'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authedFetch } from '@/lib/api-client';
import {
  normalizeCatalogue,
  seedInstitutionCatalogue,
  tierRangeLabel,
  type CatalogueTier,
  type InstitutionCatalogue,
  type TierAccent,
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
      const saved = {
        ...draft,
        placeholder: false,
        items: draft.items.map((item) => ({ ...item, placeholder: false })),
        tiers: draft.tiers.map((tier) => ({ ...tier, placeholder: false })),
        bundleRules: draft.bundleRules.map((rule) => ({ ...rule, placeholder: false })),
      };
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
      <div className="rounded-3xl border border-[#1A3C34]/10 bg-white p-4">
        <h2 className="font-semibold text-[#1A3C34]">Bundle discount</h2>
        <p className="mt-1 text-sm text-[#1A3C34]/70">Optional. When an academy selects enough programmes, the highest matching step comes off those programmes. Categories stay at their own price. Set a step to 0 to turn it off.</p>
        <div className="mt-3 space-y-2">
          {draft.bundleRules.map((rule) => (
            <div key={rule.id} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Programmes, at least
                <Input className="mt-1" type="number" min={2} value={rule.minProgrammes} onChange={(event) => setDraft({ ...draft, bundleRules: draft.bundleRules.map((row) => row.id === rule.id ? { ...row, minProgrammes: Number(event.target.value) } : row) })} />
              </label>
              <label className="text-sm">Discount, 0 to 1
                <Input className="mt-1" type="number" min={0} max={1} step="0.01" value={rule.discount} onChange={(event) => setDraft({ ...draft, bundleRules: draft.bundleRules.map((row) => row.id === rule.id ? { ...row, discount: Number(event.target.value) } : row) })} />
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {draft.tiers.map((tier) => (
          <TierFields key={tier.id} tier={tier} items={draft.items} onChange={(next) => setDraft({ ...draft, tiers: draft.tiers.map((row) => row.id === tier.id ? next : row) })} />
        ))}
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

function TierFields({
  tier,
  items,
  onChange,
}: {
  tier: CatalogueTier;
  items: InstitutionCatalogue['items'];
  onChange: (tier: CatalogueTier) => void;
}) {
  const priceFor = (itemId: string) => tier.seatPrices.find((row) => row.itemId === itemId)?.perSeatMonthly ?? 0;
  const setPrice = (itemId: string, perSeatMonthly: number) => {
    const seatPrices = tier.seatPrices.some((row) => row.itemId === itemId)
      ? tier.seatPrices.map((row) => row.itemId === itemId ? { ...row, perSeatMonthly } : row)
      : [...tier.seatPrices, { itemId, perSeatMonthly }];
    onChange({ ...tier, seatPrices });
  };
  return (
    <section className="rounded-3xl border border-[#1A3C34]/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1A3C34]/60">{tierRangeLabel(tier)} students</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Name
          <Input className="mt-1" value={tier.name} onChange={(event) => onChange({ ...tier, name: event.target.value, label: event.target.value })} />
        </label>
        <label className="text-sm">From students
          <Input className="mt-1" type="number" min={0} value={tier.minSeats} onChange={(event) => onChange({ ...tier, minSeats: Number(event.target.value) })} />
        </label>
        <label className="text-sm">To students
          <Input className="mt-1" type="number" value={tier.maxSeats ?? ''} placeholder="open" onChange={(event) => onChange({ ...tier, maxSeats: event.target.value === '' ? null : Number(event.target.value) })} />
        </label>
        <label className="text-sm">Card colour
          <select className="mt-1 h-10 w-full rounded-xl border px-2" value={tier.accent} onChange={(event) => onChange({ ...tier, accent: event.target.value as TierAccent })}>
            <option value="mist">Mist</option>
            <option value="foam">Foam</option>
            <option value="deep">Deep</option>
            <option value="mid">Mid</option>
            <option value="bright">Bright</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm">Features, one per line
        <textarea className="mt-1 min-h-24 w-full rounded-xl border px-3 py-2" value={tier.features.join('\n')} onChange={(event) => onChange({ ...tier, features: event.target.value.split('\n').slice(0, 12) })} />
      </label>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={tier.quoteContact} onChange={(event) => onChange({ ...tier, quoteContact: event.target.checked })} /> Quote and contact</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={tier.selfServe} onChange={(event) => onChange({ ...tier, selfServe: event.target.checked })} /> Self-serve checkout</label>
      </div>
      {tier.quoteContact && (
        <label className="mt-3 block text-sm">Contact link
          <Input className="mt-1" value={tier.contactHref} onChange={(event) => onChange({ ...tier, contactHref: event.target.value })} />
        </label>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {items.map((entry) => (
          <label key={entry.id} className="text-sm">{entry.title} USD / seat
            <Input className="mt-1" type="number" min={0} step="0.01" value={priceFor(entry.id)} onChange={(event) => setPrice(entry.id, Number(event.target.value))} />
          </label>
        ))}
      </div>
    </section>
  );
}
