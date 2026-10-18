'use client';

import { AssignmentsDesk } from './assignments';
import { AttendanceDesk } from './attendance';
import { ClassDesk } from './classes';
import { EarningsDesk } from './earnings';
import { FlowDesk } from './flow-desk';
import { GoalsDesk } from './goals';
import { GradebookDesk } from './gradebook';
import { ReportCardDesk, StudioDesk } from './reports';

export function TeacherDeskPreview({ view }: { view: string }) {
  if (view === 'assignments') return <AssignmentsDesk base="preview" />;
  if (view === 'report') return <ReportCardDesk base="preview" />;
  if (view === 'studio') return <StudioDesk base="preview" />;
  if (view === 'attendance') return <AttendanceDesk base="preview" />;
  if (view === 'classes') return <ClassDesk base="preview" role="teacher" />;
  if (view === 'institution') return <ClassDesk base="preview" role="institution_admin" />;
  if (view === 'goals') return <GoalsDesk base="preview" />;
  if (view === 'earnings') return <EarningsDesk />;
  if (view === 'exams') return <FlowDesk flow="exam" />;
  if (view === 'live') return <FlowDesk flow="live" />;
  if (view === 'community') return <FlowDesk flow="community" />;
  return <GradebookDesk base="preview" />;
}
