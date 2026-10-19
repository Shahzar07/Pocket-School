'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { TimetableDesk } from '@/components/timetable/desk';
import type { TimetableActor } from '@/lib/timetable/access';

const ACTORS: Record<string, { surface: 'institution' | 'personal' | 'teacher' | 'student' | 'parent'; actor: TimetableActor }> = {
  institution: {
    surface: 'institution',
    actor: { uid: 'inst-1', role: 'institution_admin', permissions: ['addon:et_ai_timetabler'], plan: 'enterprise', institutionId: 'school-a' },
  },
  personal: {
    surface: 'personal',
    actor: { uid: 't-adeyemi', role: 'teacher', permissions: ['addon:et_ai_timetabler'], plan: 'teacher' },
  },
  teacher: {
    surface: 'teacher',
    actor: { uid: 't-adeyemi', role: 'teacher', institutionId: 'school-a' },
  },
  student: {
    surface: 'student',
    actor: { uid: 's-noor', role: 'student', institutionId: 'school-a' },
  },
  parent: {
    surface: 'parent',
    actor: { uid: 'parent-noor', role: 'parent', childIds: ['s-noor'] },
  },
};

function PreviewBody() {
  const params = useSearchParams();
  const key = params.get('surface') || 'institution';
  const chosen = ACTORS[key] ?? ACTORS.institution!;
  return <TimetableDesk surface={chosen.surface} actor={chosen.actor} />;
}

export default function TimetablePreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewBody />
    </Suspense>
  );
}
