'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import {
  getPlatformStats, getInstitutions, seedDemoData, getAllUsers, getSupportTickets,
  getCourseRollup, getPlatformHealth, accountStatusOf, Institution,
} from '@/lib/db';
import { can, platformKpis, resolveStaffRole, systemHealth } from '@/lib/admin-console';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';
import { Building2, Users, BookOpen, Sparkles, CheckCircle2, BarChart3, ArrowRight, Layers, Shield, LifeBuoy, Activity } from 'lucide-react';
import Link from 'next/link';
import {
  DashPage, DashHeader, Panel, PanelHeader, StatCard, ListRow, Initials, EmptyState,
} from '@/components/dash-ui';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

const tsMillis = (value: unknown): number => {
  const stamp = value as { toMillis?: () => number } | number | undefined;
  if (typeof stamp === 'number') return stamp;
  try { return typeof stamp?.toMillis === 'function' ? stamp.toMillis() : 0; } catch { return 0; }
};

export default function AdminDashboard() {
  const { user, profile } = useAuthSTORE();
  const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0 });
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [kpis, setKpis] = useState({ signups30: 0, active7: 0, sparksIssued: 0, sparksSpent: 0, revenue: 0, completions: 0, openTickets: 0 });
  const [health, setHealth] = useState({ firestore: 'ok' as 'ok' | 'attention', generation: 'ok' as 'ok' | 'attention', quotaErrors: 0, generationFailures: 0 });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPlatformStats(),
      getInstitutions(),
      getAllUsers().catch(() => []),
      getSupportTickets(user.uid, 'admin').catch(() => []),
      getCourseRollup().catch(() => ({ completions: 0, revenue: 0 })),
      getPlatformHealth().catch(() => ({ quotaErrors: 0, generationFailures: 0, sparksSpent: 0 })),
    ]).then(([s, inst, people, tickets, rollup, signal]) => {
      setStats(s);
      setInstitutions(inst);
      const circulation = people.reduce((sum, row) => sum + (row.data.sparksBalance ?? 0), 0);
      setKpis(platformKpis({
        users: people.map(row => ({
          createdAt: tsMillis(row.data.createdAt),
          lastActiveAt: tsMillis(row.data.lastActiveAt),
          status: accountStatusOf(row.data),
        })),
        sparksIssued: circulation + signal.sparksSpent,
        sparksSpent: signal.sparksSpent,
        revenue: rollup.revenue,
        completions: rollup.completions,
        openTickets: tickets.filter(ticket => ticket.status === 'open' || ticket.status === 'in_progress').length,
        now: Date.now(),
      }));
      const pulse = systemHealth(signal);
      setHealth({ ...pulse, quotaErrors: signal.quotaErrors, generationFailures: signal.generationFailures });
      setLoading(false);
    });
  }, [user]);

  const handleSeedData = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const result = await seedDemoData(user.uid);
      toast.success(`Seeded ${result.coursesCreated} courses and ${result.lessonsCreated} lessons!`);
      setSeeded(true);
      const s = await getPlatformStats();
      setStats(s);
    } catch (e: any) {
      toast.error('Seeding failed: ' + e.message);
    } finally {
      setSeeding(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) return (
    <DashPage>
      <div className="h-16 bg-muted animate-pulse rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl" />)}
      </div>
      <div className="h-72 bg-muted animate-pulse rounded-2xl" />
    </DashPage>
  );

  return (
    <DashPage>
      <DashHeader
        eyebrow={`Platform · ${today}`}
        title="Control"
        accent="centre"
        description="Everything across the platform, in one place."
        actions={
          <>
            <Link
              href="/dashboard/admin/curriculum"
              className={buttonVariants({ variant: 'outline' }) + ' h-10 px-4 rounded-xl font-semibold text-[13px] gap-2'}
            >
              <Layers className="w-3.5 h-3.5" /> Curriculum
            </Link>
            <Button
              onClick={handleSeedData}
              disabled={seeding || seeded}
              className="h-10 px-4 rounded-xl font-semibold text-[13px] gap-2"
            >
              {seeded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {seeded ? 'Demo data added' : seeding ? 'Adding…' : 'Seed demo data'}
            </Button>
          </>
        }
      />

      {/* ── Platform stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0} icon={Users} label="Students" value={stats.students.toLocaleString()}
          href="/dashboard/admin/users" hrefLabel="Manage users"
        />
        <StatCard
          index={1} icon={Shield} label="Teachers" value={stats.teachers.toLocaleString()}
          href="/dashboard/admin/users" hrefLabel="Manage users"
        />
        <StatCard
          index={2} icon={BookOpen} label="Courses" value={stats.courses.toLocaleString()}
          href="/dashboard/admin/courses" hrefLabel="All courses"
        />
        <StatCard
          index={3} icon={Building2} label="Institutions" value={institutions.length.toLocaleString()}
          href="/dashboard/admin/institutions" hrefLabel="View institutions"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Signups, 30 days', kpis.signups30.toLocaleString()],
          ['Active, 7 days', kpis.active7.toLocaleString()],
          ['Revenue recorded', `$${kpis.revenue.toLocaleString()}`],
          ['Sparks in circulation', (kpis.sparksIssued - kpis.sparksSpent).toLocaleString()],
          ['Sparks spent', kpis.sparksSpent.toLocaleString()],
          ['Course completions', kpis.completions.toLocaleString()],
          ['Open tickets', kpis.openTickets.toLocaleString()],
          ['Sparks issued', kpis.sparksIssued.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <Panel>
        <PanelHeader title="System health" meta={<Activity className="w-4 h-4 text-muted-foreground" />} />
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <p>Firestore quota and errors: <strong className="capitalize">{health.firestore}</strong> ({health.quotaErrors})</p>
          <p>AI generation failures: <strong className="capitalize">{health.generation}</strong> ({health.generationFailures})</p>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Revenue is the sum of course revenue totals. Sparks spent stays at zero until `platform_signals/health.sparksSpent` is recorded. Sparks issued adds that figure to the balances in circulation.
        </p>
      </Panel>

      {/* ── Institutions + shortcuts ── */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <Panel>
          <PanelHeader
            title="Institutions"
            meta={<span className="text-[11px] text-muted-foreground">{institutions.length} total</span>}
            action={
              <Link href="/dashboard/admin/institutions"
                className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            }
          />
          {institutions.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No institutions yet"
              body="Add a school to allocate courses, invite teachers and set up white-label branding."
              action={
                <Link href="/dashboard/admin/institutions"
                  className={buttonVariants() + ' h-9 px-4 rounded-xl text-[13px] font-semibold gap-2'}>
                  Add an institution <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {institutions.slice(0, 6).map(inst => (
                <ListRow
                  key={inst.id}
                  href="/dashboard/admin/institutions"
                  leading={<Initials name={inst.name} />}
                  title={inst.name}
                  subtitle={inst.subdomain ? `${inst.subdomain}.poketschool.ai` : (inst.domain || 'No domain set')}
                  trailing={
                    <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                      inst.status === 'active'
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {inst.status}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Jump to" />
          <div className="space-y-2">
            {[
              { href: '/dashboard/admin/curriculum', icon: Layers, title: 'CMS', sub: 'Programmes, subjects and lessons' },
              { href: '/dashboard/admin/settings', icon: BarChart3, title: 'Pricing', sub: 'Plans, add-ons and currency' },
              { href: '/dashboard/admin/allocations', icon: Shield, title: 'Allocation', sub: 'Tiers, access and codes' },
              { href: '/dashboard/admin/institutions', icon: Building2, title: 'Institutions', sub: 'Schools and OEM' },
              { href: '/dashboard/helpdesk', icon: LifeBuoy, title: 'Helpdesk', sub: 'Support tickets' },
              { href: '/dashboard/admin/users', icon: Users, title: 'Users & Sparks', sub: 'Accounts, roles and grants' },
              ...(can(resolveStaffRole(profile), 'audit') ? [{ href: '/dashboard/admin/audit', icon: Shield, title: 'Audit', sub: 'Admin actions' }] : []),
            ].map(x => (
              <ListRow
                key={x.href}
                href={x.href}
                leading={<span className="w-9 h-9 rounded-xl bg-secondary grid place-items-center shrink-0"><x.icon className="w-4 h-4 text-primary" /></span>}
                title={x.title}
                subtitle={x.sub}
                trailing={<ArrowRight className="w-4 h-4 text-muted-foreground" />}
              />
            ))}
          </div>
        </Panel>
      </div>
    </DashPage>
  );
}
