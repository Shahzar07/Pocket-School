'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getChildrenProfiles } from '@/lib/db';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage } from '@/components/dash-ui';
import { AnalyticsBoard, ExportBar, snapshotKpis } from '@/components/insights/boards';
import { LearningCharts } from '@/components/insights/learning-charts';
import { createSuggestion } from '@/lib/insights/client';
import { toast } from 'sonner';
import { readSnapshot } from '@/lib/insights/client';
import type { AnalyticsSnapshot } from '@/lib/insights/aggregate';
import { Button } from '@/components/ui/button';

export default function ParentAnalyticsPage() {
  const { user, profile } = useAuthSTORE();
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [childId, setChildId] = useState('');
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);

  useEffect(() => {
    if (!user) return;
    getChildrenProfiles(user.uid).then(rows => {
      const list = rows.map(row => ({ id: row.id, name: row.data.name || 'Student' }));
      setChildren(list);
      setChildId(list[0]?.id ?? '');
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!childId) return;
    readSnapshot(childId).then(data => setSnapshot((data as AnalyticsSnapshot) ?? null)).catch(() => setSnapshot(null));
  }, [childId]);

  const name = useMemo(() => children.find(c => c.id === childId)?.name, [children, childId]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Your child"
        title="Insights for"
        accent={name}
        description="The same totals your child sees: study, quizzes, mastery, goals, and Sparks."
        actions={<Button variant="outline" onClick={async () => {
          if (!childId) return;
          try {
            const res = await authedFetch('/api/insights/refresh-snapshot', { method: 'POST', body: JSON.stringify({ studentId: childId }) });
            if (res.snapshot) setSnapshot(res.snapshot as AnalyticsSnapshot);
          } catch { /* the scheduled job will fill this in */ }
        }}>Refresh</Button>}
      />
      <div className="flex gap-2">
        {children.map(child => (
          <Button key={child.id} variant={child.id === childId ? 'default' : 'outline'} onClick={() => setChildId(child.id)}>{child.name}</Button>
        ))}
      </div>
      {snapshot ? (
        <>
          <ExportBar kpis={snapshotKpis(snapshot)} />
          <LearningCharts
            snapshot={snapshot}
            onMakeGoal={async (title) => {
              if (!user || !childId) return;
              await createSuggestion({ studentId: childId, parentId: user.uid, title, parentName: profile?.name });
              toast.success('Suggested. Your child can accept it as a goal.');
            }}
          />
          <AnalyticsBoard snapshot={snapshot} />
        </>
      ) : <p className="text-sm text-muted-foreground">No saved totals yet. Refresh, or wait for the nightly job after a day with goals.</p>}
    </DashPage>
  );
}
