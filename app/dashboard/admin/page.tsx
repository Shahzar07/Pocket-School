'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getPlatformStats, getInstitutions, seedDemoData, Institution } from '@/lib/db';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Users, BookOpen, Sparkles, CheckCircle2, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user, profile } = useAuthSTORE();
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

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-heading text-3xl text-foreground tracking-tight">
            Admin Portal
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Platform analytics and management.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!seeded && (
            <Button
              onClick={handleSeedData}
              disabled={seeding}
              className="rounded-xl gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
            >
              <Sparkles className="w-4 h-4" />
              {seeding ? 'Seeding Demo Data…' : 'Seed Demo Data'}
            </Button>
          )}
          {seeded && (
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <CheckCircle2 className="w-4 h-4" /> Demo data seeded!
            </div>
          )}
          <Link href="/dashboard/admin/institutions" className={buttonVariants({ variant: 'outline' }) + ' rounded-xl gap-2'}>
            <Building2 className="w-4 h-4" /> Institutions
          </Link>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Students', value: stats.students, icon: <Users className="w-5 h-5 text-blue-500" />, color: 'bg-blue-50 border-blue-200' },
          { label: 'Teachers', value: stats.teachers, icon: <BarChart3 className="w-5 h-5 text-violet-500" />, color: 'bg-violet-50 border-violet-200' },
          { label: 'Published Courses', value: stats.courses, icon: <BookOpen className="w-5 h-5 text-emerald-500" />, color: 'bg-emerald-50 border-emerald-200' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`${s.color} border rounded-2xl p-5 text-center`}
          >
            <div className="flex justify-center mb-2">{s.icon}</div>
            <p className="font-heading text-2xl text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Seed Data Info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Demo Data Seeder</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Click <strong>Seed Demo Data</strong> to populate the platform with 2 complete demo courses (Biology 101 + World History) with pre-generated AI lesson content. New students are automatically enrolled. Run this once to give the platform real content.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Institutions Quick View */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Institutions</h2>
          <Link href="/dashboard/admin/institutions" className="text-sm text-primary hover:underline">
            Manage all →
          </Link>
        </div>
        {institutions.length === 0 ? (
          <div className="text-center py-10 bg-muted/30 rounded-2xl border border-dashed border-border">
            <Building2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground font-medium">No institutions yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {institutions.slice(0, 5).map((inst, i) => (
              <motion.div key={inst.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{inst.name}</p>
                  <p className="text-xs text-muted-foreground">{inst.domain || 'No domain set'}</p>
                </div>
                <Badge className={`rounded-full text-[10px] shrink-0 ${inst.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {inst.status}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
