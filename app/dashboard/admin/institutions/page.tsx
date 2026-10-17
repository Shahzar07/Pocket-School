'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { InstitutionDirectory } from '@/components/institutions/directory';
import { useAuthSTORE } from '@/hooks/use-auth';
import { isInstitutionAdmin, isSuperAdmin } from '@/lib/roles';
import type { DirectoryRow, LeadStatus } from '@/lib/enterprise';
import {
  createInstitutionBundle,
  listDemoLeads,
  loadDirectory,
  recordAudit,
  recordPlatformAudit,
  removeInstitution,
  setInstitutionStatus,
  updateDemoLead,
  type DemoLead,
} from '@/lib/institution-store';

export default function AdminInstitutions() {
  const router = useRouter();
  const { user, profile, loading } = useAuthSTORE();
  const superAdmin = isSuperAdmin(profile);
  const allowed = superAdmin || isInstitutionAdmin(profile);
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [leads, setLeads] = useState<DemoLead[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!profile || !allowed) {
      setReady(true);
      return;
    }
    if (!superAdmin && !profile.institutionId) {
      setRows([]);
      setLeads([]);
      setReady(true);
      return;
    }
    const directory = await loadDirectory(superAdmin ? null : profile.institutionId ?? null);
    setRows(directory);
    if (superAdmin) setLeads(await listDemoLeads().catch(() => []));
    setReady(true);
  }, [allowed, profile, superAdmin]);

  useEffect(() => {
    if (loading) return;
    reload().catch(() => {
      toast.error('Could not load institutions.');
      setReady(true);
    });
  }, [loading, reload]);

  const actor = () => ({
    actorId: user?.uid ?? '',
    actorName: profile?.name || user?.email || 'Admin',
  });

  if (loading || !ready) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 py-6">
        <div className="h-24 animate-pulse rounded-3xl bg-muted" />
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">This console is for academy administrators.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <InstitutionDirectory
        rows={rows}
        leads={superAdmin ? leads : []}
        superAdmin={superAdmin}
        busy={busy}
        onOpen={(id) => router.push(`/dashboard/admin/institutions/${id}`)}
        onExport={() => {
          if (!user) return;
          const event = { ...actor(), action: 'export-directory', target: 'institutions' };
          const write = superAdmin || !profile?.institutionId
            ? recordPlatformAudit(event)
            : recordAudit(profile.institutionId, event);
          void write.catch(() => undefined);
        }}
        onCreate={async ({ name, profile: next }) => {
          if (!user || !superAdmin) return;
          setBusy(true);
          try {
            const id = await createInstitutionBundle({ name, profile: next, adminId: user.uid });
            await recordAudit(id, { ...actor(), action: 'create-institution', target: id, detail: name });
            toast.success(`${name} created.`);
            await reload();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create that institution.');
          } finally {
            setBusy(false);
          }
        }}
        onBulk={async (ids, action) => {
          if (!superAdmin || !user) return;
          setBusy(true);
          try {
            for (const id of ids) {
              if (action === 'delete') await removeInstitution(id);
              else await setInstitutionStatus(id, action === 'suspend' ? 'suspended' : 'active');
              if (action === 'approve') {
                const token = await user.getIdToken();
                const res = await fetch('/api/institutions/approve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ institutionId: id }),
                });
                const payload = await res.json().catch(() => ({})) as { emailed?: boolean; error?: string };
                if (!res.ok || payload.emailed === false) {
                  toast.message(payload.error || 'Approved. The approval email was not sent from this server.');
                }
              }
              await recordAudit(id, { ...actor(), action, target: id }).catch(() => undefined);
            }
            toast.success(action === 'delete' ? 'Institutions deleted.' : action === 'approve' ? 'Institutions approved.' : 'Institutions updated.');
            await reload();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'That bulk action failed.');
          } finally {
            setBusy(false);
          }
        }}
        onLead={async (id, status: LeadStatus) => {
          if (!superAdmin || !user) return;
          setBusy(true);
          try {
            await updateDemoLead(id, status);
            await recordPlatformAudit({ ...actor(), action: 'move-lead', target: id, detail: status });
            setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not move that lead.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
