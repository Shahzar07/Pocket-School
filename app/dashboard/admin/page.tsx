'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getPlatformStats, getInstitutions, seedDemoData, Institution } from '@/lib/db';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';
import { Building2, Users, BookOpen, Sparkles, CheckCircle2, BarChart3, ArrowRight, Layers, Shield } from 'lucide-react';
import Link from 'next/link';
import {
  DashPage, DashHeader, Panel, PanelHeader, StatCard, ListRow, Initials, EmptyState,
} from '@/components/dash-ui';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 } }),
};

export default function AdminDashboard() {
  const { user } = useAuthSTORE();
  const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0 });
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getPlatformStats(), getInstitutions()]).then(([s, inst]) => {
      setStats(s);
      setInstitutions(inst);
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
              { href: '/dashboard/admin/curriculum', icon: Layers, title: 'Curriculum CMS', sub: 'Programmes, subjects and lessons' },
              { href: '/dashboard/admin/courses', icon: BookOpen, title: 'All courses', sub: 'Approve, publish and seed' },
              { href: '/dashboard/admin/users', icon: Users, title: 'Users & Sparks', sub: 'Accounts, status and grants' },
              { href: '/dashboard/admin/allocations', icon: Shield, title: 'Access & coupons', sub: 'Tiers, allocations, codes' },
              { href: '/dashboard/admin/settings', icon: BarChart3, title: 'System settings', sub: 'Platform configuration' },
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
