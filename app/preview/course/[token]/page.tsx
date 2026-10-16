'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ReviewScreen } from '@/components/course-review/review-screen';
import { samplePreviewCourse } from '@/lib/course-review-sample';
import { readCoursePreview } from '@/lib/course-review-store';
import type { PreviewCourse } from '@/lib/course-review';

export default function SharedCoursePreviewPage() {
  const { token } = useParams<{ token: string }>();
  const sample = token === 'sample' ? samplePreviewCourse() : null;
  const [course, setCourse] = useState<PreviewCourse | null>(sample?.course ?? null);
  const [expiresAt, setExpiresAt] = useState<number | undefined>(sample ? Date.now() + 7 * 24 * 60 * 60 * 1000 : undefined);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!token || token === 'sample') return;
    readCoursePreview(token).then(found => {
      if (!found) setMissing(true);
      else {
        setCourse(found.course);
        setExpiresAt(found.expiresAt);
      }
    }).catch(() => setMissing(true));
  }, [token]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/dashboard/admin/curriculum" className="font-semibold text-[#1E6A83]">Course CMS</Link>
        <span> / Preview course</span>
      </p>
      {missing && <p className="text-sm text-muted-foreground">This preview link has expired or was not found.</p>}
      {!course && !missing && <div className="h-72 animate-pulse rounded-3xl bg-muted" />}
      {course && sample && (
        <ReviewScreen
          initial={course}
          snapshot={sample.snapshot}
          comments={sample.comments}
          staff
          actorName="Ms Rahman"
          expiresAt={expiresAt}
        />
      )}
      {course && !sample && (
        <ReviewScreen initial={course} snapshot={null} comments={[]} staff={false} expiresAt={expiresAt} />
      )}
    </main>
  );
}
