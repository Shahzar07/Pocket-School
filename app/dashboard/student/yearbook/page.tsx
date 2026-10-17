'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { YearbookFlipbook, type FlipSheet } from '@/components/alumni/yearbook-panels';
import { useAuthSTORE } from '@/hooks/use-auth';
import { authedFetch } from '@/lib/api-client';
import { AUDIENCES, STICKERS, type YearbookAudience, type YearbookTemplate } from '@/lib/yearbook';

interface Portrait {
  id: string;
  lines: string[];
  initials: string;
  status: string;
}

interface OwnPage {
  quote: string;
  mostLikely: string;
  clubs: string;
  photo: boolean;
  audiences: Record<string, YearbookAudience>;
  status: string;
  parentApproved: boolean;
  minor: boolean;
}

interface YearbookView {
  institutionId?: string;
  books: { id: string; name: string; lockOn: string; status: string }[];
  suggestions: string[];
  book: null | {
    id: string;
    name: string;
    lockOn: string;
    status: string;
    template: YearbookTemplate;
    principalMessage: string;
    teacherMessage: string;
    own: OwnPage | null;
    portraits: Portrait[];
    wall: { id: string; fromName: string; toId: string; body: string; sticker: string; queued: boolean }[];
    memories: { id: string; title: string; body: string; authorName: string; queued: boolean }[];
    gallery: { id: string; caption: string }[];
  };
  feed: { id: string; kind: string; title: string; body: string; authorName: string; likeCount: number; rsvpCount: number }[];
  map: { countries: { country: string; count: number; names: string[] }[]; hiddenCountries: number };
  connections: { id: string; name: string; status: string }[];
  people: { id: string; name: string; year: string; className: string; destination: string; industry: string; country: string }[];
}

const EMPTY: YearbookView = {
  books: [],
  suggestions: [],
  book: null,
  feed: [],
  map: { countries: [], hiddenCountries: 0 },
  connections: [],
  people: [],
};

