'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel, PanelHeader } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface SchoolLead {
  key: string;
  name: string;
  country: string;
  state: string;
  count: number;
  alumniCount?: number;
  registeredInstitutionId?: string;
  approvedForLanding: boolean;
}

export default function SchoolLeadsPage() {
  const [leads, setLeads] = useState<SchoolLead[]>([]);
  const [minimum, setMinimum] = useState('3');
  const [keep, setKeep] = useState('');
  const [drop, setDrop] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await authedFetch('/api/admin/schools');
    const rows = Array.isArray(data.leads) ? data.leads as SchoolLead[] : [];
    setLeads(rows);
    if (typeof data.minimum === 'number') setMinimum(String(data.minimum));
  };

  useEffect(() => {
    load()
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not load school leads.'))
      .finally(() => setLoading(false));
  }, []);

  const saveMinimum = async () => {
    setBusy(true);
    try {
      const data = await authedFetch('/api/admin/schools', {
        method: 'POST',
        body: JSON.stringify({ action: 'minimum', minimum: Number(minimum) }),
      });
      if (typeof data.minimum === 'number') setMinimum(String(data.minimum));
      toast.success('Minimum student count saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the threshold.');
    } finally {
      setBusy(false);
    }
  };

  const approve = async (lead: SchoolLead, approved: boolean) => {
    setBusy(true);
    try {
      await authedFetch('/api/admin/schools', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', key: lead.key, approved }),
      });
      setLeads((rows) => rows.map((row) => row.key === lead.key ? { ...row, approvedForLanding: approved } : row));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update that school.');
    } finally {
      setBusy(false);
    }
  };

  const merge = async () => {
    setBusy(true);
    try {
      await authedFetch('/api/admin/schools', {
        method: 'POST',
        body: JSON.stringify({ action: 'merge', keep, drop }),
      });
      toast.success('Duplicate merged into the school you kept.');
      setDrop('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not merge those schools.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashPage>
      <DashHeader
        eyebrow="Super admin"
        title="School leads"
        accent="demand"
        description="Students who typed a school that is not a registered institution, and alumni who asked to join that name. They are not members. Approve a name for the homepage only when you want it public."
      />
      <Panel>
        <PanelHeader title="Homepage threshold" />
        <div className="flex flex-wrap items-end gap-3 p-5">
          <label className="text-sm font-medium text-[#1A3C34]">
            Minimum students
            <Input
              type="number"
              min={1}
              max={1000}
              value={minimum}
              onChange={(event) => setMinimum(event.target.value)}
              className="mt-1 h-11 w-32 rounded-xl"
              aria-label="Minimum students before a school can appear"
            />
          </label>
          <Button type="button" disabled={busy} onClick={saveMinimum} className="rounded-full bg-[#1A3C34] text-[#F8E7C4]">
            Save threshold
          </Button>
          <p className="max-w-xl text-sm text-muted-foreground">
            An unregistered school appears on the homepage only when this count is met and its toggle is on. New names start off. A registered institution appears only when that academy admin opts in.
          </p>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Merge duplicates" />
        <div className="flex flex-wrap items-end gap-3 p-5">
          <label className="text-sm font-medium">
            Keep
            <select aria-label="School to keep" value={keep} onChange={(event) => setKeep(event.target.value)} className="mt-1 block h-11 rounded-xl border border-border bg-background px-3">
              <option value="">Choose</option>
              {leads.map((lead) => <option key={lead.key} value={lead.key}>{lead.name} · {lead.count}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">
            Merge into it
            <select aria-label="Duplicate school" value={drop} onChange={(event) => setDrop(event.target.value)} className="mt-1 block h-11 rounded-xl border border-border bg-background px-3">
              <option value="">Choose</option>
              {leads.filter((lead) => lead.key !== keep).map((lead) => <option key={lead.key} value={lead.key}>{lead.name} · {lead.count}</option>)}
            </select>
          </label>
          <Button type="button" variant="outline" disabled={busy || !keep || !drop} onClick={merge} className="rounded-full">
            Merge
          </Button>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title={loading ? 'Loading leads' : `${leads.length} unregistered schools`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">School</th>
                <th className="px-4 py-3 font-semibold">Country</th>
                <th className="px-4 py-3 font-semibold">State / region</th>
                <th className="px-4 py-3 font-semibold">Students</th>
                <th className="px-4 py-3 font-semibold">Homepage</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.key} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#1A3C34]">
                    {lead.name}
                    {lead.alumniCount ? <span className="mt-1 block text-xs font-medium text-muted-foreground">{lead.alumniCount} alumni asked to join</span> : null}
                    {lead.registeredInstitutionId ? <span className="mt-1 block text-xs font-medium text-muted-foreground">Now on Poket School</span> : null}
                  </td>
                  <td className="px-4 py-3">{lead.country || '—'}</td>
                  <td className="px-4 py-3">{lead.state || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{lead.count}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={lead.approvedForLanding}
                        disabled={busy}
                        aria-label={`Show ${lead.name} on the homepage`}
                        onChange={(event) => approve(lead, event.target.checked)}
                      />
                      <span>{lead.approvedForLanding ? 'On' : 'Off'}</span>
                    </label>
                  </td>
                </tr>
              ))}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-muted-foreground">No self-reported schools yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </DashPage>
  );
}
