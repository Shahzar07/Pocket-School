'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { defaultSparksConfig, sparkUsageReport, type SparkAllocation } from '@/lib/institution-membership';
import { loadSparkPool, readSparkGuard, saveSparkAllocation, saveSparkGuard } from '@/lib/institution-membership-store';
import { guardSparkSpend } from '@/lib/institution-commerce';

export default function InstitutionSparksPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [seats, setSeats] = useState(40);
  const [perSeat, setPerSeat] = useState(defaultSparksConfig().igcse_alevel);
  const [available, setAvailable] = useState(0);
  const [cap, setCap] = useState(800);
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState(300);
  const [allocations, setAllocations] = useState<SparkAllocation[]>([]);

  useEffect(() => {
    if (!institutionId) return;
    Promise.all([
      loadSparkPool(institutionId, seats, perSeat),
      readSparkGuard(institutionId),
    ]).then(([pool, guard]) => {
      setAvailable(pool.available);
      if (guard.cap != null) setCap(guard.cap);
    }).catch(() => toast.error('Could not load the Sparks pool.'));
  }, [institutionId, seats, perSeat]);

  const allocate = async () => {
    if (!institutionId) return;
    try {
      const pool = await loadSparkPool(institutionId, seats, perSeat);
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
      <DashHeader eyebrow="Institution" title="Sparks pool" description="A finite monthly allowance per student seat. There is no unlimited plan. Sparks cannot buy marketplace courses." />
      <Panel>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">Student seats
            <Input className="mt-1 h-11 rounded-xl" type="number" value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
          </label>
          <label className="text-sm">Sparks per seat
            <Input className="mt-1 h-11 rounded-xl" type="number" value={perSeat} onChange={(event) => setPerSeat(Number(event.target.value))} />
          </label>
          <label className="text-sm">Spending cap
            <Input className="mt-1 h-11 rounded-xl" type="number" value={cap} onChange={(event) => setCap(Number(event.target.value))} />
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{available} Sparks available before this allocation. Defaults are 300, 800, and 1000 by level.</p>
        <Button variant="outline" className="mt-3 rounded-full" onClick={() => institutionId && saveSparkGuard(institutionId, cap, 20).then(() => toast.success('Cap saved.')).catch(() => toast.error('Could not save the cap.'))}>Save cap</Button>
      </Panel>
      <Panel>
        <div className="grid sm:grid-cols-[1fr_8rem_auto] gap-2 items-end">
          <label className="text-sm">Student or class id
            <Input className="mt-1 h-11 rounded-xl" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
          </label>
          <label className="text-sm">Sparks
            <Input className="mt-1 h-11 rounded-xl" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          </label>
          <Button className="rounded-full" onClick={() => void allocate()}>Allocate</Button>
        </div>
      </Panel>
    </DashPage>
  );
}
