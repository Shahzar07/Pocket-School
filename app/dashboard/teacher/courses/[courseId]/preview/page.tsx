'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getCourse, getModulesWithLessons, type Course } from '@/lib/db';
import { sectionsFromCourse } from '@/components/teacher-course-studio';
import { CourseStudentPreview } from '@/components/course-student-preview';
import { usePricing } from '@/hooks/use-pricing';
import type { StudioSection } from '@/lib/course-builder';

export default function CoursePreviewPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuthSTORE();
  const { courseLabel } = usePricing();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<StudioSection[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !courseId) return;
    Promise.all([getCourse(courseId), getModulesWithLessons(courseId)]).then(([loaded, modules]) => {
      if (!loaded) {
        setError('That course was not found.');
        return;
      }
      if (profile?.role !== 'admin' && loaded.ownerId !== user.uid) {
        setError('You can preview your own courses.');
        return;
      }
      setCourse(loaded);
      setSections(sectionsFromCourse(modules));
    }).catch(err => setError(err instanceof Error ? err.message : 'Could not open the preview.'));
  }, [user, courseId, profile?.role]);

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!course) return <div className="h-72 animate-pulse rounded-3xl bg-muted" />;
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <Link href={`/dashboard/teacher/courses/${course.id}`} className="text-sm font-semibold text-primary underline">
        Back to the studio
      </Link>
      <CourseStudentPreview
        title={course.title}
        subtitle={course.subtitle}
        description={course.description}
        category={course.category}
        level={course.level}
        language={course.language}
        thumbnailUrl={course.thumbnailUrl}
        previewUrl={course.previewUrl}
        priceLabel={courseLabel(course.price, course.currency || 'USD')}
        sections={sections}
      />
    </div>
  );
}
