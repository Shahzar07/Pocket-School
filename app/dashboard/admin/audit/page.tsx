'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getAdminAudit, type AdminAuditRow } from '@/lib/db';
import { can, filterAudit, resolveStaffRole } from '@/lib/admin-console';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

export default function AdminAuditPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile);
  const allowed = can(staff, 'audit');
  const [rows, setRows] = useState<AdminAuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    getAdminAudit().then(setRows).catch(err => {
      setError(err instanceof Error ? err.message : 'Could not load the audit log.');
    }).finally(() => setLoading(false));
  }, [allowed]);

  const visible = useMemo(
    () => rows.filter(row => filterAudit([row], { actor, action, target }).length === 1),
    [rows, actor, action, target],
  );

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto pt-16 text-center">
        <Shield className="w-10 h-10 mx-auto text-violet-600 mb-3" />
        <h1 className="text-3xl font-semibold">Audit log</h1>
        <p className="text-muted-foreground mt-2">Super admins can read the audit log.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Super admin</p>
        <h1 className="text-4xl font-semibold mt-2">Audit log</h1>
        <p className="text-muted-foreground mt-2">Who changed what, with the values before and after.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Input value={actor} onChange={event => setActor(event.target.value)} placeholder="Actor" aria-label="Filter by actor" className="h-11 rounded-full max-w-xs" />
        <Input value={action} onChange={event => setAction(event.target.value)} placeholder="Action" aria-label="Filter by action" className="h-11 rounded-full max-w-xs" />
        <Input value={target} onChange={event => setTarget(event.target.value)} placeholder="Target" aria-label="Filter by target" className="h-11 rounded-full max-w-xs" />
      </div>
      {loading ? <div className="h-40 bg-muted animate-pulse rounded-3xl" /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && (
        <div className="bg-card border border-border rounded-3xl overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Before</th>
                <th className="px-4 py-3">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No audit entries match these filters.</td></tr>
              ) : visible.map(row => (
                <tr key={row.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{row.at ? new Date(row.at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">{row.actorEmail || row.actorId}</td>
                  <td className="px-4 py-3 font-semibold">{row.action}</td>
                  <td className="px-4 py-3">{row.targetId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{JSON.stringify(row.before)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{JSON.stringify(row.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
