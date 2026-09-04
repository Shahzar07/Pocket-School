'use client';

/**
 * Access Allocation — the admin side of the entitlement model.
 *
 * Three things live here because they are the same job seen from three angles:
 * setting what tier an account sits on, granting a specific course to a
 * specific person, and issuing codes that grant a course to whoever redeems
 * them. Splitting them across pages would mean an admin chasing one student
 * through three screens.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Search, Loader2, KeyRound, Ticket, ShieldCheck, Trash2, Copy, Plus, X, Check,
} from 'lucide-react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getUserByEmail, getAllCourses, setAccessTier, grantPermission, revokePermission,
  createCouponCode, getCouponCodes, setCouponActive, deleteCouponCode, generateCouponCode,
  type UserProfile, type Course, type CouponCode,
} from '@/lib/db';
import {
  TIERS, ADDONS, allocFree, allocPaid, allocMarketplace, accessTierFor, type AccessTier,
} from '@/lib/entitlements';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06 } }),
};

type Tab = 'users' | 'coupons';

/** Allocation kinds an admin can hand out for one course. */
const ALLOC_KINDS = [
  { id: 'free', label: 'Free access', help: 'Bypasses the plan gate entirely. For scholarships and staff.', build: allocFree },
  { id: 'paid', label: 'Activate (plan still required)', help: 'Turns the route on, but the student must still hold the plan.', build: allocPaid },
  { id: 'marketplace', label: 'Marketplace purchase', help: 'Permanent access. Survives cancelling a subscription.', build: allocMarketplace },
] as const;

