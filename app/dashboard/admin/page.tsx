'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getPlatformStats, getInstitutions, seedDemoData, Institution } from '@/lib/db';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';
import { Building2, Users, BookOpen, Sparkles, CheckCircle2, BarChart3, ArrowRight, Layers, Shield } from 'lucide-react';
import Link from 'next/link';

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
    <div className="max-w-6xl mx-auto px-0 sm:px-2 py-2 space-y-5">
      <div className="h-24 bg-muted animate-pulse rounded-3xl" />
      <div className="h-64 bg-muted animate-pulse rounded-[2rem]" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">

      {/* ── Greeting ── */}
      <motion.header variants={fadeUp} initial="hidden" animate="visible" custom={0}
        className="pt-2 flex flex-col lg:flex-row lg:items-end justify-between gap-6"
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600 flex items-center gap-2">
            <span className="w-5 h-px bg-violet-600 inline-block" /> Command center · {today}
          </p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-3">
            Platform <span className="gradient-text italic">overview</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px]">Everything happening across Pocket School, live.</p>
        </div>
        <div className="flex gap-3 flex-wrap shrink-0">
          {!seeded ? (
            <Button
              onClick={handleSeedData}
              disabled={seeding}
              className="rounded-full h-11 px-5 gap-2 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white"
            >
              <Sparkles className="w-4 h-4" />
              {seeding ? 'Seeding…' : 'Seed Demo Data'}
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-full px-5 h-11">
              <CheckCircle2 className="w-4 h-4" /> Demo data seeded
            </div>
          )}
          <Link href="/dashboard/admin/institutions" className={buttonVariants({ variant: 'outline' }) + ' rounded-full h-11 px-5 gap-2 font-semibold'}>
            <Building2 className="w-4 h-4" /> Institutions
          </Link>
        </div>
      </motion.header>

      {/* ── Platform pulse — dark stat band ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}
        className="relative bg-[#070B14] rounded-[2rem] p-7 sm:p-9 overflow-hidden border border-white/[0.06]"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="blob-1 absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#1A73E8]/20 blur-[90px]" />
          <div className="blob-2 absolute -bottom-28 -right-16 w-80 h-80 rounded-full bg-[#7C3AED]/20 blur-[90px]" />
        </div>
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 mb-6">Platform pulse</p>
          <div className="grid grid-cols-3 gap-6 sm:gap-10">
            {[
              { label: 'Students', value: stats.students, icon: Users, glow: 'text-[#60A5FA]' },
              { label: 'Teachers', value: stats.teachers, icon: BarChart3, glow: 'text-violet-400' },
              { label: 'Total Courses', value: stats.courses, icon: BookOpen, glow: 'text-emerald-400' },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.12 }}
              >
                <s.icon className={`w-5 h-5 ${s.glow} mb-3`} />
                <p className="font-heading text-5xl sm:text-6xl text-white leading-none">{s.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-2.5 font-semibold uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Quick actions ── */}
      <div className="grid sm:grid-cols-3 gap-5">
        {[
          { icon: Layers, title: 'Curriculum CMS', desc: 'Build, review and publish curriculum content.', href: '/dashboard/admin/curriculum', accent: 'text-[#1A73E8]', bar: 'bg-[#1A73E8]' },
          { icon: Shield, title: 'Access Config', desc: 'Manage roles, subscriptions and permissions.', href: '/dashboard/admin/access', accent: 'text-violet-600', bar: 'bg-violet-500' },
          { icon: BookOpen, title: 'All Courses', desc: 'Approve, audit and manage the course catalogue.', href: '/dashboard/admin/courses', accent: 'text-emerald-600', bar: 'bg-emerald-500' },
        ].map((item, i) => (
          <motion.div key={item.title} variants={fadeUp} initial="hidden" animate="visible" custom={2 + i}>
            <Link href={item.href}
              className="group block bg-card border border-border rounded-3xl p-6 relative overflow-hidden card-glow h-full"
            >
              <span className={`absolute top-0 left-6 right-6 h-[3px] rounded-b-full ${item.bar} opacity-80`} />
              <item.icon className={`w-5 h-5 ${item.accent}`} />
              <p className="font-heading text-2xl text-foreground mt-3 group-hover:text-primary transition-colors">{item.title}</p>
              <p className="text-[13px] text-muted-foreground mt-1.5">{item.desc}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-4 flex items-center gap-1.5 group-hover:text-primary transition-colors">
                Open <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Seeder info ── */}
      {!seeded && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}
          className="relative bg-card border border-violet-500/25 rounded-[2rem] p-6 sm:p-7 overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-violet-500/10 blur-[60px]" />
          <div className="relative flex items-start gap-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-heading text-xl text-foreground">Demo data seeder</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Click <strong className="text-foreground">Seed Demo Data</strong> to populate the platform with 2 complete demo courses (Biology 101 + World History) with pre-generated AI lesson content. Students can then enrol from the marketplace. Run this once to give the platform real content.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Institutions ── */}
      <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={6}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Organizations</p>
            <h2 className="font-heading text-3xl text-foreground mt-1.5">Institutions</h2>
          </div>
          <Link href="/dashboard/admin/institutions" className="text-sm text-primary font-semibold hover:underline flex items-center gap-1 shrink-0 pb-1">
            Manage all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {institutions.length === 0 ? (
          <div className="relative text-center py-14 bg-card rounded-[2rem] border border-border overflow-hidden">
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-violet-500/8 blur-[80px]" />
            <Building2 className="w-11 h-11 mx-auto mb-3 text-violet-600/40" />
            <h3 className="font-heading text-2xl text-foreground mb-1.5">No institutions yet</h3>
            <p className="text-sm text-muted-foreground">Onboard your first school to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {institutions.slice(0, 5).map((inst, i) => (
              <motion.div key={inst.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 card-glow"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1A73E8] to-[#7C3AED] flex items-center justify-center shrink-0 text-white font-bold shadow-md">
                  {inst.name?.charAt(0)?.toUpperCase() ?? 'I'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{inst.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{inst.domain || 'No domain set'}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0 ${inst.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                  {inst.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