export default function StudentYearbookPage() {
  const uid = useAuthSTORE((state) => state.user?.uid ?? '');
  const [view, setView] = useState<YearbookView>(EMPTY);
  const [institutionId, setInstitutionId] = useState('');
  const [bookId, setBookId] = useState('');
  const [quote, setQuote] = useState('');
  const [mostLikely, setMostLikely] = useState('');
  const [clubs, setClubs] = useState('');
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState('');
  const [sticker, setSticker] = useState('');
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryBody, setMemoryBody] = useState('');
  const [feedTitle, setFeedTitle] = useState('');
  const [feedBody, setFeedBody] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [className, setClassName] = useState('');
  const [destination, setDestination] = useState('');
  const [industry, setIndustry] = useState('');
  const [directory, setDirectory] = useState(false);
  const [shareName, setShareName] = useState(false);
  const [childId, setChildId] = useState('');
  const [studentId, setStudentId] = useState('');

  const load = useCallback((nextInstitution?: string, nextBook?: string, filters?: { year?: string; className?: string; destination?: string; industry?: string; country?: string }) => {
    const params = new URLSearchParams();
    if (nextInstitution) params.set('institutionId', nextInstitution);
    if (nextBook) params.set('bookId', nextBook);
    if (filters?.year) params.set('year', filters.year);
    if (filters?.className) params.set('className', filters.className);
    if (filters?.destination) params.set('destination', filters.destination);
    if (filters?.industry) params.set('industry', filters.industry);
    if (filters?.country) params.set('country', filters.country);
    const query = params.toString();
    authedFetch(`/api/alumni/yearbook${query ? `?${query}` : ''}`)
      .then((data) => {
        const next = data as unknown as YearbookView;
        setView(next);
        setInstitutionId(next.institutionId || nextInstitution || '');
        if (next.book) {
          setBookId(next.book.id);
          if (next.book.own) {
            setQuote(next.book.own.quote);
            setMostLikely(next.book.own.mostLikely);
            setClubs(next.book.own.clubs);
            setPhoto(next.book.own.photo);
          }
        }
      })
      .catch(() => toast.error('Could not open the yearbook.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  function send(action: string, extra: Record<string, unknown>, path = '/api/alumni/yearbook') {
    void authedFetch(path, {
      method: 'POST',
      body: JSON.stringify({ action, institutionId, bookId, ...extra }),
    })
      .then(() => {
        toast.success('Saved.');
        load(institutionId, bookId);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save that.'));
  }

  const book = view.book;
  const sheets: FlipSheet[] = [
    { heading: book?.name || 'Yearbook', lines: [book?.teacherMessage, book?.principalMessage, book?.lockOn ? `Lock date ${book.lockOn}` : ''].filter((line): line is string => Boolean(line)) },
    ...(book?.portraits ?? []).map((page) => ({ heading: page.lines[0]?.replace(/^Name:\s*/, '') || page.initials, lines: page.lines })),
  ];

  return (
    <div className="mx-auto max-w-sm space-y-4 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-brand-forest">Yearbook</h1>
        <p className="mt-1 text-sm text-brand-forest">Your page, the class wall, and the alumni feed. Direct messages stay off for anyone under 18.</p>
      </header>
      {view.books.length > 1 && (
        <select value={bookId} onChange={(event) => { setBookId(event.target.value); load(institutionId, event.target.value); }} className="h-12 w-full rounded-2xl bg-white px-3 text-sm">
          {view.books.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      )}
      <YearbookFlipbook template={book?.template || 'forest'} academy={book?.name || 'Poket School'} sheets={sheets} />
      {book?.own && (
        <section className="space-y-3 rounded-3xl bg-white p-4">
          <h2 className="text-lg font-semibold text-brand-forest">Your page</h2>
          {book.own.minor && !book.own.parentApproved && <p className="text-sm text-brand-coral">A parent agrees before this page can be submitted.</p>}
          <textarea value={quote} onChange={(event) => setQuote(event.target.value)} placeholder="Quote" className="min-h-20 w-full rounded-2xl bg-brand-cream p-3 text-sm" />
          <input value={mostLikely} onChange={(event) => setMostLikely(event.target.value)} placeholder="Most likely to" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
          <input value={clubs} onChange={(event) => setClubs(event.target.value)} placeholder="Clubs" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
          <label className="flex h-12 items-center gap-2 text-sm text-brand-forest">
            <input type="checkbox" checked={photo} onChange={(event) => setPhoto(event.target.checked)} />
            Show my photo to people I opt in
          </label>
          <button type="button" onClick={() => send('save', { quote, mostLikely, clubs, photo, audiences: book.own?.audiences })} className="h-12 w-full rounded-full bg-brand-forest text-sm font-semibold text-white">Save page</button>
          <button type="button" onClick={() => send('submit', {})} className="h-12 w-full rounded-full bg-brand-gold text-sm font-semibold text-brand-forest">Submit for approval</button>
          <p className="text-xs text-brand-forest/70">Status {book.own.status}. Lock date {book.lockOn || 'open'}.</p>
          <div className="space-y-2">
            {AUDIENCES.map((audience) => (
              <p key={audience} className="text-xs capitalize text-brand-forest/70">{audience}</p>
            ))}
          </div>
        </section>
      )}
      <section className="space-y-3 rounded-3xl bg-brand-sand p-4">
        <h2 className="text-lg font-semibold text-brand-forest">Parent agreement</h2>
        <input value={childId} onChange={(event) => setChildId(event.target.value)} placeholder="Student id" className="h-12 w-full rounded-2xl bg-white px-3 text-sm" />
        <button type="button" onClick={() => send('parent-approve', { studentId: childId })} className="h-12 w-full rounded-full bg-brand-forest text-sm font-semibold text-white">Agree to this page</button>
      </section>
      <section className="space-y-3 rounded-3xl bg-white p-4">
        <h2 className="text-lg font-semibold text-brand-forest">Signing wall</h2>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="A note for the class wall" className="min-h-20 w-full rounded-2xl bg-brand-cream p-3 text-sm" />
        <div className="flex flex-wrap gap-2">
          {STICKERS.map((item) => (
            <button key={item} type="button" onClick={() => setSticker(item)} className={`h-10 rounded-full px-4 text-sm capitalize ${sticker === item ? 'bg-brand-forest text-white' : 'bg-brand-cream text-brand-forest'}`}>{item}</button>
          ))}
        </div>
        <button type="button" onClick={() => send('sign', { toId: 'wall', body: note, sticker })} className="h-12 w-full rounded-full bg-brand-coral text-sm font-semibold text-white">Sign the class wall</button>
        {(book?.wall ?? []).map((row) => (
          <div key={row.id} className="rounded-2xl bg-brand-cream px-3 py-3 text-sm text-brand-forest">
            <p className="font-semibold">{row.fromName}{row.sticker ? ` · ${row.sticker}` : ''}</p>
            <p>{row.body}</p>
            {row.queued && <p className="text-brand-coral">Held for an academy moderator.</p>}
            <button type="button" onClick={() => send('report', { targetId: row.fromName, postId: row.id, reason: 'Yearbook note' })} className="mt-2 h-10 rounded-full bg-white px-4 text-sm">Report</button>
          </div>
        ))}
        {(book?.memories ?? []).map((row) => (
          <p key={row.id} className="text-sm text-brand-forest">{row.title}: {row.body} · {row.authorName}</p>
        ))}
        <input value={memoryTitle} onChange={(event) => setMemoryTitle(event.target.value)} placeholder="Memory title" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
        <textarea value={memoryBody} onChange={(event) => setMemoryBody(event.target.value)} placeholder="What happened" className="min-h-16 w-full rounded-2xl bg-brand-cream p-3 text-sm" />
        <button type="button" onClick={() => send('memory', { title: memoryTitle, body: memoryBody })} className="h-12 w-full rounded-full bg-brand-forest text-sm font-semibold text-white">Add a memory</button>
      </section>
      <section className="space-y-3 rounded-3xl bg-white p-4">
        <h2 className="text-lg font-semibold text-brand-forest">Alumni wall</h2>
        {view.suggestions.length > 0 && <p className="text-sm text-brand-forest">From your record: {view.suggestions.join(', ')}</p>}
        <input value={feedTitle} onChange={(event) => setFeedTitle(event.target.value)} placeholder="Update, reunion, or a recorded achievement" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
        <textarea value={feedBody} onChange={(event) => setFeedBody(event.target.value)} placeholder="What changed" className="min-h-16 w-full rounded-2xl bg-brand-cream p-3 text-sm" />
        <button type="button" onClick={() => send('feed', { kind: 'update', title: feedTitle, body: feedBody })} className="h-12 w-full rounded-full bg-brand-blue text-sm font-semibold text-white">Share an update</button>
        {view.feed.map((row) => (
          <article key={row.id} className="rounded-2xl bg-brand-cream px-3 py-3 text-sm text-brand-forest">
            <p className="font-semibold">{row.title || row.kind}</p>
            <p>{row.authorName}</p>
            <p>{row.body}</p>
            <p>{row.likeCount} likes{row.kind === 'reunion' ? ` · RSVP ${row.rsvpCount}` : ''}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => send('like', { feedId: row.id })} className="h-10 rounded-full bg-white px-4 text-sm">Like</button>
              {row.kind === 'reunion' && <button type="button" onClick={() => send('rsvp', { feedId: row.id, going: true })} className="h-10 rounded-full bg-brand-forest px-4 text-sm text-white">RSVP</button>}
            </div>
          </article>
        ))}
      </section>
      <section className="space-y-3 rounded-3xl bg-brand-forest p-4 text-white">
        <h2 className="text-lg font-semibold">Where they are now</h2>
        {view.map.countries.map((row) => (
          <p key={row.country} className="text-sm">{row.country} · {row.count}{row.names.length ? ` · ${row.names.join(', ')}` : ''}</p>
        ))}
        {view.map.hiddenCountries > 0 && <p className="text-sm text-brand-sand">{view.map.hiddenCountries} countries stay hidden until five people share them.</p>}
        <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country" className="h-12 w-full rounded-2xl bg-white px-3 text-sm text-brand-forest" />
        <label className="flex h-12 items-center gap-2 text-sm">
          <input type="checkbox" checked={shareName} onChange={(event) => setShareName(event.target.checked)} />
          Show my name on the map
        </label>
        <label className="flex h-12 items-center gap-2 text-sm">
          <input type="checkbox" checked={directory} onChange={(event) => setDirectory(event.target.checked)} />
          Opt in to the adult directory
        </label>
        <button type="button" onClick={() => send('place', { country, shareName, directory, destination, industry, year, className })} className="h-12 w-full rounded-full bg-brand-gold text-sm font-semibold text-brand-forest">Save where I am</button>
      </section>
      <section className="space-y-3 rounded-3xl bg-white p-4">
        <h2 className="text-lg font-semibold text-brand-forest">Find and connect</h2>
        <input value={year} onChange={(event) => setYear(event.target.value)} placeholder="Cohort" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
        <input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Class" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
        <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Destination" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
        <input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Industry" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
        <button type="button" onClick={() => load(institutionId, bookId, { year, className, destination, industry, country })} className="h-12 w-full rounded-full bg-brand-forest text-sm font-semibold text-white">Search alumni</button>
        {view.people.map((person) => (
          <div key={person.id} className="rounded-2xl bg-brand-cream px-3 py-3 text-sm text-brand-forest">
            <p className="font-semibold">{person.name}</p>
            <p>{[person.year, person.className, person.destination, person.industry, person.country].filter(Boolean).join(' · ')}</p>
            {person.id !== uid && (
              <button type="button" onClick={() => send('connect', { otherId: person.id })} className="mt-2 h-10 rounded-full bg-brand-forest px-4 text-sm font-semibold text-white">Connect</button>
            )}
          </div>
        ))}
        {view.connections.map((row) => (
          <div key={row.id} className="text-sm text-brand-forest">
            <p>{row.name} · {row.status}</p>
            {row.status === 'pending' && <button type="button" onClick={() => send('accept', { otherId: row.id })} className="mt-1 h-10 rounded-full bg-brand-gold px-4 text-sm font-semibold text-brand-forest">Accept</button>}
          </div>
        ))}
        <input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Current student id" className="h-12 w-full rounded-2xl bg-brand-cream px-3 text-sm" />
        <button type="button" onClick={() => send('mentor-offer', { studentId }, '/api/alumni/network')} className="h-12 w-full rounded-full bg-brand-blue text-sm font-semibold text-white">Offer mentorship</button>
        <p className="text-xs text-brand-forest/70">The academy approves a mentorship before messages open.</p>
      </section>
    </div>
  );
}
