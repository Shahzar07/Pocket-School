'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getInstitutions, type Institution } from '@/lib/db';
import { TeacherCourseStudio } from '@/components/teacher-course-studio';
import type { StudioRole } from '@/lib/course-builder';

function studioRole(role: string | undefined): StudioRole {
  if (role === 'admin') return 'admin';
  if (role === 'institution_admin') return 'institution_admin';
  return 'teacher';
}

export default function BuildCoursePage() {
  const { user, profile } = useAuthSTORE();
  const [institutions, setInstitutions] = useState<Pick<Institution, 'id' | 'name'>[]>([]);

  useEffect(() => {
    getInstitutions().then(rows => setInstitutions(rows.map(row => ({ id: row.id, name: row.name })))).catch(() => setInstitutions([]));
  }, []);

  if (!user) return null;
  return (
    <TeacherCourseStudio
      ownerId={user.uid}
      ownerName={profile?.name || user.email || 'Teacher'}
      role={studioRole(profile?.role)}
      institutions={institutions}
    />
  );
}
