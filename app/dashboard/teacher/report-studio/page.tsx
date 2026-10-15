'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getGradesForCourse, getTeacherCourses, type Course, type Grade } from '@/lib/db';
import { authedFetch } from '@/lib/api-client';
import { DashHeader, DashPage, Panel } from '@/components/dash-ui';
import { Button } from '@/components/ui/button';
import { saveReportCard } from '@/lib/insights/client';
import { buildPdf } from '@/lib/insights/pdf';
import { copyrightLine } from '@/lib/insights/copyright';
import { downloadBytes } from '@/components/insights/boards';
import {
  REPORT_TEMPLATES, gradeOnScale, newVerificationToken, publicCard, publishFields, scaleById,
} from '@/lib/insights/report-cards';
import { TERMS, termRange, type TermId } from '@/lib/reporting-periods';
import { toast } from 'sonner';

interface Row {
  studentId: string;
  studentName: string;
  percent: number;
  count: number;
  comment: string;
}

export default function ReportStudioPage() {
  const { user, profile } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [term, setTerm] = useState<TermId>('t4');
  const [year, setYear] = useState(2026);
  const [templateId, setTemplateId] = useState('igcse');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastToken, setLastToken] = useState('');

  useEffect(() => {
    if (!user) return;
    getTeacherCourses(user.uid).then(list => {
      setCourses(list);
      setCourseId(current => current || list[0]?.id || '');
    }).catch(() => setCourses([]));
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    getGradesForCourse(courseId).then(setGrades).catch(() => setGrades([]));
  }, [courseId]);

  const template = REPORT_TEMPLATES.find(item => item.id === templateId) ?? REPORT_TEMPLATES[2];
  const scale = scaleById(template.scaleId);
  const course = courses.find(item => item.id === courseId);

  const built = useMemo(() => {
    const range = termRange(term, year);
    const grouped = new Map<string, { name: string; scores: number[] }>();
    for (const grade of grades) {
      const at = grade.gradedAt?.toDate?.();
      if (range && at && (at < range[0] || at > range[1])) continue;
      const percent = grade.maxScore ? (100 * grade.score) / grade.maxScore : 0;
      const current = grouped.get(grade.studentId) ?? { name: grade.studentName || 'Student', scores: [] };
      current.scores.push(percent);
      grouped.set(grade.studentId, current);
    }
    return [...grouped.entries()].map(([studentId, value]) => ({
      studentId,
      studentName: value.name,
      percent: Math.round(value.scores.reduce((a, b) => a + b, 0) / value.scores.length),
      count: value.scores.length,
      comment: '',
    }));
  }, [grades, term, year]);

  useEffect(() => { setRows(built); }, [built]);

  const draftComment = async (row: Row) => {
    try {
      const body = await authedFetch('/api/ai/report-comment', {
        method: 'POST',
        body: JSON.stringify({
          studentName: row.studentName,
          courseTitle: course?.title ?? 'Course',
          avgScore: row.percent,
          submissionCount: row.count,
          period: TERMS.find(item => item.id === term)?.label ?? term,
        }),
      });
      const comment = typeof body.comment === 'string' ? body.comment : row.comment;
      setRows(current => current.map(item => item.studentId === row.studentId ? { ...item, comment } : item));
    } catch {
      toast.error('The comment draft needs a signed-in teacher with AI access.');
    }
  };

  const publishOne = async (row: Row) => {
    if (!user || !course) return;
    const token = newVerificationToken();
    const draft = publishFields({
      studentId: row.studentId,
      studentName: row.studentName,
      courseId: course.id,
      courseTitle: course.title,
      termId: term,
      year,
      percent: row.percent,
      scaleId: scale.id,
      templateId: template.id,
      comment: row.comment,
      commentSource: row.comment ? 'ai_draft' : 'teacher',
      teacherId: user.uid,
      institutionId: profile?.institutionId,
    }, token);
    const published = publicCard(draft);
    await saveReportCard(`${row.studentId}_${course.id}_${term}_${year}`, { ...draft, teacherName: profile?.name ?? 'Teacher' }, published);
    setLastToken(token);
    return token;
  };

  const publishAll = async () => {
    setBusy(true);
    try {
      for (const row of rows) await publishOne(row);
      toast.success(`Published ${rows.length} report ${rows.length === 1 ? 'card' : 'cards'}. Parents can acknowledge them.`);
    } catch {
      toast.error('Publishing stopped. Check that you can write report cards.');
    } finally {
      setBusy(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://poketschool.ai';

  return (
    <DashPage>
      <DashHeader
        eyebrow="Report cards"
        title="Term studio"
        accent={template.heading}
        description="Pick a template and scale, draft a comment, then publish. The public card shows the grade and a verification link. Comments stay on the private card."
      />
      <div className="flex flex-wrap gap-3">
        <select className="h-10 rounded-xl border border-border bg-card px-3" value={courseId} onChange={event => setCourseId(event.target.value)} aria-label="Course">
          {courses.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <select className="h-10 rounded-xl border border-border bg-card px-3" value={term} onChange={event => setTerm(event.target.value as TermId)} aria-label="Term">
          {TERMS.filter(item => item.id !== 'custom').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <input className="h-10 w-24 rounded-xl border border-border bg-card px-3" type="number" value={year} onChange={event => setYear(Number(event.target.value) || year)} aria-label="Year" />
        <select className="h-10 rounded-xl border border-border bg-card px-3" value={templateId} onChange={event => setTemplateId(event.target.value)} aria-label="Template">
          {REPORT_TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Scale: {scale.label}. Bands are a school template, not an exam board boundary.</p>
      {rows.map(row => (
        <Panel key={row.studentId}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{row.studentName}</p>
              <p className="text-sm text-muted-foreground">{row.percent}% · grade {gradeOnScale(row.percent, scale)} · {row.count} records</p>
            </div>
            <Button type="button" variant="outline" onClick={() => draftComment(row)}>Draft comment</Button>
          </div>
          <textarea
            className="mt-3 w-full rounded-xl border border-border bg-muted/30 p-3 text-sm"
            rows={3}
            value={row.comment}
            onChange={event => setRows(current => current.map(item => item.studentId === row.studentId ? { ...item, comment: event.target.value } : item))}
            placeholder="Teacher comment. An AI draft stays editable."
          />
        </Panel>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No graded records in this term yet.</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" disabled={busy || rows.length === 0} onClick={publishAll}>{busy ? 'Publishing…' : 'Publish all'}</Button>
        {lastToken && (
          <Button type="button" variant="outline" onClick={() => {
            const yearNow = new Date().getFullYear();
            downloadBytes(
              'report-card.pdf',
              buildPdf('Poket School report card', [
                `${course?.title ?? 'Course'} · ${term} ${year}`,
                `Verify: ${origin}/verify/report/${lastToken}`,
                copyrightLine(yearNow),
              ], yearNow),
              'application/pdf',
            );
          }}>Download PDF</Button>
        )}
      </div>
      {lastToken && (
        <Panel>
          <p className="text-sm font-semibold mb-2">Verification QR</p>
          <QRCodeSVG value={`${origin}/verify/report/${lastToken}`} size={128} />
          <p className="text-xs text-muted-foreground mt-2">{copyrightLine(new Date().getFullYear())}</p>
        </Panel>
      )}
    </DashPage>
  );
}
