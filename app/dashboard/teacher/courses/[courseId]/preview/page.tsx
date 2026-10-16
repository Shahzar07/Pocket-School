'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ReviewScreen } from '@/components/course-review/review-screen';
import { useAuthSTORE } from '@/hooks/use-auth';
import { previewCourseFromUnits } from '@/lib/course-preview-map';
import type { LessonComment, PreviewCourse, PublishedSnapshot } from '@/lib/course-review';
import { getCourse, getModulesWithLessons } from '@/lib/db';

export default function TeacherCoursePreviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuthSTORE();
  const [course, setCourse] = useState<PreviewCourse | null>(null);
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !courseId) return;
    Promise.all([getCourse(courseId), getModulesWithLessons(courseId)]).then(([loaded, units]) => {
      if (!loaded) {
        setError('That course was not found.');
        return;
      }
      if (profile?.role !== 'admin' && loaded.ownerId !== user.uid) {
        setError('You can preview your own courses.');
        return;
      }
      setCourse(previewCourseFromUnits(loaded, units));
      setSnapshot(loaded.publishedSnapshot ?? null);
    }).catch(err => setError(err instanceof Error ? err.message : 'Could not open the preview.'));
  }, [user, courseId, profile?.role]);

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!course) return <div className="h-72 animate-pulse rounded-3xl bg-muted" />;
  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-12">
      <Link href={`/dashboard/teacher/courses/${course.id}`} className="text-sm font-semibold text-primary underline">
        Back to the studio
      </Link>
      <ReviewScreen initial={course} snapshot={snapshot} comments={[] as LessonComment[]} actorName={profile?.name || 'Teacher'} />
    </div>
  );
}
