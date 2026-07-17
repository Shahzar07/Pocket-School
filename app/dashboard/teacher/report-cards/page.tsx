'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, Course, getGradesForCourse, Grade, issueCertificate } from '@/lib/db';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, FileBarChart, Printer, Sparkles, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface StudentReport {
  studentId: string;
  studentName: string;
  grades: Grade[];
  avgByType: Record<string, { avg: number; count: number }>;
  overall: number;
  comment: string;
  loadingComment: boolean;
}

function letterGrade(pct: number) {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-600',
  B: 'bg-sky-500/10 text-sky-600',
  C: 'bg-amber-500/10 text-amber-600',
  D: 'bg-orange-500/10 text-orange-600',
  F: 'bg-red-500/10 text-red-600',
};

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1] as [number, number, number, number], delay: i * 0.08 },
  }),
};

export default function ReportCardsPage() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [issuingCert, setIssuingCert] = useState<string | null>(null);

  const [loadError, setLoadError] = useState(false);

  const loadCourses = () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    getTeacherCourses(user.uid)
      .then(cs => { setCourses(cs); if (cs.length) setSelectedCourse(cs[0].id); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCourses(); }, [user]);

  async function generateReports() {
    if (!selectedCourse) return;
    setGenerating(true);
    try {
      const grades = await getGradesForCourse(selectedCourse);
      const course = courses.find(c => c.id === selectedCourse);

      const byStudent: Record<string, { name: string; grades: Grade[] }> = {};
      for (const g of grades) {
        if (!byStudent[g.studentId]) byStudent[g.studentId] = { name: g.studentName, grades: [] };
        byStudent[g.studentId].grades.push(g);
      }

      const reps: StudentReport[] = Object.entries(byStudent).map(([id, d]) => {
        const byType: Record<string, number[]> = {};
        for (const g of d.grades) {
          if (!byType[g.type]) byType[g.type] = [];
          byType[g.type].push((g.score / g.maxScore) * 100);
        }
        const avgByType: Record<string, { avg: number; count: number }> = {};
        for (const [t, scores] of Object.entries(byType)) {
          avgByType[t] = { avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length };
        }
        const allScores = d.grades.map(g => (g.score / g.maxScore) * 100);
        const overall = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
        return { studentId: id, studentName: d.name, grades: d.grades, avgByType, overall, comment: '', loadingComment: false };
      });

      setReports(reps);
      if (reps.length === 0) {
        toast.info('No grades recorded for this course yet.');
      }

      // Generate AI comments
      for (let i = 0; i < reps.length; i++) {
        setReports(prev => prev.map((r, j) => j === i ? { ...r, loadingComment: true } : r));
        try {
          const res = await fetch('/api/ai/report-comment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentName: reps[i].studentName, courseTitle: course?.title, avgScore: reps[i].overall, submissionCount: reps[i].grades.length }),
          });
          const { comment } = await res.json();
          setReports(prev => prev.map((r, j) => j === i ? { ...r, comment, loadingComment: false } : r));
        } catch {
          setReports(prev => prev.map((r, j) => j === i ? { ...r, loadingComment: false } : r));
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to generate reports.');
    } finally {
      setGenerating(false);
    }
  }

  const handleIssueCert = async (r: StudentReport) => {
    if (!user) return;
    const course = courses.find(c => c.id === selectedCourse);
    if (!course) return;
    setIssuingCert(r.studentId);
    try {
      const uuid = await issueCertificate({
        studentId: r.studentId,
        studentName: r.studentName,
        courseId: selectedCourse,
        courseTitle: course.title,
        issuedAt: Timestamp.now(),
        issuedBy: user.uid,
        issuedByName: profile?.name ?? 'Teacher',
      });
      toast.success(`Certificate issued! ID: ${uuid.slice(0, 8)}…`);
    } catch { toast.error('Failed to issue certificate.'); }
    finally { setIssuingCert(null); }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10">
      <div className="flex items-center justify-center h-64">
        <div className="space-y-4 w-full max-w-2xl">
          <div className="bg-muted animate-pulse rounded-3xl h-40" />
          <div className="bg-muted animate-pulse rounded-3xl h-40" />
        </div>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="max-w-6xl mx-auto px-0 sm:px-2 pb-12">
      <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-4 card-glow">
        <FileBarChart className="w-10 h-10 mx-auto text-amber-500" />
        <p className="font-heading text-2xl text-foreground">Couldn&apos;t load your courses</p>
        <p className="text-sm text-muted-foreground">Something went wrong while fetching your data. Please try again.</p>
        <Button variant="outline" className="rounded-full h-11 px-5 font-semibold" onClick={loadCourses}>Retry</Button>
      </div>
    </div>
  );

  const selectedCourseName = courses.find(c => c.id === selectedCourse)?.title ?? '';

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="max-w-6xl mx-auto px-0 sm:px-2 pb-12 space-y-10"
    >
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">REPORT CARDS</p>
          <h1 className="font-heading text-4xl sm:text-5xl text-foreground tracking-tight">
            Student <span className="gradient-text italic">Reports</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">AI-generated report cards with grade summaries</p>
        </div>
        <Button
          onClick={() => window.print()}
          variant="outline"
          className="rounded-full gap-2 print:hidden"
        >
          <Printer className="w-4 h-4" /> Print All
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 print:hidden">
        <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
          <SelectTrigger className="w-56 rounded-full"><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
        <Button
          onClick={generateReports}
          disabled={generating || !selectedCourse}
          className="rounded-full h-11 px-5 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all gap-2"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Reports
        </Button>
      </div>

      {/* Empty state */}
      {reports.length === 0 && !generating && (
        <motion.div
          variants={fadeUp}
          custom={1}
          className="relative text-center py-20"
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>
          <FileBarChart className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
          <p className="font-heading text-2xl text-foreground">No reports yet</p>
          <p className="text-sm text-muted-foreground mt-1">Select a course and generate reports. AI will write personalised comments for each student.</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Grades appear here after you grade student submissions in the <span className="font-semibold text-foreground">Gradebook</span> — once a quiz is graded, its result is recorded and included in report cards.</p>
        </motion.div>
      )}

      {/* Report cards */}
      <div className="space-y-6 report-cards-container">
        {reports.map((r, idx) => (
          <motion.div
            key={r.studentId}
            variants={fadeUp}
            custom={idx}
            className="bg-card border border-border rounded-3xl p-6 card-glow print:break-inside-avoid print:border print:shadow-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Pocket School · Report Card</p>
                <h2 className="text-xl font-bold text-foreground mt-1">{r.studentName}</h2>
                <p className="text-sm text-muted-foreground">{selectedCourseName}</p>
              </div>
              <div className="text-right">
                <Badge className={`text-lg font-bold px-3 py-1 ${GRADE_COLORS[letterGrade(r.overall)] ?? ''}`}>
                  {letterGrade(r.overall)}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">{r.overall.toFixed(1)}% overall</p>
              </div>
            </div>

            {/* Grade breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {Object.entries(r.avgByType).map(([type, d]) => (
                <div key={type} className="bg-muted rounded-2xl p-3 text-center">
                  <p className="text-xs text-muted-foreground capitalize">{type}</p>
                  <p className="text-xl font-bold text-foreground">{d.avg.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">{d.count} assessment{d.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>

            {/* AI Comment */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-600">Teacher&apos;s Comment</p>
              </div>
              {r.loadingComment ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating comment...</div>
              ) : (
                <p className="text-sm text-foreground italic">{r.comment || 'No comment generated.'}</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <Button
                size="sm"
                onClick={() => handleIssueCert(r)}
                disabled={issuingCert === r.studentId}
                className="print:hidden rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white gap-1.5 text-xs font-bold"
              >
                {issuingCert === r.studentId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
                Issue Certificate
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </motion.div>
  );
}