export default function AccessAllocationPage() {
  const { profile } = useAuthSTORE();
  const [tab, setTab] = useState<Tab>('users');
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => { getAllCourses().then(setCourses).catch(() => setCourses([])); }, []);

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-8">
      <motion.header variants={fadeUp} initial="hidden" animate="visible">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Access control</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
          Access <span className="gradient-text italic">allocation</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">
          Set a person&apos;s tier, grant them a specific course, or issue codes that do it for you.
        </p>
      </motion.header>

      <div className="flex gap-1.5">
        {([['users', 'People', KeyRound], ['coupons', 'Coupon codes', Ticket]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 h-10 rounded-full text-sm font-semibold transition-colors ${
              tab === id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'users'
        ? <PeoplePanel courses={courses} />
        : <CouponPanel courses={courses} adminName={profile?.name ?? 'Admin'} />}
    </div>
  );
}

/* ── People ──────────────────────────────────────────────────── */

function PeoplePanel({ courses }: { courses: Course[] }) {
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<{ id: string; data: UserProfile } | null>(null);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const [courseId, setCourseId] = useState('');
  const [kind, setKind] = useState<(typeof ALLOC_KINDS)[number]['id']>('free');

  const search = async () => {
    const q = email.trim();
    if (!q) return;
    setSearching(true); setSearched(false);
    try {
      const r = await getUserByEmail(q);
      setFound(r); setSearched(true);
      if (!r) toast.error('No user with that email.');
    } catch { toast.error('Search failed.'); }
    finally { setSearching(false); }
  };

  const currentTier = found ? accessTierFor(found.data) : 0;
  const permissions = found?.data.permissions ?? [];
  // Add-ons have their own section above; only alloc:* strings name a course.
  const courseAllocations = permissions.filter(p => p.startsWith('alloc:'));

  const applyTier = async (tier: AccessTier) => {
    if (!found) return;
    setSaving('tier');
    try {
      await setAccessTier(found.id, tier);
      setFound({ ...found, data: { ...found.data, accessTier: tier } });
      toast.success(`${found.data.name} is now on ${TIERS.find(t => t.tier === tier)?.name}.`);
    } catch (e: any) { toast.error(e?.message || 'Could not set that tier.'); }
    finally { setSaving(null); }
  };

  const grant = async () => {
    if (!found || !courseId) return;
    const builder = ALLOC_KINDS.find(k => k.id === kind)!.build;
    const permission = builder(courseId);
    if (permissions.includes(permission)) { toast.info('That allocation is already in place.'); return; }
    setSaving('grant');
    try {
      await grantPermission(found.id, permission);
      setFound({ ...found, data: { ...found.data, permissions: [...permissions, permission] } });
      toast.success('Allocation granted.');
    } catch (e: any) { toast.error(e?.message || 'Could not grant that.'); }
    finally { setSaving(null); }
  };

  const grantAddOn = async (permission: string) => {
    if (!found) return;
    setSaving(permission);
    try {
      await grantPermission(found.id, permission);
      setFound({ ...found, data: { ...found.data, permissions: [...permissions, permission] } });
      toast.success('Add-on activated.');
    } catch (e: any) { toast.error(e?.message || 'Could not activate that add-on.'); }
    finally { setSaving(null); }
  };

  const revoke = async (permission: string) => {
    if (!found) return;
    setSaving(permission);
    try {
      await revokePermission(found.id, permission);
      setFound({ ...found, data: { ...found.data, permissions: permissions.filter(p => p !== permission) } });
      toast.success('Allocation revoked.');
    } catch (e: any) { toast.error(e?.message || 'Could not revoke that.'); }
    finally { setSaving(null); }
  };

  const courseTitle = useCallback(
    (id: string) => courses.find(c => c.id === id)?.title ?? id,
    [courses],
  );

  return (
    <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={1}
      className="bg-card border border-border rounded-3xl p-6 sm:p-7 space-y-6 card-glow">
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Find someone by email address"
          className="rounded-full h-11"
        />
        <Button onClick={search} disabled={searching} className="rounded-full h-11 px-5 font-bold">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2 hidden sm:inline">Search</span>
        </Button>
      </div>

      {searched && !found && <p className="text-sm text-muted-foreground">No user with that email address.</p>}

      {found && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-foreground">{found.data.name}</p>
            <Badge variant="outline" className="rounded-full text-[10px] capitalize">{found.data.role}</Badge>
            <span className="text-sm text-muted-foreground">{found.data.email}</span>
          </div>

          {/* Tier */}
          <div>
            <p className="text-sm font-bold text-foreground mb-1">Access tier</p>
            <p className="text-xs text-muted-foreground mb-3">
              Gate 1. Content is shown when the person&apos;s tier is at least the course&apos;s minimum.
            </p>
            <div className="flex flex-wrap gap-2">
              {TIERS.map(t => (
                <button
                  key={t.tier}
                  disabled={saving === 'tier'}
                  onClick={() => applyTier(t.tier)}
                  title={t.blurb}
                  className={`px-3 h-9 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    currentTier === t.tier
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t.tier} · {t.name}
                </button>
              ))}
            </div>
            {found.data.role === 'admin' && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                This account is a platform admin — every entitlement check passes for it regardless of tier.
              </p>
            )}
          </div>

          {/* Add-ons */}
          <div className="border-t border-border pt-5">
            <p className="text-sm font-bold text-foreground mb-1">Add-ons</p>
            <p className="text-xs text-muted-foreground mb-3">
              Sold on top of a plan. Granting one here is how a paid add-on is activated.
            </p>
            <div className="space-y-2">
              {ADDONS.map(a => {
                const held = permissions.includes(a.permission);
                const eligible = currentTier >= a.requiresTier;
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {a.name} <span className="font-normal text-muted-foreground">· RM{a.myrMonthly}/mo</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {eligible
                          ? a.blurb
                          : `Needs the ${TIERS.find(t => t.tier === a.requiresTier)?.name} plan or above — set the tier first.`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={held ? 'outline' : 'default'}
                      disabled={saving === a.permission || (!held && !eligible)}
                      onClick={() => (held ? revoke(a.permission) : grantAddOn(a.permission))}
                      className="rounded-full h-9 px-4 font-semibold shrink-0"
                    >
                      {saving === a.permission
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : held ? 'Revoke' : 'Grant'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grant a course */}
          <div className="border-t border-border pt-5">
            <p className="text-sm font-bold text-foreground mb-1">Grant a course</p>
            <p className="text-xs text-muted-foreground mb-3">
              {ALLOC_KINDS.find(k => k.id === kind)?.help}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={courseId}
                onChange={e => setCourseId(e.target.value)}
                aria-label="Course"
                className="h-10 rounded-full border border-border bg-card px-4 text-sm min-w-[16rem] max-w-full"
              >
                <option value="">Select a course…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select
                value={kind}
                onChange={e => setKind(e.target.value as typeof kind)}
                aria-label="Allocation type"
                className="h-10 rounded-full border border-border bg-card px-4 text-sm"
              >
                {ALLOC_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <Button onClick={grant} disabled={!courseId || saving === 'grant'} className="rounded-full h-10 px-4 font-bold">
                {saving === 'grant' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="ml-1.5">Grant</span>
              </Button>
            </div>
          </div>

          {/* Current allocations */}
          <div className="border-t border-border pt-5">
            <p className="text-sm font-bold text-foreground mb-3">
              Course allocations ({courseAllocations.length})
            </p>
            {courseAllocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None. This person sees only what their tier includes.
              </p>
            ) : (
              <ul className="space-y-2">
                {courseAllocations.map(p => {
                  const [, kindPart, ...rest] = p.split(':');
                  const cid = rest.join(':');
                  return (
                    <li key={p} className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2">
                      <Badge variant="outline" className="rounded-full text-[10px] capitalize shrink-0">{kindPart}</Badge>
                      <span className="text-sm text-foreground flex-1 min-w-0 truncate">{courseTitle(cid)}</span>
                      <button
                        onClick={() => revoke(p)}
                        disabled={saving === p}
                        title="Revoke"
                        className="text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50"
                      >
                        {saving === p ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
}

/* ── Coupons ─────────────────────────────────────────────────── */

function CouponPanel({ courses, adminName }: { courses: Course[]; adminName: string }) {
  const { user } = useAuthSTORE();
  const [codes, setCodes] = useState<CouponCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const defaultExpiry = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  }, []);

  const [form, setForm] = useState({
    code: '', courseId: '', discountPct: 100, maxUses: 30, expiresAt: defaultExpiry,
  });

  const load = useCallback(() => {
    setLoading(true);
    getCouponCodes().then(setCodes).catch(() => setCodes([])).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    if (!user) return;
    const code = (form.code || generateCouponCode()).trim().toUpperCase();
    if (!form.courseId) { toast.error('Pick the course this code unlocks.'); return; }
    if (!/^[A-Z0-9]{4,12}$/.test(code)) { toast.error('Codes are 4–12 letters and numbers.'); return; }
    if (form.expiresAt < new Date().toISOString().slice(0, 10)) { toast.error('Pick an expiry in the future.'); return; }
    setCreating(true);
    try {
      await createCouponCode({
        code,
        courseId: form.courseId,
        courseTitle: courses.find(c => c.id === form.courseId)?.title ?? '',
        discountPct: Math.min(100, Math.max(1, Math.round(form.discountPct))),
        maxUses: Math.max(1, Math.round(form.maxUses)),
        expiresAt: form.expiresAt,
        createdBy: user.uid,
        createdByName: adminName,
        active: true,
      });
      toast.success(`Code ${code} created.`);
      setForm(f => ({ ...f, code: '' }));
      load();
    } catch (e: any) { toast.error(e?.message || 'Could not create that code.'); }
    finally { setCreating(false); }
  };

  const toggle = async (c: CouponCode) => {
    setBusy(c.code);
    try {
      await setCouponActive(c.code, c.active === false);
      setCodes(list => list.map(x => x.code === c.code ? { ...x, active: c.active === false } : x));
    } catch { toast.error('Could not update that code.'); }
    finally { setBusy(null); }
  };

  const remove = async (c: CouponCode) => {
    if (!confirm(`Delete code ${c.code}? Anyone who already redeemed it keeps their access.`)) return;
    setBusy(c.code);
    try {
      await deleteCouponCode(c.code);
      setCodes(list => list.filter(x => x.code !== c.code));
      toast.success(`${c.code} deleted.`);
    } catch { toast.error('Could not delete that code.'); }
    finally { setBusy(null); }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="bg-card border border-border rounded-3xl p-6 sm:p-7 space-y-4 card-glow">
        <div>
          <p className="text-sm font-bold text-foreground">Issue a code</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            A 100% code grants the course outright until it expires. Anything less is a checkout discount.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Code</Label>
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Auto-generated"
                className="rounded-xl h-10 font-mono tracking-wider"
              />
              <Button
                type="button" variant="outline" className="rounded-xl h-10 px-3 shrink-0"
                onClick={() => setForm(f => ({ ...f, code: generateCouponCode() }))}
              >
                Roll
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Course</Label>
            <select
              value={form.courseId}
              onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="">Select a course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Discount %</Label>
            <Input
              type="number" min={1} max={100}
              value={form.discountPct}
              onChange={e => setForm(f => ({ ...f, discountPct: Number(e.target.value) }))}
              className="rounded-xl h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max uses</Label>
            <Input
              type="number" min={1}
              value={form.maxUses}
              onChange={e => setForm(f => ({ ...f, maxUses: Number(e.target.value) }))}
              className="rounded-xl h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expires</Label>
            <Input
              type="date" value={form.expiresAt}
              onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              className="rounded-xl h-10"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={create} disabled={creating} className="rounded-full h-10 px-5 font-bold w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              <span className="ml-2">Create code</span>
            </Button>
          </div>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={2}
        className="bg-card border border-border rounded-3xl p-6 sm:p-7 card-glow">
        <p className="text-sm font-bold text-foreground mb-4">Codes ({codes.length})</p>

        {loading ? (
          <div className="h-24 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="border-b border-border">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-bold">Code</th>
                  <th className="py-2 pr-4 font-bold">Course</th>
                  <th className="py-2 pr-4 font-bold">Discount</th>
                  <th className="py-2 pr-4 font-bold">Used</th>
                  <th className="py-2 pr-4 font-bold">Expires</th>
                  <th className="py-2 pr-4 font-bold">Status</th>
                  <th className="py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {codes.map(c => {
                  const expired = !!c.expiresAt && c.expiresAt < today;
                  const spent = c.usedCount >= c.maxUses;
                  return (
                    <tr key={c.code}>
                      <td className="py-3 pr-4 font-mono font-bold tracking-wider">{c.code}</td>
                      <td className="py-3 pr-4 max-w-[16rem] truncate text-muted-foreground">
                        {c.courseTitle || courses.find(x => x.id === c.courseId)?.title || c.courseId}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">{c.discountPct}%</td>
                      <td className="py-3 pr-4 tabular-nums">{c.usedCount}/{c.maxUses}</td>
                      <td className="py-3 pr-4 tabular-nums text-muted-foreground">{c.expiresAt}</td>
                      <td className="py-3 pr-4">
                        <Badge className={`rounded-full text-[10px] ${
                          expired || spent
                            ? 'bg-muted text-muted-foreground border-border'
                            : c.active === false
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        }`}>
                          {expired ? 'Expired' : spent ? 'Fully used' : c.active === false ? 'Paused' : 'Active'}
                        </Badge>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => { navigator.clipboard?.writeText(c.code); toast.success('Code copied.'); }}
                          className="text-muted-foreground hover:text-foreground px-1.5" title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggle(c)} disabled={busy === c.code}
                          className="text-muted-foreground hover:text-foreground px-1.5 disabled:opacity-50"
                          title={c.active === false ? 'Reactivate' : 'Pause'}
                        >
                          {c.active === false ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => remove(c)} disabled={busy === c.code}
                          className="text-muted-foreground hover:text-destructive px-1.5 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>
    </div>
  );
}
