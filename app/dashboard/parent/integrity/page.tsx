'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getChildrenProfiles } from '@/lib/db';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { listConcernFlags, listIntegrityCases } from '@/lib/insights/client';

interface Row { id: string; title: string; detail: string; kind: string }

export default function ParentIntegrityPage() {
  const { user } = useAuthSTORE();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!user) return;
    getChildrenProfiles(user.uid).then(async children => {
      const lists = await Promise.all(children.map(async child => {
        const cases = await listIntegrityCases('studentId', child.id).catch(() => []);
        const flags = await listConcernFlags('studentId', child.id).catch(() => []);
        const name = child.data.name || 'Your child';
        const caseRows: Row[] = cases.map(item => ({
          id: item.id,
          kind: 'integrity',
          title: `${name} · ${String(item.assignmentTitle ?? 'Review')}`,
          detail: `${String(item.studentSummary ?? 'A teacher will review this.')} Decision: ${String(item.decision ?? 'pending')}. Nothing is marked down automatically.`,
        }));
        const flagRows: Row[] = flags.map(item => ({
          id: item.id,
          kind: String(item.kind ?? 'concern'),
          title: `${name} · ${String(item.title ?? 'Flag')}`,
          detail: String(item.detail ?? ''),
        }));
        return caseRows.concat(flagRows);
      }));
      setRows(lists.flat());
    }).catch(() => setRows([]));
  }, [user]);

  return (
    <DashPage>
      <DashHeader
        eyebrow="Family"
        title="Flags inbox"
        description="Integrity checks and other concerns land here for each child. A flag asks for a person. It does not change a mark. Push waits during quiet hours."
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border p-4" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-tile-ink) 16%, var(--card)), var(--card))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ps-tile-ink)' }}>Integrity</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{rows.filter(row => row.kind === 'integrity').length}</p>
        </div>
        <div className="rounded-2xl border border-border p-4" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--ps-cyan-text) 16%, var(--card)), var(--card))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ps-cyan-text)' }}>Other flags</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{rows.filter(row => row.kind !== 'integrity').length}</p>
        </div>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No flags for your children.</p>}
      {rows.map(row => (
        <Panel key={`${row.kind}-${row.id}`}>
          <p className="font-semibold">{row.title}</p>
          <p className="text-sm mt-1">{row.detail}</p>
        </Panel>
      ))}
    </DashPage>
  );
}
