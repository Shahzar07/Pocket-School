'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { createDemoDesk, readDesk, resetDesk, writeDesk, type DeskState } from '@/lib/school-desk/model';

export function useDesk(): { state: DeskState; setState: (next: DeskState) => void; ready: boolean } {
  const [state, setRaw] = useState<DeskState>(createDemoDesk);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setRaw(readDesk());
    setReady(true);
  }, []);
  const setState = (next: DeskState) => {
    writeDesk(next);
    setRaw(next);
  };
  return { state, setState, ready };
}

const btn = 'h-10 rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]';
const ghost = 'h-10 rounded-full border border-[#1E6A83] bg-white px-4 text-sm font-semibold text-[#1E6A83]';
const field = 'h-10 rounded-xl border border-[#1E6A83]/30 bg-white px-3 text-sm text-[#203337]';

export const deskStyles = { btn, ghost, field };

export function DeskFrame({
  title,
  lede,
  state,
  onReset,
  children,
  syncs,
}: {
  title: string;
  lede: string;
  state: DeskState;
  onReset: () => void;
  children: ReactNode;
  syncs: string;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10 text-[#203337]">
      <section className="rounded-3xl border border-[#1E6A83]/30 bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83]">{t.demoBadge}</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[#1E6A83]">{lede}</p>
        <p className="mt-2 text-sm text-[#203337]">{state.institution.kind === 'independent' ? t.signedIndependent : t.signedIn}</p>
        <p className="mt-2 text-sm text-[#1E6A83]">{t.sample}</p>
        <p className="mt-3 text-sm">{state.institution.name} · {state.institution.campus} · {t.chain}</p>
        <button type="button" className={`${ghost} mt-3`} onClick={() => { onReset(); }}>{t.reset}</button>
      </section>
      {children}
      <p className="text-sm text-[#1E6A83]"><span className="font-semibold text-[#203337]">{t.syncTitle}. </span>{syncs}</p>
    </div>
  );
}

export function resetToDemo(setState: (next: DeskState) => void) {
  setState(resetDesk());
}

export function ClassSelect({
  state,
  classId,
  onChange,
}: {
  state: DeskState;
  classId: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block text-sm text-[#1E6A83]">
      {t.classesTitle}
      <select className={`${field} mt-1 block w-full`} value={classId} onChange={(event) => onChange(event.target.value)} aria-label={t.classesTitle}>
        {state.classes.map((item) => (
          <option key={item.id} value={item.id}>{item.name} · {item.level} · {item.term}</option>
        ))}
      </select>
    </label>
  );
}

export function deskHref(base: 'dashboard' | 'preview', path: string): string {
  if (base === 'dashboard') return path;
  const view: Record<string, string> = {
    '/dashboard/teacher/gradebook': 'gradebook',
    '/dashboard/teacher/assignments': 'assignments',
    '/dashboard/teacher/report-cards': 'report',
    '/dashboard/teacher/report-studio': 'studio',
    '/dashboard/teacher/attendance': 'attendance',
    '/dashboard/teacher/classes': 'classes',
    '/dashboard/teacher/goals': 'goals',
    '/dashboard/teacher/earnings': 'earnings',
  };
  return `/preview/teacher-desk?view=${view[path] ?? 'gradebook'}`;
}

export function DeskLinks({ base }: { base: 'dashboard' | 'preview' }) {
  const links = [
    ['/dashboard/teacher/classes', t.classesTitle],
    ['/dashboard/teacher/assignments', t.assignmentsTitle],
    ['/dashboard/teacher/gradebook', t.gradebookTitle],
    ['/dashboard/teacher/attendance', t.attendanceTitle],
    ['/dashboard/teacher/report-cards', t.reportTitle],
    ['/dashboard/teacher/report-studio', t.studioTitle],
    ['/dashboard/teacher/goals', t.goalsTitle],
  ] as const;
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map(([path, label]) => (
        <Link key={path} href={deskHref(base, path)} className={ghost}>{label}</Link>
      ))}
    </nav>
  );
}
