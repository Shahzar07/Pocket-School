'use client';

import { useState } from 'react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import {
  LEVELS, SCALE_LABEL, approveSuggestion, createAssessment, returnSubmission, roster, submitWork,
  type ScaleId,
} from '@/lib/school-desk/model';
import { ClassSelect, DeskFrame, DeskLinks, deskStyles, resetToDemo, useDesk } from './ui';

const SCALES = Object.keys(SCALE_LABEL) as ScaleId[];

export function AssignmentsDesk({ base = 'dashboard' }: { base?: 'dashboard' | 'preview' }) {
  const { state, setState } = useDesk();
  const [classId, setClassId] = useState('class-maths');
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('Graphs homework');
  const [instructions, setInstructions] = useState('Plot the three graphs and label the intercepts.');
  const [due, setDue] = useState('2026-10-24T16:00');
  const [points, setPoints] = useState('20');
  const [scale, setScale] = useState<ScaleId>('points');
  const [rubric, setRubric] = useState('Graph, 10; Explanation, 10');
  const [attachment, setAttachment] = useState('graphs.pdf');
  const [lesson, setLesson] = useState('Straight line graphs');
  const [penalty, setPenalty] = useState('10');
  const [cutoff, setCutoff] = useState('5');
  const [allowLate, setAllowLate] = useState(true);
  const [openId, setOpenId] = useState('sub-amina');
  const [feedback, setFeedback] = useState('');
  const [studentBody, setStudentBody] = useState('I plotted both lines and checked the crossing point.');
  const [message, setMessage] = useState('');

  const klass = state.classes.find((item) => item.id === classId) ?? state.classes[0];
  const activeId = klass?.id ?? '';
  const pupils = roster(state, activeId);
  const work = state.assessments.filter((item) => item.classId === activeId);
  const inbox = state.submissions.filter((item) => work.some((assessment) => assessment.id === item.assessmentId));
  const open = inbox.find((item) => item.id === openId) ?? inbox[0];
  const openAssessment = open ? work.find((item) => item.id === open.assessmentId) : undefined;

  return (
    <DeskFrame title={t.assignmentsTitle} lede={t.assignmentsLede} state={state} onReset={() => resetToDemo(setState)} syncs="Gradebook, student assignments, parent notice, goals when the returned mark is weak">
      <DeskLinks base={base} />
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="space-y-3 rounded-3xl bg-white p-5" onSubmit={(event) => {
          event.preventDefault();
          if (!klass) return;
          const rows = rubric.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
            const [criterion, raw] = part.split(',').map((bit) => bit.trim());
            return { criterion: criterion || 'Criterion', points: Number(raw) || 0 };
          });
          setState(createAssessment(state, {
            classId: activeId,
            title,
            kind: 'assignment',
            scaleId: scale,
            maxPoints: Number(points) || 20,
            weight: 10,
            category: 'Homework',
            dueAt: new Date(due).toISOString(),
            instructions,
            attachments: attachment ? [attachment] : [],
            rubric: rows,
            latePolicy: { allow: allowLate, penaltyPercentPerDay: Number(penalty) || 0, cutoffDays: Number(cutoff) || 0 },
            lessonLabel: lesson,
            studentIds: studentId ? [studentId] : [],
          }, state.actorId));
          setMessage(t.create);
        }}>
          <h2 className="font-heading text-2xl">{t.create}</h2>
          <ClassSelect state={state} classId={activeId} onChange={setClassId} />
          <label className="block text-sm text-[#1E6A83]">{t.studentsLabel}
            <select className={`${deskStyles.field} mt-1 w-full`} value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label={t.studentsLabel}>
              <option value="">{t.wholeClass}</option>
              {pupils.filter((item) => item.status === 'active').map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName}</option>)}
            </select>
          </label>
          <input className={`${deskStyles.field} w-full`} value={title} onChange={(event) => setTitle(event.target.value)} aria-label={t.titleLabel} />
          <textarea className="h-20 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-sm" value={instructions} onChange={(event) => setInstructions(event.target.value)} aria-label={t.titleLabel} />
          <input className={`${deskStyles.field} w-full`} value={lesson} onChange={(event) => setLesson(event.target.value)} aria-label={t.lessonLabel} />
          <input className={`${deskStyles.field} w-full`} type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} aria-label={t.due} />
          <div className="grid grid-cols-2 gap-2">
            <input className={deskStyles.field} value={points} onChange={(event) => setPoints(event.target.value)} aria-label={t.points} />
            <select className={deskStyles.field} value={scale} onChange={(event) => setScale(event.target.value as ScaleId)} aria-label={t.scale}>
              {SCALES.map((item) => <option key={item} value={item}>{SCALE_LABEL[item]}</option>)}
            </select>
          </div>
          <input className={`${deskStyles.field} w-full`} value={rubric} onChange={(event) => setRubric(event.target.value)} aria-label={t.rubric} />
          <input className={`${deskStyles.field} w-full`} value={attachment} onChange={(event) => setAttachment(event.target.value)} aria-label={t.attachments} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowLate} onChange={(event) => setAllowLate(event.target.checked)} />
            {t.latePolicy}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input className={deskStyles.field} value={penalty} onChange={(event) => setPenalty(event.target.value)} aria-label={t.penaltyLabel} />
            <input className={deskStyles.field} value={cutoff} onChange={(event) => setCutoff(event.target.value)} aria-label={t.cutoffLabel} />
          </div>
          <p className="text-xs text-[#1E6A83]">{LEVELS.join(', ')}</p>
          <button type="submit" className={deskStyles.btn}>{t.create}</button>
          {message ? <p className="text-sm text-[#1E6A83]">{message}</p> : null}
        </form>
        <section className="rounded-3xl bg-white p-5">
          <h2 className="font-heading text-2xl">{t.inbox}</h2>
          <ul className="mt-3 space-y-2">
            {inbox.map((item) => (
              <li key={item.id}>
                <button type="button" data-action="open-inbox" className="w-full rounded-2xl border border-[#1E6A83]/20 px-3 py-2 text-left text-sm" onClick={() => { setOpenId(item.id); setFeedback(item.suggestion?.feedback ?? ''); }}>
                  {item.studentName} · {item.status}
                </button>
              </li>
            ))}
            {inbox.length === 0 ? <li className="text-sm text-[#1E6A83]">{t.noSubmissions}</li> : null}
          </ul>
          {open && openAssessment ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-semibold">{open.studentName}</p>
              <p>{open.body}</p>
              {open.suggestion ? <p className="text-[#1E6A83]">{t.suggests} {open.suggestion.points} {t.of} {openAssessment.maxPoints}. {open.suggestion.approved ? t.approved : t.waiting}</p> : null}
              <textarea className="h-20 w-full rounded-2xl border border-[#1E6A83]/30 p-3" value={feedback} onChange={(event) => setFeedback(event.target.value)} aria-label={t.comment} />
              <div className="flex flex-wrap gap-2">
                <button type="button" data-action="approve-ai" className={deskStyles.ghost} onClick={() => setState(approveSuggestion(state, open.id))}>{t.approve}</button>
                <button type="button" data-action="return-work" className={deskStyles.btn} onClick={() => setState(returnSubmission(state, open.id, state.actorId, feedback))}>{t.returnWork}</button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <section className="rounded-3xl bg-white p-5">
        <h2 className="font-heading text-2xl">{t.studentView}</h2>
        <p className="mt-1 text-sm text-[#1E6A83]">{t.studentHelp}</p>
        <textarea className="mt-3 h-20 w-full rounded-2xl border border-[#1E6A83]/30 p-3 text-sm" value={studentBody} onChange={(event) => setStudentBody(event.target.value)} aria-label={t.submit} />
        <button type="button" data-action="student-submit" className={`${deskStyles.btn} mt-3`} onClick={() => {
          const target = work.find((item) => item.title === 'Homework 4') ?? work[0];
          if (!target) return;
          setState(submitWork(state, target.id, 'stu-amina', studentBody));
        }}>{t.submit}</button>
        <ul className="mt-4 space-y-1 text-sm">
          {work.map((item) => <li key={item.id}>{item.title} · {SCALE_LABEL[item.scaleId]} · {item.dueAt.slice(0, 16).replace('T', ' ')} · {item.lessonLabel}</li>)}
        </ul>
      </section>
    </DeskFrame>
  );
}
