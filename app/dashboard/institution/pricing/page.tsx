'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { PriceCalculator } from '@/components/institutions/price-calculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { seedInstitutionCatalogue } from '@/lib/institution-catalogue';

export default function InstitutionPricingPage() {
  const institutionId = useAuthSTORE((state) => state.profile?.institutionId ?? '');
  const [itemId, setItemId] = useState('igcse');
  const [level, setLevel] = useState('IGCSE');
  const [studentId, setStudentId] = useState('');

  const apply = async (selection: { itemIds: string[]; seats: number; active: number; interval: 'monthly' | 'annual' }) => {
    if (!institutionId) {
      toast.error('Open this page from an academy account to update seats and programmes.');
      return;
    }
    try {
      const data = await authedFetch('/api/institutions/billing/change', {
        method: 'POST',
        body: JSON.stringify({
          institutionId,
          seats: selection.seats,
          programmeIds: selection.itemIds,
          interval: selection.interval,
          confirmSandbox: true,
        }),
      });
      if (typeof data.url === 'string' && data.url) {
        window.location.href = data.url;
        return;
      }
      const credit = typeof data.credit === 'number' ? data.credit : 0;
      const charge = typeof data.charge === 'number' ? data.charge : 0;
      const active = typeof data.activeSeats === 'number' ? data.activeSeats : selection.active;
      toast.success(credit > 0
        ? `Updated. Credit ${credit.toFixed(2)} for the days left. Billing counts ${active} active students.`
        : charge > 0
          ? `Updated. ${charge.toFixed(2)} is due for the days left. Billing counts ${active} active students.`
          : `Updated. Billing counts ${active} active students.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the academy.');
    }
  };

  const assign = async () => {
    if (!institutionId) return;
    try {
      await authedFetch('/api/institutions/programme-access', {
        method: 'POST',
        body: JSON.stringify({
          institutionId,
          grants: [{ itemId, levels: level ? [level] : [], studentIds: studentId ? [studentId] : [] }],
        }),
      });
      toast.success('Those students can open that programme.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the assignment.');
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Institution"
        title="Pricing"
        description="Select every programme this academy needs. The price adds each one, and the tier follows unique students."
      />
      <PriceCalculator institutionName="Academy" onApply={(selection) => void apply(selection)} />
      <section className="rounded-3xl border border-[#1A3C34]/10 bg-white p-4">
        <h2 className="font-semibold text-[#1A3C34]">Who receives a programme</h2>
        <p className="mt-1 text-sm text-[#1A3C34]/70">Assign a level name, a student, or both. A student then sees courses for programmes the academy has paid for at that level.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Programme
            <select className="mt-1 h-11 w-full rounded-xl border px-3" value={itemId} onChange={(event) => setItemId(event.target.value)}>
              {seedInstitutionCatalogue().items.filter((item) => item.kind === 'programme').map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">Level name
            <Input className="mt-1" value={level} onChange={(event) => setLevel(event.target.value)} />
          </label>
          <label className="text-sm">Student id
            <Input className="mt-1" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
          </label>
        </div>
        <Button className="mt-3 h-11 rounded-full bg-[#1A3C34]" disabled={!institutionId} onClick={() => void assign()}>Save assignment</Button>
      </section>
    </DashPage>
  );
}
