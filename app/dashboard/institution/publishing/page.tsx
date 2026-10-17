'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { AccessBadge } from '@/components/institutions/commerce-panels';
import { approveInstitutionCourse, listInstitutionCourses, type InstitutionCourseRow } from '@/lib/institution-membership-store';

export default function PublishingPage() {
  const { user, profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [rows, setRows] = useState<InstitutionCourseRow[]>([]);

  useEffect(() => {
    if (!institutionId) return;
    listInstitutionCourses(institutionId).then(setRows).catch(() => toast.error('Could not load institution courses.'));
  }, [institutionId]);

  const decide = async (row: InstitutionCourseRow, approved: boolean) => {
    if (!user) return;
    try {
      await approveInstitutionCourse(row.id, user.uid, approved);
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, libraryApproved: approved } : item));
      toast.success(approved ? 'In the institution library. The public marketplace still needs Poket School.' : 'Returned to the teacher.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the course.');
    }
  };

  return (
    <DashPage className="max-w-3xl">
      <DashHeader eyebrow="Institution" title="Course library" description="Teachers can create a course. It appears here after you approve it. Listing on the Poket School marketplace needs a super admin." />
      {rows.length === 0 && <Panel><p className="text-sm text-muted-foreground">No institution courses yet.</p></Panel>}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
          <Panel>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
              <div className="min-w-0">
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.libraryApproved ? 'In the library' : 'Waiting for you'}</p>
              </div>
              <AccessBadge mode={row.accessMode} />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 rounded-full" onClick={() => void decide(row, true)}>Approve for the library</Button>
              <Button variant="outline" className="h-11 rounded-full" onClick={() => void decide(row, false)}>Return</Button>
            </div>
          </Panel>
          </li>
        ))}
      </ul>
    </DashPage>
  );
}
