'use client';

import { useMemo, useState } from 'react';
import { flowById, flowCopy as c, type FlowId } from '@/lib/school-desk/flows';
import { addFlow, attendanceRate, roster, termResult, updateFlow } from '@/lib/school-desk/model';
import { ClassSelect, DeskFrame, deskStyles, resetToDemo, useDesk } from './ui';

export function FlowDesk({ flow }: { flow: FlowId }) {
  const spec = flowById(flow);
  const { state, setState } = useDesk();
  const [classId, setClassId] = useState(state.classes[0]?.id ?? '');
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [when, setWhen] = useState('2026-10-22');
  const [status, setStatus] = useState(spec?.statuses[0] ?? 'Draft');
  const [editing, setEditing] = useState('');

  const pupils = roster(state, classId).filter((item) => item.status === 'active');
  const ids = flow === 'case' || flow === 'integrity' ? ['case', 'integrity'] : [flow];
  const rows = state.flows.filter((item) => ids.includes(item.flow) && (!classId || item.classId === classId || item.classId === ''));
  const summary = useMemo(() => {
    const people = pupils;
    const grades = people.map((item) => termResult(state, classId, item.studentId).percent);
    const mean = grades.length ? Math.round(grades.reduce((sum, value) => sum + value, 0) / grades.length) : 0;
    const goals = state.goals.filter((item) => item.classId === classId);
    const done = goals.filter((item) => item.status === 'completed').length;
    return {
      pupils: people.length,
      rate: attendanceRate(state.attendance.filter((item) => item.classId === classId)),
      mean,
      done,
      goals: goals.length,
    };
  }, [state, classId, pupils]);

  if (!spec) return null;
  const pupil = pupils.find((item) => item.studentId === studentId);

  return (
    <DeskFrame title={spec.title} lede={spec.lede} state={state} onReset={() => resetToDemo(setState)} syncs={spec.syncs}>
      <section className="grid gap-3 rounded-3xl bg-white p-5 sm:grid-cols-2">
        <p className="text-sm"><span className="font-semibold">{c.who}. </span>{spec.who}</p>
        <p className="text-sm"><span className="font-semibold">{c.data}. </span>{spec.data}</p>
        <p className="text-sm"><span className="font-semibold">{c.made}. </span>{spec.created}</p>
        <div>
          <h2 className="font-heading text-xl">{c.howTo}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#1E6A83]">
            <li>{c.stepClass}</li>
            <li>{spec.created}</li>
            <li>{spec.syncs}</li>
          </ol>
        </div>
      </section>
      {spec.summary ? (
        <section className="grid gap-3 sm:grid-cols-4">
          <p className="rounded-2xl bg-white p-4 text-sm">{c.stats}</p>
          <p className="rounded-2xl bg-white p-4 text-sm">{c.pupils}<span className="mt-1 block font-heading text-3xl">{summary.pupils}</span></p>
          <p className="rounded-2xl bg-white p-4 text-sm">{c.presentRate}<span className="mt-1 block font-heading text-3xl">{summary.rate}%</span></p>
          <p className="rounded-2xl bg-white p-4 text-sm">{c.term}<span className="mt-1 block font-heading text-3xl">{summary.mean}%</span></p>
          <p className="rounded-2xl bg-white p-4 text-sm sm:col-span-4">{c.goalLine} {summary.done}/{summary.goals}</p>
        </section>
      ) : null}
      <form className="grid gap-2 rounded-3xl bg-white p-5 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        if (editing) {
          setState(updateFlow(state, editing, {
            title: title.trim(),
            detail: detail.trim(),
            when,
            status,
            classId,
            studentId: pupil?.studentId ?? '',
            studentName: pupil?.studentName ?? c.wholeClass,
          }, state.actorName));
          setEditing('');
          return;
        }
        setState(addFlow(state, {
          flow: spec.id,
          classId,
          studentId: pupil?.studentId ?? '',
          studentName: pupil?.studentName ?? c.wholeClass,
          title: title.trim(),
          detail: detail.trim(),
          status,
          when,
        }, state.actorName));
        setTitle('');
        setDetail('');
      }}>
        <ClassSelect state={state} classId={classId} onChange={setClassId} />
        <label className="text-sm text-[#1E6A83]">{c.student}
          <select className={`${deskStyles.field} mt-1 w-full`} value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label={c.student}>
            {spec.needsStudent ? null : <option value="">{c.wholeClass}</option>}
            {pupils.map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName}</option>)}
          </select>
        </label>
        <input className={deskStyles.field} value={title} onChange={(event) => setTitle(event.target.value)} aria-label={spec.titleLabel} placeholder={spec.titleLabel} />
        <input className={deskStyles.field} type="date" value={when} onChange={(event) => setWhen(event.target.value)} aria-label={c.when} />
        <textarea className="min-h-20 rounded-xl border border-[#1E6A83]/30 p-3 text-sm sm:col-span-2" value={detail} onChange={(event) => setDetail(event.target.value)} aria-label={spec.detailLabel} placeholder={spec.detailLabel} />
        <select className={deskStyles.field} value={status} onChange={(event) => setStatus(event.target.value)} aria-label={c.status}>
          {spec.statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="submit" className={deskStyles.btn} data-action="create-flow">{editing ? c.update : c.create}</button>
      </form>
      {spec.wall ? (
        <section className="rounded-3xl bg-white p-5">
          <h2 className="font-heading text-2xl">{c.wallTitle}</h2>
          <p className="mt-2 text-sm text-[#1E6A83]">{c.wallBody}</p>
          <p className="mt-2 text-sm">{c.wallPath}</p>
          <a className={`${deskStyles.ghost} mt-3 inline-flex`} href="https://github.com/Shahzar07/Pocket-School/pull/144">{c.wallLink}</a>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-heading text-2xl">{c.list}</h2>
        {rows.length === 0 ? <p className="text-sm text-[#1E6A83]">{spec.empty}</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl bg-white p-4 text-sm">
            <p className="font-semibold">{row.title}</p>
            <p className="text-[#1E6A83]">{row.studentName} · {row.when} · {row.status}</p>
            <p className="mt-1">{row.detail}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={deskStyles.ghost} onClick={() => {
                setEditing(row.id);
                setTitle(row.title);
                setDetail(row.detail);
                setWhen(row.when);
                setStatus(row.status);
                setClassId(row.classId);
                setStudentId(row.studentId);
              }}>{c.update}</button>
              <button type="button" className={deskStyles.ghost} onClick={() => setState(updateFlow(state, row.id, { status: 'Archived' }, state.actorName))}>{c.archive}</button>
            </div>
          </article>
        ))}
      </section>
    </DeskFrame>
  );
}
