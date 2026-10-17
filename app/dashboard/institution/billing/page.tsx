'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSuperAdmin } from '@/lib/roles';
import { quoteForInstitution } from '@/lib/institution-membership';
import { tierCliff } from '@/lib/institution-pricing';
import { seedInstitutionPricing, VOLUME_PLANS, type VolumeInterval, type VolumePlanId } from '@/lib/institution-pricing';
import { scaleSeats } from '@/lib/institution-commerce';

export default function InstitutionBillingPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const superAdmin = isSuperAdmin(profile);
  const [phase, setPhase] = useState('pending_payment');
  const [seats, setSeats] = useState(40);
  const [activeStudents, setActiveStudents] = useState(40);
  const [planId, setPlanId] = useState<VolumePlanId>('igcse_alevel');
  const [interval, setInterval] = useState<VolumeInterval>('annual');
  const [email, setEmail] = useState('');
  const [linkText, setLinkText] = useState('');

  useEffect(() => {
    if (!institutionId) return;
    getDoc(doc(db, 'institutions', institutionId, 'billing', 'current')).then((snap) => {
      const data = snap.data() as { phase?: string; seats?: number; planId?: VolumePlanId; interval?: VolumeInterval; payerEmail?: string } | undefined;
      if (!data) return;
      if (data.phase) setPhase(data.phase);
      if (typeof data.seats === 'number') setSeats(data.seats);
      if (data.planId) setPlanId(data.planId);
      if (data.interval) setInterval(data.interval);
      if (data.payerEmail) setEmail(data.payerEmail);
    }).catch(() => undefined);
  }, [institutionId]);

  const quote = quoteForInstitution({ seats, planId, interval });
  const cliff = tierCliff(seedInstitutionPricing(), planId, interval);
  const scaled = scaleSeats({
    seats,
    activeStudents,
    periodStart: '2026-01-01',
    periodEnd: interval === 'annual' ? '2026-12-31' : '2026-01-31',
    on: new Date().toISOString().slice(0, 10),
    perSeat: quote.perStudent || quote.total / Math.max(1, seats),
  });

  const sendLink = async () => {
    try {
      const data = await authedFetch('/api/institutions/billing/link', {
        method: 'POST',
        body: JSON.stringify({ institutionId, institutionName: 'Institution', planId, interval, seats, payerEmail: email }),
      });
      const text = typeof data.text === 'string' ? data.text : '';
      const url = typeof data.url === 'string' ? data.url : '';
      setLinkText(text || url);
      toast.success(url ? 'Payment link ready.' : 'Invoice recorded. Add Stripe to email a card link.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the link.');
    }
  };

  return (
    <DashPage className="max-w-3xl">
      <DashHeader eyebrow="Institution" title="Billing" description={`Phase: ${phase}. Institutions pay per student seat. Teachers and parents are not seats. A failed payment has a 7-day grace, then the academy suspends until it is paid.`} />
      <Panel>
        <p className="text-2xl font-semibold">{quote.currency} {quote.total.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">{quote.tierLabel} · {quote.seats} student seats · {interval}</p>
        {cliff && <p className="mt-2 text-sm text-amber-700">The next band, {cliff.toLabel}, is cheaper than {cliff.fromLabel}. Banded pricing is there so a school is not pushed off a cliff.</p>}
        {!('error' in scaled) && scaled.charge > 0 && <p className="mt-2 text-sm">Pro-rated charge for {activeStudents - seats} added seats: {quote.currency} {scaled.charge.toFixed(2)}.</p>}
        {!('error' in scaled) && scaled.credit > 0 && <p className="mt-2 text-sm">Pro-rated credit for unused seats: {quote.currency} {scaled.credit.toFixed(2)}.</p>}
      </Panel>
      {superAdmin && (
        <Panel>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Level
              <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={planId} onChange={(event) => setPlanId(event.target.value as VolumePlanId)}>
                {VOLUME_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Interval
              <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={interval} onChange={(event) => setInterval(event.target.value as VolumeInterval)}>
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="text-sm">Seats
              <Input className="mt-1 h-11 rounded-xl" type="number" value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
            </label>
            <label className="text-sm">Active students
              <Input className="mt-1 h-11 rounded-xl" type="number" value={activeStudents} onChange={(event) => setActiveStudents(Number(event.target.value))} />
            </label>
            <label className="text-sm sm:col-span-2">Billing email
              <Input className="mt-1 h-11 rounded-xl" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          </div>
          <Button className="mt-3 rounded-full" onClick={() => void sendLink()}>Email payment link</Button>
          {linkText && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs">{linkText}</pre>}
        </Panel>
      )}
    </DashPage>
  );
}
