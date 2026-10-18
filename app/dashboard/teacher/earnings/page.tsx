'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, Course } from '@/lib/db';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatMoney } from '@/lib/money';
import { authedFetch, ApiError } from '@/lib/api-client';

export default function EarningsPage() {
  const { user } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [paid, setPaid] = useState(0);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState('');
  const [offer, setOffer] = useState({ title: '', price: '25', currency: 'USD', minutes: '60' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const mine = await getTeacherCourses(user.uid);
      setCourses(mine);
      const snap = await getDocs(query(collection(db, 'invoices'), where('createdBy', '==', user.uid)));
      const rows = snap.docs.map((d) => d.data());
      const settled = rows.filter((r) => r.status === 'paid');
      setCount(settled.length);
      setPaid(settled.reduce((n, r) => n + (Number(r.amount) || 0), 0));
    })().catch(() => {});
  }, [user]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-success">Earnings</p>
      <h1 className="font-heading text-4xl">Course sales</h1>
      <p className="text-muted-foreground text-sm">Sales recorded here. Payouts go to a Stripe Connect account. With no secret key, Connect stays in sandbox and nothing is sent to a bank.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold"
          onClick={() => void authedFetch('/api/payments/connect', { method: 'POST', body: '{}' }).then((data) => {
            if (typeof data.url === 'string') window.location.assign(data.url);
            else setNotice(typeof data.message === 'string' ? data.message : 'Payout account updated.');
          }).catch((error: unknown) => setNotice(error instanceof ApiError ? error.message : 'Connect is unavailable.'))}
        >
          Set up payouts
        </button>
      </div>
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <form
        className="rounded-3xl border border-border bg-card p-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void authedFetch('/api/payments/offer', {
            method: 'POST',
            body: JSON.stringify({ title: offer.title, price: Number(offer.price), currency: offer.currency, minutes: Number(offer.minutes) }),
          }).then(() => setNotice('Session listed. Learners pay it from checkout.')).catch((error: unknown) => {
            setNotice(error instanceof ApiError ? error.message : 'The session could not be listed.');
          });
        }}
      >
        <h2 className="font-semibold">Offer a tutoring session</h2>
        <input aria-label="Session title" value={offer.title} onChange={(event) => setOffer((current) => ({ ...current, title: event.target.value }))} placeholder="IGCSE Maths, one hour" className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
        <div className="flex gap-2">
          <input aria-label="Session price" value={offer.price} onChange={(event) => setOffer((current) => ({ ...current, price: event.target.value }))} className="h-10 w-28 rounded-xl border border-border px-3 text-sm" />
          <select aria-label="Session currency" value={offer.currency} onChange={(event) => setOffer((current) => ({ ...current, currency: event.target.value }))} className="h-10 rounded-xl border border-border px-3 text-sm">
            <option value="USD">USD</option>
            <option value="MYR">MYR</option>
          </select>
        </div>
        <button type="submit" className="h-10 px-4 rounded-full border border-border text-sm font-semibold">List session</button>
      </form>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Paid sales</p>
          <p className="text-3xl font-bold">{formatMoney(paid)}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Paid invoices</p>
          <p className="text-3xl font-bold">{count}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {courses.length === 0 && <li className="text-sm text-muted-foreground">You have not published a course yet. Create one from Courses, then share the join code with your class.</li>}
        {courses.map((c) => (
          <li key={c.id} className="rounded-2xl border border-border px-4 py-3 flex justify-between text-sm">
            <span>{c.title || 'Untitled course'}</span>
            <span>{formatMoney(c.price ?? 0, c.currency)} · {c.enrollmentCount ?? 0} enrolled</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
