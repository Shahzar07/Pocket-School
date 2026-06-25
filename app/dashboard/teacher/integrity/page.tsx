'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getIntegrityReportsForTeacher, updateIntegrityReport, IntegrityReport } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1], delay: i * 0.08 },
  }),
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  clean: 'bg-emerald-500/10 text-emerald-700',
  suspicious: 'bg-amber-500/10 text-amber-700',
  violation: 'bg-red-500/10 text-red-700',
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-bold w-8 text-right">{value}%</span>
    </div>
  );
}

export default function IntegrityPage() {
  const { user } = useAuthSTORE();
  const [reports, setReports] = useState<IntegrityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getIntegrityReportsForTeacher(user.uid).then(r => { setReports(r); setLoading(false); });
  }, [user]);

  async function handleUpdate(id: string) {
    setSaving(id);
    try {
      await updateIntegrityReport(id, {
        status: (statuses[id] ?? reports.find(r => r.id === id)?.status) as IntegrityReport['status'],
        resolution: resolutions[id],
        reviewedBy: user?.uid,
      });
      toast.success('Report updated');
      setReports(await getIntegrityReportsForTeacher(user!.uid));
    } finally { setSaving(null); }
  }

  const stats = {
    total: reports.length,
    clean: reports.filter(r => r.status === 'clean').length,
    suspicious: reports.filter(r => r.status === 'suspicious').length,
    violation: reports.filter(r => r.status === 'violation').length,
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="space-y-4">
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
        <div className="bg-muted animate-pulse rounded-3xl h-24" />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Academic Integrity</p>
        <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight mt-1">
          Academic <span className="gradient-text italic">Integrity</span>
        </h1>
        <p className="text-muted-foreground mt-2">Review AI-detection and plagiarism reports for submitted work</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Reports', value: stats.total, accent: 'bg-emerald-500' },
          { label: 'Clean', value: stats.clean, accent: 'bg-green-500' },
          { label: 'Suspicious', value: stats.suspicious, accent: 'bg-amber-500' },
          { label: 'Violations', value: stats.violation, accent: 'bg-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-3xl p-5 sm:p-6 relative overflow-hidden card-glow text-center">
            <div className={`absolute top-0 left-0 right-0 h-1 ${s.accent}`} />
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {reports.length === 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="text-center py-20 relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>
          <Shield className="w-14 h-14 mx-auto mb-4 text-muted-foreground relative" />
          <p className="font-heading text-2xl text-foreground relative">No integrity reports yet</p>
          <p className="text-muted-foreground mt-2 relative">Integrity checks run when you click &quot;Check Integrity&quot; on a submission.</p>
        </motion.div>
      )}

      {reports.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Reports</p>
          <h2 className="font-heading text-3xl text-foreground tracking-tight mt-1">Review Submissions</h2>
        </div>
      )}

      <div className="space-y-5">
        {reports.map((r, idx) => (
          <motion.div
            key={r.id}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={idx + 2}
            className="bg-card border border-border rounded-3xl p-5 sm:p-6 card-glow space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{r.studentName}</p>
                  <Badge className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                  {r.aiScore >= 70 && <Badge className="bg-amber-500/10 text-amber-700">⚠ High AI Score</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{r.assignmentTitle ?? 'Unknown assignment'} · {(r.createdAt as any)?.toDate?.().toLocaleDateString()}</p>
              </div>
              <AlertTriangle className={`w-5 h-5 shrink-0 ${r.status === 'violation' ? 'text-red-500' : r.status === 'suspicious' ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">AI Detection Score</p>
                <ScoreBar value={r.aiScore} color={r.aiScore >= 70 ? 'bg-red-500' : r.aiScore >= 40 ? 'bg-yellow-400' : 'bg-green-500'} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Plagiarism Score</p>
                <ScoreBar value={r.plagiarismScore} color={r.plagiarismScore >= 70 ? 'bg-red-500' : r.plagiarismScore >= 40 ? 'bg-yellow-400' : 'bg-green-500'} />
              </div>
            </div>

            {r.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.flags.map((f, i) => <Badge key={i} className="bg-muted text-muted-foreground text-xs">{f}</Badge>)}
              </div>
            )}

            {r.contentSnippet && (
              <div className="bg-muted rounded-2xl p-3 text-xs text-muted-foreground line-clamp-3">{r.contentSnippet}</div>
            )}

            <p className="text-xs text-muted-foreground"><span className="font-semibold">Recommendation:</span> {r.recommendation}</p>

            <div className="border-t border-border pt-4 flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Add resolution note…"
                  value={resolutions[r.id] ?? r.resolution ?? ''}
                  onChange={e => setResolutions(p => ({ ...p, [r.id]: e.target.value }))}
                  rows={2}
                />
                <Select value={statuses[r.id] ?? r.status} onValueChange={v => setStatuses(p => ({ ...p, [r.id]: v ?? '' }))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="clean">Clean</SelectItem>
                    <SelectItem value="suspicious">Suspicious</SelectItem>
                    <SelectItem value="violation">Violation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => handleUpdate(r.id)}
                disabled={saving === r.id}
                className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 shrink-0 gap-1"
              >
                {saving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Update
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
