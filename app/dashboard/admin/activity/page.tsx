'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { can, resolveStaffRole } from '@/lib/admin-console';
import { authedFetch } from '@/lib/api-client';
import { actionLabel, DEFAULT_RETENTION_DAYS, type ActivityEvent } from '@/lib/audit/model';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Row = ActivityEvent & { id: string };

const CATEGORIES = ['all', 'auth', 'role', 'content', 'settings', 'admin', 'impersonation', 'certificate', 'retention'];

export default function ActivityLogPage() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile);
  const allowed = can(staff, 'audit');
  const [rows, setRows] = useState<Row[]>([]);
  const [retention, setRetention] = useState(DEFAULT_RETENTION_DAYS);
  const [days, setDays] = useState(String(DEFAULT_RETENTION_DAYS));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope: 'all', q, category, actor, action, target });
      const data = await authedFetch(`/api/audit?${params.toString()}`);
      const events = Array.isArray(data.events) ? data.events as Row[] : [];
      setRows(events);
      const nextDays = typeof data.retentionDays === 'number' ? data.retentionDays : DEFAULT_RETENTION_DAYS;
      setRetention(nextDays);
      setDays(String(nextDays));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the activity log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    void load();
    // The first load uses the empty filters. Search runs from the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const exportCsv = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const params = new URLSearchParams({ scope: 'all', format: 'csv', q, category, actor, action, target });
    const res = await fetch(`/api/audit?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      toast.error('Could not export the activity log.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'poket-school-activity.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveRetention = async () => {
    try {
      const data = await authedFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({ action: 'retention.set', days: Number(days) }),
      });
      const next = typeof data.days === 'number' ? data.days : retention;
      setRetention(next);
      setDays(String(next));
      toast.success(`Activity is kept for ${next} days.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save retention.');
    }
  };

  const purge = async () => {
    try {
      const data = await authedFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({ action: 'retention.purge' }),
      });
      toast.success(`Removed ${typeof data.removed === 'number' ? data.removed : 0} events older than the window.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not run retention.');
    }
  };

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto pt-16 text-center">
        <Shield className="w-10 h-10 mx-auto text-violet-600 mb-3" />
        <h1 className="text-3xl font-semibold">Activity log</h1>
        <p className="text-muted-foreground mt-2">Super admins can read the activity log.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Super admin</p>
        <h1 className="text-4xl font-semibold mt-2">Activity log</h1>
        <p className="text-muted-foreground mt-2">
          Sign-ins, role switches, content edits, publishes, deletes, admin actions, and view-as. The server writes every row. Clients cannot change or delete them.
        </p>
        <p className="text-sm mt-2">
          <Link href="/dashboard/admin/audit" className="underline">Older admin-action log</Link>
          {' · '}
          <Link href="/dashboard/admin/certificates" className="underline">Certificate template</Link>
        </p>
      </header>

      <section className="bg-card border border-border rounded-3xl p-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          Keep events for
          <Input
            aria-label="Retention days"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="mt-1 h-11 rounded-full w-32"
            inputMode="numeric"
          />
        </label>
        <Button type="button" className="rounded-full" onClick={() => void saveRetention()}>Save retention</Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => void purge()}>Delete events older than {retention} days</Button>
        <p className="text-xs text-muted-foreground basis-full">The shortest window is 90 days. A purge is itself written to the log.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search" aria-label="Search activity" className="h-11 rounded-full max-w-xs" />
        <Input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="Actor" aria-label="Filter by actor" className="h-11 rounded-full max-w-xs" />
        <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" aria-label="Filter by action" className="h-11 rounded-full max-w-xs" />
        <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Target" aria-label="Filter by target" className="h-11 rounded-full max-w-xs" />
        <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-full border border-border bg-background px-4 text-sm">
          {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Button type="button" className="rounded-full" onClick={() => void load()}>Apply</Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => void exportCsv()}>Export CSV</Button>
      </div>

      {loading ? <div className="h-40 bg-muted animate-pulse rounded-3xl" /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && (
        <div className="bg-card border border-border rounded-3xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">IP / device</th>
                <th className="px-4 py-3">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No activity matches these filters.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{row.at ? new Date(row.at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">{row.actorEmail || row.actorId}</td>
                  <td className="px-4 py-3">{row.actorRole}</td>
                  <td className="px-4 py-3 font-semibold">{actionLabel(row.action)}</td>
                  <td className="px-4 py-3">{row.targetType} · {row.targetLabel || row.targetId}</td>
                  <td className="px-4 py-3 text-xs">{row.ip || '—'}<br />{row.device || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs max-w-sm">{row.diff?.length ? JSON.stringify(row.diff) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
