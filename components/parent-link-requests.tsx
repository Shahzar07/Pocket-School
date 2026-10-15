'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { listParentLinkRequests, respondToParentLink } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LinkRow { id: string; parentName?: string; status?: string }

export function ParentLinkRequests() {
  const { user } = useAuthSTORE();
  const [rows, setRows] = useState<LinkRow[]>([]);

  const load = () => {
    if (!user) return;
    listParentLinkRequests('studentId', user.uid)
      .then((rows) => setRows(rows.filter((row) => row.status === 'pending')))
      .catch(() => setRows([]));
  };
  useEffect(load, [user]);

  if (!rows.length) return null;

  const respond = async (linkId: string, approve: boolean) => {
    if (!user) return;
    await respondToParentLink(linkId, user.uid, approve);
    toast.success(approve ? 'Linked. They can see your progress now.' : 'Request declined.');
    load();
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-semibold">A parent wants to follow your learning</p>
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span>{row.parentName || 'A parent'} asked to link to your account.</span>
          <Button size="sm" className="rounded-full" onClick={() => respond(row.id, true)}>Approve</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => respond(row.id, false)}>Decline</Button>
        </div>
      ))}
    </div>
  );
}
