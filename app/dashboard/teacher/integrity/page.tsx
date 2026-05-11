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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  clean: 'bg-green-100 text-green-700',
  suspicious: 'bg-yellow-100 text-yellow-800',
  violation: 'bg-red-100 text-red-700',
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#202124]">Academic Integrity</h1>
        <p className="text-sm text-[#5F6368] mt-0.5">Review AI-detection and plagiarism reports for submitted work</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: stats.total, color: 'text-[#202124]', bg: 'bg-white' },
          { label: 'Clean', value: stats.clean, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Suspicious', value: stats.suspicious, color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'Violations', value: stats.violation, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-[#DADCE0] p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[#5F6368] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {reports.length === 0 && (
        <div className="text-center py-16 text-[#5F6368]">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No integrity reports yet</p>
          <p className="text-sm mt-1">Integrity checks run when you click "Check Integrity" on a submission.</p>
        </div>
      )}

      <div className="space-y-4">
        {reports.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-[#DADCE0] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#202124]">{r.studentName}</p>
                  <Badge className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                  {r.aiScore >= 70 && <Badge className="bg-orange-100 text-orange-700">⚠ High AI Score</Badge>}
                </div>
                <p className="text-xs text-[#5F6368] mt-0.5">{r.assignmentTitle ?? 'Unknown assignment'} · {(r.createdAt as any)?.toDate?.().toLocaleDateString()}</p>
              </div>
              <AlertTriangle className={`w-5 h-5 shrink-0 ${r.status === 'violation' ? 'text-red-500' : r.status === 'suspicious' ? 'text-yellow-500' : 'text-gray-300'}`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[#5F6368] mb-1">AI Detection Score</p>
                <ScoreBar value={r.aiScore} color={r.aiScore >= 70 ? 'bg-red-500' : r.aiScore >= 40 ? 'bg-yellow-400' : 'bg-green-500'} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#5F6368] mb-1">Plagiarism Score</p>
                <ScoreBar value={r.plagiarismScore} color={r.plagiarismScore >= 70 ? 'bg-red-500' : r.plagiarismScore >= 40 ? 'bg-yellow-400' : 'bg-green-500'} />
              </div>
            </div>

            {r.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.flags.map((f, i) => <Badge key={i} className="bg-gray-100 text-gray-600 text-xs">{f}</Badge>)}
              </div>
            )}

            {r.contentSnippet && (
              <div className="bg-[#F8F9FA] rounded-lg p-3 text-xs text-[#5F6368] line-clamp-3">{r.contentSnippet}</div>
            )}

            <p className="text-xs text-[#5F6368]"><span className="font-semibold">Recommendation:</span> {r.recommendation}</p>

            <div className="border-t border-[#DADCE0] pt-4 flex items-end gap-3">
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
              <Button onClick={() => handleUpdate(r.id)} disabled={saving === r.id} className="bg-teal-600 hover:bg-teal-700 text-white shrink-0 gap-1">
                {saving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Update
              </Button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
