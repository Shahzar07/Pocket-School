'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { useAuthSTORE } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import {
  googleCalendarUrl, icsFor, removeEvent, rsvp, seatsLeft, upsertEvent,
  type CareerEvent, type CareerRegistration, type VenueKind,
} from '@/lib/career/events';

const BLANK: CareerEvent = {
  id: '',
  title: '',
  speaker: '',
  organiser: "Rochford's International School",
  date: '2026-11-20',
  start: '16:00',
  end: '17:00',
  timezone: 'Asia/Kuala_Lumpur',
  venueKind: 'hybrid',
  address: '',
  mapUrl: '',
  onlineUrl: '',
  capacity: 30,
  taken: 0,
  eligibility: 'Current students',
  reminder: '1 day before',
};

export interface PassportSkill { name: string; evidence: string; visible: boolean }
export interface JobOpening { title: string; employer: string; level: string; deadline: string }
export interface MentorOffer { name: string; field: string; optedIn: boolean }

export function EventsDesk({
  initial,
  person,
  canEdit,
  skills,
  matches,
  jobs,
  mentors,
}: {
  initial: CareerEvent[];
  person: string;
  canEdit: boolean;
  skills: PassportSkill[];
  matches: { title: string; organisation: string; kind: string }[];
  jobs: JobOpening[];
  mentors: MentorOffer[];
}) {
  const { user } = useAuthSTORE();
  const uid = user?.uid ?? '';
  const [events, setEvents] = useState(initial);
  const [registrations, setRegistrations] = useState<CareerRegistration[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!uid) return;
    const eventsUnsub = onSnapshot(
      query(collection(db, 'career_events'), orderBy('date'), orderBy('start'), limit(40)),
      (snap) => {
        if (snap.empty) return;
        setEvents(snap.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            title: String(data.title ?? ''),
            speaker: String(data.speaker ?? ''),
            organiser: String(data.organiser ?? ''),
            date: String(data.date ?? ''),
            start: String(data.start ?? ''),
            end: String(data.end ?? ''),
            timezone: String(data.timezone ?? 'Asia/Kuala_Lumpur'),
            venueKind: (data.venueKind === 'online' || data.venueKind === 'in_person' || data.venueKind === 'hybrid') ? data.venueKind : 'hybrid',
            address: String(data.address ?? ''),
            mapUrl: String(data.mapUrl ?? ''),
            onlineUrl: String(data.onlineUrl ?? ''),
            capacity: Number(data.capacity ?? 0),
            taken: Number(data.taken ?? 0),
            eligibility: String(data.eligibility ?? ''),
            reminder: String(data.reminder ?? ''),
          };
        }));
      },
      () => setNotice('Events could not be loaded.'),
    );
    const regsUnsub = onSnapshot(
      query(collection(db, 'career_registrations'), where('userId', '==', uid), orderBy('eventId'), limit(40)),
      (snap) => {
        setRegistrations(snap.docs.map((item) => {
          const data = item.data();
          return {
            eventId: String(data.eventId ?? ''),
            name: String(data.name ?? person),
            reminder: String(data.reminder ?? ''),
          };
        }));
      },
    );
    return () => {
      eventsUnsub();
      regsUnsub();
    };
  }, [uid, person]);
  const [tab, setTab] = useState<'events' | 'passport' | 'matcher' | 'jobs' | 'cv' | 'mentoring'>('events');
  const [draft, setDraft] = useState<CareerEvent | null>(null);
  const shown = useMemo(
    () => events.map((event) => ({
      ...event,
      taken: event.taken + (registrations.some((row) => row.eventId === event.id) ? 1 : 0),
    })),
    [events, registrations],
  );
  const mine = useMemo(
    () => events.filter((event) => registrations.some((row) => row.eventId === event.id && row.name === person)),
    [events, registrations, person],
  );

  const book = (event: CareerEvent) => {
    if (!uid) {
      setNotice('Sign in to register.');
      return;
    }
    const result = rsvp(event, registrations, person, event.reminder);
    if (!result.accepted) {
      setNotice('That event is full.');
      return;
    }
    const row = result.registrations.find((item) => item.eventId === event.id && item.name === person);
    void setDoc(doc(db, 'career_registrations', `${uid}_${event.id}`), {
      userId: uid,
      eventId: event.id,
      name: person,
      reminder: row?.reminder || event.reminder,
    }).then(() => {
      setNotice(`Registered for ${event.title}. Reminder: ${event.reminder}.`);
    }).catch(() => setNotice('The registration could not be saved.'));
  };

  const download = (event: CareerEvent) => {
    const blob = new Blob([icsFor(event)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.id}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E6A83]">Rochford demo · {person}</p>
      <div className="flex flex-wrap gap-2">
        {([
          ['events', 'Events'],
          ['passport', 'Skills passport'],
          ['matcher', 'ET AI matcher'],
          ['jobs', 'Job board'],
          ['cv', 'Verified CV'],
          ['mentoring', 'Mentoring'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`h-10 rounded-full px-4 text-sm font-semibold ${tab === id ? 'bg-[#3FE0D0] text-[#203337]' : 'border border-[#E7EDED] bg-white text-[#1E6A83]'}`}>{label}</button>
        ))}
      </div>
      {notice ? <p role="status" className="text-sm text-[#1E6A83]">{notice}</p> : null}

      {tab === 'events' ? (
        <div className="space-y-4">
          {canEdit ? (
            <button type="button" className="h-10 rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white" onClick={() => setDraft({ ...BLANK, id: `event-${events.length + 1}` })}>Add an event</button>
          ) : null}
          <ul className="space-y-3">
            {shown.map((event) => (
              <li key={event.id} className="rounded-3xl border border-[#E7EDED] bg-white p-4">
                <p className="font-heading text-xl text-[#203337]">{event.title}</p>
                <p className="mt-1 text-sm text-[#1E6A83]">{event.speaker} · {event.organiser}</p>
                <p className="mt-2 text-sm text-[#203337]">{event.date} · {event.start}–{event.end} · {event.timezone}</p>
                <p className="text-sm text-[#203337]">
                  {event.venueKind === 'online' ? 'Online' : event.venueKind === 'hybrid' ? 'Hybrid' : 'In person'}
                  {event.address ? ` · ${event.address}` : ''}
                </p>
                <p className="mt-1 flex flex-wrap gap-3 text-sm">
                  {event.mapUrl ? <a className="font-semibold text-[#1E6A83]" href={event.mapUrl}>Map</a> : null}
                  {event.onlineUrl ? <a className="font-semibold text-[#1E6A83]" href={event.onlineUrl}>Online link</a> : null}
                </p>
                <p className="mt-2 text-sm text-[#203337]">{seatsLeft(event)} seats left of {event.capacity}. {event.eligibility}.</p>
                <p className="text-sm text-[#1E6A83]">Reminder: {event.reminder}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" data-action="career-rsvp" className="h-10 rounded-full bg-[#3FE0D0] px-4 text-sm font-semibold text-[#203337]" onClick={() => book(event)}>RSVP</button>
                  <button type="button" className="h-10 rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" onClick={() => download(event)}>Download .ics</button>
                  <a className="inline-flex h-10 items-center rounded-full border border-[#1E6A83] px-4 text-sm font-semibold text-[#1E6A83]" href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">Google Calendar</a>
                  {canEdit ? (
                    <>
                      <button type="button" className="h-10 rounded-full border border-[#E7EDED] px-4 text-sm font-semibold" onClick={() => setDraft(event)}>Edit</button>
                      <button type="button" className="h-10 rounded-full border border-[#E7EDED] px-4 text-sm font-semibold" onClick={() => {
                        if (!uid) return;
                        void deleteDoc(doc(db, 'career_events', event.id)).then(() => setEvents((current) => removeEvent(current, event.id))).catch(() => setNotice('The event could not be deleted.'));
                      }}>Delete</button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <section className="rounded-3xl border border-[#E7EDED] bg-white p-4">
            <h2 className="font-heading text-xl">My registrations</h2>
            {mine.length === 0 ? <p className="mt-2 text-sm text-[#1E6A83]">You have not registered yet.</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {mine.map((event) => <li key={event.id}>{event.title} · {event.date} · {registrations.find((row) => row.eventId === event.id)?.reminder}</li>)}
              </ul>
            )}
          </section>
          {draft ? (
            <form className="grid gap-2 rounded-3xl border border-[#E7EDED] bg-white p-4 sm:grid-cols-2" onSubmit={(formEvent) => {
              formEvent.preventDefault();
              if (!draft.title.trim() || !uid) return;
              void setDoc(doc(db, 'career_events', draft.id), { ...draft, ownerId: uid }).then(() => {
                setEvents((current) => upsertEvent(current, draft));
                setDraft(null);
                setNotice('Event saved.');
              }).catch(() => setNotice('The event could not be saved.'));
            }}>
              <label className="text-sm font-semibold">Title<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label className="text-sm font-semibold">Speaker<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.speaker} onChange={(event) => setDraft({ ...draft, speaker: event.target.value })} /></label>
              <label className="text-sm font-semibold">Organiser<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.organiser} onChange={(event) => setDraft({ ...draft, organiser: event.target.value })} /></label>
              <label className="text-sm font-semibold">Date<input type="date" className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
              <label className="text-sm font-semibold">Start<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
              <label className="text-sm font-semibold">End<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
              <label className="text-sm font-semibold">Timezone<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></label>
              <label className="text-sm font-semibold">Venue
                <select className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.venueKind} onChange={(event) => setDraft({ ...draft, venueKind: event.target.value as VenueKind })}>
                  <option value="in_person">In person</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">Address<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
              <label className="text-sm font-semibold">Map link<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.mapUrl} onChange={(event) => setDraft({ ...draft, mapUrl: event.target.value })} /></label>
              <label className="text-sm font-semibold">Online link<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.onlineUrl} onChange={(event) => setDraft({ ...draft, onlineUrl: event.target.value })} /></label>
              <label className="text-sm font-semibold">Capacity<input type="number" className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: Number(event.target.value) || 0 })} /></label>
              <label className="text-sm font-semibold">Eligibility<input className="mt-1 h-11 w-full rounded-xl border px-3" value={draft.eligibility} onChange={(event) => setDraft({ ...draft, eligibility: event.target.value })} /></label>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="h-10 rounded-full bg-[#1E6A83] px-4 text-sm font-semibold text-white">Save event</button>
                <button type="button" className="h-10 rounded-full border px-4 text-sm font-semibold" onClick={() => setDraft(null)}>Cancel</button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === 'passport' ? (
        <ul className="divide-y divide-[#E7EDED] rounded-3xl border border-[#E7EDED] bg-white px-4">
          {skills.map((skill) => (
            <li key={skill.name} className="py-3">
              <p className="font-semibold">{skill.name}</p>
              <p className="text-sm text-[#1E6A83]">{skill.evidence} · {skill.visible ? 'Shown on the CV' : 'Hidden'}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'matcher' ? (
        <div className="rounded-3xl border border-[#E7EDED] bg-white p-4">
          <h2 className="font-heading text-xl">ET AI matcher</h2>
          <p className="mt-1 text-sm text-[#1E6A83]">Matches come from opportunities the school entered. ET AI does not invent one.</p>
          <ul className="mt-3 space-y-2">
            {matches.map((row) => <li key={row.title} className="text-sm"><span className="font-semibold">{row.title}</span> · {row.organisation} · {row.kind}</li>)}
          </ul>
        </div>
      ) : null}

      {tab === 'jobs' ? (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.title} className="rounded-2xl border border-[#E7EDED] bg-white p-4 text-sm">
              <p className="font-semibold">{job.title}</p>
              <p className="text-[#1E6A83]">{job.employer} · {job.level} · {job.deadline}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'cv' ? (
        <article className="rounded-3xl border border-[#E7EDED] bg-white p-4">
          <h2 className="font-heading text-xl">Verified CV</h2>
          <p className="mt-1 text-sm text-[#1E6A83]">Amina Rahman · IGCSE · Rochford&apos;s International School. Skills below are verified by Poket School. The PDF stays with the student until they share it.</p>
          <ul className="mt-3 list-disc pl-5 text-sm">
            {skills.filter((skill) => skill.visible).map((skill) => <li key={skill.name}>{skill.name} — {skill.evidence}</li>)}
          </ul>
        </article>
      ) : null}

      {tab === 'mentoring' ? (
        <ul className="space-y-2">
          {mentors.map((mentor) => (
            <li key={mentor.name} className="rounded-2xl border border-[#E7EDED] bg-white p-4 text-sm">
              <p className="font-semibold">{mentor.name}</p>
              <p className="text-[#1E6A83]">{mentor.field} · {mentor.optedIn ? 'Opted in' : 'Invite only'}. A teacher approves the match.</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
