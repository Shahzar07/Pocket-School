'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthSTORE } from '@/hooks/use-auth';
import { addDays, itemsOn, monthCells, moveDue, startOfDay, weekCells, type PlannerView } from '@/lib/planner/calendar';
import { asKind, KIND_COLOR, PLANNER_KINDS, type BoardEvent, type PlannerKind } from '@/lib/planner/board';
import { PLANNER_COPY } from '@/lib/planner/copy';

function fromDoc(id: string, data: Record<string, unknown>): BoardEvent | null {
  if (typeof data.title !== 'string' || typeof data.dueAt !== 'number') return null;
  return {
    id,
    title: data.title,
    kind: asKind(data.kind),
    dueAt: data.dueAt,
    className: typeof data.className === 'string' ? data.className : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    reminder: typeof data.reminder === 'string' ? data.reminder : '',
    status: data.status === 'done' || data.status === 'cancelled' ? data.status : 'open',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    studentIds: Array.isArray(data.studentIds) ? data.studentIds.filter((item): item is string => typeof item === 'string') : [],
    source: data.source === 'assessment' || data.source === 'attendance' || data.source === 'goal' || data.source === 'class' ? data.source : 'planner',
    sourceId: typeof data.sourceId === 'string' ? data.sourceId : '',
  };
}

