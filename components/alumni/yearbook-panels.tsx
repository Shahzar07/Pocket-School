'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';
import { AUDIENCES, COUNTRY_DOTS, STICKERS, YEARBOOK_TEMPLATES, type YearbookTemplate } from '@/lib/yearbook';

const COVER: Record<YearbookTemplate, string> = {
  deep: 'bg-hero',
  mid: 'bg-brand-primary text-white',
  bright: 'bg-blue-bright text-ink',
  mist: 'bg-wash text-ink',
};

export interface FlipSheet {
  heading: string;
  lines: string[];
}

export function YearbookFlipbook({
  template,
  academy,
  sheets,
}: {
  template: YearbookTemplate;
  academy: string;
  sheets: FlipSheet[];
}) {
  const pages = sheets.length ? sheets : [{ heading: academy || 'Yearbook', lines: [] }];
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)] ?? pages[0];
  return (
    <div className="mx-auto w-full max-w-sm">
      <article className={`flex min-h-80 flex-col justify-between rounded-3xl p-5 shadow-sm ${index === 0 ? COVER[template] : 'bg-white text-ink'}`}>
        <div>
          <p className="text-xs uppercase tracking-wide opacity-80">{academy || 'Poket School'}</p>
          <h2 className="mt-3 text-2xl font-semibold">{page?.heading}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {page?.lines.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
        <p className="text-xs opacity-70">{index + 1} of {pages.length}</p>
      </article>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} className="h-12 rounded-full bg-white text-sm font-semibold text-ink">Previous</button>
        <button type="button" onClick={() => setIndex((value) => Math.min(pages.length - 1, value + 1))} className="h-12 rounded-full bg-blue-deep text-sm font-semibold text-white">Next</button>
      </div>
    </div>
  );
}

