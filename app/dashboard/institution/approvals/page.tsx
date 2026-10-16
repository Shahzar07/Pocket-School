'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { decideJoinRequest, listJoinRequests, type StoredJoinRequest } from '@/lib/institution-membership-store';
import { VOLUME_PLANS, type VolumePlanId } from '@/lib/institution-pricing';

export default function ApprovalsPage() {
  const { user, profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [rows, setRows] = useState<StoredJoinRequest[]>([]);
  const [levels, setLevels] = useState<Record<string, VolumePlanId | ''>>({});

  useEffect(() => {
    if (!institutionId) return;
    listJoinRequests(institutionId).then(setRows).catch(() => toast.error('Could not load join requests.'));
  }, [institutionId]);

  const decide = async (row: StoredJoinRequest, decision: 'approved' | 'rejected') => {
    if (!user) return;
    try {
      await decideJoinRequest({
        institutionId,
        request: row,
        decision,
        level: levels[row.id] || row.level || 'igcse_alevel',
        classIds: row.classIds,
        courseIds: row.courseIds,
        actorId: user.uid,
      });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: decision } : item));
      toast.success(decision === 'approved' ? 'Approved. Poket School does not charge this person for the seat.' : 'Request declined.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the decision.');
    }
  };

  return (
    <DashPage className="max-w-3xl">
      <DashHeader eyebrow="Institution" title="Approvals" description="Pending students, parents, and teachers. Assign a level when you approve a student." />
      {!institutionId && <Panel><p className="text-sm text-muted-foreground">This account is not attached to an institution yet.</p></Panel>}
      {rows.length === 0 && institutionId && <Panel><p className="text-sm text-muted-foreground">No join requests.</p></Panel>}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
          <Panel>
            <p className="font-semibold">{row.name}</p>
            <p className="text-sm text-muted-foreground">{row.email} · {row.role} · {row.status}</p>
            {row.role === 'student' && row.status === 'pending' && (
              <label className="mt-3 block text-sm">Level
                <select
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3"
                  value={levels[row.id] || 'igcse_alevel'}
                  onChange={(event) => setLevels({ ...levels, [row.id]: event.target.value as VolumePlanId })}
                  aria-label={`Level for ${row.name}`}
                >
                  {VOLUME_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                </select>
              </label>
            )}
            {row.status === 'pending' && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button className="h-11 rounded-full" onClick={() => void decide(row, 'approved')}>Approve</Button>
                <Button variant="outline" className="h-11 rounded-full" onClick={() => void decide(row, 'rejected')}>Reject</Button>
              </div>
            )}
          </Panel>
          </li>
        ))}
      </ul>
    </DashPage>
  );
}
