'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ReviewScreen } from '@/components/course-review/review-screen';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  addLessonComment,
  createCoursePreviewLink,
  listLessonComments,
  publishLessonStatus,
  saveCourseReview,
} from '@/lib/course-review-store';
import { type LessonComment, type PreviewCourse, type PublishedSnapshot, type ReviewStatus } from '@/lib/course-review';
import { previewCourseFromUnits } from '@/lib/course-preview-map';
import { getCourse, getModulesWithLessons } from '@/lib/db';

export default function CoursePreviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuthSTORE();
  const [course, setCourse] = useState<PreviewCourse | null>(null);
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(null);
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!courseId) return;
    Promise.all([
      getCourse(courseId),
      getModulesWithLessons(courseId),
      listLessonComments(courseId).catch(() => [] as LessonComment[]),
    ]).then(([loaded, units, notes]) => {
      if (!loaded) {
        setError('That course was not found.');
        return;
      }
      setCourse(previewCourseFromUnits(loaded, units));
      setSnapshot(loaded.publishedSnapshot ?? null);
      setComments(notes);
    }).catch(err => setError(err instanceof Error ? err.message : 'Could not open the preview.'));
  }, [courseId]);

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!course) return <div className="h-72 animate-pulse rounded-3xl bg-muted" />;

  return (
    <div className="space-y-4 pb-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/dashboard/admin/curriculum" className="font-semibold text-[#1E6A83]">Course CMS</Link>
        <span> / </span>
        <Link href={`/dashboard/admin/curriculum/${courseId}`} className="font-semibold text-[#1E6A83]">Content Builder</Link>
        <span> / Preview course</span>
      </p>
      <ReviewScreen
        initial={course}
        snapshot={snapshot}
        comments={comments}
        actorName={profile?.name || 'Teacher'}
        onStatus={async (status: ReviewStatus, next, nextSnapshot) => {
          await saveCourseReview(courseId, status, nextSnapshot ?? undefined);
          if (status === 'published') {
            await publishLessonStatus(courseId, next.modules.flatMap(module => module.lessons.map(lesson => ({
              id: lesson.id,
              moduleId: lesson.moduleId,
              status: lesson.status,
            }))));
          }
        }}
        onComment={async comment => {
          if (!user) return;
          await addLessonComment(courseId, { ...comment, authorId: user.uid, authorName: profile?.name || comment.authorName });
        }}
        onShare={async preview => {
          if (!user) return null;
          const link = await createCoursePreviewLink({ courseId, createdBy: user.uid, course: preview });
          return `${window.location.origin}/preview/course/${link.token}`;
        }}
      />
    </div>
  );
}
