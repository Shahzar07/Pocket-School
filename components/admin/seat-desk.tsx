'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/api-client';
import type { AllocationKind, AllocationTarget } from '@/lib/admin/allocations';

interface Row {
  id: string;
  kind: string;
  courseId: string;
  plan: string;
  targetType: string;
  targetLabel: string;
  seats: number;
  startsOn: string;
  endsOn: string;
  status: string;
}

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#D5E6EA] bg-white px-3 text-sm text-[#203337]';

export function SeatDesk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [comingSoon, setComingSoon] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<AllocationKind>('course');
  const [targetType, setTargetType] = useState<AllocationTarget>('institution');
  const [targetId, setTargetId] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [courseId, setCourseId] = useState('');
  const [plan, setPlan] = useState('team');
  const [seats, setSeats] = useState(25);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [institutionId, setInstitutionId] = useState('');

  const load = () => authedFetch('/api/admin/allocations').then((data) => {
    setRows(Array.isArray(data.allocations) ? data.allocations as Row[] : []);
    setComingSoon(data.comingSoon === true);
    setCanCreate(data.canCreate === true);
    if (data.comingSoon && typeof data.error === 'string') setNote(data.error);
  });

  useEffect(() => {
    load().catch((error: unknown) => setNote(error instanceof Error ? error.message : 'Could not load allocations.'));
  }, []);

  const create = async () => {
    try {
      const data = await authedFetch('/api/admin/allocations', {
        method: 'POST',
        body: JSON.stringify({ kind, targetType, targetId, targetLabel, courseId, plan, seats, startsOn, endsOn, institutionId }),
      });
      if (data.comingSoon) {
        setNote(typeof data.error === 'string' ? data.error : 'The allocation list needs the Firebase Admin key. This admin tool is coming soon.');
        return;
      }
      setOpen(false);
      setNote('Allocation saved.');
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not save that allocation.');
    }
  };

  return (
    <section className="space-y-4 rounded-[24px] border border-[#D5E6EA] bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl text-[#203337]">Seat allocations</h2>
          <p className="mt-1 max-w-xl text-sm text-[#1E6A83]">An allocation gives a course or a plan to an institution, a class, or a user, for a number of seats and a date range.</p>
        </div>
        {canCreate ? (
          <button type="button" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]" onClick={() => setOpen(true)}>New allocation</button>
        ) : null}
      </div>
      {comingSoon ? <p className="text-sm text-[#203337]">{note}</p> : null}
      {rows.length === 0 && !comingSoon ? (
        <div className="rounded-2xl bg-[#F4F7F8] px-4 py-6">
          <p className="font-semibold text-[#203337]">No allocations yet</p>
          <p className="mt-1 text-sm text-[#1E6A83]">When a school, class, or person is given seats, the row appears here. Course grants for one email stay in the people search below.</p>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F4F7F8] px-3 py-3 text-sm text-[#203337]">
              <span>{row.targetLabel} · {row.kind === 'plan' ? row.plan : row.courseId} · {row.seats} seats</span>
              <span className="text-[#1E6A83]">{row.startsOn} to {row.endsOn} · {row.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {note && !comingSoon ? <p className="text-sm text-[#203337]">{note}</p> : null}
      {open ? (
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void create(); }}>
          <label className="text-sm text-[#203337]">What
            <select aria-label="Allocation kind" className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as AllocationKind)}>
              <option value="course">Course</option>
              <option value="plan">Plan</option>
            </select>
          </label>
          <label className="text-sm text-[#203337]">Who
            <select aria-label="Allocation target" className={fieldClass} value={targetType} onChange={(event) => setTargetType(event.target.value as AllocationTarget)}>
              <option value="institution">Institution</option>
              <option value="class">Class</option>
              <option value="user">User</option>
            </select>
          </label>
          {kind === 'course' ? (
            <label className="text-sm text-[#203337]">Course id
              <input className={fieldClass} aria-label="Course id" value={courseId} onChange={(event) => setCourseId(event.target.value)} />
            </label>
          ) : (
            <label className="text-sm text-[#203337]">Plan
              <input className={fieldClass} aria-label="Plan" value={plan} onChange={(event) => setPlan(event.target.value)} />
            </label>
          )}
          <label className="text-sm text-[#203337]">Seats
            <input className={fieldClass} aria-label="Seats" type="number" min={1} value={seats} onChange={(event) => setSeats(Number(event.target.value))} />
          </label>
          <label className="text-sm text-[#203337]">Name
            <input className={fieldClass} aria-label="Recipient name" value={targetLabel} onChange={(event) => setTargetLabel(event.target.value)} />
          </label>
          <label className="text-sm text-[#203337]">Record id
            <input className={fieldClass} aria-label="Recipient id" value={targetId} onChange={(event) => setTargetId(event.target.value)} />
          </label>
          <label className="text-sm text-[#203337]">Institution id
            <input className={fieldClass} aria-label="Institution id" value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} />
          </label>
          <label className="text-sm text-[#203337]">Starts
            <input className={fieldClass} aria-label="Start date" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
          </label>
          <label className="text-sm text-[#203337]">Ends
            <input className={fieldClass} aria-label="End date" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" className="rounded-full border border-[#D5E6EA] px-4 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="rounded-full border border-[#1E6A83] bg-[#3FE0D0] px-4 py-2 text-sm font-semibold text-[#203337]">Save allocation</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
