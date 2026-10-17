'use client';

import { useState } from 'react';
import { MESSAGE_KINDS, MESSAGE_TEMPLATES, SEAT_NOTE, type MessageKind } from '@/lib/alumni-network';

export interface NetworkDeskData {
  stats: {
    reached: number;
    opened: number;
    clicked: number;
    replies: number;
    events: number;
    rsvps: number;
    mentorships: number;
    pendingMentors: number;
  };
  campaigns: {
    id: string;
    kind: string;
    subject: string;
    sendOn: string;
    status: string;
    reached: number;
    opened: number;
    clicked: number;
    replies: number;
    filter?: { year?: string; level?: string; className?: string };
  }[];
  groups: { id: string; name: string; members: number }[];
  held: { id: string; body: string; authorName: string; kind?: string }[];
  mentors: { id: string; mentorName: string; studentName: string; status: string; moderated: boolean }[];
  updates?: { name: string; destination: string; job: string }[];
  seatNote: string;
}

const STATS: { key: keyof NetworkDeskData['stats']; label: string }[] = [
  { key: 'reached', label: 'Reach' },
  { key: 'opened', label: 'Opens' },
  { key: 'clicked', label: 'Clicks' },
  { key: 'replies', label: 'Replies' },
  { key: 'events', label: 'Events' },
  { key: 'rsvps', label: 'RSVPs' },
  { key: 'mentorships', label: 'Mentorships' },
  { key: 'pendingMentors', label: 'Pending' },
];

function StatRow({ stats }: { stats: NetworkDeskData['stats'] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STATS.map((item) => (
        <div key={item.key} className="rounded-2xl bg-white px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-brand-ink/70">{item.label}</p>
          <p className="text-2xl font-semibold text-brand-ink">{stats[item.key]}</p>
        </div>
      ))}
    </div>
  );
}

