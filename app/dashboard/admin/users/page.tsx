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
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getAllUsers, awardSparks, ensureAdminSparks, accountStatusOf,
  setAccountStatus, setAccountStatusBulk, deleteUserProfile, deleteUserProfiles,
  type UserProfile, type AccountStatus,
} from '@/lib/db';
import { ADMIN_SPARKS_GRANT } from '@/lib/sparks';
import { ROLE_LABELS, isSuperAdmin, type Role } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2, Search, Sparkles, Users as UsersIcon, Download, Plus, Minus,
  MoreVertical, ShieldOff, ShieldCheck, KeyRound, Trash2, ChevronLeft, ChevronRight, Info,
} from 'lucide-react';

interface Row { id: string; data: UserProfile }

const ROLE_FILTERS: (Role | 'all')[] = ['all', 'student', 'teacher', 'parent', 'institution_admin', 'admin'];
const STATUS_FILTERS: (AccountStatus | 'all')[] = ['all', 'active', 'suspended', 'pending', 'inactive'];

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  institution_admin: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  teacher: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  student: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  parent: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

const STATUS_BADGE: Record<AccountStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  suspended: 'bg-red-500/10 text-red-600 border-red-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  inactive: 'bg-muted text-muted-foreground border-border',
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');

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

  useEffect(() => {
    const close = () => setMenuFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const programmes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.data.yearGroup) set.add(r.data.yearGroup); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (roleFilter !== 'all' && r.data.role !== roleFilter) return false;
      if (statusFilter !== 'all' && accountStatusOf(r.data) !== statusFilter) return false;
      if (programmeFilter !== 'all' && (r.data.yearGroup ?? '') !== programmeFilter) return false;
      if (q) {
        const hay = `${r.data.name ?? ''} ${r.data.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, roleFilter, statusFilter, programmeFilter]);

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
  useEffect(() => { setPage(1); }, [query, roleFilter, statusFilter, programmeFilter]);

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

  /* ── Sparks ── */
  const grant = async (row: Row, amount: number) => {
    const balance = row.data.sparksBalance ?? 0;
    if (amount < 0 && balance + amount < 0) {
      toast.error(`${row.data.name} only has ${balance} Sparks.`);
      return;
    }
    setBusy(row.id);
    try {
      await awardSparks(row.id, amount, 'admin_grant',
        amount > 0 ? 'Granted by admin' : 'Deducted by admin');
      patchRow(row.id, { sparksBalance: balance + amount });
      toast.success(`${amount > 0 ? '+' : ''}${amount} Sparks · ${row.data.name}`);
      setCustomFor(null); setCustomAmount('');
    } catch (e: any) {
      toast.error(e?.message || 'Could not update Sparks.');
    } finally { setBusy(null); }
  };

  /* ── Status ── */
  const changeStatus = async (row: Row, status: AccountStatus) => {
    if (row.id === user?.uid && status === 'suspended') {
      toast.error('You cannot suspend your own account.');
      return;
    }
    setBusy(row.id);
    try {
      await setAccountStatus(row.id, status);
      patchRow(row.id, { accountStatus: status });
      toast.success(`${row.data.name} is now ${status}.`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not change that status.');
    } finally { setBusy(null); }
  };

  const resetPassword = async (row: Row) => {
    const email = row.data.email;
    if (!email) { toast.error('That account has no email address on file.'); return; }
    setBusy(row.id);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Reset link sent to ${email}.`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not send that reset email.');
    } finally { setBusy(null); }
  };

  const removeUser = async (row: Row) => {
    if (row.id === user?.uid) { toast.error('You cannot delete your own account.'); return; }
    if (!confirm(
      `Delete ${row.data.name}?\n\nThis removes their profile, progress and Sparks. Their sign-in `
      + 'record stays in Firebase Authentication and must be removed there separately.\n\nThis cannot be undone.',
    )) return;
    setBusy(row.id);
    try {
      await deleteUserProfile(row.id);
      setRows(list => list.filter(r => r.id !== row.id));
      toast.success(`${row.data.name} deleted.`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete that user.');
    } finally { setBusy(null); }
  };

  /* ── Bulk ── */
  const selectedRows = rows.filter(r => selected.has(r.id));

  const bulkStatus = async (status: AccountStatus) => {
    const ids = selectedRows.map(r => r.id).filter(id => !(status === 'suspended' && id === user?.uid));
    if (!ids.length) return;
    setBusy('bulk');
    try {
      await setAccountStatusBulk(ids, status);
      setRows(list => list.map(r => (ids.includes(r.id) ? { ...r, data: { ...r.data, accountStatus: status } } : r)));
      toast.success(`${ids.length} account${ids.length === 1 ? '' : 's'} ${status}.`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || 'Bulk update failed.');
    } finally { setBusy(null); }
  };

  const bulkDelete = async () => {
    const ids = selectedRows.map(r => r.id).filter(id => id !== user?.uid);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} account${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBusy('bulk');
    try {
      await deleteUserProfiles(ids);
      setRows(list => list.filter(r => !ids.includes(r.id)));
      toast.success(`${ids.length} deleted.`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message || 'Bulk delete failed.');
    } finally { setBusy(null); }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Name', 'Email', 'Role', 'Status', 'Year group', 'Sparks', 'Tier', 'Joined'],
      ...sorted.map(r => [
        r.data.name, r.data.email, ROLE_LABELS[(r.data.role ?? 'student') as Role],
        accountStatusOf(r.data), r.data.yearGroup ?? '',
        r.data.sparksBalance ?? 0, r.data.subscriptionTier ?? 'free',
        fmtDate(r.data.createdAt),
      ]),
    ].map(line => line.map(esc).join(',')).join('\n');
    // BOM so Excel reads UTF-8 names correctly.
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
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
        <UsersIcon className="w-10 h-10 mx-auto text-amber-500 mb-3" />
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
        <Button onClick={exportCsv} variant="outline" disabled={sorted.length === 0}
          className="rounded-full h-11 px-5 font-semibold gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </motion.header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total users', value: stats.total, accent: 'bg-[#2786A4]' },
          { label: 'Students', value: stats.students, accent: 'bg-emerald-500' },
          { label: 'Suspended', value: stats.suspended, accent: 'bg-red-500' },
          { label: 'Sparks in circulation', value: stats.sparks.toLocaleString(), accent: 'bg-amber-500' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-3xl p-5 relative overflow-hidden card-glow">
            <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${s.accent} opacity-80`} />
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3">
          <span className="text-sm font-bold text-violet-700">{selected.size} selected</span>
          <span className="flex-1" />
          <Button size="sm" variant="outline" disabled={busy === 'bulk'}
            onClick={() => bulkStatus('active')} className="rounded-full h-9 px-4 font-semibold">
            Activate
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'bulk'}
            onClick={() => bulkStatus('suspended')} className="rounded-full h-9 px-4 font-semibold">
            Suspend
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'bulk'}
            onClick={bulkDelete}
            className="rounded-full h-9 px-4 font-semibold text-destructive hover:bg-destructive/10">
            Delete
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
        {programmes.length > 0 && (
          <select aria-label="Filter by year group" value={programmeFilter}
            onChange={e => setProgrammeFilter(e.target.value)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm font-medium">
            <option value="all">All year groups</option>
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
                <th className="px-4 py-3 font-bold">Year group</th>
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
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        {(r.data.sparksBalance ?? 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {PRESETS.map(p => (
                          <button key={p} disabled={busy === r.id} onClick={() => grant(r, p)}
                            title={`Grant ${p} Sparks`}
                            className="text-[11px] font-bold px-2 h-7 rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                            +{p}
                          </button>
                        ))}
                        {customFor === r.id ? (
                          <span className="flex items-center gap-1">
                            <input type="number" value={customAmount} autoFocus
                              onChange={e => setCustomAmount(e.target.value)}
                              aria-label="Custom Sparks amount"
                              className="w-20 h-7 rounded-lg border border-border bg-background px-2 text-xs" />
                            <button disabled={busy === r.id} title="Add"
                              onClick={() => grant(r, Math.abs(Number(customAmount) || 0))}
                              className="w-7 h-7 grid place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button disabled={busy === r.id} title="Deduct"
                              onClick={() => grant(r, -Math.abs(Number(customAmount) || 0))}
                              className="w-7 h-7 grid place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => { setCustomFor(r.id); setCustomAmount(''); }}
                            className="text-[11px] font-bold px-2 h-7 rounded-lg border border-border hover:bg-muted">
                            Custom
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={e => { e.stopPropagation(); setMenuFor(menuFor === r.id ? null : r.id); }}
                        aria-label={`Actions for ${r.data.name}`}
                        className="w-8 h-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                        {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                      </button>
                      {menuFor === r.id && (
                        <div onClick={e => e.stopPropagation()}
                          className="absolute right-4 top-full z-30 mt-1 w-56 bg-card border border-border rounded-2xl shadow-xl p-1.5">
                          <button onClick={() => { setMenuFor(null); resetPassword(r); }}
                            className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted flex items-center gap-2.5">
                            <KeyRound className="w-4 h-4 text-muted-foreground" /> Send password reset
                          </button>
                          {status === 'suspended' ? (
                            <button onClick={() => { setMenuFor(null); changeStatus(r, 'active'); }}
                              className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted flex items-center gap-2.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Reactivate account
                            </button>
                          ) : (
                            <button onClick={() => { setMenuFor(null); changeStatus(r, 'suspended'); }}
                              className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-muted flex items-center gap-2.5">
                              <ShieldOff className="w-4 h-4 text-amber-600" /> Suspend account
                            </button>
                          )}
                          <div className="h-px bg-border my-1.5" />
                          <button onClick={() => { setMenuFor(null); removeUser(r); }}
                            className="w-full text-left px-3 py-2 rounded-xl text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2.5">
                            <Trash2 className="w-4 h-4" /> Delete user
                          </button>
                        </div>
                      )}
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
          Accounts are created by people signing up, or by an admin in the Firebase console — a browser
          cannot create one without signing you out of your own session. Deleting here removes the
          profile and its data; the sign-in record must be removed in Firebase Authentication.
        </span>
      </p>
    </div>
  );
}
