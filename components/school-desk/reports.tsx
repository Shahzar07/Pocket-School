'use client';

import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { buildPdf } from '@/lib/insights/pdf';
import {
  SCALE_LABEL, acknowledgeReport, attendanceRate, buildReport, draftReportComment, gradeSetLabel, reportLines, roster, saveReport, termResult,
  type ReportCard,
} from '@/lib/school-desk/model';
import { ClassSelect, DeskFrame, DeskLinks, deskStyles, resetToDemo, useDesk } from './ui';

const TEMPLATES = ['report', 'progress', 'class', 'attendance', 'engagement', 'goals', 'exam'] as const;

export function ReportCardDesk({ base = 'dashboard' }: { base?: 'dashboard' | 'preview' }) {
  const { state, setState } = useDesk();
  const [classId, setClassId] = useState('class-maths');
  const [studentId, setStudentId] = useState('stu-amina');
  const [report, setReport] = useState<ReportCard | null>(null);
  const klass = state.classes.find((item) => item.id === classId) ?? state.classes[0];
  const activeId = klass?.id ?? '';
  const pupils = roster(state, activeId).filter((item) => item.status === 'active');
  const current = report && report.classId === activeId && report.studentId === studentId
    ? report
    : buildReport(state, activeId, studentId);
  const result = termResult(state, activeId, studentId);
  const rate = attendanceRate(state.attendance.filter((item) => item.classId === activeId && item.studentId === studentId));
  const goals = state.goals.filter((item) => item.classId === activeId && item.studentId === studentId);
  const done = goals.filter((item) => item.status === 'completed').length;
  const merits = state.merits.filter((item) => item.studentId === studentId).reduce((sum, item) => sum + item.points, 0);
  const bloom = useMemo(() => {
    const kinds = state.assessments.filter((item) => item.classId === activeId);
    const score = (kind: string) => {
      const assessment = kinds.find((item) => item.kind === kind);
      if (!assessment) return 0;
      const mark = state.marks.find((item) => item.assessmentId === assessment.id && item.studentId === studentId && item.points != null);
      return mark && assessment.maxPoints ? Math.round((mark.points! / assessment.maxPoints) * 100) : 0;
    };
    return [
      [t.bloomRemember, score('lesson_quiz')],
      [t.bloomApply, score('assignment')],
      [t.bloomAnalyse, score('test')],
    ];
  }, [state, activeId, studentId]);

  const patch = (partial: Partial<ReportCard>) => {
    if (!current) return;
    setReport({ ...current, ...partial });
  };

  const store = (status: ReportCard['status']) => {
    if (!current) return;
    const next = { ...current, status };
    setReport(next);
    setState(saveReport(state, next, state.actorName));
  };

  const pdf = () => {
    if (!current) return;
    const bytes = buildPdf(t.reportTitle, reportLines(state, current), 2026);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const url = URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${current.studentName}-report.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DeskFrame title={t.reportTitle} lede={t.reportLede} state={state} onReset={() => resetToDemo(setState)} syncs="Parent account, PDF, verification QR, gradebook, attendance, goals">
      <DeskLinks base={base} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ClassSelect state={state} classId={activeId} onChange={(id) => { setClassId(id); setReport(null); }} />
        <label className="text-sm text-[#1E6A83]">{t.drill}
          <select className={`${deskStyles.field} mt-1 w-full`} value={studentId} onChange={(event) => { setStudentId(event.target.value); setReport(null); }} aria-label={t.drill}>
            {pupils.map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName}</option>)}
          </select>
        </label>
      </div>
      {current && klass ? (
        <article className="rounded-3xl bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83]">{state.institution.name}</p>
          <h2 className="font-heading text-3xl">{current.studentName}</h2>
          <p className="text-sm text-[#1E6A83]">{klass.name} · {current.level} · {current.term} · {state.institution.branding}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <p className="rounded-2xl bg-[#f4f7f8] p-3 text-sm sm:col-span-4" data-grade-set={result.percent}>{gradeSetLabel(result.percent)}</p>
            <p className="rounded-2xl bg-[#f4f7f8] p-3 text-sm">{SCALE_LABEL[state.institution.defaultScale]}<span className="mt-1 block font-heading text-3xl text-[#203337]">{result.grade}</span></p>
            <p className="rounded-2xl bg-[#f4f7f8] p-3 text-sm">{t.percent}<span className="mt-1 block font-heading text-3xl text-[#203337]">{result.percent}%</span></p>
            <p className="rounded-2xl bg-[#f4f7f8] p-3 text-sm">{t.effort}<span className="mt-1 block font-heading text-3xl text-[#203337]">{current.effort}/5</span></p>
            <p className="rounded-2xl bg-[#f4f7f8] p-3 text-sm">{t.tabs.attendance}<span className="mt-1 block font-heading text-3xl text-[#203337]">{rate}%</span></p>
          </div>
          <ul className="mt-4 text-sm text-[#1E6A83]">
            {bloom.map(([label, value]) => <li key={label}>{label}: {value}%</li>)}
            <li>{t.merits}: {merits}</li>
            <li>{t.goalsTitle}: {done}/{goals.length}</li>
          </ul>
          <label className="mt-4 block text-sm text-[#1E6A83]">{t.comment}
            <textarea className="mt-1 h-24 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-[#203337]" value={current.subjectComment} onChange={(event) => patch({ subjectComment: event.target.value })} aria-label={t.comment} />
          </label>
          <label className="mt-3 block text-sm text-[#1E6A83]">{t.formTeacher}
            <textarea className="mt-1 h-16 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-[#203337]" value={current.formComment} onChange={(event) => patch({ formComment: event.target.value })} aria-label={t.formTeacher} />
          </label>
          <label className="mt-3 block text-sm text-[#1E6A83]">{t.principal}
            <textarea className="mt-1 h-16 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-[#203337]" value={current.principalComment} onChange={(event) => patch({ principalComment: event.target.value })} aria-label={t.principal} />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" data-action="draft-comment" className={deskStyles.ghost} onClick={() => patch({ subjectComment: draftReportComment(current.studentName, klass.subject, result.grade, rate, done, goals.length) })}>{t.draftComment}</button>
            <button type="button" className={deskStyles.ghost} onClick={() => {
              let next = state;
              for (const pupil of pupils) {
                const card = buildReport(next, activeId, pupil.studentId);
                if (card) next = saveReport(next, { ...card, status: 'draft' }, state.actorName);
              }
              setState(next);
            }}>{t.bulk}</button>
            <button type="button" className={deskStyles.ghost} onClick={() => store('draft')}>{t.save}</button>
            <button type="button" data-action="publish-report" className={deskStyles.btn} onClick={() => store('published')}>{t.publish}</button>
            <button type="button" className={deskStyles.ghost} onClick={pdf}>{t.downloadPdf}</button>
            <QRCodeSVG value={`https://poketschool.ai/verify/report/${current.token}`} size={72} />
          </div>
          <p className="mt-3 text-sm text-[#1E6A83]">{current.status} · {current.acknowledgement}</p>
        </article>
      ) : null}
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-heading text-2xl">{t.parentView}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {state.reports.filter((item) => item.status === 'published').map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{item.studentName} · {item.acknowledgement}</span>
              <button type="button" data-action="ack" className={deskStyles.btn} onClick={() => setState(acknowledgeReport(state, item.id))}>{t.acknowledge}</button>
            </li>
          ))}
        </ul>
      </section>
    </DeskFrame>
  );
}

