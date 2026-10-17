'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { SEAT_NOTE, type AlumniConsent } from '@/lib/alumni-network';

interface AttendedRow {
  institutionId: string;
  institutionName: string;
  level: string;
  className: string;
  seatCounted: boolean;
  destination: string;
  job: string;
  contact: string;
}

interface NetworkView {
  institutionId: string;
  consent: AlumniConsent;
  adult: boolean;
  directory: { name: string; level: string; className: string; destination: string }[];
  groups: { id: string; name: string }[];
  posts: { id: string; groupId: string; body: string; authorName: string; visible: boolean; queued: boolean }[];
  events: { id: string; title: string; when: string; place: string; going: boolean }[];
  mentors: { id: string; status: string; moderated: boolean; mentorName: string; studentName: string }[];
}

interface InboxNote {
  id: string;
  institutionId: string;
  campaignId: string;
  subject: string;
  body: string;
  fromName: string;
}

const CONSENT_FIELDS: { key: keyof AlumniConsent; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'push', label: 'Push' },
  { key: 'directory', label: 'Directory' },
  { key: 'messages', label: 'Direct messages' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
];

export default function ClassNetworkPage() {
  const uid = useAuthSTORE((state) => state.user?.uid ?? '');
  const [attended, setAttended] = useState<AttendedRow[]>([]);
  const [inbox, setInbox] = useState<InboxNote[]>([]);
  const [network, setNetwork] = useState<NetworkView | null>(null);
  const [institutionId, setInstitutionId] = useState('');
  const [post, setPost] = useState('');
  const [reply, setReply] = useState('');
  const [destination, setDestination] = useState('');
  const [job, setJob] = useState('');
  const [contact, setContact] = useState('');
  const [otherId, setOtherId] = useState('');
  const [dm, setDm] = useState('');
  const [studentId, setStudentId] = useState('');

  const load = useCallback((nextId?: string) => {
    const query = nextId ? `?institutionId=${encodeURIComponent(nextId)}` : '';
    authedFetch(`/api/alumni/network${query}`)
      .then((data) => {
        const rows = Array.isArray(data.attended) ? data.attended as AttendedRow[] : [];
        setAttended(rows);
        setInbox(Array.isArray(data.inbox) ? data.inbox as InboxNote[] : []);
        const view = data.network && typeof data.network === 'object' ? data.network as NetworkView : null;
        setNetwork(view);
        setInstitutionId(view?.institutionId || rows[0]?.institutionId || '');
        const current = rows.find((row) => row.institutionId === (view?.institutionId || nextId));
        if (current) {
          setDestination(current.destination || '');
          setJob(current.job || '');
          setContact(current.contact || '');
        }
      })
      .catch(() => toast.error('Could not open the class network.'));
  }, []);

  useEffect(() => { if (uid) load(); }, [uid, load]);

  function send(action: string, extra: Record<string, unknown>, done: string) {
    void authedFetch('/api/alumni/network', {
      method: 'POST',
      body: JSON.stringify({ action, institutionId, ...extra }),
    })
      .then(() => {
        toast.success(done);
        load(institutionId);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save that.'));
  }

  if (!uid) return <p className="p-6 text-sm text-brand-forest">Sign in to open your class network.</p>;

  const groupId = network?.groups[0]?.id ?? '';

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-brand-sand p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-brand-forest">Class network</h1>
        <p className="mt-1 text-sm text-brand-forest">{SEAT_NOTE}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {attended.map((row) => (
            <button
              key={row.institutionId}
              type="button"
              onClick={() => load(row.institutionId)}
              className={`h-10 rounded-full px-4 text-sm font-semibold ${row.institutionId === institutionId ? 'bg-brand-forest text-white' : 'bg-white text-brand-forest'}`}
            >
              {row.institutionName || 'Academy'}
            </button>
          ))}
        </div>
        {attended.length === 0 && <p className="mt-3 text-sm text-brand-forest">Your class groups appear here after you leave an academy. The history stays on this account.</p>}
      </section>

      {network && (
        <section className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-brand-forest">Consent for this academy</h2>
          <div className="flex flex-wrap gap-2">
            {CONSENT_FIELDS.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => send('consent', { consent: { ...network.consent, [field.key]: !network.consent[field.key] } }, 'Consent saved.')}
                className={`h-10 rounded-full px-4 text-sm font-semibold ${network.consent[field.key] ? 'bg-brand-forest text-white' : 'bg-brand-cream text-brand-forest'}`}
              >
                {field.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-brand-forest">Unsubscribe stops email and push from this academy. The inbox choice stays separate.</p>
        </section>
      )}

      {network && (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-brand-forest">{network.groups[0]?.name || 'Class group'}</h2>
            {network.directory.map((person) => (
              <p key={`${person.name}-${person.className}`} className="rounded-2xl bg-brand-cream px-4 py-3 text-sm text-brand-forest">
                {person.name}{person.destination ? ` · ${person.destination}` : ''}
              </p>
            ))}
            {network.posts.map((item) => (
              <div key={item.id} className="rounded-2xl border border-brand-sand px-4 py-3 text-sm text-brand-forest">
                <p className="font-semibold">{item.authorName}</p>
                <p>{item.body}</p>
                {item.queued && <p className="text-brand-coral">Held for an academy moderator.</p>}
                <button type="button" onClick={() => send('report', { postId: item.id, reason: 'Please review this post.' }, 'The report is with the academy.')} className="mt-2 text-sm font-semibold text-brand-blue">Report</button>
              </div>
            ))}
            <textarea value={post} onChange={(event) => setPost(event.target.value)} placeholder="Share an achievement with the class." className="min-h-20 w-full rounded-2xl bg-brand-cream p-3 text-sm text-brand-forest" />
            <button type="button" onClick={() => send('share-achievement', { groupId, body: post }, 'Shared with the class.')} className="h-11 rounded-full bg-brand-gold px-5 text-sm font-semibold text-brand-forest">Share</button>
          </article>
          <article className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-brand-forest">Events</h2>
            {network.events.map((event) => (
              <div key={event.id} className="rounded-2xl bg-brand-cream px-4 py-3 text-sm text-brand-forest">
                <p className="font-semibold">{event.title}</p>
                <p>{event.when} {event.place}</p>
                <button type="button" onClick={() => send('rsvp', { eventId: event.id, going: !event.going }, event.going ? 'RSVP cleared.' : 'You are going.')} className="mt-2 h-10 rounded-full bg-brand-forest px-4 text-sm font-semibold text-white">
                  {event.going ? 'Going' : 'RSVP'}
                </button>
              </div>
            ))}
            <h2 className="text-lg font-semibold text-brand-forest">Direct message</h2>
            <p className="text-sm text-brand-forest">{network.adult ? 'Messages go only to another adult who also opted in.' : 'Direct messages stay off until you are 18. Class posts wait for a moderator.'}</p>
            <input value={otherId} onChange={(event) => setOtherId(event.target.value)} placeholder="Classmate id" className="h-11 w-full rounded-xl bg-brand-cream px-3 text-sm text-brand-forest" />
            <textarea value={dm} onChange={(event) => setDm(event.target.value)} placeholder="A short note" className="min-h-16 w-full rounded-2xl bg-brand-cream p-3 text-sm text-brand-forest" />
            <div className="flex gap-2">
              <button type="button" onClick={() => send('dm', { otherId, body: dm }, 'Sent.')} className="h-11 rounded-full bg-brand-blue px-5 text-sm font-semibold text-white">Send</button>
              <button type="button" onClick={() => send('block', { otherId }, 'Blocked.')} className="h-11 rounded-full bg-brand-coral px-5 text-sm font-semibold text-white">Block</button>
            </div>
          </article>
        </section>
      )}

      {network && (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-brand-forest">Destination and contact</h2>
            <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="University, college, or workplace" className="h-11 w-full rounded-xl bg-brand-cream px-3 text-sm text-brand-forest" />
            <input value={job} onChange={(event) => setJob(event.target.value)} placeholder="Role" className="h-11 w-full rounded-xl bg-brand-cream px-3 text-sm text-brand-forest" />
            <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Contact for this academy" className="h-11 w-full rounded-xl bg-brand-cream px-3 text-sm text-brand-forest" />
            <button type="button" onClick={() => send('update-destination', { destination, job, contact, kind: 'work', shareWithSchools: false }, 'Destination saved.')} className="h-11 rounded-full bg-brand-forest px-5 text-sm font-semibold text-white">Save</button>
          </article>
          <article className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-brand-forest">Mentor a current student</h2>
            <p className="text-sm text-brand-forest">The academy approves the match. A thread with a student under 18 stays readable by the academy.</p>
            <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Current student id" className="h-11 w-full rounded-xl bg-brand-cream px-3 text-sm text-brand-forest" />
            <button type="button" onClick={() => send('mentor-offer', { studentId }, 'The academy has the request.')} className="h-11 rounded-full bg-brand-gold px-5 text-sm font-semibold text-brand-forest">Offer mentorship</button>
            {network.mentors.map((row) => (
              <p key={row.id} className="text-sm text-brand-forest">{row.mentorName} with {row.studentName} · {row.status}{row.moderated ? ' · moderated' : ''}</p>
            ))}
          </article>
        </section>
      )}

      {inbox.length > 0 && (
        <section className="space-y-3 rounded-3xl bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-brand-forest">Inbox</h2>
          {inbox.map((note) => (
            <article key={note.id} className="rounded-2xl bg-brand-cream px-4 py-3 text-sm text-brand-forest">
              <p className="font-semibold">{note.subject}</p>
              <p>{note.body}</p>
              <p className="text-brand-forest/70">{note.fromName}</p>
            </article>
          ))}
          <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to the academy" className="min-h-16 w-full rounded-2xl bg-brand-cream p-3 text-sm text-brand-forest" />
          <button
            type="button"
            onClick={() => send('reply', { campaignId: inbox.find((note) => note.institutionId === institutionId)?.campaignId || inbox[0]?.campaignId, body: reply }, 'Reply sent.')}
            className="h-11 rounded-full bg-brand-blue px-5 text-sm font-semibold text-white"
          >
            Reply
          </button>
        </section>
      )}
    </div>
  );
}
