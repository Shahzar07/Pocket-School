'use client';

import { useEffect, useState } from 'react';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { actionLabel, type ActivityEvent } from '@/lib/audit/model';

type Row = ActivityEvent & { id: string };

export default function InstitutionActivityPage() {
  const { profile } = useAuthSTORE();
  const institutionId = profile?.institutionId ?? '';
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!institutionId) {
      setLoading(false);
      return;
    }
    let live = true;
    authedFetch(`/api/audit?scope=institution&institutionId=${encodeURIComponent(institutionId)}`)
      .then((data) => {
        if (!live) return;
        setRows(Array.isArray(data.events) ? data.events as Row[] : []);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Could not load the activity log.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, [institutionId]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="School"
        title="Activity log"
        description="Sign-ins and settings changes for this institution."
      />
      <Panel>
        {!institutionId && <p className="text-sm text-muted-foreground">This account is not attached to an institution.</p>}
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-[var(--ps-tile-ink)]">{error}</p>}
        {!loading && institutionId && rows.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">Nothing has been recorded for this institution yet.</p>
        )}
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <p className="font-medium">{actionLabel(row.action)}</p>
              <p className="text-muted-foreground">
                {row.actorEmail || row.actorId} · {row.targetLabel || row.targetId} · {new Date(row.at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </DashPage>
  );
}
