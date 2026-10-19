'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EtCanvas } from '@/components/studio/et-canvas';
import { StudioTimetableScreen } from '@/components/timetable/studio';
import type { TimetableActor } from '@/lib/timetable/access';

const ACTORS: Record<string, TimetableActor> = {
  school: { uid: 'inst-1', role: 'institution_admin', permissions: ['addon:et_ai_timetabler'], plan: 'enterprise', institutionId: 'school-a' },
  personal: { uid: 't-adeyemi', role: 'teacher', permissions: ['addon:et_ai_timetabler'], plan: 'teacher' },
  upsell: { uid: 't-adeyemi', role: 'teacher', institutionId: 'school-a' },
  student: { uid: 's-noor', role: 'student', institutionId: 'school-a' },
};

function PreviewBody() {
  const params = useSearchParams();
  const gate = params.get('gate') || 'school';
  const view = params.get('view') || 'chat';
  const actor = ACTORS[gate] ?? ACTORS.school!;
  const editorHref = `/preview/studio?view=editor&gate=${encodeURIComponent(gate)}`;
  if (view === 'editor') return <StudioTimetableScreen actor={actor} />;
  return <EtCanvas name="Ada" actor={actor} editorHref={editorHref} />;
}

export default function StudioPreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewBody />
    </Suspense>
  );
}