export function YearbookShowcase() {
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Alumni yearbook</h1>
        <p className="mt-1 text-sm text-ink">Oak 2026 at North Academy. A parent agrees before an under-18 page can be submitted.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {YEARBOOK_TEMPLATES.map((item) => (
          <span key={item} className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold capitalize ${item === 'deep' ? COVER.deep : 'bg-white text-ink'}`}>{item}</span>
        ))}
      </div>
      <YearbookFlipbook
        template="deep"
        academy="North Academy"
        sheets={[
          { heading: 'Oak 2026', lines: ['North Academy', 'Lock date 2026-07-01'] },
          { heading: 'Ada L.', lines: ['Quote: Keep asking.', 'Most likely to: Open a school', 'Clubs: Debate', 'Achievement: Graduate', 'Destination: Oxford'] },
        ]}
      />
      <article className="space-y-2 rounded-3xl bg-white p-4 text-sm text-ink">
        <h2 className="text-lg font-semibold">Ada L.</h2>
        <p>Quote: Keep asking.</p>
        <p>Most likely to: Open a school</p>
        <p>Clubs: Debate</p>
        <p>Achievement: Graduate</p>
        <p>Destination: Oxford</p>
      </article>
      <article className="space-y-2 rounded-3xl bg-white p-4 text-sm text-ink">
        <p className="font-semibold">Teacher message</p>
        <p>Keep the library open.</p>
        <p className="font-semibold">Principal message</p>
        <p>You take this record with you.</p>
        <p>Class photo.</p>
        <p>Memory: The last assembly.</p>
      </article>
      <article className="space-y-2 rounded-3xl bg-background p-4 text-sm text-ink">
        <p className="font-semibold">Signing wall</p>
        <p>Sam T. left a note. Held for an academy moderator.</p>
        <p>Class wall · mid sticker.</p>
        <p>Direct messages stay off for anyone under 18.</p>
      </article>
      <article className="space-y-2 rounded-3xl bg-white p-4 text-sm text-ink">
        <p className="font-semibold">Alumni wall</p>
        <p>Reunion · RSVP 6</p>
        <p>Where they are now: Malaysia 6. One country stays hidden until five people share it.</p>
        <div className="relative h-28 rounded-2xl bg-blue-deep">
          <span className="absolute rounded-full bg-brand-primary" style={{ left: `${COUNTRY_DOTS.Malaysia.x}%`, top: `${COUNTRY_DOTS.Malaysia.y}%`, width: 12, height: 12 }} />
        </div>
      </article>
      <article className="space-y-2 rounded-3xl bg-white p-4 text-sm text-ink">
        <p className="font-semibold">Find alumni</p>
        <p>Search by cohort, class, destination, industry, and country. Adults who opted in can connect.</p>
        <p>Ada L. asked to connect with Grace H.</p>
        <p>Mentorship with a current student waits for the academy.</p>
      </article>
    </div>
  );
}

interface YearbookDesk {
  books: { id: string; name: string; lockOn: string; status: string; template?: string }[];
  book: null | {
    id: string;
    name: string;
    lockOn: string;
    status: string;
    template: YearbookTemplate;
    principalMessage?: string;
    teacherMessage?: string;
    pages?: { id: string; status: string; parentApproved: boolean; quote: string; mostLikely?: string; clubs?: string }[];
    held?: { id: string; authorName: string; body: string }[];
    portraits?: { id: string; lines: string[]; initials: string }[];
  };
}

export function InstitutionYearbookDesk({ institutionId }: { institutionId: string }) {
  const [desk, setDesk] = useState<YearbookDesk>({ books: [], book: null });
  const [bookId, setBookId] = useState('');
  const [template, setTemplate] = useState<YearbookTemplate>('deep');
  const [lockOn, setLockOn] = useState('');
  const [principalMessage, setPrincipalMessage] = useState('');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [tick, setTick] = useState(0);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (!institutionId) return;
    const query = bookId ? `&bookId=${encodeURIComponent(bookId)}` : '';
    authedFetch(`/api/institutions/yearbook?institutionId=${encodeURIComponent(institutionId)}${query}`)
      .then((data) => {
        const next = data as unknown as YearbookDesk;
        setDesk(next);
        const book = next.book;
        if (book) {
          setBookId(book.id);
          setTemplate(book.template || 'deep');
          setLockOn(book.lockOn || '');
          setPrincipalMessage(book.principalMessage || '');
          setTeacherMessage(book.teacherMessage || '');
        }
      })
      .catch(() => toast.error('Could not open the yearbook.'));
  }, [institutionId, bookId, tick]);

  function send(action: string, extra: Record<string, unknown>) {
    void authedFetch('/api/institutions/yearbook', {
      method: 'POST',
      body: JSON.stringify({ action, institutionId, bookId: bookId || desk.book?.id, ...extra }),
    })
      .then((data) => {
        if (action === 'pdf' && typeof data.pdf === 'string') {
          const bytes = Uint8Array.from(atob(data.pdf), (char) => char.charCodeAt(0));
          const copy = new Uint8Array(bytes);
          const url = URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'yearbook.pdf';
          link.click();
          URL.revokeObjectURL(url);
        }
        toast.success('Saved.');
        setTick((value) => value + 1);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save the yearbook.'));
  }

  const book = desk.book;
  return (
    <section className="space-y-4 rounded-3xl bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Yearbook</h2>
        <p className="mt-1 text-sm text-ink">Approve pages, set the lock date, then release the book. A page never occupies a seat.</p>
      </div>
      <label className="block text-sm text-ink">
        Class book
        <select value={bookId} onChange={(event) => setBookId(event.target.value)} className="mt-1 h-12 w-full rounded-2xl bg-wash px-3">
          {desk.books.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {YEARBOOK_TEMPLATES.map((item) => (
          <button key={item} type="button" onClick={() => setTemplate(item)} className={`h-10 rounded-full px-4 text-sm font-semibold capitalize ${template === item ? COVER[item] : 'bg-wash text-ink'}`}>{item}</button>
        ))}
      </div>
      <label className="block text-sm text-ink">
        Lock date
        <input value={lockOn} onChange={(event) => setLockOn(event.target.value)} placeholder="YYYY-MM-DD" className="mt-1 h-12 w-full rounded-2xl bg-wash px-3" />
      </label>
      <textarea value={teacherMessage} onChange={(event) => setTeacherMessage(event.target.value)} placeholder="Teacher message" className="min-h-20 w-full rounded-2xl bg-wash p-3 text-sm" />
      <textarea value={principalMessage} onChange={(event) => setPrincipalMessage(event.target.value)} placeholder="Principal message" className="min-h-20 w-full rounded-2xl bg-wash p-3 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => send('staff', { template, lockOn, principalMessage, teacherMessage })} className="h-12 rounded-full bg-blue-deep text-sm font-semibold text-white">Save book</button>
        <button type="button" onClick={() => send('release', {})} className="h-12 rounded-full bg-brand-primary text-sm font-semibold text-white">Release</button>
      </div>
      <button type="button" onClick={() => send('pdf', { viewer: 'classmates' })} className="h-12 w-full rounded-full bg-brand-primary text-sm font-semibold text-white">Download PDF</button>
      <label className="block text-sm text-ink">
        Class photo caption
        <input value={caption} onChange={(event) => setCaption(event.target.value)} className="mt-1 h-12 w-full rounded-2xl bg-wash px-3" />
      </label>
      <button type="button" onClick={() => send('gallery', { caption, imageUrl: '' })} className="h-12 rounded-full bg-white px-5 text-sm font-semibold text-ink ring-1 ring-blue-deep">Add to gallery</button>
      <div className="space-y-2">
        {(book?.pages ?? []).map((page) => (
          <div key={page.id} className="rounded-2xl bg-wash px-4 py-3 text-sm text-ink">
            <p className="font-semibold">{page.status}{page.parentApproved ? ' · parent agreed' : ''}</p>
            <p>{page.quote}</p>
            {page.status !== 'approved' && (
              <button type="button" onClick={() => send('approve', { studentId: page.id })} className="mt-2 h-10 rounded-full bg-blue-deep px-4 text-sm font-semibold text-white">Approve</button>
            )}
          </div>
        ))}
        {(book?.held ?? []).map((row) => (
          <div key={row.id} className="rounded-2xl border border-blue-deep px-4 py-3 text-sm text-ink">
            <p className="font-semibold">{row.authorName}</p>
            <p>{row.body}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => send('moderate', { queueId: row.id, release: true })} className="h-10 rounded-full bg-blue-deep px-4 text-sm font-semibold text-white">Release</button>
              <button type="button" onClick={() => send('moderate', { queueId: row.id, release: false })} className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-ink">Block</button>
            </div>
          </div>
        ))}
      </div>
      {book && (
        <YearbookFlipbook
          template={book.template || 'deep'}
          academy={book.name}
          sheets={(book.portraits ?? []).map((page) => ({ heading: page.initials, lines: page.lines }))}
        />
      )}
      <p className="text-xs text-ink/70">Audiences: {AUDIENCES.join(', ')}. Stickers: {STICKERS.join(', ')}.</p>
    </section>
  );
}