export function StudioDesk({ base = 'dashboard' }: { base?: 'dashboard' | 'preview' }) {
  const { state, setState } = useDesk();
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]>('report');
  const [scope, setScope] = useState('class');
  const [from, setFrom] = useState('2026-09-01');
  const [to, setTo] = useState('2026-10-18');
  const [ready, setReady] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const klass = state.classes[0];
  const pupils = klass ? roster(state, klass.id).filter((item) => item.status === 'active') : [];
  const rows = pupils.map((pupil) => {
    const result = termResult(state, klass.id, pupil.studentId);
    const rate = attendanceRate(state.attendance.filter((item) => item.studentId === pupil.studentId));
    const goals = state.goals.filter((item) => item.studentId === pupil.studentId);
    const done = goals.filter((item) => item.status === 'completed').length;
    return { name: pupil.studentName, result, rate, done, total: goals.length };
  });

  return (
    <DeskFrame title={t.studioTitle} lede={t.studioLede} state={state} onReset={() => { resetToDemo(setState); setReady(false); }} syncs="PDF, CSV, weekly parent schedule, report cards">
      <DeskLinks base={base} />
      <section className="rounded-3xl bg-white p-5 text-sm text-[#1E6A83]">
        <p className="text-[#203337]">{t.studioDiff}</p>
        <h2 className="mt-4 font-heading text-2xl text-[#203337]">{t.stepsTitle}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
        </ol>
        <p className="mt-3">{t.examples}</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-[#1E6A83]">{t.template}
          <select className={`${deskStyles.field} mt-1 w-full`} value={template} onChange={(event) => setTemplate(event.target.value as (typeof TEMPLATES)[number])} aria-label={t.template}>
            {TEMPLATES.map((item) => <option key={item} value={item}>{t.templates[item]}</option>)}
          </select>
        </label>
        <label className="text-sm text-[#1E6A83]">{t.scope}
          <select className={`${deskStyles.field} mt-1 w-full`} value={scope} onChange={(event) => setScope(event.target.value)} aria-label={t.scope}>
            {(['student', 'class', 'cohort', 'institution'] as const).map((item) => <option key={item} value={item}>{t.scopes[item]}</option>)}
          </select>
        </label>
        <input className={deskStyles.field} type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label={t.from} />
        <input className={deskStyles.field} type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label={t.to} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-action="preview-report" className={deskStyles.btn} onClick={() => setReady(true)}>{t.preview}</button>
        <button type="button" className={deskStyles.ghost} onClick={() => {
          if (!klass) return;
          const lines = rows.map((row) => `${row.name}: ${row.result.grade}, ${row.rate}% attendance, ${row.done}/${row.total} goals`);
          const bytes = buildPdf(t.templates[template], [`${klass.name}`, `${from} to ${to}`, ...lines], 2026);
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          const url = URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'studio-report.pdf';
          link.click();
          URL.revokeObjectURL(url);
        }}>{t.downloadPdf}</button>
        <button type="button" className={deskStyles.ghost} onClick={() => {
          const csv = ['student,grade,percent,attendance,goals', ...rows.map((row) => [row.name, row.result.grade, row.result.percent, row.rate, `${row.done}/${row.total}`].join(','))].join('\n');
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'studio-report.csv';
          link.click();
          URL.revokeObjectURL(url);
        }}>{t.exportCsv}</button>
        <button type="button" className={deskStyles.ghost} onClick={() => setScheduled(true)}>{t.schedule}</button>
      </div>
      {scheduled ? <p className="text-sm text-[#1E6A83]">{t.scheduled}</p> : null}
      {ready ? (
        <table className="w-full overflow-hidden rounded-3xl bg-white text-left text-sm">
          <thead className="text-[#1E6A83]"><tr><th className="px-3 py-3">{t.drill}</th><th>{t.termGrade}</th><th>{t.tabs.attendance}</th><th>{t.goalsTitle}</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-[#1E6A83]/10">
                <td className="px-3 py-2">{row.name}</td>
                <td>{row.result.grade} · {gradeSetLabel(row.result.percent)}</td>
                <td>{row.rate}%</td>
                <td>{row.done}/{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="text-xs text-[#1E6A83]">{t.scopes[scope as keyof typeof t.scopes]} · {t.templates[template]}</p>
    </DeskFrame>
  );
}
