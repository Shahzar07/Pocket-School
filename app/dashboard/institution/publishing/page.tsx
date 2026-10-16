'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { AccessBadge } from '@/components/institutions/commerce-panels';
import { approveInstitutionCourse } from '@/lib/institution-membership-store';
import type { CourseAccessMode } from '@/lib/institution-commerce';

interface Row {
  id: string;
  title: string;
  libraryApproved: boolean;
  accessMode: CourseAccessMode;
}

export default function PublishingPage() {
  const { user, profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!institutionId) return;
    getDocs(query(collection(db, 'courses'), where('institutionId', '==', institutionId))).then((snap) => {
      setRows(snap.docs.map((item) => {
        const data = item.data() as { title?: string; libraryApproved?: boolean; accessMode?: string };
        const mode: CourseAccessMode = data.accessMode === 'a_la_carte' || data.accessMode === 'both' ? data.accessMode : 'subscription';
        return { id: item.id, title: data.title || 'Course', libraryApproved: data.libraryApproved === true, accessMode: mode };
      }));
    }).catch(() => toast.error('Could not load institution courses.'));
  }, [institutionId]);

  const decide = async (row: Row, approved: boolean) => {
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
      <div className="space-y-3">
        {rows.map((row) => (
          <Panel key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.libraryApproved ? 'In the library' : 'Waiting for you'}</p>
              </div>
              <AccessBadge mode={row.accessMode} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button className="rounded-full" onClick={() => void decide(row, true)}>Approve for the library</Button>
              <Button variant="outline" className="rounded-full" onClick={() => void decide(row, false)}>Return</Button>
            </div>
          </Panel>
        ))}
      </div>
    </DashPage>
  );
}
