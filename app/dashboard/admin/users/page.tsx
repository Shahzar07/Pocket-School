'use client';

/**
 * Admin → Users. The directory of everyone who has signed up.
 *
 * Search, role/status/programme filters, sorting, pagination, bulk actions and
 * per-row controls, with the Sparks wallet attached to each person rather than
 * hidden behind a separate search.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getAllUsers, ensureAdminSparks, accountStatusOf,
  type UserProfile, type AccountStatus,
} from '@/lib/db';
import { ADMIN_SPARKS_GRANT } from '@/lib/sparks';
import { ROLE_LABELS, isSuperAdmin, type Role } from '@/lib/roles';
import {
  STAFF_LABELS, STAFF_ROLES, can, filterDirectory, resolveStaffRole,
  type DirectoryUser, type StaffRole,
} from '@/lib/admin-console';
import {
  adjustSparks, changeAccountState, inviteStaff, resetStaffPassword, revokeStaffSessions,
  type ConsoleProfile,
} from '@/lib/admin-actions';
import { writeViewAs, useViewAs } from '@/components/admin-session';
import { AdminAccountPanel } from '@/components/admin-account-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Loader2, Search, Sparkles, Users as UsersIcon, Download, Plus, Minus,
  MoreVertical, ShieldOff, ShieldCheck, KeyRound, ChevronLeft, ChevronRight, Info, Eye,
} from 'lucide-react';

interface Row { id: string; data: UserProfile }

const ROLE_FILTERS: (Role | 'all')[] = ['all', 'student', 'teacher', 'parent', 'institution_admin', 'admin'];
const STATUS_FILTERS: (AccountStatus | 'all')[] = ['all', 'active', 'suspended', 'pending', 'inactive', 'banned', 'deleted'];

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  institution_admin: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  teacher: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  student: 'bg-success/10 text-success border-success/20',
  parent: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)] border-[var(--ps-cyan-border)]/20',
};

const STATUS_BADGE: Record<AccountStatus, string> = {
  active: 'bg-success/10 text-success border-success/20',
  suspended: 'bg-red-500/10 text-red-600 border-red-500/20',
  pending: 'bg-[var(--ps-cyan-soft)] text-[var(--ps-cyan-text)] border-[var(--ps-cyan-border)]/20',
  inactive: 'bg-muted text-muted-foreground border-border',
  banned: 'bg-red-500/10 text-red-700 border-red-500/20',
  deleted: 'bg-muted text-muted-foreground border-border',
};

/** Preset grants — the amounts an admin actually reaches for. */
const PRESETS = [25, 50, 100, 400];
const PAGE_SIZE = 12;

type SortField = 'name' | 'role' | 'status' | 'joined' | 'sparks';

const tsMillis = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | undefined;
  try { return typeof t?.toMillis === 'function' ? t.toMillis() : 0; } catch { return 0; }
};

const fmtDate = (v: unknown): string => {
  const ms = tsMillis(v);
  return ms ? new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};