export function InstitutionNetworkDesk({
  desk,
  onCampaign,
  onEvent,
  onModerate,
  onApprove,
}: {
  desk: NetworkDeskData;
  onCampaign: (input: { kind: MessageKind; note: string; sendOn: string; filter: Record<string, string> }) => void;
  onEvent: (input: { title: string; when: string; place: string }) => void;
  onModerate: (queueId: string, release: boolean) => void;
  onApprove: (mentorshipId: string) => void;
}) {
  const [kind, setKind] = useState<MessageKind>('reunion');
  const [note, setNote] = useState('');
  const [sendOn, setSendOn] = useState('');
  const [year, setYear] = useState('');
  const [level, setLevel] = useState('');
  const [programme, setProgramme] = useState('');
  const [className, setClassName] = useState('');
  const [country, setCountry] = useState('');
  const [destination, setDestination] = useState('');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('');
  const filter = { year, level, programme, className, country, destination };

  return (
    <section className="space-y-4 rounded-3xl bg-brand-foam p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-brand-ink">Alumni communications</h2>
        <p className="mt-1 text-sm text-brand-ink">{desk.seatNote || SEAT_NOTE}</p>
      </div>
      <StatRow stats={desk.stats} />
      <div className="flex flex-wrap gap-2">
        {MESSAGE_KINDS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(item)}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${kind === item ? 'bg-brand-ink text-white' : 'bg-white text-brand-ink'}`}
          >
            {MESSAGE_TEMPLATES[item].label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={year} onChange={(event) => setYear(event.target.value)} placeholder="Cohort" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <input value={level} onChange={(event) => setLevel(event.target.value)} placeholder="Level" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <input value={programme} onChange={(event) => setProgramme(event.target.value)} placeholder="Programme" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Class" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Destination" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
      </div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a short note. Email, inbox, and push follow each person's consent." className="min-h-24 w-full rounded-2xl bg-white p-3 text-sm text-brand-ink" />
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={sendOn} onChange={(event) => setSendOn(event.target.value)} className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <button type="button" onClick={() => onCampaign({ kind, note, sendOn, filter })} className="h-11 rounded-full bg-brand-mid px-5 text-sm font-semibold text-white">
          {sendOn ? 'Schedule' : 'Send now'}
        </button>
      </div>
      <ul className="space-y-2">
        {desk.campaigns.map((campaign) => (
          <li key={campaign.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-brand-ink">
            <p className="font-semibold">{campaign.subject}</p>
            <p>
              {campaign.status} · reach {campaign.reached} · opens {campaign.opened} · clicks {campaign.clicked} · replies {campaign.replies}
              {campaign.filter?.year ? ` · cohort ${campaign.filter.year}` : ''}
            </p>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reunion title" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <input value={when} onChange={(event) => setWhen(event.target.value)} placeholder="When" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
        <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Place" className="h-11 rounded-xl bg-white px-3 text-sm text-brand-ink" />
      </div>
      <button type="button" onClick={() => onEvent({ title, when, place })} className="h-11 rounded-full bg-brand-mid px-5 text-sm font-semibold text-white">
        Publish event
      </button>
      {desk.groups.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {desk.groups.map((group) => (
            <li key={group.id} className="rounded-full bg-white px-3 py-2 text-sm text-brand-ink">{group.name} · {group.members}</li>
          ))}
        </ul>
      )}
      {desk.held.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-ink">Waiting for a moderator</h3>
          {desk.held.map((post) => (
            <div key={post.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-brand-ink">
              <p className="font-semibold">{post.authorName}</p>
              <p>{post.body}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => onModerate(post.id, true)} className="h-10 rounded-full bg-brand-ink px-4 text-sm font-semibold text-white">Release</button>
                <button type="button" onClick={() => onModerate(post.id, false)} className="h-10 rounded-full bg-brand-bright px-4 text-sm font-semibold text-white">Block</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {desk.updates && desk.updates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-ink">Destinations shared with this academy</h3>
          {desk.updates.map((row) => (
            <p key={`${row.name}-${row.destination}`} className="rounded-2xl bg-white px-4 py-3 text-sm text-brand-ink">
              {row.name}{row.job ? ` · ${row.job}` : ''}{row.destination ? ` · ${row.destination}` : ''}
            </p>
          ))}
        </div>
      )}
      {desk.mentors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-brand-ink">Mentorship</h3>
          {desk.mentors.map((row) => (
            <div key={row.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-brand-ink">
              <p>{row.mentorName} with {row.studentName}</p>
              <p>{row.status}{row.moderated ? ' · the academy can read this thread' : ''}</p>
              {row.status === 'pending' && (
                <button type="button" onClick={() => onApprove(row.id)} className="mt-2 h-10 rounded-full bg-brand-ink px-4 text-sm font-semibold text-white">Approve</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AlumniNetworkShowcase() {
  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-3xl bg-brand-foam p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-ink">Alumni communications</h1>
          <p className="mt-1 text-sm text-brand-ink">{SEAT_NOTE}</p>
        </div>
        <StatRow stats={{ reached: 40, opened: 18, clicked: 7, replies: 3, events: 1, rsvps: 12, mentorships: 2, pendingMentors: 1 }} />
        <div className="flex flex-wrap gap-2">
          {MESSAGE_KINDS.map((item) => (
            <span key={item} className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ${item === 'reunion' ? 'bg-brand-ink text-white' : 'bg-white text-brand-ink'}`}>
              {MESSAGE_TEMPLATES[item].label}
            </span>
          ))}
        </div>
        <p className="text-sm text-brand-ink">Filtered to cohort 2026 · Professional · class Oak</p>
        <article className="rounded-2xl bg-white px-4 py-3 text-sm text-brand-ink">
          <p className="font-semibold">A reunion at North Academy</p>
          <p>sent · reach 40 · opens 18 · clicks 7 · replies 3 · cohort 2026</p>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-brand-ink">Oak 2026</h2>
          <p className="text-sm text-brand-ink">Classmates who opted in. Names stay as a first name and last initial.</p>
          <p className="rounded-2xl bg-brand-mist px-4 py-3 text-sm text-brand-ink">Ada L. · Professional · Oxford</p>
          <div className="rounded-2xl border border-brand-mid px-4 py-3 text-sm text-brand-ink">
            <p className="font-semibold">Sam T.</p>
            <p>Can I bring a friend to the reunion?</p>
            <p className="mt-1 text-brand-mid">Held for an academy moderator. Direct messages stay off for anyone under 18.</p>
          </div>
          <p className="rounded-2xl bg-brand-ink px-4 py-3 text-sm text-white">Reunion on the green · Ada L. is going</p>
        </article>
        <article className="space-y-3 rounded-3xl bg-brand-ink p-4 text-white sm:p-6">
          <h2 className="text-xl font-semibold">Mentorship</h2>
          <p className="text-sm text-brand-mid">Opt-in, academy-approved, and moderated when the student is under 18.</p>
          <p className="rounded-2xl bg-white/10 px-4 py-3 text-sm">Ada L. with Sam T. · pending approval · the academy can read this thread</p>
          <p className="text-sm text-brand-mid">This link costs the academy no seat.</p>
        </article>
      </section>
    </div>
  );
}
