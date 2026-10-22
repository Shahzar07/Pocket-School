'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FlowNav } from '@/components/flow/flow-nav';
import { FlowTrail } from '@/components/flow/flow-trail';
import { useFlowKeys } from '@/components/flow/use-flow-keys';
import { flowCopy } from '@/lib/flow/copy';

export function LessonFlow({
  courseId,
  lessonId,
  lessons,
}: {
  courseId: string;
  lessonId: string;
  lessons: readonly { id: string; title: string }[];
}) {
  const router = useRouter();
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  const hrefFor = useCallback(
    (id: string) => `/dashboard/student/courses/${courseId}/lessons/${id}`,
    [courseId],
  );
  const go = useCallback((nextIndex: number) => {
    const lesson = lessons[nextIndex];
    if (!lesson || lessons.length < 2 || index < 0) return;
    router.push(hrefFor(lesson.id));
  }, [hrefFor, index, lessons, router]);
  useFlowKeys(index < 0 ? 0 : index, lessons.length, go, lessons.length >= 2 && index >= 0, true);
  if (lessons.length < 2 || index < 0) return null;
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;
  return (
    <div className="mb-4 space-y-2" data-lesson-flow="1">
      <FlowTrail
        steps={lessons.map((lesson) => ({ id: lesson.id, label: lesson.title }))}
        currentId={lessonId}
        hrefFor={hrefFor}
        allowAhead
      />
      <FlowNav
        backHref={previous ? hrefFor(previous.id) : `/dashboard/student/courses/${courseId}`}
        nextHref={next ? hrefFor(next.id) : undefined}
        nextDisabled={!next}
        backLabel={previous ? flowCopy.back : flowCopy.course}
      />
    </div>
  );
}