export default function AdminUsersPage() {
  const { user, profile } = useAuthSTORE();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [programmeFilter, setProgrammeFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('joined');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [staffFilter, setStaffFilter] = useState<StaffRole | 'all'>('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [sparkReason, setSparkReason] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>('admin');
  const [profileFor, setProfileFor] = useState<Row | null>(null);
  const viewAs = useViewAs();
  const actor = resolveStaffRole(profile ? { id: user?.uid, email: profile.email, role: profile.role, adminRole: profile.adminRole } : null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setRows(await getAllUsers());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Top the admin up once, so there are Sparks to hand out from day one.
  useEffect(() => {
    if (user && isSuperAdmin(profile)) ensureAdminSparks(user.uid, ADMIN_SPARKS_GRANT).catch(() => {});
  }, [user, profile]);

  const programmes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.data.yearGroup) set.add(r.data.yearGroup); });
    return Array.from(set).sort();
  }, [rows]);

  const institutions = useMemo(() => Array.from(new Set(rows.map(r => r.data.institutionId).filter(Boolean) as string[])).sort(), [rows]);
  const countries = useMemo(() => Array.from(new Set(rows.map(r => r.data.country).filter(Boolean) as string[])).sort(), [rows]);

  const asDirectory = (row: Row): DirectoryUser => ({
    id: row.id,
    name: row.data.name ?? '',
    email: row.data.email ?? '',
    role: row.data.role ?? '',
    staffRole: resolveStaffRole({ ...row.data, id: row.id }),
    tier: row.data.accessTier ?? null,
    institutionId: row.data.institutionId ?? '',
    status: accountStatusOf(row.data),
    country: row.data.country ?? '',
  });

  const consoleDirectory = useMemo<ConsoleProfile[]>(() => rows.map(row => ({
    id: row.id,
    email: row.data.email,
    role: row.data.role,
    adminRole: row.data.adminRole ?? '',
    accountStatus: accountStatusOf(row.data),
  })), [rows]);

  const filtered = useMemo(() => {
    const allowed = new Set(filterDirectory(rows.map(asDirectory), {
      query, role: roleFilter, staffRole: staffFilter, tier: tierFilter,
      institutionId: institutionFilter, status: statusFilter, country: countryFilter,
    }).map(user => user.id));
    return rows.filter(row => allowed.has(row.id) && (programmeFilter === 'all' || (row.data.yearGroup ?? '') === programmeFilter));
  }, [rows, query, roleFilter, statusFilter, programmeFilter, staffFilter, tierFilter, institutionFilter, countryFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortField) {
        case 'joined': av = tsMillis(a.data.createdAt); bv = tsMillis(b.data.createdAt); break;
        case 'sparks': av = a.data.sparksBalance ?? 0; bv = b.data.sparksBalance ?? 0; break;
        case 'role': av = a.data.role ?? ''; bv = b.data.role ?? ''; break;
        case 'status': av = accountStatusOf(a.data); bv = accountStatusOf(b.data); break;
        default: av = (a.data.name ?? '').toLowerCase(); bv = (b.data.name ?? '').toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Any filter change invalidates the current page number.
  useEffect(() => { setPage(1); }, [query, roleFilter, statusFilter, programmeFilter, staffFilter, tierFilter, institutionFilter, countryFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const byStatus = (s: AccountStatus) => rows.filter(r => accountStatusOf(r.data) === s).length;
    return {
      total,
      students: rows.filter(r => r.data.role === 'student').length,
      suspended: byStatus('suspended'),
      sparks: rows.reduce((n, r) => n + (r.data.sparksBalance ?? 0), 0),
    };
  }, [rows]);

  const sort = (f: SortField) => {
    if (sortField === f) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f); setSortDir(f === 'name' || f === 'role' ? 'asc' : 'desc'); }
  };

  const patchRow = (id: string, patch: Partial<UserProfile>) =>
    setRows(list => list.map(r => (r.id === id ? { ...r, data: { ...r.data, ...patch } } : r)));

  const actorId = user?.uid ?? '';
  const actorEmail = profile?.email ?? user?.email ?? '';

  const grant = async (row: Row, amount: number) => {
    if (viewAs) { toast.error('View-as is read-only.'); return; }
    setBusy(row.id);
    try {
      const result = await adjustSparks({
        actorId, actorEmail, actor, directory: consoleDirectory,
        target: { id: row.id, email: row.data.email, role: row.data.role, adminRole: row.data.adminRole ?? '', accountStatus: accountStatusOf(row.data) },
        amount, balance: row.data.sparksBalance ?? 0, reason: sparkReason,
      });
      patchRow(row.id, { sparksBalance: (row.data.sparksBalance ?? 0) + amount });
      toast.success(result.note || `${amount > 0 ? '+' : ''}${amount} Sparks · ${row.data.name}`);
      setCustomFor(null); setCustomAmount('');
    } catch (e: any) {
      toast.error(e?.message || 'Could not update Sparks.');
    } finally { setBusy(null); }
  };

  const selectedRows = rows.filter(r => selected.has(r.id));

  const bulkStatus = async (status: AccountStatus) => {
    if (!bulkReason.trim()) { toast.error('A reason is required.'); return; }
    setBusy('bulk');
    let done = 0;
    let failed = '';
    for (const row of selectedRows) {
      try {
        await changeAccountState({
          actorId, actorEmail, actor, directory: consoleDirectory,
          target: { id: row.id, email: row.data.email, role: row.data.role, adminRole: row.data.adminRole ?? '', accountStatus: accountStatusOf(row.data) },
          next: status, reason: bulkReason,
        });
        patchRow(row.id, { accountStatus: status, statusReason: bulkReason.trim() });
        done += 1;
      } catch (e: any) {
        failed = e?.message || 'Bulk update failed.';
      }
    }
    if (done) toast.success(`${done} account${done === 1 ? '' : 's'} ${status}.`);
    if (failed) toast.error(failed);
    if (done) setSelected(new Set());
    setBusy(null);
  };

  const targetOf = (row: Row): ConsoleProfile => ({
    id: row.id,
    email: row.data.email,
    role: row.data.role,
    adminRole: row.data.adminRole ?? '',
    accountStatus: accountStatusOf(row.data),
  });

  const sendPasswordReset = async (row: Row) => {
    if (viewAs) { toast.error('View-as is read-only.'); return; }
    setBusy(row.id);
    try {
      const result = await resetStaffPassword({
        actorId, actorEmail, actor, directory: consoleDirectory, target: targetOf(row),
      });
      toast.success(
        result.resetLink ? 'Reset link ready' : `Reset link sent to ${row.data.email}.`,
        result.resetLink ? { description: result.resetLink } : undefined,
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not reset that password.');
    } finally { setBusy(null); }
  };

  const signOutSessions = async (row: Row) => {
    if (viewAs) { toast.error('View-as is read-only.'); return; }
    setBusy(row.id);
    try {
      const result = await revokeStaffSessions({
        actorId, actorEmail, actor, directory: consoleDirectory, target: targetOf(row),
        reason: 'Signed out from the user directory',
      });
      toast.success(result.note || `Signed ${row.data.name ?? 'that user'} out of active sessions.`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not sign that user out.');
    } finally { setBusy(null); }
  };

  const sendInvite = async () => {
    setBusy('invite');
    try {
      await inviteStaff({ actorId, actorEmail, actor, directory: consoleDirectory, email: inviteEmail, staffRole: inviteRole });
      toast.success(`Invited ${inviteEmail.trim()} as ${STAFF_LABELS[inviteRole]}.`);
      setInviteEmail('');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not send that invite.');
    } finally { setBusy(null); }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Name', 'Email', 'Role', 'Staff role', 'Status', 'Level', 'Sparks', 'Tier', 'Institution', 'Country', 'Joined'],
      ...sorted.map(r => [
        r.data.name, r.data.email, ROLE_LABELS[(r.data.role ?? 'student') as Role],
        resolveStaffRole({ ...r.data, id: r.id }) ?? '',
        accountStatusOf(r.data), r.data.yearGroup ?? '',
        r.data.sparksBalance ?? 0, r.data.accessTier ?? r.data.subscriptionTier ?? '',
        r.data.institutionId ?? '', r.data.country ?? '',
        fmtDate(r.data.createdAt),
      ]),
    ].map(line => line.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `poket-users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));

  if (loading) return (
    <div className="max-w-7xl mx-auto px-0 sm:px-2 pb-12 space-y-4 pt-8">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto pt-16 px-4">
      <div className="bg-card border border-border rounded-3xl p-8 text-center card-glow">
        <UsersIcon className="w-10 h-10 mx-auto text-[var(--ps-cyan-text)] mb-3" />
        <p className="font-heading text-2xl text-foreground mb-2">Couldn&apos;t load users</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-2 pb-12 space-y-6">
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Platform</p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-2">
            User <span className="gradient-text italic">management</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] max-w-xl">
            Every registered account, their access, and their Sparks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(actor, 'audit') && (
            <Link href="/dashboard/admin/audit" className="inline-flex items-center h-11 px-5 rounded-full border border-border text-sm font-semibold">
              Audit
            </Link>
          )}
          <Button onClick={exportCsv} variant="outline" disabled={sorted.length === 0}
            className="rounded-full h-11 px-5 font-semibold gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </motion.header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total users', value: stats.total, accent: 'bg-primary' },
          { label: 'Students', value: stats.students, accent: 'bg-success' },
          { label: 'Suspended', value: stats.suspended, accent: 'bg-red-500' },
          { label: 'Sparks in circulation', value: stats.sparks.toLocaleString(), accent: 'bg-[var(--ps-cyan)]' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden card-glow">
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${s.accent} opacity-80`} />
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bulk bar */}
      {can(actor, 'invite') && (
        <div className="bg-card border border-border rounded-3xl p-4 flex flex-wrap items-center gap-3">
          <Input value={inviteEmail} onChange={event => setInviteEmail(event.target.value)}
            placeholder="Invite by email" aria-label="Invite email" className="rounded-full h-11 max-w-xs" />
          <select aria-label="Invite role" value={inviteRole} onChange={event => setInviteRole(event.target.value as StaffRole)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
            {STAFF_ROLES.filter(role => role !== 'super_admin' || can(actor, 'manage_super')).map(role => (
              <option key={role} value={role}>{STAFF_LABELS[role]}</option>
            ))}
          </select>
          <Button onClick={sendInvite} disabled={busy === 'invite' || !inviteEmail.trim()} className="rounded-full h-11 px-5">
            Invite
          </Button>
        </div>
      )}

      {selected.size > 0 && can(actor, 'moderate') && (
        <div className="flex flex-wrap items-center gap-2 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3">
          <span className="text-sm font-bold text-violet-700">{selected.size} selected</span>
          <Input value={bulkReason} onChange={event => setBulkReason(event.target.value)}
            placeholder="Reason" aria-label="Bulk reason" className="rounded-full h-9 max-w-[220px]" />
          <span className="flex-1" />
          <Button size="sm" variant="outline" disabled={busy === 'bulk'}
            onClick={() => bulkStatus('active')} className="rounded-full h-9 px-4 font-semibold">
            Restore
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'bulk'}
            onClick={() => bulkStatus('suspended')} className="rounded-full h-9 px-4 font-semibold">
            Suspend
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'bulk'}
            onClick={() => bulkStatus('banned')} className="rounded-full h-9 px-4 font-semibold">
            Ban
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'bulk'}
            onClick={() => bulkStatus('deleted')}
            className="rounded-full h-9 px-4 font-semibold text-destructive hover:bg-destructive/10">
            Soft-delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}
            className="rounded-full h-9 px-4 font-semibold">
            Clear
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-3xl p-4 flex flex-wrap items-center gap-3 card-glow">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or email" aria-label="Search users"
            className="rounded-full h-11 pl-11" />
        </div>
        <select aria-label="Filter by role" value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as Role | 'all')}
          className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
          {ROLE_FILTERS.map(r => (
            <option key={r} value={r}>{r === 'all' ? 'All roles' : ROLE_LABELS[r as Role]}</option>
          ))}
        </select>
        <select aria-label="Filter by status" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as AccountStatus | 'all')}
          className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium capitalize">
          {STATUS_FILTERS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
        <select aria-label="Filter by staff role" value={staffFilter}
          onChange={e => setStaffFilter(e.target.value as StaffRole | 'all')}
          className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
          <option value="all">All staff roles</option>
          {STAFF_ROLES.map(role => <option key={role} value={role}>{STAFF_LABELS[role]}</option>)}
        </select>
        <select aria-label="Filter by tier" value={tierFilter} onChange={e => setTierFilter(e.target.value)}
          className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
          <option value="all">All tiers</option>
          {['0', '1', '2', '3', '4', '5', '6'].map(tier => <option key={tier} value={tier}>Tier {tier}</option>)}
        </select>
        {institutions.length > 0 && (
          <select aria-label="Filter by institution" value={institutionFilter} onChange={e => setInstitutionFilter(e.target.value)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
            <option value="all">All institutions</option>
            {institutions.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        )}
        {countries.length > 0 && (
          <select aria-label="Filter by country" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
            <option value="all">All countries</option>
            {countries.map(country => <option key={country} value={country}>{country}</option>)}
          </select>
        )}
        {programmes.length > 0 && (
          <select aria-label="Filter by level" value={programmeFilter}
            onChange={e => setProgrammeFilter(e.target.value)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
            <option value="all">All levels</option>
            {programmes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden card-glow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-muted/50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="w-4 h-4" checked={allOnPageSelected}
                    aria-label="Select all on this page"
                    onChange={e => setSelected(prev => {
                      const next = new Set(prev);
                      pageRows.forEach(r => e.target.checked ? next.add(r.id) : next.delete(r.id));
                      return next;
                    })} />
                </th>
                {([['name', 'User'], ['role', 'Role'], ['status', 'Status']] as const).map(([f, label]) => (
                  <th key={f} className="px-4 py-3 font-bold cursor-pointer select-none hover:text-foreground"
                    onClick={() => sort(f)}>
                    {label}{sortField === f && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
                <th className="px-4 py-3 font-bold">Level</th>
                <th className="px-4 py-3 font-bold cursor-pointer select-none hover:text-foreground"
                  onClick={() => sort('joined')}>
                  Joined{sortField === 'joined' && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="px-4 py-3 font-bold cursor-pointer select-none hover:text-foreground"
                  onClick={() => sort('sparks')}>
                  Sparks{sortField === 'sparks' && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
                <th className="px-4 py-3 font-bold text-right">Grant</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <UsersIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-foreground">No users match these filters</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your search.</p>
                </td></tr>
              ) : pageRows.map(r => {
                const status = accountStatusOf(r.data);
                const role = (r.data.role ?? 'student') as Role;
                return (
                  <tr key={r.id} className={selected.has(r.id) ? 'bg-violet-50/50' : undefined}>
                    <td className="px-4 py-3">
                      <input type="checkbox" className="w-4 h-4" checked={selected.has(r.id)}
                        aria-label={`Select ${r.data.name}`}
                        onChange={e => setSelected(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(r.id) : next.delete(r.id);
                          return next;
                        })} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white text-xs font-bold shrink-0">
                          {(r.data.name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{r.data.name ?? 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.data.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`rounded-full text-[10px] border ${ROLE_BADGE[role] ?? ''}`}>
                        {ROLE_LABELS[role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`rounded-full text-[10px] border capitalize ${STATUS_BADGE[status]}`}>
                        {status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.data.yearGroup ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{fmtDate(r.data.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-bold text-foreground tabular-nums">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--ps-cyan-text)]" />
                        {(r.data.sparksBalance ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {can(actor, 'sparks') && PRESETS.map(p => (
                          <button key={p} disabled={busy === r.id || !!viewAs} onClick={() => { setCustomFor(r.id); setCustomAmount(String(p)); }}
                            title={`Grant ${p} Sparks`}
                            className="text-[11px] font-bold px-2 h-7 rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                            +{p}
                          </button>
                        ))}
                        {can(actor, 'sparks') && customFor === r.id ? (
                          <span className="flex items-center gap-1">
                            <input type="number" value={customAmount} autoFocus
                              onChange={e => setCustomAmount(e.target.value)}
                              aria-label="Custom Sparks amount"
                              className="w-16 h-7 rounded-lg border border-border bg-background px-2 text-xs" />
                            <input value={sparkReason} onChange={e => setSparkReason(e.target.value)}
                              aria-label="Sparks reason" placeholder="Reason"
                              className="w-24 h-7 rounded-lg border border-border bg-background px-2 text-xs" />
                            <button disabled={busy === r.id || !!viewAs} title="Add"
                              onClick={() => grant(r, Math.abs(Number(customAmount) || 0))}
                              className="w-7 h-7 grid place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button disabled={busy === r.id || !!viewAs} title="Deduct"
                              onClick={() => grant(r, -Math.abs(Number(customAmount) || 0))}
                              className="w-7 h-7 grid place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : can(actor, 'sparks') ? (
                          <button onClick={() => { setCustomFor(r.id); setCustomAmount(''); }}
                            className="text-[11px] font-bold px-2 h-7 rounded-lg border border-border hover:bg-muted">
                            Custom
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${r.data.name}`}
                          disabled={busy === r.id}
                          className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
                          {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="w-56 rounded-2xl p-1.5">
                          <DropdownMenuItem className="rounded-xl px-3 py-2 gap-2.5" onClick={() => setProfileFor(r)}>
                            <Eye className="w-4 h-4 text-muted-foreground" /> Profile and activity
                          </DropdownMenuItem>
                          {can(actor, 'view_as') && (
                            <DropdownMenuItem className="rounded-xl px-3 py-2 gap-2.5" onClick={() => {
                              writeViewAs({ id: r.id, name: r.data.name ?? 'User', email: r.data.email ?? '' });
                              toast.success('Viewing as this user. Actions are read-only.');
                            }}>
                              <Eye className="w-4 h-4 text-muted-foreground" /> View as read-only
                            </DropdownMenuItem>
                          )}
                          {can(actor, 'sessions') && (
                            <>
                              <DropdownMenuItem className="rounded-xl px-3 py-2 gap-2.5" onClick={() => { void sendPasswordReset(r); }}>
                                <KeyRound className="w-4 h-4 text-muted-foreground" /> Send password reset
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl px-3 py-2 gap-2.5" onClick={() => { void signOutSessions(r); }}>
                                <ShieldOff className="w-4 h-4 text-[var(--ps-cyan-text)]" /> Sign out sessions
                              </DropdownMenuItem>
                            </>
                          )}
                          {can(actor, 'moderate') && (
                            <DropdownMenuItem className="rounded-xl px-3 py-2 gap-2.5" onClick={() => setProfileFor(r)}>
                              {status === 'suspended'
                                ? <ShieldCheck className="w-4 h-4 text-success" />
                                : <ShieldOff className="w-4 h-4 text-[var(--ps-cyan-text)]" />}
                              Suspend, ban, or restore
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Showing {sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
            {sorted.length !== rows.length && <> (filtered from {rows.length})</>}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}
                aria-label="Previous page"
                className="w-8 h-8 grid place-items-center rounded-lg border border-border disabled:opacity-40 hover:bg-muted">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-2 tabular-nums">{safePage} / {totalPages}</span>
              <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}
                aria-label="Next page"
                className="w-8 h-8 grid place-items-center rounded-lg border border-border disabled:opacity-40 hover:bg-muted">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Soft-delete keeps the profile so it can be restored. Ban and delete also disable the Firebase
          sign-in when the service account is configured. Sparks changes need a reason and are written to the ledger.
        </span>
      </p>
      {profileFor && (
        <AdminAccountPanel
          row={profileFor}
          actorId={actorId}
          actorEmail={actorEmail}
          actor={actor}
          directory={consoleDirectory}
          onClose={() => setProfileFor(null)}
          onUpdated={patch => { patchRow(profileFor.id, patch); setProfileFor(current => current ? { ...current, data: { ...current.data, ...patch } } : current); }}
        />
      )}
    </div>
  );
}
