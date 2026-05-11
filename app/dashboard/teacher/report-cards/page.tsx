'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, Course, getGradesForCourse, Grade } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileBarChart, Printer, Sparkles } from 'lucide-react';
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

const GRADE_COLORS = { A: 'bg-green-100 text-green-800', B: 'bg-blue-100 text-blue-800', C: 'bg-yellow-100 text-yellow-800', D: 'bg-orange-100 text-orange-800', F: 'bg-red-100 text-red-800' };

export default function ReportCardsPage() {
  const { user } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(cs => { setCourses(cs); if (cs.length) setSelectedCourse(cs[0].id); setLoading(false); });
  }, [user]);

  async function generateReports() {
    if (!selectedCourse) return;
    setGenerating(true);
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
    setGenerating(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  const selectedCourseName = courses.find(c => c.id === selectedCourse)?.title ?? '';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#202124]">Report Cards</h1>
          <p className="text-sm text-[#5F6368] mt-0.5">AI-generated report cards with grade summaries</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2 print:hidden">
          <Printer className="w-4 h-4" /> Print All
        </Button>
      </div>

      <div className="flex items-center gap-3 print:hidden">
        <Select value={selectedCourse} onValueChange={v => setSelectedCourse(v ?? '')}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select course" /></SelectTrigger>
          <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={generateReports} disabled={generating || !selectedCourse} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Reports
        </Button>
      </div>

      {reports.length === 0 && !generating && (
        <div className="text-center py-16 text-[#5F6368]">
          <FileBarChart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Select a course and generate reports</p>
          <p className="text-sm mt-1">AI will write personalised comments for each student.</p>
        </div>
      )}

      <div className="space-y-6 report-cards-container">
        {reports.map(r => (
          <div key={r.studentId} className="bg-white border border-[#DADCE0] rounded-2xl p-6 print:break-inside-avoid print:border print:shadow-none">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#DADCE0] pb-4 mb-4">
              <div>
                <p className="text-xs font-bold text-[#5F6368] uppercase tracking-wider">Pocket School · Report Card</p>
                <h2 className="text-xl font-bold text-[#202124] mt-1">{r.studentName}</h2>
                <p className="text-sm text-[#5F6368]">{selectedCourseName}</p>
              </div>
              <div className="text-right">
                <Badge className={`text-lg font-bold px-3 py-1 ${GRADE_COLORS[letterGrade(r.overall)] ?? ''}`}>
                  {letterGrade(r.overall)}
                </Badge>
                <p className="text-sm text-[#5F6368] mt-1">{r.overall.toFixed(1)}% overall</p>
              </div>
            </div>

            {/* Grade breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {Object.entries(r.avgByType).map(([type, d]) => (
                <div key={type} className="bg-[#F8F9FA] rounded-xl p-3 text-center">
                  <p className="text-xs text-[#5F6368] capitalize">{type}</p>
                  <p className="text-xl font-bold text-[#202124]">{d.avg.toFixed(0)}%</p>
                  <p className="text-[10px] text-gray-400">{d.count} assessment{d.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>

            {/* AI Comment */}
            <div className="bg-[#E8F0FE] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-bold text-blue-700">Teacher&apos;s Comment</p>
              </div>
              {r.loadingComment ? (
                <div className="flex items-center gap-2 text-sm text-blue-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating comment…</div>
              ) : (
                <p className="text-sm text-[#202124] italic">{r.comment || 'No comment generated.'}</p>
              )}
            </div>

            <p className="text-[10px] text-gray-400 mt-3">Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        ))}
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </motion.div>
  );
}
