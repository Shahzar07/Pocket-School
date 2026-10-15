'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPublicCourses, Course } from '@/lib/db';
import { formatCoursePrice } from '@/lib/money';

export default function DashboardMarketplace() {
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    getPublicCourses().then(setCourses).catch(() => setCourses([]));
  }, []);
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <h1 className="font-heading text-4xl">Marketplace</h1>
      <p className="text-sm text-muted-foreground">Courses you can browse without leaving your dashboard.</p>
      {courses.length === 0 && <p className="text-sm text-muted-foreground">No public courses yet.</p>}
      <ul className="grid sm:grid-cols-2 gap-3">
        {courses.map((c) => (
          <li key={c.id}>
            <Link href={`/courses/${c.id}`} className="block rounded-2xl border border-border p-4 hover:bg-muted">
              <p className="font-semibold">{c.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{formatCoursePrice(c.price, c.currency)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
