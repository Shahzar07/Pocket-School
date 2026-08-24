'use client';

/**
 * Admin → Users. The directory of everyone who has signed up, with the Sparks
 * controls attached to each person rather than hidden behind a search box.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getAllUsers, awardSparks, ensureAdminSparks, UserProfile } from '@/lib/db';
import { ADMIN_SPARKS_GRANT } from '@/lib/sparks';
import { ROLE_LABELS, isSuperAdmin, type Role } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Search, Sparkles, Users, Download, Plus, Minus } from 'lucide-react';

interface Row { id: string; data: UserProfile }

const ROLE_FILTERS: (Role | 'all')[] = ['all', 'student', 'teacher', 'parent', 'institution_admin', 'admin'];

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  institution_admin: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  teacher: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  student: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  parent: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
};

/** Preset grants — the amounts an admin actually reaches for. */
const PRESETS = [25, 50, 100, 400];

export default function AdminUsersPage() {
  const { user, profile } = useAuthSTORE();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getAllUsers());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Top the admin up once so every paid surface can be exercised while testing.
  useEffect(() => {
    if (!user || !isSuperAdmin({ role: profile?.role, email: user.email })) return;
    ensureAdminSparks(user.uid, ADMIN_SPARKS_GRANT)
      .then(granted => {
        if (granted) {
          toast.success(`${ADMIN_SPARKS_GRANT.toLocaleString()} Sparks added to your admin account.`);
          load();
        }
      })
      .catch(() => { /* a convenience top-up must never block the page */ });
  }, [user, profile?.role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (roleFilter !== 'all' && r.data.role !== roleFilter) return false;
      if (!q) return true;
      return `${r.data.name ?? ''} ${r.data.email ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, query, roleFilter]);

  const totals = useMemo(() => ({
    all: rows.length,
    students: rows.filter(r => r.data.role === 'student').length,
    teachers: rows.filter(r => r.data.role === 'teacher').length,
    sparks: rows.reduce((s, r) => s + (r.data.sparksBalance ?? 0), 0),
  }), [rows]);

  const grant = async (row: Row, amount: number) => {
    if (!Number.isFinite(amount) || amount === 0) { toast.error('Enter an amount.'); return; }
    const balance = row.data.sparksBalance ?? 0;
    if (amount < 0 && balance + amount < 0) {
      toast.error(`${row.data.name || 'This user'} only has ${balance} Sparks.`);
      return;
    }
    setBusy(row.id);
    try {
      const after = await awardSparks(
        row.id, amount, 'admin_grant',
        `${amount > 0 ? 'Granted' : 'Deducted'} by ${profile?.name ?? 'an administrator'}`,
      );
      setRows(list => list.map(r => (r.id === row.id ? { ...r, data: { ...r.data, sparksBalance: after } } : r)));
      setCustomAmount(m => ({ ...m, [row.id]: '' }));
      toast.success(`${amount > 0 ? '+' : ''}${amount} Sparks — ${row.data.name || 'user'} now has ${after}.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not update that balance.');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Name', 'Email', 'Role', 'Year group', 'Tier', 'Sparks', 'XP'],
      ...filtered.map(r => [
        r.data.name, r.data.email, ROLE_LABELS[r.data.role as Role] ?? r.data.role,
        r.data.yearGroup ?? '', r.data.subscriptionTier ?? 'free',
        r.data.sparksBalance ?? 0, r.data.xp ?? 0,
      ]),
    ].map(line => line.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `poket-school-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-4 pt-8">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-3xl" />)}
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 pt-16 flex justify-center">
      <Card className="p-8 text-center max-w-md w-full rounded-3xl">
        <Users className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <p className="font-heading text-xl text-foreground mb-2">Couldn&apos;t load users</p>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error}</p>
        <Button onClick={load} className="rounded-full h-11 px-6 font-bold">Retry</Button>
      </Card>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-8">
      <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Directory</p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-2">
            Users &amp; <span className="gradient-text italic">Sparks</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everyone who has signed up, and their Sparks balance.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}
          className="rounded-full h-11 px-5 font-semibold gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </motion.header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total users', value: totals.all },
          { label: 'Students', value: totals.students },
          { label: 'Teachers', value: totals.teachers },
          { label: 'Sparks in circulation', value: totals.sparks.toLocaleString() },
        ].map(t => (
          <Card key={t.label} className="rounded-3xl p-5 text-center card-glow">
            <p className="text-3xl font-extrabold text-foreground">{t.value}</p>
            <p className="text-muted-foreground text-xs mt-1 font-medium">{t.label}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={e => setQuery(e.target.value)} type="search"
            placeholder="Search by name or email" aria-label="Search users"
            className="h-11 w-72 rounded-full pl-11" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_FILTERS.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                roleFilter === r ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}>
              {r === 'all' ? 'All' : ROLE_LABELS[r as Role]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {rows.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">No users match those filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => (
            <motion.div key={r.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4 card-glow">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 grid place-items-center text-white font-bold shrink-0">
                  {(r.data.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground text-sm truncate">{r.data.name || 'Unnamed'}</p>
                    <Badge variant="outline" className={`rounded-full text-[10px] ${ROLE_BADGE[r.data.role] ?? ''}`}>
                      {ROLE_LABELS[r.data.role as Role] ?? r.data.role}
                    </Badge>
                    {r.data.subscriptionTier === 'academic' && (
                      <Badge className="rounded-full text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        Academic
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.data.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right mr-1">
                  <p className="font-extrabold text-foreground flex items-center gap-1 justify-end">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {(r.data.sparksBalance ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Sparks</p>
                </div>

                {PRESETS.map(p => (
                  <Button key={p} size="sm" variant="outline" disabled={busy === r.id}
                    onClick={() => grant(r, p)}
                    className="rounded-full h-8 px-2.5 text-[11px] font-bold">
                    +{p}
                  </Button>
                ))}

                <div className="flex items-center gap-1">
                  <Input
                    value={customAmount[r.id] ?? ''}
                    onChange={e => setCustomAmount(m => ({ ...m, [r.id]: e.target.value }))}
                    inputMode="numeric" placeholder="Amount"
                    aria-label={`Custom Sparks amount for ${r.data.name || 'user'}`}
                    className="h-8 w-20 rounded-full text-xs" />
                  <Button size="sm" variant="ghost" disabled={busy === r.id}
                    title="Add this amount"
                    onClick={() => grant(r, Math.abs(Number(customAmount[r.id])))}
                    className="h-8 w-8 p-0 rounded-full">
                    {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === r.id}
                    title="Deduct this amount"
                    onClick={() => grant(r, -Math.abs(Number(customAmount[r.id])))}
                    className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-destructive">
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
