'use client';

import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { useAuthSTORE } from '@/hooks/use-auth';
import { FeatureGate } from '@/components/scope-c/feature-gate';
import { DashHeader, DashPage, Panel, PanelHeader } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ParentControlsPage() {
  const { profile } = useAuthSTORE();
  const childId = profile?.childIds?.[0] ?? '';
  const [studentId, setStudentId] = useState(childId);
  const [communityEnabled, setCommunity] = useState(true);
  const [messagingEnabled, setMessaging] = useState(true);
  const [snapEnabled, setSnap] = useState(true);
  const [quietStart, setQuietStart] = useState('21:00');
  const [quietEnd, setQuietEnd] = useState('07:00');

  useEffect(() => {
    if (!studentId) return;
    authedFetch(`/api/community/parent-controls?studentId=${studentId}`).then((data) => {
      setCommunity(data.communityEnabled !== false);
      setMessaging(data.messagingEnabled !== false);
      setSnap(data.snapEnabled !== false);
      if (typeof data.quietStart === 'string') setQuietStart(data.quietStart);
      if (typeof data.quietEnd === 'string') setQuietEnd(data.quietEnd);
    }).catch(() => {});
  }, [studentId]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    authedFetch('/api/community/parent-controls', {
      method: 'POST',
      body: JSON.stringify({ studentId, communityEnabled, messagingEnabled, snapEnabled, quietStart, quietEnd, timeZone: 'Asia/Kuala_Lumpur' }),
    }).then(() => toast.success('Controls saved.'))
      .catch((error: Error) => toast.error(error.message));
  };

  return (
    <FeatureGate flag="community">
      <DashPage>
        <DashHeader eyebrow="Parent" title="Controls" accent="and quiet hours" description="Turn community, messaging, or snap off for a linked child. Explore stays closed for minors. Quiet hours hold channel messages until morning." />
        <Panel>
          <PanelHeader title="Linked child" />
          <form onSubmit={save} className="space-y-3 max-w-md">
            <Input value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label="Child id" placeholder="Child account id" className="rounded-xl" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={communityEnabled} onChange={(event) => setCommunity(event.target.checked)} /> Community</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={messagingEnabled} onChange={(event) => setMessaging(event.target.checked)} /> Messaging</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnap(event.target.checked)} /> Snap and solve</label>
            <div className="flex gap-2">
              <Input type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} aria-label="Quiet hours start" className="rounded-xl" />
              <Input type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} aria-label="Quiet hours end" className="rounded-xl" />
            </div>
            <Button type="submit" className="rounded-xl">Save</Button>
          </form>
        </Panel>
      </DashPage>
    </FeatureGate>
  );
}
