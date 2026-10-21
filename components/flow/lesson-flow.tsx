'use client';

import { FlowNav } from '@/components/flow/flow-nav';
import { FlowTrail } from '@/components/flow/flow-trail';
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
  if (lessons.length < 2) return null;
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return null;
  const hrefFor = (id: string) => `/dashboard/student/courses/${courseId}/lessons/${id}`;
  const previous = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;
  return (
    <div className="mb-4 space-y-2">
      <FlowTrail
        steps={lessons.map((lesson) => ({ id: lesson.id, label: lesson.title }))}
        currentId={lessonId}
        hrefFor={hrefFor}
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
