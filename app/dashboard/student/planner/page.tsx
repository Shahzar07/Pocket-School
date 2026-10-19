'use client';

import { DashHeader, DashPage } from '@/components/dash-ui';
import { CalendarBoard } from '@/components/planner/calendar-board';
import { PLANNER_COPY } from '@/lib/planner/copy';

export default function StudentPlannerPage() {
  return (
    <DashPage>
      <DashHeader eyebrow="Study" title={PLANNER_COPY.pageTitle} description="Month, week, and day. Classes, assignments, exams, attendance, and your goals." />
      <CalendarBoard />
    </DashPage>
  );
}
