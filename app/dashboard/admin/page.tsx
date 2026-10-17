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
import { SeeMore } from '@/components/shell/see-more';
import { friendlyError } from '@/lib/design/system';

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
      toast.error(friendlyError(e));
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
          <Link
            href="/dashboard/admin/users"
            className={buttonVariants() + ' h-10 px-4 rounded-xl font-semibold text-[13px] gap-2'}
          >
            <Users className="w-3.5 h-3.5" /> Review accounts
          </Link>
        }
      />

      <Panel>
        <PanelHeader title="Today" />
        <p className="text-sm text-muted-foreground">
          {kpis.openTickets
            ? `${kpis.openTickets} support conversation${kpis.openTickets === 1 ? '' : 's'} still open. Review accounts first, then the course builder.`
            : 'No support conversations are waiting. Review accounts if someone new has signed up.'}
        </p>
      </Panel>

      {/* ── Platform stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          index={0} icon={Users} label="Students" value={stats.students.toLocaleString()} tone="sky"
          href="/dashboard/admin/users" hrefLabel="Manage users"
        />
        <StatCard
          index={1} icon={Shield} label="Teachers" value={stats.teachers.toLocaleString()} tone="violet"
          href="/dashboard/admin/users" hrefLabel="Manage users"
        />
        <StatCard
          index={2} icon={BookOpen} label="Courses" value={stats.courses.toLocaleString()} tone="teal"
          href="/dashboard/admin/courses" hrefLabel="All courses"
        />
        <StatCard
          index={3} icon={Building2} label="Institutions" value={institutions.length.toLocaleString()} tone="amber"
          href="/dashboard/admin/institutions" hrefLabel="View institutions"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard size="compact" index={0} icon={Users} tone="sky" label="Signups, 30 days" value={kpis.signups30.toLocaleString()} trend={kpis.signups30 > 0 ? { direction: 'up', label: 'New accounts' } : { direction: 'flat', label: 'Quiet' }} />
        <StatCard size="compact" index={1} icon={Activity} tone="emerald" label="Active, 7 days" value={kpis.active7.toLocaleString()} trend={kpis.active7 > 0 ? { direction: 'up', label: 'On the platform' } : { direction: 'flat', label: 'Quiet' }} />
        <StatCard size="compact" index={2} icon={BarChart3} tone="amber" label="Revenue recorded" value={`$${kpis.revenue.toLocaleString()}`} />
        <StatCard size="compact" index={3} icon={Sparkles} tone="coral" label="Sparks in circulation" value={(kpis.sparksIssued - kpis.sparksSpent).toLocaleString()} />
        <StatCard size="compact" index={4} icon={Sparkles} tone="coral" label="Sparks spent" value={kpis.sparksSpent.toLocaleString()} trend={kpis.sparksSpent > 0 ? { direction: 'down', label: 'Used' } : { direction: 'flat', label: 'None spent' }} />
        <StatCard size="compact" index={5} icon={CheckCircle2} tone="emerald" label="Course completions" value={kpis.completions.toLocaleString()} trend={kpis.completions > 0 ? { direction: 'up', label: 'Finished' } : { direction: 'flat', label: 'None yet' }} />
        <StatCard size="compact" index={6} icon={LifeBuoy} tone="violet" label="Open tickets" value={kpis.openTickets.toLocaleString()} trend={kpis.openTickets > 0 ? { direction: 'down', label: 'Needs a reply' } : { direction: 'up', label: 'Clear' }} />
        <StatCard size="compact" index={7} icon={Sparkles} tone="amber" label="Sparks issued" value={kpis.sparksIssued.toLocaleString()} />
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
              { href: '/dashboard/admin/placement', icon: Layers, title: 'Course placement', sub: 'Marketplace, featured spots, and levels' },
              { href: '/dashboard/admin/help', icon: LifeBuoy, title: 'Help articles', sub: 'What ET AI answers from' },
              { href: '/dashboard/admin/settings', icon: BarChart3, title: 'Pricing', sub: 'Plans, add-ons and currency' },
              { href: '/dashboard/admin/institution-pricing', icon: Building2, title: 'Institution prices', sub: 'Programmes, seats and tiers' },
              { href: '/dashboard/admin/allocations', icon: Shield, title: 'Allocation', sub: 'Tiers, access and codes' },
              { href: '/dashboard/admin/institutions', icon: Building2, title: 'Institutions', sub: 'Schools and OEM' },
              { href: '/dashboard/helpdesk', icon: LifeBuoy, title: 'Helpdesk', sub: 'Support tickets' },
              { href: '/dashboard/admin/users', icon: Users, title: 'Users & Sparks', sub: 'Accounts, roles and grants' },
              ...(can(resolveStaffRole(profile), 'audit') ? [
                { href: '/dashboard/admin/activity', icon: Shield, title: 'Activity log', sub: 'Sign-ins, edits, and view-as' },
                { href: '/dashboard/admin/audit', icon: Shield, title: 'Audit', sub: 'Admin actions' },
              ] : []),
              { href: '/dashboard/admin/certificates', icon: Shield, title: 'Certificates', sub: 'Open Badges and class issuance' },
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
      <SeeMore label="Demo content and extra tools">
        <Button
          variant="outline"
          onClick={handleSeedData}
          disabled={seeding || seeded}
          className="h-10 px-4 rounded-xl font-semibold text-[13px] gap-2"
        >
          {seeded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {seeded ? 'Demo data added' : seeding ? 'Adding…' : 'Add demo courses'}
        </Button>
      </SeeMore>
    </DashPage>
  );
}
