'use client';

import { Loader2 } from 'lucide-react';
import { YearPlanner, type PlannerRole } from '@/components/planner/year-planner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isoDateKey } from '@/lib/insights/dates';

export default function PlannerPage() {
  const { user, profile, loading } = useAuthSTORE();
  if (loading || !user || !profile) {
    return (
      <div className="min-h-[40vh] grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  const role = (profile.role ?? 'student') as PlannerRole;
  const canEdit = role === 'teacher' || role === 'admin' || role === 'institution_admin';
  return (
    <YearPlanner
      role={role}
      canEdit={canEdit}
      persist
      today={isoDateKey()}
      ownerId={user.uid}
      institutionId={profile.institutionId || 'school'}
      brand="Poket School"
    />
  );
}
