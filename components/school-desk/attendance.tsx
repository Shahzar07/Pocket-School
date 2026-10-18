'use client';

import { useMemo, useState } from 'react';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { attendanceRate, autoAttendance, roster, saveAttendance, type AttStatus } from '@/lib/school-desk/model';
import { ClassSelect, DeskFrame, DeskLinks, deskStyles, resetToDemo, useDesk } from './ui';

const STATUSES: AttStatus[] = ['present', 'late', 'absent', 'excused'];

export function AttendanceDesk({ base = 'dashboard' }: { base?: 'dashboard' | 'preview' }) {
  const { state, setState } = useDesk();
  const [classId, setClassId] = useState('class-maths');
  const [date, setDate] = useState('2026-10-18');
  const [session, setSession] = useState('08:30');
  const [marks, setMarks] = useState<Record<string, { status: AttStatus; reason: string }>>({});
  const [saved, setSaved] = useState('');

  const klass = state.classes.find((item) => item.id === classId) ?? state.classes[0];
  const activeId = klass?.id ?? '';
  const pupils = roster(state, activeId).filter((item) => item.status === 'active');
  const history = state.attendance.filter((item) => item.classId === activeId);
  const today = history.filter((item) => item.date === date);
  const rate = attendanceRate(history);
  const frequent = useMemo(() => {
    return pupils.filter((pupil) => {
      const rows = history.filter((item) => item.studentId === pupil.studentId && item.status === 'absent');
      return rows.length >= 1;
    });
  }, [pupils, history]);

  const current = (studentId: string): { status: AttStatus; reason: string } => {
    if (marks[studentId]) return marks[studentId];
    const stored = today.find((item) => item.studentId === studentId);
    return { status: stored?.status ?? 'present', reason: stored?.reason ?? '' };
  };

  const setOne = (studentId: string, patch: Partial<{ status: AttStatus; reason: string }>) => {
    setMarks((prev) => ({ ...prev, [studentId]: { ...current(studentId), ...patch } }));
  };

  const persist = (rows: Array<{ studentId: string; status: AttStatus; reason: string; source?: 'manual' | 'login' | 'live'; activeMinutes?: number }>) => {
    setState(saveAttendance(state, rows.map((row) => ({
      classId: activeId,
      studentId: row.studentId,
      date,
      session,
      status: row.status,
      reason: row.reason,
      source: row.source,
      activeMinutes: row.activeMinutes ?? (row.status === 'absent' ? 0 : 45),
      parentNote: '',
    })), state.actorName));
    setSaved(t.markRegister);
  };

  return (
    <DeskFrame title={t.attendanceTitle} lede={t.attendanceLede} state={state} onReset={() => resetToDemo(setState)} syncs="Report cards, Report Studio, parent dashboard, parent notice when absent or late">
      <DeskLinks base={base} />
      <div className="grid gap-3 sm:grid-cols-3">
        <ClassSelect state={state} classId={activeId} onChange={setClassId} />
        <label className="text-sm text-[#1E6A83]">{t.session}
          <input className={`${deskStyles.field} mt-1 w-full`} type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label={t.session} />
        </label>
        <label className="text-sm text-[#1E6A83]">{t.tabs.attendance}
          <input className={`${deskStyles.field} mt-1 w-full`} value={session} onChange={(event) => setSession(event.target.value)} aria-label={t.tabs.attendance} />
        </label>
      </div>
      <p className="text-sm text-[#1E6A83]">{klass?.name} · {rate}% · {t.frequent}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={deskStyles.ghost} onClick={() => {
          const next: Record<string, { status: AttStatus; reason: string }> = {};
          for (const pupil of pupils) next[pupil.studentId] = { status: 'present', reason: '' };
          setMarks(next);
        }}>{t.markAllPresent}</button>
        <button type="button" data-action="auto-live" className={deskStyles.ghost} onClick={() => setState(autoAttendance(state, activeId, date, state.actorName))}>{t.autoLive}</button>
        <button type="button" data-action="save-register" className={deskStyles.btn} onClick={() => persist(pupils.map((pupil) => ({ studentId: pupil.studentId, ...current(pupil.studentId) })))}>{t.markRegister}</button>
        <button type="button" className={deskStyles.ghost} onClick={() => {
          const lines = ['student,date,session,status,reason', ...history.map((item) => {
            const name = pupils.find((pupil) => pupil.studentId === item.studentId)?.studentName ?? item.studentId;
            return [name, item.date, item.session, item.status, item.reason].join(',');
          })];
          const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'attendance.csv';
          link.click();
          URL.revokeObjectURL(url);
        }}>{t.exportCsv}</button>
      </div>
      <ul className="space-y-2">
        {pupils.map((pupil) => {
          const row = current(pupil.studentId);
          const note = history.find((item) => item.studentId === pupil.studentId && item.parentNote);
          return (
            <li key={pupil.studentId} className="rounded-2xl bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{pupil.studentName}</p>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map((status) => (
                    <button key={status} type="button" data-action={status === 'absent' ? 'mark-absent' : undefined} className={row.status === status ? deskStyles.btn : deskStyles.ghost} onClick={() => setOne(pupil.studentId, { status })}>{t.status[status]}</button>
                  ))}
                </div>
              </div>
              <input className={`${deskStyles.field} mt-2 w-full`} value={row.reason} onChange={(event) => setOne(pupil.studentId, { reason: event.target.value })} aria-label={t.reason} />
              {note ? <p className="mt-1 text-xs text-[#1E6A83]">{t.parentNote} {note.parentNote}</p> : null}
            </li>
          );
        })}
      </ul>
      {saved ? <p className="text-sm text-[#1E6A83]">{saved}</p> : null}
      <section className="rounded-3xl bg-white p-5 text-sm">
        <h2 className="font-heading text-2xl">{t.frequent}</h2>
        <ul className="mt-2">
          {frequent.map((item) => <li key={item.studentId}>{item.studentName}</li>)}
        </ul>
        <p className="mt-3 text-[#1E6A83]">{t.rates} {rate}%</p>
      </section>
    </DeskFrame>
  );
}
