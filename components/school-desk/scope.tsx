'use client';

import { scopeIdFor } from '@/lib/school-desk/catalog';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { ClassSelect, deskStyles, useDesk } from './ui';
import { useState } from 'react';

export function DeskScope({ pathname }: { pathname: string }) {
  const row = scopeIdFor(pathname);
  const { state } = useDesk();
  const [classId, setClassId] = useState(state.classes[0]?.id ?? '');
  const [studentId, setStudentId] = useState(state.enrolments[0]?.studentId ?? '');
  if (!row) return null;
  const pupils = state.enrolments.filter((item) => item.classId === classId && item.status === 'active');
  return (
    <section className="mb-5 rounded-3xl border border-[#1E6A83]/20 bg-white p-5 text-sm text-[#203337]">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83]">{t.demoBadge}</p>
      <h2 className="mt-1 font-heading text-2xl">{row.title}</h2>
      <p className="mt-2 text-[#1E6A83]">{row.who}. {row.data}</p>
      <p className="mt-1">{row.created}</p>
      <p className="mt-1 text-[#1E6A83]">{t.syncTitle}: {row.syncs}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <p className="rounded-2xl bg-[#f4f7f8] p-3">{state.institution.name}</p>
        <ClassSelect state={state} classId={classId} onChange={setClassId} />
        <label className="text-[#1E6A83]">{t.drill}
          <select className={`${deskStyles.field} mt-1 w-full`} value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label={t.drill}>
            {pupils.map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-3 text-[#1E6A83]">{row.notes}</p>
    </section>
  );
}
