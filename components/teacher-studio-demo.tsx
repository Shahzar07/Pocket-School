'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TeacherCourseStudio } from '@/components/teacher-course-studio';
import type { AllocationTarget, StudioStep } from '@/lib/course-builder';

function Demo() {
  const params = useSearchParams();
  const step = params.get('step');
  const alloc = params.get('alloc');
  const studioStep: StudioStep = step === 'curriculum' || step === 'pricing' || step === 'allocation' ? step : 'basics';
  const target: AllocationTarget | undefined = alloc === 'marketplace'
    ? 'marketplace'
    : alloc === 'student'
      ? 'students'
      : undefined;
  return (
    <TeacherCourseStudio
      demo
      sample
      ownerId="teacher-demo"
      ownerName="Teacher"
      role="teacher"
      institutions={[{ id: 'inst_demo', name: 'Poket Academy' }]}
      initialStep={target ? 'allocation' : studioStep}
      initialPreview={params.get('preview') === '1'}
      initialTarget={target}
    />
  );
}

export function TeacherStudioDemo() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the course studio…</p>}>
        <Demo />
      </Suspense>
    </main>
  );
}
