'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildSparkPool, defaultSparksConfig, sparksForPlan, sparkUsageReport, type SparkAllocation } from '@/lib/institution-membership';
import type { VolumePlanId } from '@/lib/institution-pricing';
import { loadCurrentBill, loadSparkPool, readSparkGuard, saveSparkAllocation, saveSparkGuard } from '@/lib/institution-membership-store';
import { guardSparkSpend } from '@/lib/institution-commerce';

export default function InstitutionSparksPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [planId, setPlanId] = useState<VolumePlanId>('igcse_alevel');
  const [seats, setSeats] = useState(40);
  const [perSeat, setPerSeat] = useState(defaultSparksConfig().igcse_alevel);
  const [topUps, setTopUps] = useState(0);
  const [allocated, setAllocated] = useState(0);
  const [cap, setCap] = useState(800);
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState(300);
  const [allocations, setAllocations] = useState<SparkAllocation[]>([]);
  const pool = useMemo(() => buildSparkPool({ planId, seats, perSeat, topUps, allocated }), [planId, seats, perSeat, topUps, allocated]);

  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      loadCurrentBill(institutionId),
      loadSparkPool(institutionId),
      readSparkGuard(institutionId),
    ]).then(([bill, stored, guard]) => {
      if (bill) {
        setPlanId(bill.planId);
        setSeats(bill.seats);
        setPerSeat(sparksForPlan(defaultSparksConfig(), bill.planId));
      }
      setTopUps(stored.topUps);
      setAllocated(stored.allocated);
      if (guard.cap != null) setCap(guard.cap);
    }).catch(() => toast.error('Could not load the Sparks pool.'));
  }, [institutionId]);

  const allocate = async () => {
    if (!institutionId || 'error' in pool) return;
    try {
      const next = await saveSparkAllocation(institutionId, pool, allocations, { subjectId: studentId, amount, classId: '' });
      setAllocations(next);
      const report = sparkUsageReport(pool, next.map((row) => ({ subjectId: row.subjectId, name: row.subjectId, allowance: row.amount, spent: 0 })));
      const guard = guardSparkSpend({ allowance: pool.allowance + pool.topUps, spent: 0, amount, cap, lowAtPercent: 20 });
      if ('error' in guard) toast.error(guard.error);
      else if (guard.alert) toast.message(guard.alert);
      else toast.success(`Allocated. ${report.remaining} Sparks remain in the pool.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not allocate Sparks.');
    }
  };

  return (
    <DashPage className="max-w-3xl">
      <DashHeader eyebrow="Institution" title="Sparks pool" description="A finite monthly allowance per student seat. There is no unlimited plan. Sparks cannot buy marketplace courses. Poket Reads reserves a book's cost on this same pool, and reserving that book again replaces the row." />
      <Panel>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">Student seats
            <Input className="mt-1 h-11 rounded-xl" type="number" min={0} inputMode="numeric" value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
          </label>
          <label className="text-sm">Sparks per seat
            <Input className="mt-1 h-11 rounded-xl" type="number" min={0} inputMode="numeric" value={perSeat} onChange={(event) => setPerSeat(Number(event.target.value))} />
          </label>
          <label className="text-sm">Spending cap
            <Input className="mt-1 h-11 rounded-xl" type="number" min={0} inputMode="numeric" value={cap} onChange={(event) => setCap(Number(event.target.value))} />
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{'error' in pool ? pool.error : `${pool.available} Sparks available before this allocation.`} Defaults are 300, 800, and 1000 by level.</p>
        <Button variant="outline" className="mt-3 h-11 w-full rounded-full sm:w-auto" onClick={() => institutionId && saveSparkGuard(institutionId, cap, 20).then(() => toast.success('Cap saved.')).catch(() => toast.error('Could not save the cap.'))}>Save cap</Button>
      </Panel>
      <Panel>
        <div className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <label className="text-sm">Student or class id
            <Input className="mt-1 h-11 rounded-xl" value={studentId} onChange={(event) => setStudentId(event.target.value)} autoComplete="off" />
          </label>
          <label className="text-sm">Sparks
            <Input className="mt-1 h-11 rounded-xl" type="number" min={0} inputMode="numeric" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          </label>
          <Button className="h-11 w-full rounded-full sm:w-auto" onClick={() => void allocate()}>Allocate</Button>
        </div>
      </Panel>
    </DashPage>
  );
}
