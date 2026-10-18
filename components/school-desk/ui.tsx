'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuthSTORE } from '@/hooks/use-auth';
import { deskCopy as t } from '@/lib/school-desk/copy';
import { createDemoDesk, emptyDesk, type DeskRole, type DeskState } from '@/lib/school-desk/model';
import { persistDeskDiff, subscribeTeacherDesk, type DeskActor } from '@/lib/school-desk/persist';

function actorFromProfile(uid: string, name: string, role: string, institutionId?: string): DeskActor | null {
  const deskRole: DeskRole | null = role === 'institution_admin' ? 'institution_admin' : role === 'teacher' || role === 'admin' ? 'teacher' : null;
  if (!deskRole) return null;
  return {
    uid,
    name: name || 'Teacher',
    role: deskRole,
    institutionId: institutionId || '',
    institutionName: institutionId ? 'School' : 'Independent teaching',
  };
}

interface DeskApi {
  state: DeskState;
  setState: (next: DeskState) => void;
  ready: boolean;
  live: boolean;
  sync: string;
}

const DeskReact = createContext<DeskApi | null>(null);

function useDeskLocal(active: boolean): DeskApi {
  const { user, profile, loading } = useAuthSTORE();
  const actor = !loading && user && profile
    ? actorFromProfile(user.uid, profile.name || user.displayName || 'Teacher', profile.role, profile.institutionId)
    : null;
  const live = !!actor;
  const [state, setRaw] = useState<DeskState>(() => emptyDesk({ uid: '', name: 'Teacher' }));
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState('idle');
  const stateRef = useRef(state);
  const writing = useRef(false);
  const actorRef = useRef(actor);
  actorRef.current = actor;

  useEffect(() => {
    if (!active) return undefined;
    if (loading) return undefined;
    if (!actor) {
      const demo = createDemoDesk();
      stateRef.current = demo;
      setRaw(demo);
      setReady(true);
      setSync('sample');
      return undefined;
    }
    const blank = emptyDesk({
      uid: actor.uid,
      name: actor.name,
      institutionId: actor.institutionId,
      institutionName: actor.institutionName,
    });
    stateRef.current = blank;
    setRaw(blank);
    setReady(false);
    setSync('live');
    return subscribeTeacherDesk(actor, (next) => {
      if (writing.current) return;
      const current = { ...next, actorId: actor.uid, actorName: actor.name, institution: { ...next.institution, demo: false } };
      stateRef.current = current;
      setRaw(current);
      setReady(true);
      setSync((value) => (value === 'saving' || value === 'saved' || value === 'error' ? value : 'live'));
    }, (error) => {
      console.error(error.message);
      setSync('error');
    });
  }, [active, loading, actor?.uid, actor?.role, actor?.institutionId, actor?.name]);

  const setState = (next: DeskState) => {
    const currentActor = actorRef.current;
    if (currentActor && next.institution.demo) return;
    const stamped = currentActor
      ? { ...next, actorId: currentActor.uid, actorName: currentActor.name, institution: { ...next.institution, demo: false } }
      : next;
    const prev = stateRef.current;
    stateRef.current = stamped;
    setRaw(stamped);
    if (!currentActor) {
      setSync('sample');
      return;
    }
    writing.current = true;
    setSync('saving');
    persistDeskDiff(prev, stamped, currentActor.role)
      .then(() => setSync('saved'))
      .catch(() => setSync('error'))
      .finally(() => {
        writing.current = false;
      });
  };
  return { state, setState, ready, live, sync };
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const value = useDeskLocal(true);
  return <DeskReact.Provider value={value}>{children}</DeskReact.Provider>;
}

export function useDesk(): DeskApi {
  const shared = useContext(DeskReact);
  const local = useDeskLocal(shared == null);
  return shared ?? local;
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
  const shared = useContext(DeskReact);
  const live = shared ? shared.live : !state.institution.demo;
  const sync = shared?.sync ?? (live ? 'live' : 'sample');
  const ready = shared?.ready ?? true;
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10 text-[#203337]" data-desk-live={live ? 'yes' : 'no'} data-desk-sync={sync} data-desk-ready={ready ? 'yes' : 'no'}>
      <section className="rounded-3xl border border-[#1E6A83]/30 bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1E6A83]">{live ? t.liveBadge : t.demoBadge}</p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[#1E6A83]">{lede}</p>
        <p className="mt-2 text-sm text-[#203337]">{live ? state.actorName : state.institution.kind === 'independent' ? t.signedIndependent : t.signedIn}</p>
        <p className="mt-2 text-sm text-[#1E6A83]">{live ? (state.classes.length === 0 ? t.liveEmpty : t.liveSaved) : t.sample}</p>
        <p className="mt-3 text-sm">{state.institution.name} · {state.institution.campus} · {t.chain}</p>
        {live ? null : <button type="button" className={`${ghost} mt-3`} onClick={() => { onReset(); }}>{t.reset}</button>}
      </section>
      {children}
      <p className="text-sm text-[#1E6A83]"><span className="font-semibold text-[#203337]">{t.syncTitle}. </span>{syncs}</p>
    </div>
  );
}

export function resetToDemo(setState: (next: DeskState) => void) {
  setState(createDemoDesk());
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