function stamp(value: number): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function CalendarBoard() {
  const { user, profile } = useAuthSTORE();
  const [events, setEvents] = useState<BoardEvent[]>([]);
  const [anchor, setAnchor] = useState(() => startOfDay(Date.now()));
  const [view, setView] = useState<PlannerView>('month');
  const [selected, setSelected] = useState<BoardEvent | null>(null);
  const [draft, setDraft] = useState({ title: '', kind: 'personal' as PlannerKind, className: '', notes: '', reminder: '', when: stamp(Date.now()) });
  const [edit, setEdit] = useState({ title: '', kind: 'personal' as PlannerKind, className: '', notes: '', reminder: '', when: stamp(Date.now()) });

  const load = async (uid: string) => {
    const seen = new Map<string, BoardEvent>();
    const take = (id: string, data: Record<string, unknown>) => {
      const row = fromDoc(id, data);
      if (row) seen.set(row.id, row);
    };
    const own = await getDocs(query(collection(db, 'planner_events'), where('ownerId', '==', uid)));
    own.forEach((row) => take(row.id, row.data()));
    const children = profile?.childIds ?? [];
    for (const childId of children.slice(0, 10)) {
      const shared = await getDocs(query(collection(db, 'planner_events'), where('studentIds', 'array-contains', childId)));
      shared.forEach((row) => take(row.id, row.data()));
    }
    const mine = await getDocs(query(collection(db, 'planner_events'), where('studentIds', 'array-contains', uid)));
    mine.forEach((row) => take(row.id, row.data()));
    setEvents([...seen.values()]);
  };

  useEffect(() => {
    if (!user) return;
    void load(user.uid).catch(() => toast.error(PLANNER_COPY.failed));
  }, [user, profile?.childIds]);

  const days = view === 'month' ? monthCells(anchor) : view === 'week' ? weekCells(anchor) : [startOfDay(anchor)];
  const label = new Date(anchor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const save = async () => {
    if (!user || !draft.title.trim()) return;
    try {
      await addDoc(collection(db, 'planner_events'), {
        title: draft.title.trim(),
        kind: draft.kind,
        dueAt: new Date(draft.when).getTime(),
        className: draft.className.trim(),
        notes: draft.notes.trim(),
        reminder: draft.reminder.trim(),
        status: 'open',
        ownerId: user.uid,
        studentIds: [user.uid, ...(profile?.childIds ?? []).slice(0, 10)],
        source: 'planner',
        sourceId: '',
      });
      toast.success(PLANNER_COPY.saved);
      setDraft({ ...draft, title: '' });
      await load(user.uid);
    } catch {
      toast.error(PLANNER_COPY.failed);
    }
  };

  const move = async (event: BoardEvent, day: number) => {
    if (!user || event.ownerId !== user.uid) return;
    const dueAt = moveDue(event.dueAt, day);
    try {
      await updateDoc(doc(db, 'planner_events', event.id), { dueAt });
      if (event.source === 'assessment' && event.sourceId) {
        await updateDoc(doc(db, 'school_assessments', event.sourceId), { dueAt: new Date(dueAt).toISOString() });
      }
      if (event.source === 'goal' && event.sourceId && event.studentIds[0]) {
        await updateDoc(doc(db, 'users', event.studentIds[0], 'goals', event.sourceId), { due: new Date(dueAt).toISOString().slice(0, 10) });
      }
      toast.success(PLANNER_COPY.moved);
      await load(user.uid);
    } catch {
      toast.error(PLANNER_COPY.failed);
    }
  };

  const open = (event: BoardEvent) => {
    setSelected(event);
    setEdit({
      title: event.title,
      kind: event.kind,
      className: event.className,
      notes: event.notes,
      reminder: event.reminder,
      when: stamp(event.dueAt),
    });
  };

  const saveEdit = async () => {
    if (!user || !selected || selected.ownerId !== user.uid || !edit.title.trim()) return;
    const dueAt = new Date(edit.when).getTime();
    const personal = selected.source === 'planner';
    try {
      await updateDoc(doc(db, 'planner_events', selected.id), {
        title: personal ? edit.title.trim() : selected.title,
        kind: personal ? edit.kind : selected.kind,
        className: edit.className.trim(),
        notes: edit.notes.trim(),
        reminder: edit.reminder.trim(),
        dueAt,
      });
      if (selected.source === 'assessment' && selected.sourceId) {
        await updateDoc(doc(db, 'school_assessments', selected.sourceId), { dueAt: new Date(dueAt).toISOString() });
      }
      if (selected.source === 'goal' && selected.sourceId && selected.studentIds[0]) {
        await updateDoc(doc(db, 'users', selected.studentIds[0], 'goals', selected.sourceId), { due: new Date(dueAt).toISOString().slice(0, 10) });
      }
      toast.success(PLANNER_COPY.saved);
      await load(user.uid);
    } catch {
      toast.error(PLANNER_COPY.failed);
    }
  };

  const remove = async (event: BoardEvent) => {
    if (!user || event.ownerId !== user.uid || event.source !== 'planner') return;
    try {
      await deleteDoc(doc(db, 'planner_events', event.id));
      setSelected(null);
      toast.success(PLANNER_COPY.removed);
      await load(user.uid);
    } catch {
      toast.error(PLANNER_COPY.failed);
    }
  };

  const grid = useMemo(() => (view === 'day' ? 'grid-cols-1' : 'grid-cols-7'), [view]);

  return (
    <section className="space-y-4" data-planner-board="1">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-11 rounded-full border px-3 text-sm" onClick={() => setAnchor(addDays(anchor, view === 'month' ? -30 : view === 'week' ? -7 : -1))}>←</button>
        <p className="font-semibold text-[#203337]">{label}</p>
        <button type="button" className="min-h-11 rounded-full border px-3 text-sm" onClick={() => setAnchor(addDays(anchor, view === 'month' ? 30 : view === 'week' ? 7 : 1))}>→</button>
        <button type="button" className="min-h-11 rounded-full border px-3 text-sm" onClick={() => setAnchor(startOfDay(Date.now()))}>{PLANNER_COPY.today}</button>
        {(['month', 'week', 'day'] as const).map((item) => (
          <button key={item} type="button" data-planner-view={item} className={`min-h-11 rounded-full px-3 text-sm font-semibold ${view === item ? 'bg-[#1E6A83] text-white' : 'border'}`} onClick={() => setView(item)}>
            {PLANNER_COPY[item]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-[#203337]">
        {PLANNER_KINDS.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR[kind] }} />
            {PLANNER_COPY.kinds[kind]}
          </span>
        ))}
      </div>
      <div className={`grid gap-2 ${grid}`}>
        {days.map((day) => {
          const rows = itemsOn(events.map((event) => ({
            id: event.id,
            title: event.title,
            ownerId: event.ownerId,
            ownerName: event.ownerId,
            institutionId: '',
            className: event.className,
            dueAt: event.dueAt,
            status: event.status,
            notes: event.notes,
            attachmentName: '',
            reminder: event.reminder,
            source: 'planner',
            sourceId: event.id,
          })), day);
          return (
            <div
              key={day}
              data-planner-day={day}
              className="min-h-28 rounded-2xl border border-[#1E6A83]/15 bg-white p-2"
              onDragOver={(drag) => drag.preventDefault()}
              onDrop={(drag) => {
                const id = drag.dataTransfer.getData('text/plain');
                const event = events.find((item) => item.id === id);
                if (event) void move(event, day);
              }}
            >
              <p className="text-xs font-semibold text-[#1E6A83]">{new Date(day).getDate()}</p>
              {rows.length === 0 ? <p className="mt-2 text-[11px] text-[#203337]/45">{PLANNER_COPY.empty}</p> : null}
              {rows.map((row) => {
                const event = events.find((item) => item.id === row.id);
                if (!event) return null;
                return (
                  <button
                    key={event.id}
                    type="button"
                    draggable
                    data-planner-item={event.kind}
                    onDragStart={(drag) => drag.dataTransfer.setData('text/plain', event.id)}
                    onClick={() => open(event)}
                    className="mt-1 block w-full truncate rounded-lg px-2 py-1 text-left text-xs font-semibold text-white"
                    style={{ background: KIND_COLOR[event.kind] }}
                  >
                    {event.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <form className="grid gap-3 rounded-3xl border border-[#1E6A83]/20 bg-white p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.title}
          <input value={draft.title} data-planner-title="1" onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
        </label>
        <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.kind}
          <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: asKind(event.target.value) })} className="mt-1 w-full min-h-11 rounded-xl border px-3">
            {PLANNER_KINDS.map((kind) => <option key={kind} value={kind}>{PLANNER_COPY.kinds[kind]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.className}
          <input value={draft.className} onChange={(event) => setDraft({ ...draft, className: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
        </label>
        <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.when}
          <input type="datetime-local" value={draft.when} onChange={(event) => setDraft({ ...draft, when: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
        </label>
        <label className="text-sm font-semibold text-[#203337] sm:col-span-2">{PLANNER_COPY.notes}
          <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="text-sm font-semibold text-[#203337] sm:col-span-2">{PLANNER_COPY.reminder}
          <input value={draft.reminder} onChange={(event) => setDraft({ ...draft, reminder: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-[#3FE0D0] px-4 text-sm font-bold text-[#203337]">{PLANNER_COPY.create}</button>
      </form>
      {selected ? (
        <article className="rounded-3xl border border-[#1E6A83]/20 bg-white p-4" data-planner-detail="1">
          <h2 className="font-heading text-2xl text-[#203337]">{PLANNER_COPY.details}</h2>
          <p className="text-sm text-[#1E6A83]">{PLANNER_COPY.kinds[selected.kind]} · {new Date(selected.dueAt).toLocaleString('en-GB')}</p>
          {selected.ownerId === user?.uid ? (
            <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
              <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.title}
                <input value={edit.title} data-planner-edit-title="1" disabled={selected.source !== 'planner'} onChange={(event) => setEdit({ ...edit, title: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
              </label>
              <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.kind}
                <select value={edit.kind} disabled={selected.source !== 'planner'} onChange={(event) => setEdit({ ...edit, kind: asKind(event.target.value) })} className="mt-1 w-full min-h-11 rounded-xl border px-3">
                  {PLANNER_KINDS.map((kind) => <option key={kind} value={kind}>{PLANNER_COPY.kinds[kind]}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.className}
                <input value={edit.className} onChange={(event) => setEdit({ ...edit, className: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
              </label>
              <label className="text-sm font-semibold text-[#203337]">{PLANNER_COPY.when}
                <input type="datetime-local" value={edit.when} onChange={(event) => setEdit({ ...edit, when: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
              </label>
              <label className="text-sm font-semibold text-[#203337] sm:col-span-2">{PLANNER_COPY.notes}
                <textarea value={edit.notes} onChange={(event) => setEdit({ ...edit, notes: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2" />
              </label>
              <label className="text-sm font-semibold text-[#203337] sm:col-span-2">{PLANNER_COPY.reminder}
                <input value={edit.reminder} onChange={(event) => setEdit({ ...edit, reminder: event.target.value })} className="mt-1 w-full min-h-11 rounded-xl border px-3" />
              </label>
              <button type="submit" className="min-h-11 rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white">{PLANNER_COPY.saveChanges}</button>
              {selected.source === 'planner' ? (
                <button type="button" className="min-h-11 rounded-full border px-4 text-sm" onClick={() => void remove(selected)}>{PLANNER_COPY.remove}</button>
              ) : null}
            </form>
          ) : (
            <>
              <p className="mt-2 font-semibold">{selected.title}</p>
              <p className="mt-2 text-sm text-[#203337]">{selected.notes}</p>
            </>
          )}
        </article>
      ) : null}
    </section>
  );
}
