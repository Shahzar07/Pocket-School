'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { YearbookFlipbook } from '@/components/alumni/yearbook-panels';
import type { GeoPlace } from '@/lib/insights/census';

const WorldMap = dynamic(() => import('@/components/insights/world-map').then((mod) => mod.WorldMap), {
  ssr: false,
  loading: () => <div className="h-40 rounded-2xl bg-[#102820]" aria-hidden />,
});

interface Person {
  name: string;
  cohort: string;
  className: string;
  country: string;
  destination: string;
  optedIn: boolean;
}

const PEOPLE: Person[] = [
  { name: 'Omar H.', cohort: '2019', className: 'Oak', country: 'Malaysia', destination: 'Medicine', optedIn: true },
  { name: 'Priya S.', cohort: '2026', className: 'Oak', country: 'Malaysia', destination: 'Engineering', optedIn: true },
  { name: 'Wei L.', cohort: '2026', className: 'Cedar', country: 'Singapore', destination: 'Design', optedIn: true },
  { name: 'Amina R.', cohort: '2026', className: 'Oak', country: 'Malaysia', destination: 'Sciences', optedIn: false },
  { name: 'Noah K.', cohort: '2018', className: 'Cedar', country: 'United Kingdom', destination: 'Law', optedIn: true },
  { name: 'Sara M.', cohort: '2019', className: 'Oak', country: 'Malaysia', destination: 'Medicine', optedIn: true },
  { name: 'Leo P.', cohort: '2017', className: 'Birch', country: 'Malaysia', destination: 'Business', optedIn: true },
  { name: 'Maya T.', cohort: '2019', className: 'Oak', country: 'Malaysia', destination: 'Teaching', optedIn: true },
  { name: 'Hana Y.', cohort: '2019', className: 'Birch', country: 'Japan', destination: 'Design', optedIn: true },
];

const CLASS_EVENTS = [
  { id: 'reunion', title: 'Oak reunion on the green', when: '12 Dec 2026 · 16:00 Asia/Kuala_Lumpur', place: 'School field' },
  { id: 'talk', title: 'Alumni career talk: medicine', when: '19 Nov 2026 · 18:00 Asia/Kuala_Lumpur', place: 'Online' },
];

