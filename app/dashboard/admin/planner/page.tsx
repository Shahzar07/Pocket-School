'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { db } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { resolveStaffRole } from '@/lib/admin-console';
import { limitsForAge, mergeLimits, type PlannerLimits } from '@/lib/study/planner';
import { CalendarBoard } from '@/components/planner/calendar-board';
import { PLANNER_COPY } from '@/lib/planner/copy';

const EMPTY: PlannerLimits = limitsForAge('adult');

export default function PlannerDefaultsPage() {
  const { profile } = useAuthSTORE();
  const [limits, setLimits] = useState<PlannerLimits>(EMPTY);
  const [saving, setSaving] = useState(false);
  const staff = resolveStaffRole(profile ? { email: profile.email, role: profile.role, adminRole: profile.adminRole } : null);
  const superAdmin = staff === 'super_admin';

  useEffect(() => {
    getDoc(doc(db, 'planner_defaults', 'global')).then((snap) => {
      if (!snap.exists()) return;
      setLimits(mergeLimits(limitsForAge('adult'), snap.data() as Partial<PlannerLimits>));
    }).catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'planner_defaults', 'global'), limits);
      toast.success('Planner limits saved.');
    } catch {
      toast.error('Could not save planner limits.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Admin"
        title={PLANNER_COPY.pageTitle}
        description="These caps tighten the age limits. A younger learner never goes above their own cap."
      />
      <form className="max-w-lg space-y-4 rounded-[28px] border border-[#E7EDED] bg-white p-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {([
          ['maxDailyMinutes', 'Maximum minutes in a day'],
          ['maxGoalsPerDay', 'Maximum goals in a day'],
          ['rescheduleLimit', 'Reschedules for an assigned goal'],
          ['missFlagAfter', 'Misses before a teacher flag'],
        ] as const).map(([key, label]) => (
          <label key={key} className="block text-sm font-semibold text-[#203337]">
            {label}
            <input
              type="number"
              min={1}
              className="mt-1 h-10 w-full rounded-xl border border-[#E7EDED] px-3"
              value={limits[key]}
              disabled={!superAdmin}
              onChange={(event) => setLimits((current) => ({ ...current, [key]: Number(event.target.value) }))}
            />
          </label>
        ))}
        <button type="submit" disabled={!superAdmin || saving} className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337] disabled:bg-[#E7EDED]">
          {saving ? 'Saving…' : 'Save defaults'}
        </button>
      </form>
      <CalendarBoard />
    </DashPage>
  );
}
