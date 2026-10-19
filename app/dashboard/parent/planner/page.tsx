'use client';

import { DashHeader, DashPage } from '@/components/dash-ui';
import { CalendarBoard } from '@/components/planner/calendar-board';
import { PLANNER_COPY } from '@/lib/planner/copy';

export default function ParentPlannerPage() {
  return (
    <DashPage>
      <DashHeader eyebrow="Family" title={PLANNER_COPY.pageTitle} description="Classes, assignments, exams, attendance, and goals for the learners linked to this account." />
      <CalendarBoard />
    </DashPage>
  );
}
