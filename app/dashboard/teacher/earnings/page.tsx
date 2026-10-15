'use client';

import { useEffect, useState } from 'react';
import { useAuthSTORE } from '@/hooks/use-auth';
import { getTeacherCourses, Course } from '@/lib/db';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatMoney } from '@/lib/money';

export default function EarningsPage() {
  const { user } = useAuthSTORE();
  const [courses, setCourses] = useState<Course[]>([]);
  const [paid, setPaid] = useState(0);
  const [count, setCount] = useState(0);

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
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Earnings</p>
      <h1 className="font-heading text-4xl">Course sales</h1>
      <p className="text-muted-foreground text-sm">Paid enrolments recorded by Stripe. Payouts to your bank are coming soon — this page shows what has been sold, not what has been transferred.</p>
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
