'use client';

import { useMemo, useState } from 'react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import {
  SCALE_LABEL, displayMark, gradeSetLabel, importMarks, marksCsv, publishAllDrafts, roster, setMark, termResult,
  type MarkFlag, type ScaleId,
} from '@/lib/school-desk/model';
import { ClassSelect, DeskFrame, DeskLinks, deskStyles, resetToDemo, useDesk } from './ui';

const FLAGS: MarkFlag[] = ['none', 'missing', 'late', 'excused'];

export function GradebookDesk({ base = 'dashboard' }: { base?: 'dashboard' | 'preview' }) {
  const { state, setState } = useDesk();
  const [classId, setClassId] = useState('class-maths');
  const [studentId, setStudentId] = useState('stu-amina');
  const [csv, setCsv] = useState('student,assessment,points,flag,comment');
  const [notice, setNotice] = useState('');
  const [cell, setCell] = useState<{ assessmentId: string; studentId: string } | null>(null);
  const [draftPoints, setDraftPoints] = useState('');
  const [draftFlag, setDraftFlag] = useState<MarkFlag>('none');
  const [draftComment, setDraftComment] = useState('');

  const klass = state.classes.find((item) => item.id === classId) ?? state.classes[0];
  const activeId = klass?.id ?? '';
  const students = roster(state, activeId).filter((item) => item.status === 'active');
  const assessments = state.assessments.filter((item) => item.classId === activeId);
  const open = cell ? state.marks.find((item) => item.assessmentId === cell.assessmentId && item.studentId === cell.studentId) : undefined;
  const assessment = cell ? assessments.find((item) => item.id === cell.assessmentId) : undefined;

  const drill = useMemo(() => students.find((item) => item.studentId === studentId) ?? students[0], [students, studentId]);

  const choose = (assessmentId: string, pupil: string) => {
    const mark = state.marks.find((item) => item.assessmentId === assessmentId && item.studentId === pupil);
    setCell({ assessmentId, studentId: pupil });
    setDraftPoints(mark?.points == null ? '' : String(mark.points));
    setDraftFlag(mark?.flag ?? 'none');
    setDraftComment(mark?.comment ?? '');
    setStudentId(pupil);
  };

  const save = (published: boolean) => {
    if (!cell) return;
    const points = draftPoints.trim() === '' ? null : Number(draftPoints);
    setState(setMark(state, {
      assessmentId: cell.assessmentId,
      studentId: cell.studentId,
      points: points != null && Number.isFinite(points) ? points : null,
      flag: draftFlag,
      comment: draftComment,
      state: published ? 'published' : 'draft',
      actor: state.actorId,
    }));
    setNotice(published ? t.publish : t.save);
  };

  return (
    <DeskFrame title={t.gradebookTitle} lede={t.gradebookLede} state={state} onReset={() => resetToDemo(setState)} syncs="Student dashboard, parent notice, report cards, Report Studio, goals for a weak topic, certificates">
      <DeskLinks base={base} />
      <div className="grid gap-3 sm:grid-cols-3">
        <p className="rounded-2xl bg-white p-4 text-sm">{state.institution.name}<span className="mt-1 block text-[#1E6A83]">{t.scale}: {SCALE_LABEL[state.institution.defaultScale]}</span></p>
        <ClassSelect state={state} classId={activeId} onChange={setClassId} />
        <p className="rounded-2xl bg-white p-4 text-sm">{klass?.term} · {klass?.subject}<span className="mt-1 block text-[#1E6A83]">{klass?.level}</span></p>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-[#1E6A83]/20 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[#1E6A83]">
            <tr>
              <th className="px-3 py-3">Student</th>
              {assessments.map((item) => (
                <th key={item.id} className="px-3 py-3">{item.title}<span className="block font-normal">{SCALE_LABEL[item.scaleId]} · {item.weight}%</span></th>
              ))}
              <th className="px-3 py-3">{t.termGrade}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((pupil) => {
              const result = termResult(state, activeId, pupil.studentId);
              return (
                <tr key={pupil.studentId} className="border-t border-[#1E6A83]/10">
                  <td className="px-3 py-3 font-semibold">{pupil.studentName}</td>
                  {assessments.map((item) => {
                    const mark = state.marks.find((row) => row.assessmentId === item.id && row.studentId === pupil.studentId);
                    const label = mark ? displayMark(mark.points, item.maxPoints, item.scaleId as ScaleId, state.institution.customBands) : '—';
                    return (
                      <td key={item.id} className="px-3 py-3">
                        <button type="button" data-action="open-cell" className="rounded-xl border border-[#1E6A83]/20 px-2 py-1" onClick={() => choose(item.id, pupil.studentId)}>
                          {label}
                          {mark && mark.flag !== 'none' ? <span className="ml-1 text-[#1E6A83]">{mark.flag}</span> : null}
                          {mark?.state === 'draft' ? <span className="ml-1 text-[#1E6A83]">draft</span> : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 font-semibold" data-grade-set={result.percent}>{result.grade} · {gradeSetLabel(result.percent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {assessment && cell && (
        <section className="rounded-3xl bg-white p-5">
          <h2 className="font-heading text-2xl">{assessment.title}</h2>
          <p className="text-sm text-[#1E6A83]">{assessment.category} · {assessment.maxPoints} {t.scale.toLowerCase()} {SCALE_LABEL[assessment.scaleId]}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-[#1E6A83]">{t.points}
              <input className={`${deskStyles.field} mt-1 w-full`} value={draftPoints} onChange={(event) => setDraftPoints(event.target.value)} aria-label="Points" />
            </label>
            <label className="text-sm text-[#1E6A83]">{t.flag}
              <select className={`${deskStyles.field} mt-1 w-full`} value={draftFlag} onChange={(event) => setDraftFlag(event.target.value as MarkFlag)} aria-label={t.flag}>
                {FLAGS.map((flag) => <option key={flag} value={flag}>{flag}</option>)}
              </select>
            </label>
            <label className="text-sm text-[#1E6A83] sm:col-span-1">{t.comment}
              <input className={`${deskStyles.field} mt-1 w-full`} value={draftComment} onChange={(event) => setDraftComment(event.target.value)} aria-label={t.comment} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={deskStyles.ghost} onClick={() => save(false)}>{t.save}</button>
            <button type="button" data-action="publish-mark" className={deskStyles.btn} onClick={() => save(true)}>{t.publish}</button>
          </div>
          {open ? <p className="mt-2 text-xs text-[#1E6A83]">Last edit {open.updatedAt} · {open.state}</p> : null}
        </section>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5">
          <h2 className="font-heading text-2xl">{t.importCsv}</h2>
          <textarea className="mt-3 h-28 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-sm" value={csv} onChange={(event) => setCsv(event.target.value)} aria-label={t.importCsv} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={deskStyles.btn} onClick={() => {
              const result = importMarks(state, csv, state.actorId);
              setState(result.state);
              setNotice(result.error || `${result.imported}`);
            }}>{t.importCsv}</button>
            <button type="button" className={deskStyles.ghost} onClick={() => {
              const file = new Blob([marksCsv(state, activeId)], { type: 'text/csv' });
              const url = URL.createObjectURL(file);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'gradebook.csv';
              link.click();
              URL.revokeObjectURL(url);
            }}>{t.exportCsv}</button>
            <button type="button" data-action="publish-all" className={deskStyles.ghost} onClick={() => setState(publishAllDrafts(state, activeId, state.actorId))}>{t.publishAll}</button>
          </div>
          {notice ? <p className="mt-2 text-sm text-[#1E6A83]">{notice}</p> : null}
        </div>
        <div className="rounded-3xl bg-white p-5">
          <h2 className="font-heading text-2xl">{t.drill}</h2>
          <select className={`${deskStyles.field} mt-3 w-full`} value={drill?.studentId ?? ''} onChange={(event) => setStudentId(event.target.value)} aria-label={t.drill}>
            {students.map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName}</option>)}
          </select>
          {drill ? (
            <ul className="mt-3 space-y-1 text-sm">
              {assessments.map((item) => {
                const mark = state.marks.find((row) => row.assessmentId === item.id && row.studentId === drill.studentId);
                return <li key={item.id}>{item.title}: {mark ? displayMark(mark.points, item.maxPoints, item.scaleId, state.institution.customBands) : '—'} {mark?.comment}</li>;
              })}
            </ul>
          ) : null}
          <h3 className="mt-4 font-semibold">{t.audit}</h3>
          <ul className="mt-2 space-y-1 text-sm text-[#1E6A83]">
            {state.audit.slice(0, 6).map((item) => <li key={item.id}>{item.actor} · {item.action} · {item.target}</li>)}
          </ul>
        </div>
      </section>
    </DeskFrame>
  );
}
