'use client';

import { useEffect, useState } from 'react';
import { getSparkTransactions, type SparkTransaction, type UserProfile } from '@/lib/db';
import {
  STAFF_LABELS,
  STAFF_ROLES,
  can,
  resolveStaffRole,
  type StaffRole,
} from '@/lib/admin-console';
import {
  adjustSparks,
  changeAccess,
  changeAccountState,
  changeStaffRole,
  resetStaffPassword,
  revokeStaffSessions,
  type ConsoleProfile,
} from '@/lib/admin-actions';
import { writeViewAs } from '@/lib/view-as';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface Row { id: string; data: UserProfile }

const STATUSES = ['active', 'suspended', 'banned', 'deleted'] as const;

export function AdminAccountPanel({
  row,
  actorId,
  actorEmail,
  actor,
  directory,
  onClose,
  onUpdated,
}: {
  row: Row;
  actorId: string;
  actorEmail: string;
  actor: StaffRole | null;
  directory: ConsoleProfile[];
  onClose: () => void;
  onUpdated: (patch: Partial<UserProfile>) => void;
}) {
  const staff = resolveStaffRole({ ...row.data, id: row.id });
  const [reason, setReason] = useState(row.data.statusReason ?? '');
  const [nextRole, setNextRole] = useState<string>(staff ?? '');
  const [amount, setAmount] = useState('25');
  const [tier, setTier] = useState(String(row.data.accessTier ?? ''));
  const [permission, setPermission] = useState('addon:cms');
  const [activity, setActivity] = useState<SparkTransaction[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSparkTransactions(row.id, 8).then(setActivity).catch(() => setActivity([]));
  }, [row.id]);

  const target: ConsoleProfile = {
    id: row.id,
    email: row.data.email,
    role: row.data.role,
    adminRole: row.data.adminRole ?? '',
    accountStatus: row.data.accountStatus ?? 'active',
  };
  const base = { actorId, actorEmail, actor, directory, target };

  const run = async (work: () => Promise<{ auditFailed?: boolean; note?: string; resetLink?: string }>, patch?: Partial<UserProfile>) => {
    setBusy(true);
    try {
      const result = await work();
      if (patch) onUpdated(patch);
      if (result.note) toast.message(result.note);
      else if (result.auditFailed) toast.warning('Saved. The audit log did not record it.');
      else toast.success('Saved.');
      if (result.resetLink) toast.message('Password reset link ready', { description: result.resetLink });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not complete that action.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex justify-end" onClick={onClose}>
      <aside className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto p-5 space-y-5" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">Profile</p>
            <h2 className="text-2xl font-semibold">{row.data.name}</h2>
            <p className="text-sm text-muted-foreground">{row.data.email}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile" className="w-9 h-9 grid place-items-center rounded-xl hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Role</dt><dd className="font-semibold">{row.data.role}</dd></div>
          <div><dt className="text-muted-foreground">Staff</dt><dd className="font-semibold">{staff ? STAFF_LABELS[staff] : '—'}</dd></div>
          <div><dt className="text-muted-foreground">Status</dt><dd className="font-semibold capitalize">{row.data.accountStatus ?? 'active'}</dd></div>
          <div><dt className="text-muted-foreground">Tier</dt><dd className="font-semibold">{row.data.accessTier ?? '—'} · {row.data.subscriptionTier ?? 'free'}</dd></div>
          <div><dt className="text-muted-foreground">Institution</dt><dd className="font-semibold truncate">{row.data.institutionId || '—'}</dd></div>
          <div><dt className="text-muted-foreground">Country</dt><dd className="font-semibold">{row.data.country || '—'}</dd></div>
          <div><dt className="text-muted-foreground">Sparks</dt><dd className="font-semibold">{(row.data.sparksBalance ?? 0).toLocaleString()}</dd></div>
          <div><dt className="text-muted-foreground">Study days</dt><dd className="font-semibold">{row.data.studyDates?.length ?? 0}</dd></div>
        </dl>

        <label className="block text-sm font-semibold">
          Reason
          <Input value={reason} onChange={event => setReason(event.target.value)} className="mt-1 h-10 rounded-xl" placeholder="Why this change is being made" />
        </label>

        {can(actor, 'set_role') && (
          <div className="flex gap-2">
            <select aria-label="Staff role" value={nextRole} onChange={event => setNextRole(event.target.value)}
              className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm">
              <option value="">Clear staff role</option>
              {STAFF_ROLES.map(role => <option key={role} value={role}>{STAFF_LABELS[role]}</option>)}
            </select>
            <Button disabled={busy} className="rounded-xl" onClick={() => run(
              () => changeStaffRole({ ...base, next: (nextRole || null) as StaffRole | null }),
              { adminRole: (nextRole || undefined) as UserProfile['adminRole'], role: nextRole ? 'admin' : (row.data.role === 'admin' ? 'teacher' : row.data.role) },
            )}>Save role</Button>
          </div>
        )}

        {can(actor, 'moderate') && (
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(status => (
              <Button key={status} variant="outline" disabled={busy} className="rounded-full capitalize"
                onClick={() => run(
                  () => changeAccountState({ ...base, next: status, reason }),
                  { accountStatus: status, statusReason: reason.trim() },
                )}>
                {status === 'active' ? 'Restore' : status}
              </Button>
            ))}
          </div>
        )}

        {can(actor, 'sparks') && (
          <div className="flex gap-2">
            <Input aria-label="Sparks amount" value={amount} onChange={event => setAmount(event.target.value)} className="h-10 rounded-xl" />
            <Button disabled={busy} className="rounded-xl" onClick={() => {
              const value = Number(amount);
              run(
                () => adjustSparks({ ...base, amount: value, balance: row.data.sparksBalance ?? 0, reason }),
                { sparksBalance: (row.data.sparksBalance ?? 0) + value },
              );
            }}>Adjust Sparks</Button>
          </div>
        )}

        {can(actor, 'tier') && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input aria-label="Access tier" value={tier} onChange={event => setTier(event.target.value)} placeholder="Tier 0–6" className="h-10 rounded-xl" />
              <Button variant="outline" disabled={busy} className="rounded-xl" onClick={() => run(
                () => changeAccess({ ...base, tier: Number(tier), reason }),
                { accessTier: Number(tier) },
              )}>Set tier</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} className="rounded-xl" onClick={() => run(
                () => changeAccess({ ...base, subscription: 'academic', reason }),
                { subscriptionTier: 'academic' },
              )}>Grant academic</Button>
              <Button variant="outline" disabled={busy} className="rounded-xl" onClick={() => run(
                () => changeAccess({ ...base, subscription: 'free', reason }),
                { subscriptionTier: 'free' },
              )}>Revoke academic</Button>
            </div>
            <div className="flex gap-2">
              <Input aria-label="Product permission" value={permission} onChange={event => setPermission(event.target.value)} className="h-10 rounded-xl" />
              <Button variant="outline" disabled={busy} className="rounded-xl" onClick={() => run(
                () => changeAccess({ ...base, permission: permission.trim(), mode: 'grant', reason }),
              )}>Grant</Button>
              <Button variant="outline" disabled={busy} className="rounded-xl" onClick={() => run(
                () => changeAccess({ ...base, permission: permission.trim(), mode: 'revoke', reason }),
              )}>Revoke</Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {can(actor, 'sessions') && (
            <>
              <Button variant="outline" disabled={busy} className="rounded-xl" onClick={() => run(() => resetStaffPassword(base))}>
                Password reset
              </Button>
              <Button variant="outline" disabled={busy} className="rounded-xl" onClick={() => run(() => revokeStaffSessions({ ...base, reason }))}>
                Sign out sessions
              </Button>
            </>
          )}
          {can(actor, 'view_as') && (
            <Button variant="outline" className="rounded-xl" onClick={() => {
              writeViewAs({ id: row.id, name: row.data.name ?? 'User', email: row.data.email ?? '' });
              toast.success(`Viewing as ${row.data.name}. Actions are read-only.`);
              onClose();
            }}>View as</Button>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Recent Sparks activity</p>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Sparks ledger entries yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map(item => (
                <li key={item.id} className="flex justify-between gap-3 border-b border-border pb-2">
                  <span>{item.note || item.type}</span>
                  <span className="tabular-nums font-semibold">{item.amount > 0 ? '+' : ''}{item.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
