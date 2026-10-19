'use client';

import { DashHeader, DashPage } from '@/components/dash-ui';
import { CalendarBoard } from '@/components/planner/calendar-board';
import { PLANNER_COPY } from '@/lib/planner/copy';

export default function TeacherPlannerPage() {
  return (
    <DashPage>
      <DashHeader eyebrow="Teaching" title={PLANNER_COPY.pageTitle} description="Month, week, and day. Assignments, exams, attendance, and goals from your classes appear here." />
      <CalendarBoard />
    </DashPage>
  );
}