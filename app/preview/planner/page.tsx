'use client';

import { useMemo, useState } from 'react';
import { YearPlanner, type PlannerRole } from '@/components/planner/year-planner';
import { rebuildPlan } from '@/lib/insights/planner';
import { SEED_UNITS, seedPlan } from '@/lib/insights/planner-seed';

const ROLES: { id: PlannerRole; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'parent', label: 'Parent' },
  { id: 'institution_admin', label: 'School' },
  { id: 'admin', label: 'Admin' },
];

export default function PlannerPreviewPage() {
  const [role, setRole] = useState<PlannerRole>('institution_admin');
  const initial = useMemo(() => {
    const seed = seedPlan();
    return {
      id: seed.id,
      label: seed.label,
      brand: seed.brand,
      status: 'draft' as const,
      ownerId: seed.ownerId,
      institutionId: seed.institutionId,
      campusId: '',
      classId: '',
      yearGroup: '',
      termStart: '2026-10-01',
      termEnd: '2026-11-06',
      unitsText: SEED_UNITS.map(unit => `${unit.title}: ${unit.lessons.join(' | ')}`).join('\n'),
      events: rebuildPlan(SEED_UNITS, '2026-10-01', '2026-11-06', seed.events),
      updatedAt: '',
    };
  }, []);
  const canEdit = role === 'teacher' || role === 'admin' || role === 'institution_admin';

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 pt-4">
        <p className="text-xs text-muted-foreground">Preview of /dashboard/planner. The same page is linked as Year planner for every role.</p>
        <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Role">
          {ROLES.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={role === item.id}
              className={`h-9 px-3 rounded-full text-sm font-semibold ${role === item.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}
              onClick={() => setRole(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-4">
        <YearPlanner
          key={role}
          role={role}
          canEdit={canEdit}
          persist={false}
          initial={initial}
          today="2026-10-24"
          ownerId={initial.ownerId}
          institutionId={initial.institutionId}
          brand={initial.brand}
        />
      </div>
    </main>
  );
}
