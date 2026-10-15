'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getCourse, getInstitutions, getModulesWithLessons, type Course, type Institution } from '@/lib/db';
import { TeacherCourseStudio, sectionsFromCourse } from '@/components/teacher-course-studio';
import type { StudioRole, StudioSection } from '@/lib/course-builder';

function studioRole(role: string | undefined): StudioRole {
  if (role === 'admin') return 'admin';
  if (role === 'institution_admin') return 'institution_admin';
  return 'teacher';
}

export default function EditCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, profile } = useAuthSTORE();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<StudioSection[]>([]);
  const [institutions, setInstitutions] = useState<Pick<Institution, 'id' | 'name'>[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !courseId) return;
    Promise.all([
      getCourse(courseId),
      getModulesWithLessons(courseId),
      getInstitutions().catch(() => [] as Institution[]),
    ]).then(([loaded, modules, schools]) => {
      if (!loaded) {
        setError('That course was not found.');
        return;
      }
      const role = studioRole(profile?.role);
      if (role !== 'admin' && loaded.ownerId !== user.uid) {
        setError('You can edit your own courses.');
        return;
      }
      setCourse(loaded);
      setSections(sectionsFromCourse(modules));
      setInstitutions(schools.map(school => ({ id: school.id, name: school.name })));
    }).catch(err => setError(err instanceof Error ? err.message : 'Could not open the course.'));
  }, [user, courseId, profile?.role]);

  if (!user) return null;
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!course) return <div className="h-72 animate-pulse rounded-3xl bg-muted" />;
  return (
    <TeacherCourseStudio
      ownerId={user.uid}
      ownerName={profile?.name || course.ownerName || 'Teacher'}
      role={studioRole(profile?.role)}
      courseId={course.id}
      initial={course}
      initialSections={sections}
      institutions={institutions}
    />
  );
}
