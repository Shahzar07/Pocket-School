'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BRAND } from '@/lib/brand-theme';
import {
  alumniCsv,
  alumniPrice,
  parentFinalSummary,
  publicName,
  type AlumniPerson,
  type AlumniPolicy,
  type Recommendation,
  type ShelfCourse,
} from '@/lib/alumni';
import { canUndoGraduation } from '@/lib/graduation';
import { documentPdf } from '@/lib/institution-pricing';

function reviewLabel(review: ShelfCourse['review']): string {
  if (review === 'lifetime') return 'Lifetime review';
  if (review === 'ended') return 'Review ended';
  return 'Read-only while the subscription is active';
}

export function CompletedShelf({
  completed,
  recommendations,
  onOpen,
  onEnrol,
  onAsk,
}: {
  completed: readonly ShelfCourse[];
  recommendations: readonly Recommendation[];
  onOpen?: (courseId: string) => void;
  onEnrol?: (courseId: string) => void;
  onAsk?: (title: string) => void;
}) {
  if (!completed.length && !recommendations.length) return null;
  return (
    <section className="space-y-4 rounded-[28px] border border-brand-ink/10 bg-white p-5 text-brand-ink">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-mid">Finished</p>
        <h2 className="font-heading text-3xl tracking-tight">Completed</h2>
      </div>
      <div className="space-y-3">
        {completed.map((course) => (
          <article key={course.courseId} className="rounded-2xl border border-brand-ink/10 bg-brand-mist p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{course.title}</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{reviewLabel(course.review)}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">
              {course.certificate === 'recorded'
                ? 'The certificate stays on this record.'
                : 'A certificate is added when the final assessment is passed.'}
            </p>
            {course.review !== 'ended' && onOpen ? (
              <button type="button" onClick={() => onOpen(course.courseId)} className="mt-3 text-sm font-semibold underline">Review the course</button>
            ) : null}
          </article>
        ))}
      </div>
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Next course</h3>
          {recommendations.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-ink/10 px-4 py-3">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-brand-ink/70">{item.level}</p>
              </div>
              {item.action === 'enrol' ? (
                <button type="button" onClick={() => onEnrol?.(item.id)} className="h-10 rounded-full bg-brand-ink px-4 text-sm font-semibold text-white">Enrol</button>
              ) : (
                <button type="button" onClick={() => onAsk?.(item.title)} className="h-10 rounded-full bg-brand-mid px-4 text-sm font-semibold text-white">Ask my school</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AlumniOfferCard({
  name,
  graceEndsOn,
  reviewOpen = false,
  discount,
  studentNumber,
  publicOn,
  onTogglePublic,
  onTranscript,
  joinHref,
}: {
  name: string;
  graceEndsOn: string;
  reviewOpen?: boolean;
  discount: number;
  studentNumber: string;
  publicOn: boolean;
  onTogglePublic?: (on: boolean) => void;
  onTranscript?: () => void;
  joinHref: string;
}) {
  const percent = Math.round(alumniPrice(100, discount).discount * 100);
  const profileUrl = studentNumber ? `https://poketschool.ai/p/${studentNumber}` : '';
  return (
    <section className="space-y-4 rounded-[28px] border border-brand-ink/10 bg-white p-5 text-brand-ink">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-mid">Alumni</p>
      <h2 className="font-heading text-3xl tracking-tight">Your record stays</h2>
      <p className="text-sm leading-relaxed">
        {name ? `${name}, your` : 'Your'} account is an individual account. Your profile, student number, certificates, badges, transcript, and progress stay.
        {reviewOpen
          ? ` Academy courses stay open to review until ${graceEndsOn}.`
          : ' Completed academy courses stay on your Completed shelf.'}
        {' '}The academy seat is free.
        {percent > 0 ? ` An alumni discount of ${percent}% is recorded for an individual plan.` : ''}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <a href="/dashboard/student/billing" className="flex h-11 items-center justify-center rounded-full bg-brand-ink px-4 text-sm font-semibold text-white">
          {percent > 0 ? `Individual plan, ${percent}% alumni discount` : 'Individual plan'}
        </a>
        <a href={joinHref} className="flex h-11 items-center justify-center rounded-full border border-brand-ink/15 px-4 text-sm font-semibold">Join another academy</a>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onTranscript?.()} className="h-10 rounded-full border border-brand-ink/15 px-4 text-sm font-semibold">Download record</button>
        <button type="button" onClick={() => onTogglePublic?.(!publicOn)} className="h-10 rounded-full border border-brand-ink/15 px-4 text-sm font-semibold">
          {publicOn ? 'Public profile is on' : 'Share a public profile'}
        </button>
      </div>
      {publicOn && profileUrl ? (
        <div className="flex items-center gap-3">
          <QRCodeSVG value={profileUrl} size={72} fgColor={BRAND.ink} bgColor={BRAND.mist} />
          <p className="text-xs leading-relaxed">The public page shows {publicName(name)} and the record. Email and date of birth stay off it.</p>
        </div>
      ) : null}
    </section>
  );
}

export function AlumniBoard({
  schoolName,
  people,
  policy,
  onSave,
  onMark,
  onUndo,
  onNewsletter,
  today = '',
}: {
  schoolName: string;
  people: readonly AlumniPerson[];
  policy: AlumniPolicy;
  onSave?: (policy: AlumniPolicy) => void;
  onMark?: (email: string) => void;
  onUndo?: (alumniId: string) => void;
  onNewsletter?: (note: string) => void;
  today?: string;
}) {
  const [graceDays, setGraceDays] = useState(policy.graceDays);
  const [discount, setDiscount] = useState(Math.round(policy.discount * 100));
  const [newsletter, setNewsletter] = useState(policy.newsletter);
  const [endDate, setEndDate] = useState(policy.endDate);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const byYear = people.reduce<Record<string, number>>((all, person) => {
    const year = person.leftOn.slice(0, 4) || 'Undated';
    all[year] = (all[year] ?? 0) + 1;
    return all;
  }, {});
  const certificates = people.reduce((sum, person) => sum + person.certificates, 0);
  const seatsFreed = people.filter((person) => person.seatFreed && !person.undoneOn).length;
  const download = () => {
    const bytes = documentPdf([
      `${schoolName} alumni`,
      `${people.length} alumni`,
      `${certificates} certificates`,
      ...people.slice(0, 30).map((person) => `${person.name} · ${person.level} · ${person.leftOn}`),
    ]);
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alumni.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };
  const csv = () => {
    const url = URL.createObjectURL(new Blob([alumniCsv([...people])], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alumni.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="space-y-5 rounded-[28px] bg-brand-mist p-5 text-brand-ink">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-mid">Alumni</p>
          <h1 className="font-heading text-4xl tracking-tight">{schoolName}</h1>
        </div>
        <p className="rounded-full bg-brand-ink px-4 py-2 text-sm font-semibold text-white">{people.length} alumni</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(byYear).map(([year, count]) => (
          <span key={year} className="rounded-full bg-white px-3 py-1">{year}: {count} graduate{count === 1 ? '' : 's'}</span>
        ))}
        <span className="rounded-full bg-brand-foam px-3 py-1">{seatsFreed} seat{seatsFreed === 1 ? '' : 's'} freed</span>
        <span className="rounded-full bg-white px-3 py-1">{certificates} certificates</span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white">
        {people.map((person) => (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-ink/10 px-4 py-3 text-sm last:border-0">
            <div>
              <p className="font-semibold">{person.name}</p>
              <p className="text-xs text-brand-ink/70">{person.level} · left {person.leftOn} · {person.claimedIndividual ? 'joined · no seat' : person.undoneOn ? 'seat restored' : person.seatFreed ? 'seat free · individual' : `seat free after ${person.graceEndsOn}`}</p>
            </div>
            <div className="flex items-center gap-3">
              <span>{person.certificates} certificates</span>
              {onUndo && canUndoGraduation({ leftOn: person.leftOn, today, undoneOn: person.undoneOn, seatFreed: person.seatFreed }) ? (
                <button type="button" onClick={() => onUndo(person.id)} className="h-9 rounded-full border border-brand-ink/15 px-3 text-xs font-semibold">Undo</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={csv} className="h-10 rounded-full border border-brand-ink/15 bg-white px-4 text-sm font-semibold">Export CSV</button>
        <button type="button" onClick={download} className="h-10 rounded-full border border-brand-ink/15 bg-white px-4 text-sm font-semibold">Export PDF</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="rounded-2xl bg-white p-4 text-sm">
          Grace days
          <input value={graceDays} onChange={(event) => setGraceDays(Number(event.target.value))} type="number" min={0} max={365} className="mt-2 h-11 w-full rounded-xl border border-brand-ink/15 px-3" />
          <span className="mt-1 block text-xs text-brand-ink/60">0 frees the seat today. A higher number keeps course review only.</span>
        </label>
        <label className="rounded-2xl bg-white p-4 text-sm">
          Alumni discount %
          <input value={discount} onChange={(event) => setDiscount(Number(event.target.value))} type="number" min={0} max={80} className="mt-2 h-11 w-full rounded-xl border border-brand-ink/15 px-3" />
          <span className="mt-1 block text-xs text-brand-ink/60">{policy.placeholder ? 'Placeholder until you save.' : 'Saved for this academy.'}</span>
        </label>
        <label className="rounded-2xl bg-white p-4 text-sm">
          End date
          <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" className="mt-2 h-11 w-full rounded-xl border border-brand-ink/15 px-3" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={newsletter} onChange={(event) => setNewsletter(event.target.checked)} />
        Alumni newsletter
      </label>
      <button
        type="button"
        onClick={() => onSave?.({ graceDays, discount: discount / 100, newsletter, endDate, placeholder: false })}
        className="h-11 rounded-full bg-brand-ink px-5 text-sm font-semibold text-white"
      >
        Save alumni settings
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <form className="rounded-2xl bg-white p-4" onSubmit={(event) => { event.preventDefault(); onMark?.(email); }}>
          <p className="text-sm font-semibold">Mark a leaver</p>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="student@school.edu" className="mt-2 h-11 w-full rounded-xl border border-brand-ink/15 px-3 text-sm" />
          <button type="submit" className="mt-3 h-10 rounded-full bg-brand-bright px-4 text-sm font-semibold text-white">Mark as alumni</button>
        </form>
        <form className="rounded-2xl bg-white p-4" onSubmit={(event) => { event.preventDefault(); onNewsletter?.(note); }}>
          <p className="text-sm font-semibold">Alumni note</p>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 h-20 w-full rounded-xl border border-brand-ink/15 px-3 py-2 text-sm" placeholder="A short note for alumni" />
          <button type="submit" className="mt-3 h-10 rounded-full bg-brand-mid px-4 text-sm font-semibold text-white">Send email</button>
        </form>
      </div>
    </section>
  );
}

export function FinalSummaryCard({
  institutionName,
  childName,
  level,
  certificates,
}: {
  institutionName: string;
  childName: string;
  level: string;
  certificates: number;
}) {
  const copy = parentFinalSummary({ institutionName, childName, level, certificates });
  return (
    <article className="rounded-[28px] border border-brand-ink/10 bg-brand-foam p-5 text-brand-ink">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Parent Explainer</p>
      <h2 className="mt-1 font-heading text-2xl">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed">{copy.body}</p>
    </article>
  );
}
