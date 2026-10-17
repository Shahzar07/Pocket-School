'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSuperAdmin } from '@/lib/roles';
import { periodStartFor, type SubscriptionState } from '@/lib/institution-membership';
import { institutionReadsBill } from '@/lib/platform/licence';
import { loadCurrentBill } from '@/lib/institution-membership-store';
import { seedInstitutionPricing, tierCliff, VOLUME_PLANS, type VolumeInterval, type VolumePlanId } from '@/lib/institution-pricing';
import { scaleSeats } from '@/lib/institution-commerce';

export default function InstitutionBillingPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const superAdmin = isSuperAdmin(profile);
  const [bill, setBill] = useState<SubscriptionState | null>(null);
  const [seats, setSeats] = useState(40);
  const [activeStudents, setActiveStudents] = useState(40);
  const [planId, setPlanId] = useState<VolumePlanId>('igcse_alevel');
  const [interval, setInterval] = useState<VolumeInterval>('annual');
  const [email, setEmail] = useState('');
  const [linkText, setLinkText] = useState('');

  useEffect(() => {
    if (!institutionId) return;
    loadCurrentBill(institutionId).then((current) => {
      if (!current) return;
      setBill(current);
      setSeats(current.seats);
      setActiveStudents(current.seats);
      setPlanId(current.planId);
      setInterval(current.interval);
      if (current.payerEmail) setEmail(current.payerEmail);
    }).catch(() => undefined);
  }, [institutionId]);

  const quote = institutionReadsBill({ seats, planId, interval });
  const cliff = tierCliff(seedInstitutionPricing(), planId, interval);
  const periodStart = bill ? periodStartFor(bill.periodEnd, bill.interval) : '';
  const scaled = bill && periodStart ? scaleSeats({
    seats: bill.seats,
    activeStudents,
    periodStart,
    periodEnd: bill.periodEnd,
    on: new Date().toISOString().slice(0, 10),
    perSeat: bill.seats > 0 ? bill.total / bill.seats : 0,
  }) : null;

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
      <DashHeader eyebrow="Institution" title="Billing" description={`Phase: ${bill?.phase ?? 'pending_payment'}. Institutions pay per student seat. Teachers and parents are not seats. A failed payment has a 7-day grace, then the academy suspends until it is paid.`} />
      <Panel>
        <p className="text-2xl font-semibold tabular-nums">{quote.currency} {quote.total.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">{quote.seats.tierLabel} · {quote.seats.seats} student seats · {interval}</p>
        <p className="mt-2 text-sm">Poket Reads add-on {quote.currency} {quote.reads.addonTotal.toFixed(2)}. Licensed books sit on this same bill. Students on a seat are not charged again.</p>
        {cliff && <p className="mt-2 text-sm text-amber-800">The next band, {cliff.toLabel}, is cheaper than {cliff.fromLabel}. Banded pricing is there so a school is not pushed off a cliff.</p>}
        {bill && scaled && !('error' in scaled) && scaled.charge > 0 && <p className="mt-2 text-sm">Pro-rated charge for {activeStudents - bill.seats} added seats, for the days left in this period: {bill.currency} {scaled.charge.toFixed(2)}.</p>}
        {bill && scaled && !('error' in scaled) && scaled.credit > 0 && <p className="mt-2 text-sm">Pro-rated credit for unused seats, for the days left in this period: {bill.currency} {scaled.credit.toFixed(2)}.</p>}
      </Panel>
      {superAdmin && (
        <Panel>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Level
              <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={planId} onChange={(event) => setPlanId(event.target.value as VolumePlanId)} aria-label="Level">
                {VOLUME_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
            </label>
            <label className="text-sm">Interval
              <select className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3" value={interval} onChange={(event) => setInterval(event.target.value as VolumeInterval)} aria-label="Billing interval">
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="text-sm">Seats on the next bill
              <Input className="mt-1 h-11 rounded-xl" type="number" min={1} inputMode="numeric" value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
            </label>
            <label className="text-sm">Active students now
              <Input className="mt-1 h-11 rounded-xl" type="number" min={0} inputMode="numeric" value={activeStudents} onChange={(event) => setActiveStudents(Number(event.target.value))} />
            </label>
            <label className="text-sm sm:col-span-2">Billing email
              <Input className="mt-1 h-11 rounded-xl" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          </div>
          <Button className="mt-3 h-11 w-full rounded-full sm:w-auto" onClick={() => void sendLink()}>Email payment link</Button>
          {linkText && <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs">{linkText}</pre>}
        </Panel>
      )}
    </DashPage>
  );
}