export function RochfordAlumniDesk() {
  const [cohort, setCohort] = useState('all');
  const [className, setClassName] = useState('all');
  const [going, setGoing] = useState<string[]>([]);
  const [mentor, setMentor] = useState(false);
  const [giving, setGiving] = useState(false);
  const [group, setGroup] = useState('');
  const [approved, setApproved] = useState(true);
  const [joined, setJoined] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('poket-alumni-rochford') || 'null') as { going?: string[]; joined?: boolean; mentor?: boolean; giving?: boolean; group?: string } | null;
      if (saved) {
        setGoing(saved.going ?? []);
        setJoined(Boolean(saved.joined));
        setMentor(Boolean(saved.mentor));
        setGiving(Boolean(saved.giving));
        setGroup(saved.group ?? '');
      }
    } catch {
      /* first visit */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem('poket-alumni-rochford', JSON.stringify({ going, joined, mentor, giving, group }));
  }, [going, joined, mentor, giving, group, ready]);
  const directory = useMemo(
    () => PEOPLE.filter((person) => person.optedIn && (cohort === 'all' || person.cohort === cohort) && (className === 'all' || person.className === className)),
    [cohort, className],
  );
  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of PEOPLE.filter((row) => row.optedIn)) counts.set(person.country, (counts.get(person.country) ?? 0) + 1);
    return [...counts.entries()].filter(([, count]) => count >= 5).map(([name, count]) => ({ name, count }));
  }, []);

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Rochford demo · Alumni desk · Rochford&apos;s International School</p>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-2xl">Directory</h2>
          <button type="button" className="h-10 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" onClick={() => setJoined(true)}>{joined ? 'Joined' : 'Join this alumni network'}</button>
        </div>
        {joined ? <p className="mt-1 text-sm text-[#1E6A83]">You are in the Rochford alumni network. This stays after a reload on this device.</p> : null}
        <p className="mt-1 text-sm text-[#1E6A83]">Opt-in only. Names stay as a first name and last initial.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="text-sm font-semibold">Cohort
            <select className="ml-2 h-10 rounded-xl border px-2" value={cohort} onChange={(event) => setCohort(event.target.value)}>
              <option value="all">All</option>
              <option>2026</option>
              <option>2019</option>
              <option>2018</option>
              <option>2017</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Class
            <select className="ml-2 h-10 rounded-xl border px-2" value={className} onChange={(event) => setClassName(event.target.value)}>
              <option value="all">All</option>
              <option>Oak</option>
              <option>Cedar</option>
              <option>Birch</option>
            </select>
          </label>
        </div>
        <ul className="mt-3 divide-y divide-[#E7EDED]">
          {directory.map((person) => (
            <li key={person.name} className="py-2 text-sm">{person.name} · {person.cohort} · {person.className} · {person.destination} · {person.country}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <h2 className="font-heading text-2xl">Oak class network</h2>
        <p className="mt-1 text-sm text-[#1E6A83]">The class wall, events, and opt-in mentoring.</p>
        <a href="/dashboard/community" className="mt-2 inline-flex h-10 items-center text-sm font-semibold text-[#1E6A83]">Open the class wall</a>
        <ul className="mt-3 space-y-2">
          {CLASS_EVENTS.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7FBFC] px-3 py-2 text-sm">
              <span><span className="font-semibold">{event.title}</span> · {event.when} · {event.place}</span>
              <button type="button" className="h-9 rounded-full bg-[#3FE0D0] px-3 text-sm font-semibold text-[#203337]" onClick={() => setGoing((current) => current.includes(event.id) ? current : [...current, event.id])}>
                {going.includes(event.id) ? 'Going' : 'RSVP'}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-3 h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" onClick={() => setMentor((value) => !value)}>
          {mentor ? 'Mentoring opted in' : 'Opt in to mentoring'}
        </button>
      </section>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <h2 className="font-heading text-2xl">Yearbook</h2>
        <p className="mt-1 text-sm text-[#1E6A83]">Lock date 1 July 2026. {approved ? 'School approved.' : 'Waiting for school approval.'}</p>
        <button type="button" className="mt-2 h-10 rounded-full border px-4 text-sm font-semibold" onClick={() => setApproved((value) => !value)}>{approved ? 'Mark as waiting' : 'Approve for the school'}</button>
        <div className="mt-4">
          <YearbookFlipbook
            template="deep"
            academy="Rochford's International School"
            sheets={[
              { heading: 'Oak 2026', lines: ['Lock date 1 July 2026', approved ? 'Approved' : 'Draft'] },
              { heading: 'Omar H.', lines: ['Class of 2019', 'Medicine', 'Kuala Lumpur'] },
              { heading: 'Priya S.', lines: ['IGCSE', 'Engineering pathway'] },
            ]}
          />
        </div>
        <a className="mt-3 inline-flex h-10 items-center text-sm font-semibold text-[#1E6A83]" href="/preview/yearbook">Open the printable yearbook</a>
      </section>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <h2 className="font-heading text-2xl">Where are they now</h2>
        <p className="mt-1 text-sm text-[#1E6A83]">Countries with fewer than five opted-in alumni stay hidden.</p>
        <div className="mt-3">
          <WorldMap
            places={countries.map((row): GeoPlace => ({
              country: row.name === 'Malaysia' ? 'MY' : row.name,
              students: row.count,
              parents: 0,
              teachers: 0,
              institutions: 1,
              states: [],
              cities: [],
            }))}
            selected=""
            onPick={() => undefined}
          />
        </div>
        <ul className="mt-3 space-y-2">
          {countries.length === 0 ? <li className="text-sm">No country has five people yet.</li> : countries.map((row) => (
            <li key={row.name} className="flex items-center justify-between rounded-2xl bg-[#F7FBFC] px-3 py-2 text-sm">
              <span>{row.name}</span><span className="font-semibold">{row.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <h2 className="font-heading text-2xl">Reunion planner</h2>
        <p className="mt-1 text-sm">12 Dec 2026, 16:00 Asia/Kuala Lumpur, school field. {going.includes('reunion') ? 'You are going.' : 'RSVP from the class network.'}</p>
      </section>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <h2 className="font-heading text-2xl">Alumni career talks</h2>
        <p className="mt-1 text-sm">Omar H. · A day in medicine · 19 Nov 2026 · online.</p>
      </section>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <h2 className="font-heading text-2xl">Alumni giving</h2>
        <p className="mt-1 text-sm text-[#1E6A83]">{giving ? 'Giving is on for this school. Sandbox only.' : 'Alumni giving is off.'}</p>
        <button type="button" className="mt-2 h-10 rounded-full border px-4 text-sm font-semibold" onClick={() => setGiving((value) => !value)}>{giving ? 'Turn giving off' : 'Turn giving on'}</button>
      </section>

      <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
        <h2 className="font-heading text-2xl">Independent learners</h2>
        <p className="mt-1 text-sm text-[#1E6A83]">Verify through a school, or join a self-reported group.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="inline-flex h-10 items-center rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white" href="/institutions/register">Verify through a school</a>
          <button type="button" className="h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" onClick={() => setGroup('Independent learners')}>Join a self-reported group</button>
        </div>
        {group ? <p className="mt-2 text-sm">Joined {group}.</p> : null}
      </section>
    </div>
  );
}
