'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { AccessBadge } from '@/components/institutions/commerce-panels';
import { approveInstitutionCourse, listInstitutionCourses, type InstitutionCourseRow } from '@/lib/institution-membership-store';
import { institutionLibraryIncludes, normalizeCatalogue, seedInstitutionCatalogue, type InstitutionCatalogue } from '@/lib/institution-catalogue';
import { authedFetch } from '@/lib/api-client';

export default function PublishingPage() {
  const { user, profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [rows, setRows] = useState<InstitutionCourseRow[]>([]);
  const [paidIds, setPaidIds] = useState<string[] | null>(null);
  const [catalogue, setCatalogue] = useState<InstitutionCatalogue>(seedInstitutionCatalogue());

  useEffect(() => {
    if (!institutionId) return;
    listInstitutionCourses(institutionId).then(setRows).catch(() => toast.error('Could not load institution courses.'));
    authedFetch(`/api/institutions/programme-access?institutionId=${institutionId}`)
      .then((data) => {
        const ids = Array.isArray(data.programmeIds) ? data.programmeIds.filter((id): id is string => typeof id === 'string') : [];
        setPaidIds(ids);
      })
      .catch(() => setPaidIds(null));
    fetch('/api/institutions/catalogue')
      .then((res) => res.json())
      .then((data: { catalogue?: unknown }) => {
        if (data.catalogue) setCatalogue(normalizeCatalogue(data.catalogue));
      })
      .catch(() => undefined);
  }, [institutionId]);

  const visible = paidIds && paidIds.length
    ? rows.filter((row) => institutionLibraryIncludes(catalogue, paidIds, row))
    : rows;

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
      <DashHeader eyebrow="Institution" title="Course library" description="A teacher course that passes the content check goes into this library on its own. This page is the override when that rule is off, or when you want to return a course. The public marketplace still needs a super admin unless that rule is turned on." />
      {visible.length === 0 && <Panel><p className="text-sm text-muted-foreground">No institution courses yet for the programmes this academy has selected.</p></Panel>}
      <ul className="space-y-3">
        {visible.map((row) => (
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
