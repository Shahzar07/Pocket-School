'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authedFetch } from '@/lib/api-client';

interface SchoolMatch {
  id: string;
  name: string;
  country: string;
  state: string;
}

interface ClaimRow {
  id: string;
  institutionId: string;
  schoolKey: string;
  schoolName: string;
  className: string;
  graduationYear: string;
  status: string;
}

interface GroupPost {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  visible: boolean;
  queued: boolean;
}

interface ClaimHome {
  country: string;
  state: string;
  minor: boolean;
  mine: ClaimRow[];
  groups: { key: string; name: string; posts: GroupPost[] }[];
  children: { childId: string; childName: string; claimId: string; schoolName: string; className: string; graduationYear: string }[];
}

const STATUS: Record<string, string> = {
  needs_parent: 'Waiting for a parent',
  pending: 'Waiting for the academy',
  verified: 'In the alumni network',
  unverified: 'Unverified',
  rejected: 'Not confirmed',
};

export function AttendedSchoolPanel() {
  const [home, setHome] = useState<ClaimHome | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [matches, setMatches] = useState<SchoolMatch[]>([]);
  const [year, setYear] = useState('');
  const [className, setClassName] = useState('');
  const [country, setCountry] = useState('');
  const [stateName, setStateName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    authedFetch('/api/alumni/claim')
      .then((data) => {
        const next = data as unknown as ClaimHome;
        if (!Array.isArray(next.mine)) return;
        setHome(next);
        setCountry((value) => value || next.country || '');
        setStateName((value) => value || next.state || '');
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (institutionId || schoolName.trim().length < 2) {
      setMatches([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void authedFetch(`/api/alumni/claim?q=${encodeURIComponent(schoolName.trim())}`)
        .then((data) => setMatches(Array.isArray(data.schools) ? data.schools as SchoolMatch[] : []))
        .catch(() => setMatches([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [schoolName, institutionId]);

  const send = (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    void authedFetch('/api/alumni/claim', { method: 'POST', body: JSON.stringify(body) })
      .then((data) => {
        toast.success(typeof data.message === 'string' ? data.message : done);
        setSchoolName('');
        setInstitutionId('');
        setYear('');
        setClassName('');
        setNote('');
        load();
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not save that school.'))
      .finally(() => setBusy(false));
  };

  return (
    <section id="attended-school" className="space-y-4 rounded-3xl bg-white p-4 text-brand-forest sm:p-6">
      <div>
        <h2 className="text-xl font-semibold">Add a school I attended</h2>
        <p className="mt-1 text-sm">An individual account can join that school&apos;s alumni network. A registered academy confirms you. No seat is used.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm md:col-span-2">School
          <input
            value={schoolName}
            onChange={(event) => { setSchoolName(event.target.value); setInstitutionId(''); }}
            placeholder="Search a Poket School academy or type a name"
            className="mt-1 h-12 w-full rounded-2xl bg-brand-cream px-3"
          />
        </label>
        {matches.length > 0 && (
          <div className="flex flex-wrap gap-2 md:col-span-2">
            {matches.map((school) => (
              <button
                key={school.id}
                type="button"
                onClick={() => { setInstitutionId(school.id); setSchoolName(school.name); setMatches([]); }}
                className="h-10 rounded-full bg-brand-forest px-4 text-sm font-semibold text-white"
              >
                {school.name}
              </button>
            ))}
          </div>
        )}
        {institutionId && <p className="text-sm md:col-span-2">This academy is on Poket School. A roster or email-domain match is confirmed at once. Anything else waits for the academy.</p>}
        <label className="text-sm">Graduation year
          <input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" placeholder="2024" className="mt-1 h-12 w-full rounded-2xl bg-brand-cream px-3" />
        </label>
        <label className="text-sm">Class
          <input value={className} onChange={(event) => setClassName(event.target.value)} className="mt-1 h-12 w-full rounded-2xl bg-brand-cream px-3" />
        </label>
        {!institutionId && (
          <>
            <label className="text-sm">Country
              <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="MY" className="mt-1 h-12 w-full rounded-2xl bg-brand-cream px-3" />
            </label>
            <label className="text-sm">State / region
              <input value={stateName} onChange={(event) => setStateName(event.target.value)} className="mt-1 h-12 w-full rounded-2xl bg-brand-cream px-3" />
            </label>
          </>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => send({
          action: 'request',
          institutionId,
          schoolName,
          graduationYear: year,
          className,
          country,
          state: stateName,
        }, 'Request sent.')}
        className="h-12 rounded-full bg-brand-forest px-5 text-sm font-semibold text-white"
      >
        {busy ? 'Sending…' : 'Add school'}
      </button>
      {home?.minor && <p className="text-sm">A parent confirms this before you can use the alumni network. The same minor rules apply after that.</p>}
      {home && home.mine.length > 0 && (
        <ul className="space-y-2">
          {home.mine.map((row) => (
            <li key={row.id} className="rounded-2xl bg-brand-cream px-4 py-3 text-sm">
              <span className="font-semibold">{row.schoolName}</span>
              <span> · {row.className} · {row.graduationYear}</span>
              <span className={`ml-2 inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${row.status === 'unverified' ? 'bg-brand-sand' : 'bg-white'}`}>
                {STATUS[row.status] ?? row.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      {home?.children.map((child) => (
        <div key={`${child.childId}-${child.claimId}`} className="rounded-2xl bg-brand-sand px-4 py-3 text-sm">
          <p>{child.childName} asked to join {child.schoolName}, class {child.className}, {child.graduationYear}.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => send({ action: 'approve-child', childId: child.childId, claimId: child.claimId }, 'Confirmed.')}
            className="mt-2 h-10 rounded-full bg-brand-forest px-4 text-sm font-semibold text-white"
          >
            Confirm
          </button>
        </div>
      ))}
      {home?.groups.map((group) => (
        <div key={group.key} className="space-y-2 rounded-2xl border border-brand-gold p-4">
          <p className="text-sm font-semibold">{group.name} <span className="ml-2 rounded-full bg-brand-sand px-3 py-1 text-xs">Unverified</span></p>
          <p className="text-sm">Peer-joined and moderated. Notes from anyone under 18 wait for an adult in the group. If this school registers, the group joins its official alumni network.</p>
          <ul className="space-y-2">
            {group.posts.filter((post) => post.visible || post.queued).map((post) => (
              <li key={post.id} className="rounded-2xl bg-brand-cream px-3 py-2 text-sm">
                <span className="font-semibold">{post.authorName}.</span> {post.body}
                {post.queued && <span className="ml-2 text-xs">Held</span>}
                {post.queued && (
                  <button type="button" onClick={() => send({ action: 'release', schoolKey: group.key, postId: post.id }, 'Released.')} className="ml-2 h-8 rounded-full bg-white px-3 text-xs font-semibold">Release</button>
                )}
              </li>
            ))}
          </ul>
          <label className="block text-sm">Note
            <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 h-12 w-full rounded-2xl bg-brand-cream px-3" />
          </label>
          <button type="button" disabled={busy} onClick={() => send({ action: 'post', schoolKey: group.key, body: note }, 'Sent.')} className="h-10 rounded-full bg-brand-gold px-4 text-sm font-semibold text-brand-forest">Post</button>
        </div>
      ))}
    </section>
  );
}
