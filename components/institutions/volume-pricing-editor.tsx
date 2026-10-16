'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  VOLUME_ADDONS,
  VOLUME_PLANS,
  addonName,
  planName,
  seedInstitutionPricing,
  validateVolumeSchedule,
  type InstitutionVolumeSchedule,
  type TierPrice,
  type VolumePlanId,
  type VolumeTier,
} from '@/lib/institution-pricing';
import { loadVolumeSchedule, saveVolumeSchedule } from '@/lib/institution-pricing-store';

function priceRows(schedule: InstitutionVolumeSchedule, planId: VolumePlanId): TierPrice[] {
  const plan = schedule.plans.find((item) => item.id === planId);
  return schedule.tiers.map((tier) => plan?.tiers.find((row) => row.tierId === tier.id) ?? {
    tierId: tier.id,
    monthlyPerStudent: 0,
    annualPerStudent: 0,
    flatMonthly: 0,
    flatAnnual: 0,
  });
}

export function VolumePricingEditor() {
  const { user, profile } = useAuthSTORE();
  const [draft, setDraft] = useState<InstitutionVolumeSchedule>(seedInstitutionPricing());
  const [planId, setPlanId] = useState<VolumePlanId>('igcse_alevel');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadVolumeSchedule()
      .then((schedule) => { if (!cancelled) setDraft(schedule); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const updateTier = (id: string, patch: Partial<VolumeTier>) => {
    setDraft((current) => ({
      ...current,
      tiers: current.tiers.map((tier) => tier.id === id ? { ...tier, ...patch } : tier),
    }));
  };

  const updatePrice = (tierId: string, field: keyof Omit<TierPrice, 'tierId'>, value: string) => {
    const number = value.trim() === '' ? 0 : Number(value);
    if (!Number.isFinite(number)) return;
    setDraft((current) => ({
      ...current,
      plans: current.plans.map((plan) => plan.id === planId ? {
        ...plan,
        tiers: priceRows(current, planId).map((row) => row.tierId === tierId ? { ...row, [field]: number } : row),
      } : plan),
    }));
  };

  const updateAddon = (id: string, field: 'monthlyPerStudent' | 'annualPerStudent' | 'flatMonthly' | 'flatAnnual', value: string) => {
    const number = value.trim() === '' ? 0 : Number(value);
    if (!Number.isFinite(number)) return;
    setDraft((current) => ({
      ...current,
      addons: current.addons.map((addon) => addon.id === id ? { ...addon, [field]: number } : addon),
    }));
  };

  const addTier = () => {
    setDraft((current) => {
      const last = [...current.tiers].sort((a, b) => a.minStudents - b.minStudents).at(-1);
      const min = last ? (last.maxStudents ?? last.minStudents) + 1 : 0;
      const id = `tier-${min}-${Date.now()}`;
      const tier: VolumeTier = { id, label: `${min}+`, minStudents: min, maxStudents: null };
      if (last && last.maxStudents == null) {
        return {
          ...current,
          tiers: current.tiers.map((item) => item.id === last.id ? { ...item, maxStudents: min - 1, label: `${item.minStudents}–${min - 1}` } : item).concat(tier),
          plans: current.plans.map((plan) => ({ ...plan, tiers: [...priceRows({ ...current, tiers: current.tiers }, plan.id), { tierId: id, monthlyPerStudent: 0, annualPerStudent: 0, flatMonthly: 0, flatAnnual: 0 }] })),
        };
      }
      return {
        ...current,
        tiers: [...current.tiers, tier],
        plans: current.plans.map((plan) => ({
          ...plan,
          tiers: [...priceRows(current, plan.id), { tierId: id, monthlyPerStudent: 0, annualPerStudent: 0, flatMonthly: 0, flatAnnual: 0 }],
        })),
      };
    });
  };

  const removeTier = (id: string) => {
    setDraft((current) => {
      if (current.tiers.length < 2) return current;
      return {
        ...current,
        tiers: current.tiers.filter((tier) => tier.id !== id),
        plans: current.plans.map((plan) => ({ ...plan, tiers: plan.tiers.filter((row) => row.tierId !== id) })),
      };
    });
  };

  const save = async () => {
    const problem = validateVolumeSchedule(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (!user) {
      toast.error('Sign in as a platform admin to save institution pricing.');
      return;
    }
    setSaving(true);
    try {
      await saveVolumeSchedule({ ...draft, currency: draft.currency.trim().toUpperCase() }, {
        actorId: user.uid,
        actorName: profile?.name ?? user.email ?? 'Admin',
      });
      toast.success('Institution volume pricing saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save institution pricing.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-muted" />;

  const rows = priceRows(draft, planId);

  return (
    <section className="rounded-3xl border border-border p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Institution volume pricing</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Student bands, a per-student price, and an optional flat platform fee. The starting IGCSE & A-Level annual fees are the published USD school subscriptions for one A level maths ActiveLearn service. Unpublished monthly, per-student, primary, professional, and add-on prices stay at 0 until you set them.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Currency
          <Input value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} className="mt-1 h-11 rounded-xl" maxLength={3} />
        </label>
        <label className="text-sm">Plan level
          <select aria-label="Plan level" value={planId} onChange={(event) => setPlanId(event.target.value as VolumePlanId)} className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3">
            {VOLUME_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 pr-2">Tier</th>
              <th className="py-2 pr-2">From</th>
              <th className="py-2 pr-2">To</th>
              <th className="py-2 pr-2">Per student / month</th>
              <th className="py-2 pr-2">Per student / year</th>
              <th className="py-2 pr-2">Platform fee / month</th>
              <th className="py-2 pr-2">Platform fee / year</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.tiers.map((tier) => {
              const price = rows.find((row) => row.tierId === tier.id);
              return (
                <tr key={tier.id} className="border-t border-border">
                  <td className="py-2 pr-2"><Input aria-label={`Label ${tier.id}`} value={tier.label} onChange={(event) => updateTier(tier.id, { label: event.target.value })} className="h-10 rounded-xl" /></td>
                  <td className="py-2 pr-2"><Input aria-label={`From ${tier.id}`} type="number" min={0} value={tier.minStudents} onChange={(event) => updateTier(tier.id, { minStudents: Number(event.target.value) })} className="h-10 w-24 rounded-xl" /></td>
                  <td className="py-2 pr-2"><Input aria-label={`To ${tier.id}`} type="number" min={0} value={tier.maxStudents ?? ''} placeholder="open" onChange={(event) => updateTier(tier.id, { maxStudents: event.target.value === '' ? null : Number(event.target.value) })} className="h-10 w-24 rounded-xl" /></td>
                  {(['monthlyPerStudent', 'annualPerStudent', 'flatMonthly', 'flatAnnual'] as const).map((field) => (
                    <td key={field} className="py-2 pr-2">
                      <Input aria-label={`${field} ${tier.id}`} type="number" min={0} step="0.01" value={price?.[field] ?? 0} onChange={(event) => updatePrice(tier.id, field, event.target.value)} className="h-10 w-28 rounded-xl" />
                    </td>
                  ))}
                  <td className="py-2"><Button type="button" variant="outline" className="rounded-full" onClick={() => removeTier(tier.id)}>Delete</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" className="rounded-full" onClick={addTier}>Add tier</Button>
      <div className="space-y-3">
        <h3 className="font-semibold">Add-ons</h3>
        {draft.addons.map((addon) => (
          <div key={addon.id} className="grid sm:grid-cols-5 gap-2 items-end">
            <p className="text-sm font-medium sm:col-span-1">{addonName(addon.id)}</p>
            {(['monthlyPerStudent', 'annualPerStudent', 'flatMonthly', 'flatAnnual'] as const).map((field) => (
              <label key={field} className="text-xs text-muted-foreground">{field}
                <Input aria-label={`${addon.id} ${field}`} type="number" min={0} step="0.01" value={addon[field]} onChange={(event) => updateAddon(addon.id, field, event.target.value)} className="mt-1 h-10 rounded-xl" />
              </label>
            ))}
          </div>
        ))}
      </div>
      <Button type="button" className="rounded-full" disabled={saving} onClick={() => void save()}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        Save {planName(planId)} pricing
      </Button>
    </section>
  );
}
